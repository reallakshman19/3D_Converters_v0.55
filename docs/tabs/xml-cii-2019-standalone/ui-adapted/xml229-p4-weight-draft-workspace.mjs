/**
 * XML229: draft-only workspace; never review authority.
 *
 * The original JSON, masters and accepted review ledger remain Worker-held.
 * This file stores only editable kg proposals, keyed by the exact verified
 * InputBasis and original physical occurrence ID. A single Web Storage item
 * is replaced atomically, so a browser reload cannot load a partial batch.
 */
const SCHEMA='XML229.SourceBoundWeightDraftWorkspace.v1';
const PREFIX='xml229-weight-drafts-v1:';
const QUARANTINE_PREFIX='xml229-weight-drafts-quarantine-v1:';
const MAX=10000;
const MAX_BYTES=1500000;
const live=new Map();
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
const str=(value,max)=>typeof value==='string'&&value.length<=max;
const sameStable=(a,b)=>a.basisId===b.basisId&&a.sourceId===b.sourceId&&
 a.originalJsonSha256===b.originalJsonSha256&&
 a.reviewSourceKind===b.reviewSourceKind&&a.sourceXmlSha256===b.sourceXmlSha256;
const same=(a,b)=>sameStable(a,b)&&a.sourceGenerationId===b.sourceGenerationId;

