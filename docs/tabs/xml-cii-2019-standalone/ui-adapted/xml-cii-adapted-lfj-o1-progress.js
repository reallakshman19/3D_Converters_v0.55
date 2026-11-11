/**
 * #229 LFJ source scan presentation only. No source/Trace/CSV authority writes.
 * Total page count is UNKNOWN until a verified SOURCE_INDEX_COMPLETE commit.
 * Never derive a percentage or completion ETA from pages staged.
 */
const phaseLabels=Object.freeze({
  idle:'Awaiting source',
  scanning:'Indexing original JSON in Worker',
  committing:'Durable index commit pending',
  committed:'Source index committed',
  failed:'Source index failed',
  revoked:'Previous source receipt revoked',
  unavailable:'Worker source flow unavailable',
});
function nonNegativeInt(value){
  return Number.isSafeInteger(value)&&value>=0?value:null;
}
function duration(state,now){
  const start=state.startedAtMs;
  return start===null?0:Math.max(0,Math.round(Number(now)-start));
}
export function createLfjSourceProgress(){
  return Object.freeze({phase:'idle',pagesStaged:0,occurrencesCommitted:null,
    startedAtMs:null,elapsedMs:0,sourceCommitted:false,code:''});
}
export function advanceLfjSourceProgress(prev,event={}){
  const state=prev||createLfjSourceProgress(),now=Number(event.nowMs);
  const at=Number.isFinite(now)&&now>=0?now:0;
  switch(event.kind){
    case 'START':return Object.freeze({
      phase:'scanning',pagesStaged:0,occurrencesCommitted:null,
      startedAtMs:at,elapsedMs:0,sourceCommitted:false,code:'',
    });
    case 'PAGE':{
      if(state.phase!=='scanning')return state;
      const n=nonNegativeInt(event.pagesStaged);
      if(n===null||n<=state.pagesStaged)return state;
      return Object.freeze({...state,pagesStaged:n,elapsedMs:duration(state,at)});
    }
    case 'COMMIT_PENDING':
      return state.phase==='scanning'?
        Object.freeze({...state,phase:'committing',elapsedMs:duration(state,at)}):state;
    case 'SOURCE_COMMITTED':{
      const summary=event.summary;
      // The caller only reaches here AFTER its durable IDB commit succeeds.
      // Guard against accidental promotion by an incomplete summary.
      const count=nonNegativeInt(summary?.occurrenceCount);
      if(state.phase!=='committing'||summary?.complete!==true||
        summary.rightsBasis!=='SOURCE_FACTS_ONLY'||summary.engineeringReady!==false||
        count===null)throw new Error('LFJ_PROGRESS_REQUIRES_VERIFIED_SOURCE_COMMIT');
      return Object.freeze({...state,phase:'committed',sourceCommitted:true,
        occurrencesCommitted:count,elapsedMs:duration(state,at)});
    }
    case 'FAILED':
      return Object.freeze({...state,phase:'failed',sourceCommitted:false,
        occurrencesCommitted:null,elapsedMs:duration(state,at),
        code:String(event.code||'LFJ_SOURCE_FAILED').slice(0,100)});
    case 'REVOKED':
      return Object.freeze({...createLfjSourceProgress(),phase:'revoked'});
    case 'UNAVAILABLE':
      return Object.freeze({...createLfjSourceProgress(),phase:'unavailable'});
    default:return state;
  }
}
export function lfjSourceProgressView(state){
  const stage=state?.phase||'idle';
  const active=stage==='scanning'||stage==='committing';
  const elapsedSeconds=Math.floor(Math.max(0,Number(state?.elapsedMs)||0)/1000);
  const pages=nonNegativeInt(state?.pagesStaged)||0;
  const committed=stage==='committed'&&state.sourceCommitted===true;
  const detail=stage==='scanning'
    ? `${pages.toLocaleString('en-US')} bounded page${pages===1?'':'s'} staged · ${elapsedSeconds}s elapsed · total pages unknown`
    : stage==='committing'
      ? `${pages.toLocaleString('en-US')} staged page${pages===1?'':'s'} · verifying durable commit · ${elapsedSeconds}s elapsed`
      : committed
        ? `${Number(state.occurrencesCommitted).toLocaleString('en-US')} original occurrences committed · ${pages.toLocaleString('en-US')} source pages · ${elapsedSeconds}s`
        : stage==='failed'
          ? 'Provisional pages invalidated; no source index or CSV rights'
          : stage==='revoked'
            ? 'Previous staged pages invalidated; no source output promoted'
            : 'Waiting for source scan; no completion estimate';
  return Object.freeze({phase:stage,title:phaseLabels[stage]||'Awaiting source',
    detail,indeterminate:active,complete:committed,
    rights:'Trace/CSV require a separate authorized Build and source-bound domain receipt.',
    pagesStaged:pages,elapsedSeconds});
}
/** DOM-only renderer. Uses native indeterminate progress until durable commit. */
export function mountLfjSourceProgress(container,state){
  const root=document.createElement('div');
  root.dataset.lfjO1Progress='true';
  root.setAttribute('role','group');
  root.setAttribute('aria-label','LFJ source index progress');
  root.style.cssText='display:grid;gap:6px;padding:10px;margin-top:8px;border:1px solid #475569;border-radius:8px;background:rgba(15,23,42,.45)';
  const title=document.createElement('strong');title.dataset.lfjO1ProgressTitle='true';
  const bar=document.createElement('progress');
  bar.dataset.lfjO1ProgressBar='true';bar.max=1;
  bar.style.cssText='width:100%;height:12px;accent-color:#38bdf8';
  const detail=document.createElement('span');detail.dataset.lfjO1ProgressDetail='true';
  detail.style.cssText='font-size:12px;color:#cbd5e1;font-variant-numeric:tabular-nums';
  const rights=document.createElement('small');rights.dataset.lfjO1ProgressRights='true';
  rights.style.cssText='color:#94a3b8';
  root.append(title,bar,detail,rights);
  container.appendChild(root);
  updateLfjSourceProgress(root,state);
  return root;
}
export function updateLfjSourceProgress(root,state){
  if(!root)return;
  const view=lfjSourceProgressView(state);
  root.dataset.phase=view.phase;
  root.querySelector('[data-lfj-o1-progress-title]').textContent=view.title;
  const bar=root.querySelector('[data-lfj-o1-progress-bar]');
  if(view.indeterminate)bar.removeAttribute('value');
  else bar.value=view.complete?1:0;
  bar.setAttribute('aria-label',view.indeterminate?'Source scan in progress; total unknown':
    view.complete?'Source index committed':'Source index not committed');
  root.querySelector('[data-lfj-o1-progress-detail]').textContent=view.detail;
  root.querySelector('[data-lfj-o1-progress-rights]').textContent=view.rights;
}
