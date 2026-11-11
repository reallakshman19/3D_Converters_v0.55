/** XML229 R1-B source-bound advisory in 5 Run, not a CII release override.
 * Entire physical population and stage decisions are independently checked
 * inside the existing P4 Worker-held GC-PW source session.
 */
import {getXml229CurrentWorkerHeldReview}
 from './xml-cii-adapted-p4-verified-weight-panel.js';
export function installXml229P4RunAdvisory(parent,stateRef,{resolveReview=()=>
 getXml229CurrentWorkerHeldReview(stateRef)}={}){
 if(!parent)return;
 const container=document.createElement('section');
 container.setAttribute('data-xml229-p4-run-advisory','');
 container.style.cssText='border:1px solid #b45309;border-radius:7px;padding:12px;margin:12px 0';
 container.innerHTML=`<strong>Original-source GC-PW engineering readiness (separate from legacy checklist)</strong>
  <p data-p4-run-status role="status">Checking active original-source Worker review…</p>
  <p style="color:#b45309;">The legacy Pre-run Summary's “0 blocking items”
  does not prove that Preview/Weight Match/Final are engineering-accepted.
  Proposed weights never authorize CII output.</p>
  <div data-p4-run-detail></div>`;
 parent.append(container);
 const status=container.querySelector('[data-p4-run-status]');
 const detail=container.querySelector('[data-p4-run-detail]');
 const session=resolveReview();
 if(!session){
   status.textContent='NOT VERIFIED — no current original staged JSON source-bound Weight session. Build verified original-source Weight review first.';
   status.style.color='#ef4444';
   return;
 }
 void Promise.resolve().then(()=>session.readCompletion()).then(proof=>{
   if(!container.isConnected)return;
   if(proof?.schema!=='XML229.P4.RunAdvisory.v1'||
      proof.ciiReleaseAuthorized!==false||
      proof.engineeringFactsVerified!==true||
      proof.verifiedPhysicalCount!==session.receipt.physicalCount||
      proof.originalJsonSha256!==session.receipt.originalJsonSha256||
      proof.basisId!==session.receipt.basisId||
      !Number.isSafeInteger(proof.counts?.unresolved))
     throw new Error('Completion report is stale or missing original source-census attestation');
   status.textContent='Original Preview physical facts VERIFIED · GC-PW review BUILT · CII release HELD';
   status.style.color='#b45309';
   const entries=[
     ['Original physical components',proof.verifiedPhysicalCount],
     ['Verified source physical FactRecords',proof.verifiedFactCount],
     ['Effective source masses',proof.counts.source],
     ['Accepted Match-1 (without Final)',proof.counts.match1],
     ['Accepted Final Match-2',proof.counts.final],
     ['Unresolved / proposed, NOT accepted',proof.counts.unresolved],
   ];
   const table=document.createElement('table');
   for(const [label,value] of entries){
     const tr=document.createElement('tr');
     const a=document.createElement('td'),b=document.createElement('td');
     a.textContent=label;b.textContent=String(value);
     tr.append(a,b);table.appendChild(tr);
   }
   const foot=document.createElement('p');
   foot.textContent='CII output remains unauthorized: '+proof.releaseReason;
   foot.style.color='#b45309';
   detail.replaceChildren(table,foot);
 }).catch(error=>{
   if(!container.isConnected)return;
   status.textContent='Source-bound Run readiness FAILED/HOLD: '+
     String(error?.message||error)+(error?.code?' ['+error.code+']':'');
   status.style.color='#ef4444';
   detail.replaceChildren();
 });
}
