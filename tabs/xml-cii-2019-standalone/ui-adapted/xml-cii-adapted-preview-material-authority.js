import { DEFAULT_MATERIAL_MAP_ROWS } from '../../../converters/xml-cii2019-core/default-material-map-rows.js';
import {
  normalizeXmlCiiMaterialIdentity,
  resolveXmlCiiMaterialCodeFromMap,
} from '../../../converters/xml-cii2019-core/material-code-fuzzy-resolver.js';
import {
  resolveConfiguredMaterialCode,
  resolveConfiguredMaterialCodeByMaterial,
} from '../../../converters/xml-cii2019-core/piping-class-material-code-resolver.js?v=20260930-issue781-material-category-1';
import { computeLineNoKey, normalizeLineListRow } from '../../../converters/xml-cii2019-core/linelist-mapping.js';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalKey(value) {
  return text(value).toUpperCase().replace(/\s+/g, '');
}

function classKey(row) {
  const pipingClass = normalKey(row?.pipingClass || row?.pipingClassDerived || row?.resolvedPipingClass);
  return pipingClass ? `PC:${pipingClass}` : '';
}

function classSizeKey(row) {
  const key = classKey(row);
  const bore = Number(row?.sizeMm ?? text(row?.size).replace(/[^0-9.+-]/g, ''));
  return key && Number.isFinite(bore) && bore > 0 ? `${key}|DN:${Math.round(bore)}` : key;
}

function overrideRecord(config, row) {
  const bucket = config?.overrides?.materialCode;
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return null;
  const keys = [...new Set([
    row?.materialCodeKey,
    classSizeKey(row),
    classKey(row),
    row?.lineKey,
    row?.branchName,
    row?.material,
  ].map(text).filter(Boolean))];
  for (const key of keys) {
    const value = text(bucket[key]);
    if (value) return { key, value };
  }
  return null;
}

function materialScopedOverride(record, material) {
  if (!record?.key || !material) return false;
  const identity = normalizeXmlCiiMaterialIdentity(material);
  const key = normalKey(record.key).replace(/^MAT(?:ERIAL)?:/, '');
  return key === normalKey(material)
    || key === identity.compact
    || key === normalKey(identity.canonical);
}

function displayMethod(method) {
  if (
    method === 'exact'
    || method === 'designation-exact'
    || method === 'known-alias'
    || method === 'material-category-exact'
    || method === 'rating-prefix-family-exact'
    || method === 'rating-prefix-family-normalized'
  ) return 'exact';
  if (method === 'ambiguous') return 'ambiguous';
  if (method === 'none' || method === 'below-threshold') return 'none';
  return 'fuzzy';
}

function lineKeyAliases(value) {
  const compact = normalKey(value);
  if (!compact) return [];
  return [...new Set([
    compact,
    compact.replace(/^[A-Z](?=\d{5,}$)/, ''),
  ].filter(Boolean))];
}

function lineListMaterialValue(raw, normalized) {
  return text(
    normalized.material
    || raw?.material
    || raw?.Material
    || raw?.MATERIAL
    || raw?.MOC
    || raw?.['Material Name']
    || raw?.Material_Name,
  );
}

export function buildPreviewMaterialLineListIndex(config = {}) {
  const rows = Array.isArray(config?.linelist?.masterRows) ? config.linelist.masterRows : [];
  const fieldMap = config?.linelist?.fieldMap || {};
  const index = new Map();
  rows.forEach((raw, sourceIndex) => {
    const normalized = normalizeLineListRow(raw, fieldMap, sourceIndex);
    const key = computeLineNoKey(raw, fieldMap) || normalized.lineKey;
    const record = { sourceIndex, material: lineListMaterialValue(raw, normalized) };
    for (const alias of lineKeyAliases(key)) if (!index.has(alias)) index.set(alias, record);
  });
  return index;
}

function processLineListMaterial(row, config, context = {}) {
  const direct = text(row?.processMaterial || row?.lineListMaterial);
  if (direct) return direct;
  const aliases = [...lineKeyAliases(row?.lineKey), ...lineKeyAliases(row?.lineKeyProposed)];
  if (!aliases.length) return '';
  const index = context.lineListIndex || buildPreviewMaterialLineListIndex(config);
  let match = null;
  for (const alias of aliases) {
    const candidate = index.get(alias);
    if (candidate && (!match || candidate.sourceIndex < match.sourceIndex)) match = candidate;
  }
  return match?.material || '';
}

function manualMaterial(row) {
  const source = text(row?.materialSource).toLowerCase();
  return source.includes('override') ? text(row?.material) : '';
}

