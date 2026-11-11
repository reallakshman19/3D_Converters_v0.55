import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildXml229VerifiedWeightRowProjection}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-verified-weight-row-adapter.mjs';
import {renderXml229WeightReviewPage}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs';

const basisId='b'.repeat(64),sourceId='ORIGINAL-XML';
const phys=(ordinal,ref)=>({
 sourceId,branchOccurrenceIndex:0,nodeOrdinal:ordinal,
 componentSignature:JSON.stringify(['RIGID',ref,'2',ref==='A'?'VGT-001':'ComponentName']),
 occurrenceId:JSON.stringify([sourceId,0,ordinal,JSON.stringify(['RIGID',ref,'2','ComponentName'])]),
});
function fixture(){
 const p1=phys(0,'A'),p2=phys(1,'B');
 const originalOccurrences={
  branches:[{sourceId,branchOccurrenceIndex:0,branchName:'/OWNER-L101-300'}],
  nodes:[p1,p2].map((x,i)=>({
    sourceId,branchOccurrenceIndex:0,nodeOrdinal:i,nodeNumber:'290',
    componentType:'RIGID',componentRefNo:i?'B':'A',endpoint:'2',
  })),
 };
 const previewResult={
  branchRows:[{branchName:'/OWNER-L101-300',lineKey:'L101'}],
  nodeRows:[{branchOccurrenceIndex:0,sourceNodeOrdinal:0,
   nodeNumber:'290',componentType:'RIGID',componentRefNo:'A',endpoint:'2',
   boreMm:100,rating:'300',lengthMm:150,
   dtxr:'CONTROL VALVE',dtxrSource:'original-json',dtxrMatchedKey:'stable-source-key',valveHint:'Control valve'}],
 };
 const values={
  'source.occurrence':true,'bore.mm':100,'length.mm':150,
  'rating':'300','mass.kg':null,'component.type':'RIGID','component.ref':'A',
 };
 const facts=[p1,p2].flatMap((p,i)=>Object.entries(values).map(([fieldId,v])=>({
  basisId,sourceId,occurrenceId:p.occurrenceId,fieldId,
  authority:v===null?'unresolved':'source',unit:fieldId.endsWith('.mm')?'mm':null,
  value:fieldId==='component.ref'?(i?'B':'A'):v,provenance:[{sourceRef:sourceId}],
 })));
 const rawProposal={basisId,occurrenceId:p1.occurrenceId,proposalId:'sha-bound-p1',
  ranking:1,value:35,method:'direct-master',qualified:true,
  eligibilityReasons:['exact'],evidenceRefs:['master-hash'],
  extensions:{candidate:{score:96,weightMethod:'exact',lengthDelta:0.2}}};
 const review={
  getFacts:({cursor,limit})=>({
   complete:true,totalCount:facts.length,items:facts.slice(cursor?Number(cursor):0,(cursor?Number(cursor):0)+limit),
   nextCursor:(cursor?Number(cursor):0)+limit<facts.length?String((cursor?Number(cursor):0)+limit):null,
  }),
  getProposals:({occurrenceIds,cursor,limit})=>{
   const all=[rawProposal].filter(p=>occurrenceIds.includes(p.occurrenceId));
   const start=cursor?Number(cursor):0;
   return {complete:true,totalCount:all.length,items:all.slice(start,start+limit),
     nextCursor:start+limit<all.length?String(start+limit):null};
  },
 };
 return {physicalOccurrences:[p1,p2],originalOccurrences,previewResult,
  session:{basis:{basisId},review},sourceId};
}

test('single 13-column Applied Weight review UI is fed by exact original physical census, not legacy node keys',()=>{
 const args=fixture();
 const projection=buildXml229VerifiedWeightRowProjection(args);
 assert.equal(projection.count,2);
 const a=projection.get(args.physicalOccurrences[0].occurrenceId);
 const b=projection.get(args.physicalOccurrences[1].occurrenceId);
 assert.equal(a.nodeNumber,'290');
 assert.equal(b.nodeNumber,'290','duplicate display NodeNumbers are legal, but identities remain separate');
 assert.notEqual(a.occurrenceId,b.occurrenceId);
 assert.equal(a.branchName,'/OWNER-L101-300');
 assert.equal(a.nodeName,'VGT-001');
 assert.equal(a.shortName,'Gate Valve');
 assert.equal(a.inferredValveName,'VGT → Gate Valve');
 assert.equal(b.shortName,'ComponentName');
 assert.equal(a.lineKey,'L101');
 assert.equal(a.boreMm,100);
 assert.equal(a.lengthMm,150);
 assert.equal(a.dtxr,'CONTROL VALVE');
 assert.equal(a.dtxrMatchedKey,'stable-source-key');
 assert.equal(a.valveHint,'Control valve');
 assert.equal(b.dtxr,'','no candidate row means no invented DTXR');
 const ps=projection.proposals([a.occurrenceId,b.occurrenceId]);
 assert.equal(ps.get(a.occurrenceId)[0].score,96);
 assert.equal(ps.get(a.occurrenceId)[0].lengthDelta,0.2);
 assert.deepEqual(ps.get(b.occurrenceId),[]);
 const html=renderXml229WeightReviewPage({totalCount:2,populationCount:2,
  rows:[{...a,sourceKg:null,match1Kg:null,finalKg:null,proposals:ps.get(a.occurrenceId)}]},0);
 assert.equal((html.match(/<th style=/g)||[]).length,13);
 for(const field of ['Line Key','ComponentRefNo_Endpoint','DTXR','Valve Hint','Nearest Suggestions','Applied Weight'])assert.match(html,new RegExp(field));
 assert.match(html,/CONTROL VALVE/);
 assert.match(html,/96%/);
 assert.match(html,/data-p4-bulk-plan/);
});

