import { calculateEngineering } from '../engineering-calculations/index.js';
import {
  B313_MATERIAL_FACTOR_MASTER,
  normalizeB313MaterialFamily,
  resolveB313DesignFactors,
  resolveB313MaterialIdentity,
} from '../b313-material-factors/index.js';
import { selectPipeWallForCalculation } from '../pipe-wall-master/index.js';

export const B313_PREVIEW_NEGATIVE_MILL_TOLERANCE_PCT = 12.5;
export const B313_PREVIEW_WALL_UPDATE_SCHEMA = 'xml-cii-b313-preview-wall-update/v1';
export const B313_PREVIEW_MATERIAL_FACTOR_SCHEMA = 'xml-cii-b313-preview-material-factor-basis/v1';

const STRICT_FACTOR_STATUSES = new Set(['VERIFIED', 'PROJECT_APPROVED']);

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizedToken(value) {
  return text(value).toUpperCase().replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function positive(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegative(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function failure(code, message, details = {}) {
  return { ok: false, code, message, schema: B313_PREVIEW_WALL_UPDATE_SCHEMA, details };
}

function inferredFamily(value) {
  const direct = normalizeB313MaterialFamily(value);
  if (direct) return direct;
  const token = normalizedToken(value);
  if (!token) return null;
  if (/^(?:LT\s*CS|LTCS|LOW TEMPERATURE CARBON STEEL)(?:\s+SOUR)?$/.test(token)) return 'LTCS';
  if (/^(?:SDSS|SUPER DUPLEX(?: SS)?|SUPER DUPLEX STAINLESS STEEL)$/.test(token)) return 'SDSS';
  if (/^(?:DSS|DUPLEX(?: SS)?|DUPLEX STAINLESS STEEL)$/.test(token)) return 'DSS';
  if (/^(?:SS|STAINLESS(?: STEEL)?)(?:\s+(?:304|316))?$/.test(token)) return 'SS';
  if (/^(?:CS|CARBON STEEL)(?:\s+SOUR)?$/.test(token)) return 'CS';
  return null;
}

function materialTokenVariants(value) {
  const token = text(value);
  if (!token) return [];
  const withoutAstM = token.replace(/^ASTM\s+/i, '');
  const firstHyphenAsSpace = withoutAstM.replace(/^(A\d{3})-/, '$1 ');
  return [...new Set([
    token,
    withoutAstM,
    /^A\d{3}[\s-]/i.test(withoutAstM) ? `ASTM ${withoutAstM}` : '',
    firstHyphenAsSpace,
    /^A\d{3}\s/i.test(firstHyphenAsSpace) ? `ASTM ${firstHyphenAsSpace}` : '',
  ].map(text).filter(Boolean))];
}

function resolveMaterialToken(value, { allowProjectFamilyDefault = true } = {}) {
  const token = text(value);
  if (!token) return failure('B313_PREVIEW_MATERIAL_REQUIRED', 'Preview material is required.');

  let lastExactFailure = null;
  for (const variant of materialTokenVariants(token)) {
    const exact = resolveB313MaterialIdentity({ material: { spec: variant } });
    if (exact.ok) {
      return {
        ...exact,
        schema: B313_PREVIEW_MATERIAL_FACTOR_SCHEMA,
        requestMode: 'EXACT_PREVIEW_MATERIAL',
        requestedMaterial: token,
        matchedMaterialVariant: variant,
      };
    }
    lastExactFailure = exact;
  }

  const family = inferredFamily(token);
  if (!family) {
    return failure('B313_PREVIEW_MATERIAL_NOT_MAPPED', 'Preview material does not map to a B31.3 project material identity.', {
      requestedMaterial: token,
      resolverFailure: lastExactFailure,
    });
  }

  const familyResult = resolveB313MaterialIdentity({
    material: { family },
    allowProjectFamilyDefault,
  });
  if (!familyResult.ok) {
    return failure(
      familyResult.code === 'B313_MATERIAL_AMBIGUOUS' ? 'B313_PREVIEW_MATERIAL_AMBIGUOUS' : 'B313_PREVIEW_MATERIAL_NOT_MAPPED',
      familyResult.message || 'Preview material family could not be resolved to one B31.3 project identity.',
      { requestedMaterial: token, family, resolverFailure: familyResult },
    );
  }

  return {
    ...familyResult,
    schema: B313_PREVIEW_MATERIAL_FACTOR_SCHEMA,
    requestMode: 'PROJECT_FAMILY_DEFAULT',
    requestedMaterial: token,
    requestedFamily: family,
  };
}

/**
 * Resolves the effective Phase-4 Preview Material column to the merged B31.3
 * material-factor catalog. The Preview material is primary authority. A strong,
 * already-reviewed material-code matched designation may corroborate or
 * disambiguate it, but never silently override a conflicting material identity.
 */
export function resolvePreviewB313MaterialIdentity({
  material,
  materialSource = '',
  corroboratingMaterial = '',
  corroboratingSource = '',
  corroboratingNeedsReview = false,
} = {}) {
  const primary = resolveMaterialToken(material, { allowProjectFamilyDefault: true });
  const corroboratingText = text(corroboratingMaterial);
  const corroborationEligible = !!corroboratingText && corroboratingNeedsReview !== true;
  const corroborating = corroborationEligible
    ? resolveMaterialToken(corroboratingText, { allowProjectFamilyDefault: false })
    : null;

  if (corroborationEligible && !corroborating?.ok) {
    if (primary.ok && primary.requestMode === 'EXACT_PREVIEW_MATERIAL' && normalizedToken(material) === normalizedToken(corroboratingText)) {
      return {
        ...primary,
        resolutionSource: 'PREVIEW_MATERIAL',
        materialSource: text(materialSource),
        corroboratingMaterial: corroboratingText,
        corroboratingSource: text(corroboratingSource),
        corroborationStatus: 'TEXT_EQUIVALENT',
      };
    }
    return failure('B313_PREVIEW_MATERIAL_CORROBORATION_UNRESOLVED', 'Reviewed material-code evidence is not represented in the active B31.3 material catalog.', {
      previewMaterial: text(material),
      previewMaterialSource: text(materialSource),
      corroboratingMaterial: corroboratingText,
      corroboratingSource: text(corroboratingSource),
      primary,
      corroborating,
    });
  }

  if (primary.ok && corroborating?.ok && primary.material.materialId !== corroborating.material.materialId) {
    return failure('B313_PREVIEW_MATERIAL_CONFLICT', 'Preview Material and reviewed material-code evidence resolve to different B31.3 material identities.', {
      previewMaterial: text(material),
      previewMaterialSource: text(materialSource),
      primaryMaterialId: primary.material.materialId,
      corroboratingMaterial: corroboratingText,
      corroboratingSource: text(corroboratingSource),
      corroboratingMaterialId: corroborating.material.materialId,
    });
  }

  if (primary.ok) {
    return {
      ...primary,
      resolutionSource: 'PREVIEW_MATERIAL',
      materialSource: text(materialSource),
      corroboratingMaterial: corroboratingText,
      corroboratingSource: text(corroboratingSource),
      corroborationStatus: corroborating?.ok ? 'MATCHED' : (corroboratingText ? 'NOT_USED_REVIEW_REQUIRED' : 'NONE'),
    };
  }

  if (corroborating?.ok) {
    return {
      ...corroborating,
      resolutionSource: 'PREVIEW_MATERIAL_CODE_CORROBORATION',
      materialSource: text(materialSource),
      unresolvedPreviewMaterial: text(material),
      unresolvedPreviewMaterialResult: primary,
      corroboratingMaterial: corroboratingText,
      corroboratingSource: text(corroboratingSource),
      corroborationStatus: 'DISAMBIGUATED',
    };
  }

  return failure(primary.code || 'B313_PREVIEW_MATERIAL_NOT_MAPPED', primary.message || 'Preview material could not be resolved to a B31.3 project identity.', {
    previewMaterial: text(material),
    previewMaterialSource: text(materialSource),
    primary,
    corroboratingMaterial: corroboratingText,
    corroboratingSource: text(corroboratingSource),
    corroboratingNeedsReview: corroboratingNeedsReview === true,
  });
}

function manualFactorValidation(basis = {}) {
  const missing = [];
  if (!positive(basis.allowableStress)) missing.push('S allowableStress');
  if (!text(basis.stressUnit)) missing.push('S unit');
  if (!positive(basis.qualityFactorE) || Number(basis.qualityFactorE) > 1) missing.push('E qualityFactorE');
  if (!positive(basis.weldStrengthReductionW) || Number(basis.weldStrengthReductionW) > 1) missing.push('W weldStrengthReductionW');
  const y = nonNegative(basis.coefficientY);
  if (y === null || y > 1) missing.push('Y coefficientY');
  if (!text(basis.sourceReference)) missing.push('controlled source reference');
  return { ok: missing.length === 0, missing };
}

function uniqueSortedNumbers(values) {
  return [...new Set(values.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
}

function uniqueText(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function factorAvailability(factor, materialId, designTemperatureC, manufacturingRoute) {
  const records = Array.isArray(B313_MATERIAL_FACTOR_MASTER?.factors?.[factor]?.records)
    ? B313_MATERIAL_FACTOR_MASTER.factors[factor].records
    : [];
  const materialRows = records.filter((row) => row.materialId === materialId);
  const exactTemperatureRows = materialRows.filter((row) => Math.abs(Number(row.temperatureC) - designTemperatureC) <= 1e-9);
  const routeSensitive = exactTemperatureRows.some((row) => text(row.manufacturingRoute));
  const requestedRoute = text(manufacturingRoute) || (materialId === 'CS-A106-B' ? 'SEAMLESS' : '');
  let applicableRows = exactTemperatureRows;
  if (routeSensitive) {
    if (requestedRoute) {
      const specific = exactTemperatureRows.filter((row) => normalizedToken(row.manufacturingRoute) === normalizedToken(requestedRoute));
      const generic = exactTemperatureRows.filter((row) => !text(row.manufacturingRoute));
      applicableRows = specific.length ? specific : generic;
    } else {
      applicableRows = exactTemperatureRows.filter((row) => !text(row.manufacturingRoute));
    }
  }
  const strictRows = applicableRows.filter((row) => STRICT_FACTOR_STATUSES.has(text(row.status).toUpperCase()));
  const rejectedRows = applicableRows.filter((row) => !STRICT_FACTOR_STATUSES.has(text(row.status).toUpperCase()));
  let status = 'STRICT_AVAILABLE';
  if (!strictRows.length) {
    if (!exactTemperatureRows.length) status = 'NO_EXACT_TEMPERATURE_RECORD';
    else if (routeSensitive && !requestedRoute && !applicableRows.length) status = 'MANUFACTURING_ROUTE_REQUIRED';
    else if (routeSensitive && requestedRoute && !applicableRows.length) status = 'MANUFACTURING_ROUTE_NO_MATCH';
    else if (rejectedRows.length) status = 'QUALIFICATION_STATUS_REJECTED';
    else status = 'STRICT_RECORD_UNAVAILABLE';
  }
  return {
    factor,
    status,
    strictAvailable: strictRows.length > 0,
    materialRecordCount: materialRows.length,
    exactTemperatureRecordCount: exactTemperatureRows.length,
    applicableRecordCount: applicableRows.length,
    availableTemperaturesC: uniqueSortedNumbers(materialRows.map((row) => row.temperatureC)),
    requestedManufacturingRoute: requestedRoute,
    availableManufacturingRoutes: uniqueText(exactTemperatureRows.map((row) => row.manufacturingRoute)),
    candidateStatuses: uniqueText(exactTemperatureRows.map((row) => row.status)),
    rejectedStatuses: uniqueText(rejectedRows.map((row) => row.status)),
    candidateAuthorities: uniqueText(exactTemperatureRows.map((row) => row.sourceAuthority || row.basisId)),
  };
}

export function explainPreviewB313FactorAvailability({ materialId, designTemperatureC, manufacturingRoute = '' } = {}) {
  const temperature = Number(designTemperatureC);
  if (!text(materialId) || !Number.isFinite(temperature)) return null;
  const factors = Object.fromEntries(['S', 'E', 'W', 'Y'].map((factor) => [
    factor,
    factorAvailability(factor, text(materialId), temperature, manufacturingRoute),
  ]));
  return {
    materialId: text(materialId),
    designTemperatureC: temperature,
    requestedManufacturingRoute: text(manufacturingRoute),
    strictAcceptedStatuses: [...STRICT_FACTOR_STATUSES],
    factors,
  };
}

/**
 * Active, strict B31.3 Material Factors are always tried first. Manual Preview
 * factors are a fail-closed fallback only when the active catalog is incomplete;
 * BENCHMARK_ONLY data is never enabled by this adapter.
 */
export function resolvePreviewB313FactorBasis({
  materialIdentity,
  designTemperatureC,
  manufacturingRoute = '',
  manualBasis = {},
} = {}) {
  if (!materialIdentity?.ok || !materialIdentity?.material?.materialId) {
    return failure('B313_PREVIEW_MATERIAL_IDENTITY_REQUIRED', 'A resolved B31.3 material identity is required before design factors can be selected.', { materialIdentity });
  }
  const temperature = Number(designTemperatureC);
  if (!Number.isFinite(temperature)) {
    return failure('B313_PREVIEW_T1_REQUIRED', 'Preview T1 must be a finite design temperature in °C.');
  }

  const materialId = materialIdentity.material.materialId;
  const factorAvailability = explainPreviewB313FactorAvailability({
    materialId,
    designTemperatureC: temperature,
    manufacturingRoute,
  });
  const strict = resolveB313DesignFactors({
    material: { materialId },
    designTemperature: temperature,
    temperatureUnit: 'C',
    manufacturingRoute: text(manufacturingRoute) || undefined,
    qualificationMode: 'strict',
  });

  if (strict.ok) {
    return {
      ok: true,
      code: 'B313_PREVIEW_FACTORS_FROM_ACTIVE_MASTER',
      schema: B313_PREVIEW_MATERIAL_FACTOR_SCHEMA,
      mode: 'ACTIVE_MASTER_STRICT',
      materialIdentity,
      designTemperatureC: temperature,
      allowableStress: strict.factors.allowableStressMPa,
      stressUnit: 'MPa',
      qualityFactorE: strict.factors.qualityFactorE,
      weldStrengthReductionW: strict.factors.weldStrengthReductionW,
      coefficientY: strict.factors.coefficientY,
      factorSources: strict.factorSources,
      factorAvailability,
      designAuthority: strict.designAuthority === true,
      strictResult: strict,
      manualBasisStatus: 'IGNORED_ACTIVE_MASTER_AVAILABLE',
    };
  }

  const manual = manualFactorValidation(manualBasis);
  if (!manual.ok) {
    return failure('B313_PREVIEW_FACTOR_BASIS_UNAVAILABLE', 'Active B31.3 Material Factors are incomplete at Preview T1 and the explicit fallback basis is incomplete.', {
      materialId,
      designTemperatureC: temperature,
      manufacturingRoute: text(manufacturingRoute),
      strictResult: strict,
      factorAvailability,
      manualMissing: manual.missing,
    });
  }

  return {
    ok: true,
    code: 'B313_PREVIEW_FACTORS_FROM_MANUAL_FALLBACK',
    schema: B313_PREVIEW_MATERIAL_FACTOR_SCHEMA,
    mode: 'MANUAL_EXPLICIT_FALLBACK',
    materialIdentity,
    designTemperatureC: temperature,
    allowableStress: Number(manualBasis.allowableStress),
    stressUnit: text(manualBasis.stressUnit),
    qualityFactorE: Number(manualBasis.qualityFactorE),
    weldStrengthReductionW: Number(manualBasis.weldStrengthReductionW),
    coefficientY: Number(manualBasis.coefficientY),
    sourceReference: text(manualBasis.sourceReference),
    factorSources: {
      S: { authority: 'PREVIEW_MANUAL_FALLBACK', sourceReference: text(manualBasis.sourceReference) },
      E: { authority: 'PREVIEW_MANUAL_FALLBACK', sourceReference: text(manualBasis.sourceReference) },
      W: { authority: 'PREVIEW_MANUAL_FALLBACK', sourceReference: text(manualBasis.sourceReference) },
      Y: { authority: 'PREVIEW_MANUAL_FALLBACK', sourceReference: text(manualBasis.sourceReference) },
    },
    factorAvailability,
    designAuthority: false,
    strictResult: strict,
    manualBasisStatus: 'USED_ACTIVE_MASTER_INCOMPLETE',
  };
}

export function calculateAndSelectPreviewB313Wall({
  dn,
  outsideDiameterMm,
  designPressure,
  pressureUnit,
  corrosionAllowanceMm,
  allowableStress,
  stressUnit,
  qualityFactorE,
  weldStrengthReductionW,
  coefficientY,
  dimensionStandard,
  edition = '2024',
} = {}) {
  const normalizedDn = positive(dn);
  const normalizedOd = positive(outsideDiameterMm);
  const normalizedPressure = positive(designPressure);
  const normalizedCorrosion = nonNegative(corrosionAllowanceMm);
  const normalizedAllowableStress = positive(allowableStress);
  const normalizedE = positive(qualityFactorE);
  const normalizedW = positive(weldStrengthReductionW);
  const normalizedY = nonNegative(coefficientY);

  if (!normalizedDn) return failure('B313_PREVIEW_DN_REQUIRED', 'Preview DN must be a positive number.');
  if (!normalizedOd) return failure('B313_PREVIEW_OD_REQUIRED', 'Preview outside diameter must be a positive number.');
  if (!normalizedPressure) return failure('B313_PREVIEW_PRESSURE_REQUIRED', 'Preview design pressure must be a positive number.');
  if (normalizedCorrosion === null) return failure('B313_PREVIEW_CORROSION_REQUIRED', 'Preview corrosion allowance must be a non-negative number.');
  if (!String(pressureUnit || '').trim()) return failure('B313_PREVIEW_PRESSURE_UNIT_REQUIRED', 'Design-pressure unit is required.');
  if (!normalizedAllowableStress) return failure('B313_PREVIEW_ALLOWABLE_STRESS_REQUIRED', 'Allowable stress S must be a positive number.');
  if (!String(stressUnit || '').trim()) return failure('B313_PREVIEW_STRESS_UNIT_REQUIRED', 'Allowable-stress unit is required.');
  if (!normalizedE || normalizedE > 1) return failure('B313_PREVIEW_QUALITY_FACTOR_E_REQUIRED', 'Quality factor E must be > 0 and <= 1.');
  if (!normalizedW || normalizedW > 1) return failure('B313_PREVIEW_WELD_FACTOR_W_REQUIRED', 'Weld strength reduction factor W must be > 0 and <= 1.');
  if (normalizedY === null || normalizedY > 1) return failure('B313_PREVIEW_COEFFICIENT_Y_REQUIRED', 'Coefficient Y must be >= 0 and <= 1.');
  if (!String(dimensionStandard || '').trim()) return failure('B313_PREVIEW_DIMENSION_STANDARD_REQUIRED', 'Pipe dimension standard is required.');

  const engineeringResult = calculateEngineering({
    calculationId: 'PIPE.B313.THICKNESS',
    inputs: {
      designPressure: normalizedPressure,
      outsideDiameter: normalizedOd,
      allowableStress: normalizedAllowableStress,
      qualityFactorE: normalizedE,
      weldStrengthReductionW: normalizedW,
      coefficientY: normalizedY,
      corrosionAllowance: normalizedCorrosion,
      negativeMillTolerance: {
        basis: 'percent',
        value: B313_PREVIEW_NEGATIVE_MILL_TOLERANCE_PCT,
      },
    },
    inputUnits: {
      designPressure: String(pressureUnit),
      outsideDiameter: 'mm',
      allowableStress: String(stressUnit),
      corrosionAllowance: 'mm',
    },
    options: { includeEvidence: true },
  });

  if (!engineeringResult?.ok) {
    const first = engineeringResult?.errors?.[0] || {};
    return failure('B313_PREVIEW_CALCULATION_FAILED', first.message || first.code || 'Central B31.3 thickness calculation failed.', { engineeringResult });
  }
  const calculation = engineeringResult?.evidence?.domainResult;
  if (!calculation?.ok) {
    return failure('B313_PREVIEW_CALCULATION_FAILED', 'Central B31.3 calculation did not return a domain result.', { engineeringResult, calculation });
  }

  const selection = selectPipeWallForCalculation({
    dimensionStandard,
    dn: normalizedDn,
    calculation,
  });
  if (!selection.ok) {
    return failure('B313_PREVIEW_WALL_SELECTION_FAILED', selection.message || selection.code, { calculation, selection });
  }

  return {
    ok: true,
    code: 'B313_PREVIEW_WALL_SELECTED',
    schema: B313_PREVIEW_WALL_UPDATE_SCHEMA,
    dn: normalizedDn,
    outsideDiameterMm: normalizedOd,
    designPressure: normalizedPressure,
    pressureUnit: String(pressureUnit),
    corrosionAllowanceMm: normalizedCorrosion,
    negativeMillTolerancePct: B313_PREVIEW_NEGATIVE_MILL_TOLERANCE_PCT,
    dimensionStandard: selection.selected.dimensionStandard,
    calculation,
    engineeringCalculation: {
      calculationId: engineeringResult.calculationId || 'PIPE.B313.THICKNESS',
      contractVersion: engineeringResult.contractVersion || '',
      qualification: engineeringResult.qualification || null,
      provenance: engineeringResult.provenance || null,
    },
    selection,
    selectedNominalWallMm: selection.selected.nominalWallMm,
    selectedSchedule: selection.selected.schedule,
    equivalentSchedules: selection.selected.equivalentSchedules,
    selectionMarginMm: selection.selected.marginMm,
    authority: 'EXPLICIT_PREVIEW_ACTION_NOT_AUTOMATIC_WALL_AUTHORITY',
  };
}
