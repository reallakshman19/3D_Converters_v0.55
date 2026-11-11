import { runStandaloneRegexTester } from '../xml-cii-regex-tester.js?v=20260928-issue776-authority-1';
import { applyStandaloneRegexTesterResult } from './xml-cii-adapted-state.js?v=20261001-weight-output-2';
import {hasXml229VerifiedEngineeringBasis,routeXml229AutomaticEngineeringProposal}
 from '../integration/xml229-engineering-basis-authority.mjs';
import { decorateRegexSampleSelector } from './xml-cii-adapted-regex-sample-selector.js';
import { createSmartIcon, createSmartIconButton, createSmartMetricChip, createSmartToolbar, smartStatusColor } from './xml-cii-adapted-smart-icons.js';
import { applyHighestSafeSuggestions, applyRegexSuggestions, createDefaultRegexSuggestionProfile } from '../xml-cii-regex-smart-suggestions.js?v=20261001-weight-rating-1';
import {
  buildRegexSmartEvidenceReceipt,
  classifyRegexSmartTesterResult,
  regexSmartHasDatasetEvidence,
  regexSmartReceiptIsCurrent,
  regexSmartReceiptRequestBasis,
  resolveRegexSmartEvidence,
} from './xml-cii-adapted-regex-smart-evidence.js?v=20261007-c05-6-2-consumer-authority-1';

const ROLE_META = Object.freeze({
  lineKey: { icon: 'link', label: 'Line Key', color: '#60a5fa' },
  pipingClass: { icon: 'tag', label: 'Piping Class', color: '#34d399' },
  rating: { icon: 'rating', label: 'Rating', color: '#facc15' },
  bore: { icon: 'diameter', label: 'Bore', color: '#fb923c' },
});
const SMART_AUTO_ROLES = Object.freeze(['lineKey', 'pipingClass', 'bore']);

function current(stateRef, fallback) { return stateRef?.current || fallback; }
/** UI-only draft state lives in the stable owner; scoped processing getters
 * may return transient filtered copies that would discard a draft. Never
 * use this channel for engineering configuration or source data. */
function publishRegexSuggestionDraft(stateRef,patch) {
 const base=stateRef?.modeABaseRef||stateRef;
 if(!base?.current)throw new Error('REGEX_DRAFT_STATE_OWNER_REQUIRED');
 Object.assign(base.current,patch);
}
function resultOf(state) { return state?.regexTesterResult || {}; }
function profileOf(state) { return state?.regexSuggestionProfile || createDefaultRegexSuggestionProfile(); }
function locksOf(state) { return state?.regexSmartManualLocks || {}; }
function percent(value) { return `${Math.round(Number(value || 0) * 100)}%`; }

function receiptFor(state) {
  if (regexSmartReceiptIsCurrent(state)) return state.regexSmartPreflight;
  return buildRegexSmartEvidenceReceipt(state, state.masterContext);
}

function commitEvidenceBundle(stateRef, bundle) {
  const state = current(stateRef, {});
  state.regexTesterResult = bundle.regexTesterResult;
  state.regexSmartPreflight = bundle.receipt;
  state.regexSmartEvidenceBasis = bundle.evidenceBasis;
  state.regexSmartPreflightRequestBasis = regexSmartReceiptRequestBasis(state);
  return bundle.receipt;
}

async function resolveActionEvidence(stateRef) {
  const state = current(stateRef, {});
  const startBasis = regexSmartReceiptRequestBasis(state);
  if (!regexSmartHasDatasetEvidence(state)) {
    const classified = classifyRegexSmartTesterResult(resultOf(state), state.masterContext || {});
    state.regexTesterResult = classified;
    const receipt = buildRegexSmartEvidenceReceipt(state, state.masterContext || {});
    const bundle = {
      receipt,
      masterContext: state.masterContext || {},
      regexTesterResult: classified,
      evidenceBasis: 'resident-or-heuristic',
      receiptRequestBasis: startBasis,
    };
    commitEvidenceBundle(stateRef, bundle);
    return bundle;
  }

  const bundle = await resolveRegexSmartEvidence(state);
  if (regexSmartReceiptRequestBasis(current(stateRef, {})) !== startBasis) {
    throw new Error('Regex samples, configuration, or master basis changed while evidence was loading. Analyze again.');
  }
  commitEvidenceBundle(stateRef, bundle);
  return bundle;
}

