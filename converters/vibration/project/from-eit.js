import { ENERGY_INSTITUTE_EIT_IMPORT_SCHEMA } from '../eit/contract.js';
import { createEmptyVibrationMeasurementEvidencePackage } from './measurement.js';
import {
  VIBRATION_INTEGRITY_PROJECT_AUTHORITY,
  VIBRATION_INTEGRITY_PROJECT_SCHEMA,
  assertVibrationIntegrityProject,
  cloneProjectValue,
  createVibrationProjectError,
  deepFreezeProjectValue,
} from './schema.js';

function safeId(value) {
  return encodeURIComponent(String(value ?? '').trim() || 'unassigned');
}

function lineId(line) {
  const identity = line.rid ?? `index-${line.lineIndex + 1}`;
  return `eit-line:${safeId(identity)}`;
}

function meaningfulModule(payload) {
  return payload.known && (payload.declaredInModules || payload.resultPresent || payload.dataPresent || payload.parseState === 'MALFORMED');
}

function projectLines(eitImport) {
  const rows = eitImport.lines.map((line) => ({
    lineId: lineId(line),
    identityAuthority: 'EIT_COMPATIBILITY_ONLY',
    legacyEit: {
      rid: line.rid, pnid: line.pnid, lineReference: line.lineReference,
      lineDescription: line.lineDescription, pipeIndex: line.pipeIndex, streamIndex: line.streamIndex,
    },
  }));
  const ids = rows.map((row) => row.lineId);
  if (new Set(ids).size !== ids.length) {
    throw createVibrationProjectError('VIBRATION_PROJECT_EIT_DUPLICATE_LINE_ID', 'Imported .eit line identity is not unique enough to create stable project subjects.', { lineIds: ids });
  }
  return rows;
}

function mechanismImports(eitImport) {
  return eitImport.lines.flatMap((line) => line.modules.filter(meaningfulModule).map((payload) => ({
    recordId: `${lineId(line)}:${payload.mechanismId}:${payload.code}`,
    lineId: lineId(line),
    mechanismId: payload.mechanismId,
    sourceFormat: 'EnergyInstituteEit.v5',
    eitModuleCode: payload.code,
    importedResultAuthority: 'HISTORICAL_REVIEW_REQUIRED',
    payload: cloneProjectValue(payload),
  })));
}

function unknownModuleImports(eitImport) {
  return eitImport.lines.flatMap((line) => line.modules.filter((payload) => !payload.known).map((payload) => ({
    lineId: lineId(line), moduleCode: payload.code, raw: cloneProjectValue(payload), disposition: 'UNKNOWN_COMPATIBILITY_PAYLOAD',
  })));
}

export function buildVibrationIntegrityProjectFromEit(eitImport, options = {}) {
  if (eitImport?.schema !== ENERGY_INSTITUTE_EIT_IMPORT_SCHEMA) {
    throw createVibrationProjectError('VIBRATION_PROJECT_EIT_IMPORT_REQUIRED', `Project EIT adapter requires ${ENERGY_INSTITUTE_EIT_IMPORT_SCHEMA}.`, { actual: eitImport?.schema ?? null });
  }
  const project = {
    schema: VIBRATION_INTEGRITY_PROJECT_SCHEMA,
    project: {
      projectId: String(options.projectId ?? `eit-project:${safeId(eitImport.options?.project)}`),
      title: String(options.title ?? eitImport.options?.title ?? eitImport.sourceName ?? 'Vibration Integrity Project'),
      sourceKind: 'ENERGY_INSTITUTE_EIT_IMPORT',
      legacyEitProjectId: eitImport.options?.project ?? null,
    },
    sourceImports: { eit: cloneProjectValue(eitImport) },
    subjects: { lines: projectLines(eitImport) },
    mechanismImports: mechanismImports(eitImport),
    unknownCompatibilityModules: unknownModuleImports(eitImport),
    currentResults: [],
    measurements: [],
    measurementEvidence: createEmptyVibrationMeasurementEvidencePackage(),
    actions: [],
    authority: {
      containerAuthority: VIBRATION_INTEGRITY_PROJECT_AUTHORITY,
      importedResultsAreCurrentEngineeringAuthority: false,
      measurementEvidenceIsCurrentEngineeringAuthority: false,
      screeningAuthorized: false,
      designAuthority: false,
      rootCauseAuthority: false,
    },
  };
  assertVibrationIntegrityProject(project);
  return deepFreezeProjectValue(project);
}
