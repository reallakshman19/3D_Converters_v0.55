import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {buildStandaloneOutputRunReadiness}
 from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';

const validFormats={regexTester:{formats:[{
 lineKey:{regex:'(S8811000)',group:1},
 pipingClass:{regex:'(91261M7)',group:1},
}]}};
const original=Array.from({length:28},(_,index)=>
 '/ASIM-1885-3-S8811000-91261M7-HC-01/B'+(index+1));
const xml='<Plant>'+original.map(name=>'<Branch><Branchname>'+name+
 '</Branchname></Branch>').join('')+'</Plant>';
const scope=()=>({
 sourceKind:'xml',sourceText:xml,
 supportConfigJson:JSON.stringify(validFormats),
 regexTesterResult:{status:'available'},
 options:{outputMode:'both'},masterContext:{rowCounts:{lineList:385,pipingClass:10699,
   materialMap:383,weight:1595}},
 result:{ok:false,diagnostics:{note:'synthetic diagnostics'}}, // one diagnostic artifact, not a generated CII payload
});
const gate=row=>row.checklistRows.find(r=>r.id==='xml229-original-json-engineering-authority');
const summary=row=>row.checklistRows.find(r=>r.id==='branch-format-authority');

test('28/28 configured format READY does not hide 5 missing stages or 1 pending stage',()=>{
 const report=buildStandaloneOutputRunReadiness(scope());
 assert.equal(report.summary.blockingCount,0); // legacy optional-stage contract
 assert.equal(report.summary.warningCount,6);
 assert.equal(report.summary.incompleteStageCount,5);
 assert.equal(report.summary.artifactCount,1);
 assert.equal(summary(report).status,'ready');
 assert.match(summary(report).message,/28 selected branch occurrences/);
 for(const id of ['preview-audit','weight-match','support-mapper',
   'resolver-json','manual-restraints']){
   const row=report.checklistRows.find(x=>x.id===id);
   assert.equal(row.status,'missing');
   assert.equal(row.severity,'warning');
 }
 assert.equal(report.checklistRows.find(x=>x.id==='run-result').status,'pending');
 assert.equal(gate(report),undefined);
 assert.equal(report.artifactRows.find(x=>x.kind==='cii').available,false);
});

test('indexed original JSON is source-only: 28/28 regex cannot authorize CII Run',()=>{
 const state={...scope(),result:null,
  xml229StagedSourceReceipt:{
   schema:'XML229.OriginalStagedSourceReceipt.v1',phase:'INDEX_COMMITTED',
   rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,
   generationId:'gen-1',sourceRefId:'o1',sha256:'a'.repeat(64),
   occurrenceCount:622915,pageCount:1217,
  },
 };
 const report=buildStandaloneOutputRunReadiness(state);
 assert.equal(report.summary.blockingCount,1);
 assert.equal(gate(report).status,'held');
 assert.equal(gate(report).severity,'warning');
 assert.equal(gate(report).blocking,true);
 assert.match(gate(report).message,/source-only/);
 assert.match(gate(report).message,/configured branch identity/);
 assert.doesNotMatch(gate(report).message,/28\/28 Regex identity/);
 assert.equal(summary(report).status,'ready');
 // In a governed original-source route the independent optional stages are
 // explicitly not-run, rather than pretending to be missing engineering proof.
 assert.equal(report.summary.incompleteStageCount,2);
 for(const id of ['support-mapper','resolver-json','manual-restraints']){
  assert.equal(report.checklistRows.find(x=>x.id===id)?.status,'not-run');
 }
 assert.equal(report.checklistRows.find(x=>x.id==='preview-audit')?.status,'missing');
 assert.equal(report.checklistRows.find(x=>x.id==='weight-match')?.status,'missing');
});
test('selected, indexing, failed or revoked original JSON cannot claim engineering release',()=>{
 for(const phase of ['SELECTED','INDEXING','COMMIT_PENDING','FAILED','REVOKED']){
  const report=buildStandaloneOutputRunReadiness({...scope(),
    xml229StagedSourceReceipt:{phase}});
  assert.equal(report.summary.blockingCount,1,phase);
  assert.match(gate(report).message,new RegExp(phase));
 }
});
test('enabled Mode A source O1 requires HOLD, disabled unrelated source does not',()=>{
 const affected=buildStandaloneOutputRunReadiness({...scope(),sourceBatch:{
  sources:[{sourceId:'selected-original',enabled:true,
    workflow:{xml229StagedSourceReceipt:{phase:'INDEX_COMMITTED'}}},
    {sourceId:'not-selected',enabled:false,
     xml229StagedSourceReceipt:{phase:'INDEX_COMMITTED'}}],
 }});
 assert.equal(affected.summary.blockingCount,1);
 const unrelated=buildStandaloneOutputRunReadiness({...scope(),sourceBatch:{
  sources:[{sourceId:'not-selected',enabled:false,
    xml229StagedSourceReceipt:{phase:'INDEX_COMMITTED'}}],
 }});
 assert.equal(unrelated.summary.blockingCount,0);
});
test('ordinary InputXML or plain XML without governed O1 scope retains historical readiness policy',()=>{
 const plain=buildStandaloneOutputRunReadiness(scope());
 assert.equal(gate(plain),undefined);
 const input=buildStandaloneOutputRunReadiness({
  sourceKind:'inputxml',sourceText:'<CAESARII/>',
  supportConfigJson:'{}',options:{outputMode:'both'},
 });
 assert.equal(gate(input),undefined);
 assert.equal(input.summary.blockingCount,0);
 assert(input.summary.warningCount>0);
});
test('standard Mode A and fast ZIP enforce O1 receipt HOLD before any conversion or review',async()=>{
 for(const path of [
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js',
 ]){
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  assert.match(source,/hasOriginalJsonSourceOnlyRunHold\(state\)/);
  assert.match(source,/original-json-engineering-authority/);
  assert(source.indexOf('hasOriginalJsonSourceOnlyRunHold(state)')<
    source.indexOf('replaceModeAState(stateRef, { ...state, batchRunning: true'),
    path+' must refuse source-only original JSON before entering Run');
 }
});
test('root and docs readiness/panel code stays byte identical',async()=>{
 for(const p of [
 'tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js']){
  assert.deepEqual(await readFile(new URL('../'+p,import.meta.url)),
   await readFile(new URL('../docs/'+p,import.meta.url)));
 }
});

test('Output/Run native CII hold never lies about fixed 28/28 when 41 configured branches resolve',()=>{
 const fortyOne=Array.from({length:41},(_,i)=>
  '/ASIM-1885-3-S8811000-91261M7-HC-01/B'+(i+1));
 const sourceText='<Plant>'+fortyOne.map(name=>
  '<Branch><Branchname>'+name+'</Branchname></Branch>').join('')+'</Plant>';
 const report=buildStandaloneOutputRunReadiness({
  ...scope(),sourceText,
  xml229StagedSourceReceipt:{schema:'XML229.OriginalStagedSourceReceipt.v1',
   phase:'INDEX_COMMITTED',sha256:'a'.repeat(64),
   generationId:'GEN-41',rightsBasis:'SOURCE_FACTS_ONLY'},
 });
 assert.equal(summary(report)?.status,'ready');
 assert.match(summary(report).message,/41 selected branch occurrences/);
 assert.equal(gate(report)?.status,'held');
 assert.equal(gate(report)?.blocking,true);
 assert.match(gate(report).message,/configured branch identity/);
 assert.doesNotMatch(gate(report).message,/28\/28/);
 assert.equal(report.summary.blockingCount,1);
});
