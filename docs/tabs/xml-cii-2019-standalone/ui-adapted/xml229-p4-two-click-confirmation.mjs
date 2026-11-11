/**
 * Two-click XML229 review boundary: DOM drafts are NOT review authority.
 * Only an unchanged source-attested Worker plan can be submitted on click 2.
 * This file is pure/read-only except for explicitly requested draft-input capture.
 */
const deny=(code)=>{const error=new Error(code);error.code=code;throw error;};
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function captureXml229WeightDraft(tr,rows,drafts){
 if(!tr||!Array.isArray(rows)||!(drafts instanceof Map))return null;
 const row=rows[Number(tr.dataset.p4Row)];
 if(!row||row.occurrenceId!==tr.dataset.p4Occurrence)return null;
 const choice=tr.querySelector('[data-p4-candidate]')?.value??tr.dataset.p4PickedProposal??'';
 drafts.set(row.occurrenceId,{
  value:tr.querySelector('[data-p4-proposal]')?.value??'',
  proposalId:choice,
  reason:tr.querySelector('[data-p4-reason]')?.value??'',
  autoUnqualified:(row.proposals||[]).some(p=>
    p.proposalId===choice&&p.qualified===false),
  autoFilled:false,
 });
 return row.occurrenceId;
}
/** Editing after click 1 disarms approval without changing a Worker decision. */
export function disarmXml229EditedDraft(tr,rows,drafts,pending,table,detail){
 const id=captureXml229WeightDraft(tr,rows,drafts);
 if(!id||!pending)return false;
 detail.hidden=true;detail.textContent='';
 const confirm=table.querySelector('[data-p4-bulk-confirm]');
 if(confirm)confirm.disabled=true;
 return true;
}
function candidates(plan,basisId,sourceId){
 if(!plan||typeof plan.planId!=='string'||
    !Array.isArray(plan.qualifiedSuggestions)||
    plan.reviewStage!=='RigidMatch1'||plan.finalAcceptedAutomatically!==false||
    plan.basisId!==basisId||
    !Number.isSafeInteger(plan.qualified)||plan.qualified<1||
    plan.qualified!==plan.qualifiedSuggestions.length)
   deny('MATCH1_TWO_CLICK_PLAN_REQUIRED');
 let receipt;
 try{receipt=JSON.parse(plan.planId);}catch{deny('MATCH1_TWO_CLICK_PLAN_INVALID');}
 if(!Array.isArray(receipt)||receipt.length!==6||
    receipt[0]!==basisId||receipt[1]!==sourceId||
    !Number.isSafeInteger(receipt[4])||receipt[4]<1||
    receipt[5]!==plan.qualified)
   deny('MATCH1_TWO_CLICK_PLAN_INVALID');
 const expected=new Map();
 for(const item of plan.qualifiedSuggestions){
  if(typeof item?.occurrenceId!=='string'||!item.occurrenceId||
     typeof item.proposalId!=='string'||!item.proposalId||
     !positive(item.value)||item.unit!=='kg'||item.qualified!==true||
     expected.has(item.occurrenceId))
   deny('MATCH1_TWO_CLICK_PLAN_INVALID');
  expected.set(item.occurrenceId,item);
 }
 return expected;
}
/** Second click must use the exact first-click qualified drafts, including off-page ones. */
export function verifyXml229Match1DraftConfirmation(plan,drafts,{basisId,sourceId}={}){
 if(!(drafts instanceof Map))deny('MATCH1_TWO_CLICK_DRAFTS_REQUIRED');
 const expected=candidates(plan,basisId,sourceId);
 for(const [id,proposal] of expected){
  const saved=drafts.get(id);
  if(!saved||saved.proposalId!==proposal.proposalId||
     saved.autoUnqualified===true||
     !positive(Number(saved.value))||Number(saved.value)!==proposal.value)
   deny('MATCH1_TWO_CLICK_DRAFT_DRIFT');
 }
 return {qualifiedDraftsVerified:expected.size,readOnly:true,
  finalAcceptedAutomatically:false,nativeCiiReleaseAuthorized:false};
}
/** Detect direct DOM edits that may bypass ordinary input/change dispatch. */
export function verifyXml229VisibleMatch1Drafts(table,rows,drafts,plan){
 if(!table?.querySelectorAll||!Array.isArray(rows)||!(drafts instanceof Map))
   deny('MATCH1_VISIBLE_DRAFTS_REQUIRED');
 const expected=new Map((plan?.qualifiedSuggestions||[]).map(p=>[p.occurrenceId,p]));
 let visible=0;
 for(const tr of table.querySelectorAll('tr[data-p4-row]')){
  const row=rows[Number(tr.dataset.p4Row)];
  if(!row||row.occurrenceId!==tr.dataset.p4Occurrence)
   deny('MATCH1_VISIBLE_ROW_DRIFT');
  const qualified=expected.get(row.occurrenceId);
  if(!qualified)continue;
  const saved=drafts.get(row.occurrenceId);
  if(!saved||tr.querySelector('[data-p4-proposal]')?.value!==saved.value||
     tr.querySelector('[data-p4-candidate]')?.value!==saved.proposalId||
     saved.proposalId!==qualified.proposalId||Number(saved.value)!==qualified.value)
   deny('MATCH1_VISIBLE_DRAFT_DRIFT');
  visible++;
 }
 if(expected.size>0&&visible===0)deny('MATCH1_VISIBLE_CONFIRMATION_REQUIRED');
 return visible;
}

/**
 * Only this boundary invokes the existing Worker commit RPC.
 * Lock the editable DOM while the CAS/planId transaction runs.
 * Always disarm the visible confirm button, including on RPC failure.
 */
export async function commitXml229TwoClickMatch1({
 session,plan,drafts,table,rows,isCurrent=()=>true,
}={}){
 if(typeof session?.commitQualifiedBlankFill!=='function'||typeof isCurrent!=='function')
  deny('MATCH1_TWO_CLICK_SESSION_REQUIRED');
 verifyXml229Match1DraftConfirmation(plan,drafts,session.receipt);
 verifyXml229VisibleMatch1Drafts(table,rows,drafts,plan);
 if(!isCurrent())deny('MATCH1_TWO_CLICK_SESSION_STALE');
 const inputs=[...table.querySelectorAll('[data-p4-proposal],[data-p4-candidate],[data-p4-reason]')];
 inputs.forEach(input=>{input.disabled=true;});
 try{
  const result=await session.commitQualifiedBlankFill({planId:plan.planId});
  if(!isCurrent())deny('MATCH1_TWO_CLICK_SESSION_STALE');
  if(!Number.isSafeInteger(result?.acceptedCount)||
     result.acceptedCount!==plan.qualified)
   deny('MATCH1_TWO_CLICK_COMMIT_RESULT_DRIFT');
  return result;
 }finally{
  inputs.forEach(input=>{input.disabled=false;});
  const confirm=table.querySelector('[data-p4-bulk-confirm]');
  if(confirm)confirm.disabled=true;
 }
}
