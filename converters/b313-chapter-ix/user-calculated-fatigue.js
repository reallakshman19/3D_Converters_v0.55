import { resolveChapterIxTransientSpectrum } from './transient-spectrum.js';
import { calculateChapterIxPressureCycleStress } from './cycle-stress.js';
import { calculateChapterIxCumulativeDamage } from './cumulative-damage.js';

export const USER_SALT_CROSSCHECK_RELATIVE_TOLERANCE = 1e-4;
export const USER_CALCULATED_FATIGUE_VERSION = 'b313-ch9-user-calculated-fatigue/v1';
export const USER_CALCULATED_FATIGUE_EVIDENCE_POLICIES = Object.freeze([
  'REQUIRED',
  'ADVISORY',
]);

function failure(code, message, details = {}) {
  return { ok: false, code, message, details, canUseForDesignAuthority: false };
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function text(value) {
  return String(value ?? '').trim();
}

function normalizedIdentity(value) {
  return text(value).toLocaleLowerCase();
}

function evidencePolicy(value) {
  return value === 'ADVISORY' ? 'ADVISORY' : 'REQUIRED';
}

function indexExternalResults(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return failure('USER_FATIGUE_RESULTS_REQUIRED', 'externalResults must contain at least one calculated fatigue result.');
  }
  const map = new Map();
  for (const row of rows) {
    const cycleId = text(row?.cycleId);
    if (!cycleId) return failure('USER_FATIGUE_CYCLE_ID_REQUIRED', 'Every external result requires cycleId.');
    if (map.has(cycleId)) {
      return failure('USER_FATIGUE_CYCLE_DUPLICATE', `Duplicate external result for ${cycleId}.`, { cycleId });
    }
    map.set(cycleId, row);
  }
  return { ok: true, map };
}

function inspectBasis(row, cycleId) {
  const basis = row?.calculationBasis;
  const issues = [];
  if (!basis || typeof basis !== 'object' || Array.isArray(basis)) {
    issues.push({
      code: 'USER_FATIGUE_BASIS_REQUIRED',
      message: `${cycleId}.calculationBasis is required for evidence completion.`,
      cycleId,
      field: 'calculationBasis',
    });
    return {
      basis: {},
      issues,
      checked: false,
      calculatedBy: null,
      checkedBy: null,
      checkedAt: null,
    };
  }

  const requiredFields = ['code', 'edition', 'methodRef', 'calculationRef', 'calculatedBy'];
  for (const field of requiredFields) {
    if (!text(basis[field])) {
      issues.push({
        code: 'USER_FATIGUE_BASIS_REQUIRED',
        message: `${cycleId}.calculationBasis.${field} is required for evidence completion.`,
        cycleId,
        field,
      });
    }
  }

  const calculatedBy = text(basis.calculatedBy) || null;
  const checkedBy = text(basis.checkedBy) || null;
  const checkedAt = text(basis.checkedAt) || null;
  if (normalizedIdentity(checkedBy)
      && normalizedIdentity(checkedBy) === normalizedIdentity(calculatedBy)) {
    issues.push({
      code: 'USER_FATIGUE_CHECKER_NOT_INDEPENDENT',
      message: `${cycleId} checker must differ from calculatedBy for evidence completion.`,
      cycleId,
      field: 'checkedBy',
    });
  }
  if (Boolean(checkedBy) !== Boolean(checkedAt)) {
    issues.push({
      code: 'USER_FATIGUE_CHECK_CUSTODY_INCOMPLETE',
      message: `${cycleId} checkedBy and checkedAt must be supplied together for evidence completion.`,
      cycleId,
      field: checkedBy ? 'checkedAt' : 'checkedBy',
    });
  }

  const basisComplete = requiredFields.every((field) => Boolean(text(basis[field])));
  const distinctChecker = Boolean(checkedBy && checkedAt)
    && normalizedIdentity(checkedBy) !== normalizedIdentity(calculatedBy);
  return {
    basis,
    issues,
    checked: basisComplete && distinctChecker && issues.length === 0,
    calculatedBy,
    checkedBy,
    checkedAt,
  };
}

function requireBasis(row, cycleId) {
  const inspected = inspectBasis(row, cycleId);
  const first = inspected.issues[0];
  if (!first) return null;
  return failure(first.code, first.message.replace(/ for evidence completion\.$/u, '.'), {
    cycleId,
    ...(first.field ? { field: first.field } : {}),
  });
}

