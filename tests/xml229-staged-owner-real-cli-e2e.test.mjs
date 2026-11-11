import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { reconcileXml229ActualCiiAgainstFinal }
  from '../converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs';
import { verifyCiiEngineeringAgainstNativeXml }
  from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-propagation-proof.mjs';
import { installWeightBasisXmlDom }
  from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';

installWeightBasisXmlDom(globalThis);

// Full real Python native-CLI run. This fixture is synthetic engineering
// evidence and is NOT the Owner's private accepted Final/JSON packet.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const baseXml = '<PipeStressExport><Pipe><Branch><Branchname>BR-1</Branchname>'
  + '<Pressure><Pressure1>0</Pressure1></Pressure>'
  + '<Temperature><Temperature1>0</Temperature1>'
  + '<Temperature2>0</Temperature2><Temperature3>0</Temperature3></Temperature>'
  + '<FluidDensity>0</FluidDensity>'
  + '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
  + '<MaterialCode>1</MaterialCode><WallThickness>3.2</WallThickness>'
  + '<CorrosionAllowance>0</CorrosionAllowance>'
  + '<Position>0 0 0</Position><Weight>0</Weight></Node>'
  + '<Node><NodeNumber>20</NodeNumber><NodeName>WGT</NodeName>'
  + '<ComponentType>RIGID</ComponentType><ComponentRefNo>REF-1</ComponentRefNo>'
  + '<Endpoint>2</Endpoint><Position>5 0 0</Position><Rigid>2</Rigid>'
  + '<Weight>0</Weight></Node></Branch></Pipe></PipeStressExport>';
const packetFor = source => ({
  schema: 'XML229.NativeFinalPhysicalPacket.v1',
  sourceId: 'SOURCE',
  basisId: 'a'.repeat(64),
  finalIntentSha256: 'b'.repeat(64),
  sourceXmlSha256: sha(source),
  physicalCount: 1,
  nativeCiiReleaseAuthorized: false,
  components: [{
    occurrenceId: JSON.stringify(['SOURCE', 0, 1,
      JSON.stringify(['RIGID',
        source.includes('<ComponentRefNo>=42/200</ComponentRefNo>')
          ? '=42/200' : 'REF-1', '2', 'WGT'])]),
    effectiveKg: 12.5,
  }],
});
const sourceMember = (type, gap, pos = '5 0 0') => ({
  type: 'SUPPORT', name: 'untyped-' + type,
  attributes: { POSI: pos, DTXR: type, CMPSUPGAP: String(gap) },
});
const staged = members => JSON.stringify([{
  type: 'BRANCH', name: 'BR-1', children: members,
}]);
const config = {
  dtxrPositionOffset: { enabled: false, tolerance: 6 },
  defaultStiffness: 123456,
  defaultGap: '0',
};
function nativeRun(source, stagedText) {
  const directory = mkdtempSync(join(tmpdir(), 'xml229-staged-actual-cli-'));
  const input = join(directory, 'source.xml');
  const jsonPath = join(directory, 'source.json');
  const packetPath = join(directory, 'packet.json');
  const output = join(directory, 'native.cii');
  const proofPath = join(directory, 'proof.json');
  const enrichedPath = join(directory, 'native-enriched.xml');
  const packet = packetFor(source);
  writeFileSync(input, source);
  writeFileSync(jsonPath, stagedText);
  writeFileSync(packetPath, JSON.stringify(packet));
  const run = spawnSync('python3', [
    'converters/scripts/xml_to_cii2019_runtime_custody.py',
    '--input', input,
    '--output', output,
    '--staged-json', jsonPath,
    '--support-config-json', JSON.stringify(config),
    '--weight-scale', '10',
    '--xml229-native-final-packet', packetPath,
    '--xml229-native-mass-proof', proofPath,
    '--enriched-output', enrichedPath,
  ], { cwd: root, encoding: 'utf8', timeout: 45000 });
  return {
    directory, run, packet, output, proofPath, enrichedPath,
    input, source,
    dispose() { rmSync(directory, { recursive: true, force: true }); },
  };
}
const nativeRestraints = cii => {
  const section = cii.split('#$ RESTRANT\n')[1]?.split('#$')[0];
  assert.ok(section, 'Native CII must contain a RESTRANT section');
  const rows = section.trim().split(/\r?\n/);
  const result = [];
  for (let i = 0; i < rows.length; i += 4) {
    const parts = rows[i].trim().split(/\s+/).map(Number);
    if (parts[0] > 0 && parts[1] > 0) {
      result.push({ node: parts[0], kind: parts[1], gap: parts[3] });
    }
  }
  return result;
};

