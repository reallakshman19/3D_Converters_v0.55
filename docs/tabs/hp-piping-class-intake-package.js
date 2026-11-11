import {
  HP_PIPING_CLASS_AUTHORITY_POLICY,
  createHpPipingClassProject,
  validateHpPipingClassProject,
} from '../converters/b313-chapter-ix/hp-piping-class-project.js';
import {
  HP_PIPING_CLASS_PRODUCT_BULK_HEADERS,
  applyHpPipingClassProductBulkInput,
} from './hp-piping-class-product-bulk-input.js';
import {
  HP_PIPING_CLASS_STATE_BULK_HEADERS,
  HP_PIPING_CLASS_CYCLE_BULK_HEADERS,
  applyHpPipingClassTransientBulkInput,
} from './hp-piping-class-transient-bulk-input.js';
import {
  HP_PIPING_CLASS_KD_BULK_HEADERS,
  applyHpPipingClassKdBulkInput,
} from './hp-piping-class-kd-bulk-input.js';

export const HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION = 'hp-piping-class-intake-package/v1';

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'calculationMode',
  'nativeCoreKd3Qualified',
  'codeCompliance',
  'canUseForDesignAuthority',
  'engineeringAuthority',
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? '').trim();
}

function issue(code, message, details = {}) {
  return Object.freeze({ code, message, details });
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function scanForbiddenAuthority(value, path = '', issues = []) {
  if (!value || typeof value !== 'object') return issues;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenAuthority(item, `${path}[${index}]`, issues));
    return issues;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_AUTHORITY_KEYS.has(key)) {
      issues.push(issue(
        'INTAKE_PACKAGE_AUTHORITY_FIELD_FORBIDDEN',
        `${childPath} is not accepted from an intake package; review-only authority is fixed by CORE.`,
        { path: childPath },
      ));
    }
    scanForbiddenAuthority(child, childPath, issues);
  }
  return issues;
}

function parseSource(source, issues) {
  if (source && typeof source === 'object' && !Array.isArray(source)) return clone(source);
  const raw = String(source ?? '').trim();
  if (!raw) {
    issues.push(issue('INTAKE_PACKAGE_REQUIRED', 'Load or paste an HP class intake package before validation.'));
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('root must be an object');
    return parsed;
  } catch (error) {
    issues.push(issue('INTAKE_PACKAGE_JSON_INVALID', `HP class intake package is not valid JSON: ${error.message}`));
    return null;
  }
}

function escapeCell(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

function tableText(section, expectedHeaders, label, issues) {
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    issues.push(issue('INTAKE_PACKAGE_TABLE_REQUIRED', `${label} table is required.`, { table: label }));
    return '';
  }
  const headers = section.headers;
  const rows = section.rows;
  if (!Array.isArray(headers) || headers.length !== expectedHeaders.length
      || headers.some((value, index) => text(value) !== expectedHeaders[index])) {
    issues.push(issue(
      'INTAKE_PACKAGE_TABLE_HEADER_MISMATCH',
      `${label} headers must be exactly: ${expectedHeaders.join(',')}.`,
      { table: label },
    ));
    return '';
  }
  if (!Array.isArray(rows) || !rows.length) {
    issues.push(issue('INTAKE_PACKAGE_TABLE_ROWS_REQUIRED', `${label} must contain at least one row.`, { table: label }));
    return '';
  }
  const lines = [expectedHeaders.join(',')];
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== expectedHeaders.length) {
      issues.push(issue(
        'INTAKE_PACKAGE_TABLE_ROW_SHAPE_INVALID',
        `${label} row ${index + 1} must contain exactly ${expectedHeaders.length} cells.`,
        { table: label, rowNumber: index + 1 },
      ));
      return;
    }
    lines.push(row.map(escapeCell).join(','));
  });
  return lines.join('\n');
}

