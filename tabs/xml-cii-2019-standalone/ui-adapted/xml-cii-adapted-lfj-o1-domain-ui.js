/**
 * O1 independent UI/domain adapter: original Blob stays off foreground JSON
 * parse. Source-index commits, XML dependencies and exact JSON Pointer
 * provenance are re-attested before allowing user trace/CSV interaction.
 * No output is engineeringReady or Preview/Weight-approved.
 */
const SCHEMA='LFJ.O1.DomainWorker.v1';
const HEADERS={
 node:[['xmlNode','XML Node'],['xmlBranch','XML Branch'],['matchType','Match'],
   ['dtxrPosValue','DTXR_POS'],['dtxrPsName','DTXR_PS/NAME'],['effectiveSource','Source'],
   ['status','Status']],
 evidence:[['branch','Branch'],['sourceNodeNo','Source Node'],
   ['dtxrPos','DTXR_POS'],['name','NAME'],['sourcePath','Original JSON Path']]
};
const typed=code=>Object.assign(new Error(code),{code});
const currentBasis=(s,j,b)=>s.job===j&&!j.cancelled&&
  s.domain?.basis===b&&s.domain.job===j&&
  s.domain.sourceText===s.domain.stateRef.current.sourceText&&
  s.domain.sourceKind===s.domain.stateRef.current.sourceKind&&
  s.domain.supportConfigJson===s.domain.stateRef.current.supportConfigJson&&
  s.domain.config===JSON.stringify(s.domain.stateRef.current.resolverJsonTraceConfig||{})&&
  s.domain.scope===(s.domain.stateRef.current.jsonTraceScopeId||'');
