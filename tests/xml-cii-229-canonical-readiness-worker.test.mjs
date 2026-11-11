import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildStandaloneOutputRunReadiness,hasOriginalJsonSourceOnlyRunHold}
 from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import {isXml229VerifiedCompletionForInput}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-verified-output-readiness.mjs';
import {xml229CanonicalOutputBadgeCounts}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-canonical-output-header-badges.mjs';

const sourceId='OWNER-ORIGINAL-XML', sha='a'.repeat(64),basisId='b'.repeat(64);
const originalReceipt={
 schema:'XML229.OriginalStagedSourceReceipt.v1',sha256:sha,
 generationId:'GEN-001',phase:'INDEX_COMMITTED',
};
const readyReceipt={
 basisId,sourceId,originalJsonSha256:sha,
 sourceGenerationId:'GEN-001',physicalCount:2,
};
const completion=(counts={source:0,match1:0,final:0,unresolved:2})=>({
 schema:'XML229.P4.RunAdvisory.v1',
 basisId,sourceId,originalJsonSha256:sha,sourceGenerationId:'GEN-001',
 verifiedPhysicalCount:2,verifiedFactCount:14,
 counts,engineeringFactsVerified:true,previewStatus:'FULL_SOURCE_FACTS_VERIFIED',
 ciiReleaseAuthorized:false,
});
function input(){
 return {
  sourceKind:'xml',sourceText:'<Plant><Branch /></Plant>',
  supportConfigJson:'{}',options:{outputMode:'both'},masterContext:{rowCounts:{}},
  modeASourceId:sourceId,xml229StagedSourceReceipt:{...originalReceipt},
  // These legacy flags may come from a DIFFERENT source; for governed O1
  // they must NEVER provide a green signal or be counted as acceptance.
  previewDiagnosticsAuditReport:{legacy:true},
  weightMatchResult:{finalizedRows:[{mass:9}]},
 };
}
const by=(report,id)=>report.checklistRows.find(row=>row.id===id);
const engineering=(counts)=>({sessionReceipt:{...readyReceipt},proof:completion(counts)});
test('original staged JSON holds native Run even with stale legacy Preview and Weight caches',()=>{
 const a=input(),r=buildStandaloneOutputRunReadiness(a);
 assert.equal(hasOriginalJsonSourceOnlyRunHold(a),true);
 assert.equal(by(r,'preview-audit').status,'missing');
 assert.equal(by(r,'weight-match').status,'missing');
 assert.equal(by(r,'xml229-original-json-engineering-authority').status,'held');
 assert.equal(by(r,'xml229-original-json-engineering-authority').blocking,true);
 assert.equal(r.summary.blockingCount,1);
 for(const id of ['support-mapper','resolver-json','manual-restraints']){
  assert.equal(by(r,id).status,'not-run');
  assert.equal(by(r,id).blocking,false);
 }
 assert.equal(by(r,'run-result').status,'pending');
 assert.equal(r.raw.xml229VerifiedEngineering,false);
});
test('verified GC-PW Preview and unreviewed weights feed same canonical report, not DOM only',()=>{
 const r=buildStandaloneOutputRunReadiness(input(),{verifiedEngineering:engineering()});
 assert.equal(r.raw.xml229VerifiedEngineering,true);
 assert.equal(by(r,'preview-audit').status,'ready');
 assert.match(by(r,'preview-audit').message,/14 complete source-bound FactRecords/);
 assert.equal(by(r,'weight-match').status,'pending');
 assert.equal(r.summary.blockingCount,1,'native CII remains HELD');
 assert.equal(r.logRows.some(x=>x.message.startsWith('Preview / Diagnostics / Matched Audit status:')),false);
 assert.equal(r.diagnostics.some(x=>x.type==='preview-audit'),false);
 assert.equal(r.diagnostics.some(x=>x.type==='weight-match'),true);
 assert.equal(r.summary.warningCount,
  r.checklistRows.filter(row=>!row.blocking&&row.status!=='ready').length);
});
test('Match-1 alone is pending; independently Final-reviewed population marks weight ready while native CII remains HELD',()=>{
 const a=input();
 const match=buildStandaloneOutputRunReadiness(a,{verifiedEngineering:engineering({
  source:0,match1:2,final:0,unresolved:0,
 })});
 assert.equal(by(match,'weight-match').status,'pending');
 const final=buildStandaloneOutputRunReadiness(a,{verifiedEngineering:engineering({
  source:0,match1:0,final:2,unresolved:0,
 })});
 assert.equal(by(final,'weight-match').status,'ready');
 assert.equal(by(final,'xml229-original-json-engineering-authority').blocking,true);
 assert.equal(final.summary.blockingCount,1);
 assert.equal(final.diagnostics.filter(x=>x.level==='error').length,0);
  assert.equal(final.diagnostics.filter(x=>x.level==='warning'&&x.type==='xml229-original-json-engineering-authority').length,1);
 assert.equal(final.logRows.some(x=>x.message.startsWith('Weight Match status:')),false);
});
test('corrupt, stale, cross-source, forged and incomplete Worker completion cannot make rows ready',()=>{
 const invalid=[
  x=>x.proof.originalJsonSha256='c'.repeat(64),
  x=>x.proof.sourceGenerationId='old-generation',
  x=>x.sessionReceipt.basisId='wrong-basis',
  x=>x.sessionReceipt.sourceId='ANOTHER-SOURCE',
  x=>x.proof.verifiedFactCount=7,
  x=>x.proof.counts.unresolved=0,
  x=>x.proof.ciiReleaseAuthorized=true,
  x=>x.proof.engineeringFactsVerified=false,
  x=>x.proof.previewStatus='PARTIAL',
  x=>x.proof.counts.match1=-1,
  x=>x.proof.counts.final=NaN,
 ];
 for(const mutate of invalid){
  const v=engineering();mutate(v);
  assert.equal(isXml229VerifiedCompletionForInput(input(),v.sessionReceipt,v.proof),false);
  const report=buildStandaloneOutputRunReadiness(input(),{verifiedEngineering:v});
  assert.equal(by(report,'preview-audit').status,'missing');
  assert.equal(by(report,'weight-match').status,'missing');
  assert.equal(report.summary.blockingCount,1);
 }
 const altered=input();altered.xml229StagedSourceReceipt.sha256='c'.repeat(64);
 assert.equal(by(buildStandaloneOutputRunReadiness(altered,{verifiedEngineering:engineering()}),'preview-audit').status,'missing');
});
test('multi-source source proof is never borrowed for a single source; optional executed stage remains ready',()=>{
 const a=input();a.sourceBatch={mode:'separate-models',activeSourceId:sourceId,
  sources:[{sourceId,enabled:true},{sourceId:'OTHER',enabled:true}]};
 assert.equal(by(buildStandaloneOutputRunReadiness(a,{verifiedEngineering:engineering()}),'preview-audit').status,'missing');
 assert.equal(by(buildStandaloneOutputRunReadiness(a),'xml229-original-json-engineering-authority').blocking,true);
 const b=input();b.resolverJsonTraceResult={resolved:true};
 assert.equal(by(buildStandaloneOutputRunReadiness(b),'resolver-json').status,'ready');
});
test('un-governed XML remains legacy-compatible; no new release hold on ordinary XML',()=>{
 const a=input();delete a.xml229StagedSourceReceipt;
 const report=buildStandaloneOutputRunReadiness(a);
 assert.equal(by(report,'preview-audit').status,'ready');
 assert.equal(by(report,'weight-match').status,'ready');
 assert.equal(by(report,'xml229-original-json-engineering-authority'),undefined);
});
test('visible Output/Run builds canonical report and never patches checklist cell text after async proof',async()=>{
 const path='../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js';
 const src=await readFile(new URL(path,import.meta.url),'utf8');
 assert.match(src,/verifiedEngineering:\{sessionReceipt:session\.receipt,proof,finalIntent/);
 assert.match(src,/paint\(verifiedReport,latest\)/);
 assert.match(src,/readError:\{code:error\?\.code\}/);
 assert.match(src,/paint\(held,latest\)/);
 assert.match(src,/renderRunControls\(card, stateRef, renderState, report, render\)/);
 assert.match(src,/card\.__xml229ReadinessToken/);
 assert.doesNotMatch(src,/tr\.children\[2\]\.textContent='ready'/);
 assert.doesNotMatch(src,/tr\.children\[4\]\.textContent='false'/);
});
test('root and served docs implementation and tests compile byte-for-byte',async()=>{
 const paths=[
  'tabs/xml-cii-2019-standalone/integration/xml229-verified-output-readiness.mjs',
  'tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',
 ];
 for(const path of paths){
  const root=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const docs=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(root,docs,path+' served mirror differs');
 }
});

test('header badges count the exact Output/Run diagnostics instead of stale shell or runtime log totals',()=>{
 const r=buildStandaloneOutputRunReadiness(input(),{verifiedEngineering:engineering()});
 const actual=xml229CanonicalOutputBadgeCounts(r);
 assert.equal(actual.errors,0,'native CII release HOLD is a policy warning, not runtime error');
 assert.equal(actual.warnings,r.diagnostics.filter(x=>x.level==='warning').length);
 assert.equal(actual.warnings,r.summary.warningCount+1,'blocking HOLD contributes one warning diagnostic');
 const synthetic={diagnostics:[{level:'error'},{level:'warning'},{level:'info'},{level:'warning'}],
  logRows:[{level:'error'},{level:'error'}]};
 assert.deepEqual(xml229CanonicalOutputBadgeCounts(synthetic),{errors:1,warnings:2});
});
test('header badge module is mirrored for the served application',async()=>{
 const p='tabs/xml-cii-2019-standalone/ui-adapted/xml229-canonical-output-header-badges.mjs';
 assert.equal(await readFile(new URL('../'+p,import.meta.url),'utf8'),
  await readFile(new URL('../docs/'+p,import.meta.url),'utf8'));
});

test('a rejected original GC-PW completion produces a diagnosable HELD stage without inventing readiness',()=>{
 for(const code of ['STALE_INPUT','GC_PW_RPC_FAILED','ENGINEERING_WORKER_CRASH']){
  const report=buildStandaloneOutputRunReadiness(input(),{
   verifiedEngineering:{readError:{code}},
  });
  for(const id of ['preview-audit','weight-match']){
   const row=by(report,id);
   assert.equal(row.status,'held');
   assert.equal(row.blocking,false,'native CII hold independently owns the blocking gate');
   assert.equal(row.severity,'warning');
   assert.match(row.message,new RegExp('\\['+code+'\\]'));
   assert(report.diagnostics.some(d=>d.type===id&&d.message===row.message));
   assert(report.logRows.some(d=>d.source==='readiness'&&d.message.includes('['+code+']')));
  }
  assert.equal(report.raw.xml229VerifiedEngineering,false);
  assert.equal(by(report,'xml229-original-json-engineering-authority').blocking,true);
  assert.equal(report.summary.blockingCount,1);
 }
});
test('completion diagnostics sanitize private exception text and reject untrusted failure codes',()=>{
 const report=buildStandaloneOutputRunReadiness(input(),{
  verifiedEngineering:{readError:{
   code:'../../private/dataset.xml <script>alert(1)</script>',
   message:'secret Owner source XML data',stack:'private/path/stack',
  }},
 });
 for(const row of report.checklistRows){
  assert.doesNotMatch(row.message,/private\/dataset|secret Owner|<script>|private\/path/);
 }
 assert.match(by(report,'preview-audit').message,/\[GC_PW_COMPLETION_UNAVAILABLE\]/);
 assert.equal(by(report,'xml229-original-json-engineering-authority').status,'held');
});
