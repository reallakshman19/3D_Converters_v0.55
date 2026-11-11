/**
 * #1147 B0-05 — source-pinned experimental Resolver engineering/CSV adapter.
 * Reuses the REAL exported Resolver and CSV functions. Only reconstructs a
 * bounded, consumer-specific working tree from prior sparse projection facts.
 * No original full-JSON parse in Worker; no production UI/export authority.
 */
import {openPagedSourceQuery} from '../consumer-sparse-b0-query/paged-query.mjs';
import {normalizedResolverProjectionFact} from
  '../consumer-sparse-b0-consumer/branch-sliced-projection.mjs';
import {runStandaloneResolverJsonTrace} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-resolver-json-trace.js';
import {buildEvidenceTreeCsv,buildXmlNodeWiseTraceCsv} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-export.js';
import {configuredJsonTraceFieldNames} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-json-trace-fields.js';
import {resolveSourceSchema} from
  '../../../../converters/xml-cii2019-core/source-schema-adapter.js';
const HEAD_SCHEMA='LFJ.B0.ResolverProjection.v1',MATCH_SCHEMA='LFJ.B0.XmlCsvResearch.v1';
const fail=(code,msg)=>{throw Object.assign(new Error(msg),{code});};
const sha256=async value=>[...new Uint8Array(
  await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))]
  .map(x=>x.toString(16).padStart(2,'0')).join('');
const read=(store,key)=>new Promise((resolve,reject)=>{
  const req=store.get(key);req.onsuccess=()=>resolve(req.result??null);
  req.onerror=()=>reject(req.error);
});
const openDb=async name=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);
  req.onupgradeneeded=()=>{req.transaction.abort();};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});
