/** O1 source-SHA-fenced hierarchy options. No foreground JSON parsing.
 * Non-contiguous subsets are excluded until original pointer remapping exists.
 */
import {buildJsonHierarchyScopeIndex} from '../xml-cii-json-hierarchy-scope.js';
const MAX=16*1024*1024;
self.onmessage=async({data:m})=>{
 const reply={schema:'LFJ.O1.HierarchyScopes.v1',kind:'SCOPE_RESULT',
  jobId:m?.jobId,sourceRefId:m?.sourceRefId,sourceSha256:m?.sourceSha256,
  sourceRevision:m?.sourceRevision};
 try{
  if(m?.schema!==reply.schema||m.kind!=='DISCOVER'||!m.jobId||!m.sourceRefId||
    !m.sourceRevision||!/^[a-f0-9]{64}$/.test(m.sourceSha256||'')||
    !(m.blob instanceof Blob))throw Error('O1_SCOPE_SOURCE_INVALID');
  if(m.blob.size>MAX)throw Error('O1_SCOPE_READ_MODEL_LIMIT');
  const bytes=await m.blob.arrayBuffer();
  const sum=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const sha=[...sum].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(sha!==m.sourceSha256)throw Error('O1_SCOPE_SOURCE_SHA_MISMATCH');
  const idx=buildJsonHierarchyScopeIndex(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  // Current materializer compacts selections, so only 1:1 whole-root-array
  // scopes retain original occurrence paths. Never approve partial pointers.
  const safe=idx.strategy==='root-array'&&idx.indexable&&idx.itemCount>0&&
    idx.itemCount<=2000000&&idx.scopes.length<=64&&
    idx.scopes.every(s=>s.id.length<=256)
      ?idx.scopes.filter(s=>s.itemCount===idx.itemCount):[];
  const scopes=safe.map(s=>({id:s.id,label:s.label,
    itemCount:s.itemCount,byteLength:s.byteLength}));
  self.postMessage({...reply,indexable:scopes.length>0,
    itemCount:idx.itemCount,scopes,byteLength:m.blob.size,
    strategy:idx.strategy,defaultScopeId:'__ALL__',
    reason:scopes.length?'':'O1_SCOPE_ORIGINAL_POINTER_REMAP_NOT_PROVEN'});
 }catch(e){self.postMessage({...reply,indexable:false,
   itemCount:0,scopes:[],byteLength:m?.blob?.size||0,
   defaultScopeId:'__ALL__',reason:String(e?.message||'O1_SCOPE_FAILED')});}
 self.close();
};
