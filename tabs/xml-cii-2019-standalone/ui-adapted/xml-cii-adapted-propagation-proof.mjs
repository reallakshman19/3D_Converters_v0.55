/** Independent, source-identity-bound CII checks. No global string searches. */
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/;
const MISSING = new Set(['', '-', '—', '–', 'n/a', 'na', 'none', 'null', 'undefined']);

export function engineeringNumber(value, temperature = false) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const source = String(value).trim();
  if (MISSING.has(source.toLowerCase()) || !NUMERIC.test(source)) return null;
  const n = Number(source);
  if (!Number.isFinite(n) || (temperature && n === -100000)) return null;
  return n;
}

function fields(row, minimum = 6) {
  const parts = String(row || '').trim().split(/\s+/);
  if (parts.length < minimum || parts.slice(0, minimum).some(x => engineeringNumber(x) === null)) {
    throw new Error('CII_ELEMENT_ROW_MALFORMED');
  }
  return parts;
}

export function parseCiiEngineeringFields(text) {
  const sections = new Map();
  let section = '';
  for (const line of String(text || '').split(/\r?\n/)) {
    const heading = /^#\$\s+(.+?)\s*$/.exec(line);
    if (heading) {
      section = heading[1];
      if (sections.has(section)) throw new Error('CII_DUPLICATE_SECTION');
      sections.set(section, []);
    } else if (section) {
      sections.get(section).push(line);
    }
  }
  const rows = sections.get('ELEMENTS');
  if (!rows || rows.length === 0 || rows.length % 15 !== 0) {
    throw new Error('CII_ELEMENT_BLOCK_COUNT_INVALID');
  }
  const control = sections.get('CONTROL');
  if (!control || !control.length || Number(control[0].trim().split(/\s+/)[0]) !== rows.length / 15) {
    throw new Error('CII_CONTROL_ELEMENT_COUNT_MISMATCH');
  }
  const rigid = (sections.get('RIGID') || []).map((line, index) => {
    const n = fields(line, 2);
    return { index: index + 1, forceN: Number(n[1]) };
  });
  // MISCEL_1 stores exact per-element numeric material IDs in groups of six.
  // The native writer may emit padded trailing slots; never search globally.
  const misc = (sections.get('MISCEL_1') || [])
    .filter(line => line.trim())
    .flatMap(line => line.trim().split(/\s+/).map(x => engineeringNumber(x)));
  if (misc.some(x=>x===null)) throw new Error('CII_MATERIAL_SLOT_MALFORMED');
  const elements = [];
  for (let i = 0; i < rows.length; i += 15) {
    const block = rows.slice(i, i + 15);
    const endpoints = /^\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)/.exec(block[0]);
    if (!endpoints) throw new Error('CII_ELEMENT_ENDPOINTS_INVALID');
    const branch = /^\s*\d+\s+(.+?)\s*$/.exec(block[10]);
    if (!branch) throw new Error('CII_ELEMENT_BRANCH_MISSING');
    const r2 = fields(block[1]);
    const r4 = fields(block[3]);
    const r6 = fields(block[5]);
    const pointers = fields(block[12]);
    const rigidPointer = Number(pointers[1]);
    if (!Number.isSafeInteger(rigidPointer) || rigidPointer < 0 || rigidPointer > rigid.length) {
      throw new Error('CII_RIGID_POINTER_INVALID');
    }
    const from = Number(endpoints[1]), to = Number(endpoints[2]);
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) {
      throw new Error('CII_NODE_NUMBER_INVALID');
    }
    elements.push({
      index: i / 15 + 1, branch: branch[1], from: String(from), to: String(to),
      wallThickness: Number(r2[0]), corrosion: Number(r2[2]),
      t1: Number(r2[3]), t2: Number(r2[4]), t3: Number(r2[5]),
      p1: Number(r4[0]), density: Number(r6[1]), rigidPointer,
      materialCode: misc[i / 15] ?? null,
    });
  }
  const restraintLines = (sections.get('RESTRANT') || []).filter(line => line.trim());
  if (restraintLines.length % 4 !== 0) throw new Error('CII_RESTRAINT_BLOCK_COUNT_INVALID');
  const restraints = [];
  for (let i = 0; i < restraintLines.length; i += 4) {
    const record = fields(restraintLines[i], 4);
    const node = Number(record[0]), typeCode = Number(record[1]);
    if (!Number.isSafeInteger(node) || !Number.isSafeInteger(typeCode) ||
        typeCode < 0 || typeCode > 62) throw new Error('CII_RESTRAINT_ROW_INVALID');
    if (node === 0) continue; // Unused native restraint slots.
    restraints.push({node: String(node), typeCode, gap: Number(record[3]),
                     recordIndex: i / 4 + 1});
  }
  return { elements, rigid, restraints };
}

