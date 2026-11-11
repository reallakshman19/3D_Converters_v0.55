// Standalone opt-in canonical individual review dialog; never binds legacy XML row keys.
// The integrator must supply a completed {basis, review, openedFacts} fact session.
import {
  readVerifiedIndividualWeightReview, commitVerifiedIndividualWeightReview,
} from '../../../converters/xml-cii2019-core/weight-facts-individual-review.js';

const make=(doc,tag,text='',type='')=>{
  const el=doc.createElement(tag);
  if(type)el.type=type;
  if(text)el.textContent=text;
  return el;
};
const add=(parent,...children)=>{for(const item of children)parent.appendChild(item);};
const description=view=>{
  const mass=view.effectiveKg===null?'unresolved':String(view.effectiveKg)+' kg';
  return view.stage==='Rigidmatch2'
    ? 'Final Match-2 — selected accepted physical mass: '+mass
    : 'Match-1 — selected accepted physical mass: '+mass;
};
export function openVerifiedIndividualWeightReviewDialog({
  session,sourceId,occurrenceId,stage='RigidMatch1',documentRef=globalThis.document,
}={}) {
  // Fail before creating DOM if the session or original physical identity is stale.
  const view=readVerifiedIndividualWeightReview(session,{sourceId,occurrenceId,stage});
  if(!documentRef?.body||typeof documentRef.createElement!=='function')
    throw new Error('A document body is required for individual Weight review');
  return new Promise(resolve=>{
    const overlay=make(documentRef,'div');
    overlay.className='model-converters-workflow-popup-overlay mc-weight-individual-overlay';
    const modal=make(documentRef,'div');
    modal.className='mc-rigid-review-dialog';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label',stage==='Rigidmatch2'?'Final Match-2 individual review':'Match-1 individual review');
    const title=make(documentRef,'h3',description(view));
    const scope=make(documentRef,'p','Selected original occurrence: '+sourceId+' · '+occurrenceId);
    const help=make(documentRef,'p',
      'Ranked suggestions are evidence, not accepted mass. Every action below is an explicit source-scoped engineering decision in kg.');
    const proposedLabel=make(documentRef,'label','Ranked master proposal (Match-1 only)');
    const proposals=make(documentRef,'select');
    const emptyOption=make(documentRef,'option','Select a ranked candidate');
    emptyOption.value='';
    proposals.appendChild(emptyOption);
    for(const p of view.proposals){
      const option=make(documentRef,'option',
        '#'+p.ranking+' · '+p.value+' kg · '+p.method+(p.qualified?' · exact':' · review required'));
      option.value=p.proposalId;
      proposals.appendChild(option);
    }
    if(stage==='Rigidmatch2')proposals.disabled=true;
    const massLabel=make(documentRef,'label','Manual accepted mass in kg');
    const mass=make(documentRef,'input');
    mass.type='number';mass.min='0.000001';mass.step='any';mass.placeholder='kg';
    const reasonLabel=make(documentRef,'label','Engineering reason (required for manual/Final/inferred/reject/defer)');
    const reason=make(documentRef,'textarea');
    reason.placeholder='Describe the source, engineering basis and acceptance reason';
    const status=make(documentRef,'p');
    status.setAttribute('role','status');
    const controls=make(documentRef,'div');
    const accept=make(documentRef,'button','Accept selected proposal','button');
    accept.disabled=stage==='Rigidmatch2';
    const manual=make(documentRef,'button',stage==='Rigidmatch2'?'Accept Final kg':'Accept manual kg','button');
    const reject=make(documentRef,'button','Reject','button');
    const defer=make(documentRef,'button','Defer','button');
    const cancel=make(documentRef,'button','Cancel','button');
    add(controls,accept,manual,reject,defer,cancel);
    add(modal,title,scope,help,proposedLabel,proposals,massLabel,mass,reasonLabel,reason,status,controls);
    overlay.appendChild(modal);
    documentRef.body.appendChild(overlay);
    let closed=false;
    const finish=answer=>{
      if(closed)return;
      closed=true;overlay.remove();resolve(answer);
    };
    const apply=action=>{
      if(closed)return;
      const decision={action,reason:String(reason.value||'')};
      if(action==='accept-proposal')decision.proposalId=proposals.value;
      if(['enter-manual','final-override'].includes(action)){
        decision.value=Number(mass.value);decision.unit='kg';
      }
      try{
        const result=commitVerifiedIndividualWeightReview(session,view,decision);
        finish({cancelled:false,sourceId,occurrenceId,stage,...result});
      }catch(error){
        // No false success; retain original view so a stale stage cannot be retried
        // without explicitly closing/reopening against the current source revision.
        status.textContent='Review not accepted: '+String(error?.message||error)+
          (error?.code?' ['+error.code+']':'');
      }
    };
    accept.addEventListener('click',()=>apply('accept-proposal'));
    manual.addEventListener('click',()=>apply(stage==='Rigidmatch2'?'final-override':'enter-manual'));
    reject.addEventListener('click',()=>apply('reject'));
    defer.addEventListener('click',()=>apply('defer'));
    cancel.addEventListener('click',()=>finish({cancelled:true,sourceId,occurrenceId,stage}));
    cancel.focus?.();
  });
}
