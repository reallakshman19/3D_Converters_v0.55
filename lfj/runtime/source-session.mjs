/**
 * #1105/P01 U01: neutral original-value read session over genuine R10 Worker admission.
 *
 * The caller supplies a *qualified committed* source occurrence-pair lookup port.
 * A source-index store exposing only R08's OPEN readOrdered() is insufficient:
 * never invent SEAL offsets, build a whole-index Map, or parse the source anew.
 * Production IndexedDB pair lookup and canonical served-browser gates are P01 U02/U03.
 */
import {runCommittedSourceQuery} from '../ports/committed-worker-query.mjs';

export class SourceSessionError extends Error {
  constructor(code,detail){super(code+': '+detail);this.name='SourceSessionError';this.code=code;}
}
const fail=(code,detail)=>{throw new SourceSessionError(code,detail);};
const valid=s=>typeof s==='string'&&s.length>0&&s.length<=1024;
const natural=n=>Number.isSafeInteger(n)&&n>=0;
const MAX_VALUE_BYTES=1048576;
const TYPES=new Set(['object','array','string','number','boolean','null']);

/**
 * Real caller Blob/File remains owned by this explicit session even after the
 * R10 scan has closed ITS own temporary R03 snapshot. Not a clone or parsed DOM.
 */
export async function openSourceSession(options={}){
  const {blob,sourceRefId,revision,jobId,selectionDigest,indexStore,
    getCurrentBasis}=options;
  if(!blob||typeof blob.slice!=='function'||!natural(blob.size)||
      !valid(sourceRefId)||!valid(revision)||!valid(jobId)||
      !valid(selectionDigest)||typeof getCurrentBasis!=='function'||
      typeof indexStore?.lookupCommittedPair!=='function')
    fail('SOURCE_SESSION_PORT_REQUIRED',
      'File/Blob and independently committed OPEN+SEAL pair lookup port required');
  // Freeze the original dependency/selection/job BEFORE any awaited Worker or
  // IndexedDB call. Capturing it only after R10 returns would bless mid-scan
  // dependency supersession as the new (incorrect) initial basis.
  let requested;
  try{requested=getCurrentBasis();}catch{
    fail('SOURCE_STALE','pre-admission source basis cannot be attested');
  }
  if(!requested||requested.sourceRefId!==sourceRefId||
    requested.selectionDigest!==selectionDigest||requested.jobId!==jobId||
    requested.byteLength!==blob.size||
    (options.expectedSha256!==undefined&&
      requested.sourceSha256!==options.expectedSha256))
    fail('SOURCE_STALE','original source or selection changed before Worker admission');
  const initial=Object.freeze({...requested});
  // R10 is an accepted source-only port; it does not transport an opaque
  // dependencyRevision. Its R07 lifecycle compares missing dependencyRevision
  // with undefined and would reject a VALID external dependency if forwarded.
  // Project the caller's source basis without that property while converting
  // an observed dependency mutation into an explicit stale source revision.
  // This permits R07's native Worker/commit fencing to fail closed as soon as
  // it polls the supplied live basis, rather than after the source is accepted.
  function projectedCurrentBasis(){
    const live=getCurrentBasis();
    if(live?.dependencyRevision!==initial.dependencyRevision)
      return {...live,sourceRevision:'LFJ_DEPENDENCY_STALE'};
    if(!live||typeof live!=='object')return live;
    const {dependencyRevision:_opaque, ...sourceBasis}=live;
    return sourceBasis;
  }
  let underlying;
  try{
    underlying=await runCommittedSourceQuery({
      ...options,getCurrentBasis:projectedCurrentBasis
    });
  }catch(error){
    // The R10 legacy port may represent a stale lifecycle as the generic
    // SOURCE_INDEX_UNCOMMITTED result. Preserve the more specific opaque
    // dependency cancellation at this owner-controlled session boundary.
    let live;
    try{live=getCurrentBasis();}catch{}
    if(live?.dependencyRevision!==initial.dependencyRevision)
      fail('SOURCE_STALE','original dependency changed during native Worker index');
    throw error;
  }
  const basis=underlying.sourceBasis;
  const summary=underlying.summary;
  let closed=false;
  function current(){
    if(closed)fail('SESSION_CLOSED','original source session already closed');
    let live;
    try{live=getCurrentBasis();}catch{
      fail('SOURCE_STALE','current source/selection basis cannot be attested');
    }
    if(!live||live.sourceRefId!==basis.sourceRefId||
      live.sourceSha256!==basis.sourceSha256||
      live.sourceRevision!==basis.sourceRevision||
      live.byteLength!==summary.byteLength||
      live.selectionDigest!==selectionDigest||
      live.jobId!==jobId||
      live.dependencyRevision!==initial.dependencyRevision)
      fail('SOURCE_STALE','source, selection, dependency or job was superseded');
    return live;
  }
  try{
    current();
    if(summary.complete!==true||summary.rightsBasis!=='SOURCE_FACTS_ONLY'||
      summary.engineeringReady!==false||summary.eventCount!==summary.occurrenceCount*2||
      blob.size!==summary.byteLength)
      fail('SOURCE_INDEX_UNVERIFIED','complete exact-source R05 census required');
  }catch(error){
    closed=true;
    try{await underlying.close();}catch{}
    throw error;
  }
  // The selected-result store can outlive the original source index head.
  // Its page manifest is not authority on its own: re-attest the committed
  // R07 source root before/after every separately awaited source/page read.
  // Only first committed OPEN is read: never materialize the whole index.
  async function attestOriginalHead(){
    const iterator=indexStore.readOrdered()[Symbol.asyncIterator]();
    try{
      const first=await iterator.next();
      const root=first?.value;
      if(first.done||root?.kind!=='OPEN'||root.path!==''||
        root.ordinal!==0||root.sourceRefId!==basis.sourceRefId||
        root.sourceSha256!==basis.sourceSha256||
        root.sourceRevision!==basis.sourceRevision)
        fail('SOURCE_INDEX_UNVERIFIED','current committed original root event required');
    }finally{await iterator.return?.();}
  }
  function verifyPair(pair,occurrenceId){
    const a=pair?.open,b=pair?.seal;
    if(a?.kind!=='OPEN'||b?.kind!=='SEAL'||
      a.occurrenceId!==occurrenceId||b.occurrenceId!==occurrenceId||
      !natural(a.ordinal)||a.ordinal!==b.ordinal||
      !natural(a.startByte)||!natural(b.endByteExclusive)||
      b.endByteExclusive<=a.startByte||b.endByteExclusive>summary.byteLength||
      typeof a.path!=='string'||!TYPES.has(a.type)||
      JSON.stringify(['lfj-json-value/v1',basis.sourceRefId,basis.sourceRevision,a.path])!==occurrenceId||
      (a.parentId!==null&&typeof a.parentId!=='string'))
      fail('OCCURRENCE_PAIR_INVALID','committed OPEN/SEAL original occurrence identity or span invalid');
    for(const row of [a,b]){
      if(row.sourceRefId!==basis.sourceRefId||
        row.sourceSha256!==basis.sourceSha256||
        row.sourceRevision!==basis.sourceRevision||
        row.schema!=='LFJ.JSON.OccurrenceEvent.v1')
        fail('OCCURRENCE_SOURCE_STALE','committed source event has wrong source or revision');
    }
    return {open:a,seal:b};
  }
  async function readOccurrence({
    occurrenceId,expectedSourceRevision,maxBytes=MAX_VALUE_BYTES
  }={}){
    current();
    if(!valid(expectedSourceRevision)||expectedSourceRevision!==basis.sourceRevision)
      fail('SOURCE_STALE','explicit current original source revision required');
    if(typeof occurrenceId!=='string'||!occurrenceId||occurrenceId.length>67584)
      fail('INVALID_OCCURRENCE','explicit exact original source occurrence ID required');
    if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_VALUE_BYTES)
      fail('RESOURCE_BOUND','original value budget must be in 1..1048576 bytes');
    await attestOriginalHead();current();
    const pair=verifyPair(await indexStore.lookupCommittedPair(occurrenceId),occurrenceId);
    await attestOriginalHead();
    current(); // source/scope/epoch/close can change during storage lookup
    const {open,seal}=pair;
    const n=seal.endByteExclusive-open.startByte;
    if(n>maxBytes)
      fail('RESOURCE_BOUND','complete original value exceeds bounded materialization budget');
    const buffer=await blob.slice(open.startByte,seal.endByteExclusive).arrayBuffer();
    await attestOriginalHead();
    current(); // no stale result after Blob materialization or R07 head revocation
    const value=new Uint8Array(buffer);
    if(value.byteLength!==n)
      fail('SOURCE_RANGE_INVALID','source Blob returned incomplete original byte span');
    return Object.freeze({
      schema:'LFJ.SourceOccurrenceValue.v1',occurrenceId,
      ordinal:open.ordinal,path:open.path,parentId:open.parentId,type:open.type,
      startByte:open.startByte,endByteExclusive:seal.endByteExclusive,
      ...basis,rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,
      bytes:value
    });
  }
  async function readPage(args){
    current();
    await attestOriginalHead();current();
    const result=await underlying.readPage(args);
    await attestOriginalHead();current();
    return result;
  }
  async function close(){
    if(closed)return;
    closed=true;
    await underlying.close();
  }
  const manifest=Object.freeze({...basis,
    occurrenceCount:summary.occurrenceCount,
    eventCount:summary.eventCount,
    sourceByteLength:summary.byteLength,
    selectionDigest,jobId,
    rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false});
  return Object.freeze({
    schema:'LFJ.SourceSession.v1',
    basis,sourceBasis:basis,summary,
    receipt:underlying.receipt,completion:underlying.completion,
    selectionSummary:underlying.selectionSummary,pageManifest:underlying.pageManifest,
    ready:Promise.resolve(underlying.completion),
    getCompletionManifest:()=>manifest,
    readOccurrence,readPage,close,cancel:close
  });
}
