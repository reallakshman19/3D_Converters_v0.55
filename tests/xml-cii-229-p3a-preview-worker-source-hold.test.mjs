import test from 'node:test';
import assert from 'node:assert/strict';
import {xml229PreviewSourceGate} from '../tabs/xml-cii-2019-standalone/integration/xml229-preview-source-gate.mjs';
import {xmlCiiBuildAndRenderPreview} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer-v7.js';
import {XML_CII_PREVIEW_CACHE_KEY,XML_CII_PREVIEW_LEGACY_CACHE_KEY} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-cache-v7.js';

const sha='6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288';
const receipt=Object.freeze({schema:'XML229.OriginalStagedSourceReceipt.v1',
  rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,
  generationId:'g1',sourceRefId:'source1',
  sourceRevision:'g1:sha256:'+sha,phase:'INDEX_COMMITTED',
  byteLength:733806,sha256:sha,occurrenceCount:23754,pageCount:47});
function fakeDom() {
  const host={dataset:{},innerHTML:'<table>STALE_CACHE</table>',rendered:[],
    querySelector(){return null;}, replaceChildren(){this.innerHTML='';this.rendered=[];},
    insertAdjacentHTML(_where,html){this.rendered.push(html);}};
  const card={querySelector(sel){return sel==='#mc-preview-table-host'?host:null;}};
  return {host,card};
}
const oldStorage=globalThis.localStorage;
class Storage {
  constructor(){this.map=new Map();}
  setItem(k,v){this.map.set(k,String(v));}
  getItem(k){return this.map.get(k)??null;}
  removeItem(k){this.map.delete(k);}
}
const memory=new Storage();

test('P3A good committed Worker SHA with no data port is JSON_SOURCE_PENDING, not source-0B cache MISS',()=>{
  const gate=xml229PreviewSourceGate({sourceReceipt:receipt,stagedJsonText:''});
  assert.equal(gate.blocked,true);assert.equal(gate.reason,'ORIGINAL_JSON_INDEXED_NO_PREVIEW_READ_PORT');
  assert.equal(gate.sourceBytes,733806);assert.equal(gate.sourceSha256,sha);
  assert.equal(gate.hasUnverifiedLegacyText,false);
});
test('P3A prior staged JSON text cannot be substituted for a different current Worker File',()=>{
  const gate=xml229PreviewSourceGate({sourceReceipt:receipt,stagedJsonText:'{"stale":true}'});
  assert.equal(gate.blocked,true);assert.equal(gate.hasUnverifiedLegacyText,true);
});
test('P3A pending, revoked, failed and malformed source receipts all refuse cache/build',()=>{
  for(const r of [{...receipt,phase:'SELECTED',sha256:null},{...receipt,phase:'INDEXING',sha256:null},
    {...receipt,phase:'COMMIT_PENDING',sha256:null},{...receipt,phase:'REVOKED'},
    {...receipt,phase:'FAILED',sha256:null},{...receipt,schema:'WRONG'},
    {...receipt,engineeringReady:true}]) {
    assert.equal(xml229PreviewSourceGate({sourceReceipt:r,stagedJsonText:''}).blocked,true);
  }
  assert.equal(xml229PreviewSourceGate({sourceStatus:'FAILED'}).blocked,true);
});
test('P3A actual V7 wrapper shortcircuits BEFORE legacy cache build and invalidates legacy rating bridge',async()=>{
  globalThis.localStorage=memory;
  try{
    const {host,card}=fakeDom();
    memory.setItem(XML_CII_PREVIEW_LEGACY_CACHE_KEY,
      JSON.stringify({fp:'old',data:{branchRows:[{branchName:'OLD',rating:'900'}]}}));
    memory.setItem(XML_CII_PREVIEW_CACHE_KEY,JSON.stringify({authority:{digest:'sha256:old'}}));
    const result=await xmlCiiBuildAndRenderPreview(card,'<Plant/>',{},{
      originalStagedSourceReceipt:receipt,stagedJsonText:'',
    });
    assert.equal(result.blocked,true);assert.equal(result.reason,'ORIGINAL_JSON_INDEXED_NO_PREVIEW_READ_PORT');
    assert.deepEqual(result.branchRows,[]);
    assert.equal(host.dataset.mcPreviewCacheStatus,'JSON_SOURCE_PENDING');
    assert.equal(host.dataset.mcPreviewCacheDigest,'');
    assert.equal(memory.getItem(XML_CII_PREVIEW_LEGACY_CACHE_KEY),null);
    assert.ok(memory.getItem(XML_CII_PREVIEW_CACHE_KEY),'old envelope retained but never restored or promoted');
    assert.ok(host.rendered.some(x=>x.includes('733806 B')&&x.includes(sha)));
    assert.ok(!host.rendered.some(x=>x.includes('staged JSON 0 B')));
    assert.ok(!host.innerHTML.includes('STALE_CACHE'));
  }finally{
    if(oldStorage===undefined) delete globalThis.localStorage;
    else globalThis.localStorage=oldStorage;
  }
});
test('P3A ordinary XML-only and existing real legacy JSON text remain eligible for existing renderer',()=>{
  assert.equal(xml229PreviewSourceGate({stagedJsonText:''}).blocked,false);
  assert.equal(xml229PreviewSourceGate({stagedJsonText:'{"current":true}'}).blocked,false);
});