function approximately(value, actual) {
  return Math.abs(value - actual) <= Math.max(1e-8, Math.abs(value) * 1e-5);
}

/** Require every emitted element for the owning branch to agree. */
export function ciiBranchFieldMatches(parsed, branch, field, sourceValue) {
  const expected = engineeringNumber(sourceValue, field.startsWith('t'));
  if (!parsed || expected === null || !['t1','t2','t3','p1','density'].includes(field)) return null;
  const candidates = parsed.elements.filter(e => e.branch === branch);
  if (!candidates.length) return false;
  const scales = field === 'density' ? [1, 1e-6] : [1];
  return candidates.every(e => scales.some(scale => approximately(expected * scale, e[field])));
}

/** Parse the exact owning element, not a whole CII occurrence of the value. */
export function ciiElementFieldMatches(parsed, branch, from, to, field, sourceValue) {
  const value = engineeringNumber(sourceValue);
  if (!parsed || value === null || !['wallThickness','corrosion','t1','t2','t3','p1','density'].includes(field)) return null;
  const candidates = parsed.elements.filter(e =>
    e.branch === branch && e.from === String(from) && e.to === String(to));
  if (candidates.length !== 1) return null; // duplicates need physical occurrence custody
  return approximately(value, candidates[0][field]);
}

/** RIGID force is verified through the owning ELEMENTS pointer, never text includes(). */
export function ciiNodeWeightMatches(parsed, branch, nodeNumber, sourceKg, scale = 10) {
  const expected = engineeringNumber(sourceKg);
  if (!parsed || expected === null || !Number.isFinite(scale)) return null;
  const node = String(nodeNumber ?? '').trim();
  if (!/^\d+$/.test(node)) return null; // Inline -1 requires physical-occurrence custody.
  const candidates = parsed.elements.filter(e => e.branch === branch && (e.from === node || e.to === node));
  if (!candidates.length) return false;
  const bound = candidates.filter(e => e.rigidPointer > 0);
  if (!bound.length) return false;
  const actual = bound.map(e => parsed.rigid[e.rigidPointer - 1]?.forceN);
  if (actual.some(v => v === undefined)) return null;
  // A CII node may be referenced by several edges; without unique weight
  // ownership the result is unknown instead of a possibly unrelated match.
  if (new Set(actual.map(x => x.toPrecision(10))).size !== 1) return null;
  return approximately(expected * scale, actual[0]);
}


/** Independent CII engineering-custody check; a Python source-completeness
 * flag never substitutes for the actual bytes of ELEMENTS/RESTRANT/RIGID.
 * Structural fields without applicable source claims are NOT_APPLICABLE.
 */
