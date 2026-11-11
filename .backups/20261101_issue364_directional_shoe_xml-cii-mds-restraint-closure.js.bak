import {
  applyXmlRestraints,
  restraintEntriesFromSupportKind,
} from '../../converters/xml-cii2019-core/support-mapping.js';
import { migrateSupportMappingConfig } from '../../converters/xml-cii2019-core/support-mapping-config.js';
import {mutateRestraintType} from '../../converters/xml-cii2019-core/restraint-type-mutation.js';
import {classifySupportText,parseSupportTypeMapperConfig}
  from './xml-cii-support-type-mapper.js';
import { buildStandaloneDtxrResolutionLedger } from './xml-cii-trace-resolution-ledger.js';
import { decorateJsonTraceLedger } from './xml-cii-json-trace-fields.js';
import {isZeroInformationLimitRestraintElement}
  from '../../converters/xml-cii2019-core/atta-default-restraint-closure.js';

const CARRIER_TYPES = new Set(['ANCI', 'ATTA']);
const GOVERNED_KINDS = Object.freeze(['REST', 'GUIDE', 'LINESTOP']);
const EXPECTED_XML_TYPE = Object.freeze({ REST: '+Y', GUIDE: 'GUI', LINESTOP: 'LIM' });

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function localName(node) {
  return text(node?.localName || node?.nodeName).replace(/^.*:/, '');
}

function childrenByName(parent, name) {
  return [...(parent?.childNodes || parent?.children || [])]
    .filter((node) => node?.nodeType === undefined || node.nodeType === 1)
    .filter((node) => localName(node) === name);
}

function firstChild(parent, name) {
  return childrenByName(parent, name)[0] || null;
}

function childText(parent, name) {
  return text(firstChild(parent, name)?.textContent);
}

function parserFailed(document) {
  return !!(document?.querySelector?.('parsererror') || document?.getElementsByTagName?.('parsererror')?.length);
}

