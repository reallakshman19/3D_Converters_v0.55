/**
 * O1 standalone XML/JSON resolver domain Worker. Reuses the existing domain
 * ledger and original CSV exporters; NEVER runs JSON.parse or trace rendering
 * on the main thread. No source-only LFJ receipt is an engineering approval.
 *
 * Input authority: caller must prove a committed native R05 root OPEN+SEAL
 * pair from the same original Blob, SHA, revision and job before RUN.
 * The application owns active job/selection cancellation.
 */
import {runStandaloneResolverJsonTrace} from '../xml-cii-resolver-json-trace.js';
import {
  buildXmlNodeWiseTraceRows,buildEvidenceTreeRows,
  buildXmlNodeWiseTraceCsv,buildEvidenceTreeCsv
} from '../xml-cii-trace-export.js';

const SCHEMA='LFJ.O1.DomainWorker.v1';
let active=null;
const send=(kind,job,payload={})=>postMessage({schema:SCHEMA,kind,jobId:job,...payload});
function fail(job,e){send('FAILED',job,{code:String(e?.code||e?.message||'DOMAIN_FAILURE').slice(0,120)});}
function same(m){return active&&m.jobId===active.jobId&&
 m.sourceRefId===active.ref&&m.sourceSha256===active.sha&&
 m.sourceRevision===active.revision;}
const valid=s=>typeof s==='string'&&s.length>0&&s.length<=1024;
async function run(m){
 const id=m.jobId;
 if(active)throw Object.assign(new Error('job already active'),{code:'DOMAIN_BUSY'});
 if(!valid(id)||!valid(m.sourceRefId)||!/^[a-f0-9]{64}$/.test(m.sourceSha256||'')||
   !valid(m.sourceRevision)||!valid(m.selectionDigest)||
   !(m.jsonBlob instanceof Blob)||!Number.isSafeInteger(m.byteLength)||
   m.jsonBlob.size!==m.byteLength||!m.committedRoot||
   m.committedRoot.startByte<0||
   m.committedRoot.endByteExclusive>m.byteLength||
   m.committedRoot.endByteExclusive<=m.committedRoot.startByte||
   typeof m.sourceText!=='string'||!m.sourceText.trim())
   throw Object.assign(new Error('original source/index/XML basis required'),{code:'DOMAIN_BASIS'});
 active={jobId:id,ref:m.sourceRefId,sha:m.sourceSha256,revision:m.sourceRevision,
   selectionDigest:m.selectionDigest,rows:null,result:null,exports:new Map(),nonce:0};
 send('RUNNING',id,{phase:'EXACT_SOURCE_DOMAIN'});
 // Reads and parses only inside this independent Worker, never in UI.
 const json=await m.jsonBlob.text();
 const result=runStandaloneResolverJsonTrace({
   sourceText:m.sourceText,stagedJsonText:json,sourceKind:m.sourceKind,
   supportConfigJson:m.supportConfigJson||'{}',jsonConfig:m.jsonConfig||{},
   jsonTraceScopeId:m.jsonTraceScopeId||''
 });
 // Keep complete existing semantic data in Worker; expose only bounded pages.
 active.result=result;
 active.rows={
   node:buildXmlNodeWiseTraceRows(result),
   evidence:buildEvidenceTreeRows(result)
 };
 active.paths=[...new Set([
   ...(result.resolutionLedger||[]).filter(r=>String(r.status).startsWith('RESOLVED_'))
     .flatMap(r=>r.sourcePaths||[]),
   ...active.rows.evidence.map(row=>row.sourcePath)
 ].filter(Boolean))];
 send('READY',id,{
   sourceRefId:active.ref,sourceSha256:active.sha,sourceRevision:active.revision,
   byteLength:m.byteLength,selectionDigest:active.selectionDigest,
   counts:{node:active.rows.node.length,evidence:active.rows.evidence.length,
     matched:result.matchedFacts?.length||0,rejected:result.rejectedFacts?.length||0,
     paths:active.paths.length},
   // Source-attested source-only index does not bless domain values for output.
   rightsBasis:'SOURCE_MATCH_PENDING_ORACLE',engineeringReady:false
 });
}
function page(m){
 if(!same(m)||!active?.rows)return fail(m.jobId,{code:'DOMAIN_NOT_READY'});
 const type=m.type==='evidence'?'evidence':'node';
 const start=m.start;
 if(!Number.isSafeInteger(start)||start<0)return fail(m.jobId,{code:'DOMAIN_PAGE_START'});
 const limit=64;
 send('PAGE',m.jobId,{type,start,rows:active.rows[type].slice(start,start+limit),
   total:active.rows[type].length});
}
function exportCsv(m){
 if(!same(m)||!active?.result)return fail(m.jobId,{code:'DOMAIN_NOT_READY'});
 const type=m.type==='evidence'?'evidence':'node';
 const rows=active.rows[type];
 if(!rows.length)return fail(m.jobId,{code:'DOMAIN_EMPTY_EXPORT'});
 const csv=type==='evidence'?buildEvidenceTreeCsv(active.result):buildXmlNodeWiseTraceCsv(active.result);
 const bytes=new TextEncoder().encode(csv);
 const token=++active.nonce;
 const stream={token,type,bytes,offset:0};
 active.exports.clear();active.exports.set(token,stream);
 send('EXPORT_BEGIN',m.jobId,{token,type,bytes:bytes.byteLength,rows:rows.length});
 chunk(stream);
}
function chunk(stream){
 if(!active||active.exports.get(stream.token)!==stream)return;
 if(stream.offset===stream.bytes.length){
   send('EXPORT_END',active.jobId,{token:stream.token,type:stream.type});
   active.exports.delete(stream.token);return;
 }
 const next=Math.min(stream.bytes.length,stream.offset+65536);
 const data=stream.bytes.slice(stream.offset,next);
 stream.offset=next;
 postMessage({schema:SCHEMA,kind:'EXPORT_CHUNK',jobId:active.jobId,
   token:stream.token,type:stream.type,bytes:data},[data.buffer]);
}
onmessage=async({data:m})=>{
 if(m?.schema!==SCHEMA)return;
 try{
   if(m.kind==='CANCEL'){active=null;close();return;}
   if(m.kind==='RUN'){await run(m);return;}
   if(m.kind==='PAGE'){page(m);return;}
   if(m.kind==='PATH_PAGE'&&same(m)){
     const start=m.start;
     if(!Number.isSafeInteger(start)||start<0)throw Object.assign(
       new Error('bad path cursor'),{code:'DOMAIN_PATH_CURSOR'});
     send('PATH_PAGE',m.jobId,{start,paths:active.paths.slice(start,start+128),
       total:active.paths.length});return;
   }
   if(m.kind==='EXPORT'){exportCsv(m);return;}
   if(m.kind==='EXPORT_ACK'&&same(m)){
     const stream=active.exports.get(m.token);
     if(stream)chunk(stream);
   }
 }catch(e){fail(m.jobId,e);active=null;}
};