function nonClassMaterial(row) {
  const material = text(row?.material);
  const source = text(row?.materialSource).toLowerCase();
  if (!material || source.includes('piping-class')) return '';
  return material;
}

function unresolvedMaterialResult({ material, resolved, override }) {
  if (material) {
    return {
      material,
      materialSource: 'process-linelist-material',
      materialCode: '',
      materialCodeSource: 'process-material-unresolved',
      materialCodeMethod: displayMethod(resolved?.method || 'none'),
      materialCodeResolutionMethod: resolved?.method || 'none',
      materialCodeConfidence: resolved?.confidence || 0,
      materialCodeNeedsReview: true,
      materialCodeConflict: override ? {
        overrideCode: override.value,
        resolvedCode: '',
        overrideKey: override.key,
      } : null,
      materialCodeMatchedMaterial: resolved?.matchedMaterial || '',
      materialCodeMatchReasons: resolved?.reasons || [],
      materialCodeCandidates: resolved?.candidates || [],
    };
  }
  if (override) {
    return {
      material: '',
      materialSource: 'material-code-override',
      materialCode: override.value,
      materialCodeSource: 'override-unvalidated',
      materialCodeMethod: 'override',
      materialCodeResolutionMethod: 'none',
      materialCodeConfidence: 0,
      materialCodeNeedsReview: true,
      materialCodeConflict: null,
      materialCodeMatchedMaterial: '',
      materialCodeMatchReasons: [],
      materialCodeCandidates: [],
    };
  }
  return {
    material: '',
    materialSource: 'unresolved',
    materialCode: '',
    materialCodeSource: 'unresolved',
    materialCodeMethod: 'none',
    materialCodeResolutionMethod: 'none',
    materialCodeConfidence: 0,
    materialCodeNeedsReview: true,
    materialCodeConflict: null,
    materialCodeMatchedMaterial: '',
    materialCodeMatchReasons: [],
    materialCodeCandidates: [],
  };
}

function resolveMaterialMap(processMaterial, materialRows, fuzzyConfig, cache) {
  if (!cache) return resolveXmlCiiMaterialCodeFromMap(processMaterial, materialRows, fuzzyConfig);
  if (!cache.has(processMaterial)) {
    cache.set(processMaterial, resolveXmlCiiMaterialCodeFromMap(processMaterial, materialRows, fuzzyConfig));
  }
  return cache.get(processMaterial);
}

function configuredMaterialReasons(configured) {
  return [
    `configured-material-category-${text(configured?.materialCategory)}`,
    `configured-unique-code-${text(configured?.materialCode)}`,
    `configured-matched-rows-${Number(configured?.matchedRowCount || 0)}`,
  ];
}