test('actual native CLI retains many-to-one REST | GUIDE | LINE STOP and independent Final kg', async () => {
  const run = nativeRun(baseXml, staged([
    sourceMember('REST', '0mm'),
    sourceMember('GUIDE', '5mm'),
    sourceMember('LINE STOP', '8mm'),
  ]));
  try {
    assert.equal(run.run.status, 0,
      `native failure: ${(run.run.stderr || '').slice(-1900)} ${(run.run.stdout || '').slice(-1300)}`);
    assert.equal(readFileSync(run.input, 'utf8'), baseXml,
      'original source XML must remain unchanged');
    const consumed = readFileSync(run.enrichedPath, 'utf8');
    assert.match(consumed, /<Weight>12\.5<\/Weight>/,
      'accepted Final kg must be consumed on exact source owner');
    assert.match(consumed, /<DTXR_POS>REST\(CMPSUPGAP=0mm\)\|GUIDE\(CMPSUPGAP=5mm\)\|LINE STOP\(CMPSUPGAP=8mm\)<\/DTXR_POS>/,
      'all three independently sourced members must retain the | delimiter');
    const cii = readFileSync(run.output, 'utf8');
    const restraints = nativeRestraints(cii).filter(row => row.node === 20);
    assert.deepEqual(restraints, [
      { node: 20, kind: 14, gap: 0 },
      { node: 20, kind: 8, gap: 5 },
      { node: 20, kind: 9, gap: 8 },
    ], 'actual emitted native CII must preserve all three DOF slots and explicit gaps');
    assert.equal(nativeRestraints(cii).some(row => row.node === 10), false,
      'nearby ordinary component must not inherit restraints');
    const engineering = verifyCiiEngineeringAgainstNativeXml(consumed, cii);
    assert.equal(engineering.status, 'VERIFIED');
    assert.equal(engineering.restraints, 3);
    assert.equal(engineering.evidence.filter(e => e.field === 'restraint').length, 3,
      'the production independent engineering verifier must challenge each CII slot');
     // Challenge one real emitted gap while preserving all other CII bytes.
    const changedRows = cii.split('\n');
    const restrantHeader = changedRows.findIndex(line => line.trim() === '#$ RESTRANT');
    assert.ok(restrantHeader >= 0);
    const guideIndex = changedRows.findIndex((line, i) =>
      i > restrantHeader && i < restrantHeader + 40 &&
      Number(line.trim().split(/\s+/)[0]) === 20 &&
      Number(line.trim().split(/\s+/)[1]) === 8);
    assert.ok(guideIndex > restrantHeader, 'GUIDE CII slot must exist');
    const guideFields = changedRows[guideIndex].trim().split(/\s+/);
    guideFields[3] = '7.000000';
    changedRows[guideIndex] = guideFields.join(' ');
    assert.throws(
      () => verifyCiiEngineeringAgainstNativeXml(consumed, changedRows.join('\n')),
      /CII_VERIFIED_RESTRAINT_TYPE_OR_GAP_CONFLICT/,
      'independent checker must refuse tampered GUIDE gap');
    const writerDiagnostic = JSON.parse(readFileSync(run.proofPath, 'utf8'));
    const independent = await reconcileXml229ActualCiiAgainstFinal({
      originalXmlText: baseXml, packet: run.packet, ciiText: cii,
      writerDiagnostic,
    });
    assert.equal(independent.massConsumptionVerified, true);
    assert.equal(independent.physicalCount, 1);
    assert.equal(independent.actualCiiSha256, sha(cii));
    assert.equal(independent.nativeCiiReleaseAuthorized, true,
      'independent reconciliation qualifies this synthetic E2E fixture only');
  } finally {
    run.dispose();
  }
});

