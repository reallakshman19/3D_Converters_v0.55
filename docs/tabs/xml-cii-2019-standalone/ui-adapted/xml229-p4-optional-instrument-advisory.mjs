/** Source-bound optional instrument mass review. Empirical estimates are valve
 * catalog models, NOT evidence that an INST has a valve type or rigid stiffness.
 * Every Final decision uses the existing verified GC-PW Worker CAS service.
 */
import {estimateEmpiricalWeight,EMPIRICAL_WEIGHT_MODEL}
 from '../../../converters/empirical-weight/index.js';

const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const element=(doc,name,text='')=>{
 const node=doc.createElement(name);node.textContent=text;return node;
};
const families=[...new Set(EMPIRICAL_WEIGHT_MODEL.approach1.models.map(x=>x.typeDesc))].sort();

export async function renderXml229InstrumentSuggestions(root,session,isCurrent,onCommitted=()=>{}) {
 let advice=null;
 try{advice=await session?.readInstrumentModelingSuggestions?.();}
 catch{return;}
 if(!isCurrent()||!root?.isConnected)return;
 root.querySelector('[data-p4-instrument-advisory]')?.remove();
 if(!advice?.items?.length)return;
 const doc=root.ownerDocument;
 const note=element(doc,'div');
 note.dataset.p4InstrumentAdvisory='true';
 const info=element(doc,'p',advice.items.length+
  ' instrument modeling suggestions (optional; no approval required). '+
  'No rigid classification or kg was applied automatically. '+
  'Review individual kg in the popup. Empirical Weight API models require a '+
  'user-specified supported family/rating/NS and are suggestions only. '+
  'Positive kg on an unclassified INST still needs a supported rigid model; '+
  'explicitly confirmed 0 kg may be verified as an unweighted CII element.');
 const open=element(doc,'button','Review instrument weights');
 open.type='button';open.dataset.p4InstrumentReview='true';
 note.append(info,open);
 root.insertBefore(note,root.firstChild);
 const lookup=new Map(session.originalPhysicalOccurrences.map(x=>[
  JSON.stringify([x.branchOccurrenceIndex,x.nodeOrdinal]),x,
 ]));
 const items=advice.items.map(x=>({...x,
  physical:lookup.get(JSON.stringify([x.branchOccurrenceIndex,x.secondSourceNodeOrdinal])),
 })).filter(x=>x.physical);
 if(items.length!==advice.items.length){
  open.disabled=true;info.textContent='Instrument identity does not match current original-source census; review unavailable.';
  return;
 }
 open.addEventListener('click',async()=>{
  if(!isCurrent())return;
  const overlay=element(doc,'div');
  overlay.className='model-converters-workflow-popup-overlay mc-weight-individual-overlay';
  const modal=element(doc,'div');modal.className='mc-rigid-review-dialog';
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Source-bound instrument mass review');
  const title=element(doc,'h3','Instrument pair — explicit Final mass');
  const choice=element(doc,'select');
  items.forEach((item,i)=>{
   const option=element(doc,'option',item.componentRefNo+
     ' · branch '+item.branchOccurrenceIndex+' · '+item.spanMm+' mm');
   option.value=String(i);choice.appendChild(option);
  });
  const details=element(doc,'p');
  const context=element(doc,'p','Empirical estimator is derived from valve master data; it cannot infer instrument type, rigidity or approved mass.');
  const family=element(doc,'select');
  const none=element(doc,'option','Select a documented valve-family analogue (optional)');
  none.value='';family.appendChild(none);
  families.forEach(name=>{const op=element(doc,'option',name);op.value=name;family.appendChild(op);});
  const rating=element(doc,'input');rating.type='number';rating.min='1';rating.placeholder='Pressure rating';
  const ns=element(doc,'input');ns.type='number';ns.min='1';ns.placeholder='Nominal size NS';
  const estimate=element(doc,'button','Suggest via empirical weight API');
  estimate.type='button';
  const estimation=element(doc,'p','No empirical suggestion loaded.');
  const kg=element(doc,'input');kg.type='number';kg.min='0';kg.step='any';kg.placeholder='Manual mass in kg';
  const reason=element(doc,'textarea');reason.placeholder='Engineering reason / source for the accepted kg (required)';
  const confirmZero=element(doc,'input');confirmZero.type='checkbox';
  const confirmLabel=element(doc,'label','I explicitly confirm 0 kg for this unresolved instrument; not an automatic default.');
  confirmLabel.prepend(confirmZero);
  const status=element(doc,'p');status.setAttribute('role','status');
  const manual=element(doc,'button','Accept manual kg');manual.type='button';
  const zero=element(doc,'button','Accept explicitly confirmed 0 kg');zero.type='button';
  const cancel=element(doc,'button','Close');cancel.type='button';
  modal.append(title,choice,details,context,family,rating,ns,estimate,estimation,
    kg,reason,confirmLabel,status,manual,zero,cancel);
  overlay.appendChild(modal);doc.body.appendChild(overlay);
  const current=()=>isCurrent()&&overlay.isConnected;
  const close=()=>overlay.remove();
  cancel.addEventListener('click',close);
  let view=null;
  const update=async()=>{
   if(!current())return;
   view=null;status.textContent='';
   const item=items[Number(choice.value)];
   const fresh=await session.readIndividual({occurrenceId:item.physical.occurrenceId,stage:'Rigidmatch2'});
   if(!current()||fresh?.sourceId!==item.physical.sourceId||
      fresh?.occurrenceId!==item.physical.occurrenceId)
     throw fail('INSTRUMENT_REVIEW_SOURCE_STALE');
   view=fresh;
   details.textContent=item.componentRefNo+' / branch '+item.branchOccurrenceIndex+
    ' / node '+item.secondSourceNodeOrdinal+
    ' · current Final: '+(fresh.finalKg===null?'unresolved':fresh.finalKg+' kg');
   kg.value='';reason.value='';confirmZero.checked=false;estimation.textContent='No empirical suggestion loaded.';
  };
  choice.addEventListener('change',()=>void update().catch(err=>status.textContent=String(err.code||err)));
  estimate.addEventListener('click',()=>{
   if(!current()||!view)return;
   const result=estimateEmpiricalWeight({
    typeDesc:family.value,rating:Number(rating.value),ns:Number(ns.value),
   },{allowExtrapolation:false});
   if(result.ok&&Number.isFinite(result.weightKg)&&result.weightKg>0){
    kg.value=String(result.weightKg);
    estimation.textContent='Advisory '+result.weightKg+' kg ('+result.approach+
      ', '+result.confidence+', '+result.modelId+'). Verify instrument applicability; not auto-accepted.';
   }else{
    estimation.textContent='Empirical suggestion unavailable: '+
      String(result.error?.code||'NO_MODEL')+'. Enter a supported analogue or manual measured kg.';
   }
  });
  const commit=async(isZero)=>{
   if(!current()||!view)return;
   status.textContent='Verifying source-bound Final decision…';
   manual.disabled=true;zero.disabled=true;
   try{
    const value=isZero?0:Number(kg.value);
    if(isZero&&!confirmZero.checked)throw fail('ZERO_CONFIRMATION_REQUIRED');
    if(!isZero&&(!kg.value.trim()||!Number.isFinite(value)||value<=0))
      throw fail('POSITIVE_KG_REQUIRED');
    const rationale=reason.value.trim();
    if(!rationale)throw fail('ENGINEERING_REASON_REQUIRED');
    const result=await session.review({view,choice:isZero?{
      action:'set-zero-mass',value:0,unit:'kg',zeroMassConfirmed:true,
      reason:'Owner-confirmed explicit zero kg: '+rationale,
    }:{
      action:'final-override',value,unit:'kg',reason:rationale+
       ' (instrument source-bound manual kg; empirical estimate is advisory only)',
    }});
    if(!current()||!result?.decisionRevision)throw fail('INSTRUMENT_FINAL_REVIEW_STALE');
    status.textContent=isZero?
      'Explicit 0 kg Final recorded; native CII still requires output proof.':
      'Positive Final recorded; native CII requires separate rigid modeling proof.';
    await onCommitted();
    if(current())await update();
   }catch(error){
    if(current())status.textContent='Not recorded: '+String(error?.code||error?.message||error);
   }finally{manual.disabled=false;zero.disabled=false;}
  };
  manual.addEventListener('click',()=>void commit(false));
  zero.addEventListener('click',()=>void commit(true));
  try{await update();}catch(e){status.textContent=String(e?.code||e?.message||e);}
 });
}
