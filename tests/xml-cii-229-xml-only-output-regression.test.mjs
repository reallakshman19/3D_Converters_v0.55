import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {
  captureXml229XmlOnlyApproval,isXml229XmlOnlyApproved,
  hasXml229GovernedNativeHold,sanitizeXml229XmlOnlyJob,
} from '../tabs/xml-cii-2019-standalone/integration/xml229-output-participation.mjs';
import {buildStandaloneOutputRunReadiness,buildOutputArtifactRows}
  from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import {buildXmlCiiWorkflowJobFromUiState}
  from '../tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js';

const XML='<Plant><Pipe><Branch><Branchname>/ASIM-1836-8"-P8810021-31441C4-PP/B1</Branchname>'+
 '<Node><NodeNumber>10</NodeNumber><ComponentType>ANCI</ComponentType></Node></Branch></Pipe></Plant>';
const receipt={schema:'XML229.OriginalStagedSourceReceipt.v1',phase:'INDEX_COMMITTED',
 sha256:'a'.repeat(64),generationId:'GEN-A',sourceRefId:'O1'};
const master={rowCounts:{lineList:2,pipingClass:1,materialMap:1,weight:1}};
const config=JSON.stringify({
 regexTester:{formats:[{lineKey:{regex:'(8810021)',group:1},pipingClass:{regex:'(31441C4)',group:1}}]},
 weight:{masterRows:[{key:'TRUSTED-MASTER',mass:10}],masterRevision:2,
  finalizedMatches:[{mass:6000,source:'UNVERIFIED-GCPW'}]},
 linelist:{masterRows:[{lineKey:'8810021'}]},
 overrides:{rigidWeight:{'B1/10':99999}},previewFacts:[{mass:900}],
 manualFacts:[{mass:800}],sifFacts:[{sif:600}],supportMapperRules:[{unsafe:true}],
});
const source=()=>({sourceKind:'xml',sourceText:XML,sourceFile:null,
 stagedJsonText:'{"SECRET_JSON_FACT":999}',stagedJsonFile:null,
 xml229StagedSourceReceipt:receipt,
 supportConfigJson:config,masterContext:master,branchSelection:{},
 options:{outputMode:'both'},previewDiagnosticsAuditReport:{matchedFacts:[{mass:800}]},
 manualElementSideloadResult:{matchedFacts:[{mass:900}]},
 weightMatchOverridesJson:'{"B1/10":101}',resolverJsonTraceResult:{sifFacts:[{mass:700}]},
 supportTypeMapperResult:{finalRules:[{unsafe:true}]},
 dependencyRevisions:{sourceModelRevision:1,weightAppliedRevision:1},
});
const gate=x=>buildStandaloneOutputRunReadiness(x).checklistRows
 .find(r=>r.id==='xml229-original-json-engineering-authority');