function validateExternalRow(row, cycle, policy) {
  const cycleId = cycle.cycleId;
  for (const field of ['locationId', 'fromStateId', 'toStateId']) {
    if (!text(row?.[field])) {
      return failure('USER_FATIGUE_RESULT_INCOMPLETE', `${cycleId}.${field} is required.`, { cycleId, field });
    }
  }
  if (text(row.fromStateId) !== cycle.fromStateId || text(row.toStateId) !== cycle.toStateId) {
    return failure('USER_FATIGUE_TRANSITION_MISMATCH', `${cycleId} external state pair does not match the governed transition.`, {
      cycleId,
      expectedFromStateId: cycle.fromStateId,
      expectedToStateId: cycle.toStateId,
      suppliedFromStateId: row.fromStateId,
      suppliedToStateId: row.toStateId,
    });
  }
  const seq = row.equivalentAlternatingStressMpa;
  if (!finite(seq) || seq < 0) {
    return failure('USER_SEQ_INVALID', `${cycleId}.equivalentAlternatingStressMpa must be finite and >= 0.`, { cycleId });
  }
  if (row.userAlternatingStressIntensityMpa !== undefined && row.userAlternatingStressIntensityMpa !== null
      && (!finite(row.userAlternatingStressIntensityMpa) || row.userAlternatingStressIntensityMpa < 0)) {
    return failure('USER_SALT_INVALID', `${cycleId}.userAlternatingStressIntensityMpa must be finite and >= 0.`, { cycleId });
  }
  if (row.associatedMeanStressMpa !== undefined && row.associatedMeanStressMpa !== null
      && !finite(row.associatedMeanStressMpa)) {
    return failure('USER_MEAN_STRESS_INVALID', `${cycleId}.associatedMeanStressMpa must be finite when supplied.`, { cycleId });
  }
  if (row.beta !== undefined && row.beta !== null && (!finite(row.beta) || row.beta < 0)) {
    return failure('USER_BETA_INVALID', `${cycleId}.beta must be finite and >= 0 when supplied.`, { cycleId });
  }
  if (row.saPrimeMpa !== undefined && row.saPrimeMpa !== null && (!finite(row.saPrimeMpa) || !(row.saPrimeMpa > 0))) {
    return failure('USER_SA_PRIME_INVALID', `${cycleId}.saPrimeMpa must be finite and > 0 when supplied.`, { cycleId });
  }
  if (policy === 'REQUIRED') {
    const basisError = requireBasis(row, cycleId);
    if (basisError) return basisError;
  }
  return null;
}

function compareSalt(coreSalt, userSalt) {
  if (userSalt === undefined || userSalt === null) {
    return {
      status: 'NOT_PROVIDED',
      toleranceType: 'RELATIVE',
      toleranceValue: USER_SALT_CROSSCHECK_RELATIVE_TOLERANCE,
      coreAlternatingStressIntensityMpa: coreSalt,
      userAlternatingStressIntensityMpa: null,
      relativeDifference: null,
    };
  }
  const scale = Math.max(Math.abs(coreSalt), Math.abs(userSalt), 1);
  const relativeDifference = Math.abs(coreSalt - userSalt) / scale;
  return {
    status: relativeDifference <= USER_SALT_CROSSCHECK_RELATIVE_TOLERANCE ? 'MATCH' : 'MISMATCH',
    toleranceType: 'RELATIVE',
    toleranceValue: USER_SALT_CROSSCHECK_RELATIVE_TOLERANCE,
    coreAlternatingStressIntensityMpa: coreSalt,
    userAlternatingStressIntensityMpa: userSalt,
    relativeDifference,
  };
}

function evidenceState(row, cycleId) {
  const inspected = inspectBasis(row, cycleId);
  let status = 'USER_CALCULATED_NOT_INDEPENDENTLY_CHECKED';
  if (!row?.calculationBasis || typeof row.calculationBasis !== 'object') {
    status = 'USER_CALCULATED_BASIS_NOT_RECORDED';
  } else if (inspected.issues.length > 0) {
    status = 'USER_CALCULATED_EVIDENCE_INCOMPLETE';
  } else if (inspected.checked) {
    status = 'USER_CALCULATED_INDEPENDENTLY_CHECKED';
  }
  return {
    status,
    calculatedBy: inspected.calculatedBy,
    checkedBy: inspected.checkedBy,
    checkedAt: inspected.checkedAt,
    issues: inspected.issues,
  };
}

