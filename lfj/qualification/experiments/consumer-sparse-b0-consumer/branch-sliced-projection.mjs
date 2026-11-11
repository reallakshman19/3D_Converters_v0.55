/**
 * #1147 B0-04: source-backed, branch-sliced Resolver projection EXPERIMENT.
 *
 * Original R03 SHA + R04 complete catalog and R09-style bounded page contract.
 * This consumes original immutable JSON branch slices of <=1MiB, NEVER parses
 * the full source in the browser Worker, and persists only consumer facts.
 * Reuses actual downstream extraction semantics as an independent boundary.
 * No engineering Build/export authority, no production LFJ files changed.
 */
import {openPagedSourceQuery} from '../consumer-sparse-b0-query/paged-query.mjs';
import {buildStandaloneDtxrPositionGroups} from '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-resolution-ledger.js';
import {decorateJsonTraceMember,configuredJsonTraceFieldNames} from '../../../../tabs/xml-cii-2019-standalone/xml-cii-json-trace-fields.js';
import {sourceFieldEvidence,resolveSourceSchema} from '../../../../converters/xml-cii2019-core/source-schema-adapter.js';
import {groupTraceEntriesSpatially} from '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-spatial-index.js';

const SCHEMA='LFJ.B0.ResolverProjection.v1';
const MAX_BRANCH_BYTES=1024*1024,PAGE_FACTS=128;
const makeError=(code,message)=>Object.assign(new Error(message),{code});
const fail=(code,message)=>{throw makeError(code,message);};
const enc=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const canonicalFields=[
  'jsonNodeNo','jsonSequence','branchName','point','bore','type',
  'description','dtxrPs','labeled','name','componentRef','tags','cmpSupGap',
  'path','capturedFields','semanticFields'
];
export const normalizedResolverProjectionFact=m=>Object.fromEntries(
  canonicalFields.map(key=>[key,m[key]??(key==='point'?null:'')]));
const normalized=normalizedResolverProjectionFact;
const MATCH_FIELD_NAMES=[
  // Actual legacy trace descriptors, source node fallbacks, support labels,
  // spatial aliases and explicit component attachment evidence.
  'DTXR','DESC','DESCRIPTION','RTEXT','SPRE','SPREF','DTXR_POS',
  'DTXR_PS','DTXRPS','NAME','NodeName','SupportTag','PS','supportPs','psNo',
  'ComponentRefNo','COMPONENTREFNO','COMPRE','ATTACHED_COMPONENT_REF',
  'REF','RefNo','REFNO','JsonNodeNo','JSON_NODE_NO','NODE_NO',
  'NodeNumber','NODE','SEQ','SEQUENCE','CMPSUPGAP','SUPPORT GAP',
  'OWNER','BRANCH','PIPE','ABORE','LBORE','HBORE','BORE',
  'SUPPORTCOORD','SUPPORT_COORD','POS','POSI','BPOS','APOS','LPOS',
  'CPOS','HPOS','TPOS','SPOS','EPOS'
];
export function compactMatchingEvidence(raw,config){
  const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const schema=resolveSourceSchema(config);
  const wanted=new Set([
    ...MATCH_FIELD_NAMES,...configuredJsonTraceFieldNames(config),
    ...Object.values(schema.fields).flat()
  ].map(k=>String(k).toUpperCase()));
  const subset=object=>Object.fromEntries(Object.entries(object||{})
    .filter(([key])=>wanted.has(key.toUpperCase())));
  const attrs=src.attributes&&typeof src.attributes==='object'&&!Array.isArray(src.attributes)
    ?src.attributes:{};
  const direct=subset(src);
  for(const name of ['type','name','position','point','bore']){
    if(Object.prototype.hasOwnProperty.call(src,name))direct[name]=src[name];
  }
  const value={attributes:subset(attrs),direct};
  if(encode(value).length>32768)
    fail('MATCH_EVIDENCE_OVERSIZE','one engineering source-fact evidence exceeds bound');
  return value;
}

