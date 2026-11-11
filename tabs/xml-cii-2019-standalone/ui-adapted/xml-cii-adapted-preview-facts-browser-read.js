// Agent P P3-B1: independent raw source-selection census + paged source
// FactRecords. Source field custody is NOT engineering acceptance.
import {previewOccurrenceId} from './xml-cii-adapted-preview-facts-basis.js';
import {buildXmlCiiSourceFactRecords,openPreviewFactReadModel}
  from './xml-cii-adapted-preview-facts-read-model.js';
import {assertBasisDigest,assertContentDigest,canonicalJson,digestCanonical,validateFactRecord,validatePage}
  from '../../../contracts/gc-pw-v1/contract.mjs';

const ports=Object.freeze({assertBasisDigest,canonicalJson,digestCanonical,
  validateFactRecord,validatePage});
const error=(code,message)=>Object.assign(new Error(message),{code});
const text=(v)=>String(v??'');
const localName=(n)=>text(n?.localName||n?.nodeName).replace(/^.*:/,'');
const children=(n,name)=>[...(n?.childNodes||[])].filter(x=>x.nodeType===1&&localName(x)===name);
const escape=(v)=>text(v).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
/** Reparse actual raw source XML, do not obtain expected counts from facts. */
export function independentOriginalXmlCensus({xmlText,sourceId,mode='A'}={}) {
  if(mode!=='A')throw error('MODE_B_INDEPENDENT_ORACLE_REQUIRED',
    'Mode B needs original per-file independent source attestation');
  if(typeof sourceId!=='string'||!sourceId.trim())
    throw error('SOURCE_ID_REQUIRED','Original XML source ID is required');
  if(typeof DOMParser!=='function')
    throw error('XML_PARSER_UNAVAILABLE','Independent XML DOM parser unavailable');
  const doc=new DOMParser().parseFromString(text(xmlText),'application/xml');
  if(!doc.documentElement||doc.getElementsByTagName('parsererror').length
    ||localName(doc.documentElement)!=='PipeStressExport')
    throw error('INVALID_XML_SOURCE','Independent XML source could not be parsed');
  const expected=[];
  let bi=0;
  for(const pipe of children(doc.documentElement,'Pipe')){
    for(const branch of children(pipe,'Branch')){
      expected.push({subjectType:'branch',sourceId,
        occurrenceId:previewOccurrenceId({sourceId,branchOrdinal:bi})});
      for(const [ni] of children(branch,'Node').entries())
        expected.push({subjectType:'node',sourceId,
          occurrenceId:previewOccurrenceId({sourceId,branchOrdinal:bi,nodeOrdinal:ni})});
      bi++;
    }
  }
  if(!bi)throw error('EMPTY_SOURCE','Source has no Branch occurrences');
  return Object.freeze(expected.map(x=>Object.freeze(x)));
}
export async function openActualPreviewSourceFactPages({
  basis,xmlText,sourceId,sourceOccurrences,mode='A',
}={}) {
  await assertBasisDigest(basis);
  const sourceRef=basis.sourceRefs.find(x=>x.sourceId===sourceId);
  if(!sourceRef)throw error('SOURCE_OUTSIDE_BASIS','Original source ID missing from InputBasis');
  await assertContentDigest(xmlText,sourceRef.sha256);
  if(sourceOccurrences?.schemaVersion!=='gc-pw/1.0'
    ||sourceOccurrences?.domainId!==basis.domainId
    ||!Array.isArray(sourceOccurrences.branches)
    ||!Array.isArray(sourceOccurrences.nodes))
    throw error('INVALID_WORKER_SOURCE','Worker source-occurrence envelope missing');
  const expected=independentOriginalXmlCensus({xmlText,sourceId,mode});
  const raw=buildXmlCiiSourceFactRecords({
    basisId:basis.basisId,projection:sourceOccurrences});
  const model=await openPreviewFactReadModel({
    basis,expectedOccurrences:expected,records:raw,ports,
  });
  if(model.info.engineeringReady)
    throw error('INCORRECT_ENGINEERING_AUTHORITY','Source-only facts must remain engineering-incomplete');
  return {model,branchCount:expected.filter(x=>x.subjectType==='branch').length,
    nodeCount:expected.filter(x=>x.subjectType==='node').length};
}
export function installActualPreviewSourceFactPanel(host,sourceFactPages) {
  if(!host||!sourceFactPages?.model)throw error('SOURCE_FACT_STORE_REQUIRED','Source fact model required');
  const {model,branchCount,nodeCount}=sourceFactPages;
  const panel=document.createElement('section');
  panel.dataset.mcPreviewSourceFacts='true';
  panel.className='model-converters-workflow-master-card';
  panel.style.cssText='margin-top:12px;padding:12px;';
  const header=document.createElement('div');
  header.innerHTML=`<strong>Original source fact custody</strong>
    <span style="margin-left:8px;">${branchCount} branches · ${nodeCount} original nodes</span>
    <div style="margin-top:4px;">Source facts are provisional. Engineering field acceptance is not assessed.</div>`;
  panel.appendChild(header);
  const button=document.createElement('button');
  button.type='button';button.textContent='Inspect source facts';
  button.dataset.mcPreviewSourceFactsOpen='true';panel.appendChild(button);
  const pageHost=document.createElement('div');pageHost.dataset.mcPreviewSourceFactsPage='true';
  panel.appendChild(pageHost);host.appendChild(panel);
  const cursors=[null];
  let current=0;
  async function show() {
    if(!panel.isConnected)return;
    const page=await model.getFacts({basisId:model.info.basisId,
      cursor:cursors[current],limit:50});
    if(page.complete)throw error('SOURCE_FACT_AUTHORITY_DRIFT','Source-only page unexpectedly claims engineering completion');
    const first=current*50+1,last=first+page.items.length-1;
    const rows=page.items.map(f=>`<tr><td>${escape(f.sourceId)}</td>
      <td>${escape(f.occurrenceId)}</td><td>${escape(f.fieldId)}</td>
      <td>${escape(f.value===null?'unresolved':JSON.stringify(f.value))}</td>
      <td>${escape(f.authority)}</td><td>${escape(f.provenance[0]?.locator||'')}</td></tr>`).join('');
    pageHost.innerHTML=`<div>Facts ${first}–${last} of ${page.totalCount}
      (50 per page; complete source universe retained)</div>
      <div style="max-height:260px;overflow:auto;">
      <table><thead><tr><th>Source</th><th>Occurrence</th><th>Field</th>
      <th>Original value</th><th>Authority</th><th>Locator</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <button type="button" data-mc-preview-facts-prev ${current===0?'disabled':''}>Previous</button>
      <button type="button" data-mc-preview-facts-next ${page.nextCursor===null?'disabled':''}>Next</button>`;
    pageHost.querySelector('[data-mc-preview-facts-prev]')?.addEventListener('click',()=>{
      current=Math.max(0,current-1);void show();
    });
    pageHost.querySelector('[data-mc-preview-facts-next]')?.addEventListener('click',()=>{
      if(page.nextCursor===null)return;
      if(cursors[current+1]===undefined)cursors.push(page.nextCursor);
      current++;void show();
    });
  }
  button.addEventListener('click',()=>{button.disabled=true;void show().catch(e=>{
    pageHost.textContent='Source facts unavailable: '+text(e?.message||e);});},{once:true});
  host.__xmlCiiPreviewFactReadModel=model;
  return panel;
}