test('native original-authored restraint breaks 0.2 mm position tie with exact source custody', async () => {
  const original = baseXml
    .replace('<Position>0 0 0</Position>', '<Position>4.8 0 0</Position>')
    .replace('<Weight>0</Weight></Node></Branch>',
      '<Weight>0</Weight><Restraint><Type>GUI</Type>'
      + '<Gap>5</Gap><Stiffness>123456</Stiffness>'
      + '<Friction>-1.010100</Friction></Restraint>'
      + '</Node></Branch>');
  const run = nativeRun(original, staged([sourceMember('GUIDE', '5mm')]));
  try {
    assert.equal(run.run.status, 0,
      `original-authority native failure: ${(run.run.stderr || '').slice(-1600)} ${(run.run.stdout || '').slice(-1600)}`);
    const xml = readFileSync(run.enrichedPath, 'utf8');
    const cii = readFileSync(run.output, 'utf8');
    assert.equal((xml.match(/<DTXR_POS>/g) || []).length, 1);
    assert.match(xml, /<NodeNumber>20<\/NodeNumber>[\s\S]*?<DTXR_POS>GUIDE\(CMPSUPGAP=5mm\)<\/DTXR_POS>/);
    assert.equal(nativeRestraints(cii).some(x => x.node === 10), false);
    assert.deepEqual(nativeRestraints(cii).filter(x => x.node === 20),
      [{node:20, kind:8, gap:5}]);
    const engineering = verifyCiiEngineeringAgainstNativeXml(xml, cii);
    assert.equal(engineering.status, 'VERIFIED');
    assert.equal(engineering.restraints, 1);
    const independent = await reconcileXml229ActualCiiAgainstFinal({
      originalXmlText: original, packet: run.packet, ciiText: cii,
      writerDiagnostic: JSON.parse(readFileSync(run.proofPath, 'utf8')),
    });
    assert.equal(independent.massConsumptionVerified, true);
    assert.equal(independent.nativeCiiReleaseAuthorized, true);
  } finally {
    run.dispose();
  }
});

test('real native CII CLI binds multiple support members through verified COMPRE route carrier', async () => {
  // The parent route item is independently present in the same original
  // staged BRANCH; its route REF is not the support's own REF.
  // Two XML component positions differ by just 0.2 mm (< 0.5 mm native
  // tolerance), so positional proximity alone cannot choose the owner.
  const original = baseXml
    .replace('<Position>0 0 0</Position>', '<Position>4.8 0 0</Position>')
    .replace('<ComponentRefNo>REF-1</ComponentRefNo>',
      '<ComponentRefNo>=42/200</ComponentRefNo>');
  const support = (kind, gap) => ({
    ...sourceMember(kind, gap),
    attributes: { ...sourceMember(kind, gap).attributes,
      REF: '=99/999', COMPRE: '=42/200' },
  });
  const source = staged([
    {type: 'RIGID', name: 'original route carrier',
     attributes: {REF: '=42/200'}},
    support('REST', '0mm'),
    support('GUIDE', '5mm'),
    support('LINE STOP', '8mm'),
  ]);
  const run = nativeRun(original, source);
  try {
    assert.equal(run.run.status, 0,
      `carrier authority native CLI failure: ${(run.run.stderr || '').slice(-1200)} ${(run.run.stdout || '').slice(-1600)}`);
    const enriched = readFileSync(run.enrichedPath, 'utf8');
    assert.match(enriched,
      /<DTXR_POS>REST\(CMPSUPGAP=0mm\)\|GUIDE\(CMPSUPGAP=5mm\)\|LINE STOP\(CMPSUPGAP=8mm\)<\/DTXR_POS>/);
    const cii = readFileSync(run.output, 'utf8');
    assert.deepEqual(nativeRestraints(cii).filter(x => x.node === 20), [
      { node: 20, kind: 14, gap: 0 },
      { node: 20, kind: 8, gap: 5 },
      { node: 20, kind: 9, gap: 8 },
    ]);
    assert.equal(nativeRestraints(cii).some(x=>x.node===10),false);
    const engineering = verifyCiiEngineeringAgainstNativeXml(enriched,cii);
    assert.equal(engineering.status,'VERIFIED');
    assert.equal(engineering.restraints,3);
    const massProof = await reconcileXml229ActualCiiAgainstFinal({
      originalXmlText:original, packet:run.packet, ciiText:cii,
      writerDiagnostic:JSON.parse(readFileSync(run.proofPath,'utf8')),
    });
    assert.equal(massProof.massConsumptionVerified,true);
    assert.equal(massProof.nativeCiiReleaseAuthorized,true);
  } finally { run.dispose(); }
});

