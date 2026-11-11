/**
 * v0.55 seam.
 * Steps 1-5 (Source & Masters .. Diagnostics) are 3D_Converters main 3377b7f4.
 * Steps 6-10 (Rigid Weight Review .. Output / Run) are 3D_Converters_v0.45 main 56e6b705,
 * mounted unchanged under /v045/ so the two versions of shared files never collide.
 *
 * Two data handovers, both fail closed:
 * 1. Masters. 3D_Converters keeps large masters in IndexedDB. v0.45 reads
 *    masterContext.lineRows / pipingClassRows / materialMapRows / weightMasterRows
 *    directly and would otherwise fall back to empty rows or the embedded default
 *    Weight table. Before a v0.45 step renders, every dataset-backed master must be
 *    resident in full.
 * 2. Staged JSON. 3D_Converters' large-JSON intake (LFJ O1) keeps the original JSON
 *    file in its Worker session and leaves stagedJsonText empty on purpose. v0.45
 *    reads stagedJsonText. The seam reads the same committed original file, checks
 *    its SHA-256 against the intake receipt, and shows the text ONLY to v0.45 through
 *    a view ref. Writes from v0.45 are stripped of it, so 3D_Converters' own state
 *    never gains a stagedJsonText it did not create.
 */
import { renderActivePhase as renderV045Phase } from '../../../v045/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js?v=20260813-mode-a-consolidated-1';
import { bindAdaptedWorkflowEvents as bindV045Events } from '../../../v045/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-consolidated-review-v2.js?v=20260814-fast-run-1';
import { installModeAConsolidatedPreviewEasyUiFromWorkspace as installV045PreviewEasyUi } from '../../../v045/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-easy-ui-hook.js?v=20260814-preview-restore-1';
import { installModeAConsolidatedWeightEasyUiFromWorkspace as installV045WeightEasyUi } from '../../../v045/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-easy-weight-hook.js?v=20260814-weight-tools-1';
import { installModeACompactMultiUi as installV045CompactMultiUi } from '../../../v045/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-compact-ui.js?v=20260814-compact-multi-1';
import { materializeMasterDatasetRows } from './xml-cii-adapted-master-dataset-runtime.js?v=20261007-c05-6-2-consumer-authority-1';
import { resolveXml229CurrentPreviewBlob } from './xml-cii-adapted-lfj-o1-intake.js';
import { xmlCiiProcessingMode } from './xml-cii-adapted-processing-mode.js?v=20261001-single-weight-owners-1';
import { createElement } from './xml-cii-adapted-dom.js?v=20260813-mode-a-full-propagation-2';

export const V045_PHASE_IDS = Object.freeze(['weight-match', 'support-mapper', 'config', 'matched-audit', 'run']);
const V045_PHASES = new Set(V045_PHASE_IDS);

const MASTER_ROWS_KEY = Object.freeze({
  lineList: 'lineRows',
  pipingClass: 'pipingClassRows',
  materialMap: 'materialMapRows',
  weight: 'weightMasterRows',
});
const MASTER_LABEL = Object.freeze({
  lineList: 'Line list',
  pipingClass: 'Piping class',
  materialMap: 'Material map',
  weight: 'Weight',
});

let gate = { signature: '', status: 'idle', error: '' };
// Verified staged JSON text for v0.45, keyed by the intake receipt.
let staged = { key: '', text: '' };

export function isV045Phase(phaseId) {
  return V045_PHASES.has(String(phaseId || ''));
}

/** Masters whose full rows live in IndexedDB but are not (fully) in memory. */
export function pendingDatasetMasters(state) {
  const context = state?.masterContext || null;
  const refs = context?.datasetRefs || {};
  const pending = [];
  for (const [masterKey, rowsKey] of Object.entries(MASTER_ROWS_KEY)) {
    const ref = refs[masterKey];
    if (!ref?.datasetId) continue;
    const expected = Math.max(0, Number(ref.rowCount) || 0);
    const resident = Array.isArray(context?.[rowsKey]) ? context[rowsKey].length : 0;
    if (expected > 0 && resident !== expected) pending.push({ masterKey, rowsKey, ref, expected });
  }
  return pending;
}

