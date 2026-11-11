/**
 * XML229 source-wide Owner-directed Applied Weight Final.
 * Read every original physical page from the current GC-PW Worker; use only
 * positive selected kilograms and the guarded per-occurrence Final CAS.
 * No inferred mass, legacy alias or client-originated acceptance receipt.
 */
import {commitXml229SelectedAppliedWeight} from './xml229-p4-applied-weight-owner-selection.mjs';
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
export async function commitXml229AllSelectedFinal({
 session,drafts,isCurrent,saveDrafts,onProgress=()=>{},
}={}){
 if(!session||typeof session.readPage!=='function'||!(drafts instanceof Map)||
    typeof isCurrent!=='function'||typeof saveDrafts!=='function'||
    typeof onProgress!=='function')fail('APPLIED_WEIGHT_ALL_SOURCE_REQUIRED');
 let accepted=0,scanned=0,total=null;
 for(let start=0;;start+=25){
   if(!isCurrent())fail('APPLIED_WEIGHT_SOURCE_STALE');
   const page=await session.readPage({offset:start,limit:25,filter:'all'});
   if(!isCurrent()||!page||!Array.isArray(page.rows)||
      !Number.isSafeInteger(page.totalCount)||page.totalCount<1||
      page.rows.length>25||(total!==null&&page.totalCount!==total))
     fail('APPLIED_WEIGHT_ALL_SOURCE_PAGE_INVALID');
   total=page.totalCount;
   if(page.rows.length===0||start+page.rows.length>total)
     fail('APPLIED_WEIGHT_ALL_SOURCE_PAGE_TRUNCATED');
   for(const item of page.rows){
     if(!isCurrent())fail('APPLIED_WEIGHT_SOURCE_STALE');
     scanned++;
     const selected=drafts.get(item.occurrenceId);
     const value=Number(selected?.value);
     if(!selected||selected.skippedWeight||!Number.isFinite(value)||value<=0||
        item.finalKg!==null||item.sourceKg!==null)continue;
     await commitXml229SelectedAppliedWeight({
       session,row:item,value,proposalId:selected.proposalId||'',
       origin:selected.autoFilled?'prefill':'manual',isCurrent,
     });
     drafts.delete(item.occurrenceId);accepted++;
   }
   saveDrafts();
   onProgress({accepted,scanned,total});
   if(start+page.rows.length===total)break;
   if(page.rows.length!==25)fail('APPLIED_WEIGHT_ALL_SOURCE_PAGE_TRUNCATED');
 }
 if(scanned!==total)fail('APPLIED_WEIGHT_ALL_SOURCE_CENSUS_DRIFT');
 return {accepted,scanned,total};
}

/** Auto-accept only selected positive values on the current visible page.
 * On one failed review the selection remains available and no further rows
 * are submitted, mirroring the view's original fail-closed behavior.
 */
export async function commitXml229VisibleSelectedFinal({
 session,rows,drafts,isCurrent,onError=()=>{},
}={}){
 if(!session||!Array.isArray(rows)||!(drafts instanceof Map)||
    typeof isCurrent!=='function'||typeof onError!=='function')
  fail('APPLIED_WEIGHT_VISIBLE_SOURCE_REQUIRED');
 let committed=0;
 for(const row of rows){
   const selected=drafts.get(row?.occurrenceId),value=Number(selected?.value);
   if(!selected||selected.skippedWeight||!Number.isFinite(value)||value<=0||
      row.finalKg!==null||row.sourceKg!==null)continue;
   if(!isCurrent())return {committed,stale:true};
   try{
     await commitXml229SelectedAppliedWeight({
       session,row,value,proposalId:selected.proposalId||'',
       origin:selected.autoFilled?'prefill':'manual',isCurrent,
     });
     drafts.delete(row.occurrenceId);committed++;
   }catch(error){onError(error);return {committed,error};}
 }
 return {committed};
}