function refreshReceiptWithContext(stateRef, masterContext, evidenceBasis = '') {
  const state = current(stateRef, {});
  const receipt = buildRegexSmartEvidenceReceipt(state, masterContext);
  state.regexSmartPreflight = receipt;
  state.regexSmartEvidenceBasis = evidenceBasis;
  state.regexSmartPreflightRequestBasis = regexSmartReceiptRequestBasis(state);
  return receipt;
}

function applyClassifiedTesterResult(stateRef, rawResult, masterContext) {
  const classified = classifyRegexSmartTesterResult(rawResult, masterContext);
  stateRef.current = applyStandaloneRegexTesterResult(current(stateRef, {}), classified);
  return stateRef.current;
}

function findBuilder(card) {
  return [...card.querySelectorAll('.xml-cii-regex-rule-card')]
    .find((node) => /Interactive Click-to-Map Token Builder/i.test(node.querySelector('h4')?.textContent || '')) || null;
}

function tokenCards(builder) {
  const flex = [...builder.children].find((node) => node.style?.overflowX === 'auto');
  return flex ? [...flex.children] : [];
}

function showMessage(builder, text, bad = false) {
  let node = builder.querySelector('[data-regex-smart-message]');
  if (!node) {
    node = document.createElement('div');
    node.dataset.regexSmartMessage = 'true';
    Object.assign(node.style, { margin: '8px 0', padding: '7px 9px', borderRadius: '6px', fontSize: '11px' });
    builder.appendChild(node);
  }
  node.textContent = text;
  node.style.color = bad ? '#fecaca' : '#bbf7d0';
  node.style.background = bad ? 'rgba(127,29,29,.25)' : 'rgba(20,83,45,.22)';
  node.style.border = `1px solid ${bad ? 'rgba(248,113,113,.35)' : 'rgba(74,222,128,.28)'}`;
}

function suggestionEvidenceText(item) {
  const m = item?.evidenceMetrics || {};
  if (item?.role === 'lineKey') return `Exact master ${percent(m.exactMasterRate)} · uniqueness ${percent(m.uniquenessRate)} · line shape ${percent(m.shapeRate)}`;
  if (item?.role === 'pipingClass') return `Exact master ${percent(m.exactMasterRate)} · normalized master ${percent(m.normalizedMasterRate)} · class shape ${percent(m.shapeRate)}`;
  if (item?.role === 'bore') return `Explicit size syntax ${percent(m.explicitSyntaxRate)} · standard NPS/DN ${percent(m.standardValueRate)} · class bore ${percent(m.classBoreRate)}`;
  return (item?.evidence || []).join(' · ');
}

function actionMetrics(receipt) {
  const m = receipt.metrics;
  return [
    ['samples', m.sampleCount, 'Samples', '#93c5fd'],
    ['formats', m.formatCount, 'Formats', '#c4b5fd'],
    ['trusted', m.safeCount, 'Safe suggestions', '#4ade80'],
    ['approximate', m.reviewCount, 'Review suggestions', '#fbbf24'],
    ['conflict', m.conflictCount, 'Conflicts', m.conflictCount ? '#f87171' : '#64748b'],
    ['rejected', m.rejectedCount, 'Rejected samples', m.rejectedCount ? '#f87171' : '#64748b'],
    ['coverage', `${Math.round(m.coverage * 100)}%`, 'Extraction coverage (all samples)', m.coverage >= .95 ? '#4ade80' : m.coverage >= .8 ? '#fbbf24' : '#f87171'],
  ];
}

