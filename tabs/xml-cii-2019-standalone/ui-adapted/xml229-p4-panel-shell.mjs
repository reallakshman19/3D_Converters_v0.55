/** Existing-workflow Weight panel shell; presentation only, no decisions. */
export function renderXml229VerifiedPanelShell(existingWorkflow=false){
 return `<section data-p4-weight-root
  style="border:1px solid #64748b;border-radius:8px;padding:12px;margin:12px 0;">
  <strong>${existingWorkflow?'Weight Match — verified original physical facts':'Original-source Weight review (GC-PW)'}</strong>
  <p style="font-size:12px;color:#94a3b8;">Independent original XML census and current master verification in separate Workers. When JSON is supplied, its complete source bytes are also verified.
  Applied Weight is one editable kg field, automatically filled from the verified source-linked suggestions.
  Click any suggestion or enter kg directly. Native CII output release is independently governed.</p>
  ${existingWorkflow?'':'<button type="button" data-p4-weight-build>Build verified original-source Weight review</button>'}
  <span role="status" data-p4-weight-status style="margin-left:8px;"></span>
  <pre data-p4-bulk-detail role="status" hidden
   style="white-space:pre-wrap;font-size:12px;color:#cbd5e1;background:#101e32;padding:8px;border-radius:6px;"></pre>
  <div style="margin:10px 0"><button type="button" data-p4-export-flow-trace
   class="model-converters-download-btn">Download Worker/UI causal flow trace (private)</button>
   <small style="display:block;color:#94a3b8">Read-only session/Worker transitions, typed failures, fact/review counts and native gate. No source or master rows.</small></div>
  <div style="margin:10px 0"><button type="button" data-p4-export-candidate-readiness
   class="model-converters-download-btn">Download candidate coverage + readiness (private)</button>
   <small style="display:block;color:#94a3b8">Same verified Worker, read-only aggregate counts; keep file private. Does not authorize native CII.</small></div>
  <div style="margin:10px 0"><button type="button" data-p4-full-source-safety class="model-converters-download-btn">Download full-source Weight safety precheck (private)</button><small style="display:block;color:#94a3b8">Read-only audit of the current verified Worker, including existing Final decisions; never changes weight or authorizes native CII.</small></div>
  <div><button type="button" data-p4-export-effective-basis class="model-converters-download-btn">Download current effective 4-master custody (OWNER PRIVATE)</button><small>Includes private config and normalized master rows. Keep local; no source XML/JSON or approvals.</small></div>
  <div style="margin:10px 0"><button type="button" data-p4-audit-decisions
   class="model-converters-download-btn">Download verified decision provenance JSON</button>
   <small style="display:block;color:#94a3b8">Read-only source-bound Match-1/Final audit. Bulk command IDs alone do not prove an earlier confirmation click. No native CII release.</small></div>
   <div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <button type="button" data-p4-save-review class="model-converters-download-btn">Save GC-PW review file</button>
    <button type="button" data-p4-choose-review class="model-converters-download-btn">Restore GC-PW review file</button>
    <input type="file" data-p4-import-review accept=".json,application/json"
      aria-label="Select an Owner-controlled GC-PW review file" hidden>
    <small style="color:#94a3b8">Accepted review ledger only. It does NOT contain Applied Weight drafts; restoring does not approve Final or native CII Run.</small>
   </div>
   <div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <button type="button" data-p4-save-drafts class="model-converters-download-btn">Save Applied Weight</button>
    <button type="button" data-p4-choose-drafts class="model-converters-download-btn">Restore Applied Weight</button>
    <input type="file" data-p4-import-drafts accept=".json,application/json"
      aria-label="Select saved Applied Weight values" hidden>
    <small style="color:#94a3b8">Selected Applied Weight values are retained across navigation for the same verified source. Save a private backup for recovery. Native CII release requires separate authority.</small>
   </div>
  <div data-p4-weight-table></div>
  <aside data-p4-confirm-zero-notice role="region" aria-label="Blank Applied Weight decision" hidden
    style="position:fixed;right:16px;bottom:16px;z-index:1200;max-width:345px;
    padding:12px;background:#14243a;color:#e5eefc;border:1px solid #7384a0;
    border-radius:10px;box-shadow:0 5px 18px #0008;font-size:12px">
    <strong>Blank Applied Weight rows</strong>
    <p data-p4-confirm-zero-text style="margin:7px 0;line-height:1.4"></p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
     <button type="button" data-p4-confirm-zero
       style="background:#1d4ed8;border:1px solid #60a5fa;border-radius:5px;
       color:white;padding:6px 9px;cursor:pointer">Apply 0 kg to blanks</button>
     <button type="button" data-p4-dismiss-zero
       style="background:transparent;border:1px solid #64748b;border-radius:5px;
       color:#e2e8f0;padding:6px 9px;cursor:pointer">Keep blanks</button>
    </div>
    <small style="display:block;color:#bac6d8;margin-top:6px">
     Only an explicit click records 0 kg as a source-bound Final decision.
     Existing weights and source-qualified suggestions are kept.
    </small>
  </aside></section>`;
}