function packageIdentity(pkg, issues) {
  if (pkg?.schemaVersion !== HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION) {
    issues.push(issue(
      'INTAKE_PACKAGE_VERSION_UNSUPPORTED',
      `schemaVersion must be ${HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION}.`,
    ));
  }
  const metadata = pkg?.metadata ?? {};
  for (const field of ['projectId', 'classId', 'revision']) {
    if (!text(metadata[field])) issues.push(issue('INTAKE_PACKAGE_METADATA_REQUIRED', `metadata.${field} is required.`, { field }));
  }
  const method = pkg?.method ?? {};
  if (!text(method.b313Edition)) issues.push(issue('INTAKE_PACKAGE_METHOD_REQUIRED', 'method.b313Edition is required.'));
  const classBasis = pkg?.classBasis ?? {};
  if (!finite(classBasis.designPressureMpa) || !(classBasis.designPressureMpa > 0)) {
    issues.push(issue('INTAKE_PACKAGE_DESIGN_PRESSURE_INVALID', 'classBasis.designPressureMpa must be finite and > 0 MPa.'));
  }
  const spectrum = pkg?.spectrum ?? {};
  if (!text(spectrum.spectrumId)) issues.push(issue('INTAKE_PACKAGE_SPECTRUM_ID_REQUIRED', 'spectrum.spectrumId is required.'));
  if (spectrum.designLifeYears !== undefined && spectrum.designLifeYears !== null
      && (!finite(spectrum.designLifeYears) || spectrum.designLifeYears < 0)) {
    issues.push(issue('INTAKE_PACKAGE_DESIGN_LIFE_INVALID', 'spectrum.designLifeYears must be finite and >= 0 when supplied.'));
  }
  return { metadata, method, classBasis, spectrum };
}

function baseProject(identity) {
  const spectrum = identity.spectrum;
  return createHpPipingClassProject({
    metadata: {
      projectId: text(identity.metadata.projectId),
      classId: text(identity.metadata.classId),
      revision: text(identity.metadata.revision),
    },
    methodManifest: {
      b313Edition: text(identity.method.b313Edition),
      ...(text(identity.method.viii3Edition) ? { viii3Edition: text(identity.method.viii3Edition) } : {}),
      ...HP_PIPING_CLASS_AUTHORITY_POLICY,
    },
    classBasis: { designPressureMpa: identity.classBasis.designPressureMpa },
    products: [],
    transient: {
      spectrum: {
        spectrumId: text(spectrum.spectrumId),
        ...(finite(spectrum.designLifeYears) ? { designLifeYears: spectrum.designLifeYears } : {}),
        ...(text(spectrum.preparedBy) ? { preparedBy: text(spectrum.preparedBy) } : {}),
        ...(text(spectrum.checkedBy) ? { checkedBy: text(spectrum.checkedBy) } : {}),
        ...(text(spectrum.approvedBy) ? { approvedBy: text(spectrum.approvedBy) } : {}),
        ...(text(spectrum.status) ? { status: text(spectrum.status) } : {}),
      },
      states: [],
      transitions: [],
    },
    fatigueEvidence: [],
  });
}

function appendStageIssues(target, stage, result, extra = {}) {
  for (const row of result?.issues ?? []) {
    target.push(issue(row.code || 'INTAKE_PACKAGE_STAGE_FAILED', row.message || `${stage} validation failed.`, {
      stage,
      ...(row.details ?? {}),
      ...extra,
    }));
  }
}

function kdTables(pkg, project, issues) {
  const sections = pkg?.tables?.kd ?? [];
  if (!Array.isArray(sections)) {
    issues.push(issue('INTAKE_PACKAGE_KD_TABLES_INVALID', 'tables.kd must be an array.'));
    return [];
  }
  const exactProducts = new Set((project.products ?? []).map((row) => text(row.productId)).filter(Boolean));
  const productByIdentity = new Map((project.products ?? []).map((row) => [text(row.productId).toUpperCase(), text(row.productId)]));
  const seen = new Set();
  return sections.map((section, index) => {
    const productId = text(section?.productId);
    const identityKey = productId.toUpperCase();
    if (!productId) {
      issues.push(issue('INTAKE_PACKAGE_KD_PRODUCT_REQUIRED', `tables.kd[${index}].productId is required.`, { index }));
    } else if (seen.has(identityKey)) {
      issues.push(issue('INTAKE_PACKAGE_KD_PRODUCT_DUPLICATE', `KD package for ${productId} is duplicated (case-insensitive identity).`, { productId, index }));
    } else seen.add(identityKey);
    if (productId && !exactProducts.has(productId)) {
      const caseMatch = productByIdentity.get(identityKey);
      issues.push(issue(
        caseMatch ? 'INTAKE_PACKAGE_KD_PRODUCT_CASE_MISMATCH' : 'INTAKE_PACKAGE_KD_PRODUCT_UNKNOWN',
        caseMatch ? `KD package productId ${productId} must exactly match imported product ${caseMatch}.` : `KD package references unknown product ${productId}.`,
        { productId, ...(caseMatch ? { expectedProductId: caseMatch } : {}) },
      ));
    }
    const table = tableText(section, HP_PIPING_CLASS_KD_BULK_HEADERS, `KD ${productId || index + 1}`, issues);
    return { productId, table };
  });
}

