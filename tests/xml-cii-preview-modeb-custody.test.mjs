import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {combineXmlWithNodeOffsets} from '../converters/xml-cii2019-core/xml-node-offset-combine.js';
import {assertBasisDigest,assertContentDigest,digestUtf8,digestCanonical,canonicalJson,makeBasisRef}
  from '../contracts/gc-pw-v1/contract.mjs';
import {attestXmlCiiModeBSourceCustody} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-modeb-custody.js';
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
installWeightBasisXmlDom(globalThis);
// The worker-side lightweight DOM shim intentionally omits native '*' wildcard
// traversal. Restore that browser API in this TEST runtime only, so the existing
// production Mode B combiner sees every NodeNumber (including positive IDs).
const elementPrototype=Object.getPrototypeOf(new DOMParser()
  .parseFromString('<Root><Leaf/></Root>','application/xml').documentElement);
const baseGetElements=elementPrototype.getElementsByTagName;
elementPrototype.getElementsByTagName=function(tag){
  if(tag!=='*')return baseGetElements.call(this,tag);
  const out=[];
  const visit=node=>{for(const child of node.childNodes||[]){
    if(child.nodeType===1){out.push(child);visit(child);}
  }};
  visit(this);
  return out;
};
// Native Document.importNode() is required by the real Mode B combiner.
// Add it only to the Node test shim; browser uses native implementation.
const documentPrototype=Object.getPrototypeOf(new DOMParser()
  .parseFromString('<Root/>','application/xml'));
documentPrototype.importNode=function(node,deep=false){ return node.cloneNode(Boolean(deep)); };
const ports={assertBasisDigest,assertContentDigest,digestCanonical,canonicalJson};
const outer=pipe=>`<PipeStressExport xmlns="urn:psi116"><Units>mm</Units>
 <AmbientTemperature>20</AmbientTemperature>${pipe}<Source>PSI</Source></PipeStressExport>`;
