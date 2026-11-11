import { readSourceField, sourceSchemaEnabled } from '../../converters/xml-cii2019-core/source-schema-adapter.js';

export const DEFAULT_JSON_TRACE_CAPTURE_FIELDS = Object.freeze([
  { name: 'DTXR_POS', enabled: true },
  { name: 'DTXR_PS', enabled: true },
  { name: 'DTXR', enabled: true },
  { name: 'SPRE', enabled: true },
  { name: 'SPREF', enabled: true },
  { name: 'MDSSUPPTYPE', enabled: true },
  { name: 'NAME', enabled: true },
  { name: 'CMPSUPGAP', enabled: true },
  { name: 'MDSLINKREF', enabled: true },
  { name: 'CMPSUPREFN', enabled: true },
  { name: 'PREV-NAME', enabled: true },
  { name: 'OWNER', enabled: true },
]);

const PRIMARY_FIELD_ORDER = Object.freeze(['DTXR', 'SPRE', 'SPREF', 'DTXR_PS', 'DTXR_POS']);

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeName(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

export function normalizeJsonTraceCaptureFields(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_JSON_TRACE_CAPTURE_FIELDS;
  const out = [];
  const seen = new Set();
  for (const item of source) {
    const rawName = typeof item === 'string' ? item : item?.name ?? item?.field ?? item?.key;
    const name = normalizeName(rawName);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, enabled: typeof item === 'object' ? item.enabled !== false : true });
  }
  return out.length ? out : DEFAULT_JSON_TRACE_CAPTURE_FIELDS.map((item) => ({ ...item }));
}

function caseInsensitiveValue(source, fieldName) {
  const wanted = normalizeName(fieldName);
  for (const [key, value] of Object.entries(safeObject(source))) {
    if (normalizeName(key) === wanted && text(value)) return text(value);
  }
  return '';
}

export function captureConfiguredJsonTraceFields(rawValue, config = {}) {
  const raw = safeObject(rawValue);
  const attrs = safeObject(raw.attributes || raw.ATTRIBUTES || raw.rawAttributes);
  const fields = normalizeJsonTraceCaptureFields(config.captureFields);
  const captured = {};
  for (const field of fields) {
    if (!field.enabled) continue;
    const value = caseInsensitiveValue(attrs, field.name) || caseInsensitiveValue(raw, field.name);
    if (value) captured[field.name] = value;
  }
  return captured;
}

export function configuredJsonTraceFieldNames(config = {}) {
  return normalizeJsonTraceCaptureFields(config.captureFields)
    .filter((field) => field.enabled)
    .map((field) => field.name);
}

function fallbackDescriptor(member = {}) {
  return text(member.labeled || member.description || member.dtxr || member.type || member.raw?.type);
}

export function formatConfiguredJsonTraceMember(member = {}, config = {}) {
  const captured = safeObject(member.capturedFields);
  const fields = configuredJsonTraceFieldNames(config);
  const primaryName = PRIMARY_FIELD_ORDER.find((name) => fields.includes(name) && text(captured[name]));
  const descriptor = text(primaryName ? captured[primaryName] : '') || fallbackDescriptor(member);
  const semanticName = text(member.semanticFields?.objectName || member.name);
  const name = fields.includes('NAME') ? text(captured.NAME || semanticName) : semanticName;
  let output = descriptor;
  if (name && !output.toUpperCase().includes('NAME=')) output += `(NAME=${name})`;
  const extras = [];
  for (const fieldName of fields) {
    if (fieldName === primaryName || fieldName === 'NAME' || fieldName === 'DTXR_POS') continue;
    const value = text(captured[fieldName]);
    if (!value) continue;
    if (output.toUpperCase().includes(`${fieldName}=`)) continue;
    extras.push(`${fieldName}=${value}`);
  }
  return [output, ...extras].filter(Boolean).join(',');
}

function semanticFields(rawValue, config = {}) {
  const roles = [
    'objectName', 'objectType', 'directLink', 'supportGroupRef', 'parentRef',
    'previousRef', 'nextRef', 'componentRef', 'supportType', 'supportFunction',
    'supportKind', 'supportGap', 'dtxrPosition', 'dtxrPs', 'dtxr', 'bore',
  ];
  const out = {};
  for (const role of roles) {
    const value = text(readSourceField(rawValue, role, config));
    if (value) out[role] = value;
  }
  return out;
}

export function decorateJsonTraceMember(member = {}, config = {}) {
  const raw = member.raw || member;
  const semantic = semanticFields(raw, config);
  return {
    ...member,
    name: text(member.name || semantic.objectName),
    cmpSupGap: text(member.cmpSupGap || semantic.supportGap),
    capturedFields: captureConfiguredJsonTraceFields(raw, config),
    semanticFields: semantic,
  };
}

function memberIdentity(member = {}) {
  return text(member.path || member.sourcePath)
    || `${text(member.jsonNodeNo)}|${text(member.description || member.dtxrPosValue)}|${text(member.name)}`;
}

function uniqueValues(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function supportKindsFromMembers(members = [], config = {}) {
  const kinds = [];
  const strict = sourceSchemaEnabled(config);
  for (const member of members) {
    if (strict) {
      // In an explicit source profile, JsonTrace must not invent another
      // support-code grammar. Only a canonical supportKind field is accepted.
      const kind = text(member?.semanticFields?.supportKind).toUpperCase();
      if (['GUIDE', 'LINESTOP', 'LIMIT', 'REST', 'ANCHOR', 'SPRING'].includes(kind)) kinds.push(kind === 'LIMIT' ? 'LINESTOP' : kind);
      continue;
    }
    const code = text(member?.semanticFields?.supportType
      || member?.semanticFields?.supportKind
      || member?.capturedFields?.MDSSUPPTYPE).toUpperCase();
    if (code.startsWith('GT') || code === 'GUIDE') kinds.push('GUIDE');
    if (code.startsWith('ST') || code === 'LINESTOP' || code === 'LIMIT') kinds.push('LINESTOP');
    if (code === 'REST' || code.includes('PIPE-REST')) kinds.push('REST');
  }
  return uniqueValues(kinds);
}

export function decorateJsonTraceLedger(ledgerResult = {}, config = {}) {
  const groups = Array.isArray(ledgerResult.groups)
    ? ledgerResult.groups.map((group) => ({
      ...group,
      entries: Array.isArray(group.entries)
        ? group.entries.map((entry) => decorateJsonTraceMember(entry, config))
        : [],
    }))
    : [];
  const byPath = new Map();
  for (const group of groups) {
    for (const entry of group.entries) {
      const key = memberIdentity(entry);
      if (key) byPath.set(key, entry);
    }
  }
  const records = Array.isArray(ledgerResult.records)
    ? ledgerResult.records.map((record) => {
      const positionMembers = Array.isArray(record.positionMembers)
        ? record.positionMembers.map((member) => byPath.get(memberIdentity(member))
          || decorateJsonTraceMember(member, config))
        : [];
      const gaps = uniqueValues(positionMembers.map((member) => member.cmpSupGap));
      return {
        ...record,
        positionMembers,
        cmpSupGap: gaps.length === 1 ? gaps[0] : '',
        cmpSupGaps: gaps,
        derivedSupportTypes: uniqueValues([
          ...(Array.isArray(record.derivedSupportTypes) ? record.derivedSupportTypes : []),
          ...supportKindsFromMembers(positionMembers, config),
        ]),
      };
    })
    : [];
  return {
    ...ledgerResult,
    groups,
    records,
    ledger: Array.isArray(ledgerResult.ledger) ? records : ledgerResult.ledger,
  };
}
