/** Explicit source-wide "Skip Weight" is a session-local 0 kg *draft*.
 * Never creates sourceKg, Match-1, Final, or native output authorization.
 */
import {xml229WeightReviewEligible} from '../integration/xml229-weight-review-focus.mjs';
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
export async function planXml229SkipWeightDrafts(session,{
 existingDrafts=new Map(),isCurrent=()=>true,
}={}){
 if(!session?.receipt?.basisId||!session?.receipt?.sourceId||
    typeof session.readPage!=='function'||!(existingDrafts instanceof Map)||
    typeof isCurrent!=='function')fail('SKIP_WEIGHT_SOURCE_REQUIRED');
 const {basisId,sourceId}=session.receipt;
 const drafts=new Map(),counts={blank:0,skipped:0,alreadyEdited:0,existingReview:0};
 let total=null,offset=0,matchRevision=null,finalRevision=null;
 do{
  if(!isCurrent())fail('SKIP_WEIGHT_SOURCE_STALE');
  const page=await session.readPage({offset,limit:25,filter:'blank-rigid',query:''});
  if(!isCurrent())fail('SKIP_WEIGHT_SOURCE_STALE');
  if(page?.basisId!==basisId||page.complete!==true||page.offset!==offset||
     !Number.isSafeInteger(page.totalCount)||page.totalCount<0||page.totalCount>10000||
     (total!==null&&page.totalCount!==total)||
     !Array.isArray(page.rows)||page.rows.length!==Math.min(25,page.totalCount-offset))
    fail('SKIP_WEIGHT_PAGE_DRIFT');
  if(total===null)total=page.totalCount;
  for(const row of page.rows){
   if(!row||row.sourceId!==sourceId||typeof row.occurrenceId!=='string'||
      !row.occurrenceId||!xml229WeightReviewEligible(row)||
      positive(row.sourceKg)||positive(row.match1Kg)||positive(row.finalKg)||
      drafts.has(row.occurrenceId))fail('SKIP_WEIGHT_ROW_DRIFT');
   counts.blank++;
   if(row.match1View?.stageDecision||row.finalView?.stageDecision){
    counts.existingReview++;continue;
   }
   const mr=row.match1View?.match1Revision,fr=row.finalView?.finalRevision;
   if(matchRevision===null){matchRevision=mr;finalRevision=fr;}
   else if(mr!==matchRevision||fr!==finalRevision)fail('SKIP_WEIGHT_REVIEW_DRIFT');
   if(existingDrafts.has(row.occurrenceId)){
    counts.alreadyEdited++;continue;
   }
   drafts.set(row.occurrenceId,Object.freeze({
    value:'0',proposalId:'',reason:'',skippedWeight:true,
    autoUnqualified:false,autoFilled:false,
   }));
   counts.skipped++;
  }
  offset+=page.rows.length;
 }while(offset<total);
 if(!isCurrent())fail('SKIP_WEIGHT_SOURCE_STALE');
 return Object.freeze({schema:'XML229.SkipWeightDrafts.v1',basisId,sourceId,
  drafts,counts:Object.freeze(counts),historicalReviewWrites:0,
  acceptedMatch1Automatically:false,acceptedFinalAutomatically:false,
  nativeCiiReleaseAuthorized:false});
}
