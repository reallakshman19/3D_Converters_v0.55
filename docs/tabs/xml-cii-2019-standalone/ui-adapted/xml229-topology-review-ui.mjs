/** Actual pre-Final topology actions, separate from native conversion/release. */
import {getXml229TopologyReview,getXml229TopologyFailure,xml229TopologyActions,
 runXml229TopologyReview,selectXml229TopologyActions,openXml229TopologyFreshWeight}
 from './xml229-topology-review-controller.mjs';
import {downloadTextFile} from './xml-cii-adapted-dom.js';

const pages=new WeakMap();
const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=text;return node;};
const key=ref=>ref?.modeABaseRef||ref;
function actionButton(action,text,disabled,handler){
 const node=el('button',text);node.type='button';node.dataset.action=action;node.disabled=disabled;
 node.addEventListener('click',()=>{if(!node.disabled)void handler().catch(()=>{});});return node;
}
function actionRows(table,actions,selected,stateRef,busy,render){
 for(const action of actions){
  const row=el('tr'),cell=el('td'),input=el('input');input.type='checkbox';
  input.dataset.topofixActionId=action.action_id;
  input.checked=selected.includes(action.action_id);
  input.disabled=busy||action.status!=='PROPOSED'||!!action.blockers?.length;
  input.addEventListener('change',()=>{
   const current=getXml229TopologyReview(stateRef);
   const values=new Set(current?.selected||[]);
   if(input.checked)values.add(action.action_id);else values.delete(action.action_id);
   selectXml229TopologyActions(stateRef,[...values]);render();
  });
  cell.append(input);row.append(cell,el('td',action.action_id),
   el('td',action.disposition),el('td',(action.node_numbers||[]).join(', ')),
   el('td',action.message||action.status));table.append(row);
 }
}
function downloads(parent,result){
 for(const [field,label,name] of [
  ['topologyFindingsText','Findings','topologyFindingsName'],
  ['topologyFixPlanText','Reviewed action plan','topologyFixPlanName'],
  ['topoFixXmlText','Committed TopoFix XML','topoFixXmlName'],
  ['topoFixTransactionText','Transaction','topoFixTransactionName'],
  ['topoFixValidationText','Validation','topoFixValidationName'],
  ['topoFixLineageText','Source lineage','topoFixLineageName'],
  ['topoFixPreFinalHandoffText','Fresh-basis handoff','topoFixPreFinalHandoffName'],
 ]){
  if(!result?.[field])continue;
  parent.append(actionButton('xml229-topology-download-'+field,'Download '+label,false,
   async()=>downloadTextFile(result[name]||field+'.json',result[field],
    field==='topoFixXmlText'?'application/xml':'application/json')));
 }
}
export function renderXml229TopologyReview(parent,{stateRef,render=()=>{}}={}){
 const ref=key(stateRef),state=ref.current,review=getXml229TopologyReview(ref);
 const root=el('section');root.dataset.xml229TopologyReview='true';
 root.append(el('h3','Topology review → fresh Weight review'));
 const status=el('p');status.setAttribute('role','status');
 const code=getXml229TopologyFailure(ref);
 status.textContent=code?'HOLD ['+code+']. No prior Final decisions were transferred.':
  review?.busy?'Topology/fresh-source work is running; native output remains held.':
  review?.freshProof?'Fresh TopoFix Worker opened. Complete the new Weight/Final review.':
  review?.result?.topoFixCommitted?'TopoFix committed. Start a fresh Weight review below.':
  review?.result?'Review individual actions, then commit your selection.':
  'Analyze the current XML before choosing actions. This step produces no CII and accepts no mass.';
 root.append(status);
 const busy=state.running===true||review?.busy===true;
 root.append(actionButton('xml229-topology-analyze','1. Analyze topology',busy,
  ()=>runXml229TopologyReview(ref,{render})));
 const actions=xml229TopologyActions(review?.result),selected=review?.selected||[];
 if(actions.length&&!review?.appliedSource){
  const page=Math.min(pages.get(ref)||0,Math.floor((actions.length-1)/50));
  root.append(el('p',actions.length+' plan actions; '+selected.length+' explicitly selected. Blocked actions cannot be selected.'));
  const table=el('table'),head=el('tr');table.className='xml-cii-weight-table';
  for(const label of ['Select','Action','Disposition','Nodes','Reason'])head.append(el('th',label));
  table.append(head);actionRows(table,actions.slice(page*50,page*50+50),selected,ref,busy,render);
  root.append(table);
  for(const [delta,label] of [[-1,'Previous actions'],[1,'Next actions']]){
   root.append(actionButton('xml229-topology-page-'+delta,label,busy||
    page+delta<0||(page+delta)*50>=actions.length,async()=>{pages.set(ref,page+delta);render();}));
  }
 }
 root.append(actionButton('xml229-topology-commit','2. Commit selected TopoFix actions',
  busy||!selected.length||!!review?.appliedSource,
  ()=>runXml229TopologyReview(ref,{commit:true,render})));
 root.append(actionButton('xml229-topology-fresh-weight','3. Open NEW Weight review from TopoFix',
  busy||!review?.result?.topoFixCommitted||!!review?.appliedSource,
  ()=>openXml229TopologyFreshWeight(ref,{container:root,render})));
 root.append(el('p','The fresh review uses the committed XML and a genuinely re-indexed O1 source. Previous Final decisions and review backups do not transfer. Native Download still requires actual output verification.'));
 downloads(root,review?.result);parent.append(root);
 return root;
}
