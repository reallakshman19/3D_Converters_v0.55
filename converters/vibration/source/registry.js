import { createEngineeringMethodSource } from './method-source-record.js';

export const VIBRATION_SOURCE_REGISTRY_SCHEMA = 'VibrationEngineeringSourceRegistry.v1';
export const VIBRATION_SOURCE_REGISTRY_REVISION = 'VIB-SOURCE-ID-2026-08-18-MECHANICAL-T23';

const EI_PUBLICATION = Object.freeze({
  publisher: 'Energy Institute',
  publication: 'Guidelines for the avoidance of vibration induced fatigue failure in process pipework',
  edition: '2nd',
  publicationDate: '2008-01',
  isbn: '9780852934630',
  methodId: 'EI_AVIFF_PROCESS_PIPEWORK_2E',
});

const MODULE_PAGES = Object.freeze({
  T1: 33, T2: 47, T3: 70, T4: 85, T5: 89, T6: 108, T7: 114,
  T8: 119, T9: 122, T10: 126, T11: 140, T12: 147, T13: 149,
});

function eiSource(sourceId, values) {
  return createEngineeringMethodSource({
    ...EI_PUBLICATION,
    sourceId,
    ...values,
  });
}

const SOURCES = [
  ...Object.entries(MODULE_PAGES).map(([technicalModule, printedPage]) => eiSource(
    `EI_AVIFF_2008:${technicalModule}`,
    { technicalModule, printedPage, status: 'CONTROLLED', locatorBasis: 'CONTROLLED_SOURCE' },
  )),
  eiSource('EI_AVIFF_2008:T2:FIT', {
    mechanismId: 'fit', technicalModule: 'T2', sectionId: 'T2.2',
    status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL',
    notes: ['Section label retained from current repository; exact controlled flowchart identity is unresolved.'],
  }),
  eiSource('EI_AVIFF_2008:T2:MECHANICAL', {
    mechanismId: 'mechanicalExcitation', technicalModule: 'T2', sectionId: 'T2.3', tableId: 'T2-3',
    printedPage: 54, pdfPage: 62,
    status: 'CONTROLLED', locatorBasis: 'CONTROLLED_SOURCE',
    notes: ['Direct machinery baseline screening is bounded to Table T2-3. Shared-support transfer and post-dynamic-analysis reduction remain separately unqualified.'],
  }),
  eiSource('EI_AVIFF_2008:T2:RECIP_PD', {
    mechanismId: 'reciprocatingPulsation', technicalModule: 'T2', sectionId: 'T2.4',
    status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL',
    notes: ['Do not reinterpret dotted section T2.4 as a hyphenated flowchart identifier.'],
  }),
  eiSource('EI_AVIFF_2008:T2:ROTATING_STALL', {
    mechanismId: 'rotatingStall', technicalModule: 'T2', sectionId: 'T2.5',
    status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL',
  }),
  eiSource('EI_AVIFF_2008:T2:DEADLEG', {
    mechanismId: 'deadlegPulsation', technicalModule: 'T2', caption: 'Repository label: EI AVIFF worked-example section',
    status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL',
    notes: ['Exact controlled section/flowchart identity remains unresolved.'],
  }),
  eiSource('EI_AVIFF_2008:T2:AIV', {
    mechanismId: 'aiv', technicalModule: 'T2', sectionId: 'T2.7',
    status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL',
  }),
  eiSource('EI_AVIFF_2008:T2:VALVE_TRANSIENTS', {
    mechanismId: 'valveTransients', technicalModule: 'T2', sectionId: 'T2.8',
    status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL',
  }),
  eiSource('EI_AVIFF_2008:T2:CAVITATION_FLASHING', {
    mechanismId: 'cavitationFlashing', technicalModule: 'T2', sectionId: 'T2.9',
    status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL',
  }),
  createEngineeringMethodSource({
    sourceId: 'ASME_PTC_19_3_TW_2016:REPOSITORY_LABEL',
    methodId: 'ASME_PTC_19_3_TW_2016', mechanismId: 'thermowells',
    publisher: 'ASME', publication: 'PTC 19.3 TW', edition: '2016',
    caption: 'ASME PTC 19.3 TW-2016 repository label',
    status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL',
    notes: ['Repository label only; engineering authority is not established by this registry.'],
  }),
];

const BY_ID = new Map(SOURCES.map((record) => [record.sourceId, record]));

const SOURCE_BINDING_STATUSES = Object.freeze(['RESOLVED', 'RECONCILIATION_REQUIRED', 'CONFLICTED', 'UNRESOLVED']);

function binding(input) {
  if (!SOURCE_BINDING_STATUSES.includes(input.status)) throw new Error(`VIBRATION_SOURCE_BINDING_STATUS_INVALID:${input.status}`);
  const sourceIds = Object.freeze([...(input.sourceIds ?? [])]);
  if (input.status === 'CONFLICTED' && sourceIds.length < 2) throw new Error('VIBRATION_SOURCE_BINDING_CONFLICT_REQUIRES_MULTIPLE_SOURCES');
  if (['RESOLVED', 'RECONCILIATION_REQUIRED'].includes(input.status) && sourceIds.length < 1) throw new Error('VIBRATION_SOURCE_BINDING_SOURCE_REQUIRED');
  return Object.freeze({ bindingId: input.bindingId, status: input.status, sourceIds, reason: input.reason ?? null });
}