function identity(receipt){
 const r={basisId:receipt?.basisId,sourceId:receipt?.sourceId,
  sourceGenerationId:receipt?.sourceGenerationId,
  originalJsonSha256:receipt?.originalJsonSha256};
 const xmlOnly=receipt?.reviewSourceKind==='XML_ONLY'&&r.originalJsonSha256===null&&
   /^[a-f0-9]{64}$/.test(receipt?.sourceXmlSha256)&&
   r.sourceGenerationId==='xml-only:sha256:'+receipt.sourceXmlSha256;
 if(xmlOnly)Object.assign(r,{reviewSourceKind:'XML_ONLY',sourceXmlSha256:receipt.sourceXmlSha256});
 if(!str(r.basisId,128)||!r.basisId||!str(r.sourceId,256)||!r.sourceId||
    !str(r.sourceGenerationId,256)||!r.sourceGenerationId||
    (!xmlOnly&&(!str(r.originalJsonSha256,128)||!r.originalJsonSha256)))
   fail('WEIGHT_DRAFT_VERIFIED_BASIS_REQUIRED');
 return r;
}
function cleanDraft(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||
    !str(d.value,60)||!str(d.proposalId||'',256)||
    !str(d.reason||'',1000)||
    (d.value!==''&&(!Number.isFinite(Number(d.value))||Number(d.value)<0))||
    (d.skippedWeight===true&&d.value!=='0')||
    (d.autoFilled===true&&(!d.proposalId||!(Number(d.value)>0))))
   fail('WEIGHT_DRAFT_VALUE_INVALID');
 return {
  value:d.value,proposalId:d.proposalId||'',reason:d.reason||'',
  autoFilled:d.autoFilled===true,autoUnqualified:d.autoUnqualified===true,
  skippedWeight:d.skippedWeight===true,
 };
}
function readSnapshot(snapshot,expected,{allowReattestedGeneration=false}={}){
 // Reattestation of the exact same cryptographic InputBasis may allocate a
 // new ephemeral Blob source generation after reload; the full occurrence
 // census is checked before recovered kg is made visible.
 if(!snapshot||snapshot.schema!==SCHEMA||
    !(same(snapshot,expected)||allowReattestedGeneration&&sameStable(snapshot,expected))||
    !Array.isArray(snapshot.entries)||snapshot.entries.length>MAX)
   fail('WEIGHT_DRAFT_BASIS_OR_FORMAT_MISMATCH');
 const result=new Map();
 for(const pair of snapshot.entries){
  if(!Array.isArray(pair)||pair.length!==2||!str(pair[0],512)||!pair[0]||
     result.has(pair[0]))fail('WEIGHT_DRAFT_OCCURRENCE_INVALID');
  result.set(pair[0],cleanDraft(pair[1]));
 }
 return result;
}
function snapshotFor(id,drafts){
 if(!(drafts instanceof Map)||drafts.size>MAX)fail('WEIGHT_DRAFT_COUNT_EXCEEDED');
 const entries=[];
 for(const [key,value] of drafts){
  if(!str(key,512)||!key)fail('WEIGHT_DRAFT_OCCURRENCE_INVALID');
  // Keep blank transient edits out of backups; no implied zero.
  if(value?.value==='')continue;
  entries.push([key,cleanDraft(value)]);
 }
 entries.sort((a,b)=>a[0].localeCompare(b[0]));
 return {schema:SCHEMA,...id,entries,reviewDecisionsAuthorized:false,
  nativeCiiReleaseAuthorized:false};
}
function stored(storage,key,identityValue,{reattestedCensus=false}={}){
 if(!storage)return new Map();
 let raw;
 try{raw=storage.getItem(key);}catch{fail('WEIGHT_DRAFT_STORAGE_READ_FAILED');}
 if(raw===null)return new Map();
 if(typeof raw!=='string'||raw.length>MAX_BYTES)fail('WEIGHT_DRAFT_STORAGE_INVALID');
 try{return readSnapshot(JSON.parse(raw),identityValue,
  {allowReattestedGeneration:reattestedCensus});}
 catch(error){if(error.code)throw error;fail('WEIGHT_DRAFT_STORAGE_INVALID');}
}
export function openXml229WeightDraftWorkspace(receipt,{
 storage,occurrenceIds,recoverUnknownCensus=false,
}={}){
 const id=identity(receipt),key=PREFIX+id.basisId;
 const census=occurrenceIds===undefined?null:new Set(occurrenceIds);
 if(census&&(census.size!==occurrenceIds.length||census.size>MAX||
   [...census].some(x=>!str(x,512)||!x)))fail('WEIGHT_DRAFT_PHYSICAL_CENSUS_INVALID');
 const ensureCensus=drafts=>{
   if(census&&[...drafts.keys()].some(x=>!census.has(x)))
     fail('WEIGHT_DRAFT_UNKNOWN_ORIGINAL_OCCURRENCE');
 };
 if(storage===undefined){
  try{storage=globalThis.localStorage||null;}
  catch{storage=null;}
 }
 if(storage!==null&&(!storage||typeof storage.getItem!=='function'||
   typeof storage.setItem!=='function'))fail('WEIGHT_DRAFT_STORAGE_INVALID');
 const existing=live.get(key);
 const sameGeneration=existing?.isFor(receipt)===true;
 if(existing&&(!census||!existing.isSameVerifiedBasis(receipt))&&!sameGeneration)
   fail('WEIGHT_DRAFT_BASIS_COLLISION');
 // Strict by default: only verified-panel automatic drafts may be recovered.
 if(sameGeneration&&(!recoverUnknownCensus||!census)){
   if(census)ensureCensus(existing.drafts);
   return existing;
 }
 if(sameGeneration&&[...existing.drafts.keys()].every(x=>census.has(x)))
   return existing;
 const drafts=sameGeneration?existing.drafts:existing
   ?new Map(existing.drafts):stored(storage,key,id,{reattestedCensus:!!census});
 const rejected=census?[...drafts.keys()].filter(x=>!census.has(x)):[];
 if(rejected.length&&!recoverUnknownCensus)
   fail('WEIGHT_DRAFT_UNKNOWN_ORIGINAL_OCCURRENCE');
 let recovery=null,quarantinedBackup=null;
 if(rejected.length){
   // Preserve old private drafts before excluding IDs absent from this source.
   // No unknown draft may be remapped or written to Match-1 / Final.
   quarantinedBackup=existing?existing.exportBackup():snapshotFor(id,drafts);
   const quarantineKey=QUARANTINE_PREFIX+id.basisId+':'+id.sourceGenerationId;
   let backupStored=false;
   if(storage){
     try{storage.setItem(quarantineKey,JSON.stringify(quarantinedBackup));
       backupStored=true;}catch{/* Private in-memory export stays available. */}
   }
   for(const unknown of rejected)drafts.delete(unknown);
   recovery=Object.freeze({rejectedCount:rejected.length,
     retainedCount:drafts.size,backupStored});
 }
 ensureCensus(drafts);
 const workspace=Object.freeze({
  drafts,storageAvailable:!!storage,recovery,
  exportQuarantinedBackup(){return quarantinedBackup;},
  isFor(other){try{return same(id,identity(other));}catch{return false;}},
  isSameVerifiedBasis(other){try{return sameStable(id,identity(other));}catch{return false;}},
  exportBackup(){return snapshotFor(id,drafts);},
  save(){
   ensureCensus(drafts);
   if(recovery?.rejectedCount&&storage&&!recovery.backupStored)
     fail('WEIGHT_DRAFT_QUARANTINE_SAVE_REQUIRED');
   const snapshot=snapshotFor(id,drafts);
   const json=JSON.stringify(snapshot);
   if(json.length>MAX_BYTES)fail('WEIGHT_DRAFT_STORAGE_LIMIT');
   if(storage){
    try{storage.setItem(key,json);}
    catch{fail('WEIGHT_DRAFT_STORAGE_WRITE_FAILED');}
   }
   return snapshot.entries.length;
  },
  restoreBackup(snapshot){
   const next=readSnapshot(snapshot,id);
   ensureCensus(next);
   const old=new Map(drafts);
   drafts.clear();
   for(const [k,v] of next)drafts.set(k,v);
   try{this.save();}
   catch(error){
    drafts.clear();
    for(const [k,v] of old)drafts.set(k,v);
    throw error;
   }
   return drafts.size;
  },
 });
 live.set(key,workspace);
 return workspace;
}
