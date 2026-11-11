import {
  buildHpPipingClassResultExport,
  sortHpPipingClassResultRows,
  verifyHpPipingClassResultRoundTrip,
} from './hp-piping-class-result-export.js';

export const HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION = 'hp-piping-class-engineering-review-report/v1';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? '').trim();
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmt(value, digits = 5) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}

function assertReviewOnlyAuthority(authority, path) {
  const source = authority ?? {};
  for (const field of ['nativeCoreKd3Qualified', 'codeCompliance', 'canUseForDesignAuthority']) {
    if (source[field] !== false) {
      throw new TypeError(`${path}.${field} must remain false for an HP engineering-review report.`);
    }
  }
  if (source.calculationMode !== undefined && source.calculationMode !== 'USER_CALCULATED_KD3') {
    throw new TypeError(`${path}.calculationMode must remain USER_CALCULATED_KD3.`);
  }
}

function identity(project = {}) {
  return {
    projectId: text(project.metadata?.projectId),
    classId: text(project.metadata?.classId),
    revision: text(project.metadata?.revision),
  };
}

function assertIdentityMatch(projectIdentity, resultIdentity) {
  for (const field of ['projectId', 'classId', 'revision']) {
    if (text(projectIdentity?.[field]) !== text(resultIdentity?.[field])) {
      throw new TypeError(`Current project ${field} does not match the completed canonical review result.`);
    }
  }
}