function installToolbar(builder, stateRef, render, receipt, options = {}) {
  const evidencePending = Boolean(options.evidencePending);
  builder.querySelector('[data-regex-smart-toolbar]')?.remove();
  const { bar, actions, metrics } = createSmartToolbar();
  bar.dataset.regexSmartToolbar = 'true';
  actions.append(
    createSmartIconButton('analyze', evidencePending ? 'Authoritative evidence is loading automatically; click to retry' : 'Analyze token suggestions', () => { void analyze(stateRef, render); }),
    createSmartIconButton('preview', 'Preview suggested configuration', () => { void preview(builder, stateRef); }),
    createSmartIconButton('apply', evidencePending ? 'Authoritative evidence is loading automatically' : 'Apply safe suggestions', () => { void applySafe(builder, stateRef, render); }, { disabled: evidencePending || receipt.metrics.safeCount === 0 }),
    createSmartIconButton('shield', evidencePending ? 'Pre-flight: AUTO-LOADING MASTER EVIDENCE' : `Pre-flight: ${receipt.status}`, () => toggleEvidence(builder, receipt), { color: evidencePending ? '#fbbf24' : smartStatusColor(receipt.status) }),
    createSmartIconButton('reset', 'Reset suggestion preview', () => resetSmart(builder, stateRef, render)),
    createSmartIconButton('settings', 'Suggestion policy', () => openPolicy(builder, stateRef, render)),
  );
  actionMetrics(receipt).forEach(([icon, value, label, color]) => metrics.appendChild(createSmartMetricChip(icon, value, label, { color, onClick: () => toggleEvidence(builder, receipt) })));
  builder.querySelector('h4')?.insertAdjacentElement('afterend', bar);
}

function changedSmartRoles(before, after) {
  return SMART_AUTO_ROLES.filter((role) => (
    String(before?.[role]?.tokenPosition || '') !== String(after?.[role]?.tokenPosition || '')
    || String(before?.[role]?.regex || '') !== String(after?.[role]?.regex || '')
  ));
}

function cloneConfig(config) {
  if (typeof structuredClone === 'function') return structuredClone(config || {});
  return JSON.parse(JSON.stringify(config || {}));
}

function clearUnlockedRatingMapping(config, manualLocks = {}) {
  if (manualLocks.rating === true) return { config, cleared: false };
  const index = Number(config?.activeFormatIndex || 0);
  const format = config?.formats?.[index] || config || {};
  const rating = format?.rating;
  if (!rating || (!String(rating.tokenPosition || '').trim() && !String(rating.regex || '').trim())) return { config, cleared: false };
  const next = cloneConfig(config);
  if (Array.isArray(next.formats)) {
    next.formats[index] = { ...(next.formats[index] || {}), rating: { ...(next.formats[index]?.rating || {}), tokenPosition: '', regex: '' } };
  } else {
    next.rating = { ...(next.rating || {}), tokenPosition: '', regex: '' };
  }
  return { config: next, cleared: true };
}

function autoApplyHighestSafe(stateRef, render, receipt) {
  const state = current(stateRef, {});
  if (regexSmartHasDatasetEvidence(state)) return false;
  if (!stateRef?.current || profileOf(state).operatingMode !== 'AUTO_PREVIEW_SAFE' || receipt.status === 'BLOCKED') return false;
  const locks = locksOf(state);
  let proposed = applyHighestSafeSuggestions(state.regexTesterConfig, receipt, { manualLocks: locks });
  const ratingCleanup = clearUnlockedRatingMapping(proposed, locks);
  proposed = ratingCleanup.config;
  const result = runStandaloneRegexTester({ ...state, sourceText: state.sourceText, extractionConfig: proposed });
  if (JSON.stringify(proposed) === JSON.stringify(state.regexTesterConfig)
    && result.supportConfigJson === state.supportConfigJson) return false;
  const index = Number(proposed.activeFormatIndex || receipt.formatIndex || 0);
  const before = state.regexTesterConfig?.formats?.[index] || state.regexTesterConfig || {};
  const after = proposed.formats?.[index] || proposed || {};
  const changed = changedSmartRoles(before, after);
  // A verified engineering basis is an immutable committed calculation, not
  // the mutable Regex Workbench. Automatic heuristics after Preview are drafts
  // requiring an explicit Apply; they must never silently invalidate Weight.
  const draftFingerprint=receipt.fingerprint||JSON.stringify(proposed);
  if(hasXml229VerifiedEngineeringBasis(stateRef)&&
     state.regexSmartDraftFingerprint===draftFingerprint)return false;
  const ratingNote = ratingCleanup.cleared ? ' Stale unlocked Rating mapping cleared; Rating remains manual.' : '';
  routeXml229AutomaticEngineeringProposal(stateRef,{
    proposal:{proposed,result,receipt},
    stage:()=> {
      publishRegexSuggestionDraft(stateRef,{
        regexSmartPreview:{receipt,proposed,result},
        regexSmartDraftFingerprint:draftFingerprint,
        regexSmartStatus:'Automatic regex suggestions are DRAFT only. The current verified Preview and Weight review are unchanged. Apply suggestions explicitly, then rebuild Preview.',
      });
    },
    commit:()=> {
      state.regexTesterConfig=proposed;
      applyClassifiedTesterResult(stateRef,result,state.masterContext||{});
      refreshReceiptWithContext(stateRef,state.masterContext||{},'resident-or-heuristic');
      stateRef.current.regexSmartStatus=changed.length
        ? `Auto-selected highest-confidence safe mapping for ${changed.join(', ')}.${ratingNote}`
        : `Automatic token analysis completed; configured mappings synchronized downstream.${ratingNote}`;
    },
  });
  queueMicrotask(() => render?.());
  return true;
}