test('real native CLI preserves PS-owned REST | GUIDE | LINE STOP when COMPRE names remote edge',async()=>{
  // Regression for actual V4 receipt: carrierRouteVerified=true and
  // carrierCandidateCount=0, but precisely ONE candidate XML node has PS.
  const original=baseXml
    .replace('<Position>0 0 0</Position>','<Position>4.8 0 0</Position>')
    .replace('<NodeName>WGT</NodeName>',
             '<NodeName>WGT</NodeName><SupportTag>PS00002</SupportTag>');
  const member=(kind,gap)=>({
    ...sourceMember(kind,gap),
    attributes:{...sourceMember(kind,gap).attributes,
      NAME:'/PS00002',COMPRE:'=42/900',REF:'=99/999'},
  });
  const source=staged([
    {type:'PIPE',name:'verified upstream pipe edge',
     attributes:{REF:'=42/900'}},
    member('REST','0mm'),member('GUIDE','5mm'),member('LINE STOP','8mm'),
  ]);
  const run=nativeRun(original,source);
  try{
    assert.equal(run.run.status,0,
      `PS + remote carrier conversion failed: ${(run.run.stderr||'').slice(-1500)} ${(run.run.stdout||'').slice(-1500)}`);
    const consumed=readFileSync(run.enrichedPath,'utf8');
    assert.match(consumed,
      /<DTXR_POS>REST\(CMPSUPGAP=0mm\)\|GUIDE\(CMPSUPGAP=5mm\)\|LINE STOP\(CMPSUPGAP=8mm\)<\/DTXR_POS>/);
    const cii=readFileSync(run.output,'utf8');
    assert.deepEqual(nativeRestraints(cii).filter(row=>row.node===20),[
      {node:20,kind:14,gap:0},
      {node:20,kind:8,gap:5},
      {node:20,kind:9,gap:8},
    ]);
    assert.equal(nativeRestraints(cii).some(row=>row.node===10),false);
    const check=verifyCiiEngineeringAgainstNativeXml(consumed,cii);
    assert.equal(check.status,'VERIFIED');
    assert.equal(check.restraints,3);
    const mass=await reconcileXml229ActualCiiAgainstFinal({
      originalXmlText:original,packet:run.packet,ciiText:cii,
      writerDiagnostic:JSON.parse(readFileSync(run.proofPath,'utf8')),
    });
    assert.equal(mass.massConsumptionVerified,true);
    assert.equal(mass.nativeCiiReleaseAuthorized,true);
  }finally{run.dispose();}
});

test('real native CLI rejects unverified carrier even when XML ref exists',()=>{
  const original = baseXml
    .replace('<Position>0 0 0</Position>', '<Position>4.8 0 0</Position>')
    .replace('<ComponentRefNo>REF-1</ComponentRefNo>',
      '<ComponentRefNo>=42/200</ComponentRefNo>');
  // Source has no independent route member with REF =42/200.
  // Explicit COMPRE alone cannot manufacture a route identity.
  const source = staged([{
    ...sourceMember('GUIDE','5mm'),
    attributes: {...sourceMember('GUIDE','5mm').attributes,
      COMPRE:'=42/200'},
  }]);
  const run = nativeRun(original, source);
  try {
    assert.notEqual(run.run.status,0);
    assert.match(run.run.stdout+run.run.stderr,/XML229_STAGED_POSITION_AMBIGUOUS/);
    assert.equal(existsSync(run.output),false);
    assert.equal(existsSync(run.proofPath),false);
  } finally { run.dispose(); }
});

test('actual native CLI refuses same-position ambiguity and writes no CII', () => {
  const collocated = baseXml.replace('<Position>0 0 0</Position>',
    '<Position>5 0 0</Position>');
  const run = nativeRun(collocated, staged([sourceMember('GUIDE', '5mm')]));
  try {
    assert.notEqual(run.run.status, 0);
    assert.match(run.run.stdout + run.run.stderr, /XML229_STAGED_POSITION_AMBIGUOUS/);
    assert.equal(existsSync(run.output), false,
      'no governed CII artifact is written after an ambiguous staged owner');
    assert.equal(existsSync(run.proofPath), false,
      'no forged mass/output proof is written for a failed native Run');
  } finally {
    run.dispose();
  }
});

test('actual native CLI refuses a claim between distinct components without precise owner', () => {
  const run = nativeRun(baseXml, staged([sourceMember('GUIDE', '5mm', '2.5 0 0')]));
  try {
    assert.notEqual(run.run.status, 0);
    assert.match(run.run.stdout + run.run.stderr, /XML229_STAGED_POSITION_AMBIGUOUS/);
    assert.equal(existsSync(run.output), false);
    assert.equal(existsSync(run.proofPath), false);
  } finally {
    run.dispose();
  }
});