/** A committed LFJ intake whose original JSON v0.45 has not been given yet. */
export function stagedReceiptKey(state) {
  const receipt = state?.xml229StagedSourceReceipt;
  if (!receipt || receipt.phase !== 'INDEX_COMMITTED' || !receipt.sha256) return '';
  if (String(state?.stagedJsonText || '').trim()) return '';
  return `${receipt.generationId}:${receipt.sourceRevision}:${receipt.sha256}`;
}

function signatureOf(state) {
  const masters = pendingDatasetMasters(state).map((item) => `${item.masterKey}:${item.ref.datasetId}:${item.expected}`);
  const key = stagedReceiptKey(state);
  if (key && staged.key !== key) masters.push(`staged:${key}`);
  return masters.join('|');
}

async function sha256Hex(buffer) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function loadStagedJson(stateRef, state, key) {
  const receipt = state.xml229StagedSourceReceipt;
  const handle = resolveXml229CurrentPreviewBlob(stateRef, receipt);
  const buffer = await handle.blob.arrayBuffer();
  if (!handle.isCurrent()) throw new Error('the staged JSON changed while it was being read.');
  const hex = await sha256Hex(buffer);
  if (hex !== String(receipt.sha256).toLowerCase()) throw new Error('the staged JSON does not match its import receipt (SHA-256).');
  staged = { key, text: new TextDecoder('utf-8').decode(buffer) };
}

async function loadPending(stateRef, signature, render, materialize) {
  try {
    const state = stateRef.current;
    const loaded = {};
    for (const item of pendingDatasetMasters(state)) {
      const rows = await materialize(item.masterKey, item.ref);
      if (!Array.isArray(rows) || rows.length !== item.expected) {
        throw new Error(`${MASTER_LABEL[item.masterKey]} master: expected ${item.expected} rows, browser storage returned ${Array.isArray(rows) ? rows.length : 0}.`);
      }
      loaded[item.rowsKey] = rows;
    }
    const key = stagedReceiptKey(state);
    if (key && staged.key !== key) await loadStagedJson(stateRef, state, key);
    const current = stateRef.current;
    if (Object.keys(loaded).length) {
      stateRef.current = { ...current, masterContext: { ...current.masterContext, ...loaded } };
    }
    gate = { signature: signatureOf(stateRef.current) === '' ? 'ready' : signature, status: 'done', error: '' };
  } catch (error) {
    gate = { signature, status: 'error', error: String(error?.message || error) };
  }
  if (typeof render === 'function') render();
}

/**
 * Returns null when v0.45 may render, or an element explaining why not yet.
 * Starts the loads when needed.
 */
export function v055MasterGate(stateRef, render, materialize = materializeMasterDatasetRows) {
  const signature = signatureOf(stateRef.current);
  if (!signature) return null;
  if (gate.signature === signature && gate.status === 'done') {
    // Loaded once, yet still not resident: never loop, never fall back.
    gate = { signature, status: 'error', error: 'the loaded data did not stay in the workflow state.' };
  } else if (gate.signature !== signature || gate.status === 'idle') {
    gate = { signature, status: 'loading', error: '' };
    void loadPending(stateRef, signature, render, materialize);
  }
  const card = createElement('section', '', 'xml-cii-standalone-card');
  card.setAttribute?.('data-v055-master-gate', gate.status);
  if (gate.status === 'error') {
    card.append(
      createElement('h2', 'Inputs not loaded'),
      createElement('p', `This step needs the full master rows and the original staged JSON: ${gate.error}`),
      createElement('p', 'Nothing was converted. Reload the masters or the staged JSON in steps 1-3, or press Retry.'),
    );
    const retry = createElement('button', 'Retry', 'xml-cii-standalone-button');
    retry.type = 'button';
    retry.addEventListener?.('click', () => { gate = { signature: '', status: 'idle', error: '' }; if (typeof render === 'function') render(); });
    card.append(retry);
  } else {
    card.append(
      createElement('h2', 'Loading inputs'),
      createElement('p', 'Reading the full master rows and the original staged JSON from browser storage.'),
    );
  }
  return card;
}

