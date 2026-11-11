export const LEGACY_BS5500_WORKBOOK_METHOD = 'LEGACY_BS5500_WORKBOOK_BENCHMARK';

function fail(Type, field, message) {
  const error = new Type(message);
  error.code = 'INPUT_INVALID';
  error.field = field;
  throw error;
}

function finite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(TypeError, field, `${field} must be finite.`);
  return number;
}

function positive(value, field) {
  const number = finite(value, field);
  if (!(number > 0)) fail(RangeError, field, `${field} must be greater than zero.`);
  return number;
}

function nonNegative(value, field) {
  const number = finite(value, field);
  if (number < 0) fail(RangeError, field, `${field} must be non-negative.`);
  return number;
}

function positiveInteger(value, field) {
  const number = positive(value, field);
  if (!Number.isInteger(number)) fail(RangeError, field, `${field} must be an integer.`);
  return number;
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) fail(TypeError, field, `${field} is required.`);
  return text;
}

function toWorkbookUnits(input) {
  return {
    p: nonNegative(input.designPressurePa, 'designPressurePa') / 1e6,
    go: positive(input.goM, 'goM') * 1000,
    h: nonNegative(input.hM, 'hM') * 1000,
    g1: positive(input.g1M, 'g1M') * 1000,
    t: positive(input.flangeThicknessM, 'flangeThicknessM') * 1000,
    B: positive(input.flangeInsideDiameterM, 'flangeInsideDiameterM') * 1000,
    C: positive(input.boltCircleDiameterM, 'boltCircleDiameterM') * 1000,
    A: positive(input.flangeOutsideDiameterM, 'flangeOutsideDiameterM') * 1000,
    gasketType: requiredText(input.gasketType, 'gasketType'),
    gasketOd: positive(input.gasketOuterDiameterM, 'gasketOuterDiameterM') * 1000,
    gasketId: positive(input.gasketInnerDiameterM, 'gasketInnerDiameterM') * 1000,
    m: nonNegative(input.gasketMFactor, 'gasketMFactor'),
    y: nonNegative(input.gasketYPa, 'gasketYPa') / 1e6,
    boltCount: positiveInteger(input.boltCount, 'boltCount'),
    boltDiameter: positive(input.boltDiameterM, 'boltDiameterM') * 1000,
    boltRootArea: positive(input.singleBoltRootAreaM2, 'singleBoltRootAreaM2') * 1e6,
    Sb: positive(input.boltOperatingAllowablePa, 'boltOperatingAllowablePa') / 1e6,
    Sa: positive(input.boltAmbientAllowablePa, 'boltAmbientAllowablePa') / 1e6,
    F: positive(input.shapeF, 'shapeF'),
    V: positive(input.shapeV, 'shapeV'),
    f: positive(input.shapeStressFactor, 'shapeStressFactor'),
    appliedMoment: finite(input.appliedOperatingMomentNm, 'appliedOperatingMomentNm') * 1000,
  };
}

function validateGeometry(x) {
  if (!(x.A > x.B)) fail(RangeError, 'flangeOutsideDiameterM', 'Flange outside diameter A must exceed B.');
  if (!(x.C > x.B)) fail(RangeError, 'boltCircleDiameterM', 'Bolt circle diameter C must exceed B.');
  if (!(x.gasketOd > x.gasketId)) {
    fail(RangeError, 'gasketOuterDiameterM', 'Gasket outside diameter must exceed inside diameter.');
  }
}

function shapeConstants(x) {
  const K = x.A / x.B;
  if (!(K > 1 + 1e-12)) fail(RangeError, 'flangeOutsideDiameterM', 'Legacy shape constants require K=A/B > 1.');
  const k2 = K ** 2;
  const logK = Math.log10(K);
  const T = (k2 * (1 + 8.55246 * logK) - 1) / ((1.0472 + 1.9448 * k2) * (K - 1));
  const U = (k2 * (1 + 8.55246 * logK) - 1) / (1.36136 * (k2 - 1) * (K - 1));
  const Y = (0.66845 + 5.7169 * k2 * logK / (k2 - 1)) / (K - 1);
  const Z = (k2 + 1) / (k2 - 1);
  const ho = Math.sqrt(x.B * x.go);
  const e = x.F / ho;
  const d = (U / x.V) * ho * x.go ** 2;
  return { K, T, U, Y, Z, ho, e, d };
}

function gasketGeometry(x) {
  const N = (x.gasketOd - x.gasketId) / 2;
  const bo = N / 2;
  const ringJoint = x.gasketType.toLowerCase() === 'ring joint';
  const b = ringJoint ? N / 8 : Math.min(bo, 2.52 * Math.sqrt(bo));
  const G = x.gasketOd - 2 * b;
  if (!(b > 0) || !(G > 0)) fail(RangeError, 'gasketOuterDiameterM', 'Legacy gasket geometry is invalid.');
  return { N, bo, b, G, ringJoint };
}

function pressureLoads(x, gasket) {
  const Hd = 0.785 * x.B ** 2 * x.p;
  const H = 0.785 * gasket.G ** 2 * x.p;
  const Hg = 6.28 * gasket.b * gasket.G * x.m * x.p;
  return { Hd, H, Hg, Ht: H - Hd };
}

function momentArms(x, gasket) {
  return {
    hd: (x.C - x.B - x.g1) / 2,
    hg: (x.C - gasket.G) / 2,
    ht: (2 * x.C - x.B - gasket.G) / 4,
  };
}

