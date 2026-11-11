import {
  VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA,
  assertVibrationMeasurementEvidencePackage,
} from '../measurement/contracts.js';
import {
  assertVibrationIntegrityProject,
  cloneProjectValue,
  deepFreezeProjectValue,
} from './schema.js';

export function createEmptyVibrationMeasurementEvidencePackage() {
  return deepFreezeProjectValue({
    schema: VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA,
    sessions: [],
    products: [],
    authority: {
      containerAuthority: 'MEASUREMENT_EVIDENCE_CONTAINER_ONLY',
      screeningAuthorized: false,
      designAuthority: false,
      rootCauseAuthority: false,
    },
  });
}

export function attachVibrationMeasurementEvidence(project, measurementEvidence) {
  assertVibrationIntegrityProject(project);
  assertVibrationMeasurementEvidencePackage(measurementEvidence);
  const next = cloneProjectValue(project);
  next.measurementEvidence = cloneProjectValue(measurementEvidence);
  assertVibrationIntegrityProject(next);
  return deepFreezeProjectValue(next);
}
