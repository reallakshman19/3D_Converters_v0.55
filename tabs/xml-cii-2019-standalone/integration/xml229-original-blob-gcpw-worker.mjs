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
import {runXml229IndependentEngineeringPreview}
 from './xml229-independent-engineering-preview-client.mjs';
import {projectXmlCiiOccurrences}
 from '../ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {createPreviewBasis}
 from '../ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import {openXml229EngineeringFactModel}
 from './xml229-preview-engineering-fact-producer.mjs';
import {openGcPwPreviewWeightSession}
 from './gc-pw-preview-weight-session.js';
import {buildXml229CandidateCoverageReport}
 from './xml229-candidate-coverage-report.mjs';
import {reconcileXml229CandidateCoverage}
 from '../../../contracts/xml229-evidence-v1/candidate-readiness-reconciliation.mjs';
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
import {xml229WeightReviewFilters,matchesXml229WeightReviewFilter}
 from './xml229-weight-page-filter.mjs';
import {XML229_WEIGHT_COLUMNS,xml229ExcelCell,parseXml229ExcelRequest,
 matchesXml229ExcelColumns,sortXml229ExcelRows,xml229ExcelColumnOptions,
 isXml229VerifiedShortPhysical}
 from './xml229-weight-excel-filter.mjs';
import {xml229WeightReviewEligible,xml229ProposalScorePercent,xml229WeightThreshold}
 from './xml229-weight-review-focus.mjs';
import {projectXml229AuditedDecisionProvenance}
 from './xml229-accepted-match1-family-audit.mjs';
import {exportXml229SourceBoundReviewBackup,restoreXml229SourceBoundReviewBackup}
 from './xml229-source-weight-review-transfer.mjs';