function normalizeXmlType(value) {
  const type = text(value).toUpperCase();
  if (type === 'Y' || type === '+Y' || type === 'REST' || type === '14') return '+Y';
  if (type === 'GUIDE' || type === 'GUI' || type === 'X' || type === '8') return 'GUI';
  if (type === 'LINESTOP' || type === 'LIMIT' || type === 'LIM' || type === 'Z' || type === '9') return 'LIM';
  return type;
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function memberAttributes(member) {
  return safeObject(member?.raw?.attributes || member?.attributes || member?.capturedFields);
}

function supportKindFromMember(member,config={}) {
  const attrs = memberAttributes(member);
  // An explicit source description wins over abbreviated MDS code aliases.
  // This mirrors the old confidence mapper, not its legacy axis defaults.
  const desc = [attrs.DTXR, attrs.DESC, attrs.DESCRIPTION, member?.description]
    .map(text).filter(Boolean).join(' ').toUpperCase();
  const semantic = [
    /\b(?:PIPE\s*STOP|LINE\s*STOP|LINESTOP|LIMIT\s*STOP|AXIAL\s*STOP|DIRECTIONAL\s+ANCHOR)\b/.test(desc) && 'LINESTOP',
    /\bGUIDE\b/.test(desc) && 'GUIDE',
    /\b(?:PIPE[- ]?REST|REST|SHOE)\b/.test(desc) && 'REST',
  ].filter(Boolean);
  if (new Set(semantic).size > 1)
    throw Object.assign(new Error('Conflicting source support descriptions'),
      {code:'PREFINAL_RESTRAINT_KIND_AMBIGUOUS'});
  if (semantic.length) return semantic[0];
  // Use the user-authored Step 7 mapper rows, not a second hard-coded alias list.
  // HIGH/MEDIUM semantic intent can override a stale generated REST label;
  // LOW GT/ST evidence cannot override a resolved canonical source kind.
  let mapper = null;
  if (Array.isArray(config?.supportTypeMapper?.rows)) {
    const rows = parseSupportTypeMapperConfig({supportConfig:config}).mapperRows;
    const evidence = [attrs.DTXR,attrs.DESC,attrs.DESCRIPTION,
      member?.description,attrs.CMPSUPTYPE,attrs.MDSSUPPTYPE,attrs.SPRE]
      .map(text).filter(Boolean).join(' ');
    mapper=classifySupportText(evidence,rows);
    if(mapper.status==='ambiguous')
      throw Object.assign(new Error('Conflicting Step 7 mapper classification'),
        {code:'PREFINAL_RESTRAINT_KIND_AMBIGUOUS'});
    if(mapper.status==='matched'&&mapper.confidence!=='LOW'&&
       GOVERNED_KINDS.includes(mapper.supportKind))return mapper.supportKind;
  }
  const canonical = [...new Set(['SUPPORT_KIND', 'SUPPORT_MAPPER_KIND', 'SUPPORT_TYPE']
    .map(key=>text(attrs[key]).toUpperCase().replace(/\s+/g,''))
    .filter(kind=>GOVERNED_KINDS.includes(kind)))];
  if (canonical.length > 1)
    throw Object.assign(new Error('Conflicting canonical support kinds'),
      {code:'PREFINAL_RESTRAINT_KIND_AMBIGUOUS'});
  if (canonical.length) return canonical[0];
  if(mapper?.status==='matched'&&GOVERNED_KINDS.includes(mapper.supportKind))
    return mapper.supportKind;
  const code = text(attrs.MDSSUPPTYPE || member?.capturedFields?.MDSSUPPTYPE).toUpperCase();
  if (code.startsWith('GT')) return 'GUIDE';
  if (code.startsWith('ST')) return 'LINESTOP';
  if (code === 'PIPE-REST' || code.startsWith('AT')) return 'REST';
  return /\b(?:PIPE[- ]?REST|REST|SHOE)\b/.test(text(attrs.SPRE).toUpperCase()) ? 'REST' : '';
}

function sourceGapText(attrs){
  return ['CMPSUPGAP','CMPSUPGAP_POS','CMPSUPGAP_PS','NODEGAP']
    .map(key=>text(attrs?.[key])).find(Boolean)||'';
}

function supportGapNumber(attrs){
  const raw=['CMPSUPGAP','CMPSUPGAP_POS','CMPSUPGAP_PS','NODEGAP']
    .map(key=>text(attrs?.[key])).filter(Boolean);
  const values=raw.map(value=>Number(value.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?/)?.[0]));
  if(values.some(v=>!Number.isFinite(v)))throw Object.assign(
    new Error('Invalid JSON support gap'),{code:'PREFINAL_RESTRAINT_GAP_INVALID'});
  if(values.some(v=>v!==values[0]))throw Object.assign(
    new Error('Conflicting source gap aliases'),{code:'PREFINAL_RESTRAINT_GAP_AMBIGUOUS'});
  return values.length?values[0]:null;
}

function sourceNodeType(attrs,config){
  const raw=text(attrs?.NODETYPE);
  if(!raw)return '';
  const selected=mutateRestraintType(raw,
    config.inputXmlRestraintTypeMutation||config.restraintTypeMutation||{});
  const number=Number(selected);
  if(!Number.isInteger(number)||number<1||number>62)
    throw Object.assign(new Error('Unsupported staged NODETYPE or type mutation'),
      {code:'PREFINAL_RESTRAINT_TYPE_INVALID'});
  return normalizeXmlType(String(number));
}

function isRestHardwareMember(attrs,kind) {
  if(kind!=='REST'||text(attrs?.NODETYPE)!=='4')return false;
  const code=text(attrs?.MDSSUPPTYPE).toUpperCase();
  const desc=[attrs?.DTXR,attrs?.DESC,attrs?.DESCRIPTION].map(text).join(' ').toUpperCase();
  return (code==='AT01'&&/\bPIPE\s+SHOE\b/.test(desc))||
         (code==='AT05'&&/\bWEAR\s+PLATE\b/.test(desc));
}

