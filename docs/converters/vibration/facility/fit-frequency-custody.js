import { FIT_FACILITY_ENRICHMENT_PROPERTIES } from './fit-plan-contract.js';
import {
  fitFacilityEnrichmentRow,
  fitFacilityEnrichmentTrace,
} from './fit-plan-context.js';

export const FIT_FACILITY_NATURAL_FREQUENCY_CUSTODY_SCHEMA = 'FitFacilityNaturalFrequencyCustody.v1';

const AUTHORITY = Object.freeze({
  authority: 'FREQUENCY_PROVENANCE_CUSTODY_ONLY',
  numericalMethodAuthority: false,
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
});

const REQUIRED_PROVENANCE = Object.freeze([
  ['source', 'naturalFrequency.source'],
  ['sourceRevision', 'naturalFrequency.sourceRevision'],
  ['recordId', 'naturalFrequency.recordId'],
  ['status', 'naturalFrequency.status'],
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function textOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function selectRow(index, canonicalId, caseId) {
  const property = FIT_FACILITY_ENRICHMENT_PROPERTIES.NATURAL_FREQUENCY;
  const caseSpecific = fitFacilityEnrichmentRow(index, canonicalId, property, caseId);
  if (caseSpecific) return { row: caseSpecific, selection: 'CASE_SPECIFIC' };
  const global = fitFacilityEnrichmentRow(index, canonicalId, property);
  if (global) return { row: global, selection: 'GLOBAL' };
  return { row: null, selection: 'NOT_PRESENT' };
}

function observedValue(row) {
  if (!row) return null;
  return deepFreeze({
    value: row.value ?? null,
    unit: row.unit ?? null,
  });
}

function provenance(row) {
  return deepFreeze({
    source: textOrNull(row?.source),
    sourceRevision: textOrNull(row?.sourceRevision),
    recordId: textOrNull(row?.recordId),
    status: textOrNull(row?.status),
    reviewer: textOrNull(row?.reviewer),
  });
}

function missingProvenance(row) {
  return REQUIRED_PROVENANCE
    .filter(([field]) => !textOrNull(row?.[field]))
    .map(([, name]) => name);
}

function valueValid(row) {
  return typeof row?.value === 'number'
    && Number.isFinite(row.value)
    && row.value > 0
    && Boolean(textOrNull(row.unit));
}

function notProvided() {
  return deepFreeze({
    schema: FIT_FACILITY_NATURAL_FREQUENCY_CUSTODY_SCHEMA,
    state: 'NOT_PROVIDED',
    selection: 'NOT_PRESENT',
    observed: null,
    resolved: null,
    provenance: provenance(null),
    missing: [],
    invalid: [],
    reasons: [],
    trace: null,
    authority: AUTHORITY,
  });
}

export function resolveFitFacilityNaturalFrequencyCustody({
  index,
  canonicalId,
  caseId,
} = {}) {
  const selected = selectRow(index, canonicalId, caseId);
  if (!selected.row) return notProvided();

  const missing = missingProvenance(selected.row);
  const invalid = valueValid(selected.row) ? [] : ['naturalFrequency'];
  const reasons = [
    ...(missing.length ? ['NATURAL_FREQUENCY_PROVENANCE_INCOMPLETE'] : []),
    ...(invalid.length ? ['NATURAL_FREQUENCY_VALUE_INVALID'] : []),
  ];
  const complete = missing.length === 0 && invalid.length === 0;
  const unit = textOrNull(selected.row.unit);

  return deepFreeze({
    schema: FIT_FACILITY_NATURAL_FREQUENCY_CUSTODY_SCHEMA,
    state: complete ? 'CUSTODIED' : 'INCOMPLETE',
    selection: selected.selection,
    observed: observedValue(selected.row),
    resolved: complete
      ? { value: selected.row.value, unit }
      : null,
    provenance: provenance(selected.row),
    missing: [...new Set(missing)].sort(),
    invalid,
    reasons,
    trace: fitFacilityEnrichmentTrace(selected.row, selected.selection),
    authority: AUTHORITY,
  });
}