async function autoAnalyzeDatasetEvidence(stateRef, render) {
  const state = current(stateRef, {});
  if (!stateRef?.current || !regexSmartHasDatasetEvidence(state)) return false;
  if (profileOf(state).operatingMode === 'OFF') return false;
  const requestBasis = regexSmartReceiptRequestBasis(state);
  if (!requestBasis) return false;
  if (state.regexSmartAutoAnalysisPendingBasis === requestBasis || state.regexSmartAutoAnalysisCompletedBasis === requestBasis) return false;

  state.regexSmartAutoAnalysisPendingBasis = requestBasis;
  state.regexSmartStatus = 'Loading authoritative Line List / Piping Class evidence and selecting safe token mappings…';
  queueMicrotask(() => render?.());

  try {
    const bundle = await resolveActionEvidence(stateRef);
    let live = current(stateRef, {});
    if (bundle.receipt.status === 'BLOCKED') {
      live.regexSmartPreview = null;
      live.regexSmartAutoAnalysisPendingBasis = '';
      live.regexSmartAutoAnalysisCompletedBasis = regexSmartReceiptRequestBasis(live);
      live.regexSmartStatus = `Automatic evidence analysis blocked: ${(bundle.receipt.blockers || []).map((item) => item.message).join(' ') || 'Preflight blocked.'} Existing mappings were preserved.`;
      render?.();
      return true;
    }
    const beforeConfig = live.regexTesterConfig || {};
    const locks = locksOf(live);
    let proposed = applyRegexSuggestions(beforeConfig, bundle.receipt, {
      safeOnly: true,
      manualLocks: locks,
    });
    const ratingCleanup = clearUnlockedRatingMapping(proposed, locks);
    proposed = ratingCleanup.config;
    const index = Number(proposed.activeFormatIndex || bundle.receipt.formatIndex || 0);
    const before = beforeConfig?.formats?.[index] || beforeConfig || {};
    const after = proposed?.formats?.[index] || proposed || {};
    const changed = changedSmartRoles(before, after);

    const rawResult = runStandaloneRegexTester({ ...live, sourceText: live.sourceText, extractionConfig: proposed });
    const mode=routeXml229AutomaticEngineeringProposal(stateRef,{
      proposal:{proposed,result:rawResult,receipt:bundle.receipt},
      stage:()=> {
        // No writes to supportConfigJson or regexTesterConfig: this is a
        // proposed engineering edit, never an implicit committed input.
        publishRegexSuggestionDraft(stateRef,{
          regexSmartPreview:{receipt:bundle.receipt,proposed,result:rawResult},
          regexSmartAutoAnalysisPendingBasis:'',
          regexSmartAutoAnalysisCompletedBasis:requestBasis,
          regexSmartStatus:'Safe token analysis created a DRAFT proposal. Verified Preview and Weight inputs remain unchanged until explicit Apply and rebuild.',
        });
      },
      commit:()=> {
        live.regexTesterConfig=proposed;
        applyClassifiedTesterResult(stateRef,rawResult,bundle.masterContext);
        refreshReceiptWithContext(stateRef,bundle.masterContext,bundle.evidenceBasis);
      },
    });
    live=current(stateRef,{});
    if(mode==='COMMITTED'){
      live.regexSmartPreview=null;
      live.regexSmartAutoAnalysisPendingBasis='';
      live.regexSmartAutoAnalysisCompletedBasis=regexSmartReceiptRequestBasis(live);
      const ratingNote=ratingCleanup.cleared?' Stale unlocked Rating mapping was cleared.':' Rating remains manual.';
      live.regexSmartStatus=changed.length
        ? `Auto-analyzed authoritative master evidence and selected ${changed.join(', ')}.${ratingNote}`
        : `Auto-analyzed ${bundle.receipt.metrics.sampleCount} samples with ${bundle.receipt.masterEvidence?.mode || 'master'} evidence; configured mappings synchronized downstream.${ratingNote}`;
    }
  } catch (error) {
    const live = current(stateRef, {});
    live.regexSmartAutoAnalysisPendingBasis = '';
    live.regexSmartAutoAnalysisCompletedBasis = requestBasis;
    live.regexSmartStatus = `Automatic evidence analysis failed: ${error?.message || String(error)}`;
  }
  render?.();
  return true;
}

