import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {combineXmlWithNodeOffsets} from '../converters/xml-cii2019-core/xml-node-offset-combine.js';
import {projectXmlCiiOccurrences} from
 '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {createXmlCiiPreviewJobController} from
 '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-job-controller.js';
import {startAttestedModeBPreviewWorkerSession} from
 '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-modeb-session.js';
import {assertBasisDigest,assertContentDigest,digestUtf8,digestCanonical,canonicalJson}
 from '../contracts/gc-pw-v1/contract.mjs';
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
installWeightBasisXmlDom(globalThis);
const elem=Object.getPrototypeOf(new DOMParser().parseFromString('<R/>','application/xml').documentElement);
const get=elem.getElementsByTagName;
elem.getElementsByTagName=function(tag){
 if(tag!=='*')return get.call(this,tag);
 const out=[];const walk=n=>{for(const c of n.childNodes||[])if(c.nodeType===1){out.push(c);walk(c);}};
 walk(this);return out;
};
const doc=Object.getPrototypeOf(new DOMParser().parseFromString('<R/>','application/xml'));
doc.importNode=function(node,deep=false){return node.cloneNode(Boolean(deep));};
const ports={digestUtf8,digestCanonical,canonicalJson,assertBasisDigest,assertContentDigest};
const xml=pipe=>'<PipeStressExport><Units>mm</Units>'+pipe+'</PipeStressExport>';
const sourcePipe=type=>'<Pipe><Branch><Branchname>/SAME-NAME</Branchname>'+
 '<Node><NodeNumber>100</NodeNumber><ComponentType>'+type+
 '</ComponentType><ComponentRefNo>REF</ComponentRefNo><Endpoint>1</Endpoint></Node>'+
 '<Node><NodeNumber>-1</NodeNumber><ComponentType>GASK</ComponentType>'+
 '<ComponentRefNo>REF</ComponentRefNo><Endpoint>1</Endpoint></Node>'+
 '</Branch></Pipe>';
