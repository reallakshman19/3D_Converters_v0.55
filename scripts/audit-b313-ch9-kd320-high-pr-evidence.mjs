import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HIGH_PR_RECONCILIATION_SCHEMA = 'kd320-high-pr-reconciliation/v1';
const DEFAULT_MANIFEST = fileURLToPath(new URL(
  '../engineering/hp-class-standardization/qualification/kd320-q1/high-pr-reconciliation.json',
  import.meta.url,
));

function text(value) { return String(value ?? '').trim(); }
function trueish(value) { return text(value).toUpperCase() === 'TRUE'; }
function canonicalHash(value) { return /^sha256:[0-9a-f]{64}$/.test(text(value)); }

export function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

export function parseCsv(csvText) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { if (row.some((item) => item.length)) rows.push(row); row = []; };
  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    if (quoted) {
      if (char === '"' && csvText[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') pushField();
    else if (char === '\n') { pushField(); pushRow(); }
    else if (char !== '\r') field += char;
  }
  if (field.length || row.length) { pushField(); pushRow(); }
  if (!rows.length) return [];
  const headers = rows[0].map(text);
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((key, index) => [key, cells[index] ?? ''])));
}

function readCsv(dir, name) {
  return parseCsv(fs.readFileSync(path.join(dir, name), 'utf8'));
}

function loadManifest(manifestOrPath) {
  if (typeof manifestOrPath === 'object' && manifestOrPath) return manifestOrPath;
  return JSON.parse(fs.readFileSync(manifestOrPath ?? DEFAULT_MANIFEST, 'utf8'));
}

function snapshotChecks(dir, manifest) {
  return manifest.sourceSnapshot.files.map((file) => {
    const filePath = path.join(dir, file.name);
    if (!fs.existsSync(filePath)) return { name: file.name, present: false, matchesPinnedBlob: false };
    const buffer = fs.readFileSync(filePath);
    const actual = gitBlobSha(buffer);
    return { name: file.name, present: true, expectedGitBlobSha: file.gitBlobSha, actualGitBlobSha: actual, matchesPinnedBlob: actual === file.gitBlobSha };
  });
}

function exactRow(rows, field, value) {
  return rows.find((row) => text(row[field]) === value);
}

function curveSummary(curves, points, curveId) {
  const curve = exactRow(curves, 'fatigue_curve_id', curveId);
  const selected = points.filter((row) => text(row.fatigue_curve_id) === curveId)
    .map((row) => ({ n: Number(row.n_cycles), sa: Number(row.sa_mpa) }))
    .filter((row) => Number.isFinite(row.n) && Number.isFinite(row.sa));
  const monotonic = selected.length >= 2 && selected.every((point, index) => (
    index === 0 || (point.n > selected[index - 1].n && point.sa < selected[index - 1].sa)
  ));
  return { declared: Boolean(curve), pointCount: selected.length, monotonic, sourceLocator: curve?.source_locator ?? null };
}

function looksSyntheticHash(value) {
  const payload = text(value).replace(/^sha256:/, '');
  return payload.includes('0123456789abcdef') || payload.includes('abcdef0123456789');
}

function parseJsonObject(value) {
  try { const parsed = JSON.parse(text(value) || '{}'); return parsed && typeof parsed === 'object' ? parsed : {}; }
  catch { return {}; }
}

function benchmarkSummary(rows) {
  const code = exactRow(rows, 'benchmark_id', 'HP-CODE-24-F01');
  if (!code) return { present: false, numericalOracleRetained: false, independentlyLabeled: false };
  const intermediates = parseJsonObject(code.expected_intermediates_json);
  const result = parseJsonObject(code.expected_result_json);
  const numericalKeys = Object.values(intermediates).filter((value) => Number.isFinite(Number(value))).length
    + Object.values(result).filter((value) => Number.isFinite(Number(value))).length;
  return {
    present: true,
    numericalOracleRetained: numericalKeys > 0,
    independentlyLabeled: trueish(code.independent),
    disposition: result.disposition ?? null,
    sourceType: code.source_type ?? null,
  };
}

function routeSummary(methods, routes, target) {
  const method = exactRow(methods, 'method_id', target.methodId);
  const route = exactRow(routes, 'fatigue_route_id', target.routeId);
  const methodMatches = Boolean(method)
    && text(method.method_revision) === target.methodRevision
    && text(method.b313_edition) === target.b313Edition
    && text(method.viii3_source_id) === target.viii3SourceId
    && text(method.kd3_method_id) === target.kd3MethodId
    && text(method.fatigue_route_id) === target.routeId;
  const routeMatches = Boolean(route)
    && text(route.stress_basis) === target.stressBasis
    && text(route.seq_route) === target.seqRoute
    && text(route.mean_stress_route) === target.meanStressRoute
    && text(route.fatigue_curve_id) === target.carbonCurveId
    && text(route.interpolation_rule) === target.interpolationRule
    && text(route.extrapolation_allowed).toUpperCase() === target.extrapolationAllowed
    && text(route.applicability) === target.applicability
    && text(route.source_id) === target.viii3SourceId;
  return { methodPresent: Boolean(method), routePresent: Boolean(route), methodMatches, routeMatches };
}

