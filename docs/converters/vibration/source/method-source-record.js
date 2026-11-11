export const ENGINEERING_METHOD_SOURCE_SCHEMA = 'EngineeringMethodSource.v1';

export const ENGINEERING_METHOD_SOURCE_STATUSES = Object.freeze([
  'CONTROLLED',
  'RECONCILIATION_REQUIRED',
  'CONFLICTED',
  'QUARANTINED',
]);

export const ENGINEERING_SOURCE_LOCATOR_BASES = Object.freeze([
  'CONTROLLED_SOURCE',
  'REPOSITORY_LABEL',
  'MULTI_METHOD_CONFLICT',
]);

const ALLOWED_FIELDS = new Set([
  'sourceId', 'methodId', 'mechanismId', 'publisher', 'publication', 'edition',
  'publicationDate', 'isbn', 'technicalModule', 'sectionId', 'flowchartId',
  'equationId', 'tableId', 'figureId', 'printedPage', 'pdfPage', 'caption',
  'sourceArtifactHash', 'errataSetId', 'errataApplied', 'status', 'locatorBasis',
  'notes',
]);

function sourceError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'EngineeringMethodSourceError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function text(value, field, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) throw sourceError('ENGINEERING_METHOD_SOURCE_TEXT_REQUIRED', `${field} is required.`, { field });
    return null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_TEXT_INVALID', `${field} must be a non-empty string when provided.`, { field });
  }
  return value.trim();
}

function positiveInteger(value, field) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 1) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_PAGE_INVALID', `${field} must be a positive integer when provided.`, { field, value });
  }
  return value;
}

function stringArray(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_ARRAY_INVALID', `${field} must be an array of non-empty strings.`, { field });
  }
  return Object.freeze(value.map((item) => item.trim()));
}

function assertKnownFields(input) {
  const unknown = Object.keys(input).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_UNKNOWN_FIELD', 'Engineering source record contains unknown fields.', { unknown });
  }
}

function assertTypedLocator(record) {
  if (record.technicalModule && !/^T\d+$/.test(record.technicalModule)) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_TECHNICAL_MODULE_INVALID', 'technicalModule must use T<number> form.', { value: record.technicalModule });
  }
  if (record.sectionId && !/^T\d+(?:\.\d+)+$/.test(record.sectionId)) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_SECTION_INVALID', 'sectionId must use dotted T<section> form such as T2.2.', { value: record.sectionId });
  }
  if (record.flowchartId && !/^T\d+-\d+$/.test(record.flowchartId)) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_FLOWCHART_INVALID', 'flowchartId must use hyphenated flowchart form such as T2-4.', { value: record.flowchartId });
  }
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function createEngineeringMethodSource(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_OBJECT_REQUIRED', 'Engineering source input must be an object.');
  }
  assertKnownFields(input);
  const status = text(input.status, 'status', { required: true });
  const locatorBasis = text(input.locatorBasis, 'locatorBasis', { required: true });
  if (!ENGINEERING_METHOD_SOURCE_STATUSES.includes(status)) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_STATUS_INVALID', 'Unknown engineering source status.', { status });
  }
  if (!ENGINEERING_SOURCE_LOCATOR_BASES.includes(locatorBasis)) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_LOCATOR_BASIS_INVALID', 'Unknown source locator basis.', { locatorBasis });
  }
  const record = {
    schema: ENGINEERING_METHOD_SOURCE_SCHEMA,
    sourceId: text(input.sourceId, 'sourceId', { required: true }),
    methodId: text(input.methodId, 'methodId', { required: true }),
    mechanismId: text(input.mechanismId, 'mechanismId'),
    publisher: text(input.publisher, 'publisher', { required: true }),
    publication: text(input.publication, 'publication', { required: true }),
    edition: text(input.edition, 'edition'),
    publicationDate: text(input.publicationDate, 'publicationDate'),
    isbn: text(input.isbn, 'isbn'),
    technicalModule: text(input.technicalModule, 'technicalModule'),
    sectionId: text(input.sectionId, 'sectionId'),
    flowchartId: text(input.flowchartId, 'flowchartId'),
    equationId: text(input.equationId, 'equationId'),
    tableId: text(input.tableId, 'tableId'),
    figureId: text(input.figureId, 'figureId'),
    printedPage: positiveInteger(input.printedPage, 'printedPage'),
    pdfPage: positiveInteger(input.pdfPage, 'pdfPage'),
    caption: text(input.caption, 'caption'),
    sourceArtifactHash: text(input.sourceArtifactHash, 'sourceArtifactHash'),
    errataSetId: text(input.errataSetId, 'errataSetId'),
    errataApplied: stringArray(input.errataApplied, 'errataApplied'),
    status,
    locatorBasis,
    notes: stringArray(input.notes, 'notes'),
    authority: 'SOURCE_IDENTITY_ONLY',
  };
  assertTypedLocator(record);
  if (record.status === 'CONTROLLED' && record.locatorBasis !== 'CONTROLLED_SOURCE') {
    throw sourceError('ENGINEERING_METHOD_SOURCE_CONTROLLED_BASIS_REQUIRED', 'CONTROLLED source records require CONTROLLED_SOURCE locator basis.');
  }
  return freeze(record);
}

export function engineeringMethodSourceLocator(record) {
  if (record?.schema !== ENGINEERING_METHOD_SOURCE_SCHEMA) {
    throw sourceError('ENGINEERING_METHOD_SOURCE_SCHEMA_REQUIRED', `Expected ${ENGINEERING_METHOD_SOURCE_SCHEMA}.`);
  }
  return freeze({
    technicalModule: record.technicalModule,
    sectionId: record.sectionId,
    flowchartId: record.flowchartId,
    equationId: record.equationId,
    tableId: record.tableId,
    figureId: record.figureId,
    printedPage: record.printedPage,
    pdfPage: record.pdfPage,
  });
}
