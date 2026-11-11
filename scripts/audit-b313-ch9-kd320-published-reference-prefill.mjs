import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KD320_PUBLISHED_PREFILL_SCHEMA = 'kd320-published-reference-prefill/v1';
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const FULL_CHAIN = Object.freeze([
  'alternatingStressIntensity', 'associatedMeanStress', 'correctionParameters',
  'equivalentAlternatingStress', 'permissibleCycles',
]);

function text(value) { return String(value ?? '').trim(); }
function finitePositive(value) { return Number.isFinite(value) && value > 0; }

function numericalSummary(reference) {
  const evidence = reference.numericalEvidence ?? {};
  const rows = Array.isArray(evidence.rows) ? evidence.rows : [];
  const fields = new Set(Array.isArray(evidence.chainFields) ? evidence.chainFields : []);
  const fullChainDeclared = FULL_CHAIN.every((field) => fields.has(field));
  const rowNumericsValid = rows.length > 0 && rows.every((row) => (
    finitePositive(row.permissibleCycles)
    && (finitePositive(row.equivalentAlternatingStress) || finitePositive(row.reportedAmplitude))
  ));
  return { rows: rows.length, fullChainDeclared, rowNumericsValid };
}

function referenceSummary(reference, targetEdition) {
  const blockers = [];
  const editionMatches = text(reference.viii3EditionUsed) === targetEdition;
  if (!editionMatches) blockers.push(`VIII3_EDITION_${text(reference.viii3EditionUsed) || 'UNKNOWN'}_NOT_TARGET_${targetEdition}`);
  const sourceHashReady = SHA256.test(text(reference.sourceSha256));
  if (!sourceHashReady) blockers.push('SOURCE_SHA256_PENDING');
  const reconciliationReady = reference.editionReconciliation?.status === 'CONTROLLED_2025_EQUIVALENCE_VERIFIED';
  if (!reconciliationReady) blockers.push('CONTROLLED_2025_EDITION_RECONCILIATION_PENDING');
  const independentAdmissionReady = reference.independentAdmission?.status === 'INDEPENDENTLY_ADMITTED'
    && Boolean(text(reference.independentAdmission?.checkedBy))
    && Boolean(text(reference.independentAdmission?.checkedAt));
  if (!independentAdmissionReady) blockers.push('INDEPENDENT_ADMISSION_PENDING');
  const numerical = numericalSummary(reference);
  if (!numerical.fullChainDeclared) blockers.push('FULL_SALT_MEAN_PARAMETER_SEQ_CHAIN_NOT_RETAINED');
  if (!numerical.rowNumericsValid) blockers.push('NUMERICAL_ROWS_INVALID');
  const eligibleForQf022 = editionMatches && sourceHashReady && reconciliationReady
    && independentAdmissionReady && numerical.fullChainDeclared && numerical.rowNumericsValid;
  return { referenceId: reference.referenceId, editionMatches, sourceHashReady, reconciliationReady, independentAdmissionReady, numerical, eligibleForQf022, blockers: [...new Set(blockers)] };
}

export function auditKd320PublishedReferencePrefill(input) {
  const data = typeof input === 'string' ? JSON.parse(fs.readFileSync(input, 'utf8')) : input;
  const errors = [];
  if (data?.schema !== KD320_PUBLISHED_PREFILL_SCHEMA) errors.push('SCHEMA_INVALID');
  if (data?.target?.benchmarkId !== 'KD3-QF-022') errors.push('TARGET_BENCHMARK_INVALID');
  if (data?.target?.evidenceClass !== 'PRIMARY_PUBLISHED_NUMERICAL_ORACLE') errors.push('TARGET_EVIDENCE_CLASS_INVALID');
  if (data?.target?.viii3Edition !== '2025') errors.push('TARGET_EDITION_MUST_REMAIN_2025');
  if (data?.target?.methodId !== 'KD3-FATIGUE-001') errors.push('TARGET_METHOD_INVALID');
  for (const flag of ['q2OracleAdmissionReady','nativeCoreKd3Qualified','codeCompliance','canUseForDesignAuthority','productionKernelAllowed','automaticPromotionAllowed']) {
    if (data?.authority?.[flag] !== false) errors.push(`AUTHORITY_${flag}_MUST_REMAIN_FALSE`);
  }
  const references = Array.isArray(data?.references) ? data.references : [];
  if (references.length < 1) errors.push('PUBLISHED_REFERENCE_REQUIRED');
  const ids = references.map((item) => text(item.referenceId));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) errors.push('REFERENCE_IDS_INVALID_OR_DUPLICATE');
  const summaries = references.map((reference) => referenceSummary(reference, '2025'));
  for (const [index, summary] of summaries.entries()) {
    const declaredEligible = references[index]?.admission?.eligibleForQf022 === true;
    if (declaredEligible !== summary.eligibleForQf022) errors.push(`${summary.referenceId}:DECLARED_ELIGIBILITY_MISMATCH`);
    if (summary.eligibleForQf022) errors.push(`${summary.referenceId}:PREFILL_MUST_NOT_AUTO_ADMIT_QF022`);
  }
  return {
    ok: errors.length === 0,
    errors,
    targetQf022Ready: false,
    references: summaries,
    authority: {
      q2OracleAdmissionReady: false,
      nativeCoreKd3Qualified: false,
      codeCompliance: false,
      canUseForDesignAuthority: false,
      productionKernelAllowed: false,
      automaticPromotionAllowed: false,
    },
    nextAction: 'RECONCILE_AGAINST_CONTROLLED_VIII3_2025_AND_RETAIN_SOURCE_HASH_BEFORE_QF022_ADMISSION',
  };
}

function main() {
  const file = process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../engineering/hp-class-standardization/qualification/kd320-q2/published-reference/candidates.json');
  const result = auditKd320PublishedReferencePrefill(file);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
