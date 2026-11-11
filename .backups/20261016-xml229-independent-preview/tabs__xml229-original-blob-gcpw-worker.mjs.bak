/**
 * XML229 P4-D — original staged JSON Blob stays INSIDE this Worker.
 * Rehash the original Blob, reconstruct the full current InputBasis here,
 * compute actual Preview and every source-bound physical FactRecord here,
 * and keep the complete GC-PW Weight/Final review service here.
 *
 * Only bounded facts/proposals or explicit CAS decision results cross to UI.
 * O1 INDEX_COMMITTED is never itself a Preview engineering approval.
 */
import {installWeightBasisXmlDom} from '../workers/weight-basis-xml-dom.js';
import {xmlCiiDryRunPreview}
 from '../ui-adapted/xml-cii-adapted-preview-dryrun.js';
import {projectXmlCiiOccurrences}
 from '../ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {createPreviewBasis}
 from '../ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import {openXml229EngineeringFactModel}
 from './xml229-preview-engineering-fact-producer.mjs';
import {isolatedOriginalPreviewWorkConfig} from './xml229-original-preview-work-config.mjs';
import {openGcPwPreviewWeightSession}
 from './gc-pw-preview-weight-session.js';
import {readVerifiedIndividualWeightReview,commitVerifiedIndividualWeightReview}
 from '../../../converters/xml-cii2019-core/weight-facts-individual-review.js';
import {readVerifiedModeAFinalRows}
 from '../../../converters/xml-cii2019-core/weight-facts-mode-a-final-read.js';
import {commitXml229NativeFinalIntent}
 from '../../../converters/xml-cii2019-core/weight-facts-native-consumption-intent.js';
import {attestXml229OriginalPhysicalEngineInput}
 from './xml229-r2-physical-transfer-manifest.mjs';
import {digestUtf8,canonicalJson}
 from '../../../contracts/gc-pw-v1/contract.mjs';
import {buildXml229VerifiedWeightRowProjection}
 from './xml229-verified-weight-row-adapter.mjs';
import {planXml229QualifiedBlankFill,commitXml229QualifiedBlankFill}
 from './xml229-source-weight-bulk-review.mjs';
import {projectXml229WeightDecisionProvenance}
 from './xml229-weight-decision-provenance.mjs';
import {exportXml229SourceBoundReviewBackup,restoreXml229SourceBoundReviewBackup}
 from './xml229-source-weight-review-transfer.mjs';

installWeightBasisXmlDom(globalThis);
const PROTOCOL='XML229.P4.WorkerHeldOriginalJsonGC-PW.v1';
const MAX_BLOB_BYTES=100*1024*1024,MAX_ORIGINAL_COUNT=250000,MAX_PHYSICAL=10000;
const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const fail=(code,message)=>{const e=new Error(message);e.code=code;e.retryable=false;throw e;};
const toHex=bytes=>Array.from(new Uint8Array(bytes),
  b=>b.toString(16).padStart(2,'0')).join('');
