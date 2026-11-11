/** Second Run-stage Weight dialog. Zero is a displayed default, never an implicit Final. */
import {commitXml229SelectedAppliedWeight} from './xml229-p4-applied-weight-owner-selection.mjs';
import {getXml229CurrentWorkerHeldReview} from './xml-cii-adapted-p4-verified-weight-panel.js';
import {hasXml229GovernedNativeHold,isXml229XmlOnlyApproved} from '../integration/xml229-output-participation.mjs';
import {hasXml229PreviewJsonSource} from './xml229-preview-json-source.mjs';
import {isXml229VerifiedReviewCompletionForInput} from '../integration/xml229-live-preview-restoration.mjs';
import {xml229WeightSuggestionTooltip} from './xml229-weight-suggestion-basis.mjs';

const deny=code=>{const e=new Error(code);e.code=code;throw e;};
const str=x=>String(x??'');
const unresolved=row=>row?.sourceKg===null&&row?.match1Kg===null&&row?.finalKg===null;
/** Read all Worker-supplied kg suggestions, not only the first three chips. */
export const xml229MaxSuggestedKg=row=>{
 const values=(Array.isArray(row?.proposals)?row.proposals:[]).filter(
   p=>typeof p?.value==='number'&&Number.isFinite(p.value)&&p.value>0&&p.unit==='kg');
 return values.length?Math.max(...values.map(p=>p.value)):null;
};
/** Display-only bulk fill. An unresolved row without kg suggestions stays untouched. */
export function prefillXml229RunMaxSuggestions(rows,inputs){
 let filled=0,unmatched=0;
 for(const physical of rows){
   const input=inputs.get(physical.occurrenceId);
   if(!input)throw new Error('RUN_MAX_SUGGESTION_INPUT_MISSING');
   const kg=xml229MaxSuggestedKg(physical);
   if(kg===null){unmatched++;continue;}
   input.value=String(kg);filled++;
 }
 return Object.freeze({filled,unmatched});
}

/** Read all original physicals, not the current 25-row Weight Match view. */
export async function listXml229RunUnresolvedMasses({session,isCurrent=()=>true}={}){
 if(!session?.receipt?.basisId||!session?.receipt?.sourceId||
    typeof session.readPage!=='function'||typeof session.readCompletion!=='function'||
    typeof isCurrent!=='function'||!isCurrent())deny('RUN_ZERO_WORKER_REQUIRED');
 const before=await session.readCompletion(),{basisId,sourceId}=session.receipt;
 if(!isCurrent()||before?.basisId!==basisId||
    !Number.isSafeInteger(before?.verifiedPhysicalCount)||
    !Number.isSafeInteger(before?.counts?.unresolved))
   deny('RUN_ZERO_CENSUS_UNVERIFIED');
 const pending=[],seen=new Set();let count=null;
 for(let offset=0;;offset+=25){
   if(!isCurrent())deny('RUN_ZERO_SOURCE_STALE');
   const page=await session.readPage({offset,limit:25,filter:'all',query:''});
   if(!isCurrent()||page?.basisId!==basisId||page?.complete!==true||
      page.offset!==offset||!Number.isSafeInteger(page.totalCount)||
      page.totalCount<1||page.totalCount>10000||
      page.totalCount!==before.verifiedPhysicalCount||
      (count!==null&&count!==page.totalCount)||!Array.isArray(page.rows)||
      page.rows.length!==Math.min(25,page.totalCount-offset))
     deny('RUN_ZERO_PAGE_OR_BASIS_DRIFT');
   count=page.totalCount;
   for(const row of page.rows){
     if(row.sourceId!==sourceId||!row.occurrenceId||seen.has(row.occurrenceId))
       deny('RUN_ZERO_PHYSICAL_IDENTITY_DRIFT');
     seen.add(row.occurrenceId);
     if(unresolved(row))pending.push(row);
   }
   if(offset+page.rows.length===count)break;
 }
 if(seen.size!==count||pending.length!==before.counts.unresolved)
   deny('RUN_ZERO_UNRESOLVED_CENSUS_DRIFT');
 return Object.freeze({basisId,sourceId,total:count,
   startingFinal:before.counts.final,pending:Object.freeze(pending)});
}

