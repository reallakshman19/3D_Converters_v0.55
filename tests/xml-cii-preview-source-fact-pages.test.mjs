import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {projectXmlCiiOccurrences} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {createPreviewButtonBasis} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-button-session.js';
import {independentOriginalXmlCensus,openActualPreviewSourceFactPages} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-browser-read.js';
import {assertCompletePopulation} from '../contracts/gc-pw-v1/contract.mjs';
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
installWeightBasisXmlDom(globalThis);
const sourceId='SYS001-public';
const fixture=async()=>readFile(new URL('../Benchmarks/XML-CII-2019/SYS-001_Single.xml',import.meta.url),'utf8');
const setup=async()=>{
  const xmlText=await fixture();
  const basis=await createPreviewButtonBasis({xmlText,sourceId,stagedJsonText:'',config:{
    linelist:{masterRows:[]},pipingClass:{masterRows:[]},material:{mapRows:[]},
    weight:{masterRows:[]},overrides:{},
  }});
  const sourceOccurrences=projectXmlCiiOccurrences({xmlText,mode:'A',sourceId});
  return {xmlText,basis,sourceOccurrences};
};
test('raw XML census is independent of produced source occurrences',async()=>{
  const {xmlText,sourceOccurrences}=await setup();
  const expected=independentOriginalXmlCensus({xmlText,sourceId});
  assert.equal(expected.length,550);
  assert.equal(expected.filter(x=>x.subjectType==='node').length,541);
  assert.deepEqual(new Set(expected.map(x=>x.occurrenceId)),
    new Set([...sourceOccurrences.branches,...sourceOccurrences.nodes].map(x=>x.occurrenceId)));
});
test('every original branch/node is accounted for through complete *source-only* pagination',async()=>{
  const {basis,xmlText,sourceOccurrences}=await setup();
  const opened=await openActualPreviewSourceFactPages({basis,xmlText,sourceId,sourceOccurrences});
  assert.equal(opened.branchCount,9);
  assert.equal(opened.nodeCount,541);
  const model=opened.model;
  assert.equal(model.info.engineeringReady,false);
  assert.equal(model.info.expectedOccurrenceCount,550);
  assert.equal(model.info.totalFactCount,2723);
  let cursor=null;
  const pages=[];
  do{
    const page=await model.getFacts({basisId:basis.basisId,cursor,limit:200});
    assert.equal(page.complete,false);
    pages.push(page);cursor=page.nextCursor;
  }while(cursor);
  assert.equal(pages.flatMap(x=>x.items).length,2723);
  assert.throws(()=>assertCompletePopulation(pages,basis.basisId,
    x=>x.sourceId+':'+x.occurrenceId+':'+x.fieldId,2723),{code:'INCOMPLETE_BASIS'});
});
test('missing source node cannot be hidden by a page limit',async()=>{
  const {basis,xmlText,sourceOccurrences}=await setup();
  const corrupted={...sourceOccurrences,nodes:sourceOccurrences.nodes.slice(1),
    nodeCount:sourceOccurrences.nodeCount-1};
  await assert.rejects(openActualPreviewSourceFactPages({
    basis,xmlText,sourceId,sourceOccurrences:corrupted}),{code:'INCOMPLETE_SELECTED_POPULATION'});
});
test('changed source with unchanged byte length and stale basis are rejected',async()=>{
  const {basis,xmlText,sourceOccurrences}=await setup();
  const changed=xmlText.replace('/ASIM-1836','/ASIM-1837');
  assert.equal(changed.length,xmlText.length);
  await assert.rejects(openActualPreviewSourceFactPages({
    basis,xmlText:changed,sourceId,sourceOccurrences}),{code:'CONTENT_DIGEST_MISMATCH'});
});
test('Mode B cannot be certified from one concatenated XML without raw original basis',async()=>{
  const {xmlText}=await setup();
  assert.throws(()=>independentOriginalXmlCensus({xmlText,sourceId,mode:'B'}),
    {code:'MODE_B_INDEPENDENT_ORACLE_REQUIRED'});
});
test('source pages and session modules exactly match deployed docs',async()=>{
  for(const name of ['xml-cii-adapted-preview-facts-browser-read.js',
    'xml-cii-adapted-preview-facts-button-session.js']){
    const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+name,import.meta.url),'utf8');
    const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+name,import.meta.url),'utf8');
    assert.equal(a,b,name);
  }
});