export function evaluateChapterIxUserCalculatedFatigueSpectrum(input = {}) {
  const policy = evidencePolicy(input.evidencePolicy);
  const transient = resolveChapterIxTransientSpectrum({
    spectrum: input.spectrum,
    states: input.states,
    transitions: input.transitions,
  });
  if (!transient.ok) {
    return failure(transient.code, transient.message, { stage: 'TRANSIENT', ...(transient.details ?? {}) });
  }
  const indexed = indexExternalResults(input.externalResults);
  if (!indexed.ok) return indexed;
  if (indexed.map.size !== transient.cycles.length) {
    return failure('USER_FATIGUE_RESULT_COUNT_MISMATCH', 'External results must contain exactly one row for every governed cycle.', {
      governedCycles: transient.cycles.map((cycle) => cycle.cycleId),
      suppliedCycles: [...indexed.map.keys()],
    });
  }

  const evaluated = [];
  for (const cycle of transient.cycles) {
    const row = indexed.map.get(cycle.cycleId);
    if (!row) {
      return failure('USER_FATIGUE_RESULT_MISSING', `Missing external result for ${cycle.cycleId}.`, { cycleId: cycle.cycleId });
    }
    const rowError = validateExternalRow(row, cycle, policy);
    if (rowError) return rowError;
    const stress = calculateChapterIxPressureCycleStress({
      outsideDiameterMm: input.outsideDiameterMm,
      effectiveWallMm: input.effectiveWallMm,
      fromPressureMpa: cycle.fromState.pressureMpa,
      toPressureMpa: cycle.toState.pressureMpa,
    });
    if (!stress.ok) {
      return failure(stress.code, stress.message, { stage: 'CYCLE_STRESS', cycleId: cycle.cycleId });
    }
    const saltCrossCheck = compareSalt(stress.alternatingStressIntensityMpa, row.userAlternatingStressIntensityMpa);
    if (saltCrossCheck.status === 'MISMATCH') {
      return failure('USER_SALT_MISMATCH', `${cycle.cycleId} user Salt does not reproduce the CORE pressure-cycle Salt within the repository QA tolerance.`, {
        cycleId: cycle.cycleId,
        saltCrossCheck,
      });
    }

    const seq = row.equivalentAlternatingStressMpa;
    if (stress.alternatingStressIntensityMpa > 0 && seq === 0) {
      return failure('USER_SEQ_ZERO_WITH_NONZERO_CORE_SALT', `${cycle.cycleId} Seq cannot be zero when CORE Salt is nonzero.`, { cycleId: cycle.cycleId });
    }
    const zeroDamage = seq === 0 && stress.alternatingStressIntensityMpa === 0;
    const permissibleCycles = zeroDamage ? null : row.permissibleCycles;
    if (!zeroDamage && (!finite(permissibleCycles) || !(permissibleCycles > 0))) {
      return failure('USER_N_ALLOWED_INVALID', `${cycle.cycleId}.permissibleCycles must be finite and > 0 when Seq is nonzero.`, { cycleId: cycle.cycleId });
    }
    const evidence = evidenceState(row, cycle.cycleId);
    evaluated.push({
      cycleId: cycle.cycleId,
      locationId: text(row.locationId),
      category: cycle.category,
      fromStateId: cycle.fromStateId,
      toStateId: cycle.toStateId,
      appliedCycles: cycle.totalCycles,
      pressureRangeMpa: cycle.pressureRangeMpa,
      coreCycleStress: stress,
      saltCrossCheck,
      equivalentAlternatingStressMpa: seq,
      permissibleCycles,
      zeroDamage,
      usage: zeroDamage ? 0 : cycle.totalCycles / permissibleCycles,
      associatedMeanStressMpa: finite(row.associatedMeanStressMpa) ? row.associatedMeanStressMpa : null,
      beta: finite(row.beta) ? row.beta : null,
      saPrimeMpa: finite(row.saPrimeMpa) ? row.saPrimeMpa : null,
      authorities: {
        salt: saltCrossCheck.status === 'MATCH' ? 'CORE_AND_USER_CROSSCHECKED'
          : 'CORE_CALCULATED_USER_NOT_PROVIDED',
        equivalentAlternatingStress: 'USER_SUPPLIED',
        permissibleCycles: zeroDamage ? 'NOT_APPLICABLE_ZERO_DAMAGE' : 'USER_SUPPLIED',
        appliedCycles: 'GOVERNED_TRANSIENT_SPECTRUM',
        damage: 'CORE_DERIVED',
      },
      calculationBasis: row.calculationBasis && typeof row.calculationBasis === 'object'
        ? { ...row.calculationBasis }
        : {},
      evidence,
    });
  }

  const damage = calculateChapterIxCumulativeDamage({ cycles: evaluated });
  if (!damage.ok) return failure(damage.code, damage.message, { stage: 'CUMULATIVE_DAMAGE' });
  const allChecked = evaluated.every((row) => row.evidence.status === 'USER_CALCULATED_INDEPENDENTLY_CHECKED');
  const evidenceIssues = evaluated.flatMap((row) => row.evidence.issues.map((issue) => ({
    cycleId: row.cycleId,
    ...issue,
  })));
  return {
    ok: true,
    version: USER_CALCULATED_FATIGUE_VERSION,
    calculationMode: 'USER_CALCULATED_KD3',
    calculationState: allChecked
      ? 'EXTERNAL_KD3_CALCULATED_CHECKED_NOT_AUTHORIZED'
      : 'EXTERNAL_KD3_CALCULATED_NOT_CHECKED',
    canUseForDesignAuthority: false,
    codeCompliance: false,
    independentCheckComplete: allChecked,
    evidencePolicy: policy,
    evidenceIssueCount: evidenceIssues.length,
    evidenceIssues,
    transient,
    cycles: evaluated,
    damage,
    referenceStatus: damage.referenceStatus,
    formulation: 'USER_SUPPLIED_SEQ_AND_N_WITH_CORE_SALT_CROSSCHECK_V1',
  };
}