const MECHANISM_BINDINGS = Object.freeze({
  fit: binding({ bindingId: 'mechanism:fit', status: 'RECONCILIATION_REQUIRED', sourceIds: ['EI_AVIFF_2008:T2:FIT'] }),
  mechanicalExcitation: binding({ bindingId: 'mechanism:mechanicalExcitation', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T2:MECHANICAL'] }),
  reciprocatingPulsation: binding({ bindingId: 'mechanism:reciprocatingPulsation', status: 'RECONCILIATION_REQUIRED', sourceIds: ['EI_AVIFF_2008:T2:RECIP_PD'] }),
  rotatingStall: binding({ bindingId: 'mechanism:rotatingStall', status: 'RECONCILIATION_REQUIRED', sourceIds: ['EI_AVIFF_2008:T2:ROTATING_STALL'] }),
  deadlegPulsation: binding({ bindingId: 'mechanism:deadlegPulsation', status: 'RECONCILIATION_REQUIRED', sourceIds: ['EI_AVIFF_2008:T2:DEADLEG'] }),
  aiv: binding({ bindingId: 'mechanism:aiv', status: 'RECONCILIATION_REQUIRED', sourceIds: ['EI_AVIFF_2008:T2:AIV'] }),
  valveTransients: binding({ bindingId: 'mechanism:valveTransients', status: 'RECONCILIATION_REQUIRED', sourceIds: ['EI_AVIFF_2008:T2:VALVE_TRANSIENTS'] }),
  cavitationFlashing: binding({ bindingId: 'mechanism:cavitationFlashing', status: 'RECONCILIATION_REQUIRED', sourceIds: ['EI_AVIFF_2008:T2:CAVITATION_FLASHING'] }),
  smallBoreConnections: binding({ bindingId: 'mechanism:smallBoreConnections', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T3'] }),
  thermowells: binding({
    bindingId: 'mechanism:thermowells', status: 'CONFLICTED',
    sourceIds: ['EI_AVIFF_2008:T4', 'ASME_PTC_19_3_TW_2016:REPOSITORY_LABEL'],
    reason: 'EI T4 technical-module identity and current repository ASME PTC 19.3 TW-2016 label must not be silently combined.',
  }),
});

const NODE_BINDINGS = Object.freeze({
  'mechanism-identification': binding({ bindingId: 'node:mechanism-identification', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T1'] }),
  'visual-piping': binding({ bindingId: 'node:visual-piping', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T5'] }),
  'visual-tubing': binding({ bindingId: 'node:visual-tubing', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T6'] }),
  'basic-measurement': binding({ bindingId: 'node:basic-measurement', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T7'] }),
  'specialist-measurement': binding({ bindingId: 'node:specialist-measurement', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T8'] }),
  'predictive-analysis': binding({ bindingId: 'node:predictive-analysis', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T9'] }),
  'mainline-mitigation': binding({ bindingId: 'node:mainline-mitigation', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T10'] }),
  'branch-mitigation': binding({ bindingId: 'node:branch-mitigation', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T11'] }),
  'thermowell-mitigation': binding({ bindingId: 'node:thermowell-mitigation', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T12'] }),
  'good-design-practice': binding({ bindingId: 'node:good-design-practice', status: 'RESOLVED', sourceIds: ['EI_AVIFF_2008:T13'] }),
  'post-mod-verification': binding({
    bindingId: 'node:post-mod-verification', status: 'UNRESOLVED', sourceIds: [],
    reason: 'No EI T1-T13 module is assigned by this registry as the sole authority for generic post-modification verification.',
  }),
});

function sourceLabel(record) {
  const typed = [record.sectionId, record.flowchartId, record.tableId].filter(Boolean).join(' · ');
  return typed || record.technicalModule || record.caption || record.sourceId;
}

function resolveBinding(value) {
  if (!value) return Object.freeze({ status: 'UNRESOLVED', sourceIds: Object.freeze([]), sources: Object.freeze([]), displayLabel: 'Source unresolved', reason: null });
  const sources = value.sourceIds.map((sourceId) => BY_ID.get(sourceId));
  if (sources.some((source) => !source)) throw new Error(`VIBRATION_SOURCE_BINDING_SOURCE_MISSING:${value.bindingId}`);
  if (value.status === 'RESOLVED' && sources.some((source) => source.status !== 'CONTROLLED')) {
    throw new Error(`VIBRATION_SOURCE_BINDING_RESOLVED_SOURCE_NOT_CONTROLLED:${value.bindingId}`);
  }
  let displayLabel = sources.length ? sources.map(sourceLabel).join(' + ') : 'Source unresolved';
  if (value.status === 'CONFLICTED') displayLabel = `Source conflict: ${sources.map(sourceLabel).join(' ↔ ')}`;
  if (value.status === 'RECONCILIATION_REQUIRED') displayLabel = `${displayLabel} · reconciliation required`;
  return Object.freeze({ ...value, sources: Object.freeze(sources), displayLabel });
}

export function getVibrationEngineeringSource(sourceId) {
  return BY_ID.get(String(sourceId ?? '')) ?? null;
}

export function listVibrationEngineeringSources() {
  return Object.freeze([...SOURCES]);
}

export function resolveVibrationRoadmapSourceBinding({ mechanismId = null, nodeId = null } = {}) {
  const value = mechanismId ? MECHANISM_BINDINGS[mechanismId] : NODE_BINDINGS[nodeId];
  return resolveBinding(value);
}

export const VIBRATION_ENGINEERING_SOURCE_REGISTRY = Object.freeze({
  schema: VIBRATION_SOURCE_REGISTRY_SCHEMA,
  revision: VIBRATION_SOURCE_REGISTRY_REVISION,
  sources: Object.freeze([...SOURCES]),
  authority: Object.freeze({
    purpose: 'SOURCE_IDENTITY_AND_LOCATOR_CUSTODY_ONLY',
    engineeringAuthority: 'NONE', screeningAuthority: 'NOT_AUTHORIZED', designAuthority: false,
  }),
});
