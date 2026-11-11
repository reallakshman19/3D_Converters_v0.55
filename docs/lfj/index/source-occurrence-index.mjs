/**
 * LFJ R05/U01 — bounded stream of every JSON *value* occurrence.
 * This is not a DOM, a whole-file index in browser RAM, a GC-PW physical ID,
 * a Site/Zone inheritance decision, or an ENGINEERING_EXPORT authority.
 */
import {scanJsonDocument} from '../tokenizer/json-tokenizer.mjs';

export class SourceOccurrenceIndexError extends Error {
  constructor(code,detail){
    super(code+': '+detail);this.name='SourceOccurrenceIndexError';this.code=code;
  }
}
const fail=(code,detail)=>{throw new SourceOccurrenceIndexError(code,detail);};
const validPositive=n=>Number.isSafeInteger(n)&&n>0;
const escapePointer=s=>s.replace(/~/g,'~0').replace(/\//g,'~1');
// Hard ceiling limits quadratic pointer amplification from nested long source keys.
// UTF-16 code units are a conservative bounded wire/string resource budget;
// distinct supported paths retain their full RFC6901 representation.
const MAX_POINTER_CODE_UNITS=65536;
const MAX_REVISION_CODE_UNITS=1024;
const MAX_OCCURRENCE_ID_CODE_UNITS=67584;
const schema='LFJ.JSON.OccurrenceEvent.v1';
const occurrenceId=(sourceRefId,revision,path)=>
  JSON.stringify(['lfj-json-value/v1',sourceRefId,revision,path]);

/**
 * Reconcile R04's complete token stream into a strictly source-ordered event
 * log. OPEN reveals each value's parent/path/start; SEAL supplies the original
 * value's exclusive end byte after its closing token. No incomplete composite
 * is falsely assigned a complete byte range. A port can commit only after the
 * returned summary is complete; intermediate pages are provisional.
 *
 * Memory: O(R04 max nesting depth + bounded original event page bytes), never
 * O(all occurrences). pageBytes caps serialized R05 output; sourceReadPageBytes
 * independently caps R04 original-byte reads (including 1-byte boundary tests).
 */
export async function streamJsonOccurrenceEvents(snapshot,{
  sourceRefId,onEventPage,pageEvents=256,pageBytes=65536,
  sourceReadPageBytes=65536,
  maxOccurrences=2000000,signal=null,
}={}) {
  if(typeof sourceRefId!=='string'||!sourceRefId.trim()||sourceRefId.length>512)
    fail('INVALID_SOURCE_REF','stable caller source-ref label required, independent of content SHA');
  if(typeof onEventPage!=='function')
    fail('EVENT_SINK_REQUIRED','bounded asynchronous event-page sink required');
  if(!validPositive(pageEvents)||pageEvents>4096)
    fail('PAGE_LIMIT','event-page bound must be 1..4096');
  // This is also R04's byte-cursor read bound. R05 owns an independent
  // serialized event-buffer ceiling under the same explicit caller budget.
  // Neither event count nor source read bytes can silently override the other.
  if(!validPositive(pageBytes)||pageBytes>1048576)
    fail('PAGE_LIMIT','event-page serialized byte budget must be 1..1MiB');
  // R04 input read sizes and R05 output event sizes are independent budgets.
  // Preserve adversarial 1-byte source reads without permitting a 1-byte
  // serialized event page to claim an impossible successful transport.
  if(!validPositive(sourceReadPageBytes)||sourceReadPageBytes>1048576)
    fail('PAGE_LIMIT','source-read page byte budget must be 1..1MiB');
  if(!validPositive(maxOccurrences)||maxOccurrences>2000000)
    fail('OCCURRENCE_LIMIT','source occurrence ceiling must be 1..2000000');
  if(!snapshot||typeof snapshot.sha256!=='string'||
      typeof snapshot.revision!=='string'||!snapshot.revision||
      snapshot.revision.length>MAX_REVISION_CODE_UNITS||
      !Number.isSafeInteger(snapshot.byteLength))
    fail('INVALID_SOURCE_SNAPSHOT','exact immutable R03 source required');

  let opened=0,sealed=0,sent=0,rootSeen=false,pending=[],pendingBytes=2;
  const encoder=new TextEncoder();
  const frames=[]; // only ancestors currently open; R04 enforces maxDepth
  async function publish(event){
    const row=Object.freeze({
      schema,sourceRefId,sourceSha256:snapshot.sha256,
      sourceRevision:snapshot.revision,...event,
    });
    // Charge every source schema, revision, original path, occurrence ID and
    // own-attributes byte ONCE, with exact UTF8 JSON row + array punctuation.
    const width=encoder.encode(JSON.stringify(row)).byteLength;
    if(width+2>pageBytes)
      fail('SOURCE_EVENT_PAGE_LIMIT',
        'one original R05 source fact exceeds caller serialized page budget');
    if(pending.length&&(pending.length>=pageEvents||
       pendingBytes+1+width>pageBytes))await flush();
    pendingBytes+=width+(pending.length?1:0);
    pending.push(row);
    if(pending.length>=pageEvents)await flush();
  }
  // Exact R03 snapshots can be closed while an R04 byte cursor holds its
  // already-read page. Attest liveness at each transport handoff, both before
  // and after the awaited sink, to prevent more provisional events leaking
  // after a source is closed. The R03 reader itself enforces the revision.
  async function attestLive() {
    if(signal?.aborted)fail('SCAN_ABORTED','original index scan was cancelled');
    await snapshot.readRange(0,0,snapshot.revision);
    if(signal?.aborted)fail('SCAN_ABORTED','original index scan was cancelled');
  }
  async function flush(){
    if(!pending.length)return;
    await attestLive();
    const batch=Object.freeze(pending);
    pending=[];pendingBytes=2;
    await onEventPage(batch); // backpressure; propagate sink errors unchanged
    await attestLive();
    sent+=batch.length;
  }
  function nextPath() {
    const parent=frames.at(-1);
    if(!parent){
      if(rootSeen)fail('INDEX_EVENT_SEQUENCE','multiple root values');
      rootSeen=true;
      return {path:'',parentId:null,localAttributesOwnerId:null};
    }
    let member,localAttributesOwnerId=null;
    if(parent.type==='array'){
      member=String(parent.nextIndex++);
    }else{
      if(parent.pendingKey===null)fail('INDEX_EVENT_SEQUENCE','object value lacks verified own key');
      // Only this *direct* object property can serve as an own-attribute
      // source reference. A descendant attribute never belongs to an ancestor.
      if(parent.pendingKey==='attributes')localAttributesOwnerId=parent.occurrenceId;
      member=escapePointer(parent.pendingKey);
      parent.pendingKey=null;
    }
    const path=parent.path+'/'+member;
    if(path.length>MAX_POINTER_CODE_UNITS)
      fail('POINTER_LIMIT','original JSON Pointer exceeds protected 65536-code-unit source limit');
    return {path,parentId:parent.occurrenceId,localAttributesOwnerId};
  }
  async function open(token,type){
    if(opened>=maxOccurrences)
      fail('OCCURRENCE_LIMIT','original JSON has more values than permitted');
    const {path,parentId,localAttributesOwnerId}=nextPath();
    const ordinal=opened++;
    const id=occurrenceId(sourceRefId,snapshot.revision,path);
    if(id.length>MAX_OCCURRENCE_ID_CODE_UNITS)
      fail('POINTER_LIMIT','source occurrence identity exceeds bounded transport string cap');
    const record={occurrenceId:id,ordinal,path,parentId,type,startByte:token.startByte};
    await publish({kind:'OPEN',...record});
    // Internal provenance only; emitted OPEN wire shape is unchanged.
    return {...record,localAttributesOwnerId:type==='object'?localAttributesOwnerId:null};
  }
  async function seal(record,endByteExclusive){
    if(endByteExclusive<=record.startByte)
      fail('INDEX_SPAN_INVALID','original source composite span cannot be empty or reversed');
    sealed++;
    await publish({
      kind:'SEAL',occurrenceId:record.occurrenceId,ordinal:record.ordinal,
      endByteExclusive,
      ...(record.localAttributesOwnerId ? {ownAttributes:Object.freeze({
        ownerOccurrenceId:record.localAttributesOwnerId,
        startByte:record.startByte,endByteExclusive,
      })} : {}),
    });
  }
  async function onToken(token){
    if(token.sourceSha256!==snapshot.sha256||token.sourceRevision!==snapshot.revision)
      fail('SOURCE_REVISION_MISMATCH','R04 token identity differs from R03 original bytes');
    const parent=frames.at(-1);
    if(token.type==='key'){
      if(!parent||parent.type!=='object'||parent.pendingKey!==null)
        fail('INDEX_EVENT_SEQUENCE','source object key is missing its own container');
      parent.pendingKey=token.value;
    } else if(token.type==='start-object'||token.type==='start-array'){
      const type=token.type==='start-object'?'object':'array';
      const rec=await open(token,type);
      frames.push({...rec,nextIndex:0,pendingKey:null});
    } else if(token.type==='end-object'||token.type==='end-array'){
      const wanted=token.type==='end-object'?'object':'array';
      if(!parent||parent.type!==wanted)
        fail('INDEX_EVENT_SEQUENCE','close token does not match exact open container');
      frames.pop();
      await seal(parent,token.endByteExclusive);
    } else if(['string','number','boolean','null'].includes(token.type)){
      const rec=await open(token,token.type);
      await seal(rec,token.endByteExclusive);
    } else if(token.type!=='comma'&&token.type!=='colon'){
      fail('INDEX_EVENT_SEQUENCE','unexpected token in original grammar');
    }
  }

  const scan=await scanJsonDocument(snapshot,{pageBytes:sourceReadPageBytes,signal,onToken});
  if(!scan.complete||!rootSeen||frames.length||opened!==sealed||
     scan.sourceSha256!==snapshot.sha256||scan.sourceRevision!==snapshot.revision)
    fail('INCOMPLETE_OCCURRENCE_INDEX','source did not seal all original values on exact revision');
  await flush();
  return Object.freeze({
    schema:'LFJ.JSON.OccurrenceIndexSummary.v1',complete:true,
    sourceRefId,sourceSha256:snapshot.sha256,sourceRevision:snapshot.revision,
    byteLength:snapshot.byteLength,endByteExclusive:scan.endByteExclusive,
    occurrenceCount:opened,eventCount:sent,
    rootFacts:scan.rootFacts,
    rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,
  });
}