const nodeAliases=['JsonNodeNo','JSON_NODE_NO','NODE_NO','NodeNumber','NODE','SEQ','SEQUENCE'];
export function slimNode(fact){
  const evidence=fact.matchingEvidence;
  if(!evidence||typeof evidence!=='object')
    fail('MATCH_EVIDENCE_MISSING','consumer source evidence was not indexed');
  const attrs={...(evidence.attributes||{})};
  const direct={...(evidence.direct||{})};
  // The legacy fallback sequence is global; materializing fewer source attrs
  // must never renumber original nodes or override an explicit source node ID.
  const explicit=Object.entries(attrs).concat(Object.entries(direct)).some(([k,v])=>
    nodeAliases.some(alias=>alias.toUpperCase()===k.toUpperCase())&&
    v!==null&&v!==undefined&&String(v).trim()!=='');
  if(!explicit)attrs.JsonNodeNo=String(fact.jsonNodeNo);
  const node={...direct,attributes:attrs};
  if(!node.type)node.type=fact.type;
  if(node.name===undefined||node.name===null)node.name=fact.name;
  // Original domain fact point may have been inherited from the real branch.
  // The slim node carries the canonical proven effective coordinate instead.
  if(!node.position&&!node.point&&fact.point)node.position=fact.point;
  if(!node.bore&&fact.bore)node.bore=fact.bore;
  return node;
}
export async function compareSourceProjectionToXml({
  sourceDatabaseName,sourceGeneration,
  projectionDatabaseName,projectionGeneration,
  blob,expectedSha256,xmlText,config={},onBeforeResolve
}={}){
  if(!(blob instanceof Blob)||typeof xmlText!=='string'||!xmlText||
     typeof projectionDatabaseName!=='string'||!projectionDatabaseName)
    fail('INPUT_INVALID','original source/canonical XML and projection identity are required');
  if(onBeforeResolve!==undefined&&typeof onBeforeResolve!=='function')
    fail('INPUT_INVALID','research-only resolve barrier must be a callback');
  const source=await openPagedSourceQuery({
    databaseName:sourceDatabaseName,generation:sourceGeneration,
    blob,expectedSha256
  });
  let db=null;
  const started=performance.now();
  try{
    db=await openDb(projectionDatabaseName);
    const head=await read(db.transaction('heads','readonly').objectStore('heads'),'active');
    const expectedConsumerDigest=await sha256(JSON.stringify({
      schema:HEAD_SCHEMA,config,toleranceMm:6,
      enabledFields:configuredJsonTraceFieldNames(config),
      resolvedSchema:resolveSourceSchema(config)
    }));
    if(!head||head.schema!==HEAD_SCHEMA||!head.complete||
       head.sourceSha256!==expectedSha256||
       head.sourceGeneration!==sourceGeneration||
       head.generation!==projectionGeneration||
       head.originalCount!==source.sourceCount||head.engineeringReady!==false||
       !Number.isInteger(head.factPageCount)||head.factPageCount<0||
       !/^[0-9a-f]{64}$/.test(head.domainSha256||'')||
       !/^[0-9a-f]{64}$/.test(head.matchingEvidenceDigestSha256||''))
      fail('PROJECTION_NOT_COMMITTED','source/projected consumer facts do not share an exact HEAD');
    if(head.consumerManifestDigest!==expectedConsumerDigest)
      fail('PROJECTION_CONFIG_STALE','consumer capture/aliases/tolerance differ from committed projection');
    const headIdentity=JSON.stringify(head);
    async function assertHeadsCurrent(){
      // The source and projection have separate active-HEAD transactions.
      // Re-read BOTH identities at each observable result boundary. This
      // detects honest supersession but is not an ABA-proof or a malicious
      // writable HEAD authentication signature.
      await source.assertActive();
      const current=await read(db.transaction('heads','readonly')
        .objectStore('heads'),'active');
      if(!current||!current.complete||JSON.stringify(current)!==headIdentity)
        fail('PROJECTION_SUPERSEDED',
          'consumer fact HEAD was replaced during XML matching');
      await source.assertActive();
    }
    const branches=[],records=[],domainPageHashes=[],evidencePageHashes=[];
    let sourceFacts=0,previousOrdinal=-1;
    for(let pageNo=0;pageNo<head.factPageCount;pageNo++){
      const page=await read(db.transaction('pages','readonly').objectStore('pages'),
        [projectionGeneration,pageNo]);
      if(!page||page.generation!==projectionGeneration||
         page.sourceSha256!==expectedSha256||
         page.configDigest!==head.consumerManifestDigest||
         !Array.isArray(page.rows)||page.rows.length<1||page.rows.length>128)
        fail('PROJECTION_PAGE_CORRUPT','consumer page is absent/mismatched or unbounded');
      // Verify what will actually drive engineering decisions. A matching
      // page has TWO committed digests: original full matching/provenance
      // evidence and the canonical legacy-normalized fact oracle. A page
      // count or source SHA label alone would not detect cache corruption.
      evidencePageHashes.push(await sha256(JSON.stringify(page.rows)));
      domainPageHashes.push(await sha256(JSON.stringify(
        page.rows.map(normalizedResolverProjectionFact))));
      for(const fact of page.rows){
        if(!fact||!Number.isSafeInteger(fact.sourceOrdinal)||
           fact.sourceOrdinal<0||fact.sourceOrdinal>=head.originalCount||
           fact.sourceOrdinal<=previousOrdinal||
           !Number.isSafeInteger(fact.startByte)||
           !Number.isSafeInteger(fact.endByteExclusive)||
           fact.startByte<0||fact.endByteExclusive<=fact.startByte||
           fact.endByteExclusive>blob.size||typeof fact.path!=='string')
          fail('PROJECTION_PROVENANCE','source ordinal or source path invalid');
        previousOrdinal=fact.sourceOrdinal;
        records.push(fact);sourceFacts++;
      }
    }
    if(sourceFacts!==head.factCount)
      fail('PROJECTION_CENSUS','not every committed fact is present');
    // Pages and HEAD share one commit-generation/source/config identity.
    // Detect accidental tampering or partial IndexedDB writes before making
    // ANY match, CSV hash, or engineering claim. This is an unkeyed integrity
    // check, not an anti-malicious-writer authentication signature.
    const domainDigest=await sha256(domainPageHashes.join('\n'));
    const evidenceDigest=await sha256(evidencePageHashes.join('\n'));
    if(domainDigest!==head.domainSha256||
       evidenceDigest!==head.matchingEvidenceDigestSha256)
      fail('PROJECTION_PAGE_INTEGRITY',
        'committed consumer facts/evidence differ from original page checksum');
    // The current supported real corpus has root branch + leaf consumers only.
    // A nested non-fact component would affect fallback sequence/context; fail
    // closed rather than silently drop it in a reconstructed engineering input.
    if(head.traversedDomainObjects!==head.factCount+head.rootBranches)
      fail('TOPOLOGY_NOT_PROVEN','non-fact domain occurrences require separate product adapter');
    for(let i=0;i<head.rootBranches;i++)branches.push(null);
    let previousSequence=0;
    for(const fact of records){
      if(!Number.isInteger(fact.jsonSequence)||fact.jsonSequence<=previousSequence)
        fail('DOMAIN_SEQUENCE','source records are not in global document order');
      previousSequence=fact.jsonSequence;
      const match=fact.path.match(/^\$\[(\d+)\]\.children\[(\d+)\]$/);
      if(!match)fail('TOPOLOGY_NOT_PROVEN','nested/non-leaf source domain requires explicit support');
      const root=Number(match[1]),child=Number(match[2]);
      if(root>=head.rootBranches||!Number.isSafeInteger(child))
        fail('TOPOLOGY_NOT_PROVEN','invalid source branch index');
      if(!branches[root]){
        branches[root]={type:'BRANCH',name:fact.branchName,children:[]};
      }
      const branch=branches[root];
      if(branch.name!==fact.branchName||child!==branch.children.length)
        fail('TOPOLOGY_NOT_PROVEN','source branch membership or child ordering differs');
      branch.children.push(slimNode(fact));
    }
    if(branches.some(b=>!b))
      fail('TOPOLOGY_NOT_PROVEN','empty source branch requires original source facts');
    const indexReadyMs=performance.now()-started;
    await assertHeadsCurrent();
    if(onBeforeResolve)await onBeforeResolve();
    await assertHeadsCurrent();
    const result=runStandaloneResolverJsonTrace({
      sourceText:xmlText,sourceKind:'xml',stagedJsonText:branches,
      jsonConfig:config
    });
    const nodeCsv=buildXmlNodeWiseTraceCsv(result);
    const evidenceCsv=buildEvidenceTreeCsv(result);
    const recordsOut=result.traceResolutionLedger?.records||[];
    const statusCounts=recordsOut.reduce((a,row)=>{
      a[row.status]=(a[row.status]||0)+1;return a;
    },{});
    const digest=await sha256(JSON.stringify(recordsOut));
    const output={schema:MATCH_SCHEMA,originalBytes:blob.size,
      originalSha256:expectedSha256,sourceOccurrenceCount:source.sourceCount,
      projectionFacts:head.factCount,projectionSha256:head.domainSha256,
      projectionConfigDigest:head.consumerManifestDigest,
      matchingEvidenceDigestSha256:evidenceDigest,
      xmlNodes:recordsOut.length,matchedXmlNodes:recordsOut.filter(r=>
        r.status.startsWith('RESOLVED_')).length,
      statusCounts,xmlRecordsSha256:digest,
      nodeWiseCsvSha256:await sha256(nodeCsv),
      evidenceTreeCsvSha256:await sha256(evidenceCsv),
      nodeWiseCsvBytes:new TextEncoder().encode(nodeCsv).length,
      evidenceTreeCsvBytes:new TextEncoder().encode(evidenceCsv).length,
      indexReadyMs,elapsedMs:performance.now()-started,
      sourceOnly:true,engineeringReady:false,downloadAuthorized:false,
      appWired:false,validatedTopology:'FLAT_BRANCHES_ONLY'};
    // No final evidence/CSV result may escape after either dependency HEAD
    // was superseded during a long synchronous Resolver/async digest stage.
    await assertHeadsCurrent();
    return output;
  }finally{source.close();db?.close();}
}