export function verifyCiiEngineeringAgainstNativeXml(xmlText, ciiText) {
  if (typeof DOMParser === 'undefined') throw new Error('CII_VERIFIED_XML_PARSER_UNAVAILABLE');
  const doc = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror')?.length)
    throw new Error('CII_VERIFIED_NATIVE_XML_INVALID');
  const native = parseCiiEngineeringFields(ciiText);
  const local = node => String(node?.localName || node?.nodeName || '').replace(/^.*:/, '');
  const child = (parent, tag) => [...(parent?.childNodes || [])]
    .find(node => node?.nodeType === 1 && local(node) === tag);
  const value = (parent, tag) => String(child(parent, tag)?.textContent ?? '').trim();
  const children = (parent, tag) => [...(parent?.childNodes || [])]
    .filter(node => node?.nodeType === 1 && local(node) === tag);
  // Native browser DOM and the Worker DOM shim need the same namespace-local
  // traversal. getElementsByTagName('*') is not portable across those hosts.
  const descendants = (parent, tag) => {
    const found = [];
    const pending = [...(parent?.childNodes || [])].reverse();
    while (pending.length) {
      const node = pending.pop();
      if (node?.nodeType !== 1) continue;
      if (local(node) === tag) found.push(node);
      for (let i = (node.childNodes?.length || 0) - 1; i >= 0; i--)
        pending.push(node.childNodes[i]);
    }
    return found;
  };
  const evidence = [];
  const original = new Map();
  for (const branch of descendants(doc, 'Branch')) {
    const name = value(branch, 'Branchname');
    if (!name || original.has(name)) throw new Error('CII_VERIFIED_BRANCH_IDENTITY_AMBIGUOUS');
    const temp = child(branch, 'Temperature'), pressure = child(branch, 'Pressure');
    const facts = {p1:value(pressure, 'Pressure1'),
      t1:value(temp, 'Temperature1'),t2:value(temp, 'Temperature2'),
      t3:value(temp, 'Temperature3'),density:value(branch,'FluidDensity')};
    const nodes = new Map();
    for (const node of children(branch, 'Node')) {
      const number = value(node, 'NodeNumber');
      if (!number || nodes.has(number)) throw new Error('CII_VERIFIED_NODE_IDENTITY_AMBIGUOUS');
      nodes.set(number, {wallThickness:value(node,'WallThickness'),
        corrosion:value(node,'CorrosionAllowance'), type:value(node,'ComponentType'),
        materialCode:value(node,'MaterialCode'),
        restraints:children(node,'Restraint').map(r=>({
          type:value(r,'Type'),gap:value(r,'Gap')}))});
    }
    original.set(name, {facts,nodes});
  }
  const approx = (a,b) => Math.abs(a-b) <= Math.max(1e-8, Math.abs(a)*1e-5);
  const matchedElements = new Set();
  for (const element of native.elements) {
    const branch = original.get(element.branch);
    const source = branch?.nodes.get(element.from);
    const key = element.branch + '|' + element.from + '|' + element.to;
    if (!branch || !source || !branch.nodes.has(element.to) || matchedElements.has(key))
      throw new Error('CII_VERIFIED_ELEMENT_OWNER_MISSING_OR_AMBIGUOUS');
    matchedElements.add(key);
    for (const field of ['p1','t1','t2','t3','density']) {
      const raw = branch.facts[field], expected = engineeringNumber(raw, field.startsWith('t'));
      if (expected === null) {
        // T2 is optional unless the selected line-list maps a T2 fact;
        // Python's verified-master gate independently rejects missing
        // mandatory/declared T2 at the source-to-native-XML boundary.
        if (field==='t2') {
          evidence.push({key,field,sourceState:'NOT_APPLICABLE',
                         verificationState:'NOT_APPLICABLE'});
          continue;
        }
        evidence.push({key,field,sourceState:'MISSING',verificationState:'UNRESOLVED'});
        throw new Error('CII_VERIFIED_BRANCH_FIELD_MISSING_' + field.toUpperCase());
      }
      const expectedCii = field==='density' ? expected * 1e-6 : expected;
      // The selected writer converts input kg/m3 to kg/cm3; no permissive
      // alternative scale can turn a wrong density field into a pass.
      const isMatch = field==='density'
        ? Math.abs(expectedCii-element[field]) <= Math.max(1e-12, Math.abs(expectedCii)*1e-5)
        : approx(expectedCii,element[field]);
      if (!isMatch)
        throw new Error('CII_VERIFIED_BRANCH_FIELD_CONFLICT_' + field.toUpperCase());
      evidence.push({key,field,sourceState:expected===0?'EXPLICIT_ZERO':'PRESENT',
                     verificationState:'VERIFIED'});
    }
    if (['PIPE','PCOM','BRAN','TUBE'].includes(source.type.toUpperCase())) {
      const wall = engineeringNumber(source.wallThickness);
      if (wall===null || wall<=0 || !approx(wall,element.wallThickness))
        throw new Error('CII_VERIFIED_ELEMENT_WALL_CONFLICT');
      evidence.push({key,field:'wallThickness',sourceState:'PRESENT',
                     verificationState:'VERIFIED'});
      const approvedCode=engineeringNumber(source.materialCode);
      if (approvedCode===null || approvedCode<=0 ||
          element.materialCode===null ||
          !approx(approvedCode,element.materialCode))
        throw new Error('CII_VERIFIED_ELEMENT_MATERIAL_CODE_CONFLICT');
      evidence.push({key,field:'materialCode',sourceState:'PRESENT',
                     verificationState:'VERIFIED'});
    }
    const corrosion = engineeringNumber(source.corrosion);
    if (corrosion!==null) {
      if (!approx(corrosion,element.corrosion))
        throw new Error('CII_VERIFIED_ELEMENT_CORROSION_CONFLICT');
      evidence.push({key,field:'corrosion',
        sourceState:corrosion===0?'EXPLICIT_ZERO':'PRESENT',verificationState:'VERIFIED'});
    } else {
      evidence.push({key,field:'corrosion',sourceState:'NOT_APPLICABLE',
                     verificationState:'NOT_APPLICABLE'});
    }
  }
  if (!matchedElements.size) throw new Error('CII_VERIFIED_ELEMENT_CENSUS_EMPTY');
  const actual = new Map();
  for (const restraint of native.restraints) {
    const nodeOwners = [...original].filter(([name,b])=> b.nodes.has(restraint.node) &&
      native.elements.some(e => e.branch===name &&
        (e.from===restraint.node || e.to===restraint.node)));
    if (nodeOwners.length !== 1) throw new Error('CII_VERIFIED_RESTRAINT_OWNER_AMBIGUOUS');
    const key = nodeOwners[0][0]+'|'+restraint.node;
    if (!actual.has(key)) actual.set(key, []);
    actual.get(key).push(restraint);
  }
  const typeCodes = {'ANC':1,'ANCHOR':1,'FIXED':1,'GUI':8,'GUIDE':8,
    'LIM':9,'LIMIT':9,'LINESTOP':9,'+Y':14,'Y':19,'REST':14,
    '+X':13,'+Z':15,'-X':16,'-Y':17,'-Z':18};
  for (const [name,branch] of original) for (const [node,source] of branch.nodes) {
    if (!source.restraints.length) continue;
    const key = name+'|'+node;
    const emitted = actual.get(key) || [], used = new Set();
    for (const claim of source.restraints) {
      const type = claim.type.toUpperCase();
      const code = Number.isInteger(Number(type)) && Number(type)>=1
        ?Number(type):typeCodes[type];
      if (!code) throw new Error('CII_VERIFIED_RESTRAINT_SOURCE_TYPE_UNSUPPORTED');
      const gap = engineeringNumber(claim.gap);
      const hits = emitted.filter(r=>r.typeCode===code &&
          (gap===null || approx(gap,r.gap)));
      if (hits.length!==1 || used.has(hits[0]?.recordIndex))
        throw new Error('CII_VERIFIED_RESTRAINT_TYPE_OR_GAP_CONFLICT');
      used.add(hits[0].recordIndex);
      evidence.push({key,field:'restraint',typeCode:code,
        sourceState:gap===0?'EXPLICIT_ZERO':'PRESENT',verificationState:'VERIFIED'});
    }
    if (emitted.length!==used.size)
      throw new Error('CII_VERIFIED_RESTRAINT_UNEXPECTED_EXTRA_SLOT');
  }
  return Object.freeze({status:'VERIFIED',elements:matchedElements.size,
    restraints: [...actual.values()].reduce((sum,rows)=>sum+rows.length,0),
    evidence});
}