import {resolveXml229ReviewSourceInput} from './xml229-review-source-input.mjs';
installWeightBasisXmlDom(globalThis);
const PROTOCOL='XML229.P4.WorkerHeldOriginalJsonGC-PW.v1';
const MAX_ORIGINAL_COUNT=250000,MAX_PHYSICAL=10000;
const fail=(code,message)=>{const e=new Error(message);e.code=code;e.retryable=false;throw e;};
let started=false,active='',cancelled=false,ready=null,sourceReceipt=null,physicalIdentityList=null,originalXmlCustody=null,verifiedPreviewResult=null,finalizedGeometry=null;
let weightProjection=null,pendingBulk=null,bulkSequence=0,previewAbortController=null;
// Only contemporaneous successful Worker RPCs prove bulk confirmation.
let confirmedBulkCommands=new Set(),restoringReview=false;
const post=(id,data)=>postMessage({protocol:PROTOCOL,requestId:id,...data});
const progress=(id,stage)=>post(id,{state:'progress',stage});
// Bounded categorical events only; request/source/master bytes never leave Worker.
const flow=(id,kind,counts)=>post(id,{state:'flow-trace',trace:{kind,
  ...(counts?{counts}:{}),actor:'gc-pw-worker'}});
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
   expectedOriginalCount}=req;
 if(typeof xmlText!=='string'||!xmlText.trim()||
    typeof sourceId!=='string'||!sourceId.trim()||
    !masters||typeof masters!=='object'||
    !config||typeof config!=='object'||!Array.isArray(selection)||
    selection.length!==1||selection[0].sourceId!==sourceId||
    selection[0].selectionRef!=='all')
   fail('ORIGINAL_XML_FULL_SCOPE_REQUIRED',
     'One full original Mode A XML, current masters, selected scope and config required');
 const sourceInput=await resolveXml229ReviewSourceInput(req);
 const r=sourceInput.identity;
 flow(req.requestId,'GC_PW_WORKER_STARTED');
 progress(req.requestId,sourceInput.kind==='XML_ONLY'?'original-xml-sha256':'original-json-blob-sha256');
 if(cancelled)return;
 const stagedSource=sourceInput.stagedSource;
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
 progress(req.requestId,sourceInput.kind==='XML_ONLY'?'engineering-preview-xml-only':'engineering-preview-using-actual-json');
 flow(req.requestId,'PREVIEW_CHILD_REQUESTED');
 // Dry-run enrichers may normalize nested master/config rows. Do not lend
 // their mutable working view the already-attested GC-PW master buffers.
 const abort=new AbortController();previewAbortController=abort;
 let computed;
 try{
   computed=await runXml229IndependentEngineeringPreview({
     requestId:req.requestId,sourceId,basisId:basis.basisId,
     sourceGenerationId:r.generationId,originalJsonSha256:r.sha256,
     reviewSourceKind:sourceInput.kind,sourceXmlSha256:sourceInput.xmlSha256,
     originalStagedBlob,xmlText,config,signal:abort.signal,
     onProgress:stage=>progress(req.requestId,stage),
   });
 }finally{if(previewAbortController===abort)previewAbortController=null;}
 if(cancelled)return;
 flow(req.requestId,'PREVIEW_CHILD_COMPLETED');
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
 flow(req.requestId,'FACTS_OPENED',{physical:produced.physicalOccurrences.length,
   facts:session.openedFacts});
 if(session.basis.basisId!==basis.basisId||
    session.openedFacts!==produced.expectedPhysicalFactCount)
   fail('VERIFIED_WEIGHT_SOURCE_DRIFT','Review service did not open complete original physical population');
 verifiedPreviewResult={branchRows:computed.branchRows,nodeRows:computed.nodeRows,
   // Display-only independent Format 1/2 passes; the canonical authoritative
   // branch rows remain ambiguous until explicit review.
   formatPreviewPasses:Array.isArray(computed.formatPreviewPasses)
     ?computed.formatPreviewPasses:[],
   sourceOccurrences:original,coverage:{sourceBranchCount:original.branchCount,
     originalNodeCount:original.nodeCount,engineeringBranchCount:computed.branchRows.length,
     legacyReviewNodeCount:computed.nodeRows.length},
   originalStagedSourceSha256:r.sha256,originalStagedSourceGeneration:r.generationId,
   engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false};
 const display=buildXml229VerifiedWeightRowProjection({
   session,sourceId,physicalOccurrences:produced.physicalOccurrences,
   originalOccurrences:original,previewResult:verifiedPreviewResult,config,
 });
 ready=session;sourceReceipt=r;originalXmlCustody=xmlText;
 finalizedGeometry=produced.finalizedGeometry;
 physicalIdentityList=produced.physicalOccurrences;weightProjection=display;
 flow(req.requestId,'GC_PW_READY',{physical:produced.physicalOccurrences.length,
   facts:session.openedFacts});
 post(req.requestId,{state:'ready',basisId:basis.basisId,
   reviewSourceKind:sourceInput.kind,sourceXmlSha256:sourceInput.xmlSha256,
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
function currentRunAdvisory(){
 const basisId=ready.basis.basisId;
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
     ...(sourceReceipt.schema==='XML229.XmlOnlyReviewSource.v1'?{
       reviewSourceKind:'XML_ONLY',sourceXmlSha256:ready.basis.sourceRefs[0].sha256}:{}),
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
function currentCandidateCoverage(){
     const source=ready.basis.scope[0]?.sourceId;
     if(!weightProjection||weightProjection.count!==physicalIdentityList?.length)
       fail('COVERAGE_PRESENTATION_NOT_READY','Current source-bound physical projection required');
     return buildXml229CandidateCoverageReport({
       session:ready,sourceId:source,physicalOccurrences:physicalIdentityList,
       weightProjection,sourceReceipt,requestId:active,
       readCurrentSession:()=>({
         basisId:ready?.basis?.basisId,sourceGenerationId:sourceReceipt?.generationId,
         requestId:active,closed:cancelled,
       }),
     });
}
async function rpc(req){
 verifiedRequest(req);
 if(restoringReview&&(req.kind==='decision'||req.kind==='bulk-commit'||
    req.kind==='restore-review'||req.kind==='read'&&
    ['bulk-plan','candidate-coverage','candidate-readiness-pair'].includes(req.what)))
   fail('REVIEW_RESTORE_IN_PROGRESS',
    'Do not mix individual or bulk decisions with review restoration');
 const {sourceId,occurrenceId,stage}=req;
 const review=ready.review,basisId=ready.basis.basisId;
 if(req.kind==='read'){
   if(sourceReceipt.schema==='XML229.XmlOnlyReviewSource.v1'&&req.what==='attest-engine-input')
     fail('NATIVE_XML_ONLY_R2_ATTESTATION_NOT_SUPPORTED');
   if(req.what==='instrument-suggestions'){
     return {schema:'XML229.OptionalInstrumentModelSuggestions.v1',
       basisId,sourceXmlSha256:finalizedGeometry?.sourceXmlSha256,
       approvalRequired:false,readOnly:true,
       sourceGeometryChanged:false,weightsAcceptedBySuggestions:false,
       items:finalizedGeometry?.instrumentModelingSuggestions||[]};
   }
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
       ...(sourceReceipt.schema==='XML229.XmlOnlyReviewSource.v1'?{reviewSourceKind:'XML_ONLY',sourceXmlSha256:ready.basis.sourceRefs[0].sha256}:{}),
       originalJsonSha256:sourceReceipt.sha256,
       sourceGenerationId:sourceReceipt.generationId,
     });
   }
   if(req.what==='native-final-packet'){
     // Private Worker-owned weight input to the native converter. This is
     // actual accepted Source/Final mass, never candidate or localStorage.
     const intent=await commitXml229NativeFinalIntent(ready,{
       ...(sourceReceipt.schema==='XML229.XmlOnlyReviewSource.v1'?{reviewSourceKind:'XML_ONLY',sourceXmlSha256:ready.basis.sourceRefs[0].sha256}:{}),
       originalJsonSha256:sourceReceipt.sha256,
       sourceGenerationId:sourceReceipt.generationId,
     });
     const full=readVerifiedModeAFinalRows(ready);
     if(!intent.eligibleForEngineBinding||
        full.rows.length!==physicalIdentityList?.length||
        full.basisId!==intent.basisId||
        !ready.basis.sourceRefs?.[0]?.sha256||
        finalizedGeometry?.schema!=='XML229.FinalizedWeightGeometry.v1'||
        finalizedGeometry?.basisId!==intent.basisId||
        finalizedGeometry?.sourceXmlSha256!==ready.basis.sourceRefs[0].sha256||
        full.rows.some(row=>row.status==='Needs review'||row.status==='Match-1'||
           !(typeof row.effectiveKg==='number'&&Number.isFinite(row.effectiveKg)&&row.effectiveKg>=0)))
       fail('NATIVE_FINAL_MASS_CENSUS_UNREADY',
         'Every original physical needs an accepted nonnegative Source/Final mass; native zero-mass lineage is verified separately');
     return {
       schema:'XML229.NativeFinalPhysicalPacket.v1',
       ...(sourceReceipt.schema==='XML229.XmlOnlyReviewSource.v1'?{reviewSourceKind:'XML_ONLY'}:{}),
       basisId:full.basisId,sourceId,
       originalJsonSha256:sourceReceipt.sha256,
       sourceGenerationId:sourceReceipt.generationId,
       sourceXmlSha256:ready.basis.sourceRefs[0].sha256,
       finalIntentSha256:intent.intentSha256,
       physicalCount:full.rows.length,
       finalizedGeometry,
       components:full.rows.map(row=>({
         occurrenceId:row.occurrenceId,
         effectiveKg:row.effectiveKg,
       })),
       nativeCiiReleaseAuthorized:false,
     };
   }
   if(req.what==='completion')return currentRunAdvisory();
   if(req.what==='review-backup'){
     const proof=await rpc({...req,what:'completion'});
     const backup=await exportXml229SourceBoundReviewBackup(review,{
       basisId,sourceId,proof,
     });
     // Digest-only metadata (no source/master contents). Useful to locate
     // which exact InputBasis field changed on a legitimate browser restart.
     const basis=ready.basis;
     return {...backup,
       finalizedGeometrySha256:finalizedGeometry?.sha256,
       physicalOwnerSchema:finalizedGeometry?.physicalOwnerCardinality?.schema,
       inputBasisDigests:{
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
     return projectXml229AuditedDecisionProvenance({
       review,weightProjection,basisId,sourceId,
       completion:await rpc({...req,what:'completion'}),
       confirmedBulkCommandIds:[...confirmedBulkCommands],
     });
   }
   if(req.what==='candidate-coverage')return currentCandidateCoverage();
   if(req.what==='candidate-readiness-pair'){
     // Synchronous inside one Worker message event: review writes/restore RPCs
     // cannot interleave these two reads. Read-only, no release authority.
     const coverage=currentCandidateCoverage();
     const readiness=currentRunAdvisory();
     const reconciliation=reconcileXml229CandidateCoverage({coverage,readiness});
     if(reconciliation.status!=='CONSISTENT')
       fail('COVERAGE_READINESS_INCONSISTENT','Current full-source candidate and Run advisory receipts disagree');
     verifiedRequest(req);
     return {schema:'XML229.G3G4.SourceBoundAggregatePair.v1',
       coverage,readiness,reconciliation,readOnly:true,
       reviewDecisionsAuthorized:false,nativeCiiReleaseAuthorized:false};
   }
   if(req.what==='page'||req.what==='column-options'){
     const optionsRequest=req.what==='column-options';
     if(!optionsRequest&&(!Number.isSafeInteger(req.offset)||req.offset<0||
        !Number.isSafeInteger(req.limit)||req.limit<1||req.limit>25))
       fail('INVALID_REVIEW_PAGE','Physical review page offset and length 1..25 required');
     if(!weightProjection||weightProjection.count!==physicalIdentityList?.length)
       fail('PRESENTATION_NOT_VERIFIED','Complete original physical presentation projection required');
     const mode=req.filter??'all',query=String(req.query??'').toLowerCase().trim();
     if(!xml229WeightReviewFilters.includes(mode)||query.length>120)
       fail('INVALID_WEIGHT_REVIEW_FILTER','Filter must be all, rigid, blank-rigid or needs-review');
     const {columnFilters,sort}=parseXml229ExcelRequest(req);
     // Display-only exclusion: no source records, facts, mass decisions,
     // original physical census or native output geometry are mutated.
     if(req.hideShortMm!==undefined&&typeof req.hideShortMm!=='boolean')
       fail('WEIGHT_SHORT_VIEW_FLAG_INVALID','Hide <=6 mm is a display-only Boolean option');
     const hideShortMm=req.hideShortMm===true;
     const match=review.getDecisionState({basisId,scopeId:sourceId,stage:'RigidMatch1'}).decisions;
     const final=review.getDecisionState({basisId,scopeId:sourceId,stage:'Rigidmatch2'}).decisions;
     const suggestionRequired=optionsRequest&&req.column==='nearestSuggestions'||
       !!columnFilters.nearestSuggestions||sort?.column==='nearestSuggestions';
     const oidOf=id=>id.occurrenceId||JSON.stringify([
       id.sourceId,id.branchOccurrenceIndex,id.nodeOrdinal,id.componentSignature]);
     const suggestions=suggestionRequired?weightProjection.proposals(
       physicalIdentityList.map(oidOf)):null;
     const candidates=[];let hiddenShortCount=0;
     for(const [index,id] of physicalIdentityList.entries()){
       const oid=oidOf(id),meta=weightProjection.get(oid);
       if(!matchesXml229WeightReviewFilter(mode,{
         componentType:meta.componentType,nodeName:meta.nodeName,dtxr:meta.dtxr,
         sourceKg:meta.sourceKg,
         match1State:match[oid]?.state,finalState:final[oid]?.state,
       }))continue;
       if(query){
         const hay=[meta.branchName,meta.lineKey,meta.componentType,meta.nodeNumber,
           meta.componentRefNoEndpoint,meta.nodeName,meta.shortName,meta.inferredValveName,
           meta.dtxr,meta.rating,meta.sourceId,meta.occurrenceId]
           .join(' ').toLowerCase();
         if(!hay.includes(query))continue;
       }
       if(hideShortMm&&isXml229VerifiedShortPhysical(meta)){
         hiddenShortCount++;continue;
       }
       const cells=Object.fromEntries(XML229_WEIGHT_COLUMNS.map(({key})=>[key,
         xml229ExcelCell(meta,{match1:match[oid],final:final[oid],
           hasSuggestions:suggestions?!!suggestions.get(oid)?.length:null},key)]));
       candidates.push({id,oid,index,cells});
     }
     if(optionsRequest)return {...xml229ExcelColumnOptions(candidates,{
       column:req.column,columnFilters,search:req.search??'',limit:250}),
       hiddenShortCount,hideShortMm};
     const filtered=sortXml229ExcelRows(candidates.filter(row=>
       matchesXml229ExcelColumns(row.cells,columnFilters)),sort);
     if(req.offset>=filtered.length&&req.offset!==0)
       fail('REVIEW_PAGE_OUTSIDE_SOURCE','Review filter offset exceeds current population');
     const selected=filtered.slice(req.offset,req.offset+req.limit).map(row=>row.id);
     const ids=selected.map(oidOf);
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
     return {basisId,offset:req.offset,totalCount:filtered.length,
       populationCount:physicalIdentityList.length,hiddenShortCount,
       hideShortMm,complete:true,rows};
   }
   if(req.what==='bulk-plan'){
     pendingBulk=null;
     const minScorePercent=xml229WeightThreshold(req.minScorePercent??0);
     const result=planXml229QualifiedBlankFill(review,weightProjection,{
       basisId,sourceId,sequence:++bulkSequence,
       candidateEligibility:(occurrenceId,selected)=>{
         const meta=weightProjection.get(occurrenceId);
         return xml229WeightReviewEligible(meta)&&
           (xml229ProposalScorePercent(selected)??-1)>=minScorePercent;
       },
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
     // New 372-part Final decisions cannot inherit old per-endpoint approvals
     // from the same original source/master hash. Review backup is bound to
     // the exact finalized pre-acceptance physical geometry, not source alone.
     if(req.backup?.finalizedGeometrySha256!==finalizedGeometry?.sha256||
        req.backup?.physicalOwnerSchema!==
         finalizedGeometry?.physicalOwnerCardinality?.schema)
       fail('REVIEW_BACKUP_FINAL_GEOMETRY_MISMATCH',
         'Rebuild and review weights on this finalized physical-component geometry');
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
   cancelled=true;previewAbortController?.abort();previewAbortController=null;ready=null;sourceReceipt=null;physicalIdentityList=null;originalXmlCustody=null;verifiedPreviewResult=null;weightProjection=null;pendingBulk=null;confirmedBulkCommands=new Set();
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
