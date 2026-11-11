/** Accessible Excel-style popup for the source-bound Weight table.
 * Uses only bounded, source-current Worker facet reads. Never accepts kg.
 */
import {XML229_WEIGHT_COLUMNS}
 from '../integration/xml229-weight-excel-filter.mjs';
const COLUMNS=new Map(XML229_WEIGHT_COLUMNS.map(x=>[x.key,x]));
const mk=(doc,tag,label='')=>{const el=doc.createElement(tag);if(label)el.textContent=label;return el;};
const style=(element,css)=>{element.style.cssText=css;return element;};
const button=(doc,label,action)=>{
 const el=mk(doc,'button',label);el.type='button';el.dataset.p4ExcelAction=action;
 style(el,'background:#1e3352;border:1px solid #526b88;border-radius:5px;'+
  'color:#ecf4ff;padding:6px 9px;cursor:pointer;font-size:12px');return el;
};
export function installXml229WeightExcelAutoFilter({
 root,table,readSession,readScope,refresh,resetPage,isCurrent,
}={}){
 if(!root||!table||typeof readSession!=='function'||typeof refresh!=='function'||
    typeof readScope!=='function'||typeof resetPage!=='function'||
    typeof isCurrent!=='function')throw Error('WEIGHT_EXCEL_UI_SESSION_REQUIRED');
 const filters=Object.create(null);let order=null,popup=null,requestToken=0;
 const snapshot=()=>({
  columnFilters:Object.fromEntries(Object.entries(filters).map(([k,v])=>
   [k,{...v,...(v.values?{values:[...v.values]}:{})}])),
  sort:order?{...order}:null,
 });
 const close=()=>{
  ++requestToken;
  popup?.remove();popup=null;
 };
 const requery=()=>{
  resetPage();
  return Promise.resolve(refresh());
 };
 const reset=()=>{
  close();
  for(const key of Object.keys(filters))delete filters[key];
  order=null;
 };
 const fail=message=>{
  const s=root.querySelector('[data-p4-weight-status]');
  if(s){s.textContent='AutoFilter: '+message;s.style.color='#f87171';}
 };
 const open=async(column,anchor)=>{
  close();if(!COLUMNS.has(column))return;
  const session=readSession();
  if(!session||!isCurrent(session)||typeof session.readColumnOptions!=='function')return;
  const doc=root.ownerDocument;
  const panel=mk(doc,'section');
  panel.dataset.p4ExcelPopup=column;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','Filter '+COLUMNS.get(column).label);
  style(panel,'position:fixed;z-index:2000;background:#102037;color:#e2e8f0;'+
   'border:1px solid #6b87ab;border-radius:9px;padding:12px;width:315px;'+
   'max-width:calc(100vw - 16px);box-shadow:0 14px 35px #000a;'+
   'font:12px system-ui,sans-serif');
  const rect=anchor.getBoundingClientRect();
  panel.style.left=Math.max(8,Math.min(rect.left,
    doc.documentElement.clientWidth-330))+'px';
  panel.style.top=Math.max(8,Math.min(rect.bottom+4,
    doc.documentElement.clientHeight-410))+'px';
  const heading=mk(doc,'strong',COLUMNS.get(column).label+' ▾ AutoFilter');
  const search=mk(doc,'input');
  search.type='search';search.placeholder='Find checkbox values…';
  search.setAttribute('aria-label','Search '+COLUMNS.get(column).label+' values');
  style(search,'width:100%;padding:7px;margin:10px 0 6px;background:#091426;'+
   'color:#fff;border:1px solid #536d91;border-radius:5px');
  const contains=mk(doc,'input');
  contains.type='search';contains.placeholder='Text contains (optional)';
  contains.value=filters[column]?.contains||'';
  contains.setAttribute('aria-label','Filter '+COLUMNS.get(column).label+' containing text');
  style(contains,'width:100%;padding:7px;margin:0 0 8px;background:#091426;'+
   'color:#fff;border:1px solid #536d91;border-radius:5px');
  const summary=mk(doc,'small','Loading verified column values…');
  const values=mk(doc,'div');values.setAttribute('role','group');
  values.setAttribute('aria-label','Select '+COLUMNS.get(column).label+' values');
  style(values,'max-height:220px;overflow-y:auto;margin:7px 0;'+
   'border:1px solid #405978;border-radius:4px;padding:4px');
  const selectionRow=mk(doc,'div');
  style(selectionRow,'display:flex;gap:6px;flex-wrap:wrap;margin:5px 0');
  const all=button(doc,'Select shown','select'),none=button(doc,'Deselect shown','deselect');
  selectionRow.append(all,none);
  const buttons=mk(doc,'div');style(buttons,'display:flex;gap:6px;flex-wrap:wrap;margin:9px 0');
  const asc=button(doc,'Sort A → Z','asc'),desc=button(doc,'Sort Z → A','desc');
  buttons.append(asc,desc);
  const actions=mk(doc,'div');style(actions,'display:flex;gap:6px;flex-wrap:wrap');
  const apply=button(doc,'Apply filter','apply'),clear=button(doc,'Clear column','clear');
  const exit=button(doc,'Close','close');actions.append(apply,clear,exit);
  panel.append(heading,search,contains,summary,selectionRow,values,buttons,actions);
  doc.body.appendChild(panel);popup=panel;
  let visible=[],picked=Array.isArray(filters[column]?.values)?
    new Set(filters[column].values):null;
  const load=async()=>{
   const token=++requestToken;
   summary.textContent='Reading full verified population…';
   const scope=readScope();
   try{
    const data=await session.readColumnOptions({
     column,filter:scope.filter,query:scope.query,hideShortMm:scope.hideShortMm,
     columnFilters:snapshot().columnFilters,search:search.value,
    });
    if(token!==requestToken||popup!==panel||!isCurrent(session))return;
    if(data?.schema!=='XML229.WeightExcelColumnOptions.v1'||data.column!==column||
       !Array.isArray(data.options))throw Error('COLUMN_OPTIONS_INVALID');
    visible=data.options;
    values.replaceChildren();
    for(const item of visible){
     const label=mk(doc,'label');
     style(label,'display:flex;align-items:center;gap:7px;cursor:pointer;'+
      'padding:3px 4px;overflow-wrap:anywhere');
     const check=mk(doc,'input');check.type='checkbox';check.value=item.value;
     check.checked=picked===null||picked.has(item.value);
     const caption=mk(doc,'span',item.value+' ('+item.count+')');
     label.append(check,caption);values.appendChild(label);
     check.addEventListener('change',()=>{
      if(picked===null)picked=new Set(visible.map(x=>x.value));
      if(check.checked)picked.add(item.value);else picked.delete(item.value);
     });
    }
    if(!visible.length)values.append(mk(doc,'p','No matching values.'));
    summary.textContent=data.totalDistinct+' distinct value(s) in full verified scope'+
      (data.truncated?' — showing first 250; search to narrow':'')+'.';
   }catch(error){
    if(token===requestToken&&popup===panel)
     summary.textContent='Unable to read verified options ['+
      String(error?.code||'READ_FAILED')+'].';
   }
  };
  search.addEventListener('input',()=>{void load();});
  all.addEventListener('click',()=>{
   if(picked!==null)for(const item of visible)picked.add(item.value);
   values.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=true);
  });
  none.addEventListener('click',()=>{
   if(picked===null)picked=new Set(visible.map(x=>x.value));
   for(const item of visible)picked.delete(item.value);
   values.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=false);
  });
  apply.addEventListener('click',()=>{
   if(!isCurrent(session))return;
   const criterion={};
   if(picked!==null)criterion.values=[...picked];
   if(contains.value.trim())criterion.contains=contains.value.trim().slice(0,120);
   if(Object.keys(criterion).length)filters[column]=criterion;
   else delete filters[column];
   close();void requery().catch(e=>fail(String(e?.code||e)));
  });
  clear.addEventListener('click',()=>{
   if(!isCurrent(session))return;
   delete filters[column];if(order?.column===column)order=null;
   close();void requery().catch(e=>fail(String(e?.code||e)));
  });
  for(const [control,direction] of [[asc,'asc'],[desc,'desc']]){
   control.addEventListener('click',()=>{
    if(!isCurrent(session))return;
    order={column,direction};
    close();void requery().catch(e=>fail(String(e?.code||e)));
   });
  }
  exit.addEventListener('click',close);
  search.focus();
  await load();
 };
 const onClick=event=>{
  const target=event.target.closest?.('[data-p4-excel-column],[data-p4-excel-clear]');
  if(!target||!root.contains(target))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(target.hasAttribute('data-p4-excel-clear')){
   reset();
   void requery().catch(e=>fail(String(e?.code||e)));
  }else void open(target.dataset.p4ExcelColumn,target).catch(e=>fail(String(e?.code||e)));
 };
 root.addEventListener('click',onClick,true);
 return Object.freeze({snapshot,reset,close,
  dispose(){root.removeEventListener('click',onClick,true);close();},
 });
}
