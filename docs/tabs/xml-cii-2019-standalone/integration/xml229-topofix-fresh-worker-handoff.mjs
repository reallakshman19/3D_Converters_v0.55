/** XML229 L3: import an independently qualified PSI116 TopoFix as a
 * NEW current-source GC-PW Worker basis. No Final/backup/authority migration.
 * Caller MUST use the production input resolver and session opener.
 */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {projectXmlCiiOccurrences}
 from '../ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {psi116TopoFixBranchNodes,psi116TopoFixNodeSha256}
 from './xml229-topofix-node-semantic-digest.mjs';
const SHA=/^[0-9a-f]{64}$/;
const SCHEMA='psi116-topofix-prefinal-handoff/v1';
const LINEAGE='psi116-topofix-source-lineage/v1';
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const nat=x=>Number.isSafeInteger(x)&&x>=0;
const activeTopoFixProvenance=new WeakMap();
/** A panel re-install must never re-enable implicit Final acceptance for L3.
 * Bind the manual-only policy to the Worker session, not a transient UI flag.
 * A tampered receipt must never restore suggested-weight auto-commits.
 */
export function canXml229AutoCommitSuggestedFinal(session,{suppressAutoCommit=false}={}){
 return !!session&&!session.closed&&!suppressAutoCommit&&
   !activeTopoFixProvenance.has(session);
}
export function getXml229TopoFixFreshWorkerProvenance(session){
 if(!session||session.closed)return null;
 const bound=activeTopoFixProvenance.get(session);
 if(!bound||bound.basisId!==session.receipt?.basisId||
    bound.sourceGenerationId!==session.receipt?.sourceGenerationId||
    bound.sourceId!==session.receipt?.sourceId)return null;
 return bound;
}
const exactRows=async({original,fixed,sourceMap,counts,originalXmlText,fixedXmlText})=>{
 if(!Array.isArray(sourceMap)||!isObj(counts)||
    original.nodes.length!==counts.sourceNodeOccurrences||
    fixed.nodes.length!==counts.fixedNodeOccurrences||
    counts.retainedNodeOccurrences!==fixed.nodes.length||
    sourceMap.length!==original.nodes.length)
   fail('TOPOFIX_HANDOFF_NODE_CENSUS_DRIFT');
 const origKeys=new Set(),fixedKeys=new Set();
 const originalsByKey=new Map(original.nodes.map(n=>[
   JSON.stringify([n.branchOccurrenceIndex,n.nodeOrdinal]),n]));
 const finalsByKey=new Set(fixed.nodes.map(n=>
   JSON.stringify([n.branchOccurrenceIndex,n.nodeOrdinal])));
 const sourceNodes=psi116TopoFixBranchNodes(originalXmlText);
 const fixedNodes=psi116TopoFixBranchNodes(fixedXmlText);
 if(sourceNodes.length!==original.branches.length||
    fixedNodes.length!==fixed.branches.length)
   fail('TOPOFIX_HANDOFF_SEMANTIC_BRANCH_CENSUS_DRIFT');
 let removed=0,changed=0;
 const validStatus=new Set(['RETAINED','RENUMBERED_CONNECTION',
   'RIGID_RECLASSIFIED','REMOVED_PLAIN_PIPE']);
 for(const row of sourceMap){
   if(!isObj(row)||!nat(row.branchOccurrenceIndex)||
      !nat(row.sourceNodeOrdinal)||!validStatus.has(row.status)||
      !SHA.test(row.sourceNodeSha256)||typeof row.sourceNodeKey!=='string'||
      !row.sourceNodeKey)
     fail('TOPOFIX_HANDOFF_SOURCE_ROW_INVALID');
   const src=JSON.stringify([row.branchOccurrenceIndex,row.sourceNodeOrdinal]);
   if(origKeys.has(src)||!originalsByKey.has(src))
     fail('TOPOFIX_HANDOFF_SOURCE_ORDINAL_DRIFT');
   origKeys.add(src);
   const sourceNode=sourceNodes[row.branchOccurrenceIndex]?.[row.sourceNodeOrdinal];
   if(!sourceNode||await psi116TopoFixNodeSha256(sourceNode)!==row.sourceNodeSha256)
     fail('TOPOFIX_HANDOFF_SOURCE_NODE_SHA_DRIFT');
   if(row.status==='REMOVED_PLAIN_PIPE'){
     removed++;
     if(row.fixedNodeOrdinal!==null||row.fixedNodeSha256!==null||
        typeof row.operationId!=='string'||!row.operationId)
       fail('TOPOFIX_HANDOFF_REMOVAL_DRIFT');
   }else{
     if(!nat(row.fixedNodeOrdinal)||!SHA.test(row.fixedNodeSha256))
       fail('TOPOFIX_HANDOFF_FIXED_ROW_INVALID');
     const dst=JSON.stringify([row.branchOccurrenceIndex,row.fixedNodeOrdinal]);
     if(fixedKeys.has(dst)||!finalsByKey.has(dst))
       fail('TOPOFIX_HANDOFF_FIXED_ORDINAL_DRIFT');
     fixedKeys.add(dst);
     const fixedNode=fixedNodes[row.branchOccurrenceIndex]?.[row.fixedNodeOrdinal];
     if(!fixedNode||await psi116TopoFixNodeSha256(fixedNode)!==row.fixedNodeSha256)
       fail('TOPOFIX_HANDOFF_FIXED_NODE_SHA_DRIFT');
     if(row.status==='RETAINED'){
       if(row.operationId!==null)fail('TOPOFIX_HANDOFF_OPERATION_DRIFT');
     }else{
       changed++;
       if(typeof row.operationId!=='string'||!row.operationId)
         fail('TOPOFIX_HANDOFF_OPERATION_DRIFT');
     }
   }
 }
 if(fixedKeys.size!==fixed.nodes.length||
    removed!==counts.removedPlainPipeOccurrences||
    changed!==counts.changedRetainedOccurrences||
    sourceMap.length!==fixed.nodes.length+removed)
   fail('TOPOFIX_HANDOFF_OCCURRENCE_MAPPING_DRIFT');
};
export async function attestXml229TopoFixFreshSource({
 originalXmlText,fixedXmlText,lineageReceipt,handoffReceipt,
}={}){
 if(typeof originalXmlText!=='string'||typeof fixedXmlText!=='string'||
   !isObj(lineageReceipt)||!isObj(handoffReceipt)||
   lineageReceipt.schema!==LINEAGE||handoffReceipt.schema!==SCHEMA||
   lineageReceipt.state!=='PRE_FINAL_ONLY'||
   lineageReceipt.sourceXmlMutated!==false||
   lineageReceipt.acceptedFinalTransferred!==false||
   lineageReceipt.nativeCiiReleaseAuthorized!==false||
   lineageReceipt.requiresFreshWorkerBasis!==true||
   handoffReceipt.acceptedFinalTransferred!==false||
   handoffReceipt.nativeCiiReleaseAuthorized!==false||
   handoffReceipt.requiresFreshWorkerBasis!==true)
   fail('TOPOFIX_HANDOFF_PREFINAL_RECEIPT_REQUIRED');
 const originalSha=await digestUtf8(originalXmlText);
 const fixedSha=await digestUtf8(fixedXmlText);
 if(!SHA.test(originalSha)||!SHA.test(fixedSha)||
    originalSha===fixedSha||
    lineageReceipt.sourceXmlSha256!==originalSha||
    handoffReceipt.originalSourceXmlSha256!==originalSha||
    lineageReceipt.fixedXmlSha256!==fixedSha||
    handoffReceipt.newSourceXmlSha256!==fixedSha||
    !SHA.test(lineageReceipt.transactionSha256)||
    handoffReceipt.transactionSha256!==lineageReceipt.transactionSha256)
   fail('TOPOFIX_HANDOFF_SOURCE_SHA_DRIFT');
 const original=projectXmlCiiOccurrences({
   xmlText:originalXmlText,sourceId:'topofix-original-audit',mode:'A'});
 const fixed=projectXmlCiiOccurrences({
   xmlText:fixedXmlText,sourceId:'topofix-fixed-audit',mode:'A'});
 const lc=lineageReceipt.counts;
 if(!isObj(lc)||!Array.isArray(lineageReceipt.reviewedActionIds)||
    lineageReceipt.reviewedActionIds.length<1||
    new Set(lineageReceipt.reviewedActionIds).size!==lineageReceipt.reviewedActionIds.length||
    !Array.isArray(handoffReceipt.reviewedActionIds)||
    lineageReceipt.reviewedActionIds.length!==handoffReceipt.reviewedActionIds.length||
    !lineageReceipt.reviewedActionIds.every(x=>typeof x==='string'&&x&&
      handoffReceipt.reviewedActionIds.includes(x))||
    handoffReceipt.sourceNodeOccurrenceCount!==original.nodes.length||
    handoffReceipt.fixedNodeOccurrenceCount!==fixed.nodes.length||
    original.branches.length!==fixed.branches.length)
   fail('TOPOFIX_HANDOFF_REVIEW_OR_SOURCE_DRIFT');
 await exactRows({original,fixed,sourceMap:lineageReceipt.sourceOccurrenceMap,counts:lc,originalXmlText,fixedXmlText});
 return Object.freeze({
   schema:'XML229.TopoFixFreshSourceAttestation.v1',
   originalSourceXmlSha256:originalSha,newSourceXmlSha256:fixedSha,
   transactionSha256:lineageReceipt.transactionSha256,
   sourceNodeCount:original.nodes.length,fixedNodeCount:fixed.nodes.length,
   requiresFreshWorkerBasis:true,acceptedFinalTransferred:false,
   nativeCiiReleaseAuthorized:false,
 });
}

