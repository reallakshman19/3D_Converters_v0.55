import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {inspectXml229NativeOwnerPreflight,requireXml229NativeOwnerPreflight}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-owner-preflight.mjs';

const manifest=JSON.parse(readFileSync(new URL(
 '../docs/architecture/xml229-ef05-14-instrument-pending-approvals.json',
 import.meta.url),'utf8'));
const sourceId='EF05_SOURCE';
const geometry=(selected=[])=>({
  schema:'XML229.FinalizedWeightGeometry.v1',basisId:'basis',
  sourceXmlSha256:manifest.sourceXmlSha256,
  instrumentModelingSuggestions:manifest.components
    .filter((_,i)=>!selected.includes(i)).map(row=>({
      branchOccurrenceIndex:row.branchOccurrenceIndex,
      secondSourceNodeOrdinal:row.endSourceNodeOrdinal,
      componentRefNo:row.componentRefNo,spanMm:row.spanMm,
      suggestedClassification:'RIGID_CANDIDATE',
    })),
});
const packet=(overrides={})=>({
  schema:'XML229.NativeFinalPhysicalPacket.v1',
  basisId:'basis',sourceId,sourceXmlSha256:manifest.sourceXmlSha256,
  physicalCount:249,finalizedGeometry:geometry(),
  components:manifest.components.map(row=>({
    occurrenceId:JSON.stringify([sourceId,row.branchOccurrenceIndex,
      row.endSourceNodeOrdinal,'INST-signature']),
    effectiveKg:18.25,
  })),
  ...overrides,
});

test('real EF-05 source-bound manifest locates all 14 unclassified instrument owners',()=>{
  assert.equal(manifest.components.length,14);
  const finding=inspectXml229NativeOwnerPreflight(packet());
  assert.equal(finding.status,'UNSUPPORTED_OWNERS');
  assert.equal(finding.unsupportedOwners.length,14);
  assert.equal(finding.sourceXmlSha256,manifest.sourceXmlSha256);
  for(let i=0;i<14;i++){
    const row=manifest.components[i], actual=finding.unsupportedOwners[i];
    assert.equal(actual.branchOccurrenceIndex,row.branchOccurrenceIndex);
    assert.equal(actual.sourceNodeOrdinal,row.endSourceNodeOrdinal);
    assert.equal(actual.componentRefNo,row.componentRefNo);
    assert.equal(actual.componentType,'INST');
  }
  assert.throws(()=>requireXml229NativeOwnerPreflight(packet()),error=>
    error.code==='NATIVE_RIGID_OWNER_UNSUPPORTED' &&
    error.xml229NativeOwnerPreflight.unsupportedOwners.length===14);
});

test('explicit 0 kg Final instrument owners pass advisory without assuming RIGID',()=>{
  const yes=packet({components:packet().components.map(row=>({...row,effectiveKg:0}))});
  const result=requireXml229NativeOwnerPreflight(yes);
  assert.equal(result.status,'CONFIRMED_ZERO_INSTRUMENTS');
  assert.equal(result.unsupportedOwners.length,0);
  assert.equal(result.confirmedZeroInstrumentOwners.length,14);
  const mixed=packet({components:packet().components.map((row,i)=>({
    ...row,effectiveKg:i<6?0:18.25,
  }))});
  const blocked=inspectXml229NativeOwnerPreflight(mixed);
  assert.equal(blocked.confirmedZeroInstrumentOwners.length,6);
  assert.equal(blocked.unsupportedOwners.length,8);
  assert.throws(()=>requireXml229NativeOwnerPreflight(mixed),
    {code:'NATIVE_RIGID_OWNER_UNSUPPORTED'});
});

test('classification in a separately finalized source removes only selected blockers',()=>{
  for(const selected of [[0],[0,1,2],Array.from({length:14},(_,i)=>i)]){
    const audited=inspectXml229NativeOwnerPreflight(packet({finalizedGeometry:geometry(selected)}));
    assert.equal(audited.unsupportedOwners.length,14-selected.length);
  }
  assert.equal(requireXml229NativeOwnerPreflight(packet({
    finalizedGeometry:geometry(Array.from({length:14},(_,i)=>i))
  })).status,'NO_SUGGESTED_INSTRUMENT_BLOCKERS');
});

test('source owner identity, not just component type, controls preflight',()=>{
  const otherSource=packet({sourceId:'DIFFERENT_SOURCE'});
  assert.equal(inspectXml229NativeOwnerPreflight(otherSource).unsupportedOwners.length,0,
    'owners from another source ID must not match this packet');
  const mismatched=packet({components:packet().components.map(row=>({
    ...row,occurrenceId:JSON.stringify(['OTHER',0,0,'different']),
  }))});
  assert.equal(inspectXml229NativeOwnerPreflight(mismatched).unsupportedOwners.length,0);
  const foreignGeometry=packet({finalizedGeometry:{
    ...geometry(),sourceXmlSha256:'f'.repeat(64),
  }});
  assert.equal(inspectXml229NativeOwnerPreflight(foreignGeometry).status,'UNAVAILABLE');
});

test('new main-based route preserves native Final custody and refuses fallback release',async()=>{
  const root=new URL('../tabs/xml-cii-2019-standalone/ui-adapted/',import.meta.url);
  const served=new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/',import.meta.url);
  for(const name of ['xml229-native-owner-preflight.mjs',
    'xml229-native-cii-candidate-run.mjs','xml-cii-adapted-output-run.js']){
    assert.equal(await readFile(new URL(name,root),'utf8'),
      await readFile(new URL(name,served),'utf8'),name+' root/docs parity');
  }
  const run=await readFile(new URL('xml229-native-cii-candidate-run.mjs',root),'utf8');
  const ui=await readFile(new URL('xml-cii-adapted-output-run.js',root),'utf8');
  assert.match(run,/requireXml229NativeOwnerPreflight\(packet\)/);
  assert.match(run,/reconcileXml229ActualCiiAgainstFinal/);
  assert.doesNotMatch(run,/executeStandaloneFallbackCandidate|xml229NativeFinalPacket:\s*null/);
  assert.match(ui,/xml229NativeOwnerPreflight/);
  assert.match(ui,/nativeCiiReleaseAuthorized!==true/);
});