async function analyze(stateRef, render) {
  const state = current(stateRef, {});
  state.regexSmartStatus = regexSmartHasDatasetEvidence(state) ? 'Loading Line List and Piping Class evidence…' : 'Analyzing token suggestions…';
  render?.();
  try {
    const bundle = await resolveActionEvidence(stateRef);
    const live = current(stateRef, {});
    live.regexSmartPreview = null;
    live.regexSmartAutoAnalysisCompletedBasis = regexSmartReceiptRequestBasis(live);
    live.regexSmartStatus = `Analyzed ${bundle.receipt.metrics.sampleCount} samples with ${bundle.receipt.masterEvidence?.mode || 'heuristic'} evidence. Rating remains manual.`;
  } catch (error) {
    current(stateRef, {}).regexSmartStatus = `Evidence analysis failed: ${error?.message || String(error)}`;
  }
  render?.();
}

async function preview(builder, stateRef) {
  try {
    const bundle = await resolveActionEvidence(stateRef);
    const state = current(stateRef, {});
    const receipt = bundle.receipt;
    const proposed = applyRegexSuggestions(state.regexTesterConfig, receipt, { safeOnly: false, manualLocks: locksOf(state) });
    const rawResult = runStandaloneRegexTester({ ...state, sourceText: state.sourceText, extractionConfig: proposed });
    const result = classifyRegexSmartTesterResult(rawResult, bundle.masterContext);
    state.regexSmartPreview = { receipt, proposed, result };
    const before = resultOf(state).matchedRows?.length || 0;
    const after = result.matchedRows?.length || 0;
    const rejected = result.rejectedRows?.length || 0;
    showMessage(builder, `Preview only — extracted ${before} → ${after}; rejected ${rejected}. Configuration is unchanged. Rating is not inferred.`, false);
  } catch (error) {
    showMessage(builder, `Preview failed: ${error?.message || String(error)}`, true);
  }
}

async function applySafe(builder, stateRef, render) {
  const beforeState = current(stateRef, {});
  const stored = beforeState.regexSmartPreflight;
  const storedBasis = beforeState.regexSmartPreflightRequestBasis;
  try {
    const bundle = await resolveActionEvidence(stateRef);
    const state = current(stateRef, {});
    const fresh = bundle.receipt;
    if (!stored || storedBasis !== bundle.receiptRequestBasis || stored.fingerprint !== fresh.fingerprint) {
      state.regexSmartPreflight = { ...fresh, status: 'STALE' };
      state.regexSmartPreflightRequestBasis = regexSmartReceiptRequestBasis(state);
      showMessage(builder, 'Samples, masters, or configuration changed. Analyze again before applying.', true);
      render?.();
      return;
    }
    if (fresh.status === 'BLOCKED') {
      showMessage(builder, 'Preflight blocked. Existing token mappings were preserved.', true);
      return;
    }
    const locks = locksOf(state);
    let proposed = applyRegexSuggestions(state.regexTesterConfig, fresh, { safeOnly: true, manualLocks: locks });
    const ratingCleanup = clearUnlockedRatingMapping(proposed, locks);
    proposed = ratingCleanup.config;
    const rawResult = runStandaloneRegexTester({ ...state, sourceText: state.sourceText, extractionConfig: proposed });
    state.regexTesterConfig = proposed;
    applyClassifiedTesterResult(stateRef, rawResult, bundle.masterContext);
    refreshReceiptWithContext(stateRef, bundle.masterContext, bundle.evidenceBasis);
    stateRef.current.regexSmartStatus = `Applied ${fresh.metrics.safeCount} safe suggestion(s) using ${fresh.masterEvidence?.mode || 'heuristic'} evidence.${ratingCleanup.cleared ? ' Stale unlocked Rating mapping cleared.' : ' Rating remains manual.'}`;
    render?.();
  } catch (error) {
    showMessage(builder, `Apply failed: ${error?.message || String(error)}`, true);
  }
}