test('governed O1 JSON remains HELD; JSON upload is never an automatic native release',()=>{
 const state=source();
 assert.equal(hasXml229GovernedNativeHold(state),true);
 assert.equal(gate(state)?.blocking,true);
 assert.equal(buildStandaloneOutputRunReadiness(state).summary.blockingCount,1);
});
test('explicit XML-only requires source-bound owner action; independent native XML preflight remains',()=>{
 const state=source();
 const captured=captureXml229XmlOnlyApproval(state);
 assert(captured);
 const approved={...state,xml229XmlOnlyApproval:captured};
 assert.equal(isXml229XmlOnlyApproved(approved),true);
 assert.equal(hasXml229GovernedNativeHold(approved),false);
 const report=buildStandaloneOutputRunReadiness(approved);
 assert.equal(gate(approved),undefined);
 assert.equal(report.manifest.nativeOutputParticipation,'explicit-xml-only');
 assert.equal(report.raw.xml229XmlOnlyOutput,true);
 assert(report.checklistRows.some(r=>r.id==='branch-format-authority'));
 assert(report.checklistRows.some(r=>r.id==='xml229-xml-only-output-participation'));
});
test('changing XML, selected branches, configuration, master identity, JSON, revision or options revokes consent',()=>{
 const state=source();
 const approved={...state,xml229XmlOnlyApproval:captureXml229XmlOnlyApproval(state)};
 for(const change of [
  {sourceText:XML+' '},{sourceFile:{name:'new.xml',size:999}},
  {branchSelection:{selectedBranchNames:['OTHER']}},
  {masterContext:{...master}},{supportConfigJson:config+' '},
  {stagedJsonText:'{"new":1}'},{stagedJsonFile:{name:'new.json'}},
  {xml229StagedSourceReceipt:{...receipt,generationId:'NEW'}},
  {dependencyRevisions:{sourceModelRevision:2}},{options:{outputMode:'cii-only'}},
 ]) {
  const next={...approved,...change};
  assert.equal(isXml229XmlOnlyApproved(next),false,JSON.stringify(Object.keys(change)));
  assert.equal(hasXml229GovernedNativeHold(next),true);
 }
});
test('Mode A leases belong only to their source; selected other source cannot inherit approval',()=>{
 const shared=source();
 const a={sourceId:'A',sourceText:XML,stagedJsonText:shared.stagedJsonText,
  xml229StagedSourceReceipt:receipt,branchSelection:{},supportConfigJson:config,enabled:true};
 const b={...a,sourceId:'B',sourceText:XML+' ',xml229StagedSourceReceipt:{...receipt,generationId:'B'}};
 const state={...shared,sourceBatch:{activeSourceId:'A',sources:[a,b]}};
 const approvedA={...a,xml229XmlOnlyApproval:captureXml229XmlOnlyApproval(state,a)};
 const onlyA={...state,sourceBatch:{activeSourceId:'A',sources:[approvedA,b]}};
 assert.equal(isXml229XmlOnlyApproved(onlyA,approvedA),true);
 assert.equal(isXml229XmlOnlyApproved(onlyA,b),false);
 assert.equal(hasXml229GovernedNativeHold(onlyA),true);
 const approvedB={...b,xml229XmlOnlyApproval:captureXml229XmlOnlyApproval(state,b)};
 const both={...onlyA,sourceBatch:{activeSourceId:'A',sources:[approvedA,approvedB]}};
 assert.equal(hasXml229GovernedNativeHold(both),false);
 assert.equal(hasXml229GovernedNativeHold({...both,sourceBatch:{activeSourceId:'B',sources:[approvedA,{...approvedB,sourceText:b.sourceText+'new'}]}}),true);
});
test('native conversion job strips all JSON/Preview/Worker/review weight authority but keeps masters',()=>{
 const job={sourceKind:'xml',sourceText:XML,stagedJsonText:'{"private":1}',
  supportConfigJson:config,weightOverrides:{'B1/10':101},
  previewFacts:[{mass:9}],manualFacts:[{mass:8}],sifFacts:[{sif:7}],
  elementSideLoadText:'<Danger/>',supportMapperRules:[{kind:'GC-PW'}],
  options:{outputMode:'both',useRestraintTypeBasedOnJson:true},
 };
 const clean=sanitizeXml229XmlOnlyJob(job);
 assert.equal(clean.stagedJsonText,'');
 assert.equal(clean.elementSideLoadText,null);
 for(const k of ['previewFacts','manualFacts','sifFacts','supportMapperRules'])
   assert.deepEqual(clean[k],[],k);
 assert.deepEqual(clean.weightOverrides,{});
 assert.equal(clean.options.useRestraintTypeBasedOnJson,false);
 const parsed=JSON.parse(clean.supportConfigJson);
 assert.equal(parsed.weight.masterRows.length,1);
 assert.equal(parsed.linelist.masterRows.length,1);
 assert.equal(parsed.weight.masterRevision,2);
 for(const key of ['overrides','previewFacts','manualFacts','sifFacts','supportMapperRules'])
   assert.equal(parsed[key],undefined,key);
 assert.equal(parsed.weight.finalizedMatches,undefined);
 assert.equal(parsed.regexTester.formats.length,1);
});
test('UI job builder enforces governed hold before conversion and executes clean XML-only on consent',async()=>{
 const state=source();
 await assert.rejects(()=>buildXmlCiiWorkflowJobFromUiState(state),/XML229_GOVERNED_NATIVE_CII_HELD/);
 const approved={...state,xml229XmlOnlyApproval:captureXml229XmlOnlyApproval(state)};
 const job=await buildXmlCiiWorkflowJobFromUiState(approved);
 assert.equal(job.stagedJsonText,'');
 assert.deepEqual(job.previewFacts,[]);
 assert.deepEqual(job.manualFacts,[]);
 assert.deepEqual(job.weightOverrides,{});
 assert.equal(job.elementSideLoadText,null);
 assert.equal(job.supportMapperRules.length,0);
 assert.equal(job.options.useRestraintTypeBasedOnJson,false);
 await assert.rejects(()=>buildXmlCiiWorkflowJobFromUiState({
  ...approved,sourceText:XML+' '}),/XML229_GOVERNED_NATIVE_CII_HELD/);
 // Legacy XML without a receipt retains the existing independent preflight.
 const legacy={...source(),stagedJsonText:'',xml229StagedSourceReceipt:null};
 const normal=await buildXmlCiiWorkflowJobFromUiState(legacy);
 assert.equal(normal.stagedJsonText,'');
});
test('.cii artifact is unavailable without real engine output; no geometry or Review count can forge it',()=>{
 assert.equal(buildOutputArtifactRows({result:{ok:true,ciiText:null}}).find(x=>x.kind==='cii').available,false);
 assert.equal(buildOutputArtifactRows({result:{ok:true,ciiText:'$ CONTROL\n'}}).find(x=>x.kind==='cii').available,true);
});
test('source/docs parity and all native paths enforce opt-in rather than deleting O1 safety',async()=>{
 const paths=[
 'tabs/xml-cii-2019-standalone/integration/xml229-output-participation.mjs',
 'tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js',
 'tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-cii-preview-canvas.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js',
 'tabs/xml-cii-2019-standalone/xml-cii-mode-a-batch-core.js',
 ];
 for(const path of paths){
  const a=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const b=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(a,b,path);
 }
 const ui=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 assert.match(ui,/dataset\.action='xml229-output-participation'/);
 const events=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events.js',import.meta.url),'utf8');
 assert.match(events,/querySelectorAll/, 'CII artifact and canvas buttons must both be wired');
 assert.match(events,/button => button\.addEventListener\('click', handler\)/);
 const canvas=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-cii-preview-canvas.js',import.meta.url),'utf8');
 assert.match(canvas,/download\.addEventListener\('click'/, 'CII canvas must bind its own freshly rendered action');
 assert.match(canvas,/if \(!available \|\| !ciiText\.trim\(\)\) return/, 'CII download remains behind real native output availability');
 const standard=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a.js',import.meta.url),'utf8');
 const fast=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js',import.meta.url),'utf8');
 for(const runner of [standard,fast]){
  assert.match(runner,/hasOriginalJsonSourceOnlyRunHold\(state\)/);
  assert.match(runner,/xml229XmlOnlyApproval:source\.xml229XmlOnlyApproval\|\|null/);
  assert.match(runner,/xml229StagedSourceReceipt:originalReceipt/);
 }
});
test('red control: base original native guard keys off receipt alone and cannot honor owner XML-only intent',()=>{
 const base='7d2aa5300597fa8ddc3d47b1a492944229afa8a6';
 let original='';
 try{original=execFileSync('git',['show',base+':tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js'],
  {encoding:'utf8'});}
 catch{return;} // Git checkout depth may omit the base; the behavior test above is mandatory.
 assert.match(original,/return selectedOriginalJsonSourceReceipts\(input\)\.length > 0/);
 const modified=execFileSync('git',['show','HEAD:tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js'],
  {encoding:'utf8'});
 assert.doesNotMatch(modified,/return selectedOriginalJsonSourceReceipts\(input\)\.length > 0/);
});
