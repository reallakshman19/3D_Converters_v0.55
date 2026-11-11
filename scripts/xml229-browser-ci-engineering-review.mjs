/**
 * CI/browser harness only — NOT imported by the application.
 * Exercises existing source-bound GC-PW review/Final Worker APIs after
 * removing confusing visible review buttons from the Weight Match table.
 * Does not authorize native CII, replace source proofs or alter user data.
 */
export async function exerciseXml229WorkerFixtureReview(page,{
 occurrenceId,match1Kg=35,finalKg=40,mode='both',
}={}){
 if(!occurrenceId||!['both','match1'].includes(mode))
  throw new Error('CI_WORKER_REVIEW_OCCURRENCE_REQUIRED');
 return page.evaluate(async({occurrenceId,match1Kg,finalKg,mode})=>{
  const {getXml229CurrentWorkerHeldReview}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  const session=getXml229CurrentWorkerHeldReview(window.__p4StateRef||window.__stateRef);
  if(!session?.receipt?.basisId)throw new Error('CI_WORKER_REVIEW_BASIS_MISSING');
  const snapshotBasis=session.receipt.basisId;
  const find=async()=>{
   let offset=0,total=null;
   do{
    const pg=await session.readPage({offset,limit:25,filter:'rigid',query:''});
    if(pg.basisId!==snapshotBasis||pg.complete!==true||
       !Number.isSafeInteger(pg.totalCount)||!Array.isArray(pg.rows))
      throw new Error('CI_WORKER_REVIEW_PAGE_STALE');
    const row=pg.rows.find(x=>x.occurrenceId===occurrenceId);
    if(row)return row;
    if(total===null)total=pg.totalCount;
    else if(total!==pg.totalCount)throw new Error('CI_WORKER_REVIEW_POPULATION_DRIFT');
    offset+=pg.rows.length;
   }while(offset<total);
   throw new Error('CI_WORKER_REVIEW_OCCURRENCE_NOT_FOUND');
  };
  const row=await find();
  if(row.match1View?.stageDecision)
   throw new Error('CI_WORKER_REVIEW_ALREADY_REVIEWED');
  await session.review({view:row.match1View,choice:{
   action:'enter-manual',value:match1Kg,unit:'kg',
   reason:'CI synthetic fixture: exercise protected Match-1 Worker RPC'}});
  if(mode==='both'){
   const updated=await find();
   await session.review({view:updated.finalView,choice:{
    action:'final-override',value:finalKg,unit:'kg',
    reason:'CI synthetic fixture: independent Final Worker RPC'}});
  }
  const after=await session.readCompletion();
  if(after.basisId!==snapshotBasis||after.ciiReleaseAuthorized!==false)
   throw new Error('CI_WORKER_REVIEW_INVALID_AFTER');
  return {basisId:snapshotBasis,
    counts:after.counts,
    nativeCiiReleaseAuthorized:false,method:'protected Worker API, CI only'};
 },{occurrenceId,match1Kg,finalKg,mode});
}