let started=false,active='',cancelled=false,ready=null,sourceReceipt=null,physicalIdentityList=null,originalXmlCustody=null,verifiedPreviewResult=null;
let weightProjection=null,pendingBulk=null,bulkSequence=0;
// Only contemporaneous successful Worker RPCs prove bulk confirmation.
let confirmedBulkCommands=new Set(),restoringReview=false;
const post=(id,data)=>postMessage({protocol:PROTOCOL,requestId:id,...data});
const progress=(id,stage)=>post(id,{state:'progress',stage});
const sourceReceiptCheck=(r,blob)=>{
 if(r?.schema!=='XML229.OriginalStagedSourceReceipt.v1'||
    r.phase!=='INDEX_COMMITTED'||r.rightsBasis!=='SOURCE_FACTS_ONLY'||
    r.engineeringReady!==false||!hash(r.sha256)||
    typeof r.sourceRevision!=='string'||
    !r.sourceRevision.endsWith(':sha256:'+r.sha256)||
    !r.generationId||!r.sourceRefId||
    !Number.isSafeInteger(r.occurrenceCount)||r.occurrenceCount<1||
    r.occurrenceCount>2000000||
    !Number.isSafeInteger(r.pageCount)||r.pageCount<1||
    !(blob instanceof Blob)||blob.size!==r.byteLength||
    blob.size<=0||blob.size>MAX_BLOB_BYTES)
   fail('ORIGINAL_STAGED_BLOB_NOT_ATTESTED',
    'Original O1 Blob/receipt is not independently committed or outside 100 MiB/2m range');
};
function exactCensus(prepared,req,original){
 const sourceIds=[...original.branches,...original.nodes].map(x=>
    JSON.stringify([x.subjectType,x.sourceId,x.occurrenceId]));
 const independent=req.independentSourceOccurrences;
 if(!Array.isArray(independent)||sourceIds.length!==independent.length||
    sourceIds.some((s,i)=>s!==JSON.stringify([
       independent[i]?.subjectType,independent[i]?.sourceId,independent[i]?.occurrenceId,
    ])))
   fail('ORIGINAL_INDEPENDENT_CENSUS_DRIFT',
     'Original XML changed relative to independent raw-source occurrence census');
 const phys=prepared.physicalOccurrences.map(p=>canonicalJson([
   p.sourceId,p.branchOccurrenceIndex,p.nodeOrdinal,p.componentSignature]));
 const expected=req.independentPhysicalOccurrences;
 if(!Array.isArray(expected)||expected.length!==phys.length||
    expected.some((p,i)=>canonicalJson([
      p.sourceId,p.branchOccurrenceIndex,p.nodeOrdinal,p.componentSignature,
    ])!==phys[i]))
   fail('PHYSICAL_INDEPENDENT_CENSUS_DRIFT',
     'Physical Owner population differs from separately committed original source census');
}
async function start(req){
 const {sourceId,xmlText,masters,selection,config,overrides={},originalStagedBlob,
   originalStagedSourceReceipt:r,expectedOriginalCount}=req;
 if(typeof xmlText!=='string'||!xmlText.trim()||
    typeof sourceId!=='string'||!sourceId.trim()||
    !masters||typeof masters!=='object'||
    !config||typeof config!=='object'||!Array.isArray(selection)||
    selection.length!==1||selection[0].sourceId!==sourceId||
    selection[0].selectionRef!=='all')
   fail('ORIGINAL_XML_FULL_SCOPE_REQUIRED',
     'One full original Mode A XML, current masters, selected scope and config required');
 sourceReceiptCheck(r,originalStagedBlob);
 progress(req.requestId,'original-json-blob-sha256');
 const buffer=await originalStagedBlob.arrayBuffer();
 const actualSha=toHex(await crypto.subtle.digest('SHA-256',buffer));
 if(actualSha!==r.sha256)
   fail('ORIGINAL_JSON_SHA256_DRIFT','Worker-held JSON Blob no longer matches original O1 receipt');
 if(cancelled)return;
 const stagedSource=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
 const sources=[{sourceId,mediaType:'application/xml',text:xmlText}];
 progress(req.requestId,'full-original-source-master-basis');
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',sources,selection,masters,
   stagedSource,config,overrides,sha256:digestUtf8});
 if(cancelled)return;
 progress(req.requestId,'independent-original-xml-population');
 const original=projectXmlCiiOccurrences({xmlText,mode:'A',sourceId});
 if(!Number.isSafeInteger(expectedOriginalCount)||expectedOriginalCount<1||
    expectedOriginalCount!==original.branchCount+original.nodeCount||
    expectedOriginalCount>MAX_ORIGINAL_COUNT)
   fail('ORIGINAL_XML_SCOPE_OR_SCALE_DRIFT','Original branch/node census wrong or exceeds bounded Worker budget');
 progress(req.requestId,'engineering-preview-using-actual-json');
 // Dry-run enrichers may normalize nested master/config rows. Do not lend
 // their mutable working view the already-attested GC-PW master buffers.
 const computed=xmlCiiDryRunPreview(xmlText,isolatedOriginalPreviewWorkConfig(config),stagedSource);
 if(cancelled)return;
 progress(req.requestId,'all-physical-field-assessment');
 const previewResult={...computed,sourceOccurrences:original,
   engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false};
 const live={sources:{[sourceId]:xmlText},masters,selection,stagedSource,config,overrides};
 const produced=await openXml229EngineeringFactModel({
  basis,live,xmlText,sourceId,previewResult,expectedOriginalCount,
  maxPhysical:Math.min(req.maxPhysical??MAX_PHYSICAL,MAX_PHYSICAL),
 });
 exactCensus(produced,req,original);
 if(cancelled)return;
 progress(req.requestId,'gc-pw-one-basis-source-bound-weight-review');
 const opened=await openGcPwPreviewWeightSession({
   sources,selection,masters,stagedSource,config,overrides,
   originalOccurrences:produced.originalOccurrences,
   expectedOriginalCount:produced.expectedOriginalCount,
   physicalOccurrences:produced.physicalOccurrences,
   requiredFieldIds:produced.requiredFieldIds,
   requestId:'gc-pw-'+req.requestId,
   loadFactPages:async({basis:requested,report,isCancelled})=>{
     if(isCancelled()||cancelled)fail('CANCELLED','Original source superseded');
     if(requested?.basisId!==basis.basisId)
       fail('CROSS_BASIS_FACT_QUERY','Weight cannot read different original source/master basis');
     const pages=[];let cursor=null,done=0;
     do{
       const page=await produced.model.getFacts({basisId:basis.basisId,
         subjectType:'physical-component',cursor,limit:100});
       pages.push(page);done+=page.items.length;
       report(done,page.totalCount);
       cursor=page.nextCursor;
       if(isCancelled()||cancelled)fail('CANCELLED','Original source superseded');
     }while(cursor!==null);
     return pages;
   },
 });
 const session=await opened.awaitReady();
 if(cancelled)return;
 if(session.basis.basisId!==basis.basisId||
    session.openedFacts!==produced.expectedPhysicalFactCount)
   fail('VERIFIED_WEIGHT_SOURCE_DRIFT','Review service did not open complete original physical population');
 verifiedPreviewResult={branchRows:computed.branchRows,nodeRows:computed.nodeRows,
   sourceOccurrences:original,coverage:{sourceBranchCount:original.branchCount,
     originalNodeCount:original.nodeCount,engineeringBranchCount:computed.branchRows.length,
     legacyReviewNodeCount:computed.nodeRows.length},
   originalStagedSourceSha256:r.sha256,originalStagedSourceGeneration:r.generationId,
   engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false};
 const display=buildXml229VerifiedWeightRowProjection({
   session,sourceId,physicalOccurrences:produced.physicalOccurrences,
   originalOccurrences:original,previewResult:verifiedPreviewResult,
 });
 ready=session;sourceReceipt=r;originalXmlCustody=xmlText;
 physicalIdentityList=produced.physicalOccurrences;weightProjection=display;
 post(req.requestId,{state:'ready',basisId:basis.basisId,
   originalJsonSha256:r.sha256,sourceGenerationId:r.generationId,
   sourceId,originalCount:produced.workerOriginalCount,
   physicalCount:produced.physicalOccurrences.length,
   physicalFactCount:session.openedFacts,engineeringFactsVerified:true,
   weightEngineeringAccepted:false,finalEngineeringAccepted:false,
   stageRevisions:{
     match1:session.review.getDecisionState({basisId:basis.basisId,scopeId:sourceId,
       stage:'RigidMatch1'}).decisionRevision,
     final:session.review.getDecisionState({basisId:basis.basisId,scopeId:sourceId,
       stage:'Rigidmatch2'}).decisionRevision,
   },
 });
}
function verifiedRequest(req){
 if(!ready||cancelled||req.requestId!==active||
    req.basisId!==ready.basis.basisId||
    req.sourceGenerationId!==sourceReceipt?.generationId)
   fail('STALE_OR_UNVERIFIED_WEIGHT_SESSION',
    'Complete original source/GC-PW session is unavailable or has been replaced');
}
async function rpc(req){
 verifiedRequest(req);
 if(restoringReview&&(req.kind==='decision'||req.kind==='bulk-commit'||
    req.kind==='restore-review'||req.kind==='read'&&req.what==='bulk-plan'))
   fail('REVIEW_RESTORE_IN_PROGRESS',
    'Do not mix individual or bulk decisions with review restoration');
 const {sourceId,occurrenceId,stage}=req;
 const review=ready.review,basisId=ready.basis.basisId;
 if(req.kind==='read'){
   if(req.what==='preview'){
     if(!verifiedPreviewResult)fail('PREVIEW_RESULT_NOT_READY','Verified original engineering Preview result is missing');
     return verifiedPreviewResult;
   }
   if(req.what==='attest-engine-input'){
     if(typeof req.engineInputXmlText!=='string'||!req.engineInputXmlText.trim()||
       req.engineInputXmlText.length>24*1024*1024)
       fail('ENGINE_INPUT_ATTESTATION_BOUNDED','Native XML input must be provided as a bounded exact string; no UI fallback');
     return attestXml229OriginalPhysicalEngineInput({
       session:ready,sourceId:ready.basis.scope[0]?.sourceId,
       originalXmlText:originalXmlCustody,
       engineInputXmlText:req.engineInputXmlText,
       originalJsonSha256:sourceReceipt.sha256,
       sourceGenerationId:sourceReceipt.generationId,
       independentlyEnumeratedOriginalPhysical:physicalIdentityList,
     });
   }
   if(req.what==='native-final-intent'){
     return commitXml229NativeFinalIntent(ready,{
       originalJsonSha256:sourceReceipt.sha256,
       sourceGenerationId:sourceReceipt.generationId,
     });
   }
   if(req.what==='completion'){
     const full=readVerifiedModeAFinalRows(ready);
     const counts={source:0,match1:0,final:0,unresolved:0};
     for(const row of full.rows){
       if(row.finalKg!==null)counts.final++;
       else if(row.match1Kg!==null)counts.match1++;
       else if(row.sourceKg!==null)counts.source++;
       else counts.unresolved++;
     }
     if(full.physicalCount!==(physicalIdentityList?.length??-1)||
        full.verifiedFactCount!==ready.openedFacts)
       fail('GC_PW_FULL_SOURCE_COMPLETENESS_DRIFT',
         'All original physical occurrences and FactRecords must be accounted for');
     return {schema:'XML229.P4.RunAdvisory.v1',basisId,sourceId:ready.basis.scope[0]?.sourceId,
       originalJsonSha256:sourceReceipt.sha256,
       sourceGenerationId:sourceReceipt.generationId,
       verifiedPhysicalCount:full.physicalCount,
       verifiedFactCount:full.verifiedFactCount,
       stageRevisions:full.revisionBySource,
       counts,engineeringFactsVerified:true,
       previewStatus:'FULL_SOURCE_FACTS_VERIFIED',
       weightStatus:counts.unresolved>0?'PROPOSED_OR_UNRESOLVED':'REVIEWED_SOURCE_MASSES',
       ciiReleaseAuthorized:false,
       releaseReason:'Native CII output has not consumed independent source-bound Final snapshot or authoritative Run gates',
     };
   }
   if(req.what==='review-backup'){
     const proof=await rpc({...req,what:'completion'});
     const backup=await exportXml229SourceBoundReviewBackup(review,{
       basisId,sourceId,proof,
     });
     // Digest-only metadata (no source/master contents). Useful to locate
     // which exact InputBasis field changed on a legitimate browser restart.
     const basis=ready.basis;
     return {...backup,inputBasisDigests:{
       sourceRefs:basis.sourceRefs,
       masters:basis.masters,
       selectionSha256:basis.selectionSha256,
       stagedSourceSha256:basis.stagedSourceSha256,
       configSha256:basis.configSha256,
       overridesSha256:basis.overridesSha256,
       scope:basis.scope,
     }};
   }
   if(req.what==='decision-provenance'){
     // Current complete engineering proof + original service command ledger.
     // The raw command payloads remain inside this private Worker.
     const completion=await rpc({...req,what:'completion'});
     const reviewState=await review.exportReviewState({basisId});
     return projectXml229WeightDecisionProvenance({
       reviewState,basisId,sourceId,completion,
       confirmedBulkCommandIds:[...confirmedBulkCommands],
     });
   }
   if(req.what==='page'){
     if(!Number.isSafeInteger(req.offset)||req.offset<0||
        !Number.isSafeInteger(req.limit)||req.limit<1||req.limit>25)
       fail('INVALID_REVIEW_PAGE','Physical review page offset and length 1..25 required');
     if(!weightProjection||weightProjection.count!==physicalIdentityList?.length)
       fail('PRESENTATION_NOT_VERIFIED','Complete original physical presentation projection required');
     const mode=req.filter??'all',query=String(req.query??'').toLowerCase().trim();
     if(!['all','rigid','needs-review'].includes(mode)||query.length>120)
       fail('INVALID_WEIGHT_REVIEW_FILTER','Filter must be all, rigid or needs-review');
     const match=review.getDecisionState({basisId,scopeId:sourceId,stage:'RigidMatch1'}).decisions;
     const final=review.getDecisionState({basisId,scopeId:sourceId,stage:'Rigidmatch2'}).decisions;
     const candidates=(physicalIdentityList||[]).filter(id=>{
       const oid=id.occurrenceId||JSON.stringify([
         id.sourceId,id.branchOccurrenceIndex,id.nodeOrdinal,id.componentSignature]);
       const meta=weightProjection.get(oid);
       if(mode==='rigid'&&!/^RIGID/i.test(meta.componentType))return false;
       if(mode==='needs-review'&&(
         final[oid]?.state==='accepted'||match[oid]?.state==='accepted'||
         (typeof meta.sourceKg==='number'&&meta.sourceKg>0)))return false;
       if(query){
         const hay=[meta.branchName,meta.lineKey,meta.componentType,meta.nodeNumber,
           meta.componentRefNoEndpoint,meta.dtxr,meta.rating,meta.sourceId,meta.occurrenceId]
           .join(' ').toLowerCase();
         if(!hay.includes(query))return false;
       }
       return true;
     });
     if(req.offset>=candidates.length&&req.offset!==0)
       fail('REVIEW_PAGE_OUTSIDE_SOURCE','Review filter offset exceeds current population');
     const selected=candidates.slice(req.offset,req.offset+req.limit);
     const ids=selected.map(x=>x.occurrenceId||JSON.stringify([
       x.sourceId,x.branchOccurrenceIndex,x.nodeOrdinal,x.componentSignature]));
     const sourceProposals=ids.length?weightProjection.proposals(ids):new Map();
     const rows=selected.map((id,i)=>{
       const occurrenceId=ids[i];
       const match1=readVerifiedIndividualWeightReview(ready,{
         sourceId:id.sourceId,occurrenceId,stage:'RigidMatch1'});
       const finalReview=readVerifiedIndividualWeightReview(ready,{
         sourceId:id.sourceId,occurrenceId,stage:'Rigidmatch2'});
       if(match1.basisId!==basisId||finalReview.basisId!==basisId||
          match1.occurrenceId!==finalReview.occurrenceId)
         fail('CROSS_STAGE_PROPOSAL_ID_DRIFT','Match-1/Final identity mismatch');
       const provenance=sourceProposals.get(occurrenceId)||[];
       if(match1.proposals.length!==provenance.length||
          match1.proposals.some((p,j)=>p.proposalId!==provenance[j]?.proposalId))
         fail('PRESENTATION_PROPOSAL_DRIFT','Scored candidates differ from reviewed proposals');
       return {...weightProjection.get(occurrenceId),
         componentSignature:id.componentSignature,sourceKg:match1.sourceKg,
         match1Kg:match1.match1Kg,finalKg:finalReview.finalKg,
         proposedKg:provenance[0]?.value??null,proposals:provenance,
         match1View:match1,finalView:finalReview};
     });
     return {basisId,offset:req.offset,totalCount:candidates.length,
       populationCount:physicalIdentityList.length,complete:true,rows};
   }
   if(req.what==='bulk-plan'){
     pendingBulk=null;
     const result=planXml229QualifiedBlankFill(review,weightProjection,{
       basisId,sourceId,sequence:++bulkSequence,
     });
     pendingBulk=result.pending; // Worker private; only planId + summary leave.
     return result.summary;
   }
   if(req.what==='individual'){
     return readVerifiedIndividualWeightReview(ready,{sourceId,occurrenceId,stage});
   }
   if(req.what==='facts'){
     return review.getFacts({basisId,sourceId,
       subjectType:'physical-component',cursor:req.cursor??null,
       limit:Math.min(100,Math.max(1,req.limit??100))});
   }
   if(req.what==='proposals'){
     if(!Array.isArray(req.occurrenceIds)||req.occurrenceIds.length<1||
       req.occurrenceIds.length>64)
       fail('INVALID_PROPOSAL_PAGE','Bounded source occurrence list required');
     return review.getProposals({basisId,occurrenceIds:req.occurrenceIds,
       cursor:req.cursor??null,limit:Math.min(100,Math.max(1,req.limit??100))});
   }
   if(req.what==='decisions'){
     return review.getDecisionState({basisId,scopeId:sourceId,stage});
   }
   fail('UNKNOWN_READ_KIND','Fact/proposal/individual/decisions only');
 }
 if(req.kind==='restore-review'){
   // One-shot user-selected file import after a separately rebuilt verified
   // source/master Worker. Never implicitly hydrate legacy localStorage.
   if(restoringReview)fail('REVIEW_RESTORE_IN_PROGRESS');
   restoringReview=true;
   try{
     const proof=await rpc({...req,kind:'read',what:'completion'});
     const result=await restoreXml229SourceBoundReviewBackup(review,req.backup,{
       basisId,sourceId,proof,
     });
     const after=await rpc({...req,kind:'read',what:'completion'});
     const expected=req.backup?.counts;
     if(!expected||['source','match1','final','unresolved'].some(
       key=>after.counts[key]!==expected[key]))
       fail('RESTORED_REVIEW_CENSUS_DRIFT',
         'Restored decision census differs from exact saved original-source counts');
     pendingBulk=null;
     confirmedBulkCommands=new Set();
     return {...result,counts:after.counts,stageRevisions:after.stageRevisions};
   }finally{restoringReview=false;}
 }
 if(req.kind==='bulk-commit'){
   const pending=pendingBulk;pendingBulk=null;
   const result=commitXml229QualifiedBlankFill(review,{
     basisId,sourceId,pending,planId:req.planId,
   });
   if(result.acceptedCount>0)for(const cmd of pending.plan.commands)
     confirmedBulkCommands.add(cmd.commandId);
   return result;
 }
 if(req.kind==='decision'){
   pendingBulk=null;
   if(!req.view||req.view.basisId!==basisId||
     req.view.stage!==stage||req.view.sourceId!==sourceId||
     req.view.occurrenceId!==occurrenceId)
     fail('REVIEW_VIEW_REQUIRED','Original source, current CAS view and stage required');
   // Existing service independently rereads every fact/proposal/revision;
   // Final values require positive kg and explicit engineering reason.
   const result=commitVerifiedIndividualWeightReview(ready,req.view,req.choice||{});
   return {view:result.view,snapshot:result.snapshot,
     decisionRevision:result.result.decisionRevision};
 }
 fail('UNKNOWN_RPC_KIND','Only source-bound read and explicit reviewed decision permitted');
}
self.addEventListener('message',async({data:req})=>{
 if(req?.protocol!==PROTOCOL||!req.requestId)return;
 if(req.kind==='cancel'&&req.requestId===active){
   cancelled=true;ready=null;sourceReceipt=null;physicalIdentityList=null;originalXmlCustody=null;verifiedPreviewResult=null;weightProjection=null;pendingBulk=null;confirmedBulkCommands=new Set();
   post(req.requestId,{state:'cancelled'});self.close();return;
 }
 if(req.kind==='start'){
   confirmedBulkCommands=new Set();
   if(started){post(req.requestId,{state:'failed',error:{code:'ONE_SHOT_SOURCE_WORKER'}});return;}
   started=true;active=req.requestId;
   try{await start(req)}
   catch(error){if(!cancelled)post(req.requestId,{state:'failed',
    error:{code:error?.code||'ORIGINAL_BLOB_WEIGHT_WORKER_FAILED',
      message:String(error?.message||error)}});}
   return;
 }
 if(req.kind==='read'||req.kind==='decision'||req.kind==='bulk-commit'||
    req.kind==='restore-review'){
   try{const value=await rpc(req);if(!cancelled)post(req.requestId,{
    state:'rpc-result',rpcId:req.rpcId,value,
   });}
   catch(error){if(!cancelled)post(req.requestId,{
    state:'rpc-failed',rpcId:req.rpcId,
    error:{code:error?.code||'SOURCE_WEIGHT_RPC_FAILED',
      message:String(error?.message||error)},
   });}
 }
});