const n=(id,component='PIPE')=>`<Node><NodeNumber>${id}</NodeNumber><ComponentType>${component}</ComponentType>
<ComponentRefNo>R</ComponentRefNo><Endpoint>1</Endpoint></Node>`;
const pipe=(name,nodes)=>`<Pipe><Branch><Branchname>${name}</Branchname>${nodes.join('')}</Branch></Pipe>`;
const src=[
 {sourceId:'PL01',fileName:'PL-01.xml',
  xmlText:outer(pipe('/DUPLICATE/B1',[n(100),n(-1),n(-1)]))},
 {sourceId:'PL06',fileName:'PL-06.xml',
  xmlText:outer(pipe('/DUPLICATE/B1',[n(100),n(-1),n(200,'VALV')]))},
];
async function fixture(overrides={}){
 const originalSources=structuredClone(overrides.originalSources||src);
 const combined=combineXmlWithNodeOffsets(originalSources,{offsetStep:100000});
 const manifest=overrides.manifest||combined.manifest;
 const config=overrides.config||{modeBManifest:manifest,processDefaults:{rating:'NO_DEFAULT'}};
 const combinedSource=overrides.combinedSource||{sourceId:'MODE-B-COMBINED',xmlText:combined.xmlText};
 const refSources=[...originalSources,combinedSource];
 const basis=await makeBasisRef({
  domainId:'xml-cii/2019',
  sourceRefs:await Promise.all(refSources.map(async x=>({
   sourceId:x.sourceId,mediaType:'application/xml',sha256:await digestUtf8(x.xmlText),
  }))),
  selectionSha256:await digestCanonical(['PL01','PL06']),
  stagedSourceSha256:null,
  masters:{},
  configSha256:await digestCanonical(config),
  overridesSha256:await digestCanonical({}),
  scope:[{sourceId:'PL01',selectionRef:'ALL'},{sourceId:'PL06',selectionRef:'ALL'}],
 });
 return {basis,config,originalSources,combinedSource,manifest,ports};
}
test('real Mode B offset combine is checked independently and preserves repeated -1, source ordinals',async()=>{
 const f=await fixture(),r=await attestXmlCiiModeBSourceCustody(f);
 assert.equal(r.engineeringAccepted,false);
 assert.equal(r.branchCount,2);assert.equal(r.nodeCount,6);
 assert.equal(r.occurrenceIds.length,8);
 assert.equal(new Set(r.occurrenceIds).size,8);
 assert.deepEqual(r.sourceTotals.map(x=>[x.sourceId,x.branchCount,x.nodeCount,x.offset]),
  [['PL01',1,3,0],['PL06',1,3,100000]]);
 assert.equal(r.manifestSha256,await digestCanonical(f.manifest));
 assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.occurrenceIds));
});
test('same-length original engineering field change violates content custody',async()=>{
 const f=await fixture();
 f.originalSources[1].xmlText=f.originalSources[1].xmlText.replace('<ComponentType>VALV','<ComponentType>PIPE');
 assert.equal(f.originalSources[1].xmlText.length,src[1].xmlText.length);
 await assert.rejects(attestXmlCiiModeBSourceCustody(f),{code:'CONTENT_DIGEST_MISMATCH'});
});
test('swapping equal-count Mode B pipes is rejected despite identical counts',async()=>{
 const f=await fixture();
 const swapped=outer(pipe('/DUPLICATE/B1',[n(100000+100),n(-1),n(100000+200,'VALV')])
  +pipe('/DUPLICATE/B1',[n(100),n(-1),n(-1)]));
 // Deliberately bind the tampered combined bytes, so success cannot rely on hash mismatch.
 const config=f.config;
 f.combinedSource={sourceId:'MODE-B-COMBINED',xmlText:swapped};
 f.basis=await makeBasisRef({...f.basis,basisId:undefined,
  sourceRefs:await Promise.all([...src,f.combinedSource].map(async x=>({
   sourceId:x.sourceId,mediaType:'application/xml',sha256:await digestUtf8(x.xmlText),
  }))),configSha256:await digestCanonical(config)});
 await assert.rejects(attestXmlCiiModeBSourceCustody(f),{code:'MODE_B_VALUE_DRIFT'});
});
test('changed combined node with identical byte length rejects even with recomputed outer basis',async()=>{
 const f=await fixture();
 const altered=f.combinedSource.xmlText.replace('<ComponentType>VALV','<ComponentType>PIPE');
 assert.equal(altered.length,f.combinedSource.xmlText.length);
 f.combinedSource={...f.combinedSource,xmlText:altered};
 f.basis=await makeBasisRef({...f.basis,basisId:undefined,
  sourceRefs:await Promise.all([...src,f.combinedSource].map(async x=>({
   sourceId:x.sourceId,mediaType:'application/xml',sha256:await digestUtf8(x.xmlText),
  })))});
 await assert.rejects(attestXmlCiiModeBSourceCustody(f),{code:'MODE_B_VALUE_DRIFT'});
});
test('wrong Mode B source order, offset map and duplicate source ID all fail closed',async()=>{
 const f=await fixture();
 const stale=structuredClone(f.manifest);stale.sourceOrder[1].offset=300000;
 await assert.rejects(attestXmlCiiModeBSourceCustody({...f,manifest:stale}),
  {code:'MANIFEST_CONFIG_DRIFT'});
 const config={...f.config,modeBManifest:stale};
 const basis=await makeBasisRef({...f.basis,basisId:undefined,
   configSha256:await digestCanonical(config)});
 await assert.rejects(attestXmlCiiModeBSourceCustody({...f,basis,config,manifest:stale}),
  {code:'OFFSET_MANIFEST_DRIFT'});
 const duplicate=structuredClone(f.originalSources);duplicate[1].sourceId='PL01';
 // Basis still selects PL06; swapped raw source IDs fail earlier at scope gate.
 await assert.rejects(attestXmlCiiModeBSourceCustody({...f,originalSources:duplicate}),
  {code:'SOURCE_SCOPE_MISMATCH'});
});
test('source count, missing original, wrong config SHA and altered root are rejected',async()=>{
 const f=await fixture();
 await assert.rejects(attestXmlCiiModeBSourceCustody({...f,originalSources:f.originalSources.slice(0,1)}),
  {code:'ORIGINAL_SOURCES_REQUIRED'});
 const changedConfig={...f.config,processDefaults:{rating:'900'}};
 await assert.rejects(attestXmlCiiModeBSourceCustody({...f,config:changedConfig}),
  {code:'CONFIG_BASIS_DRIFT'});
 const changedRoot=f.combinedSource.xmlText.replace('<Source>PSI</Source>','<Source>BAD</Source>');
 const altered={...f.combinedSource,xmlText:changedRoot};
 const changedBasis=await makeBasisRef({...f.basis,basisId:undefined,
   sourceRefs:await Promise.all([...src,altered].map(async x=>({
    sourceId:x.sourceId,mediaType:'application/xml',sha256:await digestUtf8(x.xmlText),
   })))});
 await assert.rejects(attestXmlCiiModeBSourceCustody({...f,combinedSource:altered,basis:changedBasis}),
  {code:'MODE_B_VALUE_DRIFT'});
});
test('original-source selection and ordered basis source refs cannot silently drift',async()=>{
 const f=await fixture();
 const limited=await makeBasisRef({...f.basis,basisId:undefined,
  scope:[{sourceId:'PL01',selectionRef:'ALL'}]});
 await assert.rejects(attestXmlCiiModeBSourceCustody({...f,basis:limited}),
  {code:'SOURCE_SCOPE_MISMATCH'});
 const swapped=await makeBasisRef({...f.basis,basisId:undefined,
  sourceRefs:[f.basis.sourceRefs[1],f.basis.sourceRefs[0],f.basis.sourceRefs[2]]});
 await assert.rejects(attestXmlCiiModeBSourceCustody({...f,basis:swapped}),
  {code:'BASIS_SOURCE_ORDER_DRIFT'});
});
test('source/docs deployed Mode B attestor are byte-identical',async()=>{
 const path='xml-cii-adapted-preview-facts-modeb-custody.js';
 const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+path,import.meta.url),'utf8');
 const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+path,import.meta.url),'utf8');
 assert.equal(a,b);
});