export function previewHpPipingClassIntakePackage(source) {
  const issues = [];
  const pkg = parseSource(source, issues);
  if (!pkg) return { ok: false, issues, project: null, summary: {} };
  scanForbiddenAuthority(pkg, '', issues);
  const identity = packageIdentity(pkg, issues);
  const productsText = tableText(pkg?.tables?.products, HP_PIPING_CLASS_PRODUCT_BULK_HEADERS, 'Products', issues);
  const statesText = tableText(pkg?.tables?.states, HP_PIPING_CLASS_STATE_BULK_HEADERS, 'Operating states', issues);
  const cyclesText = tableText(pkg?.tables?.cycles, HP_PIPING_CLASS_CYCLE_BULK_HEADERS, 'Governed cycles', issues);
  if (issues.length) return { ok: false, issues, project: null, summary: {} };

  let project = baseProject(identity);
  const productResult = applyHpPipingClassProductBulkInput(project, productsText);
  if (!productResult.ok || !productResult.applied) {
    appendStageIssues(issues, 'PRODUCTS', productResult);
    return { ok: false, issues, project: null, stages: { products: productResult }, summary: {} };
  }
  project = productResult.project;

  const transientResult = applyHpPipingClassTransientBulkInput(project, { statesText, cyclesText });
  if (!transientResult.ok || !transientResult.applied) {
    appendStageIssues(issues, 'TRANSIENT', transientResult);
    return { ok: false, issues, project: null, stages: { products: productResult, transient: transientResult }, summary: {} };
  }
  project = transientResult.project;

  const normalizedKd = kdTables(pkg, project, issues);
  const kdStage = [];
  if (normalizedKd.length && !text(identity.method.viii3Edition)) {
    issues.push(issue('INTAKE_PACKAGE_VIII3_EDITION_REQUIRED', 'method.viii3Edition is required when tables.kd contains fatigue review data.'));
  }
  if (issues.length) {
    return { ok: false, issues, project: null, stages: { products: productResult, transient: transientResult, kd: kdStage }, summary: {} };
  }

  for (const entry of normalizedKd) {
    project.fatigueEvidence.push({ productId: entry.productId, externalResults: [] });
    const evidenceIndex = project.fatigueEvidence.length - 1;
    const result = applyHpPipingClassKdBulkInput(project, evidenceIndex, entry.table);
    kdStage.push({ productId: entry.productId, result });
    if (!result.ok || !result.applied) appendStageIssues(issues, 'KD', result, { productId: entry.productId });
  }
  if (issues.length) return { ok: false, issues, project: null, stages: { products: productResult, transient: transientResult, kd: kdStage }, summary: {} };

  const validation = validateHpPipingClassProject(project, { validationPolicy: 'PRODUCTION_REVIEW' });
  if (!validation.ok) {
    appendStageIssues(issues, 'PROJECT', validation);
    return { ok: false, issues, project: null, stages: { products: productResult, transient: transientResult, kd: kdStage, validation }, summary: {} };
  }

  return {
    ok: true,
    issues: [],
    advisories: clone(validation.advisories ?? []),
    project,
    stages: { products: productResult, transient: transientResult, kd: kdStage, validation },
    summary: Object.freeze({
      projectId: project.metadata.projectId,
      classId: project.metadata.classId,
      revision: project.metadata.revision,
      products: project.products.length,
      states: project.transient.states.length,
      cycles: project.transient.transitions.length,
      kdProducts: project.fatigueEvidence.length,
      kdRows: project.fatigueEvidence.reduce((sum, row) => sum + (row.externalResults?.length ?? 0), 0),
      designPressureMpa: project.classBasis.designPressureMpa,
      spectrumId: project.transient.spectrum?.spectrumId ?? null,
    }),
    authority: Object.freeze({ ...HP_PIPING_CLASS_AUTHORITY_POLICY }),
  };
}

export function applyHpPipingClassIntakePackage(source) {
  const preview = previewHpPipingClassIntakePackage(source);
  return preview.ok ? { ...preview, applied: true, project: clone(preview.project) } : { ...preview, applied: false, project: null };
}
