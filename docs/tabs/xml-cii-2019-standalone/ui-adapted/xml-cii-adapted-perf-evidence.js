import { createElement } from './xml-cii-adapted-dom.js';
import { snapshotXmlCiiPerfMetrics, xmlCiiPerfEnabled } from './xml-cii-adapted-perf.js';

const COUNTER_ROWS = Object.freeze([
  ['Config parses', 'configParseCount'],
  ['Master imports', 'masterImportCount'],
  ['Mapping draft changes', 'masterMappingDraftChanges'],
  ['Mapping applies', 'masterMappingApplyCount'],
  ['Persistence commits', 'masterPersistCommitCount'],
  ['Storage writes', 'masterStorageWriteCount'],
  ['Rows normalized', 'masterRowsNormalized'],
  ['Requested full renders', 'masterRequestedFullRenderCount'],
  ['Actual workspace full renders', 'workspaceFullRenderCount'],
  ['Workspace partial renders', 'workspacePartialRenderCount'],
  ['Master local DOM updates', 'masterPartialDomUpdateCount'],
  ['Source document parses', 'sourceParseCount'],
  ['Source parse cache hits', 'sourceParseCacheHitCount'],
]);

const TIMING_ROWS = Object.freeze([
  ['ArrayBuffer', 'masterArrayBufferMs'],
  ['XLSX read', 'masterXlsxReadMs'],
  ['Sheet to JSON', 'masterSheetToJsonMs'],
  ['Normalize', 'masterNormalizeMs'],
  ['Persist', 'masterPersistMs'],
  ['Source document parse', 'sourceParseMs'],
]);

function numberText(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '0';
}

function msText(value) {
  const number = Number(value || 0);
  return `${(Number.isFinite(number) ? number : 0).toFixed(1)} ms`;
}

export function formatXmlCiiPerfEvidence(metrics = {}) {
  return {
    counters: COUNTER_ROWS.map(([label, key]) => ({ label, key, value: Number(metrics[key] || 0), text: numberText(metrics[key]) })),
    timings: TIMING_ROWS.map(([label, key]) => ({ label, key, value: Number(metrics[key] || 0), text: msText(metrics[key]) })),
  };
}

function metricRow(item) {
  const row = createElement('div', '', 'xml-cii-perf-evidence-row');
  if (row.style) Object.assign(row.style, { display: 'flex', justifyContent: 'space-between', gap: '20px' });
  row.append(createElement('span', item.label), createElement('strong', item.text));
  return row;
}

function evidenceBody(metrics) {
  const body = createElement('div', '', 'xml-cii-perf-evidence-body');
  if (body.style) Object.assign(body.style, { display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) minmax(240px,1fr)', gap: '12px 28px', marginTop: '8px', fontSize: '12px' });
  const formatted = formatXmlCiiPerfEvidence(metrics);
  const counters = createElement('div');
  counters.appendChild(createElement('strong', 'Operation counts'));
  for (const item of formatted.counters) counters.appendChild(metricRow(item));
  const timings = createElement('div');
  timings.appendChild(createElement('strong', 'Aggregate timings'));
  for (const item of formatted.timings) timings.appendChild(metricRow(item));
  body.append(counters, timings);
  return body;
}

export function renderXmlCiiPerfEvidencePanel(parent) {
  if (!xmlCiiPerfEnabled() || !parent) return null;
  const details = createElement('details', '', 'xml-cii-perf-evidence');
  details.dataset.xmlCiiPerfEvidence = 'true';
  if (details.style) Object.assign(details.style, { marginTop: '10px', maxWidth: '900px', border: '1px solid rgba(96,165,250,.25)', borderRadius: '7px', padding: '7px 10px', background: 'rgba(15,23,42,.35)' });
  details.append(createElement('summary', 'Performance evidence (?perf=1)'), evidenceBody(snapshotXmlCiiPerfMetrics()));
  parent.appendChild(details);
  return details;
}

export function syncXmlCiiPerfEvidencePanel(container) {
  if (!xmlCiiPerfEnabled() || !container) return false;
  const details = container.querySelector?.('[data-xml-cii-perf-evidence="true"]');
  if (!details) return false;
  const body = details.querySelector?.('.xml-cii-perf-evidence-body');
  if (!body || !body.parentNode?.replaceChild) return false;
  body.parentNode.replaceChild(evidenceBody(snapshotXmlCiiPerfMetrics()), body);
  return true;
}
