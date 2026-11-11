import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildXml229NativeOwnerBlockerEvidence}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-owner-blocker-evidence.mjs';
import {inspectXml229NativeOwnerPreflight}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-owner-preflight.mjs';

const manifest = JSON.parse(await readFile(new URL(
  '../docs/architecture/xml229-ef05-14-instrument-pending-approvals.json',
  import.meta.url),'utf8'));
const sourceId = 'EF-05-source-identity';
const basisId = 'EF-05-new-Final-basis';
const intentSha = 'a'.repeat(64);
const packet = {
  schema:'XML229.NativeFinalPhysicalPacket.v1',
  basisId, sourceId, sourceXmlSha256:manifest.sourceXmlSha256,
  finalIntentSha256:intentSha, physicalCount:249,
  finalizedGeometry:{
    basisId,sourceXmlSha256:manifest.sourceXmlSha256,
    instrumentModelingSuggestions:manifest.components.map(row=>({
      branchOccurrenceIndex:row.branchOccurrenceIndex,
      secondSourceNodeOrdinal:row.endSourceNodeOrdinal,
      componentRefNo:row.componentRefNo, spanMm:row.spanMm,
    })),
  },
  components:manifest.components.map(row=>({
    occurrenceId:JSON.stringify([sourceId,row.branchOccurrenceIndex,
      row.endSourceNodeOrdinal,'source-witness']),
    effectiveKg:18.25,
  })),
};

test('exact EF-05 14-owner diagnostic can export an audit-only receipt',()=>{
  const finding = inspectXml229NativeOwnerPreflight(packet);
  assert.equal(finding.unsupportedOwners.length,14);
  const evidence = buildXml229NativeOwnerBlockerEvidence(finding);
  assert.equal(evidence.schema,'XML229.NativeOwnerBlockerEvidence.v1');
  assert.equal(evidence.status,'GOVERNED_CII_HELD');
  assert.equal(evidence.sourceXmlSha256,manifest.sourceXmlSha256);
  assert.equal(evidence.basisId,basisId);
  assert.equal(evidence.finalIntentSha256,intentSha);
  assert.equal(evidence.physicalCount,249);
  assert.equal(evidence.unsupportedOwnerCount,14);
  assert.equal(evidence.nativeCiiReleaseAuthorized,false);
  assert.equal(evidence.engineeringApprovalVerified,false);
  assert.equal(evidence.instrumentClassificationsApplied,false);
  assert.ok(Object.isFrozen(evidence.unsupportedOwners));
  for(let i=0;i<14;i++){
    const row=manifest.components[i],owner=evidence.unsupportedOwners[i];
    assert.equal(owner.branchOccurrenceIndex,row.branchOccurrenceIndex);
    assert.equal(owner.sourceNodeOrdinal,row.endSourceNodeOrdinal);
    assert.equal(owner.componentRefNo,row.componentRefNo);
    assert.equal(owner.spanMm,305);
  }
  assert.doesNotMatch(JSON.stringify(evidence),/"classification":"RIGID"/);
});

test('evidence export rejects empty, invalid, duplicate and spoofed records',()=>{
  const real=inspectXml229NativeOwnerPreflight(packet);
  for(const patch of [
    {status:'NO_SUGGESTED_INSTRUMENT_BLOCKERS'},
    {unsupportedOwners:[]},
    {sourceXmlSha256:'not-a-sha'},
    {unsupportedOwners:[real.unsupportedOwners[0],real.unsupportedOwners[0]]},
    {unsupportedOwners:[{...real.unsupportedOwners[0],componentType:'VALV'}]},
    {unsupportedOwners:[{...real.unsupportedOwners[0],spanMm:-3}]},
  ]){
    assert.throws(()=>buildXml229NativeOwnerBlockerEvidence({
      ...real,...patch,
    }),/XML229_NATIVE_OWNER_EVIDENCE_/);
  }
});

test('new native owner audit UI is mirrored and does not replace native proof',async()=>{
  const root=new URL('../tabs/xml-cii-2019-standalone/ui-adapted/',import.meta.url);
  const served=new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/',import.meta.url);
  const names=['xml229-native-owner-blocker-evidence.mjs',
    'xml229-native-owner-preflight.mjs',
    'xml-cii-adapted-output-run.js'];
  for(const name of names){
    assert.equal(await readFile(new URL(name,root),'utf8'),
      await readFile(new URL(name,served),'utf8'),name+' served parity');
  }
  const ui=await readFile(new URL('xml-cii-adapted-output-run.js',root),'utf8');
  const candidate=await readFile(new URL('xml229-native-cii-candidate-run.mjs',root),'utf8');
  assert.match(ui,/buildXml229NativeOwnerBlockerEvidence/);
  assert.match(ui,/xml229-native-owner-blockers\.json/);
  assert.match(ui,/xml229_instrument_source_revision\.py inspect/);
  assert.match(ui,/xml229_instrument_source_revision\.py apply/);
  assert.match(candidate,/requireXml229NativeOwnerPreflight\(packet\)/);
  assert.match(candidate,/reconcileXml229ActualCiiAgainstFinal/);
  assert.doesNotMatch(candidate,/executeStandaloneFallbackCandidate|xml229NativeFinalPacket:\s*null/);
});