function withStagedText(state, text) {
  if (!state || !text) return state;
  const sources = state.sourceBatch?.sources;
  return {
    ...state,
    stagedJsonText: String(state.stagedJsonText || '').trim() ? state.stagedJsonText : text,
    sourceBatch: Array.isArray(sources)
      ? { ...state.sourceBatch, sources: sources.map((source) => (String(source?.stagedJsonText || '').trim() ? source : { ...source, stagedJsonText: text })) }
      : state.sourceBatch,
  };
}

function withoutStagedText(next, text) {
  if (!next || !text) return next;
  const out = next.stagedJsonText === text ? { ...next, stagedJsonText: '' } : { ...next };
  const sources = out.sourceBatch?.sources;
  if (Array.isArray(sources)) {
    out.sourceBatch = { ...out.sourceBatch, sources: sources.map((source) => (source?.stagedJsonText === text ? { ...source, stagedJsonText: '' } : source)) };
  }
  return out;
}

/** v0.45 sees the verified staged JSON; 3D_Converters' state never stores it. */
export function v045ViewRef(ref, state) {
  const key = stagedReceiptKey(state);
  const text = key && staged.key === key ? staged.text : '';
  if (!text || !ref) return ref;
  const view = {
    get current() { return withStagedText(ref.current, text); },
    set current(next) { ref.current = withoutStagedText(next, text); },
  };
  if (ref.modeABaseRef) view.modeABaseRef = v045ViewRef(ref.modeABaseRef, state);
  return view;
}

export function renderV045ActivePhase(main, viewRef, render) {
  return renderV045Phase(main, viewRef, render);
}

export function installV045WorkspaceHooks(main, viewRef, state) {
  installV045PreviewEasyUi(main, viewRef);
  installV045WeightEasyUi(main, viewRef);
  installV045CompactMultiUi(main, state);
}

export function bindV045WorkflowEvents(container, viewRef, render) {
  const result = bindV045Events(container, viewRef, render);
  // 3D_Converters rule kept: a combined (Mode B) document never runs native CII.
  const raw = viewRef?.modeABaseRef?.current || viewRef?.current || {};
  if (xmlCiiProcessingMode(raw) === 'mode-b') {
    container.querySelectorAll?.('[data-action="run"]').forEach((button) => { button.disabled = true; });
  }
  return result;
}

/**
 * 3D_Converters records a startup restore failure per master (for example a
 * stored record that points at a dataset no longer in IndexedDB) and nothing
 * clears it when the user then imports that master again, so Preview stays
 * blocked with MASTER_RESTORE_FAILED. A failure is stale only when the master
 * now uses a DIFFERENT dataset than the one that failed. A failure for the
 * dataset still in use, or with no replacement, is kept (fails closed).
 * Returns the same state object when nothing is stale.
 */
export function pruneSupersededRestoreFailures(state) {
  const failures = state?.masterRestoreFailures;
  if (!failures || typeof failures !== 'object') return state;
  const refs = state?.masterContext?.datasetRefs || {};
  const stale = Object.keys(failures).filter((masterKey) => {
    const current = String(refs[masterKey]?.datasetId || '');
    return current && current !== String(failures[masterKey]?.datasetId || '');
  });
  if (!stale.length) return state;
  const nextFailures = { ...failures };
  const nextIdentity = { ...(state.masterRestoreFailureIdentity || {}) };
  for (const masterKey of stale) {
    delete nextFailures[masterKey];
    delete nextIdentity[masterKey];
  }
  return { ...state, masterRestoreFailures: nextFailures, masterRestoreFailureIdentity: nextIdentity };
}

export function resetV055SeamForTests() {
  gate = { signature: '', status: 'idle', error: '' };
  staged = { key: '', text: '' };
}