const snapshotClone=obj=>structuredClone({...obj,ports:undefined});
async function fixture(){
 const originalSources=[
  {sourceId:'PL01',fileName:'PL01.xml',xmlText:xml(sourcePipe('PIPE'))},
  {sourceId:'PL06',fileName:'PL06.xml',xmlText:xml(sourcePipe('VALV'))},
 ];
 const {xmlText,manifest}=combineXmlWithNodeOffsets(originalSources);
 const combinedSource={sourceId:'COMBINED',xmlText};
 const config={
  modeBManifest:manifest,
  linelist:{masterRows:[{line:'100',pipingClass:'P01'}],fieldMap:{lineKey1:'line'}},
  pipingClass:{masterRows:[{pipingClass:'P01',rating:'150'}],fieldMap:{}},
  material:{mapRows:[{material:'A106',code:'001'}]},weight:{masterRows:[]},
  overrides:{pipingClass:{'/SAME-NAME':'P01'}},
 };
 return {originalSources,combinedSource,manifest,config,stagedJsonText:'{"v":1}',ports};
}
function fakeExecute(input,alter=null){
 const scope=input.scope;
 const sourceOccurrences=structuredClone(projectXmlCiiOccurrences({
  xmlText:input.xmlText,mode:scope.mode,sourceId:scope.sourceId,manifest:scope.manifest,
 }));
 if(alter)alter(sourceOccurrences);
 const branches=sourceOccurrences.branches.length,nodes=sourceOccurrences.nodes.length;
 const result={
  branchRows:sourceOccurrences.branches.map(b=>({branchName:b.branchName,branchOccurrenceIndex:b.branchOccurrenceIndex})),
  nodeRows:[],sourceOccurrences,
  coverage:{sourceBranchCount:branches,originalNodeCount:nodes,
   engineeringBranchCount:branches,legacyReviewNodeCount:0},
  fullFactPopulationAccepted:false,engineeringAcceptance:'NOT_ASSESSED',
 };
 return {promise:Promise.resolve(result),release(){}};
}
function withExecutor(execute=fakeExecute){
 return ({verifyBasis})=>createXmlCiiPreviewJobController({verifyBasis,execute});
}
test('Mode B Worker returns every original occurrence as source-only pages, no accepted engineering',async()=>{
 const input=await fixture();
 const progress=[];
 const session=await startAttestedModeBPreviewWorkerSession({
  ...input,requestId:'p3b2a-positive',createController:withExecutor(),
  onProgress:x=>progress.push(x.state),
 });
 const output=await session.promise;
 assert.equal(output.basis.sourceRefs.length,3);
 assert.equal(output.custody.branchCount,2);
 assert.equal(output.custody.nodeCount,4);
 assert.equal(output.sourcePages.branchCount,2);
 assert.equal(output.sourcePages.nodeCount,4);
 assert.equal(output.sourcePages.engineeringReady,false);
 const page=await output.sourcePages.model.getFacts({basisId:output.basis.basisId,limit:200});
 assert.equal(page.totalCount,24);
 assert.equal(page.complete,false);
 assert.equal(page.nextCursor,null);
 assert.equal(page.items.filter(x=>x.fieldId==='source.nodeNumber'&&x.value==='-1').length,2);
 // Source-authority fact values must be original, even when the combined XML
 // used a positive NodeNumber offset for the second file.
 assert.deepEqual(page.items.filter(x=>x.fieldId==='source.nodeNumber')
   .map(x=>x.value),['100','-1','100','-1']);
 assert.ok(progress.includes('running')&&progress.includes('completed'));
 assert.equal(output.result.fullFactPopulationAccepted,false);
});
test('missing and changed original XML cannot be sent to a Mode B Worker',async()=>{
 const input=await fixture();
 await assert.rejects(startAttestedModeBPreviewWorkerSession({
  ...input,originalSources:[],requestId:'missing',
 }),{code:'ORIGINAL_SOURCES_REQUIRED'});
 const altered={...input,originalSources:snapshotClone(input).originalSources};
 altered.originalSources[1].xmlText=altered.originalSources[1].xmlText.replace('VALV','PIPE');
 await assert.rejects(startAttestedModeBPreviewWorkerSession({
  ...altered,requestId:'changed',
 }),{code:'MODE_B_VALUE_DRIFT'});
});
test('changed master after Worker dispatch fences an otherwise valid completed result',async()=>{
 const input=await fixture();
 let release;
 const delayed=spec=>({promise:new Promise(resolve=>{release=()=>resolve(fakeExecute(spec).promise);}),
  release(){}});
 const session=await startAttestedModeBPreviewWorkerSession({
  ...input,requestId:'stale-master',createController:withExecutor(delayed),
 });
 // Dispatch is queued as a microtask. Wait for the executor to be invoked.
 for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(typeof release,'function');
 input.config.pipingClass.masterRows[0].rating='900';
 release();
 await assert.rejects(session.promise,{code:'STALE_MODE_B_INPUT'});
});
test('source fact drift or missing selected node blocks Worker completion',async()=>{
 for(const [label,alter,code] of [
  ['wrong field',s=>{s.nodes[0].componentType='WRONG';},'WORKER_SOURCE_VALUE_DRIFT'],
  ['negative number rewritten',s=>{s.nodes.find(n=>n.nodeNumber==='-1').nodeNumber='0';},'WORKER_NODE_NUMBER_DRIFT'],
  ['offset number changed',s=>{s.nodes.find(n=>Number(n.nodeNumber)>0).nodeNumber='999';},'WORKER_NODE_NUMBER_DRIFT'],
  ['missing node',s=>{s.nodes.pop();s.nodeCount=s.nodes.length;},'INCOMPLETE_SELECTED_POPULATION'],
 ]) {
  const input=await fixture();
  const session=await startAttestedModeBPreviewWorkerSession({
   ...input,requestId:label,createController:withExecutor(spec=>fakeExecute(spec,alter)),
  });
  await assert.rejects(session.promise,{code});
 }
});
test('cancelled generation cannot release Mode B source facts as a completed result',async()=>{
 const input=await fixture();
 const pending=spec=>({promise:new Promise(()=>{}),release(){}});
 const session=await startAttestedModeBPreviewWorkerSession({
  ...input,requestId:'cancel',createController:withExecutor(pending),
 });
 assert.equal(session.cancel(),true);
 await assert.rejects(session.promise,{code:'CANCELLED'});
});
test('source and docs ports are exact deployed mirrors',async()=>{
 for(const leaf of ['xml-cii-adapted-preview-facts-modeb-source-pages.js',
   'xml-cii-adapted-preview-facts-modeb-session.js']){
  const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+leaf,import.meta.url),'utf8');
  const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+leaf,import.meta.url),'utf8');
  assert.equal(a,b);
 }
});
