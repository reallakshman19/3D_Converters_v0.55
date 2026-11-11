import {createElement,downloadTextFile} from './xml-cii-adapted-dom.js';
import {inspectXml229InstrumentSourceReview,createXml229InstrumentSourceRevision}
 from '../integration/xml229-instrument-source-review.mjs';
const key=row=>JSON.stringify([row.branchOccurrenceIndex,row.sourceNodeOrdinal]);
const note=label=>createElement('div',label,'model-converters-workflow-detail-note');
const fail=()=>{throw new Error('INSTRUMENT_SOURCE_REVIEW_STALE');};

function button(action,label){
 const b=createElement('button',label);b.type='button';b.dataset.action=action;return b;
}

async function readSource(current){
 const {sourceFile,sourceText}=current;
 if(!sourceFile)return sourceText||'';
 const exact=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await sourceFile.arrayBuffer());
 if(sourceText&&sourceText!==exact)fail();
 return exact;
}

function sameCurrent(a,b){
 return a?.report===b?.report&&a?.sourceFile===b?.sourceFile&&
  a?.sourceText===b?.sourceText;
}

function reviewTable(review,choices,onChange){
 const table=createElement('table','','xml-cii-weight-table');
 const head=createElement('thead'),tr=createElement('tr');
 for(const label of ['Model as rigid','Branch ordinal','Node ordinal','Reference','Span mm'])
  tr.appendChild(createElement('th',label));
 head.appendChild(tr);table.appendChild(head);
 const body=createElement('tbody');
 for(const row of review.rows){
  const line=createElement('tr'),cell=createElement('td'),check=createElement('input');
  check.type='checkbox';check.checked=false;check.dataset.instrumentOwner=key(row);
  check.setAttribute('aria-label','Model instrument '+row.componentRefNo+
   ' at branch '+row.branchOccurrenceIndex+', node '+row.sourceNodeOrdinal+' as rigid');
  check.addEventListener('change',()=>{
   if(check.checked)choices.add(key(row));else choices.delete(key(row));onChange();
  });
  cell.appendChild(check);line.appendChild(cell);
  for(const value of [row.branchOccurrenceIndex,row.sourceNodeOrdinal,row.componentRefNo,row.spanMm])
   line.appendChild(createElement('td',String(value)));
  body.appendChild(line);
 }
 table.appendChild(body);return table;
}

function revisionName(sourceName,sha){
 const stem=String(sourceName||'source.xml').replace(/\.xml$/i,'').replace(/[^\w. -]/g,'_');
 return stem+'.instrument-model-'+sha.slice(0,8)+'.xml';
}

async function downloadRevision({snapshot,sourceText,readCurrent,status,choices,create,receipt,context}){
  if(context.busy)return;
  context.busy=true;create.disabled=true;
  const selected=[...choices];
  try{
   if(!sameCurrent(snapshot,readCurrent()))fail();
   const next=await createXml229InstrumentSourceRevision({sourceText,report:snapshot.report,selectedOwners:selected});
   if(!sameCurrent(snapshot,readCurrent())||!create.isConnected||
    selected.length!==choices.size||!selected.every(k=>choices.has(k)))fail();
   context.revision=next;
   downloadTextFile(revisionName(snapshot.sourceName,next.receipt.newSourceXmlSha256),
    next.revisedXml,'application/xml;charset=utf-8');
   receipt.disabled=false;
   status.textContent=next.receipt.selectedCount+' instrument models written to a new XML. '+
    'SHA256: '+next.receipt.newSourceXmlSha256+'. Reopen it and complete a NEW Final review. '+
    'The current source and Final masses were not changed.';
  }catch(error){status.textContent='Source revision unavailable: '+String(error?.message||error);}
  finally{context.busy=false;create.disabled=choices.size===0;}
}

function activationButton({snapshot,sourceText,readCurrent,status,choices,create,context,activate}){
 const use=button('xml229-use-instrument-source','Use revised XML and start fresh Final review');
 use.disabled=true;
 use.addEventListener('click',async()=>{
  if(context.busy)return;
  context.busy=true;use.disabled=true;create.disabled=true;
  try{
   if(!choices.size||!sameCurrent(snapshot,readCurrent()))fail();
   const selected=[...choices];
   const next=await createXml229InstrumentSourceRevision({sourceText,report:snapshot.report,selectedOwners:selected});
   if(!sameCurrent(snapshot,readCurrent())||!use.isConnected||
    selected.length!==choices.size||!selected.every(k=>choices.has(k)))fail();
   status.textContent='Activating revised XML, indexing the original JSON and rebuilding verified Preview…';
   await activate({sourceText,report:snapshot.report,revision:next,
    sourceName:revisionName(snapshot.sourceName,next.receipt.newSourceXmlSha256)});
  }catch(error){status.textContent='Fresh review held: '+String(error?.code||error?.message||error);}
  finally{context.busy=false;use.disabled=choices.size===0;create.disabled=choices.size===0;}
 });
 return use;
}

function renderChoices(panel,{review,snapshot,sourceText,readCurrent,status,activate}){
 const choices=new Set(),context={revision:null,busy:false};let use=null;
 panel.appendChild(note('Select only instruments you intend to model as rigid. '+
  'All rows start unchanged. Selected second endpoints receive Rigid = 2 in a NEW XML. '+
  'Use the revision here to rebuild Preview and start a NEW Final review, or download it separately.'));
 const create=button('xml229-create-instrument-source','Download revised instrument XML');
 const receipt=button('xml229-instrument-revision-receipt','Download source revision receipt JSON');
 receipt.disabled=true;
 const count=note('0 of '+review.rows.length+' selected');
 const changed=()=>{
  context.revision=null;receipt.disabled=true;create.disabled=context.busy||choices.size===0;
  if(use)use.disabled=context.busy||choices.size===0;
  count.textContent=choices.size+' of '+review.rows.length+' selected';
 };
 panel.appendChild(reviewTable(review,choices,changed));changed();
 create.addEventListener('click',()=>downloadRevision({
  snapshot,sourceText,readCurrent,status,choices,create,receipt,context,
 }));
 receipt.addEventListener('click',()=>{
  if(!context.revision)return;
  downloadTextFile('xml229-instrument-source-revision.json',
   JSON.stringify(context.revision.receipt,null,2),'application/json;charset=utf-8');
 });
 panel.append(count,create,receipt);
 if(typeof activate==='function'){
  use=activationButton({snapshot,sourceText,readCurrent,status,choices,create,context,activate});
  panel.appendChild(use);
 }
}

export function createXml229InstrumentSourceReviewControl({readCurrent,activate}){
 const host=createElement('div'),open=button('xml229-review-instrument-source',
  'Review instrument models and create revised XML');
 const status=note(''),panel=createElement('div');
 panel.dataset.xml229InstrumentSourceReview='true';status.setAttribute('role','status');
 open.addEventListener('click',async()=>{
  open.disabled=true;panel.replaceChildren();
  status.textContent='Checking exact source and instrument pairs…';
  const snapshot=readCurrent();
  try{
   const sourceText=await readSource(snapshot);
   const review=await inspectXml229InstrumentSourceReview({sourceText,report:snapshot.report});
   if(!sameCurrent(snapshot,readCurrent())||!host.isConnected)fail();
   renderChoices(panel,{review,snapshot,sourceText,readCurrent,status,activate});
   status.textContent='Source verified. No instrument models selected.';
  }catch(error){status.textContent='Source review unavailable: '+String(error?.message||error);}
  finally{open.disabled=false;}
 });
 host.append(open,status,panel);return host;
}
