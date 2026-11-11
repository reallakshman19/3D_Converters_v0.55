// Verified Mode A Final Match-2 dialog. Optional integrator entry only.
// Never return legacy weightsByKey or invoke the CII Run writer automatically.
import { readVerifiedModeAFinalRows } from '../../../converters/xml-cii2019-core/weight-facts-mode-a-final-read.js';
import {
  planVerifiedFinalMatch2, commitVerifiedFinalMatch2,
} from '../../../converters/xml-cii2019-core/weight-facts-final-review-actions.js';

const mk=(doc,tag,text='')=>{
  const el=doc.createElement(tag);if(text)el.textContent=text;return el;
};
function add(parent,...children){for(const child of children)parent.appendChild(child);}
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function openVerifiedModeAFinalWeightReviewDialog({
  session,documentRef=globalThis.document,pageSize=50,
}={}) {
  // Strict source/fact population inspection happens BEFORE any UI is created.
  const initial=readVerifiedModeAFinalRows(session);
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)
    throw new RangeError('Mode A verified review pageSize must be 1..100');
  if(!documentRef?.body||typeof documentRef.createElement!=='function')
    throw new Error('Mode A final review needs a document body');
  return new Promise(resolve=>{
    const doc=documentRef;
    const overlay=mk(doc,'div');
    overlay.className='model-converters-workflow-popup-overlay mc-rigid-review-overlay';
    const dialog=mk(doc,'div');
    dialog.className='mc-rigid-review-dialog';
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label','Verified canonical Mode A Final Match-2');
    const title=mk(doc,'h3','Verified Final Match-2 — all original physical occurrences');
    const info=mk(doc,'p',initial.physicalCount+' physical component(s), '+
      initial.verifiedFactCount+' verified engineering field(s), '+initial.unresolved+
      ' unresolved. Ranking alone never accepts physical mass.');
    const warning=mk(doc,'p','Each selected original source and every physical component will be checked. '+
      'Existing positive source/Match-1/Final kg remains unchanged unless you explicitly enter new Final kg with an engineering reason. '+
      'Apply freezes separate Final stage snapshots; it does not launch the CII writer.');
    const toolbar=mk(doc,'div');
    const search=mk(doc,'input');search.type='search';search.placeholder='Search original source or canonical occurrence';
    const sourceFilter=mk(doc,'select');
    const all=mk(doc,'option','All selected XML sources');all.value='';sourceFilter.appendChild(all);
    for(const id of initial.sources){const o=mk(doc,'option',id);o.value=id;sourceFilter.appendChild(o);}
    add(toolbar,search,sourceFilter);
    const position=mk(doc,'p');
    const viewport=mk(doc,'div');viewport.className='mc-rigid-review-verified-body';
    const pagination=mk(doc,'div');
    const previous=mk(doc,'button','Previous');previous.type='button';
    const next=mk(doc,'button','Next');next.type='button';
    add(pagination,previous,next);
    const controls=mk(doc,'div');
    const apply=mk(doc,'button','Apply verified Final reviews');apply.type='button';
    const cancel=mk(doc,'button','Cancel without applying');cancel.type='button';
    const status=mk(doc,'p');status.setAttribute('role','status');
    add(controls,apply,cancel);
    add(dialog,title,info,warning,toolbar,position,viewport,pagination,status,controls);
    overlay.appendChild(dialog);doc.body.appendChild(overlay);
    const drafts=new Map();let offset=0,closed=false,busy=false;
    const key=row=>JSON.stringify([row.sourceId,row.occurrenceId]);
    const matches=()=>{
      const q=String(search.value||'').toLowerCase().trim(),s=sourceFilter.value||'';
      return initial.rows.filter(row=>(!s||row.sourceId===s)&&
        (!q||(row.sourceId+' '+row.occurrenceId).toLowerCase().includes(q)));
    };
    const render=()=>{
      const rows=matches();
      if(offset>=rows.length)offset=Math.max(0,Math.floor(Math.max(rows.length-1,0)/pageSize)*pageSize);
      viewport.replaceChildren?.();
      if(typeof viewport.replaceChildren!=='function'){
        while(viewport.firstChild)viewport.removeChild(viewport.firstChild);
      }
      const slice=rows.slice(offset,offset+pageSize);
      for(const row of slice){
        const k=key(row),saved=drafts.get(k)||{value:'',reason:''};
        const line=mk(doc,'div');line.className='mc-verified-final-physical-row';
        const caption=mk(doc,'p',row.sourceId+' · '+row.occurrenceId);
        const existing=mk(doc,'p',row.status+' accepted: '+
          (positive(row.effectiveKg)?row.effectiveKg+' kg':'UNRESOLVED'));
        const massLabel=mk(doc,'label','New Final kg (optional when accepted mass exists)');
        const mass=mk(doc,'input');mass.type='number';mass.min='0.000001';mass.step='any';
        mass.value=saved.value;mass.placeholder=positive(row.effectiveKg)?String(row.effectiveKg)+' kg':'Required positive kg';
        const reasonLabel=mk(doc,'label','Engineering reason for new Final kg');
        const reason=mk(doc,'textarea');reason.value=saved.reason;
        reason.placeholder='Original component and independent engineering evidence';
        const capture=()=>{
          const nextDraft={value:String(mass.value||''),reason:String(reason.value||'')};
          if(!nextDraft.value&&!nextDraft.reason)drafts.delete(k);
          else drafts.set(k,nextDraft);
        };
        mass.addEventListener('input',capture);
        reason.addEventListener('input',capture);
        add(line,caption,existing,massLabel,mass,reasonLabel,reason);
        viewport.appendChild(line);
      }
      position.textContent='Showing '+(slice.length?(offset+1):0)+'–'+(offset+slice.length)+
        ' of '+rows.length+' matching components; '+drafts.size+' explicit draft(s) retained across pages.';
      previous.disabled=offset===0;
      next.disabled=offset+pageSize>=rows.length;
    };
    search.addEventListener('input',()=>{offset=0;render();});
    sourceFilter.addEventListener('change',()=>{offset=0;render();});
    previous.addEventListener('click',()=>{if(offset>0){offset=Math.max(0,offset-pageSize);render();}});
    next.addEventListener('click',()=>{if(offset+pageSize<matches().length){offset+=pageSize;render();}});
    const finish=value=>{if(closed)return;closed=true;overlay.remove();resolve(value);};
    cancel.addEventListener('click',()=>{if(!busy)finish({cancelled:true,basisId:initial.basisId,stage:'Rigidmatch2'});});
    apply.addEventListener('click',()=>{
      if(busy||closed)return;
      busy=true;apply.disabled=true;cancel.disabled=true;
      try{
        const current=readVerifiedModeAFinalRows(session);
        if(JSON.stringify(current)!==JSON.stringify(initial)){
          const e=new Error('Source fact population or Match-1/Final revision changed; reopen final review');
          e.code='STALE_MODE_A_FINAL_REVIEW';throw e;
        }
        const choices=[];
        for(const row of initial.rows){
          const draft=drafts.get(key(row));
          if(!draft)continue;
          const value=Number(draft.value),reason=draft.reason.trim();
          if(!draft.value||!positive(value)||!reason){
            const e=new Error('Every edited original physical component needs a positive Final kg and engineering reason');
            e.code='ENGINEERING_FINAL_REASON_REQUIRED';throw e;
          }
          choices.push({sourceId:row.sourceId,occurrenceId:row.occurrenceId,
            value,unit:'kg',reason});
        }
        const plan=planVerifiedFinalMatch2(session,choices);
        if(plan.physicalCount!==initial.physicalCount){
          const e=new Error('Original physical source population changed before Final apply');
          e.code='STALE_MODE_A_FINAL_REVIEW';throw e;
        }
        const result=commitVerifiedFinalMatch2(session,plan);
        finish({cancelled:false,...result});
      }catch(error){
        status.textContent='Final review was NOT accepted: '+String(error?.message||error)+
          (error?.code?' ['+error.code+']':'');
      }finally{
        busy=false;if(!closed){apply.disabled=false;cancel.disabled=false;}
      }
    });
    render();cancel.focus?.();
  });
}