function bolting(x, gasket, loads, arms) {
  const Wm1 = loads.H + loads.Hg;
  const Wm2 = 3.14 * gasket.b * gasket.G * x.y;
  const Am1 = Wm1 / x.Sb;
  const Am2 = Wm2 / x.Sa;
  const Am = Math.max(Am1, Am2);
  const Ab = x.boltCount * x.boltRootArea;
  const W = (Ab + Am) * x.Sa / 2;
  return { Wm1, Wm2, Am1, Am2, Am, Ab, W, Matm: W * arms.hg };
}

function correctionAndStressFactors(x, shape) {
  const numerator = 3.14 * x.C / x.boltCount;
  const denominator = 2 * x.boltDiameter + 6 * x.t / (x.m + 0.5);
  const Cf = Math.max(1, Math.sqrt(numerator / denominator));
  const radialB = (4 / 3) * x.t * shape.e + 1;
  const l = (x.t * shape.e + 1) / shape.T + x.t ** 3 / shape.d;
  if (!(l > 0)) fail(RangeError, 'flangeThicknessM', 'Legacy stress factor l must be positive.');
  return { Cf, radialB, l };
}

function stresses(reducedMomentN, x, shape, factors) {
  const Sh = x.f * reducedMomentN / (factors.l * x.g1 ** 2);
  const Sr = factors.radialB * reducedMomentN / (factors.l * x.t ** 2);
  const St = reducedMomentN * shape.Y / x.t ** 2 - shape.Z * Sr;
  return { Sh, Sr, St, combined: 0.5 * (Sh + Math.max(Sr, St)) };
}

function stressResult(reducedMomentN, values) {
  const s = stresses(reducedMomentN, values.x, values.shape, values.factors);
  return Object.freeze({
    reducedMomentN,
    hubStressPa: s.Sh * 1e6,
    radialStressPa: s.Sr * 1e6,
    tangentialStressPa: s.St * 1e6,
    combinedStressPa: s.combined * 1e6,
  });
}

export function calculateLegacyBs5500WorkbookFlange(input = {}) {
  const x = toWorkbookUnits(input);
  validateGeometry(x);
  const gasket = gasketGeometry(x);
  const shape = shapeConstants(x);
  const loads = pressureLoads(x, gasket);
  const arms = momentArms(x, gasket);
  const calculatedOperatingMoment = loads.Hd * arms.hd + loads.Hg * arms.hg + loads.Ht * arms.ht;
  const totalOperatingMoment = calculatedOperatingMoment + x.appliedMoment;
  const bolts = bolting(x, gasket, loads, arms);
  const factors = correctionAndStressFactors(x, shape);
  const operatingReducedMomentN = totalOperatingMoment * factors.Cf / x.B;
  const boltUpReducedMomentN = bolts.Matm * factors.Cf / x.B;
  const values = { x, shape, factors };

  return Object.freeze({
    method: LEGACY_BS5500_WORKBOOK_METHOD,
    sourceBasis: 'FLANGE_DESIGN_TO_BS5500_XLS_BIFF8_RECOVERED_FORMULAS',
    sourceAuthority: 'LEGACY_BENCHMARK_ONLY',
    gasket: Object.freeze({
      effectiveWidthM: gasket.b / 1000,
      reactionDiameterM: gasket.G / 1000,
      basicWidthM: gasket.bo / 1000,
      ringJointBranch: gasket.ringJoint,
    }),
    shape: Object.freeze({
      K: shape.K, T: shape.T, U: shape.U, Y: shape.Y, Z: shape.Z,
      hoM: shape.ho / 1000, hOverHo: x.h / shape.ho, ePerM: shape.e * 1000, dM3: shape.d * 1e-9,
    }),
    pressureLoads: Object.freeze({ Hn: loads.H, Hdn: loads.Hd, Hgn: loads.Hg, Htn: loads.Ht }),
    momentArmsM: Object.freeze({ hd: arms.hd / 1000, hg: arms.hg / 1000, ht: arms.ht / 1000 }),
    bolting: Object.freeze({
      Wm1n: bolts.Wm1, Wm2n: bolts.Wm2,
      Am1M2: bolts.Am1 / 1e6, Am2M2: bolts.Am2 / 1e6, requiredAreaM2: bolts.Am / 1e6,
      actualAreaM2: bolts.Ab / 1e6, assemblyBoltLoadN: bolts.W, boltUpMomentNm: bolts.Matm / 1000,
    }),
    factors: Object.freeze({ correctionFactor: factors.Cf, radialStressFactorB: factors.radialB, l: factors.l }),
    operating: stressResult(operatingReducedMomentN, values),
    boltUp: stressResult(boltUpReducedMomentN, values),
    calculatedOperatingMomentNm: calculatedOperatingMoment / 1000,
    totalOperatingMomentNm: totalOperatingMoment / 1000,
    acceptanceEvaluated: false,
    codeCompliance: false,
    canUseForDesignAuthority: false,
    governingEligible: false,
    limitations: Object.freeze([
      'Faithful legacy-workbook benchmark only; governing BS5500/PD5500 source applicability is not established.',
      'Literal workbook constants are preserved, including 0.785, 3.14, 6.28 and recovered shape-factor coefficients.',
      'Material, gasket and bolt values are caller inputs; no master-data authority is implied.',
      'Workbook acceptance statements are not evaluated or promoted to design authority.',
    ]),
  });
}
