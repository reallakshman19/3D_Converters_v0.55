import {
  B313_MATERIAL_FACTOR_MASTER,
  resolveB313DesignFactors,
} from '../b313-material-factors/index.js';

const FACTORS = Object.freeze(['S', 'E', 'W', 'Y']);

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function norm(value) {
  return text(value).toUpperCase().replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function effectiveRoute(materialId, manufacturingRoute) {
  return text(manufacturingRoute) || (materialId === 'CS-A106-B' ? 'SEAMLESS' : '');
}

function candidateRows(factor, materialId, manufacturingRoute) {
  const rows = Array.isArray(B313_MATERIAL_FACTOR_MASTER?.factors?.[factor]?.records)
    ? B313_MATERIAL_FACTOR_MASTER.factors[factor].records
    : [];
  const materialRows = rows.filter((row) => row?.materialId === materialId);
  const hasRouteSensitiveRows = materialRows.some((row) => text(row?.manufacturingRoute));
  if (!hasRouteSensitiveRows) return materialRows;
  const route = text(manufacturingRoute);
  if (!route) return materialRows.filter((row) => !text(row?.manufacturingRoute));
  return materialRows.filter((row) => !text(row?.manufacturingRoute) || norm(row.manufacturingRoute) === norm(route));
}

function temperatures(rows) {
  return [...new Set(rows.map((row) => finite(row?.temperatureC)).filter((value) => value !== null))].sort((a, b) => a - b);
}

function commonTemperatures(materialId, manufacturingRoute) {
  const sets = FACTORS.map((factor) => new Set(temperatures(candidateRows(factor, materialId, manufacturingRoute))));
  if (sets.some((set) => set.size === 0)) return [];
  return [...sets[0]].filter((temperature) => sets.slice(1).every((set) => set.has(temperature))).sort((a, b) => a - b);
}

function selectSeedTemperature(common, designTemperatureC) {
  const atOrAbove = common.filter((temperature) => temperature >= designTemperatureC);
  if (atOrAbove.length) return { temperatureC: atOrAbove[0], direction: 'AT_OR_ABOVE_T1' };
  const below = common.filter((temperature) => temperature < designTemperatureC);
  if (below.length) return { temperatureC: below[below.length - 1], direction: 'NEAREST_BELOW_NO_HIGHER_COMMON_POINT' };
  return null;
}

function factorEvidence(source, factor) {
  if (!source) return null;
  return {
    factor,
    temperatureC: finite(source.temperatureC),
    value: finite(source.value),
    unit: text(source.unit),
    status: text(source.status),
    sourceAuthority: text(source.sourceAuthority || source.authority || source.basisId),
    manufacturingRoute: text(source.manufacturingRoute),
    productForm: text(source.productForm),
  };
}

export function suggestPreviewB313FallbackBasis({ materialIdentity, designTemperatureC, manufacturingRoute = '' } = {}) {
  const materialId = text(materialIdentity?.material?.materialId || materialIdentity?.materialId);
  const requestedTemperatureC = finite(designTemperatureC);
  if (!materialId || requestedTemperatureC === null) {
    return {
      ok: false,
      code: 'B313_PREVIEW_FALLBACK_SEED_INPUT_REQUIRED',
      message: 'A resolved material identity and finite Preview T1 are required before a fallback seed can be proposed.',
    };
  }

  const route = effectiveRoute(materialId, manufacturingRoute);
  const common = commonTemperatures(materialId, route);
  const selected = selectSeedTemperature(common, requestedTemperatureC);
  if (!selected) {
    return {
      ok: false,
      code: 'B313_PREVIEW_FALLBACK_SEED_UNAVAILABLE',
      materialId,
      designTemperatureC: requestedTemperatureC,
      manufacturingRoute: route,
      commonTemperaturesC: common,
      message: 'No common active-master S/E/W/Y candidate temperature is available for a controlled fallback seed.',
    };
  }

  const resolved = resolveB313DesignFactors({
    material: { materialId },
    designTemperature: selected.temperatureC,
    temperatureUnit: 'C',
    manufacturingRoute: route || undefined,
    qualificationMode: 'screening',
  });
  if (!resolved?.ok) {
    return {
      ok: false,
      code: 'B313_PREVIEW_FALLBACK_SEED_RESOLUTION_FAILED',
      materialId,
      designTemperatureC: requestedTemperatureC,
      seedTemperatureC: selected.temperatureC,
      manufacturingRoute: route,
      commonTemperaturesC: common,
      resolverResult: resolved,
      message: resolved?.message || 'The selected common candidate temperature did not resolve a complete S/E/W/Y set.',
    };
  }

  const evidence = Object.fromEntries(FACTORS.map((factor) => [factor, factorEvidence(resolved.factorSources?.[factor], factor)]));
  const statuses = [...new Set(FACTORS.map((factor) => evidence[factor]?.status).filter(Boolean))];
  const authorities = [...new Set(FACTORS.map((factor) => evidence[factor]?.sourceAuthority).filter(Boolean))];
  const sourceReference = [
    'B313_ACTIVE_MASTER_CANDIDATE_SEED',
    materialId,
    `T1=${requestedTemperatureC}C`,
    `SEED_T=${selected.temperatureC}C`,
    route ? `ROUTE=${route}` : '',
    statuses.length ? `STATUS=${statuses.join('+')}` : '',
  ].filter(Boolean).join(' | ');

  return {
    ok: true,
    code: 'B313_PREVIEW_FALLBACK_SEED_AVAILABLE',
    materialId,
    designTemperatureC: requestedTemperatureC,
    seedTemperatureC: selected.temperatureC,
    selectionDirection: selected.direction,
    selectionPolicy: 'COMMON_S_E_W_Y_AT_OR_ABOVE_T1_THEN_NEAREST_BELOW_NO_INTERPOLATION',
    commonTemperaturesC: common,
    manufacturingRoute: route,
    allowableStress: resolved.factors.allowableStressMPa,
    stressUnit: 'MPa',
    qualityFactorE: resolved.factors.qualityFactorE,
    weldStrengthReductionW: resolved.factors.weldStrengthReductionW,
    coefficientY: resolved.factors.coefficientY,
    factorSources: evidence,
    candidateStatuses: statuses,
    candidateAuthorities: authorities,
    sourceReference,
    designAuthority: false,
    qualificationMode: resolved.qualificationMode,
  };
}