/** The only write path: a deliberate click and source-bound per-physical CAS. */
export async function confirmXml229RunUnresolvedMasses({
 session,snapshot,values,isCurrent=()=>true,onProgress=()=>{},
}={}){
 if(!snapshot?.basisId||session?.receipt?.basisId!==snapshot.basisId||
    !(values instanceof Map)||typeof isCurrent!=='function'||
    typeof onProgress!=='function'||!isCurrent())
   deny('RUN_ZERO_CONFIRM_SOURCE_REQUIRED');
 const pending=snapshot.pending;
 if(!Array.isArray(pending)||values.size!==pending.length)
   deny('RUN_ZERO_CONFIRM_POPULATION_DRIFT');
 const prepared=[];
 for(const row of pending){
   const raw=values.get(row.occurrenceId);
   const kg=typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;
   if(!values.has(row.occurrenceId)||!Number.isFinite(kg)||kg<0)
     deny('RUN_ZERO_CONFIRM_NUMERIC_KG_REQUIRED');
   prepared.push({row,kg});
 }
 const before=await session.readCompletion();
 if(!isCurrent()||before?.basisId!==snapshot.basisId||
    before.counts?.unresolved!==pending.length||
    before.counts?.final!==snapshot.startingFinal||
    before.verifiedPhysicalCount!==snapshot.total)
   deny('RUN_ZERO_CONFIRM_FINAL_POPULATION_CHANGED');
 let accepted=0;
 for(const {row,kg} of prepared){
   if(!isCurrent())deny('RUN_ZERO_CONFIRM_SOURCE_STALE');
   await commitXml229SelectedAppliedWeight({
     session,row,value:kg,proposalId:'',
     origin:kg===0?'confirmed-zero':'manual',isCurrent,
   });
   accepted++;onProgress({accepted,total:prepared.length});
 }
 const after=await session.readCompletion();
 if(!isCurrent()||after?.counts?.unresolved!==0||
    after.counts?.final!==snapshot.startingFinal+accepted)
   deny('RUN_ZERO_CONFIRM_POST_CENSUS_UNVERIFIED');
 return Object.freeze({accepted,confirmedZero:prepared.filter(x=>x.kg===0).length,
   positive:prepared.filter(x=>x.kg>0).length,
   nativeCiiReleaseAuthorized:false});
}

function cell(tr,value){
 const td=document.createElement('td');td.textContent=str(value);
 td.style.cssText='padding:7px 10px;border-bottom:1px solid #334155;white-space:normal;overflow-wrap:anywhere;word-break:break-word;max-width:180px;vertical-align:top';
 tr.appendChild(td);return td;
}
function button(host,label,kind){
 const node=document.createElement('button');node.type='button';node.textContent=label;
 node.dataset.runZeroAction=kind;
 node.style.cssText='padding:9px 13px;border:1px solid #64748b;border-radius:6px;cursor:pointer';
 host.appendChild(node);return node;
}
function populate(tbody,rows){
 const inputs=new Map();
 for(const physical of rows){
   const tr=document.createElement('tr');
   tr.dataset.runZeroOccurrence=physical.occurrenceId;
   cell(tr,'Unresolved');cell(tr,physical.shortName||physical.nodeName);
   cell(tr,physical.dtxr);cell(tr,physical.branchName);
   cell(tr,physical.lineKey);cell(tr,physical.componentType);
   cell(tr,physical.componentRefNoEndpoint||physical.componentRefNo);
   const suggestions=cell(tr,'');
   const td=cell(tr,'');
   const input=document.createElement('input');
   input.type='number';input.min='0';input.step='any';input.value='0';
   input.dataset.runZeroKg=physical.occurrenceId;
   input.setAttribute('aria-label','Applied Weight kg for '+str(physical.shortName||physical.occurrenceId));
   input.style.cssText='width:100px;padding:6px;background:#243b5d;color:#fff;border:1px solid #818cf8';
   td.appendChild(input);inputs.set(physical.occurrenceId,input);
   const proposals=(physical.proposals||[]).filter(p=>
     Number.isFinite(p?.value)&&p.value>0&&p.unit==='kg');
   const maximum=xml229MaxSuggestedKg(physical);
   if(!proposals.length)suggestions.textContent='No verified suggestion';
   for(const p of proposals){
     const chip=document.createElement('button');
     chip.type='button';chip.dataset.runZeroSuggestion='true';
     chip.textContent=(p.value===maximum?'MAX ':'')+(p.qualified?'★ ':'≈ ')+str(p.value)+' kg';
     chip.title=xml229WeightSuggestionTooltip(physical,p,maximum);
     chip.setAttribute('aria-description',chip.title);
     chip.style.cssText='padding:4px 6px;margin:2px;border:1px solid #64748b;border-radius:5px;cursor:pointer';
     chip.addEventListener('click',()=>{input.value=str(p.value);});
     suggestions.appendChild(chip);
   }
   tbody.appendChild(tr);
 }
 return inputs;
}

