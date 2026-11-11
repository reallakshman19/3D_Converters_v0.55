import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditXml229AcceptedMatch1Row,auditXml229AcceptedMatch1Population,
 projectXml229AuditedDecisionProvenance}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-accepted-match1-family-audit.mjs';
import {renderXml229WeightReviewPage}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs';

const basisId='b'.repeat(64),sourceId='PRIVATE-TEST';
const classifications={
  gate:{status:'KNOWN',family:'VALVE',subtype:'GATE',evidence:[
    {origin:'nodeName',family:'VALVE',subtype:'GATE',raw:'VGT-TEST'}]},
  check:{status:'KNOWN',family:'VALVE',subtype:'CHECK',evidence:[
    {origin:'nodeName',family:'VALVE',subtype:'CHECK',raw:'VCH-TEST'}]},
  unknown:{status:'UNKNOWN',family:'UNKNOWN',subtype:'UNKNOWN',evidence:[]},
  flange:{status:'KNOWN',family:'FLANGE',subtype:'UNSPECIFIED',evidence:[
    {origin:'master.typeDesc',family:'FLANGE',subtype:'UNSPECIFIED',raw:'Weldneck Flange'}]},
};
function record(i,{type='RIGID',nodeName='',source=classifications.unknown,
  master=classifications.flange,proposalValue=13,acceptedValue=13,
  reasons=[],qualified=false,decision=true,proposal=true}={}){
 const occurrenceId='synthetic-'+i,proposalId='basis/master-row:235/rank:1/id-'+i;
 const accepted={state:'accepted',value:acceptedValue,action:'accept-proposal',proposalId};
 return {
  basisId,sourceId,occurrenceId,componentType:type,nodeName,dtxr:'',
  sourceKg:null,match1Kg:acceptedValue,finalKg:null,
  match1View:{stageDecision:decision?accepted:null},
  match1Decision:decision?accepted:null,
  proposals:proposal?[{proposalId,ranking:1,unit:'kg',value:proposalValue,qualified,
    familyEligibility:{qualified,reasons,source,master},masterRowOrdinal:235}]:[],
 };
}
test('P0 historical VGT/VCH acceptance to Weldneck Flange is read-only SEMANTIC_MISMATCH',()=>{
 for(const [name,source] of [['VGT-SYNTHETIC',classifications.gate],
   ['VCH-SYNTHETIC',classifications.check]]){
  const row=record(name,{nodeName:name,source,reasons:['FAMILY_MISMATCH']});
  const old=structuredClone(row.match1Decision);
  const audited=auditXml229AcceptedMatch1Row(row);
  assert.equal(audited.code,'SEMANTIC_MISMATCH');
  assert.equal(audited.masterFamily.family,'FLANGE');
  assert.equal(audited.sourceFamily.family,'VALVE');
  assert.equal(audited.finalAuthorized,false);
  assert.equal(audited.nativeCiiReleaseAuthorized,false);
  assert.deepEqual(row.match1Decision,old);
  assert(!JSON.stringify(audited).includes('Weldneck Flange'),
    'master free-text raw metadata must not leak through the export');
 }
});
test('P0 unknown RIGID evidence stays unknown, not silently counted as flange',()=>{
 const a=auditXml229AcceptedMatch1Row(record(1,{reasons:['SOURCE_FAMILY_UNKNOWN']}));
 assert.equal(a.code,'SOURCE_EVIDENCE_UNKNOWN');
 assert.equal(a.sourceFamily.family,'UNKNOWN');
});
test('P0 family-compatible flange is NOT engineering Final',()=>{
 const a=auditXml229AcceptedMatch1Row(record(2,{type:'FLAN',
   source:{status:'KNOWN',family:'FLANGE',subtype:'UNSPECIFIED',evidence:[]},
   qualified:true}));
 assert.equal(a.code,'FAMILY_COMPATIBLE_ONLY');
 assert.equal(a.requiresIndependentVerification,true);
 assert.equal(a.finalAuthorized,false);
});
test('P0 stale proposal and accepted kg drift fail closed',()=>{
 assert.equal(auditXml229AcceptedMatch1Row(record(3,{proposal:false})).code,
  'PROPOSAL_NOT_FOUND');
 assert.equal(auditXml229AcceptedMatch1Row(record(4,{proposalValue:25})).code,
  'PROPOSAL_VALUE_DRIFT');
});
test('P0 manual historical accepted mass stays review-required, without rewriting kg',()=>{
 const row=record(5),prior=structuredClone(row.match1Decision);
 row.match1Decision.action='enter-manual';
 const a=auditXml229AcceptedMatch1Row(row);
 assert.equal(a.code,'MANUAL_INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(row.match1Decision.value,prior.value);
});
test('P0 audit reconciles 125 accepted rows across paged source proposals',()=>{
 const corpus=[
  ...Array.from({length:25},(_,i)=>record(i,{nodeName:'VGT-'+i,
    source:classifications.gate,reasons:['FAMILY_MISMATCH']})),
  ...Array.from({length:9},(_,i)=>record(i+25,{nodeName:'VCH-'+i,
    source:classifications.check,reasons:['FAMILY_MISMATCH']})),
  ...Array.from({length:79},(_,i)=>record(i+34,{reasons:['SOURCE_FAMILY_UNKNOWN']})),
  ...Array.from({length:12},(_,i)=>record(i+113,{type:'FLAN',
    source:{status:'KNOWN',family:'FLANGE',subtype:'UNSPECIFIED',evidence:[]},
    qualified:true})),
 ];
 const map=new Map(corpus.map(row=>[row.occurrenceId,row]));
 const decisions=Object.fromEntries(corpus.map(row=>[row.occurrenceId,row.match1Decision]));
 const old=structuredClone(decisions),calls=[];
 const audit=auditXml229AcceptedMatch1Population({
   basisId,sourceId,physicalCount:423,decisions,
   getRow:id=>map.get(id),
   getProposals:ids=>{
     calls.push(ids.length);
     return new Map(ids.map(id=>[id,map.get(id).proposals]));
   },
 });
 assert.equal(audit.acceptedMatch1Count,125);
 assert.deepEqual(calls,[80,45]);
 assert.equal(audit.summary.SEMANTIC_MISMATCH,34);
 assert.equal(audit.summary.SOURCE_EVIDENCE_UNKNOWN,79);
 assert.equal(audit.summary.FAMILY_COMPATIBLE_ONLY,12);
 assert.equal(audit.summary.holdOrUnknownCount,113);
 assert.equal(audit.summary.requiresIndependentVerification,125);
 assert.equal(audit.summary.nativeCiiReleaseAuthorized,false);
 assert.equal(audit.rows.length,125);
 assert.deepEqual(decisions,old,'historical accepted ledger must never mutate');
});
test('P0 audit fails closed if source scope or proposal population drifts',()=>{
 const row=record(6),decisions={[row.occurrenceId]:row.match1Decision};
 const args={basisId,sourceId,physicalCount:1,decisions,
   getRow:()=>({...row,sourceId:'WRONG'}),
   getProposals:ids=>new Map(ids.map(id=>[id,row.proposals]))};
 assert.throws(()=>auditXml229AcceptedMatch1Population(args),
   /ACCEPTED_SOURCE_OCCURRENCE_DRIFT/);
 assert.throws(()=>auditXml229AcceptedMatch1Population({
   ...args,getRow:()=>row,getProposals:()=>new Map()
 }),/ACCEPTED_PROPOSAL_PROJECTION_INCOMPLETE/);
});
test('P0 table labels accepted family mismatch HOLD and compatible only is not Final',()=>{
 const mismatch=record(7,{nodeName:'VGT-7',source:classifications.gate,
   reasons:['FAMILY_MISMATCH']});
 const okay=record(8,{type:'FLAN',
   source:{status:'KNOWN',family:'FLANGE',subtype:'UNSPECIFIED',evidence:[]},
   qualified:true});
 const html=renderXml229WeightReviewPage({offset:0,totalCount:2,
   populationCount:423,rows:[mismatch,okay]},0);
 assert.match(html,/data-p4-family-audit="SEMANTIC_MISMATCH"/);
 assert.match(html,/Engineering HOLD/);
 assert.match(html,/data-p4-family-audit="FAMILY_COMPATIBLE_ONLY"/);
 assert.match(html,/independent kg verification required/);
 assert.match(html,/Native CII output authorization remains a separate gate and is currently HELD/);
});
test('P0 Worker exports accepted audit through the read-only provenance endpoint',async()=>{
 const worker=await readFile(new URL(
  '../tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',
  import.meta.url),'utf8');
 const auditModule=await readFile(new URL(
  '../tabs/xml-cii-2019-standalone/integration/xml229-accepted-match1-family-audit.mjs',
  import.meta.url),'utf8');
 assert.match(worker,/projectXml229AuditedDecisionProvenance/);
 assert.match(auditModule,/acceptedFamilyAudit/);
 assert.ok(auditModule.includes('getProposals:ids=>weightProjection.proposals(ids)'));
});
test('P0 aggregate audit rejects a changed decision census between ledger and review reads',async()=>{
 const historical=record(50,{
   type:'FLAN',source:{status:'KNOWN',family:'FLANGE',subtype:'UNSPECIFIED',evidence:[]},
   qualified:true,
 });
 const review={
   exportReviewState:async()=>({
     schemaVersion:'gc-pw/1.0',basisId,contentSha256:'a'.repeat(64),
     reviewStates:[],frozenSnapshots:[],
   }),
   getDecisionState:()=>({decisions:{
     [historical.occurrenceId]:historical.match1Decision,
   }}),
 };
 const completion={
   basisId,sourceId,engineeringFactsVerified:true,ciiReleaseAuthorized:false,
   verifiedPhysicalCount:1,verifiedFactCount:7,
   counts:{source:0,match1:0,final:0,unresolved:1},
 };
 const weightProjection={
   count:1,get:()=>historical,
   proposals:ids=>new Map(ids.map(id=>[id,historical.proposals])),
 };
 await assert.rejects(projectXml229AuditedDecisionProvenance({
   review,weightProjection,basisId,sourceId,completion,
 }),/ACCEPTED_AUDIT_PROVENANCE_CENSUS_DRIFT/);
});

test('P0 new root and served modules are byte-identical',async()=>{
 for(const path of [
  'tabs/xml-cii-2019-standalone/integration/xml229-accepted-match1-family-audit.mjs',
  'tabs/xml-cii-2019-standalone/integration/xml229-verified-weight-row-adapter.mjs',
  'tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',
 ]){
  const root=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const served=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(root,served,path);
 }
});
