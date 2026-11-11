import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PR1290_CANDIDATE_SCHEMA = 'kd320-pr1290-candidate-reconciliation/v1';
const SEMANTIC_IDS = Object.freeze(Array.from({ length: 14 }, (_, index) => `KD320-SEM-${String(index + 1).padStart(3, '0')}`));
const AUTHORITY_FALSE = Object.freeze({
  canSatisfyControlledSourceReceipt: false,
  canPromoteQ1SemanticItem: false,
  q1EvidenceStateMayChange: false,
  nativeCoreKd3Qualified: false,
  codeCompliance: false,
  canUseForDesignAuthority: false,
  productionKernelAllowed: false,
  automaticPromotionAllowed: false,
});

function text(value) { return String(value ?? '').trim(); }
function close(a, b, rel = 1e-12) { return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b)); }
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
export function gitBlobSha(buffer) {
  return crypto.createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`, 'utf8')).update(buffer).digest('hex');
}

function lineValue(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`^${escaped}:\\s*(.+?)\\s*$`, 'mi'));
  return match ? text(match[1]).replace(/^['"]|['"]$/g, '') : null;
}

function readRequired(dir, name, encoding = 'utf8') {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) throw new Error(`Required PR1290 candidate file missing: ${name}`);
  return fs.readFileSync(file, encoding);
}

export function parseCsv(csvText) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { if (row.some((cell) => cell.length)) rows.push(row); row = []; };
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

function snapshotChecks(dir, manifest) {
  return manifest.sourceSnapshot.files.map((entry) => {
    const file = path.join(dir, entry.name);
    if (!fs.existsSync(file)) return { name: entry.name, present: false, matchesPinnedBlob: false };
    const buffer = fs.readFileSync(file);
    const actual = gitBlobSha(buffer);
    return { name: entry.name, present: true, expectedGitBlobSha: entry.gitBlobSha, actualGitBlobSha: actual, matchesPinnedBlob: actual === entry.gitBlobSha };
  });
}

function sourceHashCheck(dir, yaml, sourcePdf) {
  const claimed = lineValue(yaml, 'sha256');
  if (!claimed) return { sourcePdf, claimPresent: false, matches: false };
  const buffer = readRequired(dir, sourcePdf, null);
  const actual = sha256(buffer);
  return { sourcePdf, claimPresent: true, claimedSha256: claimed, actualSha256: actual, matches: claimed.toLowerCase() === actual };
}

function curveAudit(csvText) {
  const rows = parseCsv(csvText);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const cycleColumns = headers.filter((key) => /^\dE\d$/i.test(key));
  const rowChecks = rows.map((row) => {
    const points = cycleColumns.map((key) => ({ key, value: text(row[key]) })).filter((point) => point.value !== '');
    const values = points.map((point) => Number(point.value));
    const positiveFinite = values.every((value) => Number.isFinite(value) && value > 0);
    const strictlyDecreasing = values.every((value, index) => index === 0 || value < values[index - 1]);
    return { curveId: text(row.curve_id), pointCount: values.length, positiveFinite, strictlyDecreasing };
  });
  return {
    rowCount: rows.length,
    cycleColumnCount: cycleColumns.length,
    rows: rowChecks,
    structurallyValid: rows.length > 0 && cycleColumns.length > 0 && rowChecks.every((row) => row.pointCount >= 2 && row.positiveFinite && row.strictlyDecreasing),
  };
}

function arithmeticChecks() {
  const D = 114.3, P = 20, S = 138;
  const t = D / 2 * (1 - Math.exp(-P / S));
  const pRoundTrip = S * Math.log(D / (D - 2 * t));

  const teff = 8.80375;
  const Di = D - 2 * teff;
  const Y = D / Di;
  const hoop = P * (Y ** 2 + 1) / (Y ** 2 - 1);
  const radial = -P;
  const axial = P / (Y ** 2 - 1);
  const boreIntensity = P * 2 * Y ** 2 / (Y ** 2 - 1);
  const principalMax = Math.max(Math.abs(hoop - axial), Math.abs(axial - radial), Math.abs(radial - hoop));

  const Ni = 1e3, Nj = 1e4, Si = 89, Sj = 49;
  const Sa = Math.sqrt(Si * Sj);
  const N = Ni * 10 ** (Math.log10(Nj / Ni) * Math.log10(Si / Sa) / Math.log10(Si / Sj));
  return {
    b313ThicknessPressureRoundTrip: { pass: close(pRoundTrip, P), tMm: t, recoveredPressureMpa: pRoundTrip },
    kd2BoreStressIdentity: { pass: close(boreIntensity, hoop - radial) && close(boreIntensity, principalMax), hoopMpa: hoop, axialMpa: axial, radialMpa: radial, stressIntensityMpa: boreIntensity },
    kd3LogLogMidpointIdentity: { pass: close(N, Math.sqrt(Ni * Nj)), stressKsi: Sa, cycles: N },
    authority: 'ARITHMETIC_CONSISTENCY_ONLY_NOT_CODE_QUALIFICATION',
  };
}

function semanticCoverage(manifest) {
  const byId = new Map((manifest.semanticCandidates ?? []).map((row) => [text(row.semanticId), row]));
  return SEMANTIC_IDS.map((semanticId) => {
    const candidate = byId.get(semanticId);
    return {
      semanticId,
      mapped: Boolean(candidate),
      candidateFile: candidate?.candidateFile ?? null,
      candidateLocator: candidate?.candidateLocator ?? null,
      candidateStatus: candidate?.status ?? 'MISSING',
      promotable: false,
    };
  });
}

function authorityIsFalse(authority) {
  return Object.entries(AUTHORITY_FALSE).every(([key, value]) => authority?.[key] === value);
}

export function auditPr1290CandidateDirectory(dir, manifest) {
  if (manifest?.schema !== PR1290_CANDIDATE_SCHEMA) throw new Error('Unsupported PR1290 candidate reconciliation schema.');
  const snapshot = snapshotChecks(dir, manifest);
  const snapshotOk = snapshot.every((row) => row.present && row.matchesPinnedBlob);

  const b31Yaml = readRequired(dir, 'b31_3_chapter_ix_manifest.yaml');
  const kd2Yaml = readRequired(dir, 'asme_viii_3_kd2_manifest.yaml');
  const kd3Yaml = readRequired(dir, 'asme_viii_3_kd3_manifest.yaml');
  const kd3Md = readRequired(dir, 'ASME_VIII_3_KD3_Fatigue_Evaluation_Package.md');
  const curveCsv = readRequired(dir, 'kd3_fatigue_curves_data.csv');

  const b313Edition = lineValue(b31Yaml, 'edition');
  const kd2Edition = lineValue(kd2Yaml, 'edition');
  const kd3EditionManifest = lineValue(kd3Yaml, 'edition');
  const kd3EditionMd = kd3Md.match(/\((\d{4}) Edition\)/i)?.[1] ?? null;
  const kd2SourcePdf = lineValue(kd2Yaml, 'source_pdf');
  const kd3SourcePdf = lineValue(kd3Yaml, 'source_pdf');
  const sourceHashes = [
    sourceHashCheck(dir, kd2Yaml, kd2SourcePdf),
    sourceHashCheck(dir, kd3Yaml, kd3SourcePdf),
  ];
  const sourceHashesOk = sourceHashes.every((row) => row.claimPresent && row.matches);
  const curves = curveAudit(curveCsv);
  const semanticCandidates = semanticCoverage(manifest);
  const arithmetic = arithmeticChecks();

  const integrityIssues = [];
  if (!snapshotOk) integrityIssues.push('PR1290_PINNED_SOURCE_BLOB_MISMATCH');
  if (!sourceHashesOk) integrityIssues.push('PR1290_DECLARED_SOURCE_SHA256_MISMATCH');
  if (!curves.structurallyValid) integrityIssues.push('PR1290_FATIGUE_CURVE_TABLE_STRUCTURALLY_INVALID');
  if (!authorityIsFalse(manifest.authority)) integrityIssues.push('PR1290_CANDIDATE_AUTHORITY_MUST_REMAIN_FALSE');
  if (Object.values(arithmetic).some((value) => value && typeof value === 'object' && 'pass' in value && !value.pass)) {
    integrityIssues.push('PR1290_CANDIDATE_ARITHMETIC_INCONSISTENT');
  }

  const blockers = [
    'PR1290_B313_TARGET_RECEIPT_Q1_SRC_B313_2024_NOT_SATISFIED',
    'PR1290_VIII3_TARGET_RECEIPT_Q1_SRC_VIII3_2025_NOT_SATISFIED',
    'PR1290_INDEPENDENT_CHECKER_CUSTODY_MISSING',
    'PR1290_PUBLIC_STANDARD_SOURCE_BYTES_CANNOT_SATISFY_SECURE_Q1_RECEIPT',
    'PR1290_FATIGUE_CURVE_POINTS_NOT_TARGET_EDITION_QUALIFIED',
  ];
  if (b313Edition !== manifest.target.b313Edition) blockers.push('PR1290_B313_MIXED_OR_NON_TARGET_EDITION_CLAIM');
  if (!lineValue(b31Yaml, 'source_pdf') || !lineValue(b31Yaml, 'sha256')) blockers.push('PR1290_B313_CONTROLLED_SOURCE_IDENTITY_INCOMPLETE');
  if (!kd2Edition) blockers.push('PR1290_KD2_EDITION_UNDECLARED');
  else if (kd2Edition !== manifest.target.viii3Edition) blockers.push('PR1290_KD2_TARGET_EDITION_RECONCILIATION_REQUIRED');
  if ((kd3EditionManifest && kd3EditionManifest !== manifest.target.viii3Edition) || kd3EditionMd !== manifest.target.viii3Edition) {
    blockers.push('PR1290_KD3_2013_TO_2025_RECONCILIATION_REQUIRED');
  }
  if (/owner specification/i.test(kd3Md) && /Assign\s+\$?N_f/i.test(kd3Md)) blockers.push('PR1290_CURVE_BELOW_DOMAIN_RULE_AMBIGUOUS');
  if (semanticCandidates.find((row) => row.semanticId === 'KD320-SEM-014')?.candidateStatus !== 'CANDIDATE_UNVERIFIED') {
    blockers.push('PR1290_SEM014_RESULT_RELEASE_CUSTODY_NOT_ESTABLISHED');
  }

  const normativeClaims = [
    ['MEAN_STRESS_DENOMINATOR_090_CLAMP', /0\.90/],
    ['TEMPERATURE_700F_LIMIT', /700\^?\\?circ|700\s*°?F/i],
    ['SURFACE_FACTOR_KR', /K_r/],
    ['PLASTIC_PENALTY_KE', /K_e/],
    ['ANALYTICAL_CURVE_FITS', /Exact Analytical Curve Fit/i],
    ['LOG_LOG_INTERPOLATION', /Log-Log Interpolation/i],
  ].map(([claimId, pattern]) => ({ claimId, present: pattern.test(kd3Md), qualificationStatus: 'CANDIDATE_UNVERIFIED' }));

  return {
    ok: integrityIssues.length === 0,
    schema: PR1290_CANDIDATE_SCHEMA,
    sourceSnapshot: { ...manifest.sourceSnapshot, integrityOk: snapshotOk, files: snapshot },
    editions: { b313Manifest: b313Edition, kd2Manifest: kd2Edition, kd3Manifest: kd3EditionManifest, kd3Package: kd3EditionMd, targetB313: manifest.target.b313Edition, targetViii3: manifest.target.viii3Edition },
    sourceHashes,
    curves,
    semanticCandidates,
    normativeClaims,
    arithmetic,
    authority: { ...manifest.authority },
    q1Impact: { evidenceStateMayChange: false, canSatisfyReceipt: false, canPromoteSemanticItem: false, g0G1RemainBlocked: true, q2OraclePopulationAllowed: false },
    integrityIssues,
    blockers: [...new Set(blockers)],
    qualificationReady: false,
    disposition: integrityIssues.length ? 'PR1290_CANDIDATE_RECONCILIATION_INVALID' : 'PR1290_PROJECT_SOURCE_EXTRACTION_CANDIDATE_RECONCILED_NATIVE_BLOCKED',
  };
}