/** The dialog does not trigger conversion, download, or engineering acceptance on open. */
export async function openXml229RunUnresolvedMassPopup({stateRef,render,onNavigate}={}){
 const initial=stateRef?.current,session=getXml229CurrentWorkerHeldReview(stateRef);
 const reviewEligible=state=>!isXml229XmlOnlyApproved(state)&&(
   hasXml229GovernedNativeHold(state)||session?.receipt?.reviewSourceKind==='XML_ONLY'&&
   !hasXml229PreviewJsonSource(state));
 if(!session||!reviewEligible(initial)){
   onNavigate?.();return null;
 }
 if(document.querySelector('[data-xml229-run-unresolved-dialog]'))return null;
 const isCurrent=()=>getXml229CurrentWorkerHeldReview(stateRef)===session&&
   !session.closed&&reviewEligible(stateRef.current)&&
   stateRef.current?.sourceText===initial.sourceText&&
   stateRef.current?.sourceFile===initial.sourceFile&&
   stateRef.current?.stagedJsonText===initial.stagedJsonText&&
   stateRef.current?.stagedJsonFile===initial.stagedJsonFile&&
   stateRef.current?.masterContext===initial.masterContext&&
   stateRef.current?.branchSelection===initial.branchSelection&&
   stateRef.current?.supportConfigJson===initial.supportConfigJson&&
   stateRef.current?.options===initial.options;
 const proof=await session.readCompletion();
 if(!isCurrent()||!await isXml229VerifiedReviewCompletionForInput(
   (stateRef.modeABaseRef||stateRef).current,session.receipt,proof))
   deny('RUN_MASS_REVIEW_SOURCE_UNVERIFIED');
 const snapshot=await listXml229RunUnresolvedMasses({session,isCurrent});
 // Automatic offer and explicit click may both await the same census.
 if(document.querySelector('[data-xml229-run-unresolved-dialog]'))return null;
 if(!snapshot.pending.length){onNavigate?.();return snapshot;}
 if(!isCurrent())deny('RUN_ZERO_SOURCE_STALE');
 const overlay=document.createElement('div');
 overlay.dataset.xml229RunUnresolvedDialog='true';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','Review unresolved physical masses');
 overlay.style.cssText='position:fixed;inset:0;z-index:2000;background:#000a;display:flex;align-items:center;justify-content:center;padding:12px';
 const panel=document.createElement('section');
 panel.style.cssText='background:#14243a;color:#e5eefc;border:1px solid #64748b;border-radius:10px;padding:18px;width:min(1120px,96vw);max-height:90vh;overflow:auto';
 const title=document.createElement('h3');
 title.textContent='Final mass review — '+snapshot.pending.length+' unresolved physicals';
 const detail=document.createElement('p');
 detail.textContent='Only unresolved original physicals are listed. Each Applied Weight defaults to an uncommitted 0 kg. Apply All Source suggestions (Max) fills each row with the largest provided positive kg suggestion (including estimates), but does NOT confirm any engineering mass. Rows with no valid suggestions remain unchanged. Existing '+snapshot.startingFinal+' Final values will not be changed.';
 const status=document.createElement('p');status.setAttribute('role','status');
 status.textContent='Opening this popup has not written any mass decisions.';
 const scroll=document.createElement('div');scroll.style.cssText='overflow:auto;max-height:55vh';
 const table=document.createElement('table');
 table.className='mc-rigid-review-table';
 table.style.cssText='width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px';
 const head=document.createElement('thead'),h=document.createElement('tr');
 for(const name of ['Status','Short name','DTXR','Branch','Line','Component','Ref / endpoint','Source suggestions','Applied Weight (kg)'])cell(h,name);
 head.appendChild(h);table.appendChild(head);
 const body=document.createElement('tbody'),inputs=populate(body,snapshot.pending);
 table.appendChild(body);scroll.appendChild(table);
 const actions=document.createElement('div');
 actions.style.cssText='display:flex;gap:10px;justify-content:flex-end;margin-top:12px';
 const max=button(actions,'Apply All Source suggestions (Max)','apply-max');
 const close=button(actions,'Keep unresolved / Cancel','cancel');
 const submit=button(actions,'Confirm these Final masses','confirm');
 submit.style.background='#1d4ed8';submit.style.color='white';
 panel.append(title,detail,scroll,status,actions);overlay.appendChild(panel);
 document.body.appendChild(overlay);submit.focus();
 let busy=false;
 max.addEventListener('click',()=>{
   if(busy)return;
   const result=prefillXml229RunMaxSuggestions(snapshot.pending,inputs);
   status.textContent=result.filled+' Applied Weight input(s) prefilled with the largest positive kg suggestion; '+result.unmatched+' row(s) without suggestions left unchanged. No Final mass decision was recorded.';
 });
 close.addEventListener('click',()=>{if(!busy)overlay.remove();});
 submit.addEventListener('click',async()=>{
   if(busy)return;
   const values=new Map([...inputs].map(([id,input])=>[id,input.value]));
   busy=true;submit.disabled=true;close.disabled=true;max.disabled=true;
   try{
     await confirmXml229RunUnresolvedMasses({
       session,snapshot,values,isCurrent,
       onProgress:({accepted,total})=>{
         status.textContent='Recording '+accepted+'/'+total+' source-bound Final decisions…';
       },
     });
     overlay.remove();
     if(typeof render==='function')render();
   }catch(error){
     status.textContent='Review HELD ['+str(error?.code||error?.message||'RUN_ZERO_COMMIT_FAILED')+
       ']. If some decisions were saved, refresh to reread the authoritative Worker census.';
   }finally{busy=false;submit.disabled=false;close.disabled=false;max.disabled=false;}
 });
 return snapshot;
}