/** Production Worker session is the ONLY weight authority; no existing
 * Final intent or review backup is passed to it.
 */
export async function startXml229TopoFixFreshWeightSession({
 stateRef,originalXmlText,lineageReceipt,handoffReceipt,
 previousSession=null,resolveInputs,openSession,isCurrent=()=>true,
 explicitUserAction=false,
}={}){
 if(explicitUserAction!==true||typeof resolveInputs!=='function'||
    typeof openSession!=='function'||typeof isCurrent!=='function'||!isCurrent())
   fail('TOPOFIX_HANDOFF_EXPLICIT_CURRENT_START_REQUIRED');
 const raw=stateRef?.modeABaseRef?.current||stateRef?.current;
 if(!raw||raw.xml229XmlOnlyApproval||raw.xml229AcceptedFinalIntent||
    raw.xml229FinalReviewBackup)
   fail('TOPOFIX_HANDOFF_PRIOR_FINAL_MIGRATION_REFUSED');
 const fixedXmlText=raw.sourceText;
 const sourceIsCurrent=()=>isCurrent()&&
   (stateRef?.modeABaseRef?.current||stateRef?.current)?.sourceText===fixedXmlText;
 const attestation=await attestXml229TopoFixFreshSource({
   originalXmlText,fixedXmlText,lineageReceipt,handoffReceipt,
 });
 if(!sourceIsCurrent())fail('TOPOFIX_HANDOFF_STALE_SOURCE');
 const inputs=await resolveInputs();
 if(!sourceIsCurrent()||inputs?.xmlText!==fixedXmlText||
    inputs?.originalStagedSourceReceipt?.schema!=='XML229.OriginalStagedSourceReceipt.v1'||
    inputs.originalStagedSourceReceipt.phase!=='INDEX_COMMITTED'||
    inputs.originalStagedSourceReceipt.rightsBasis!=='SOURCE_FACTS_ONLY'||
    inputs.originalStagedSourceReceipt.engineeringReady!==false||
    typeof inputs.originalStagedSourceReceipt.generationId!=='string'||
    !inputs.originalStagedSourceReceipt.generationId||
    inputs.selection?.length!==1||
    inputs.selection[0]?.sourceId!==inputs.sourceId||
    inputs.selection[0]?.selectionRef!=='all'||
    typeof inputs.isCurrent!=='function'||!inputs.isCurrent()||
    typeof inputs.inputLease!=='string'||!inputs.inputLease)
   fail('TOPOFIX_HANDOFF_FRESH_O1_AND_FULL_SCOPE_REQUIRED');
 const earlier=previousSession?.receipt;
 if(earlier&&(!earlier.basisId||
    earlier.sourceGenerationId===inputs.originalStagedSourceReceipt.generationId))
   fail('TOPOFIX_HANDOFF_OLD_GENERATION_REUSE');
 const session=await openSession({resolveInputs:async()=>{
   if(!sourceIsCurrent()||!inputs.isCurrent())
     fail('TOPOFIX_HANDOFF_STALE_SOURCE');
   return inputs;
 }});
 try{
   if(!sourceIsCurrent()||!inputs.isCurrent()||
      session?.closed||session?.receipt?.sourceId!==inputs.sourceId||
      session?.receipt?.sourceGenerationId!==inputs.originalStagedSourceReceipt.generationId||
      session?.receipt?.originalJsonSha256!==inputs.originalStagedSourceReceipt.sha256||
      !session.receipt.basisId||
      session.receipt.weightEngineeringAccepted!==false||
      session.receipt.finalEngineeringAccepted!==false||
      earlier?.basisId===session.receipt.basisId)
     fail('TOPOFIX_HANDOFF_WORKER_NOT_FRESH');
 }catch(e){session?.cancel?.();throw e;}
 const provenance=Object.freeze({
   schema:'XML229.TopoFixFreshGC-PWWorkerProvenance.v1',
   ...attestation,basisId:session.receipt.basisId,
   sourceId:session.receipt.sourceId,
   sourceGenerationId:session.receipt.sourceGenerationId,
   originalJsonSha256:session.receipt.originalJsonSha256,
   acceptedFinalTransferred:false,reviewBackupRestored:false,
   nativeCiiReleaseAuthorized:false,
 });
 activeTopoFixProvenance.set(session,provenance);
 return Object.freeze({
   schema:'XML229.TopoFixFreshGC-PWWorkerHandoff.v1',
   attestation,provenance,session,
   basisId:session.receipt.basisId,
   sourceGenerationId:session.receipt.sourceGenerationId,
   priorFinalDecisionsTransferred:false,
   reviewBackupRestored:false,
   nativeCiiReleaseAuthorized:false,
 });
}
