import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {combineXmlWithNodeOffsets} from '../converters/xml-cii2019-core/xml-node-offset-combine.js';
import {assertBasisDigest,assertContentDigest,digestUtf8,digestCanonical,canonicalJson}
 from '../contracts/gc-pw-v1/contract.mjs';
import {prepareModeBPreviewBasis,assertModeBPreviewBasisFresh} from
 '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-modeb-basis.js';
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
installWeightBasisXmlDom(globalThis);
// TEST shim only: native browser getElementsByTagName('*') returns all elements.
const proto=Object.getPrototypeOf(new DOMParser().parseFromString('<R/>','application/xml').documentElement);
const old=proto.getElementsByTagName;
proto.getElementsByTagName=function(tag){
 if(tag!=='*')return old.call(this,tag);
 const out=[];const visit=n=>{for(const x of n.childNodes||[])if(x.nodeType===1){
  out.push(x);visit(x);
 }};visit(this);return out;
};
const documentPrototype=Object.getPrototypeOf(new DOMParser().parseFromString('<R/>','application/xml'));
// Browser-native DOM importNode is only missing from the Node test shim.
documentPrototype.importNode=function(node,deep=false){return node.cloneNode(Boolean(deep));};
const ports={digestUtf8,digestCanonical,canonicalJson,assertBasisDigest,assertContentDigest};
const xml=(pipe)=>'<PipeStressExport><Units>mm</Units>'+pipe+'</PipeStressExport>';
const pipe=(type)=>'<Pipe><Branch><Branchname>/REPEATED</Branchname>'
  +'<Node><NodeNumber>100</NodeNumber><ComponentType>'+type+'</ComponentType></Node>'
  +'<Node><NodeNumber>-1</NodeNumber><ComponentType>GASK</ComponentType></Node>'
  +'</Branch></Pipe>';
async function setup(){
 const originalSources=[
  {sourceId:'PL01',fileName:'PL01.xml',xmlText:xml(pipe('PIPE'))},
  {sourceId:'PL06',fileName:'PL06.xml',xmlText:xml(pipe('VALV'))},
 ];
 const {xmlText,manifest}=combineXmlWithNodeOffsets(originalSources);
 const combinedSource={sourceId:'COMBINED',xmlText};
 const config={
  modeBManifest:manifest,
  linelist:{masterRows:[{line:'PL01',pipingClass:'P01'}],fieldMap:{pipingClass:'pipingClass'}},
  pipingClass:{masterRows:[{pipingClass:'P01',rating:'150'}]},
  material:{mapRows:[{material:'A106',code:'001'}]},
  weight:{masterRows:[{component:'VALV',weight:10}]},
  overrides:{rating:{P01:'150'}},
 };
 return {originalSources,combinedSource,manifest,config,stagedJsonText:'{"stage":1}',ports};
}
const clone=x=>({...structuredClone({...x,ports:undefined}),ports});
test('real combined XML + original files produce full immutable basis and source-local attestation',async()=>{
 const input=await setup();
 const result=await prepareModeBPreviewBasis(input);
 await assertBasisDigest(result.basis);
 assert.deepEqual(result.basis.sourceRefs.map(x=>x.sourceId),['PL01','PL06','COMBINED']);
 assert.deepEqual(result.basis.scope.map(x=>x.sourceId),['PL01','PL06']);
 assert.deepEqual(result.custody.sourceTotals.map(x=>[x.branchCount,x.nodeCount]),[[1,2],[1,2]]);
 assert.equal(result.scope.mode,'B');
 assert.equal(result.scope.sourceId,'COMBINED');
 assert.equal(result.engineeringReady,false);
 assert.equal(result.custody.engineeringAccepted,false);
 assert.ok(Object.isFrozen(result.scope.manifest.sourceOrder[0]));
 assert.equal(await assertModeBPreviewBasisFresh(result,input),true);
});
test('changed original XML with same byte length fails closed',async()=>{
 const input=await setup(),snap=await prepareModeBPreviewBasis(input);
 const changed=clone(input);
 changed.originalSources[1].xmlText=changed.originalSources[1].xmlText.replace('VALV','PIPE');
 assert.equal(changed.originalSources[1].xmlText.length,input.originalSources[1].xmlText.length);
 await assert.rejects(assertModeBPreviewBasisFresh(snap,changed),
   {code:'MODE_B_VALUE_DRIFT'});
});
test('changed one master engineering value without row count change invalidates source-bound basis',async()=>{
 const input=await setup(),snap=await prepareModeBPreviewBasis(input);
 const altered=clone(input);
 altered.config.pipingClass.masterRows[0].rating='900';
 await assert.rejects(assertModeBPreviewBasisFresh(snap,altered),{code:'STALE_MODE_B_INPUT'});
 const sameRows=await prepareModeBPreviewBasis(altered);
 assert.notEqual(snap.basis.basisId,sameRows.basis.basisId);
 assert.equal(sameRows.basis.masters.pipingClass.rowCount,1);
});
test('updated manual override and same-length staged JSON fail freshness check',async()=>{
 const input=await setup(),snap=await prepareModeBPreviewBasis(input);
 const manual=clone(input);manual.config.overrides.rating.P01='900';
 await assert.rejects(assertModeBPreviewBasisFresh(snap,manual),{code:'STALE_MODE_B_INPUT'});
 const staged=clone(input);staged.stagedJsonText='{"stage":2}';
 assert.equal(staged.stagedJsonText.length,input.stagedJsonText.length);
 await assert.rejects(assertModeBPreviewBasisFresh(snap,staged),{code:'STALE_MODE_B_INPUT'});
});
test('tampered source order/config and missing original never accepted',async()=>{
 const input=await setup();
 const swapped=clone(input);
 swapped.originalSources.reverse();
 await assert.rejects(prepareModeBPreviewBasis(swapped),{code:'SOURCE_ORDER_DRIFT'});
 const config=clone(input);
 config.config.modeBManifest=structuredClone(config.manifest);
 config.config.modeBManifest.sourceOrder[0].offset=100000;
 await assert.rejects(prepareModeBPreviewBasis(config),{code:'MANIFEST_CONFIG_DRIFT'});
 const missing=clone(input);missing.originalSources.pop();
 await assert.rejects(prepareModeBPreviewBasis(missing),{code:'ORIGINAL_SOURCES_REQUIRED'});
 const alias=clone(input);alias.combinedSource.sourceId='PL01';
 await assert.rejects(prepareModeBPreviewBasis(alias),{code:'DUPLICATE_SOURCE_ID'});
});
test('runtime transport manifest is detached from mutable caller manifest',async()=>{
 const input=await setup(),out=await prepareModeBPreviewBasis(input);
 const oldOffset=out.scope.manifest.sourceOrder[1].offset;
 input.manifest.sourceOrder[1].offset=oldOffset+100000;
 assert.equal(out.scope.manifest.sourceOrder[1].offset,oldOffset);
 assert.throws(()=>{out.scope.manifest.sourceOrder[1].offset=42;},TypeError);
 await assert.rejects(assertModeBPreviewBasisFresh(out,input),{code:'OFFSET_MANIFEST_DRIFT'});
});
test('Mode B preflight has identical deployed source/docs bytes',async()=>{
 const name='xml-cii-adapted-preview-facts-modeb-basis.js';
 const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+name,import.meta.url),'utf8');
 const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+name,import.meta.url),'utf8');
 assert.equal(a,b);
});