function evidenceByKind(record, config = {}, requireUnambiguous = false) {
  const result=new Map();
  for(const member of Array.isArray(record?.positionMembers)?record.positionMembers:[]){
    const kind=supportKindFromMember(member,config);
    if(!kind)continue;
    const original=memberAttributes(member);
    const numeric=requireUnambiguous?supportGapNumber(original):null;
    const raw=sourceGapText(original);
    // The current XML writer understands CMPSUPGAP; the older source also
    // stored the same gap in NODEGAP. Preserve its value, including zero.
    const attrs=raw&&!text(original.CMPSUPGAP)&&!text(original.CMPSUPGAP_POS)
      &&!text(original.CMPSUPGAP_PS)?{...original,CMPSUPGAP:raw}:original;
    const previous=result.get(kind);
    if(requireUnambiguous&&previous&&sourceGapText(previous)&&raw&&
       supportGapNumber(previous)!==numeric)
      throw Object.assign(new Error('Conflicting JSON gaps for the same support kind'),
        {code:'PREFINAL_RESTRAINT_GAP_AMBIGUOUS'});
    if(requireUnambiguous&&previous&&text(previous.NODETYPE)&&text(attrs.NODETYPE)&&
       sourceNodeType(previous,config)!==sourceNodeType(attrs,config)){
      const earlierHardware=isRestHardwareMember(previous,kind);
      const laterHardware=isRestHardwareMember(attrs,kind);
      if(earlierHardware!==laterHardware){
        if(earlierHardware)result.set(kind,attrs);
        continue;
      }
      throw Object.assign(new Error('Conflicting staged NODETYPE mutations for the same support kind'),
        {code:'PREFINAL_RESTRAINT_TYPE_AMBIGUOUS'});
    }
    if(!previous||(!sourceGapText(previous)&&raw))result.set(kind,attrs);
  }
  // Aggregated trace kinds can contain a lower-confidence GT/ST alias that
  // the resolved source member explicitly contradicted. Never re-add it.
  if(!result.size){
    for(const kind of Array.isArray(record?.derivedSupportTypes)?record.derivedSupportTypes:[]){
      const normalized=text(kind).toUpperCase().replace(/\s+/g,'');
      if(GOVERNED_KINDS.includes(normalized))result.set(normalized,{});
    }
  }
  return result;
}

function existingTypes(node) {
  return new Set(childrenByName(node, 'Restraint')
    .map((restraint) => normalizeXmlType(childText(restraint, 'Type')))
    .filter(Boolean));
}

function createTemporaryNode(document, node) {
  return node?.namespaceURI && typeof document.createElementNS === 'function'
    ? document.createElementNS(node.namespaceURI, 'Node')
    : document.createElement('Node');
}

function appendGeneratedEntries(document, node, entries, config) {
  if (!entries.length) return 0;
  const temporary = createTemporaryNode(document, node);
  applyXmlRestraints(document, temporary, entries, config);
  const generated = [...childrenByName(temporary, 'Restraint')];
  for (const restraint of generated) node.appendChild(restraint);
  return generated.length;
}

function nodeDiagnostic(node, record, kinds, entries) {
  return {
    type: 'mds-position-restraints-materialized',
    nodeNumber: childText(node, 'NodeNumber'),
    nodeName: childText(node, 'NodeName'),
    componentType: childText(node, 'ComponentType'),
    effectiveSource: record?.effectiveSource || '',
    matchType: record?.matchType || '',
    supportKinds: kinds,
    restraintTypes: entries.map((entry) => normalizeXmlType(entry?.type || entry)),
    message: 'Missing governed restraints were appended from the matched DTXR_POS position-group MDSSUPPTYPE evidence.',
  };
}

