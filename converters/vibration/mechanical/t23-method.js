export const MECHANICAL_T23_METHOD_ID = 'VIB.MECHANICAL.T2_3.BASELINE';
export const MECHANICAL_T23_METHOD_REVISION = 'ei-aviff2-t2-3-direct-baseline-v1';

export const MECHANICAL_T23_CONTROLLED_SOURCE = Object.freeze({
  publisher: 'Energy Institute',
  publication: 'Guidelines for the avoidance of vibration induced fatigue failure in process pipework',
  edition: '2nd',
  publicationDate: '2008-01',
  isbn: '9780852934630',
  repository: 'reallaksh19/Common',
  commit: 'aef163a5def3bfe04ca0ba860da05728a27daf42',
  path: 'EI - AVIFF Guidelines 2nd Edition.pdf',
  gitBlobSha1: '9d3eccc56429411e17c07a579bdebbd13cb0bdc5',
  technicalModule: 'T2',
  sectionId: 'T2.3',
  tableId: 'T2-3',
  printedPage: 54,
  sourceState: 'CONTROLLED_METHOD_REFERENCE',
});

function row(sourceKey, baselineLof, qualificationGate) {
  return Object.freeze({ sourceKey, baselineLof, qualificationGate });
}

export const MECHANICAL_T23_DIRECT_BASELINE_ROWS = Object.freeze([
  row('RECIP_PD_COMPRESSOR_OR_PUMP', 0.90, 'BASELINE_ONLY_DYNAMIC_REDUCTION_NOT_APPLIED'),
  row('DIESEL_OR_GAS_ENGINE_DRIVE', 0.80, 'BASELINE_ONLY_DYNAMIC_REDUCTION_NOT_APPLIED'),
  row('SCREW_COMPRESSOR_OR_PUMP', 0.60, 'DIRECT_TABLE_T2_3_BASELINE'),
  row('CENTRIFUGAL_PUMP', 0.40, 'DIRECT_TABLE_T2_3_BASELINE'),
  row('ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW', 0.40, 'DIRECT_TABLE_T2_3_BASELINE'),
  row('ELECTRIC_MOTOR_OR_ALTERNATOR_LT_15KW', 0.20, 'DIRECT_TABLE_T2_3_BASELINE'),
  row('CENTRIFUGAL_COMPRESSOR', 0.20, 'DIRECT_TABLE_T2_3_BASELINE'),
  row('GAS_TURBINE', 0.20, 'DIRECT_TABLE_T2_3_BASELINE'),
  row('FAN_OR_BLOWER', 0.20, 'DIRECT_TABLE_T2_3_BASELINE'),
]);

export const MECHANICAL_T23_SHARED_SUPPORT_RULE = Object.freeze({
  sourceKey: 'PIPEWORK_SHARING_SUPPORTS_WITH_LINE_LOF_GE_0_50',
  adjacentLofThreshold: 0.50,
  resultRule: 'EQUAL_ADJACENT_PIPEWORK_LOF',
  implementationState: 'NOT_IMPLEMENTED_IN_DIRECT_BASELINE_SCREENING',
  screeningAuthority: 'NOT_AUTHORIZED',
});

export const MECHANICAL_T23_DYNAMIC_REDUCTION_RULE = Object.freeze({
  applicableSourceKeys: Object.freeze([
    'RECIP_PD_COMPRESSOR_OR_PUMP',
    'DIESEL_OR_GAS_ENGINE_DRIVE',
  ]),
  reducedLof: 0.40,
  prerequisite: 'DETAILED_STRUCTURAL_DYNAMIC_ANALYSIS_NO_EXCITATION_FREQUENCY_COINCIDENCE',
  implementationState: 'NOT_IMPLEMENTED_IN_DIRECT_BASELINE_SCREENING',
  screeningAuthority: 'NOT_AUTHORIZED',
});

const BY_SOURCE = new Map(MECHANICAL_T23_DIRECT_BASELINE_ROWS.map((item) => [item.sourceKey, item]));

function normalizedKeys(sourceKeys) {
  if (!Array.isArray(sourceKeys)) throw new TypeError('MECHANICAL_T23_SOURCE_KEYS_INVALID');
  const keys = [...new Set(sourceKeys.map((value) => String(value ?? '').trim()).filter(Boolean))];
  if (!keys.length) throw new TypeError('MECHANICAL_T23_SOURCE_SELECTION_REQUIRED');
  if (keys.includes(MECHANICAL_T23_SHARED_SUPPORT_RULE.sourceKey)) {
    throw new Error('MECHANICAL_T23_SHARED_SUPPORT_REQUIRES_ADJACENT_LOF');
  }
  const unknown = keys.find((key) => !BY_SOURCE.has(key));
  if (unknown) throw new Error(`MECHANICAL_T23_SOURCE_UNKNOWN:${unknown}`);
  return keys;
}

export function evaluateMechanicalT23DirectBaseline(sourceKeys) {
  const keys = normalizedKeys(sourceKeys);
  const rows = keys.map((key) => BY_SOURCE.get(key));
  const governing = rows.reduce((current, item) => (
    item.baselineLof > current.baselineLof ? item : current
  ));
  return Object.freeze({
    schema: 'MechanicalT23DirectBaselineScreening.v1',
    methodId: MECHANICAL_T23_METHOD_ID,
    methodRevision: MECHANICAL_T23_METHOD_REVISION,
    resultScope: 'FACILITY_LINE_CASE',
    status: 'SCREENING_CALCULATED',
    sourceKeys: Object.freeze([...keys]),
    governingLof: governing.baselineLof,
    governingSourceKey: governing.sourceKey,
    rows: Object.freeze([...rows]),
    provenance: Object.freeze({ source: MECHANICAL_T23_CONTROLLED_SOURCE }),
    authority: Object.freeze({
      calculationState: 'IMPLEMENTED',
      qualificationState: 'SCREENING',
      engineeringAuthority: 'SCREENING',
      screeningAuthority: 'AUTHORIZED',
      authorityScope: 'DIRECT_TABLE_T2_3_BASELINE_ONLY',
      dynamicReductionAuthorized: false,
      sharedSupportTransferAuthorized: false,
      designAuthority: false,
    }),
  });
}