export function resolvePreviewMaterialCodeAuthority(row, config = {}, context = {}) {
  const processMaterial = manualMaterial(row) || processLineListMaterial(row, config, context) || nonClassMaterial(row);
  const materialRows = Array.isArray(config?.material?.mapRows) && config.material.mapRows.length
    ? config.material.mapRows
    : DEFAULT_MATERIAL_MAP_ROWS;
  const fuzzyConfig = config?.materialCodeFuzzy || config?.material?.fuzzy || {};
  const override = overrideRecord(config, { ...row, material: processMaterial || row?.material });

  if (processMaterial) {
    const configured = resolveConfiguredMaterialCodeByMaterial({ material: processMaterial, config });
    const resolved = configured ? null : resolveMaterialMap(processMaterial, materialRows, fuzzyConfig, context.materialResolutionCache);
    const configuredConfidence = configured ? Number(configured.confidence) / 100 : 0;
    const governedCode = text(configured?.materialCode || resolved?.materialCode);
    const governedConfidence = configured ? configuredConfidence : Number(resolved?.confidence || 0);
    const governedMethod = configured?.method || resolved?.method || 'none';
    const governedMatchedMaterial = text(configured?.materialName || resolved?.matchedMaterial);
    const pinnedOverride = materialScopedOverride(override, processMaterial);

    if (override && pinnedOverride) {
      const conflict = !!governedCode && governedCode !== override.value;
      return {
        material: processMaterial,
        materialSource: manualMaterial(row) ? 'override' : 'process-linelist-material',
        materialCode: override.value,
        materialCodeSource: conflict ? 'material-scoped-override-conflict' : 'material-scoped-override',
        materialCodeMethod: 'override',
        materialCodeResolutionMethod: governedMethod,
        materialCodeConfidence: conflict ? governedConfidence : 1,
        materialCodeNeedsReview: conflict,
        materialCodeConflict: conflict ? { overrideCode: override.value, resolvedCode: governedCode, overrideKey: override.key } : null,
        materialCodeMatchedMaterial: governedMatchedMaterial,
        materialCodeMatchReasons: configured ? configuredMaterialReasons(configured) : (resolved?.reasons || []),
        materialCodeCandidates: configured ? [] : (resolved?.candidates || []),
      };
    }

    if (configured) {
      const conflictingOverride = override && override.value !== configured.materialCode;
      return {
        material: processMaterial,
        materialSource: manualMaterial(row) ? 'override' : 'process-linelist-material',
        materialCode: configured.materialCode,
        materialCodeSource: conflictingOverride ? 'material-evidence-corrected' : 'process-material-config-map',
        materialCodeMethod: 'exact',
        materialCodeResolutionMethod: configured.method,
        materialCodeConfidence: configuredConfidence,
        materialCodeNeedsReview: false,
        materialCodeConflict: conflictingOverride ? {
          overrideCode: override.value,
          resolvedCode: configured.materialCode,
          overrideKey: override.key,
        } : null,
        materialCodeMatchedMaterial: configured.materialName,
        materialCodeMatchReasons: configuredMaterialReasons(configured),
        materialCodeCandidates: [],
      };
    }

    const strongThreshold = Number.isFinite(Number(fuzzyConfig.overrideConflictThreshold))
      ? Number(fuzzyConfig.overrideConflictThreshold)
      : 0.92;
    const strong = !!resolved?.materialCode && resolved.confidence >= strongThreshold && !resolved.ambiguous;
    if (strong) {
      const conflictingOverride = override && override.value !== resolved.materialCode;
      return {
        material: processMaterial,
        materialSource: manualMaterial(row) ? 'override' : 'process-linelist-material',
        materialCode: resolved.materialCode,
        materialCodeSource: conflictingOverride ? 'material-evidence-corrected' : 'process-material-map',
        materialCodeMethod: displayMethod(resolved.method),
        materialCodeResolutionMethod: resolved.method,
        materialCodeConfidence: resolved.confidence,
        materialCodeNeedsReview: false,
        materialCodeConflict: conflictingOverride ? {
          overrideCode: override.value,
          resolvedCode: resolved.materialCode,
          overrideKey: override.key,
        } : null,
        materialCodeMatchedMaterial: resolved.matchedMaterial || '',
        materialCodeMatchReasons: resolved.reasons || [],
        materialCodeCandidates: resolved.candidates || [],
      };
    }

    return unresolvedMaterialResult({ material: processMaterial, resolved, override });
  }

  if (override) {
    return unresolvedMaterialResult({ material: '', resolved: null, override });
  }

  const pipingClass = text(row?.pipingClass || row?.pipingClassDerived || row?.resolvedPipingClass);
  const fallback = resolveConfiguredMaterialCode({ pipingClass, config });
  if (fallback) {
    const exact = ['exact', 'normalized-suffix', 'rating-prefix-family-exact', 'rating-prefix-family-normalized'].includes(fallback.method);
    return {
      material: text(fallback.materialName),
      materialSource: 'piping-class-fallback',
      materialCode: text(fallback.materialCode),
      materialCodeSource: 'piping-class-fallback',
      materialCodeMethod: displayMethod(fallback.method),
      materialCodeResolutionMethod: fallback.method,
      materialCodeConfidence: Number(fallback.confidence) / 100,
      materialCodeNeedsReview: !exact,
      materialCodeConflict: null,
      materialCodeMatchedMaterial: text(fallback.materialName),
      materialCodeMatchReasons: [
        fallback.ratingPrefix ? `rating-prefix-${fallback.ratingPrefix}` : '',
        fallback.materialFamily ? `material-family-${fallback.materialFamily}` : '',
      ].filter(Boolean),
      materialCodeCandidates: [],
    };
  }

  return unresolvedMaterialResult({ material: '', resolved: null, override: null });
}

export function applyPreviewMaterialCodeAuthority({ config = {}, result } = {}) {
  const branchRows = Array.isArray(result?.branchRows) ? result.branchRows : [];
  if (!branchRows.length) return result || { branchRows: [], nodeRows: [] };
  const context = {
    lineListIndex: buildPreviewMaterialLineListIndex(config),
    materialResolutionCache: new Map(),
  };
  return {
    ...(result || {}),
    branchRows: branchRows.map((row) => ({
      ...row,
      ...resolvePreviewMaterialCodeAuthority(row, config, context),
    })),
  };
}