export function closeGovernedMdsPositionRestraintsXml(xmlText, stagedJsonText, config = {}, runtime = {}) {
  const source = String(xmlText ?? '');
  const stats = {
    mdsPositionNodesChanged: 0,
    mdsRestRestraintsAdded: 0,
    mdsGuideRestraintsAdded: 0,
    mdsLineStopRestraintsAdded: 0,
  };
  const diagnostics = [];
  const supportMapping = migrateSupportMappingConfig(config);
  if (supportMapping.useJsonForRestraints === false) {
    return { xmlText: source, changed: false, stats, diagnostics: [{ type: 'mds-position-restraint-closure-skipped', reason: 'json-restraints-disabled' }] };
  }
  if (!source.trim() || !text(stagedJsonText)) return { xmlText: source, changed: false, stats, diagnostics };
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return { xmlText: source, changed: false, stats, diagnostics: [{ type: 'mds-position-restraint-closure-skipped', reason: 'DOM unavailable' }] };
  }

  const rawLedger = buildStandaloneDtxrResolutionLedger(source, stagedJsonText, config);
  const traceConfig = {
    captureFields: ['DTXR', 'SPRE', 'SPREF', 'MDSSUPPTYPE', 'NAME', 'CMPSUPGAP'],
  };
  const ledger = decorateJsonTraceLedger(rawLedger, traceConfig);
  const byIndex = new Map((ledger.records || []).map((record) => [Number(record.xmlIndex), record]));
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (parserFailed(document)) {
    return { xmlText: source, changed: false, stats, diagnostics: [{ type: 'mds-position-restraint-closure-skipped', reason: 'XML parse failed' }] };
  }

  let xmlIndex = 0;
  for (const branch of [...document.getElementsByTagName('Branch')]) {
    for (const node of childrenByName(branch, 'Node')) {
      xmlIndex += 1;
      const componentType = childText(node, 'ComponentType').toUpperCase();
      if (!CARRIER_TYPES.has(componentType)) continue;
      const record = byIndex.get(xmlIndex);
      if(runtime.requireUnambiguous&&record?.status==='AMBIGUOUS_REVIEW')
        throw Object.assign(new Error('Ambiguous source support match'),
          {code:'PREFINAL_RESTRAINT_MATCH_AMBIGUOUS'});
      if (!record || !String(record.status || '').startsWith('RESOLVED_')) continue;
      const evidence = evidenceByKind(record,config,runtime.requireUnambiguous===true);
      if (!evidence.size) continue;

      if(runtime.requireUnambiguous){
        for(const restraint of childrenByName(node,'Restraint')){
          if(isZeroInformationLimitRestraintElement(restraint))node.removeChild(restraint);
        }
      }

      const present = existingTypes(node);
      const kinds = [];
      const entries = [];
      for (const kind of GOVERNED_KINDS) {
        if (!evidence.has(kind)) continue;
        const attrs=evidence.get(kind);
        const explicitGap=sourceGapText(attrs);
        const selectedType=sourceNodeType(attrs,config)||EXPECTED_XML_TYPE[kind];
        if (['+Y','GUI','LIM'].includes(selectedType)&&selectedType!==EXPECTED_XML_TYPE[kind])
          throw Object.assign(new Error('Configured NODETYPE mutation contradicts Step 7 support kind'),
            {code:'PREFINAL_RESTRAINT_TYPE_KIND_CONFLICT'});
        const generated=restraintEntriesFromSupportKind(kind, attrs, node, config)
          .map(entry=>({
            ...entry,type:selectedType,
            gap:kind==='REST'&&explicitGap?String(supportGapNumber(attrs)):entry.gap,
          }))
          .filter(entry=>!present.has(normalizeXmlType(entry?.type || entry)));
        if (!generated.length) continue;
        kinds.push(kind);
        entries.push(...generated);
        for (const entry of generated) present.add(normalizeXmlType(entry?.type || entry));
      }
      if (!entries.length) continue;

      const appended = appendGeneratedEntries(document, node, entries, config);
      if (!appended) continue;
      stats.mdsPositionNodesChanged += 1;
      if (kinds.includes('REST')) stats.mdsRestRestraintsAdded += 1;
      if (kinds.includes('GUIDE')) stats.mdsGuideRestraintsAdded += 1;
      if (kinds.includes('LINESTOP')) stats.mdsLineStopRestraintsAdded += 1;
      diagnostics.push(nodeDiagnostic(node, record, kinds, entries));
    }
  }

  const changed = stats.mdsPositionNodesChanged > 0;
  return {
    xmlText: changed ? new XMLSerializer().serializeToString(document) : source,
    changed,
    stats,
    diagnostics,
    ledger: ledger.records || [],
  };
}
