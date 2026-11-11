import {
  resolvePreviewB313FactorBasis,
} from '../../../converters/xml-cii2019-core/b313-preview-wall-update.js?v=20260928-issue776-authority-1';
import {
  suggestPreviewB313FallbackBasis,
} from '../../../converters/xml-cii2019-core/b313-preview-fallback-seed.js?v=20260930-issue781-fallback-seed-1';
import {
  previewB313BasisKey,
  resolvePreviewB313MaterialFromRow,
} from './xml-cii-adapted-preview-b313-wall-update.js?v=20261001-weight-output-2';

export const B313_PREVIEW_AUTO_BASIS_SCHEMA = 'xml-cii-b313-preview-auto-basis/v2';

const FACTORS = ['S', 'E', 'W', 'Y'];

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function esc(value) {
  return text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function finite(value) {
  if (value === null || value === undefined || text(value) === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function temperatureText(row) {
  return text(row?.t1 ?? row?.designTemperature ?? '');
}

function storedBasisForRow(config, row, materialId, t1) {
  const bases = config?.b313WallUpdate?.bases;
  if (!bases || typeof bases !== 'object' || Array.isArray(bases)) return {};
  const key = previewB313BasisKey(row);
  if (key && bases[key] && typeof bases[key] === 'object') return bases[key];
  return Object.values(bases).find((basis) => (
    basis
    && typeof basis === 'object'
    && text(basis.materialId) === text(materialId)
    && text(basis.designTemperature) === text(t1)
  )) || {};
}

function factorAvailabilityFrom(factorBasis) {
  return factorBasis?.factorAvailability
    || factorBasis?.details?.factorAvailability
    || null;
}

function routeFromAvailability(availability) {
  if (!availability?.factors) return '';
  for (const factor of ['E', 'W', 'S', 'Y']) {
    const route = text(availability.factors[factor]?.requestedManufacturingRoute);
    if (route) return route;
  }
  return '';
}

function factorStatus(availability) {
  if (!availability?.factors) return { code: 'DATA_MISSING', label: 'DATA MISSING' };
  const rows = FACTORS.map((factor) => availability.factors[factor]).filter(Boolean);
  if (rows.length === FACTORS.length && rows.every((item) => item.strictAvailable === true)) {
    return { code: 'AUTO_READY', label: 'AUTO READY ✓' };
  }
  const hasCandidate = rows.some((item) => Array.isArray(item.candidateStatuses) && item.candidateStatuses.length > 0);
  const hasRejected = rows.some((item) => item.status === 'QUALIFICATION_STATUS_REJECTED');
  if (hasCandidate || hasRejected) return { code: 'REVIEW_REQUIRED', label: 'REVIEW REQUIRED' };
  return { code: 'DATA_MISSING', label: 'DATA MISSING' };
}

function unavailableFactorSummary(availability) {
  if (!availability?.factors) return 'S/E/W/Y unavailable';
  return FACTORS.map((factor) => {
    const item = availability.factors[factor];
    if (!item) return `${factor} unavailable`;
    if (item.strictAvailable) return `${factor} STRICT`;
    const statuses = Array.isArray(item.candidateStatuses)
      ? item.candidateStatuses.filter(Boolean).join('/')
      : '';
    return `${factor} ${statuses || item.status || 'unavailable'}`;
  }).join(' · ');
}

function strictFactorSummary(factorBasis) {
  return `S ${Number(factorBasis.allowableStress).toPrecision(6)} ${text(factorBasis.stressUnit)} · E ${factorBasis.qualityFactorE} · W ${factorBasis.weldStrengthReductionW} · Y ${factorBasis.coefficientY}`;
}

function fallbackFactorSummary(fallback, accepted = false) {
  if (!fallback?.ok) return '';
  const prefix = accepted ? 'CONTROLLED FALLBACK' : `CANDIDATE SEED @ ${fallback.seedTemperatureC} °C`;
  return `${prefix}: S ${Number(fallback.allowableStress).toPrecision(6)} ${text(fallback.stressUnit)} · E ${fallback.qualityFactorE} · W ${fallback.weldStrengthReductionW} · Y ${fallback.coefficientY}`;
}

function storedValue(stored, key, fallback) {
  return text(stored?.[key]) !== '' ? stored[key] : fallback;
}

function fallbackFromStoredOrSeed(storedBasis, seed) {
  if (!seed?.ok && !Object.keys(storedBasis || {}).length) return null;
  const fallback = seed?.ok ? { ...seed } : {
    ok: true,
    code: 'B313_PREVIEW_STORED_FALLBACK',
    seedTemperatureC: finite(storedBasis?.fallbackSeedTemperatureC),
    factorSources: storedBasis?.fallbackSeedEvidence || {},
    sourceReference: text(storedBasis?.sourceReference),
  };
  fallback.allowableStress = storedValue(storedBasis, 'allowableStress', fallback.allowableStress);
  fallback.stressUnit = storedValue(storedBasis, 'stressUnit', fallback.stressUnit || 'MPa');
  fallback.qualityFactorE = storedValue(storedBasis, 'qualityFactorE', fallback.qualityFactorE);
  fallback.weldStrengthReductionW = storedValue(storedBasis, 'weldStrengthReductionW', fallback.weldStrengthReductionW);
  fallback.coefficientY = storedValue(storedBasis, 'coefficientY', fallback.coefficientY);
  fallback.sourceReference = text(storedBasis?.sourceReference || fallback.sourceReference);
  fallback.factorSources = storedBasis?.fallbackSeedEvidence || fallback.factorSources || {};
  fallback.seedTemperatureC = finite(storedBasis?.fallbackSeedTemperatureC) ?? fallback.seedTemperatureC;
  fallback.accepted = text(storedBasis?.sourceReference).startsWith('USER_ACCEPTED_PREVIEW_FALLBACK');
  return fallback;
}

export function derivePreviewB313AutoBasisRow(row, config = {}) {
  const material = text(row?.material || row?.materialName || row?.resolvedMaterial || row?.materialCode || '');
  const materialSource = text(row?.materialSource || '');
  const t1 = temperatureText(row);
  const materialIdentity = resolvePreviewB313MaterialFromRow(row);
  const basisKey = previewB313BasisKey(row);

  if (!materialIdentity?.ok) {
    return {
      schema: B313_PREVIEW_AUTO_BASIS_SCHEMA,
      basisKey,
      material,
      materialSource,
      t1,
      materialId: '',
      identityCode: materialIdentity?.code || 'B313_PREVIEW_MATERIAL_NOT_MAPPED',
      statusCode: 'MATERIAL_UNRESOLVED',
      statusLabel: 'MATERIAL UNRESOLVED',
      factorSummary: '',
      route: '',
      routeSource: 'unresolved',
      factorBasis: null,
      fallback: null,
      tableContext: null,
    };
  }

  const materialId = text(materialIdentity.material?.materialId);
  const storedBasis = storedBasisForRow(config, row, materialId, t1);
  const explicitRoute = text(storedBasis.manufacturingRoute);

  if (!t1) {
    const defaultRoute = materialId === 'CS-A106-B' ? 'SEAMLESS' : '';
    return {
      schema: B313_PREVIEW_AUTO_BASIS_SCHEMA,
      basisKey,
      material,
      materialSource,
      t1,
      materialId,
      identityCode: materialIdentity.code,
      statusCode: 'B313_PREVIEW_T1_REQUIRED',
      statusLabel: 'T1 REQUIRED',
      factorSummary: 'S/E/W/Y not evaluated until Preview T1 is resolved',
      route: explicitRoute || defaultRoute,
      routeSource: explicitRoute
        ? 'controlled Preview basis'
        : defaultRoute
          ? 'A106 carbon-steel default'
          : 'unresolved',
      factorBasis: null,
      fallback: null,
      tableContext: { materialId, temperatureC: undefined },
    };
  }

  const factorBasis = resolvePreviewB313FactorBasis({
    materialIdentity,
    designTemperatureC: t1,
    manufacturingRoute: explicitRoute,
    manualBasis: storedBasis,
  });
  const availability = factorAvailabilityFrom(factorBasis);
  const defaultRoute = routeFromAvailability(availability)
    || (materialId === 'CS-A106-B' ? 'SEAMLESS' : '');
  const route = explicitRoute || defaultRoute;
  const routeSource = explicitRoute
    ? 'controlled Preview basis'
    : materialId === 'CS-A106-B' && route === 'SEAMLESS'
      ? 'A106 carbon-steel default'
      : route
        ? 'active factor master'
        : 'unresolved';

  const strictReady = factorBasis?.ok && factorBasis.mode === 'ACTIVE_MASTER_STRICT';
  const storedFallbackReady = factorBasis?.ok && factorBasis.mode === 'MANUAL_EXPLICIT_FALLBACK';
  const seed = strictReady ? null : suggestPreviewB313FallbackBasis({
    materialIdentity,
    designTemperatureC: t1,
    manufacturingRoute: route,
  });
  const fallback = strictReady ? null : fallbackFromStoredOrSeed(storedBasis, seed);
  const status = strictReady
    ? { code: 'AUTO_READY', label: 'AUTO READY ✓' }
    : storedFallbackReady
      ? { code: 'CONTROLLED_FALLBACK_READY', label: 'CONTROLLED FALLBACK READY' }
      : fallback?.ok
        ? { code: 'FALLBACK_SEED_READY', label: 'FALLBACK SEED — REFRESH TO ACCEPT' }
        : factorStatus(availability);

  return {
    schema: B313_PREVIEW_AUTO_BASIS_SCHEMA,
    basisKey,
    material,
    materialSource,
    t1,
    materialId,
    identityCode: materialIdentity.code,
    factorBasisCode: factorBasis?.code || '',
    statusCode: status.code,
    statusLabel: status.label,
    factorSummary: strictReady
      ? strictFactorSummary(factorBasis)
      : storedFallbackReady && fallback?.ok
        ? fallbackFactorSummary(fallback, true)
        : fallback?.ok
          ? fallbackFactorSummary(fallback, false)
          : unavailableFactorSummary(availability),
    route,
    routeSource,
    factorBasis,
    fallback,
    tableContext: {
      materialId,
      temperatureC: Number.isFinite(Number(t1)) ? Number(t1) : undefined,
    },
  };
}

export function buildPreviewB313AutoBasisRows(rows = [], config = {}) {
  const unique = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue;
    const model = derivePreviewB313AutoBasisRow(row, config);
    const key = model.basisKey || `${model.materialId || model.material}|T1=${model.t1 || '?'}|ROUTE=${model.route || '?'}`;
    if (!unique.has(key)) unique.set(key, model);
  }
  return [...unique.values()];
}

function statusColor(model) {
  if (model.statusCode === 'AUTO_READY') return '#86efac';
  if (model.statusCode === 'CONTROLLED_FALLBACK_READY') return '#93c5fd';
  if (model.statusCode === 'FALLBACK_SEED_READY' || model.statusCode === 'REVIEW_REQUIRED') return '#fbbf24';
  return '#fca5a5';
}

function sourceInfo(model, factor) {
  const source = model.fallback?.factorSources?.[factor] || model.factorBasis?.factorSources?.[factor] || null;
  if (!source) return `${factor}: no candidate source record is available.`;
  const parts = [
    `${factor} source`,
    finite(source.temperatureC) !== null ? `T=${source.temperatureC} °C` : '',
    text(source.status) ? `status=${source.status}` : '',
    text(source.sourceAuthority || source.authority) ? `authority=${text(source.sourceAuthority || source.authority)}` : '',
    text(source.manufacturingRoute) ? `route=${source.manufacturingRoute}` : '',
    text(source.productForm) ? `form=${source.productForm}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function infoButton(model, factor) {
  return `<span style="position:relative;display:inline-flex;align-items:center;gap:3px;"><button type="button" data-b313-factor-info-button="${factor}" aria-label="${factor} source info" title="${esc(sourceInfo(model, factor))}" style="width:18px;height:18px;padding:0;border:1px solid #64748b;border-radius:50%;background:#111827;color:#93c5fd;cursor:pointer;font-size:11px;line-height:16px;">i</button><span data-b313-factor-info="${factor}" hidden style="position:absolute;z-index:30;left:20px;top:0;min-width:260px;max-width:360px;padding:7px 8px;border:1px solid #475569;border-radius:6px;background:#020617;color:#e2e8f0;box-shadow:0 8px 24px rgba(0,0,0,.4);font-size:10px;white-space:normal;">${esc(sourceInfo(model, factor))}</span></span>`;
}

function fallbackInputCell(model, factor, field, options = {}) {
  const fallback = model.fallback;
  if (!fallback?.ok) return '<span style="color:#64748b;">—</span>';
  const value = fallback[field] ?? '';
  const min = options.min ?? '';
  const max = options.max ?? '';
  const step = options.step ?? 'any';
  return `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap;"><input data-b313-auto-field="${field}" type="number" step="${step}" ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''} value="${esc(value)}" style="width:${options.width || '68px'};background:#020617;color:#e2e8f0;border:1px solid #475569;border-radius:4px;padding:3px 4px;">${infoButton(model, factor)}</div>`;
}

function stressUnitCell(model) {
  if (!model.fallback?.ok) return '<span style="color:#64748b;">—</span>';
  const current = text(model.fallback.stressUnit || 'MPa').toUpperCase();
  return `<select data-b313-auto-field="stressUnit" style="background:#020617;color:#e2e8f0;border:1px solid #475569;border-radius:4px;padding:3px 4px;">${['MPa','ksi','psi'].map((unit) => `<option value="${unit}" ${current === unit.toUpperCase() ? 'selected' : ''}>${unit}</option>`).join('')}</select>`;
}

function panelHtml(models) {
  const rowsHtml = models.map((model) => {
    const source = model.materialSource ? `source ${esc(model.materialSource)}` : 'source unknown';
    const t1 = model.t1 ? `${esc(model.t1)} °C` : 'unresolved';
    const route = model.route || '—';
    const routeSource = model.routeSource || 'unresolved';
    const iconDisabled = model.tableContext?.materialId ? '' : 'disabled';
    const seedHint = model.fallback?.ok && model.statusCode !== 'CONTROLLED_FALLBACK_READY'
      ? `<div style="font-size:9px;color:#fbbf24;margin-top:2px;">Seed ${esc(model.fallback.seedTemperatureC)} °C · ${esc(model.fallback.selectionDirection || '')} · no interpolation</div>`
      : '';
    const refreshDisabled = model.fallback?.ok ? '' : 'disabled';
    return `<tr data-b313-auto-key="${esc(model.basisKey)}" data-b313-auto-material-id="${esc(model.tableContext?.materialId || '')}" data-b313-auto-temperature="${esc(model.tableContext?.temperatureC ?? '')}">
      <td style="padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top;"><strong>${esc(model.material || '—')}</strong><div style="font-size:10px;color:#94a3b8;">${source} · T1 ${t1}</div></td>
      <td style="padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top;min-width:210px;"><strong>${esc(model.materialId || model.identityCode)}</strong><div data-b313-auto-status style="font-size:10px;color:${statusColor(model)};font-weight:700;">${esc(model.statusLabel)}</div><div style="font-size:10px;color:#cbd5e1;">${esc(model.factorSummary)}</div>${seedHint}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top;"><strong>${esc(route)}</strong><div style="font-size:10px;color:#94a3b8;">${esc(routeSource)}</div></td>
      <td style="padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top;">${fallbackInputCell(model, 'S', 'allowableStress', { width: '82px' })}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top;">${stressUnitCell(model)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top;">${fallbackInputCell(model, 'E', 'qualityFactorE', { min: 0, max: 1 })}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top;">${fallbackInputCell(model, 'W', 'weldStrengthReductionW', { min: 0, max: 1 })}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top;">${fallbackInputCell(model, 'Y', 'coefficientY', { min: 0, max: 1 })}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #334155;text-align:center;vertical-align:middle;white-space:nowrap;"><button type="button" data-b313-auto-refresh ${refreshDisabled} aria-label="Accept current fallback and recalculate" title="Accept current fallback values and recalculate B31.3 wall" style="width:24px;height:24px;padding:0;border:1px solid #64748b;border-radius:4px;background:#111827;color:#fbbf24;cursor:pointer;font-size:16px;line-height:22px;">↻</button> <button type="button" data-b313-auto-open-material ${iconDisabled} aria-label="Open B31.3 Material Factors table" title="Open B31.3 Material Factors table" style="width:24px;height:24px;padding:0;border:1px solid #64748b;border-radius:4px;background:#111827;color:#e2e8f0;cursor:pointer;font-size:14px;line-height:22px;">▦</button></td>
    </tr>`;
  }).join('');

  return `<div data-mc-b313-auto-basis-panel style="margin:8px 0;border:1px solid #475569;border-radius:6px;background:#0f172a;color:#e2e8f0;padding:8px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;"><strong>B31.3 automatic basis</strong><span style="font-size:10px;color:#94a3b8;">${models.length} material-temperature group${models.length === 1 ? '' : 's'}</span></div>
    <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">Primary path remains strict VERIFIED / PROJECT_APPROVED factors at Preview T1. When exact strict factors are unavailable, S/E/W/Y below are a non-interpolated controlled fallback seed from one common active-master temperature. Values do not become calculation input until ↻ is clicked. A106 carbon steel defaults to SEAMLESS.</div>
    <div style="overflow:auto;"><table style="border-collapse:collapse;width:100%;font-size:11px;min-width:1180px;"><thead><tr><th style="text-align:left;padding:5px;">Preview Material / T1</th><th style="text-align:left;padding:5px;">B31.3 identity / status</th><th style="text-align:left;padding:5px;">Route</th><th style="text-align:left;padding:5px;">Fallback S</th><th style="text-align:left;padding:5px;">S unit</th><th style="text-align:left;padding:5px;">E</th><th style="text-align:left;padding:5px;">W</th><th style="text-align:left;padding:5px;">Y</th><th style="text-align:center;padding:5px;">Recalc / Table</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
  </div>`;
}

function bindInfoPopups(panel) {
  panel?.querySelectorAll?.('[data-b313-factor-info-button]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const row = button.closest('[data-b313-auto-key]');
    const factor = button.dataset.b313FactorInfoButton;
    const popup = row?.querySelector?.(`[data-b313-factor-info="${factor}"]`);
    if (!popup) return;
    row.querySelectorAll?.('[data-b313-factor-info]').forEach((node) => { if (node !== popup) node.hidden = true; });
    popup.hidden = !popup.hidden;
  }));
}

function bindTableLinks(panel) {
  panel?.querySelectorAll?.('[data-b313-auto-open-material]').forEach((button) => button.addEventListener('click', () => {
    const rowEl = button.closest('[data-b313-auto-material-id]');
    const materialId = text(rowEl?.dataset?.b313AutoMaterialId);
    const rawTemperature = text(rowEl?.dataset?.b313AutoTemperature);
    const temperatureC = rawTemperature === '' ? undefined : Number(rawTemperature);
    if (!materialId || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('app:switch-tab', {
      detail: {
        tabId: 'b313-material-factors',
        context: {
          materialId,
          temperatureC: Number.isFinite(temperatureC) ? temperatureC : undefined,
        },
      },
    }));
  }));
}

function ensureBasisBucket(config) {
  if (!config.b313WallUpdate || typeof config.b313WallUpdate !== 'object' || Array.isArray(config.b313WallUpdate)) config.b313WallUpdate = {};
  if (!config.b313WallUpdate.bases || typeof config.b313WallUpdate.bases !== 'object' || Array.isArray(config.b313WallUpdate.bases)) config.b313WallUpdate.bases = {};
  return config.b313WallUpdate.bases;
}

function numericField(rowEl, field) {
  const raw = text(rowEl?.querySelector?.(`[data-b313-auto-field="${field}"]`)?.value);
  const value = Number(raw);
  return raw !== '' && Number.isFinite(value) ? value : null;
}

function validateFallbackRecord(record) {
  return record.allowableStress > 0
    && record.qualityFactorE > 0 && record.qualityFactorE <= 1
    && record.weldStrengthReductionW > 0 && record.weldStrengthReductionW <= 1
    && record.coefficientY >= 0 && record.coefficientY <= 1
    && text(record.stressUnit);
}

function bindRefresh(panel, host, config, models, options) {
  const byKey = new Map(models.map((model) => [text(model.basisKey), model]));
  panel?.querySelectorAll?.('[data-b313-auto-refresh]').forEach((button) => button.addEventListener('click', async () => {
    const rowEl = button.closest('[data-b313-auto-key]');
    const key = text(rowEl?.dataset?.b313AutoKey);
    const model = byKey.get(key);
    if (!model?.fallback?.ok || !key) return;

    const record = {
      material: model.material,
      materialId: model.materialId,
      designTemperature: model.t1,
      manufacturingRoute: model.route,
      allowableStress: numericField(rowEl, 'allowableStress'),
      stressUnit: text(rowEl?.querySelector?.('[data-b313-auto-field="stressUnit"]')?.value || model.fallback.stressUnit),
      qualityFactorE: numericField(rowEl, 'qualityFactorE'),
      weldStrengthReductionW: numericField(rowEl, 'weldStrengthReductionW'),
      coefficientY: numericField(rowEl, 'coefficientY'),
      fallbackSeedTemperatureC: model.fallback.seedTemperatureC,
      fallbackSeedEvidence: model.fallback.factorSources || {},
      sourceReference: `USER_ACCEPTED_PREVIEW_FALLBACK | ${text(model.fallback.sourceReference || `B313_ACTIVE_MASTER_CANDIDATE_SEED | ${model.materialId}`)}`,
    };
    const status = rowEl.querySelector?.('[data-b313-auto-status]');
    if (!validateFallbackRecord(record)) {
      if (status) {
        status.textContent = 'INVALID FALLBACK VALUES';
        status.style.color = '#fca5a5';
      }
      return;
    }

    button.disabled = true;
    try {
      ensureBasisBucket(config)[key] = record;
      await options?.onSaveConfigPreservePreview?.(config);
      if (status) {
        status.textContent = 'CONTROLLED FALLBACK ACCEPTED — RECALCULATING';
        status.style.color = '#93c5fd';
      }
      const wallButton = host?.querySelector?.('[data-mc-b313-wall-update]');
      wallButton?.click?.();
    } finally {
      button.disabled = false;
    }
  }));
}

function applyT1Guard(host, models) {
  const button = host?.querySelector?.('[data-mc-b313-wall-update]');
  if (!button) return;
  const hasMissingT1 = models.some((model) => model.statusCode === 'B313_PREVIEW_T1_REQUIRED');
  if (hasMissingT1) {
    if (!button.dataset.mcB313AutoBasisOriginalTitle) button.dataset.mcB313AutoBasisOriginalTitle = button.title || '';
    button.dataset.mcB313AutoBasisT1Guard = 'true';
    button.disabled = true;
    button.title = 'Resolve Preview T1 before running the B31.3 wall update. Blank T1 is never treated as 0 °C.';
    return;
  }
  if (button.dataset.mcB313AutoBasisT1Guard === 'true') {
    button.disabled = false;
    button.title = button.dataset.mcB313AutoBasisOriginalTitle || button.title;
    delete button.dataset.mcB313AutoBasisT1Guard;
  }
}

function watchLivePreviewRows({ host, config, rows, options }) {
  host.__xmlCiiB313AutoBasisObserver?.disconnect?.();
  let scheduled = false;
  let renderedResult = null;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const liveResult = host.__xmlCiiPreviewResult;
      const currentRows = Array.isArray(liveResult?.branchRows) ? liveResult.branchRows : rows;
      const panel = host.querySelector?.('[data-mc-b313-auto-basis-panel]');
      if (!currentRows.length) {
        panel?.remove?.();
        renderedResult = liveResult;
        return;
      }
      if (!host.querySelector?.('[data-mc-b313-wall-update]')) return;
      const legacyEditor = host.querySelector?.('[data-mc-b313-basis-editor]');
      if (renderedResult === liveResult && panel && (!legacyEditor || legacyEditor.hidden)) return;
      installPreviewB313AutoBasisPanel({ host, config, rows: currentRows, options, watchLive: false });
      renderedResult = liveResult;
    });
  };
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(refresh);
    observer.observe(host, { childList: true, subtree: true });
    host.__xmlCiiB313AutoBasisObserver = observer;
  }
  refresh();
}

export function installPreviewB313AutoBasisPanel({ host, config, rows = [], options = {}, watchLive = true } = {}) {
  if (!host) return [];
  if (watchLive) watchLivePreviewRows({ host, config, rows, options });
  const models = buildPreviewB313AutoBasisRows(rows, config);
  const legacyEditor = host.querySelector?.('[data-mc-b313-basis-editor]');
  if (legacyEditor) {
    legacyEditor.hidden = true;
    legacyEditor.style.display = 'none';
    legacyEditor.dataset.mcB313AutoBasisReplaced = 'true';
  }

  host.querySelector?.('[data-mc-b313-auto-basis-panel]')?.remove?.();
  if (models.length) {
    if (legacyEditor) legacyEditor.insertAdjacentHTML('afterend', panelHtml(models));
    else {
      const actionBar = host.querySelector?.('[data-mc-preview-build]')?.parentElement;
      actionBar?.parentElement?.insertAdjacentHTML?.('afterend', panelHtml(models));
    }
    const panel = host.querySelector?.('[data-mc-b313-auto-basis-panel]');
    bindTableLinks(panel);
    bindInfoPopups(panel);
    bindRefresh(panel, host, config, models, options);
  }
  applyT1Guard(host, models);
  return models;
}