test('original-preclean index and exact physical field cardinality fail closed',()=>{
 const a=fixture();
 a.previewResult.nodeRows[0].nodeNumber='300';
 assert.throws(()=>buildXml229VerifiedWeightRowProjection(a),/differs from original/);
 const b=fixture();
 b.session.review.getFacts=()=>({complete:true,totalCount:0,items:[],nextCursor:null});
 assert.throws(()=>buildXml229VerifiedWeightRowProjection(b),/cannot join original facts/);
});

test('optional Preview UI metadata conflict does not revoke complete verified physical facts',()=>{
 const args=fixture();
 args.previewResult.nodeRows[0].rating='600'; // A legacy display disagreement, not source identity.
 const result=buildXml229VerifiedWeightRowProjection(args);
 const row=result.get(args.physicalOccurrences[0].occurrenceId);
 assert.equal(row.rating,'300','verified FactRecord remains authoritative');
 assert.equal(row.lengthMm,150);
 assert.equal(row.dtxr,'','unverifiable optional DTXR is withheld');
 assert.equal(row.displayMetadataStatus,'PREVIEW_METADATA_FACT_CONFLICT');
});

test('production integration uses existing GC-PW bulk planner and not legacy Weight calculator',async()=>{
 const worker=await readFile(new URL('../tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',import.meta.url),'utf8');
 const panel=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 assert.match(worker,/planXml229QualifiedBlankFill/);
 assert.match(worker,/commitXml229QualifiedBlankFill/);
 // GC-PW planner/writer remain exclusively in the imported Worker-owned
 // guard module, with no duplicate scoring or decision path.
 const guard=await readFile(new URL('../tabs/xml-cii-2019-standalone/integration/xml229-source-weight-bulk-review.mjs',import.meta.url),'utf8');
 assert.match(guard,/planExactSourceWeightCommands/);
 assert.match(guard,/commitExactSourceWeightCommands/);
 assert.match(worker,/buildXml229VerifiedWeightRowProjection/);
 const actions=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-source-wide-suggestion-action.mjs',import.meta.url),'utf8');
 assert.match(actions,/session\.planQualifiedBlankFill/);
 assert.match(panel,/applyXml229SourceWideSuggestionDrafts/);
 const twoClick=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-two-click-confirmation.mjs',import.meta.url),'utf8');
  assert.ok(!panel.includes('commitXml229TwoClickMatch1('),
    'simplified Weight UI must not expose hidden two-click Match-1 acceptance');
  assert.ok(actions.includes('planXml229SkipWeightDrafts'));
  assert.ok(panel.includes('applyXml229BlankWeightDrafts'));
  assert.ok(!panel.includes('data-p4-skip-weight'));
  assert.ok(!panel.includes('data-p4-review-match1'));
  assert.ok(!panel.includes('data-p4-review-final'));
  assert.ok(panel.includes('draftValues'),
    'Applied Weight remains a source-bound draft, never an automatic ledger write');
 assert.ok(twoClick.includes('session.commitQualifiedBlankFill({planId:plan.planId})'));
 assert.ok(twoClick.includes('if(confirm)confirm.disabled=true'));
 assert.doesNotMatch(panel,/bindXmlCiiWeightMatchPhase/);
 assert.match(panel,/getXml229CurrentWorkerHeldReview/);
});

test('all served modules mirror their authoritative root files',async()=>{
 for(const path of [
 'tabs/xml-cii-2019-standalone/integration/xml229-verified-weight-row-adapter.mjs',
 'tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',
 'tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-client.mjs',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js']){
  const root=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const served=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(root,served,path);
 }
});