function collectAdvisories(result = {}) {
  const rows = [];
  const seen = new Set();
  const add = (entry, scope, kind) => {
    if (!entry) return;
    const code = text(entry.code) || kind;
    const message = text(entry.message ?? entry);
    if (!message) return;
    const key = `${scope}|${kind}|${code}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(Object.freeze({ scope, kind, code, message }));
  };
  (result.warnings ?? []).forEach((entry) => add(entry, 'PROJECT', 'WARNING'));
  (result.advisories ?? []).forEach((entry) => add(entry, 'PROJECT', 'ADVISORY'));
  for (const product of result.products ?? []) {
    for (const [calculationName, calculation] of Object.entries(product?.calculations ?? {})) {
      (calculation?.warnings ?? []).forEach((entry) => add(entry, `${product.productId}:${calculationName}`, 'WARNING'));
      (calculation?.advisories ?? []).forEach((entry) => add(entry, `${product.productId}:${calculationName}`, 'ADVISORY'));
    }
  }
  return Object.freeze(rows);
}

function evidenceCustody(project = {}) {
  const rows = [];
  for (const pkg of project.fatigueEvidence ?? []) {
    for (const row of pkg?.externalResults ?? []) {
      rows.push(Object.freeze({
        productId: text(pkg.productId),
        cycleId: text(row.cycleId),
        locationId: text(row.locationId),
        fromStateId: text(row.fromStateId),
        toStateId: text(row.toStateId),
        userAlternatingStressIntensityMpa: finiteOrNull(row.userAlternatingStressIntensityMpa),
        equivalentAlternatingStressMpa: finiteOrNull(row.equivalentAlternatingStressMpa),
        permissibleCycles: finiteOrNull(row.permissibleCycles),
        calculationBasis: Object.freeze(clone(row.calculationBasis ?? {})),
      }));
    }
  }
  rows.sort((a, b) => a.productId.localeCompare(b.productId) || a.cycleId.localeCompare(b.cycleId) || a.locationId.localeCompare(b.locationId));
  return Object.freeze(rows);
}

function productInputs(project = {}) {
  const rows = (project.products ?? []).map((product) => Object.freeze({
    productId: text(product.productId),
    nominalSize: text(product.nominalSize),
    basisMode: text(product.calculationBasis?.mode),
    calculationBasis: Object.freeze(clone(product.calculationBasis ?? {})),
    wallState: Object.freeze(clone(product.wallState ?? {})),
  }));
  rows.sort((a, b) => a.productId.localeCompare(b.productId));
  return Object.freeze(rows);
}

function sortedCycles(rows = []) {
  return Object.freeze([...rows].sort((a, b) => String(a.productId ?? '').localeCompare(String(b.productId ?? ''))
    || String(a.cycleId ?? '').localeCompare(String(b.cycleId ?? ''))
    || String(a.locationId ?? '').localeCompare(String(b.locationId ?? ''))));
}

export function buildHpPipingClassEngineeringReviewReport(project = {}, result = {}) {
  if (!project || typeof project !== 'object') throw new TypeError('A current HP Piping Class project is required.');
  if (!result?.ok) throw new TypeError('A completed canonical HP Piping Class review result is required.');
  assertReviewOnlyAuthority(project.methodManifest, 'project.methodManifest');
  assertReviewOnlyAuthority(result.authority, 'result.authority');

  const projectIdentity = identity(project);
  assertIdentityMatch(projectIdentity, result.projectIdentity);

  const resultBundle = buildHpPipingClassResultExport(result);
  const resultRoundTrip = verifyHpPipingClassResultRoundTrip(resultBundle);
  if (!resultRoundTrip.ok) throw new TypeError('Canonical HP result export did not pass its existing CSV/JSON round-trip gate.');

  const sortedProducts = sortHpPipingClassResultRows(resultBundle.productRows, 'reviewPriority');
  const governing = sortedProducts[0] ?? null;
  const authority = Object.freeze({
    calculationMode: 'USER_CALCULATED_KD3',
    nativeCoreKd3Qualified: false,
    codeCompliance: false,
    canUseForDesignAuthority: false,
    engineeringAuthority: text(result.authority?.engineeringAuthority) || 'HP_PIPING_CLASS_REVIEW_ORCHESTRATION_ONLY',
    reportPurpose: 'ENGINEERING_REVIEW_ONLY',
  });

  return Object.freeze({
    schemaVersion: HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION,
    reportPurpose: 'ENGINEERING_REVIEW_ONLY',
    identity: Object.freeze(projectIdentity),
    sourceContracts: Object.freeze({
      projectVersion: text(result.projectVersion || project.schemaVersion),
      orchestratorVersion: text(result.orchestratorVersion),
      resultExportVersion: resultBundle.schemaVersion,
      calculationIds: Object.freeze(clone(result.calculationIds ?? {})),
    }),
    method: Object.freeze({
      b313Edition: text(project.methodManifest?.b313Edition),
      viii3Edition: text(project.methodManifest?.viii3Edition),
      calculationMode: 'USER_CALCULATED_KD3',
    }),
    canonicalUnits: Object.freeze(clone(project.canonicalUnits ?? {})),
    authority,
    classBasis: Object.freeze(clone(project.classBasis ?? {})),
    productInputs: productInputs(project),
    transient: Object.freeze({
      spectrum: Object.freeze(clone(project.transient?.spectrum ?? null)),
      states: Object.freeze(clone(project.transient?.states ?? [])),
      transitions: Object.freeze(clone(project.transient?.transitions ?? [])),
    }),
    reviewSummary: Object.freeze({
      projectState: text(result.projectState),
      ...clone(result.summary ?? {}),
      highestReviewPriorityProductId: governing?.productId ?? null,
      highestReviewPriority: governing?.reviewPriority ?? null,
      highestReviewPressureRatingMargin: governing?.pressureRatingMargin ?? null,
      highestReviewCumulativeUsage: governing?.cumulativeUsage ?? null,
      resultRoundTrip: Object.freeze(clone(resultRoundTrip)),
      priorityDisclaimer: 'Review-priority ordering is a reporting aid only; it is not a Code governing rule or design-release decision.',
    }),
    productResults: Object.freeze(sortedProducts.map((row) => Object.freeze(clone(row)))),
    cycleResults: Object.freeze(sortedCycles(resultBundle.cycleRows).map((row) => Object.freeze(clone(row)))),
    externalKdCustody: evidenceCustody(project),
    advisories: collectAdvisories(result),
    limitations: Object.freeze([
      'REVIEW ONLY — NO DESIGN AUTHORITY.',
      'Native CORE KD-3 / KD320 remains not qualified by this report.',
      'Code compliance is not established by this report.',
      'Seq and permissible cycles N remain external/user-calculated inputs where supplied.',
      'The report re-presents canonical project inputs and canonical review outputs; it does not implement an independent engineering equation path.',
    ]),
  });
}

export function serializeHpPipingClassEngineeringReviewReportJson(report) {
  if (report?.schemaVersion !== HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION) throw new TypeError('Unsupported HP engineering-review report schema.');
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function parseHpPipingClassEngineeringReviewReportJson(textValue) {
  let parsed;
  try { parsed = JSON.parse(String(textValue ?? '')); }
  catch (error) { throw new TypeError(`HP engineering-review report JSON is invalid: ${error.message}`); }
  if (parsed?.schemaVersion !== HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION) throw new TypeError('Unsupported HP engineering-review report schema.');
  if (parsed?.reportPurpose !== 'ENGINEERING_REVIEW_ONLY') throw new TypeError('HP engineering-review report purpose must remain ENGINEERING_REVIEW_ONLY.');
  assertReviewOnlyAuthority(parsed.authority, 'report.authority');
  if (!Array.isArray(parsed.productInputs) || !Array.isArray(parsed.productResults) || !Array.isArray(parsed.cycleResults) || !Array.isArray(parsed.externalKdCustody)) {
    throw new TypeError('HP engineering-review report is missing canonical input/result/custody arrays.');
  }
  return Object.freeze(parsed);
}

export function verifyHpPipingClassEngineeringReviewReportRoundTrip(report) {
  try {
    const serialized = serializeHpPipingClassEngineeringReviewReportJson(report);
    const parsed = parseHpPipingClassEngineeringReviewReportJson(serialized);
    return Object.freeze({
      ok: JSON.stringify(parsed) === JSON.stringify(report),
      schemaVersion: report?.schemaVersion ?? null,
      productCount: report?.productResults?.length ?? 0,
      cycleCount: report?.cycleResults?.length ?? 0,
      custodyRowCount: report?.externalKdCustody?.length ?? 0,
    });
  } catch (error) {
    return Object.freeze({ ok: false, error: error.message, schemaVersion: report?.schemaVersion ?? null, productCount: 0, cycleCount: 0, custodyRowCount: 0 });
  }
}

function inputRowsHtml(report) {
  if (!report.productInputs.length) return '<tr><td colspan="12">No product inputs supplied.</td></tr>';
  return report.productInputs.map((row) => {
    const basis = row.calculationBasis ?? {};
    const wall = row.wallState ?? {};
    return `<tr><td><strong>${esc(row.productId || '—')}</strong></td><td>${esc(row.nominalSize || '—')}</td><td>${esc(row.basisMode || '—')}</td><td>${fmt(basis.outsideDiameterMm)}</td><td>${fmt(basis.allowableStressMpa)}</td><td>${fmt(basis.nominalWallMm)}</td><td>${fmt(basis.minusTolerancePct, 3)}</td><td>${esc(wall.fatigueWallBasis || '—')}</td><td>${fmt(wall.measuredCurrentWallMm)}</td><td>${fmt(wall.futureInternalLossMm)}</td><td>${fmt(wall.futureExternalLossMm)}</td><td>${basis.basisPackage ? 'Governed package retained in JSON' : 'Direct engineering input'}</td></tr>`;
  }).join('');
}

function productRowsHtml(report) {
  return report.productResults.map((row) => `<tr>
    <td><strong>${esc(row.productId || '—')}</strong></td><td>${esc(row.reviewPriority || '—')}</td>
    <td>${row.staticPass === true ? 'PASS' : row.staticPass === false ? 'FAIL' : '—'}</td>
    <td>${fmt(row.requiredNominalThicknessMm)}</td><td>${fmt(row.pressureRatingMpa)}</td><td>${fmt(row.pressureRatingMargin, 6)}</td>
    <td>${esc(row.selectedFatigueWallBasis || '—')}</td><td>${fmt(row.selectedFatigueWallMm)}</td><td>${fmt(row.cumulativeUsage, 6)}</td>
    <td>${esc(row.governingCycleId || '—')}</td><td>${esc(row.engineeringState || '—')}</td>
  </tr>`).join('');
}

function cycleRowsHtml(report) {
  if (!report.cycleResults.length) return '<tr><td colspan="11">No fatigue cycle results were evaluated.</td></tr>';
  return report.cycleResults.map((row) => `<tr>
    <td>${esc(row.productId || '—')}</td><td><strong>${esc(row.cycleId || '—')}</strong></td><td>${esc(row.fromStateId || '—')} → ${esc(row.toStateId || '—')}</td>
    <td>${fmt(row.pressureRangeMpa)}</td><td>${fmt(row.coreSaltMpa, 6)}</td><td>${fmt(row.userSaltMpa, 6)}</td>
    <td>${fmt(row.equivalentAlternatingStressMpa, 6)}</td><td>${Number.isFinite(row.permissibleCycles) ? esc(row.permissibleCycles) : row.zeroDamage ? 'N/A' : '—'}</td>
    <td>${Number.isFinite(row.appliedCycles) ? esc(row.appliedCycles) : '—'}</td><td>${fmt(row.cycleUsage, 6)}</td><td>${esc(row.cycleEvidenceStatus || '—')}</td>
  </tr>`).join('');
}

function stateRowsHtml(report) {
  const rows = report.transient.states ?? [];
  if (!rows.length) return '<tr><td colspan="4">No operating states supplied.</td></tr>';
  return rows.map((row) => `<tr><td><strong>${esc(row.stateId || '—')}</strong></td><td>${fmt(row.pressureMpa)}</td><td>${fmt(row.materialTemperatureC, 2)}</td><td>${fmt(row.structuralTemperatureC, 2)}</td></tr>`).join('');
}

function transitionRowsHtml(report) {
  const rows = report.transient.transitions ?? [];
  if (!rows.length) return '<tr><td colspan="7">No governed cycles supplied.</td></tr>';
  return rows.map((row) => `<tr><td><strong>${esc(row.cycleId || '—')}</strong></td><td>${esc(row.fromStateId || '—')}</td><td>${esc(row.toStateId || '—')}</td><td>${Number.isFinite(row.totalCycles) ? esc(row.totalCycles) : '—'}</td><td>${Number.isFinite(row.cyclesPerYear) ? esc(row.cyclesPerYear) : '—'}</td><td>${esc(row.category || '—')}</td><td>${esc(row.provenanceId || '—')}</td></tr>`).join('');
}

function custodyRowsHtml(report) {
  if (!report.externalKdCustody.length) return '<tr><td colspan="9">No external KD-3 result custody supplied.</td></tr>';
  return report.externalKdCustody.map((row) => {
    const basis = row.calculationBasis ?? {};
    return `<tr><td>${esc(row.productId)}</td><td>${esc(row.cycleId)}</td><td>${esc(row.locationId)}</td><td>${fmt(row.equivalentAlternatingStressMpa, 6)}</td><td>${Number.isFinite(row.permissibleCycles) ? esc(row.permissibleCycles) : '—'}</td><td>${esc(basis.code || '—')}</td><td>${esc(basis.edition || '—')}</td><td>${esc(basis.calculationRef || '—')}</td><td>${esc(basis.checkedBy || '—')}</td></tr>`;
  }).join('');
}

export function serializeHpPipingClassEngineeringReviewReportHtml(report) {
  if (report?.schemaVersion !== HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION) throw new TypeError('Unsupported HP engineering-review report schema.');
  const embedded = JSON.stringify(report).replaceAll('<', '\\u003c');
  const s = report.reviewSummary ?? {};
  const b = report.classBasis ?? {};
  const spectrum = report.transient?.spectrum ?? {};
  const ids = report.sourceContracts?.calculationIds ?? {};
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.identity.classId)} ${esc(report.identity.revision)} — HP Piping Class Engineering Review</title>
<style>
:root{font-family:Arial,Helvetica,sans-serif;color:#172033;background:#fff}*{box-sizing:border-box}body{margin:0;padding:28px;line-height:1.4}.page{max-width:1280px;margin:auto}.banner{border:2px solid #9a3412;background:#fff7ed;padding:14px 18px;margin:0 0 18px;font-weight:700}.muted{color:#586477}.grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px}.card{border:1px solid #cbd5e1;border-radius:8px;padding:12px}.card small{display:block;color:#64748b}.card strong{display:block;margin-top:3px;font-size:1.08rem}h1{margin:0 0 4px;font-size:1.8rem}h2{margin:28px 0 10px;border-bottom:2px solid #cbd5e1;padding-bottom:5px}h3{margin:18px 0 8px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 7px;text-align:left;vertical-align:top}th{background:#f1f5f9}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.warn{background:#fffbeb;border:1px solid #f59e0b;padding:10px 12px}.limitations li{margin:4px 0}@media(max-width:800px){body{padding:14px}.grid{grid-template-columns:repeat(2,minmax(120px,1fr))}}@media print{body{padding:0}.page{max-width:none}.table-wrap{overflow:visible}table{font-size:10px}h2{break-after:avoid}tr{break-inside:avoid}.no-print{display:none}}
</style></head><body><main class="page">
<header><h1>HP Piping Class — Engineering Review Report</h1><div class="muted">${esc(report.identity.projectId)} · ${esc(report.identity.classId)} · revision ${esc(report.identity.revision)}</div></header>
<div class="banner">REVIEW ONLY · NO DESIGN AUTHORITY · Native CORE KD-3 / KD320 not qualified · Code compliance not established</div>
<section class="grid">
<div class="card"><small>Project state</small><strong>${esc(s.projectState || '—')}</strong></div>
<div class="card"><small>Products</small><strong>${esc(s.totalProducts ?? report.productResults.length)}</strong></div>
<div class="card"><small>Static reference fails</small><strong>${esc(s.staticReferenceFailed ?? 0)}</strong></div>
<div class="card"><small>Fatigue U &gt; 1</small><strong>${esc(s.fatigueExceedsUnity ?? 0)}</strong></div>
<div class="card"><small>Highest review priority</small><strong>${esc(s.highestReviewPriority || '—')}</strong></div>
<div class="card"><small>Priority product</small><strong>${esc(s.highestReviewPriorityProductId || '—')}</strong></div>
<div class="card"><small>B31.3 edition</small><strong>${esc(report.method.b313Edition || '—')}</strong></div>
<div class="card"><small>VIII-3 edition</small><strong>${esc(report.method.viii3Edition || '—')}</strong></div>
</section>
<h2>1. Basis, method and authority</h2>
<div class="table-wrap"><table><tbody>
<tr><th>Calculation mode</th><td class="mono">${esc(report.method.calculationMode)}</td><th>Design pressure</th><td>${fmt(b.designPressureMpa)} MPa</td></tr>
<tr><th>Internal allowance</th><td>${fmt(b.internalAllowanceMm)} mm</td><th>External allowance</th><td>${fmt(b.externalAllowanceMm)} mm</td></tr>
<tr><th>Spectrum</th><td>${esc(spectrum?.spectrumId || '—')}</td><th>Design life</th><td>${Number.isFinite(spectrum?.designLifeYears) ? `${esc(spectrum.designLifeYears)} years` : '—'}</td></tr>
<tr><th>Orchestrator</th><td class="mono">${esc(report.sourceContracts.orchestratorVersion)}</td><th>Result contract</th><td class="mono">${esc(report.sourceContracts.resultExportVersion)}</td></tr>
<tr><th>Static direct ID</th><td class="mono">${esc(ids.staticDirect || '—')}</td><th>Wall-state ID</th><td class="mono">${esc(ids.wallState || '—')}</td></tr>
<tr><th>Fatigue review ID</th><td class="mono">${esc(ids.fatigue || '—')}</td><th>Basis resolver ID</th><td class="mono">${esc(ids.basis || '—')}</td></tr>
</tbody></table></div>
<div class="warn" style="margin-top:10px">${esc(s.priorityDisclaimer)}</div>
<h2>2. Product engineering-input basis</h2><div class="table-wrap"><table><thead><tr><th>Product</th><th>Nominal size</th><th>Basis mode</th><th>OD mm</th><th>S MPa</th><th>Nominal wall mm</th><th>Minus tol %</th><th>Fatigue wall basis</th><th>Measured wall mm</th><th>Future internal loss</th><th>Future external loss</th><th>Custody</th></tr></thead><tbody>${inputRowsHtml(report)}</tbody></table></div>
<h2>3. Product review matrix</h2><div class="table-wrap"><table><thead><tr><th>Product</th><th>Priority</th><th>Static</th><th>Req. nominal mm</th><th>P-rating MPa</th><th>P-rating margin</th><th>Fatigue wall basis</th><th>Fatigue wall mm</th><th>U</th><th>Governing cycle</th><th>State</th></tr></thead><tbody>${productRowsHtml(report)}</tbody></table></div>
<h2>4. Operating states and governed cycles</h2><h3>Operating states</h3><div class="table-wrap"><table><thead><tr><th>State</th><th>Pressure MPa</th><th>Material °C</th><th>Structural °C</th></tr></thead><tbody>${stateRowsHtml(report)}</tbody></table></div>
<h3>Governed cycles</h3><div class="table-wrap"><table><thead><tr><th>Cycle</th><th>From</th><th>To</th><th>Lifetime n</th><th>Cycles/year</th><th>Category</th><th>Provenance</th></tr></thead><tbody>${transitionRowsHtml(report)}</tbody></table></div>
<h2>5. Pressure-cycle fatigue result ledger</h2><div class="table-wrap"><table><thead><tr><th>Product</th><th>Cycle</th><th>State pair</th><th>ΔP MPa</th><th>CORE Salt MPa</th><th>User Salt MPa</th><th>External Seq MPa</th><th>External N</th><th>n</th><th>Ui</th><th>Evidence status</th></tr></thead><tbody>${cycleRowsHtml(report)}</tbody></table></div>
<h2>6. External KD-3 custody</h2><div class="table-wrap"><table><thead><tr><th>Product</th><th>Cycle</th><th>Location</th><th>Seq MPa</th><th>N</th><th>Code</th><th>Edition</th><th>Calculation ref</th><th>Checked by</th></tr></thead><tbody>${custodyRowsHtml(report)}</tbody></table></div>
<h2>7. Advisories and warnings</h2>${report.advisories.length ? `<ul>${report.advisories.map((row) => `<li><span class="mono">${esc(row.code)}</span> · ${esc(row.scope)} · ${esc(row.message)}</li>`).join('')}</ul>` : '<p>No calculation warnings or advisories were returned.</p>'}
<h2>8. Limitations</h2><ul class="limitations">${report.limitations.map((row) => `<li>${esc(row)}</li>`).join('')}</ul>
<p class="muted">This standalone HTML embeds the complete machine-readable report JSON below for audit/replay.</p>
<script type="application/json" id="hp-engineering-review-report-data">${embedded}</script>
</main></body></html>\n`;
}
