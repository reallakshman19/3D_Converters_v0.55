export const EXPLICIT_PRELOAD_ENVELOPE_METHOD = 'BOLT.PRELOAD.UNCERTAINTY.EXPLICIT_BOUNDS';

function inputError(Type, field, message) {
  const error = new Type(message);
  error.code = 'INPUT_INVALID';
  error.field = field;
  throw error;
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) inputError(TypeError, field, `${field} is required.`);
  return text;
}

function finite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) inputError(TypeError, field, `${field} must be finite.`);
  return number;
}

function positive(value, field) {
  const number = finite(value, field);
  if (!(number > 0)) inputError(RangeError, field, `${field} must be greater than zero.`);
  return number;
}

function nonNegative(value, field) {
  const number = finite(value, field);
  if (number < 0) inputError(RangeError, field, `${field} must be non-negative.`);
  return number;
}

function normalizeBolt(bolt, index) {
  const prefix = `bolts[${index}]`;
  const boltId = requiredText(bolt?.boltId, `${prefix}.boltId`);
  const minimumPreloadN = nonNegative(bolt?.minimumPreloadN, `${prefix}.minimumPreloadN`);
  const targetPreloadN = positive(bolt?.targetPreloadN, `${prefix}.targetPreloadN`);
  const maximumPreloadN = nonNegative(bolt?.maximumPreloadN, `${prefix}.maximumPreloadN`);

  if (minimumPreloadN > targetPreloadN) {
    inputError(RangeError, `${prefix}.minimumPreloadN`, 'minimumPreloadN must not exceed targetPreloadN.');
  }
  if (maximumPreloadN < targetPreloadN) {
    inputError(RangeError, `${prefix}.maximumPreloadN`, 'maximumPreloadN must not be below targetPreloadN.');
  }

  return Object.freeze({
    boltId,
    minimumPreloadN,
    targetPreloadN,
    maximumPreloadN,
    lowerDeviationN: targetPreloadN - minimumPreloadN,
    upperDeviationN: maximumPreloadN - targetPreloadN,
    minimumToTargetRatio: minimumPreloadN / targetPreloadN,
    maximumToTargetRatio: maximumPreloadN / targetPreloadN,
    boundWidthN: maximumPreloadN - minimumPreloadN,
    boundWidthFractionOfTarget: (maximumPreloadN - minimumPreloadN) / targetPreloadN,
  });
}

function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}

export function assessExplicitPreloadEnvelope(input = {}) {
  const assemblyMethodId = requiredText(input.assemblyMethodId, 'assemblyMethodId');
  const sequenceId = requiredText(input.sequenceId, 'sequenceId');
  const uncertaintyBasisId = requiredText(input.uncertaintyBasisId, 'uncertaintyBasisId');

  if (!Array.isArray(input.bolts) || input.bolts.length === 0) {
    inputError(TypeError, 'bolts', 'bolts must be a non-empty array of explicit preload bounds.');
  }

  const bolts = input.bolts.map(normalizeBolt);
  const seen = new Set();
  for (const bolt of bolts) {
    if (seen.has(bolt.boltId)) inputError(RangeError, 'bolts', `Duplicate boltId: ${bolt.boltId}`);
    seen.add(bolt.boltId);
  }

  const minimumClampN = sum(bolts, 'minimumPreloadN');
  const targetClampN = sum(bolts, 'targetPreloadN');
  const maximumClampN = sum(bolts, 'maximumPreloadN');
  const lowerClampDeviationN = targetClampN - minimumClampN;
  const upperClampDeviationN = maximumClampN - targetClampN;

  return Object.freeze({
    method: EXPLICIT_PRELOAD_ENVELOPE_METHOD,
    sourceAuthority: 'EXPLICIT_INPUT_BOUND_ONLY',
    assemblyMethodId,
    sequenceId,
    uncertaintyBasisId,
    boltCount: bolts.length,
    bolts: Object.freeze(bolts),
    jointClamp: Object.freeze({
      minimumClampN,
      targetClampN,
      maximumClampN,
      lowerClampDeviationN,
      upperClampDeviationN,
      minimumToTargetRatio: minimumClampN / targetClampN,
      maximumToTargetRatio: maximumClampN / targetClampN,
      boundWidthN: maximumClampN - minimumClampN,
      boundWidthFractionOfTarget: (maximumClampN - minimumClampN) / targetClampN,
    }),
    combinationRule: 'SIMULTANEOUS_EXPLICIT_BOUNDS_SUM',
    probabilisticInterpretation: false,
    predictsElasticInteraction: false,
    predictsSequenceEffects: false,
    predictsToolScatter: false,
    predictsFrictionScatter: false,
    codeCompliance: false,
    canUseForDesignAuthority: false,
    governingEligible: false,
    limitations: Object.freeze([
      'Every bolt minimum, target and maximum preload is caller/project supplied; this method creates no scatter defaults.',
      'Joint clamp bounds are arithmetic sums of simultaneous explicit bolt extrema and are not statistical confidence limits.',
      'No elastic-interaction, tightening-sequence, gasket-relaxation, tool, friction or tensioning-loss behavior is predicted.',
      'Assembly method, sequence and uncertainty basis identifiers are metadata only and do not select hidden calculation rules.',
    ]),
  });
}
