import {
  xmlCiiBuildAndRenderPreview as buildLegacyPreview,
  xmlCiiRenderPreviewPhase,
} from './xml-cii-adapted-preview-renderer.js?v=20261001-weight-output-2';
import {
  XML_CII_PREVIEW_CACHE_SCHEMA,
  XML_CII_PREVIEW_LEGACY_CACHE_KEY,
  capturePreviewCacheV7,
  clearPreviewCacheBridge,
  createPreviewCacheAuthority,
  discardPreviewCacheV7,
  restorePreviewCacheV7,
  shortPreviewCacheDigest,
} from './xml-cii-adapted-preview-cache-v7.js';
import { applyPreviewDtxrRatingOverrides } from './xml-cii-adapted-preview-rating-fetch.js';
import {xml229PreviewSourceGate} from '../integration/xml229-preview-source-gate.mjs';

export { xmlCiiRenderPreviewPhase };

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function esc(value) {
  return text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function resolveStagedSource(options, config) {
  if (typeof options?.resolveStagedJsonText === 'function') {
    const resolved = await options.resolveStagedJsonText(config);
    if (resolved && typeof resolved === 'object') {
      return {
        text: text(resolved.text ?? resolved.stagedJsonText),
        label: text(resolved.label || resolved.sourceLabel),
      };
    }
    return { text: text(resolved), label: '' };
  }
  return {
    text: text(options?.stagedJsonText),
    label: text(options?.stagedSourceLabel),
  };
}

function previewRendered(host) {
  return !!host?.querySelector?.('table, [data-mc-edit-type], .mc-preview-editable-val');
}

function readLegacyPayload() {
  try {
    const value = typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem(XML_CII_PREVIEW_LEGACY_CACHE_KEY) || 'null')
      : null;
    return value && Array.isArray(value?.data?.branchRows) ? value : null;
  } catch {
    return null;
  }
}

function legacyBridgePresent() {
  return Boolean(readLegacyPayload());
}

function currentPreviewResult(host, result = null) {
  if (Array.isArray(result?.branchRows)) return result;
  const live = host?.__xmlCiiPreviewResult;
  if (Array.isArray(live?.branchRows)) return live;
  const legacy = readLegacyPayload();
  return {
    branchRows: legacy?.data?.branchRows || [],
    nodeRows: legacy?.data?.nodeRows || [],
  };
}

function addNotice(host, message, bad = false) {
  if (!host) return;
  const existing = host.querySelector?.('[data-mc-dtxr-rating-notice]');
  if (existing) existing.remove();
  host.insertAdjacentHTML?.(
    'afterbegin',
    `<div data-mc-dtxr-rating-notice class="model-converters-workflow-detail-note" style="margin:0 0 8px;border-color:${bad ? '#b91c1c' : '#2f855a'};color:${bad ? '#7f1d1d' : '#14532d'};background:${bad ? '#fff7f7' : '#f0fff4'};">${esc(message)}</div>`,
  );
}

function ratingFetchMessage(result) {
  const parts = [];
  if (result.applied) parts.push(`Fetched DTXR Rating for ${result.applied} branch${result.applied === 1 ? '' : 'es'}.`);
  if (result.conflicts) parts.push(`Skipped ${result.conflicts} branch${result.conflicts === 1 ? '' : 'es'} with conflicting DTXR ratings.`);
  if (result.missing) parts.push(`${result.missing} branch${result.missing === 1 ? '' : 'es'} had no explicit DTXR Rating.`);
  if (!result.applied && result.cleared) parts.push(`Cleared ${result.cleared} previous fetched DTXR Rating override${result.cleared === 1 ? '' : 's'}.`);
  return parts.join(' ') || 'No unambiguous DTXR Rating evidence was available.';
}

