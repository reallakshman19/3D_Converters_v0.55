/**
 * XML229 source-bound Weight Match PRESENTATION ONLY.
 * The existing original-Blob GC-PW Worker owns every source fact and decision.
 * Candidate chips and table controls cannot write legacy issue.keys, mutate
 * masters, infer a Final decision, or authorize native CII Run.
 */
import {xml229ProposalScorePercent} from '../integration/xml229-weight-review-focus.mjs';
import {XML229_WEIGHT_COLUMNS} from '../integration/xml229-weight-excel-filter.mjs';
import {auditXml229AcceptedMatch1Row}
 from '../integration/xml229-accepted-match1-family-audit.mjs';
const txt=x=>String(x??'');
export const escapeXml229WeightHtml=x=>txt(x).replaceAll('&','&amp;')
 .replaceAll('<','&lt;').replaceAll('>','&gt;')
 .replaceAll('"','&quot;').replaceAll("'",'&#39;');
const e=escapeXml229WeightHtml;
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const assigned=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const kg=x=>positive(x)?e(x)+' kg':'—';
export const xml229WeightReviewStatus=row=>{
 if(assigned(row?.finalKg))return {label:row.finalKg===0?'Final 0 kg (confirmed)':'Final reviewed',kind:'final',mass:row.finalKg};
 if(positive(row?.match1Kg))return {label:'Match-1 reviewed',kind:'match1',mass:row.match1Kg};
 if(positive(row?.sourceKg))return {label:'Original XML mass',kind:'source',mass:row.sourceKg};
 return {label:'No recorded mass',kind:'unresolved',mass:null};
};
const safeNumber=x=>Number.isFinite(Number(x))?Number(x):0;
export function xml229WeightReviewPageModel(page,offset=0){
 const rows=Array.isArray(page?.rows)?page.rows:[];
 const total=Math.max(0,Math.trunc(safeNumber(page?.totalCount)));
 const start=Math.max(0,Math.trunc(safeNumber(offset)));
 return {rows,total,start,end:start+rows.length,
   counts:rows.reduce((a,r)=>{
     a[xml229WeightReviewStatus(r).kind]++;
     if(Array.isArray(r.proposals)&&r.proposals.length)a.proposed++;
     return a;
   },{final:0,match1:0,source:0,unresolved:0,proposed:0})};
}
export function renderXml229WeightReviewPage(page,offset=0,{
 filter='all',query='',minScorePercent=80,columnFilters={},sort=null,hideShortMm=false,
}={}){
 const m=xml229WeightReviewPageModel(page,offset);
 const fmt=(x,unit='')=>typeof x==='number'&&Number.isFinite(x)
   ?e(Number(x).toFixed(unit==='mm'?1:0))+(unit?' '+unit:''):'—';
 const label=x=>txt(x)?e(x):'<span title="No verified source value" style="color:#94a3b8">—</span>';
 const rows=m.rows.map((r,i)=>{
  const state=xml229WeightReviewStatus(r),proposals=Array.isArray(r.proposals)?r.proposals:[];
  const audit=auditXml229AcceptedMatch1Row(r);
  const auditHold=audit&&audit.code!=='FAMILY_COMPATIBLE_ONLY';
  const chips=proposals.map(p=>{
   const scorePercent=xml229ProposalScorePercent(p);
   const score=scorePercent===null?'':' · '+e(Math.round(scorePercent))+'%';
   const hint=[p.method,p.matchType,p.qualified?'Source-qualified suggestion':'Estimated suggestion; mass not independently qualified',
     ...(p.eligibilityReasons||[]),...(p.evidenceRefs||[])].filter(Boolean).join(' · ');
   return `<button type="button" class="mc-rigid-review-candidate${p.qualified?' best':''}"
     data-p4-pick="${e(p.proposalId)}" title="${e(hint)}"
     style="font-size:11px;white-space:nowrap;margin:1px;padding:4px 6px">
     ${p.qualified?'★':'≈'} ${kg(p.value)}${score} · ${e(p.method||'source proposal')}</button>`;
  }).join('');
  const tooltip=[r.dtxrSource,r.dtxrMatchedKey,
    r.dtxrSourcePath].filter(Boolean).join(' · ')||
    'DTXR metadata not independently available for this original physical occurrence';
  const accepted=assigned(r.finalKg)?r.finalKg:positive(r.match1Kg)?r.match1Kg:r.sourceKg;
  const statusColor=auditHold?'#fca5a5':
    state.kind==='final'?'#86efac':state.kind==='match1'?'#fde68a':'#fca5a5';
  return `<tr data-p4-row="${i}" data-p4-occurrence="${e(r.occurrenceId)}"
    data-p4-stage="${state.kind}" style="border-bottom:1px solid #253a55">
    <td style="color:${statusColor}" data-p4-decision-state="${state.kind}">${e(state.label)}
     ${audit? `<small data-p4-family-audit="${e(audit.code)}" title="${e(audit.reason)}"
       style="display:block;color:${auditHold?'#fca5a5':'#fde68a'}">
       ${auditHold?'Engineering HOLD':'Family compatible only'} · ${e(audit.code.replaceAll('_',' '))}
       · independent kg verification required</small>`:''}
     <small style="display:block;color:#94a3b8">${e(r.sourceId)}</small></td>
    <td title="${e(r.nodeName||r.shortName||'')}">${label(r.shortName||r.nodeName||r.valveHint)}</td>
    <td title="${e(tooltip)}" style="min-width:140px;max-width:260px;overflow-wrap:anywhere">${label(r.dtxr)}</td>
    <td title="${e(r.branchName)}" style="min-width:230px;max-width:290px;overflow-wrap:anywhere">${label(r.branchName)}</td>
    <td style="min-width:95px">${label(r.lineKey)}</td>
    <td>${label(r.componentType)}</td>
    <td title="Verified FactRecord bore.mm">${fmt(r.boreMm,'mm')}</td>
    <td title="Verified rating. Changes must be explicitly committed to engineering config and Preview rebuilt.">
     <input data-p4-rating-readonly class="mc-wm-rating-input" type="text"
       value="${e(r.rating??'')}" readonly aria-label="Verified Preview rating (edit upstream)"
       style="width:72px;background:#0b1320;color:#dceaff;border:1px solid #405a78;border-radius:4px">
     <small style="display:block;color:#94a3b8">Verified Preview</small></td>
    <td title="Original NodeNumber; physical identity uses branch and original node ordinal">${label(r.nodeNumber)}</td>
    <td title="Original component reference and endpoint">${label(r.componentRefNoEndpoint)}</td>
    <td title="Verified FactRecord length.mm from source geometry or explicit source length">${fmt(r.lengthMm,'mm')}</td>

    <td style="max-width:420px;min-width:190px">
      <div class="mc-wm-candidate-chips" style="display:flex;gap:4px;flex-wrap:wrap;max-height:90px;overflow:auto">
       ${chips||'<span style="color:#94a3b8">No verified candidate yet</span>'}
      </div></td>
    <td style="min-width:164px" title="Applied Weight (kg), selected from the source-linked suggestions or entered directly. Native CII release has a separate gate.">
      <input data-p4-proposal data-p4-applied-weight class="mc-rigid-review-input"
        type="number" min="0" step="any" inputmode="decimal" placeholder="kg"
        value="${assigned(accepted)?e(String(accepted)):''}"
        aria-label="Applied Weight (kg)"
        style="width:130px;padding:6px;background:#243b5d;color:#fff;border:1px solid #818cf8;font-weight:700">
    </td>
   </tr>`;
 }).join('');
 const activeColumns=Object.keys(columnFilters||{});
 const tabs=[['rigid','Weight items'],['blank-rigid','Filter Blank Weight'],['all','All XML physicals']]
  .map(([id,name])=>`<button data-p4-scope="${id}" type="button"
   aria-pressed="${filter===id?'true':'false'}"
   style="background:${filter===id?'#1e40af':'#1e293b'};border:1px solid #466489;border-radius:6px;
    padding:5px 10px;color:#e5eefc">${name}</button>`).join('');
 return `<div class="model-converters-workflow-detail-note" style="margin:8px 0">
   <strong>Verified original physical facts</strong> · ${m.total} components${page?.populationCount!==undefined?' filtered from '+e(page.populationCount):''}
   · showing ${m.rows.length?m.start+1:0}–${m.end}.
   <small style="display:block;color:#94a3b8">Source-linked weight suggestions and editable kilograms.
    Applied Weight is automatically filled from the best available source-linked suggestion. Click another suggestion or edit the kg value; no separate Match-1 or Final action is required to select it.</small>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0">
    ${tabs}
    <label>Search full verified population
      <input data-p4-filter value="${e(query)}" placeholder="Branch, line key, Node, DTXR, source..."
       style="padding:6px;background:#0b1320;color:#e5eefc;border:1px solid #405a78;border-radius:5px;min-width:220px"></label>
    <label style="font-size:12px">Suggested score ≥
      <input data-p4-min-score type="number" min="0" max="100" step="1" value="${e(minScorePercent)}"
       aria-label="Minimum suggestion score percentage" style="width:58px;background:#0b1320;color:#fff"> %</label>
    <label title="View only. Hides verified original physical rows whose length is 0–6 mm, including 6 mm; no XML, accepted mass, CII element or full physical census changes."
      style="display:inline-flex;gap:5px;align-items:center;color:#cbd5e1">
      <input data-p4-hide-short-mm type="checkbox" ${hideShortMm?'checked':''}>
      Hide ≤6 mm <small style="color:#94a3b8">(table only)</small></label>
    <button data-p4-bulk-plan type="button" class="model-converters-download-btn">Apply all suggestions</button>
    <small data-p4-filter-count style="color:#94a3b8">AutoFilter: ${activeColumns.length} active column(s) · source-wide.${hideShortMm?' '+(page?.hiddenShortCount??0)+' verified ≤6 mm physical row(s) hidden from this view.':''}</small>
    <button type="button" data-p4-excel-clear style="color:#dbeafe;background:#1e3a5a;border:1px solid #64748b;border-radius:5px;padding:6px"
      ${!activeColumns.length&&!sort?'disabled':''}>Clear all column filters / sorting</button>
  </div>
  <div class="mc-rigid-review-table-wrap" style="overflow:auto;max-height:48vh;border:1px solid #253a55;border-radius:8px">
    <table class="mc-rigid-review-table" style="border-collapse:collapse;font-size:12px;table-layout:auto;min-width:1780px">
      <thead style="position:sticky;top:0;background:#14243a;color:#dceaff">
       <tr>${XML229_WEIGHT_COLUMNS.map(({key,label})=>{
        const enabled=activeColumns.includes(key),sorted=sort?.column===key;
        const glyph=enabled?'#60a5fa':sorted?'#a5f3fc':'#8095b0';
        const direction=sorted?' · sorted '+(sort.direction==='asc'?'ascending':'descending'):'';
        return `<th style="padding:8px;white-space:nowrap">
          ${e(label)} <button data-p4-excel-column="${e(key)}" type="button"
           aria-label="Filter and sort ${e(label)}" aria-pressed="${enabled?'true':'false'}"
           title="Excel AutoFilter: ${e(label)}${direction}"
           style="vertical-align:middle;background:transparent;color:${glyph};
            border:1px solid ${glyph};border-radius:4px;padding:3px;cursor:pointer">
           <svg aria-hidden="true" width="11" height="11" viewBox="0 0 16 16">
            <path fill="${glyph}" d="M1 3h14L9 10v4l-2 1v-5z"></path>
           </svg></button></th>`;
       }).join('')}</tr>
      </thead><tbody>${rows}</tbody>
    </table>
  </div>
  <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
    <button data-p4-prev type="button" ${m.start===0?'disabled':''}>Previous</button>
    <button data-p4-next type="button" ${m.end>=m.total?'disabled':''}>Next</button>
    <small>Showing ${m.rows.length?m.start+1:0}–${m.end} of ${m.total} matching original physical owners.</small>
  </div>
  <p style="color:#fbbf24">Applied Weight selections are saved against the verified source. Source-qualified and estimated suggestions are distinguished by ★ and ≈. Native CII output authorization remains a separate gate and is currently HELD.</p>`;
}
export function choiceForXml229WeightRow(row,{stage,proposalId='',value='',reason=''}={}){
 const explanation=txt(reason).trim();
 if(stage==='final'){
   const kgValue=Number(value);
   if(!positive(kgValue))throw new Error('Final Match-2 requires a positive explicitly entered mass (kg)');
   if(!explanation)throw new Error('Final Match-2 requires an engineering reason');
   return {view:row.finalView,choice:{action:'final-override',value:kgValue,unit:'kg',reason:explanation}};
 }
 if(stage!=='match1')throw new Error('Unknown verified Weight review stage');
 if(proposalId){
   const pinned=Array.isArray(row.proposals)
     ?row.proposals.find(p=>p.proposalId===proposalId):null;
   if(!pinned)
     throw new Error('Selected candidate does not belong to this verified physical occurrence');
   // An edited candidate input is NOT the pinned master proposal's mass.
   // Require Manual selection rather than silently accepting an unrelated kg.
   if(txt(value).trim()!==''&&Number(value)!==pinned.value)
     throw new Error('Draft kg differs from selected proposal. Select Manual and enter an engineering reason.');
   return {view:row.match1View,choice:{action:'accept-proposal',proposalId,reason:explanation}};
 }
 const kgValue=Number(value);
 if(!positive(kgValue))throw new Error('Match-1 manual entry requires a positive mass (kg)');
 if(!explanation)throw new Error('Manual Match-1 requires an engineering reason');
 return {view:row.match1View,choice:{action:'enter-manual',value:kgValue,unit:'kg',reason:explanation}};
}

/** Explain historical engineering risk without treating command evidence as approval. */
export function formatXml229DecisionAuditSummary(report) {
 const s=report?.summary||{},a=report?.acceptedFamilyAudit?.summary||{};
 return 'Decision audit exported: '+(s.auditedAcceptedDecisions??'unknown')+
   ' accepted Match-1/Final records, '+(s.bulkConfirmed??'unknown')+
   ' same-Worker bulk-confirmed, '+(s.bulkConfirmationUnknown??'unknown')+
   ' bulk confirmation unproven. Engineering family audit: '+
   (a.holdOrUnknownCount??'unknown')+' held/unknown, '+
   (a.familyCompatibleOnly??'unknown')+' family-compatible only. '+
   'All historical kg need independent verification before Final. '+
   (s.provenanceComplete?'Command provenance checked; no engineering approval implied.':
     'Inspect command provenance issues before Owner approval.');
}