function sourceSummary(rows, target) {
  const viii3 = exactRow(rows, 'source_id', target.viii3SourceId);
  const b313 = exactRow(rows, 'source_id', 'SRC-B313-2024');
  return {
    b313Present: Boolean(b313),
    viii3Present: Boolean(viii3),
    b313HashShapeValid: canonicalHash(b313?.document_hash),
    viii3HashShapeValid: canonicalHash(viii3?.document_hash),
    viii3HashLooksSynthetic: looksSyntheticHash(viii3?.document_hash),
    independentCheckerFieldAvailable: rows.length ? Object.hasOwn(rows[0], 'independent_check_by') : false,
  };
}

export function auditHighPrEvidenceDirectory(dir, manifestOrPath = DEFAULT_MANIFEST) {
  const manifest = loadManifest(manifestOrPath);
  if (manifest.schema !== HIGH_PR_RECONCILIATION_SCHEMA) throw new Error('Unsupported reconciliation manifest schema.');
  const snapshot = snapshotChecks(dir, manifest);
  const snapshotOk = snapshot.every((item) => item.present && item.matchesPinnedBlob);
  const methods = readCsv(dir, 'method_manifest.csv');
  const routes = readCsv(dir, 'fatigue_route.csv');
  const curves = readCsv(dir, 'fatigue_curve.csv');
  const points = readCsv(dir, 'fatigue_curve_point.csv');
  const sources = readCsv(dir, 'code_source_revision.csv');
  const benchmarks = readCsv(dir, 'benchmark_case.csv');
  const route = routeSummary(methods, routes, manifest.target);
  const source = sourceSummary(sources, manifest.target);
  const curve = {
    carbon: curveSummary(curves, points, manifest.target.carbonCurveId),
    stainless: curveSummary(curves, points, manifest.target.stainlessCurveId),
    nickel: curveSummary(curves, points, manifest.target.nickelCurveId),
  };
  const benchmark = benchmarkSummary(benchmarks);
  const integrityIssues = [];
  if (!snapshotOk) integrityIssues.push('PINNED_HIGH_PR_GIT_BLOB_MISMATCH');
  if (!route.methodMatches) integrityIssues.push('TARGET_METHOD_BINDING_MISMATCH');
  if (!route.routeMatches) integrityIssues.push('TARGET_FATIGUE_ROUTE_MISMATCH');
  if (!curve.carbon.declared || !curve.carbon.monotonic) integrityIssues.push('CARBON_CURVE_DATA_INCOMPLETE_OR_INVALID');
  const blockers = [...manifest.nativeSemanticBlockers];
  if (source.viii3HashLooksSynthetic) blockers.push('VIII3_SOURCE_REGISTRY_HASH_LOOKS_PLACEHOLDER');
  if (!source.independentCheckerFieldAvailable) blockers.push('HIGH_PR_SOURCE_REGISTRY_HAS_NO_INDEPENDENT_CHECKER_CUSTODY');
  if (!benchmark.numericalOracleRetained) blockers.push('HP_CODE_24_F01_REMAINS_QUALITATIVE_ONLY');
  if (curve.nickel.declared && curve.nickel.pointCount === 0) blockers.push('NICKEL_CURVE_DECLARED_WITHOUT_NUMERICAL_POINTS');
  return {
    ok: integrityIssues.length === 0,
    schema: HIGH_PR_RECONCILIATION_SCHEMA,
    sourceSnapshot: { ...manifest.sourceSnapshot, integrityOk: snapshotOk, files: snapshot },
    route,
    source,
    curves: curve,
    benchmark,
    capability: {
      kd2AndSaltDevelopmentEvidencePresent: snapshotOk && route.methodMatches,
      carbonCurveDevelopmentDataPresent: curve.carbon.declared && curve.carbon.monotonic,
      logLogNoExtrapolationRouteClaimPresent: route.routeMatches,
      userCalculatedKd3IntakeCompatible: snapshotOk && route.methodMatches && route.routeMatches,
      controlledKd320SemanticsEstablished: false,
      nativeKd320Ready: false,
    },
    authority: { ...manifest.authority },
    q1Impact: { evidenceStateMayChange: false, g0G1RemainBlocked: true, q2OraclePopulationAllowed: false },
    integrityIssues,
    blockers: [...new Set(blockers)],
    disposition: integrityIssues.length ? 'HIGH_PR_RECONCILIATION_INVALID' : 'HIGH_PR_DEVELOPMENT_EVIDENCE_RECONCILED_NATIVE_BLOCKED',
  };
}

function main() {
  const [, , dir] = process.argv;
  if (!dir) {
    console.error('Usage: node scripts/audit-b313-ch9-kd320-high-pr-evidence.mjs <High-Pr-dir>');
    process.exitCode = 1;
    return;
  }
  try {
    const result = auditHighPrEvidenceDirectory(dir);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 2;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: 'HIGH_PR_AUDIT_FAILED', message: error.message }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
