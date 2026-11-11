import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildOutputRunChecklist,buildStandaloneOutputRunReadiness}
  from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import {captureXml229XmlOnlyApproval}
  from '../tabs/xml-cii-2019-standalone/integration/xml229-output-participation.mjs';

function source() {
  return {
    sourceKind:'xml', sourceText:'<PipeStressExport/>',
    supportConfigJson:'{}', options:{outputMode:'both'},
    xml229StagedSourceReceipt:{phase:'INDEX_COMMITTED'},
  };
}
function blocked() {
  return {
    ...source(),
    result:{
      ok:false, error:'NATIVE_RIGID_OWNER_UNSUPPORTED',
      xml229NativeOwnerPreflight:{
        schema:'XML229.NativeOwnerPreflight.v1',
        status:'UNSUPPORTED_OWNERS',
        unsupportedOwners:Array.from({length:14},(_,i)=>({
          branchOccurrenceIndex:i,sourceNodeOrdinal:2,
          componentRefNo:'=instrument/'+i,componentType:'INST',spanMm:305,
          reason:'INSTRUMENT_RIGID_CLASSIFICATION_NOT_IN_SOURCE',
        })),
      },
    },
  };
}

test('EF-05 style 14 instrument refusal creates a blocking release-policy HOLD, not a runtime error',()=>{
  const report=buildStandaloneOutputRunReadiness(blocked());
  const owner=report.checklistRows.find(row=>
    row.id==='xml229-instrument-native-owner-authority');
  assert.equal(owner.status,'held');
  assert.equal(owner.severity,'warning');
  assert.equal(owner.blocking,true);
  assert.match(owner.message,/14 accepted instrument owner/);
  assert.match(owner.message,/new Final weight review/);
  const native=report.logRows.find(row=>row.message.includes('NATIVE_RIGID_OWNER_UNSUPPORTED'));
  assert.equal(native.level,'warning');
  assert.equal(native.source,'native-release-hold');
  assert.equal(report.raw.xml229NativeOutputVerified,false);
  assert.equal(report.artifactRows.find(row=>row.kind==='cii').available,false);
});

test('missing, malformed or unrelated evidence never creates a false instrument hold',()=>{
  const original=blocked();
  for(const result of [
    {...original.result,xml229NativeOwnerPreflight:null},
    {...original.result,xml229NativeOwnerPreflight:{schema:'other',unsupportedOwners:[{}]}},
    {...original.result,error:'NATIVE_CANDIDATE_CONVERTER_FAILED'},
  ]){
    const rows=buildOutputRunChecklist({...original,result});
    assert.equal(rows.some(row=>row.id==='xml229-instrument-native-owner-authority'),false);
  }
  const generic=buildStandaloneOutputRunReadiness({
    ...original,result:{ok:false,error:'NATIVE_CANDIDATE_CONVERTER_FAILED'}});
  assert.ok(generic.logRows.some(row=>row.level==='error'&&
    row.message==='NATIVE_CANDIDATE_CONVERTER_FAILED'));
});

test('explicit source-bound XML-only participation excludes engineering Final and its policy HOLD',()=>{
  const input=blocked();
  const selected={...input,xml229XmlOnlyApproval:captureXml229XmlOnlyApproval(input)};
  const report=buildStandaloneOutputRunReadiness(selected);
  assert.equal(report.checklistRows.some(row=>
    row.id==='xml229-instrument-native-owner-authority'),false);
  assert.equal(report.manifest.nativeOutputParticipation,'explicit-xml-only');
});

test('deployed docs readiness mirror exactly matches source implementation',async()=>{
  const [src,docs]=await Promise.all([
    readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js',import.meta.url),'utf8'),
  ]);
  assert.equal(src,docs);
});