function resetSmart(builder, stateRef, render) {
  const state = current(stateRef, {});
  state.regexSmartPreflight = null;
  state.regexSmartPreflightRequestBasis = '';
  state.regexSmartEvidenceBasis = '';
  state.regexSmartPreview = null;
  state.regexSmartAutoAnalysisPendingBasis = '';
  state.regexSmartAutoAnalysisCompletedBasis = '';
  state.regexSmartStatus = 'Suggestion preview cleared. Existing mappings were preserved.';
  builder.querySelector('[data-regex-smart-evidence]')?.remove();
  render?.();
}

function toggleEvidence(builder, receipt) {
  const old = builder.querySelector('[data-regex-smart-evidence]');
  if (old) { old.remove(); return; }
  const panel = document.createElement('div');
  panel.dataset.regexSmartEvidence = 'true';
  Object.assign(panel.style, { padding: '9px', margin: '8px 0', borderRadius: '7px', background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.22)', fontSize: '11px' });
  const mode = receipt.masterEvidence?.mode || 'HEURISTIC_ONLY';
  panel.innerHTML = `<strong style="color:${smartStatusColor(receipt.status)}">${receipt.status}</strong> · ${receipt.selectedSignature || 'No format signature'} · ${mode}`;
  const explainer = document.createElement('div');
  explainer.style.marginTop = '5px';
  explainer.style.color = '#94a3b8';
  explainer.textContent = 'Confidence is a composite suggestion score. Master/structural evidence rates are reported separately below; Rating is excluded from smart inference and remains manual.';
  panel.appendChild(explainer);
  const list = document.createElement('div');
  list.style.marginTop = '7px';
  receipt.suggestions.forEach((item) => {
    const meta = ROLE_META[item.role];
    const row = document.createElement('div');
    row.style.margin = '5px 0';
    row.textContent = `${meta?.label || item.role}: #${item.tokenPositions.join(',')} · Confidence ${percent(item.confidence)} · ${suggestionEvidenceText(item)} · ${item.authorityLevel}${item.conflict ? ' · CONFLICT' : ''}`;
    list.appendChild(row);
  });
  receipt.blockers.forEach((item) => {
    const row = document.createElement('div');
    row.style.color = '#fca5a5';
    row.textContent = `${item.code}: ${item.message}`;
    list.appendChild(row);
  });
  panel.appendChild(list);
  builder.appendChild(panel);
}

function decorateTokens(builder, receipt, stateRef, render) {
  const cards = tokenCards(builder);
  cards.forEach((card) => card.querySelectorAll('[data-smart-token-badge]').forEach((node) => node.remove()));
  receipt.suggestions.forEach((item) => {
    const meta = ROLE_META[item.role];
    item.tokenPositions.forEach((position) => {
      const card = cards[position - 1];
      if (!card || !meta) return;
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.dataset.smartTokenBadge = item.role;
      badge.title = `${meta.label}: Confidence ${percent(item.confidence)} · ${suggestionEvidenceText(item)} · ${item.authorityLevel}`;
      Object.assign(badge.style, { border: `1px solid ${meta.color}55`, background: `${meta.color}18`, color: meta.color, borderRadius: '999px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', display: 'inline-flex', gap: '4px', alignItems: 'center', justifyContent: 'center' });
      badge.append(createSmartIcon(meta.icon, 12), document.createTextNode(`C ${percent(item.confidence)}`));
      badge.addEventListener('click', () => { void applyOne(item, stateRef, render, builder); });
      card.querySelector('strong')?.insertAdjacentElement('afterend', badge);
    });
  });
}

async function applyOne(item, stateRef, render, builder) {
  const before = current(stateRef, {});
  const stored = before.regexSmartPreflight;
  const storedBasis = before.regexSmartPreflightRequestBasis;
  try {
    const bundle = await resolveActionEvidence(stateRef);
    const state = current(stateRef, {});
    if (!stored || storedBasis !== bundle.receiptRequestBasis || stored.fingerprint !== bundle.receipt.fingerprint) {
      showMessage(builder, 'Suggestion evidence changed. Analyze again before applying this token.', true);
      render?.();
      return;
    }
    if (bundle.receipt.status === 'BLOCKED') {
      showMessage(builder, 'Preflight blocked. Existing token mappings were preserved.', true);
      return;
    }
    const fresh = bundle.receipt.suggestions.find((candidate) => candidate.role === item.role
      && candidate.tokenPositions.join(',') === item.tokenPositions.join(','));
    if (!fresh || fresh.conflict || !SMART_AUTO_ROLES.includes(fresh.role)) {
      showMessage(builder, 'This suggestion is no longer valid under current master evidence.', true);
      render?.();
      return;
    }
    if (locksOf(state)[fresh.role]) {
      showMessage(builder, `Unlock ${ROLE_META[fresh.role].label} before applying its suggested position.`, true);
      return;
    }
    const receipt = { formatIndex: state.regexTesterConfig?.activeFormatIndex || 0, suggestions: [fresh] };
    const proposed = applyRegexSuggestions(state.regexTesterConfig, receipt, { safeOnly: false, manualLocks: locksOf(state) });
    const rawResult = runStandaloneRegexTester({ ...state, sourceText: state.sourceText, extractionConfig: proposed });
    state.regexTesterConfig = proposed;
    applyClassifiedTesterResult(stateRef, rawResult, bundle.masterContext);
    stateRef.current.regexSmartManualLocks = { ...locksOf(stateRef.current), [fresh.role]: true };
    refreshReceiptWithContext(stateRef, bundle.masterContext, bundle.evidenceBasis);
    stateRef.current.regexSmartStatus = `Selected ${ROLE_META[fresh.role].label} token #${fresh.tokenPositions.join(',')} from current evidence.`;
    render?.();
  } catch (error) {
    showMessage(builder, `Apply failed: ${error?.message || String(error)}`, true);
  }
}

function decorateLocks(card, stateRef, render) {
  const state = current(stateRef, {});
  const locks = locksOf(state);
  const labels = { 'Line key extraction': 'lineKey', 'Piping class extraction': 'pipingClass', 'Rating extraction': 'rating', 'Bore / size extraction': 'bore' };
  card.querySelectorAll('.xml-cii-regex-rule-card h4').forEach((heading) => {
    const role = labels[(heading.textContent || '').trim()];
    if (!role || heading.querySelector('[data-smart-lock]')) return;
    const button = createSmartIconButton(locks[role] ? 'lock' : 'unlock', `${locks[role] ? 'Unlock' : 'Lock'} ${ROLE_META[role].label}`, () => {
      state.regexSmartManualLocks = { ...locksOf(state), [role]: !locksOf(state)[role] };
      state.regexSmartPreflight = null;
      state.regexSmartPreflightRequestBasis = '';
      state.regexSmartAutoAnalysisCompletedBasis = '';
      render?.();
    }, { active: Boolean(locks[role]), size: 13 });
    button.dataset.smartLock = role;
    button.style.marginLeft = '7px'; button.style.width = '24px'; button.style.height = '24px';
    heading.appendChild(button);
  });
}

function openPolicy(builder, stateRef, render) {
  builder.querySelector('[data-regex-smart-policy]')?.remove();
  const state = current(stateRef, {}); const profile = profileOf(state);
  const panel = document.createElement('div'); panel.dataset.regexSmartPolicy = 'true';
  Object.assign(panel.style, { position: 'absolute', right: '8px', top: '44px', zIndex: '20', width: '330px', maxWidth: '92%', padding: '14px', borderRadius: '8px', background: '#111827', border: '1px solid #334155', boxShadow: '0 18px 42px rgba(0,0,0,.42)', fontSize: '12px' });
  builder.style.position = 'relative';
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>Suggestion policy</strong><button type="button" data-close>×</button></div>
    <label>Mode <select data-mode><option>SUGGEST_ONLY</option><option>AUTO_PREVIEW_SAFE</option><option>OFF</option></select></label>
    <label>Safe % <input data-safe type="number" min="50" max="100" value="${Math.round(profile.thresholds.safe * 100)}"></label>
    <label>Review % <input data-review type="number" min="1" max="99" value="${Math.round(profile.thresholds.review * 100)}"></label>
    <label>Display % <input data-display type="number" min="1" max="99" value="${Math.round(profile.thresholds.display * 100)}"></label>
    <label>Class suffix regex <input data-suffix value="${profile.normalization.classSuffixPattern}"></label>
    <label>Maximum formats <input data-formats type="number" min="1" max="8" value="${profile.formatPolicy.maximumFormats}"></label>
    <label>Maximum line-key tokens <input data-tokens type="number" min="1" max="5" value="${profile.formatPolicy.maximumLineKeyTokens}"></label>
    <div style="font-size:10px;color:#94a3b8;margin-top:8px;">Smart inference covers Line Key, Piping Class and Bore only. Rating remains manual.</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button type="button" data-cancel>Cancel</button><button type="button" data-save>Save</button></div>`;
  panel.querySelectorAll('label').forEach((label) => Object.assign(label.style, { display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '9px', alignItems: 'center' }));
  panel.querySelectorAll('input,select').forEach((input) => Object.assign(input.style, { width: '145px', background: '#0b1320', color: '#e5e7eb', border: '1px solid #475569', borderRadius: '4px', padding: '4px' }));
  panel.querySelector('[data-mode]').value = profile.operatingMode;
  const close = () => panel.remove(); panel.querySelector('[data-close]').onclick = close; panel.querySelector('[data-cancel]').onclick = close;
  panel.querySelector('[data-save]').onclick = () => {
    const percentValue = (key) => Number(panel.querySelector(`[data-${key}]`).value) / 100;
    state.regexSuggestionProfile = Object.freeze({ ...profile,
      operatingMode: panel.querySelector('[data-mode]').value,
      thresholds: Object.freeze({ safe: percentValue('safe'), review: percentValue('review'), display: percentValue('display') }),
      normalization: Object.freeze({ ...profile.normalization, classSuffixPattern: panel.querySelector('[data-suffix]').value }),
      formatPolicy: Object.freeze({ maximumFormats: Number(panel.querySelector('[data-formats]').value), maximumLineKeyTokens: Number(panel.querySelector('[data-tokens]').value) }),
    });
    state.regexSmartPreflight = null;
    state.regexSmartPreflightRequestBasis = '';
    state.regexSmartAutoAnalysisCompletedBasis = '';
    close();
    render?.();
  };
  builder.appendChild(panel);
}

export function enhanceRegexSmartWorkbench(card, state, stateRef, render) {
  if (typeof document === 'undefined') return;
  const builder = findBuilder(card); if (!builder) return;
  const live = current(stateRef, state);
  const evidencePending = regexSmartHasDatasetEvidence(live) && !regexSmartReceiptIsCurrent(live);

  if (!regexSmartHasDatasetEvidence(live) && !regexSmartReceiptIsCurrent(live)) {
    live.regexTesterResult = classifyRegexSmartTesterResult(resultOf(live), live.masterContext || {});
    live.regexSmartPreflight = buildRegexSmartEvidenceReceipt(live, live.masterContext || {});
    live.regexSmartPreflightRequestBasis = regexSmartReceiptRequestBasis(live);
    live.regexSmartEvidenceBasis = 'resident-or-heuristic';
  }

  const receipt = receiptFor(live);
  if (evidencePending) void autoAnalyzeDatasetEvidence(stateRef, render);
  if (!evidencePending && autoApplyHighestSafe(stateRef, render, receipt)) return;
  installToolbar(builder, stateRef, render, receipt, { evidencePending });
  decorateRegexSampleSelector(builder, resultOf(live).branchSamples || [], live.regexTesterConfig || {});
  decorateTokens(builder, evidencePending ? { ...receipt, suggestions: [] } : receipt, stateRef, render);
  decorateLocks(card, stateRef, render);
  if (evidencePending) {
    showMessage(builder, 'Authoritative Line List / Piping Class evidence is loading automatically. Safe Line Key, Piping Class and Bore mappings will replace stale unlocked selections; stale unlocked Rating mapping is cleared and Rating remains manual.', false);
  } else if (live.regexSmartStatus) {
    showMessage(builder, live.regexSmartStatus, /blocked|stale|failed/i.test(live.regexSmartStatus));
  }
}