function installDtxrRatingAction({ host, rootEl, xmlText, config, options, branchRows }) {
  if (!host || !Array.isArray(branchRows) || !branchRows.length) return;
  const actionBar = host.querySelector?.('[data-mc-preview-build]')?.parentElement;
  if (!actionBar || actionBar.querySelector('[data-mc-dtxr-rating-fetch]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'model-converters-download-btn';
  button.dataset.mcDtxrRatingFetch = 'true';
  button.textContent = 'Fetch Rating as per DTXR';
  button.title = 'Explicitly fetch unambiguous DTXR ratings as branch-scoped overrides. Normal execution uses Piping Class master Rating, then Regex Rating extraction.';
  button.style.cssText = 'padding:8px 14px;min-width:210px;';
  actionBar.appendChild(button);
  button.addEventListener('click', async () => {
    button.disabled = true;
    const result = applyPreviewDtxrRatingOverrides(config, branchRows);
    const changed = result.applied > 0 || result.cleared > 0;
    if (!changed) {
      addNotice(host, ratingFetchMessage(result), true);
      button.disabled = false;
      return;
    }
    try {
      await options?.onSaveConfig?.(config);
      await xmlCiiBuildAndRenderPreview(rootEl, xmlText, config, { ...options, forceBuild: true });
      const rebuiltHost = rootEl?.querySelector?.('#mc-preview-table-host');
      addNotice(rebuiltHost, ratingFetchMessage(result), result.applied === 0);
    } catch (error) {
      addNotice(host, `DTXR Rating fetch failed: ${text(error?.message || error)}`, true);
      button.disabled = false;
    }
  });
}

function addCacheEvidence(host, { status, authority, reason = '' } = {}) {
  if (!host) return;
  const existing = host.querySelector?.('[data-mc-preview-cache-evidence]');
  if (existing) existing.remove();
  host.dataset.mcPreviewCacheSchema = XML_CII_PREVIEW_CACHE_SCHEMA;
  host.dataset.mcPreviewCacheStatus = status;
  host.dataset.mcPreviewCacheDigest = authority?.digest || '';
  // A real source SHA can be present while the *cache key* is intentionally
  // not computed. Do not misleadingly label that original source SHA missing.
  const heldOriginalJson = status === 'JSON_SOURCE_PENDING';
  const digestLabel = heldOriginalJson ? 'Preview cache key: NOT COMPUTED'
    : 'SHA-256 ' + shortPreviewCacheDigest(authority);
  const byteDetail = authority
    ? `XML ${authority.xmlBytes} B · staged JSON ${authority.stagedJsonBytes} B · canonical authority ${authority.canonicalBytes} B`
    : heldOriginalJson ? 'indexed original JSON is not yet Preview input data'
      : 'SHA-256 authority unavailable';
  const reasonDetail = reason ? ` · ${reason}` : '';
  host.insertAdjacentHTML?.(
    'afterbegin',
    `<div data-mc-preview-cache-evidence class="model-converters-workflow-detail-note" style="margin:0 0 8px;border-color:#475569;color:#334155;background:#f8fafc;">Preview cache authority: <strong>${esc(status)}</strong> · ${esc(digestLabel)} · ${esc(byteDetail)}${esc(reasonDetail)}</div>`,
  );
}

// Only product/subtree changes should rebuild cache authority. Mutations from
// our cache evidence, status notice or installed action are presentation output,
// not a new engineering input. Counting them as inputs creates a self-sustaining
// MutationObserver -> status DOM -> MutationObserver feedback loop.
const PREVIEW_V7_PRESENTATION_SELECTOR =
  '[data-mc-preview-cache-evidence], [data-mc-dtxr-rating-notice], [data-mc-dtxr-rating-fetch]';
function previewV7OwnedNode(node) {
  return node?.nodeType === 1 && (
    node.matches?.(PREVIEW_V7_PRESENTATION_SELECTOR) ||
    node.closest?.(PREVIEW_V7_PRESENTATION_SELECTOR)
  );
}
export function previewV7HasRelevantMutation(records) {
  return [...(records || [])].some(record =>
    record?.type === 'childList' && !previewV7OwnedNode(record.target) &&
    [...(record.addedNodes || []), ...(record.removedNodes || [])]
      .some(node => !previewV7OwnedNode(node))
  );
}

// Testable DOM observer seam. Presentation-only: not the GC-PW engineering contract.
export function installInternalRebuildCapture(host, rootEl, xmlText, config, options) {
  if (!host || typeof MutationObserver === 'undefined') return;
  host.__xmlCiiPreviewCacheV7Observer?.disconnect?.();
  let timer = null;
  let running = false;
  const observer = new MutationObserver((records) => {
    if (!previewV7HasRelevantMutation(records)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      const current = currentPreviewResult(host);
      if (running || !previewRendered(host) || (!current.branchRows.length && !legacyBridgePresent())) return;
      running = true;
      try {
        // No background rebuild may restore or capture old JSON cache
        // after a Worker File source is selected without a Preview read port.
        const gate = xml229PreviewSourceGate({
          sourceReceipt: options.originalStagedSourceReceipt,
          sourceStatus: options.originalStagedSourceStatus,
          stagedJsonText: options.stagedJsonText,
        });
        if(gate.blocked) {
          clearPreviewCacheBridge();
          addCacheEvidence(host,{
            status:'JSON_SOURCE_PENDING',authority:null,
            reason:gate.reason+(gate.sourceSha256?
              ' · original JSON '+gate.sourceBytes+' B · SHA256 '+gate.sourceSha256:''),
          });
          return;
        }
        installDtxrRatingAction({
          host,
          rootEl,
          xmlText,
          config,
          options,
          branchRows: currentPreviewResult(host).branchRows,
        });
        const stagedSource = await resolveStagedSource(options, config);
        const authority = await createPreviewCacheAuthority({
          xmlText,
          stagedJsonText: stagedSource.text,
          config,
        });
        const captured = capturePreviewCacheV7(authority);
        addCacheEvidence(host, {
          status: captured.stored ? 'REBUILT' : 'UNCACHED',
          authority,
          reason: captured.stored ? '' : captured.reason,
        });
      } catch (error) {
        clearPreviewCacheBridge();
        addCacheEvidence(host, {
          status: 'UNCACHED',
          authority: null,
          reason: text(error?.message || error),
        });
      } finally {
        running = false;
      }
    }, 0);
  });
  observer.observe(host, { childList: true, subtree: true });
  host.__xmlCiiPreviewCacheV7Observer = observer;
}

export async function xmlCiiBuildAndRenderPreview(rootEl, xmlText, config, options = {}) {
  const host = rootEl?.querySelector?.('#mc-preview-table-host');
  if (!host) return { branchRows: [], nodeRows: [] };
  // The Worker source index is not a JSON value read port. It is unsafe to
  // hash stagedJsonText='' or a legacy string from a prior File as this source.
  // Refuse BEFORE legacy Preview, cache restore, rating publication or observer.
  const workerGate = xml229PreviewSourceGate({
    sourceReceipt:options.originalStagedSourceReceipt,
    sourceStatus:options.originalStagedSourceStatus,
    stagedJsonText:options.stagedJsonText,
  });
  // XML229 P3B.3: an indexed original File can now be consumed by the
  // existing 4 Preview button's separate source-hashing Worker. The V7 cache
  // must remain OFF for this route: it is not keyed to the full O1 SHA/generation.
  // Do not sign an empty stagedJsonText cache, or promote source-only receipt.
  if(workerGate.blocked &&
     workerGate.reason==='ORIGINAL_JSON_INDEXED_NO_PREVIEW_READ_PORT' &&
     typeof options.resolveOriginalWorkerPreviewSource==='function') {
    host.__xmlCiiPreviewCacheV7Observer?.disconnect?.();
    discardPreviewCacheV7();
    const workerOptions={...options,skipLegacyCache:true,
      onOriginalWorkerPreviewCompleted:({sourceReceipt})=>{
        discardPreviewCacheV7();
        if(host.isConnected===false)return;
        addCacheEvidence(host,{status:'UNCACHED',authority:null,
          reason:'Worker-verified original JSON SHA-256 '+sourceReceipt.sha256+
            ' · generation '+sourceReceipt.generationId+
            ' · cache reuse disabled pending complete source-basis cache contract.'});
      },
    };
    const idle=await buildLegacyPreview(rootEl,xmlText,config,workerOptions);
    const restoredWorkerRows=options.forceBuild===true &&
      Array.isArray(options.precomputedPreview?.branchRows);
    addCacheEvidence(host,{status:restoredWorkerRows?'UNCACHED':'JSON_WORKER_READY',
      authority:null,
      reason:'Original JSON '+workerGate.sourceBytes+' B · SHA256 '+
        workerGate.sourceSha256+
        (restoredWorkerRows
          ? ' · Preview displayed from current verified Worker; no cache HIT or CII approval.'
          : ' · Build Preview runs source-verified JSON in a separate Worker; no cache HIT or CII approval.')});
    return idle;
  }
  if(workerGate.blocked) {
    host.__xmlCiiPreviewCacheV7Observer?.disconnect?.();
    host.replaceChildren?.();
    host.__xmlCiiPreviewResult=null;
    clearPreviewCacheBridge();
    addCacheEvidence(host,{
      status:'JSON_SOURCE_PENDING',authority:null,
      reason:workerGate.reason+(workerGate.sourceSha256?
        ' · original JSON '+workerGate.sourceBytes+' B · SHA256 '+workerGate.sourceSha256:''),
    });
    addNotice(host,'Original staged JSON is held in a source-only Worker index. '+
      'JSON-dependent Preview is awaiting a source-verified data reader; '+
      'no cache HIT or engineering decision is authorized.',true);
    return {branchRows:[],nodeRows:[],blocked:true,reason:workerGate.reason};
  }
  installInternalRebuildCapture(host, rootEl, xmlText, config, options);

  const stagedSource = await resolveStagedSource(options, config);
  const delegatedOptions = {
    ...options,
    stagedJsonText: stagedSource.text,
    stagedSourceLabel: stagedSource.label,
    // Button rebuilds must revalidate live inputs instead of replaying this snapshot.
    resolveStagedJsonText: async () => resolveStagedSource(options, config),
  };

  let authority = null;
  let restored = { restored: false, reason: 'not-attempted' };
  let digestError = null;
  try {
    authority = await createPreviewCacheAuthority({
      xmlText,
      stagedJsonText: stagedSource.text,
      config,
    });
    if (options.forceBuild === true) clearPreviewCacheBridge();
    else restored = restorePreviewCacheV7(authority);
  } catch (error) {
    digestError = error;
    clearPreviewCacheBridge();
  }

  const legacyResult = await buildLegacyPreview(rootEl, xmlText, config, delegatedOptions);
  const previewResult = currentPreviewResult(host, legacyResult);

  const rendered = previewRendered(host);
  if (!authority) {
    clearPreviewCacheBridge();
    addCacheEvidence(host, {
      status: rendered ? 'UNCACHED' : 'DISABLED',
      authority,
      reason: text(digestError?.message || digestError),
    });
    return previewResult;
  }

  if (!rendered) {
    if (restored.restored) discardPreviewCacheV7();
    else clearPreviewCacheBridge();
    addCacheEvidence(host, {
      status: 'MISS',
      authority,
      reason: restored.restored ? 'legacy fingerprint rejected; rebuild required' : restored.reason,
    });
    return previewResult;
  }

  installDtxrRatingAction({
    host,
    rootEl,
    xmlText,
    config,
    options,
    branchRows: previewResult.branchRows,
  });
  const captured = capturePreviewCacheV7(authority);
  const status = options.forceBuild === true
    ? (captured.stored ? 'REBUILT' : 'UNCACHED')
    : (restored.restored ? 'HIT' : (captured.stored ? 'REBUILT' : 'UNCACHED'));
  addCacheEvidence(host, {
    status,
    authority,
    reason: captured.stored ? '' : captured.reason,
  });
  return previewResult;
}