const pointer=path=>{
  if(typeof path!=='string'||!/^\$(?:(?:\[(?:0|[1-9]\d*)\])|(?:\.children\[(?:0|[1-9]\d*)\]))*$/.test(path))
    throw typed('O1_ORIGINAL_PATH_UNSUPPORTED');
  return path.slice(1).replace(/\.children/g,'/children').replace(/\[(\d+)\]/g,'/$1');
};
const notify=(session,text)=>{
  session.status=text;
  if(session.label)session.label.textContent=text;
  if(session.domain?.status)session.domain.status.textContent=text;
};
function call(domain,kind,payload={},timeout=120000){
  return new Promise((resolve,reject)=>{
    const token=domain.nextToken++;
    // The protocol is sequential within each kind; PAGE and PATH_PAGE are
    // distinct, preventing a stale answer from satisfying a new request.
    if(domain.pending.has(kind))return reject(typed('O1_DOMAIN_REQUEST_BUSY'));
    const timer=setTimeout(()=>{
      domain.pending.delete(kind);reject(typed('O1_DOMAIN_TIMEOUT'));
    },timeout);
    domain.pending.set(kind,{resolve,reject,timer});
    domain.worker.postMessage({schema:SCHEMA,kind,jobId:domain.job.id,
      sourceRefId:domain.job.ref,sourceSha256:domain.job.basis.sourceSha256,
      sourceRevision:domain.job.basis.sourceRevision,token,...payload});
  });
}
function deliver(domain,msg){
  const k=msg.kind==='READY'?'RUN':msg.kind;
  const slot=domain.pending.get(k);if(!slot)return;
  clearTimeout(slot.timer);domain.pending.delete(k);slot.resolve(msg);
}
function dispose(session){
  const d=session.domain;if(!d)return;
  for(const pending of d.pending.values()){clearTimeout(pending.timer);pending.reject(typed('O1_DOMAIN_REVOKED'));}
  d.pending.clear();d.ready=false;
  try{d.worker?.terminate();}catch{}
  session.domain=null;
  // Invalidating the source must also remove previously rendered export
  // controls; a new committed source and Build are required to restore them.
  if(session.domainPanel){
    session.domainPanel.replaceChildren();
    const note=document.createElement('p');
    note.dataset.lfjO1TraceStatus='true';
    note.textContent='Previous source trace and CSV exports revoked; load a valid source and Build again.';
    session.domainPanel.append(note);
  }
}
export function revokeLfjO1Domain(session){dispose(session);}
async function auditSourcePaths(session,d,ready){
  const requested=new Set(),total=ready.counts?.paths;
  if(!Number.isSafeInteger(total)||total<0||total>2000000)
    throw typed('O1_PROVENANCE_RESOURCE_BOUND');
  for(let start=0;start<total;start+=128){
    if(!currentBasis(session,d.job,d.basis))throw typed('O1_SOURCE_STALE');
    const batch=await call(d,'PATH_PAGE',{start},30000);
    if(batch.start!==start||batch.total!==total||!Array.isArray(batch.paths)||
      batch.paths.length!==Math.min(128,total-start))
      throw typed('O1_PROVENANCE_PAGE_INVALID');
    for(const path of batch.paths)requested.add(pointer(path));
  }
  const wanted=requested.size;let scanned=0;
  // Native committed HEAD checked inside readOrdered. All attested source
  // paths are exact RFC6901 paths from the R05 OPEN source index.
  if(typeof d.job.store.readCommittedPages!=='function')
    throw typed('O1_COMMITTED_PAGE_PORT_REQUIRED');
  for await(const page of d.job.store.readCommittedPages()){
    if(!currentBasis(session,d.job,d.basis))throw typed('O1_SOURCE_STALE');
    for(const row of page.rows){
      if(row.kind!=='OPEN')continue;
      requested.delete(row.path);
      scanned++;
    }
    // A complete bounded event page is attested atomically. Yield once per
    // page so DOM/events remain responsive, not once per individual source fact.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(!currentBasis(session,d.job,d.basis))throw typed('O1_SOURCE_STALE');
  }
  if(requested.size)throw typed('O1_ORIGINAL_PATH_NOT_COMMITTED');
  return {wanted,scanned};
}
function paint(session){
  const d=session.domain,panel=d?.panel;if(!panel)return;
  panel.replaceChildren();
  const heading=document.createElement('h4');
  heading.textContent='O1 — original source-attested XML/JSON trace (independent Worker)';
  panel.append(heading);
  const info=document.createElement('p');info.dataset.lfjO1TraceStatus='true';
  info.textContent=d.ready
    ? 'SOURCE-PATH VERIFIED: '+d.provenance.wanted+' original JSON values; '+
      d.counts.node+' XML rows, '+d.counts.evidence+' evidence rows. '+
      'Not approved engineering output, Preview or Weight.'
    : 'Awaiting an independently committed source index and original XML.';
  panel.append(info);
  if(!d.ready)return;
  const tools=document.createElement('div');
  const buttons=[
    ['node','Node wise trace'],['evidence','Evidence tree'],
    ['export-node','Download complete Node CSV'],['export-evidence','Download complete Evidence CSV']
  ];
  for(const [kind,label] of buttons){
    const b=document.createElement('button');b.type='button';b.textContent=label;
    b.dataset.lfjO1Action=kind;
    b.addEventListener('click',()=>{
      if(kind.startsWith('export-'))void exportLfjO1Csv(session,kind.slice(7)).catch(e=>notify(session,'O1 export blocked: '+(e.code||e.message)));
      else void viewLfjO1Page(session,kind,0).catch(e=>notify(session,'O1 page blocked: '+(e.code||e.message)));
    });
    tools.append(b);
  }
  panel.append(tools);
  const pager=document.createElement('div');pager.dataset.lfjO1Pager='true';
  panel.append(pager);
  const box=document.createElement('div');box.style.maxHeight='360px';box.style.overflow='auto';
  const table=document.createElement('table');table.dataset.lfjO1Table='true';
  box.append(table);panel.append(box);
  renderTable(d);
}
function renderTable(d){
  const panel=d.panel,table=panel?.querySelector('[data-lfj-o1-table]');
  if(!table||!d.page)return;
  table.replaceChildren();
  const headers=HEADERS[d.page.type];
  const thead=document.createElement('thead'),tr=document.createElement('tr');
  for(const [,label] of headers){const h=document.createElement('th');h.textContent=label;tr.append(h);}
  thead.append(tr);table.append(thead);
  const tbody=document.createElement('tbody');
  for(const row of d.page.rows){
    const t=document.createElement('tr');
    for(const [field] of headers){const td=document.createElement('td');td.textContent=String(row[field]??'');t.append(td);}
    tbody.append(t);
  }
  table.append(tbody);
  const pager=panel.querySelector('[data-lfj-o1-pager]');pager.replaceChildren();
  const summary=document.createElement('span');summary.textContent=
    d.page.type+' rows '+(d.page.start+1)+'–'+(d.page.start+d.page.rows.length)+
    ' of '+d.page.total+' | File SHA '+d.job.basis.sourceSha256.slice(0,12)+' ';
  pager.append(summary);
  for(const [delta,label] of [[-64,'Previous'],[64,'Next']]){
    const b=document.createElement('button');b.textContent=label;b.type='button';
    b.disabled=delta<0?d.page.start===0:d.page.start+64>=d.page.total;
    b.addEventListener('click',()=>void viewLfjO1Page(d.session,d.page.type,
      Math.max(0,d.page.start+delta)));
    pager.append(b);
  }
}
export async function startLfjO1Domain(session,stateRef){
  const job=session.job;
  if(!job||!job.summary||!job.store||job.cancelled)throw typed('O1_SOURCE_NOT_COMMITTED');
  dispose(session);
  const state=stateRef.current;
  const sourceText=state.sourceText||'';
  const sourceKind=state.sourceKind||'auto';
  if(!sourceText||sourceKind==='inputxml')throw typed('O1_ORIGINAL_XML_REQUIRED');
  const scopeId=state.jsonTraceScopeId||'';
  if(scopeId&&scopeId!=='__ALL__'){
    const model=state.resolverJsonTraceO1ScopeReadModel;
    if(model?.schema!=='LFJ.O1.HierarchyScopes.v1'||
       model.sourceRefId!==job.ref||model.sourceSha256!==job.basis.sourceSha256||
       model.sourceRevision!==job.basis.sourceRevision||model.indexable!==true||
       !model.scopes?.some(s=>s.id===scopeId&&s.itemCount===model.itemCount))
      throw typed('O1_SCOPE_NOT_SOURCE_AUTHORIZED');
  }
  const rootId=JSON.stringify(['lfj-json-value/v1',job.ref,job.basis.sourceRevision,'']);
  const root=await job.store.lookupCommittedPair(rootId);
  if(session.job!==job||job.cancelled)throw typed('O1_SOURCE_STALE');
  if(root.open?.path!==''||root.open?.ordinal!==0||
    root.open.sourceSha256!==job.summary.sourceSha256||
    root.seal.sourceSha256!==job.summary.sourceSha256||
    root.seal.endByteExclusive>job.file.size)throw typed('O1_ROOT_SOURCE_INVALID');
  const worker=new Worker(new URL('../workers/lfj-o1-resolver-domain-worker.mjs',import.meta.url),{type:'module'});
  const basis=Object.freeze({sourceRefId:job.ref,sourceSha256:job.basis.sourceSha256,
    sourceRevision:job.basis.sourceRevision});
  const d={worker,job,basis,session,stateRef,sourceText,sourceKind,
    supportConfigJson:state.supportConfigJson,config:JSON.stringify(state.resolverJsonTraceConfig||{}),
    scope:state.jsonTraceScopeId||'',pending:new Map(),nextToken:0,
    ready:false,counts:null,page:null,provenance:null,
    panel:session.domainPanel};
  session.domain=d;
  worker.onmessage=({data:m})=>{
    if(m?.schema!==SCHEMA||m.jobId!==job.id||session.domain!==d)return;
    if(m.kind==='FAILED'){
      for(const p of d.pending.values()){clearTimeout(p.timer);p.reject(typed(m.code||'O1_DOMAIN_FAILED'));}
      d.pending.clear();notify(session,'O1 Worker FAILED: '+(m.code||'UNKNOWN')+'; no export rights');return;
    }
    if(m.kind==='EXPORT_CHUNK'&&d.exporting?.token===m.token){
      if(!(m.bytes instanceof Uint8Array)||m.bytes.length>65536){
        d.exporting.reject(typed('O1_EXPORT_CHUNK_INVALID'));d.exporting=null;return;
      }
      d.exporting.chunks.push(m.bytes);
      d.worker.postMessage({schema:SCHEMA,kind:'EXPORT_ACK',jobId:job.id,
        sourceRefId:job.ref,sourceSha256:basis.sourceSha256,
        sourceRevision:basis.sourceRevision,token:m.token});return;
    }
    if(m.kind==='EXPORT_BEGIN'){
      const p=d.pending.get('EXPORT');if(p){clearTimeout(p.timer);d.pending.delete('EXPORT');p.resolve(m);}
      return;
    }
    if(m.kind==='EXPORT_END'&&d.exporting?.token===m.token){
      d.exporting.resolve(d.exporting.chunks);d.exporting=null;return;
    }
    deliver(d,m);
  };
  worker.onerror=()=>{
    for(const p of d.pending.values()){clearTimeout(p.timer);p.reject(typed('O1_DOMAIN_WORKER_ERROR'));}
    d.pending.clear();notify(session,'O1 domain Worker failed; no export rights');
  };
  notify(session,'O1 source index committed. Running original XML matching in separate Worker…');
  try{
    const ready=await call(d,'RUN',{
      sourceText,sourceKind,selectionDigest:d.scope||'ALL',
      sourceRefId:job.ref,sourceSha256:basis.sourceSha256,
      sourceRevision:basis.sourceRevision,byteLength:job.file.size,
      committedRoot:{startByte:root.open.startByte,endByteExclusive:root.seal.endByteExclusive},
      jsonBlob:job.file,jsonConfig:state.resolverJsonTraceConfig,
      supportConfigJson:state.supportConfigJson,jsonTraceScopeId:d.scope
    },240000);
    if(!currentBasis(session,job,basis))throw typed('O1_SOURCE_STALE');
    if(ready.sourceSha256!==basis.sourceSha256||ready.sourceRevision!==basis.sourceRevision||
      ready.selectionDigest!==(d.scope||'ALL')||ready.engineeringReady!==false)
      throw typed('O1_DOMAIN_RESULT_BASIS');
    notify(session,'O1 Worker trace completed; verifying all selected original JSON paths…');
    d.provenance=await auditSourcePaths(session,d,ready);
    if(!currentBasis(session,job,basis))throw typed('O1_SOURCE_STALE');
    d.counts=ready.counts;d.ready=true;
    await viewLfjO1Page(session,'node',0);
    paint(session);
    notify(session,'O1 matched trace source-path verified ('+d.provenance.wanted+
      ' paths). Not an approved engineering output.');
    return d;
  }catch(e){dispose(session);notify(session,'O1 domain blocked: '+(e.code||e.message)+
    '; no trace/export rights');throw e;}
}
export async function viewLfjO1Page(session,type='node',start=0){
  const d=session.domain;
  if(!d?.ready||!currentBasis(session,d.job,d.basis))throw typed('O1_SOURCE_STALE');
  const page=await call(d,'PAGE',{type,start},30000);
  if(!currentBasis(session,d.job,d.basis)||page.type!==type||page.start!==start||
    !Array.isArray(page.rows)||page.rows.length>64)throw typed('O1_PAGE_INVALID');
  d.page={type,start,rows:page.rows,total:page.total};
  renderTable(d);return d.page;
}
export async function exportLfjO1Csv(session,type){
  const d=session.domain;
  if(!d?.ready||!currentBasis(session,d.job,d.basis))throw typed('O1_EXPORT_SOURCE_STALE');
  if(!['node','evidence'].includes(type))throw typed('O1_EXPORT_TYPE');
  if(d.exporting)throw typed('O1_EXPORT_BUSY');
  const begin=await call(d,'EXPORT',{type},120000);
  if(begin.type!==type||!Number.isSafeInteger(begin.bytes)||begin.bytes<1)
    throw typed('O1_EXPORT_BASIS');
  let chunks;
  try{
    chunks=await new Promise((resolve,reject)=>{d.exporting={token:begin.token,chunks:[],resolve,reject};});
  }finally{d.exporting=null;}
  if(!currentBasis(session,d.job,d.basis))throw typed('O1_EXPORT_SOURCE_STALE');
  const blob=new Blob(chunks,{type:'text/csv;charset=utf-8'});
  if(blob.size!==begin.bytes)throw typed('O1_EXPORT_INCOMPLETE');
  const name=type==='node'?'xml-cii-node-wise-trace.csv':'xml-cii-evidence-tree.csv';
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.style.display='none';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  notify(session,'Downloaded '+begin.rows+' original '+type+' CSV rows; SHA '+
    d.job.basis.sourceSha256.slice(0,12)+'; not engineering approved.');
  return {name,rows:begin.rows,bytes:blob.size};
}
export function mountLfjO1DomainUi(group,session){
  const panel=document.createElement('section');
  panel.dataset.lfjO1Domain='true';panel.style.marginTop='8px';
  session.domainPanel=panel;
  group.append(panel);
  if(session.domain){session.domain.panel=panel;paint(session);}
  else {const p=document.createElement('p');p.dataset.lfjO1TraceStatus='true';
    p.textContent='Load original XML + JSON, then Build to run the independent Worker.';panel.append(p);}
}