const encode=x=>enc.encode(JSON.stringify(x));
const txEnd=tx=>new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||makeError('PROJECTION_WRITE','IndexedDB error'));
  tx.onabort=()=>reject(tx.error||makeError('PROJECTION_ABORT','IndexedDB transaction abort'));
});
async function openProjectionDb(databaseName){
  return await new Promise((resolve,reject)=>{
    const req=indexedDB.open(databaseName,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      db.createObjectStore('pages',{keyPath:['generation','pageNo']});
      db.createObjectStore('heads');
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
function countStaged(value){
  if(Array.isArray(value))return value.reduce((a,v)=>a+countStaged(v),0);
  if(!value||typeof value!=='object')return 0;
  return 1+(Array.isArray(value.children)?countStaged(value.children):0);
}
async function hashConfig(config,toleranceMm){
  const b=encode({schema:SCHEMA,config,toleranceMm,enabledFields:configuredJsonTraceFieldNames(config),
    resolvedSchema:resolveSourceSchema(config)});
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))]
    .map(x=>x.toString(16).padStart(2,'0')).join('');
}
// Stable streaming TEST checksum; a product candidate MUST replace this with
// a collision-resistant source/manifest/page digest and proper transactional CAS.
function checksum(state,record){
  let h=state;
  for(const b of encode(record)){h^=b;h=Math.imul(h,16777619)>>>0;}
  h^=10;return Math.imul(h,16777619)>>>0;
}
export async function createSourceBackedResolverProjection({
  sourceDatabaseName,sourceGeneration,blob,expectedSha256,
  projectionDatabaseName,projectionGeneration,config={},toleranceMm=6,
  branchSpanLimit=MAX_BRANCH_BYTES
}={}){
  if(typeof projectionDatabaseName!=='string'||!projectionDatabaseName||
     typeof projectionGeneration!=='string'||!projectionGeneration||
     !(blob instanceof Blob)||!Number.isInteger(branchSpanLimit)||
     branchSpanLimit<1||branchSpanLimit>MAX_BRANCH_BYTES)
    fail('INPUT_INVALID','source Blob, destination identity, and bounded branch budget required');
  const source=await openPagedSourceQuery({
    databaseName:sourceDatabaseName,generation:sourceGeneration,
    blob,expectedSha256
  });
  let db=null,success=false,branches=0,sourceObjects=0,facts=0,pageNo=0;
  let offset=0,activePage=[],digest=2166136261,groupEntries=[],pageDigests=[],fullPageDigests=[];
  let sourcePageReads=0,materializedBytes=0,maxBranchObserved=0;
  const begun=performance.now(),projectionDigest=await hashConfig(config,toleranceMm);
  try{
    if(source.selectionKind!=='ALL'||source.sourceCount===0||
       source.engineeringReady!==false)
      fail('SOURCE_AUTHORITY','complete original source facts required');
    db=await openProjectionDb(projectionDatabaseName);
    const stagedNodes=new Map(),arrayBases=new Map();
    arrayBases.set(0,'$');
    const roots=[];
    let cursor=0,initial=null;
    do{
      const page=await source.readPage({cursor,maxRows:256,maxBytes:65536});
      if(!initial){
        initial=page.rows[0];
        if(!initial||initial.ordinal!==0||initial.type!=='array'||
           initial.parent!==null)
          fail('ROOT_PROFILE_UNSUPPORTED','bounded projection requires JSON root array');
      }
      for(const row of page.rows){
        if(row.type==='object'&&arrayBases.has(row.parent)&&
           Number.isSafeInteger(row.member)){
          const prefix=arrayBases.get(row.parent);
          const path=prefix+'['+row.member+']';
          stagedNodes.set(row.ordinal,path);
          if(row.parent===0)roots.push({row,path});
          // Only stage-object occurrences are retained, not the whole source.
        }else if(row.type==='array'&&row.member==='children'&&
                 stagedNodes.has(row.parent)){
          arrayBases.set(row.ordinal,stagedNodes.get(row.parent)+'.children');
        }
      }
      cursor=page.nextCursor;sourcePageReads++;
    }while(cursor<source.sourceCount);
    roots.sort((a,b)=>a.row.member-b.row.member);
    if(!roots.length)fail('SOURCE_PROFILE_EMPTY','no root staged-json branches');
    const pathToSource=new Map();
    // Build a bounded-size path->source span lookup for staged entities only.
    // Every path is based on original parent ordinal, never a fuzzy label.
    // Map references are also used for semantic source identity of each entry.
    for(const [id,path] of stagedNodes){
      // The metadata for stage rows is requested only if a domain entry refers
      // to it; keep the sparse set of ids rather than 328K full JSON rows.
      pathToSource.set(path,id);
    }
    stagedNodes.clear();arrayBases.clear();
    async function flush(){
      if(!activePage.length)return;
      const pageFactHash=await crypto.subtle.digest('SHA-256',
        encode(activePage.map(normalized)));
      pageDigests.push([...new Uint8Array(pageFactHash)]
        .map(b=>b.toString(16).padStart(2,'0')).join(''));
      // All consumer bytes matter: matchingEvidence, original ordinals/spans,
      // configured source conflicts AND normalized legacy facts. The original
      // domainSha256 above remains unchanged for the independent legacy oracle.
      const fullHash=await crypto.subtle.digest('SHA-256',encode(activePage));
      fullPageDigests.push([...new Uint8Array(fullHash)]
        .map(b=>b.toString(16).padStart(2,'0')).join(''));
      const tx=db.transaction('pages','readwrite'),done=txEnd(tx);
      tx.objectStore('pages').add({generation:projectionGeneration,pageNo,
        sourceSha256:expectedSha256,configDigest:projectionDigest,
        rows:activePage});
      await done;pageNo++;activePage=[];
    }
    for(const root of roots){
      const {row,path}=root;
      const bytes=row.endByteExclusive-row.startByte;
      if(bytes>branchSpanLimit)
        fail('BRANCH_SPAN_LIMIT','one original branch exceeds approved slice budget');
      maxBranchObserved=Math.max(maxBranchObserved,bytes);
      materializedBytes+=bytes;
      // Entire source is NEVER JSON.parse'd: at most one original branch span.
      const original=await source.readOriginalRange(row.startByte,row.endByteExclusive);
      const value=JSON.parse(decoder.decode(original));
      if(!value||typeof value!=='object'||Array.isArray(value))
        fail('SOURCE_ENTITY_INVALID','branch span is not original staged-json object');
      const local=buildStandaloneDtxrPositionGroups([value],toleranceMm,config)
        .flatMap(group=>group.entries)
        .sort((a,b)=>a.jsonSequence-b.jsonSequence);
      const total=countStaged(value);
      for(const item of local){
        const originalPath=path+item.path.slice(4); // '$[0]...' → '$[real-root-index]...'
        const id=pathToSource.get(originalPath);
        if(id===undefined)fail('SOURCE_PROVENANCE_MISSING',
          'original DOM object path is not source-catalog-backed: '+originalPath);
        const sourceRow=await source.readOrdinal(id);
        const enriched=decorateJsonTraceMember(item,config);
        // Real legacy walkStaged assigns fallback jsonNodeNo from the GLOBAL
        // staged-object sequence, not the branch-local sequence. An explicit
        // own node alias must retain its original value even when it happens
        // to equal the local number.
        const ownAttrs=item.raw?.attributes &&
          typeof item.raw.attributes==='object' ? item.raw.attributes:{};
        const nodeAliases=['JsonNodeNo','JSON_NODE_NO','NODE_NO',
          'NodeNumber','NODE','SEQ','SEQUENCE'];
        const explicitNode=Object.entries(ownAttrs).some(([key,value])=>
          nodeAliases.some(alias=>alias.toUpperCase()===key.toUpperCase())&&
          value!==null&&value!==undefined&&String(value).trim()!=='');
        const jsonNodeNo=explicitNode?item.jsonNodeNo:
          String(offset+item.jsonSequence);
        const conflicts={};
        for(const role of Object.keys(resolveSourceSchema(config).fields)){
          const ev=sourceFieldEvidence(item.raw,role,config);
          if(ev.conflict)conflicts[role]=ev.distinctValues;
        }
        const fact=Object.freeze({
          ...normalized({...enriched,path:originalPath,jsonNodeNo,
            jsonSequence:offset+item.jsonSequence}),
          sourceOrdinal:id,startByte:sourceRow.startByte,
          endByteExclusive:sourceRow.endByteExclusive,
          fieldConflicts:conflicts,
          matchingEvidence:compactMatchingEvidence(item.raw,config)
        });
        digest=checksum(digest,normalized(fact));
        groupEntries.push({
          branch:item.branch,point:item.point,
          jsonNodeNo:item.jsonNodeNo,tags:item.tags
        });
        activePage.push(fact);facts++;
        if(activePage.length>=PAGE_FACTS)await flush();
      }
      offset+=total;sourceObjects+=total;branches++;
      // Release original branch DOM before reading the next one.
    }
    await flush();
    const groups=groupTraceEntriesSpatially(groupEntries,toleranceMm).length;
    const combined=await crypto.subtle.digest('SHA-256',enc.encode(pageDigests.join('\n')));
    const domainSha256=[...new Uint8Array(combined)]
      .map(b=>b.toString(16).padStart(2,'0')).join('');
    const evidenceCombined=await crypto.subtle.digest('SHA-256',
      enc.encode(fullPageDigests.join('\n')));
    const matchingEvidenceDigestSha256=[...new Uint8Array(evidenceCombined)]
      .map(b=>b.toString(16).padStart(2,'0')).join('');
    const tx=db.transaction('heads','readwrite'),done=txEnd(tx);
    tx.objectStore('heads').put({
      schema:SCHEMA,generation:projectionGeneration,
      sourceSha256:expectedSha256,sourceGeneration,
      consumerManifestDigest:projectionDigest,complete:true,
      originalCount:source.sourceCount,rootBranches:branches,
      traversedDomainObjects:sourceObjects,factCount:facts,
      factPageCount:pageNo,groups,domainDigest32:digest>>>0,
      domainSha256,matchingEvidenceDigestSha256,
      sourceOnly:true,engineeringReady:false
    },'active');
    await done;
    success=true;
    return {schema:SCHEMA,sourceSha256:expectedSha256,
      consumerManifestDigest:projectionDigest,
      sourceOccurrences:source.sourceCount,rootBranches:branches,
      traversedDomainObjects:sourceObjects,factCount:facts,
      factPageCount:pageNo,spatialGroupCount:groups,
      domainDigest32:digest>>>0,domainSha256,matchingEvidenceDigestSha256,
      sourcePageReads,
      sourceByteReadTotal:materializedBytes,maxBranchSpan:maxBranchObserved,
      elapsedMs:performance.now()-begun,sourceOnly:true,
      engineeringReady:false,appWired:false};
  }finally{
    source.close();db?.close();
    if(!success){/* No HEAD for incomplete candidate. Orphan GC is not qualified. */}
  }
}
