/**
 * Explicit, non-modal Owner 0 kg decision for unresolved original physicals.
 * Reading an eligible blank never writes a ledger decision. The Apply action
 * must originate from the user, and uses only the current Worker Final CAS.
 */
import {commitXml229SelectedAppliedWeight}
 from './xml229-p4-applied-weight-owner-selection.mjs';

const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
export function eligibleXml229UnassignedZero(row,draft=null){
 if(!row||typeof row.occurrenceId!=='string'||!row.occurrenceId||
    row.sourceKg!==null||row.match1Kg!==null||row.finalKg!==null||
    row.match1View?.stageDecision||row.finalView?.stageDecision)
  return false;
 // A saved manual or suggested positive weight is not a blank.
 if(draft&&!draft.skippedWeight)return false;
 // An unselected qualified source suggestion must not be silently zeroed;
 // return to Apply all suggestions for that physical instead.
 if(row.proposals?.some(p=>p?.qualified===true&&positive(p.value)&&p.unit==='kg'))
  return false;
 return true;
}
export async function visitXml229UnassignedZero({
 session,drafts,isCurrent,visitor=()=>{},
}={}){
 if(!session?.receipt?.basisId||!session?.receipt?.sourceId||
    typeof session.readPage!=='function'||!(drafts instanceof Map)||
    typeof isCurrent!=='function'||typeof visitor!=='function')
  fail('ZERO_SOURCE_VERIFIED_WORKER_REQUIRED');
 const {basisId,sourceId}=session.receipt;
 let scanned=0,total=null,eligible=0;const seen=new Set();
 for(let offset=0;;offset+=25){
  if(!isCurrent())fail('ZERO_SOURCE_STALE');
  const page=await session.readPage({offset,limit:25,filter:'all',query:''});
  if(!isCurrent()||page?.basisId!==basisId||page?.complete!==true||
     page?.offset!==offset||!Number.isSafeInteger(page.totalCount)||
     page.totalCount<1||page.totalCount>10000||
     (total!==null&&total!==page.totalCount)||!Array.isArray(page.rows)||
     page.rows.length!==Math.min(25,page.totalCount-offset))
    fail('ZERO_SOURCE_PAGE_DRIFT');
  total=page.totalCount;
  for(const row of page.rows){
   if(row.sourceId!==sourceId||seen.has(row.occurrenceId))
    fail('ZERO_SOURCE_IDENTITY_DRIFT');
   seen.add(row.occurrenceId);scanned++;
   if(eligibleXml229UnassignedZero(row,drafts.get(row.occurrenceId))){
    eligible++;
    await visitor(row,{scanned,total,eligible});
    if(!isCurrent())fail('ZERO_SOURCE_STALE');
   }
  }
  if(offset+page.rows.length===total)break;
 }
 if(scanned!==total||seen.size!==total)fail('ZERO_SOURCE_CENSUS_DRIFT');
 return Object.freeze({basisId,sourceId,total,eligible});
}
export async function applyXml229OwnerConfirmedZero({
 session,drafts,isCurrent,saveDrafts=()=>{},onProgress=()=>{},
}={}){
 if(typeof saveDrafts!=='function'||typeof onProgress!=='function')
  fail('ZERO_SOURCE_APPLY_CALLBACK_REQUIRED');
 let accepted=0;
 const census=await visitXml229UnassignedZero({
  session,drafts,isCurrent,
  visitor:async(row,{scanned,total})=>{
   // The Worker independently rereads the Final view immediately before CAS.
   await commitXml229SelectedAppliedWeight({
    session,row,value:0,proposalId:'',origin:'confirmed-zero',isCurrent,
   });
   drafts.delete(row.occurrenceId);
   accepted++;
   saveDrafts();
   onProgress({accepted,scanned,total});
  },
 });
 return Object.freeze({...census,accepted,
  zeroMassEngineeringDecisionsAccepted:accepted,
  nativeCiiReleaseAuthorized:false});
}
