const LEGACY_FIELDS = Object.freeze({
  objectName: ['NAME', 'NodeName'],
  objectType: ['TYPE', 'ComponentType', 'COMPONENTTYPE'],
  directLink: ['MDSLINKREF'],
  supportGroupRef: ['CMPSUPREFN'],
  parentRef: ['OWNER'],
  previousRef: ['PREV-NAME'],
  nextRef: ['NEXT-NAME'],
  componentRef: ['ComponentRefNo', 'COMPONENTREFNO', 'COMPRE', 'RefNo', 'REFNO', 'REF'],
  nodeNumber: ['NodeNumber', 'NODE', 'NODE_NO', 'JsonNodeNo', 'JSON_NODE_NO', 'SEQ', 'SEQUENCE'],
  nodeName: ['NodeName', 'NAME'],
  supportTag: ['SupportTag', 'PS', 'supportPs', 'psNo'],
  supportType: ['MDSSUPPTYPE', 'CMPSUPTYPE', 'SUPPORT_TYPE'],
  supportFunction: ['MDSSUPPFUNC'],
  supportKind: ['SUPPORT_KIND', 'SUPPORT_MAPPER_KIND'],
  supportGap: ['CMPSUPGAP', 'CMPSUPGAP_POS', 'CMPSUPGAP_PS', 'SUPPORT GAP'],
  dtxrPosition: ['DTXR_POS'],
  dtxrPs: ['DTXR_PS', 'DTXRPS'],
  dtxr: ['DTXR', 'DESC', 'DESCRIPTION', 'RTEXT', 'SPRE'],
  position: ['SUPPORTCOORD', 'SUPPORT_COORD', 'POS', 'POSI', 'BPOS', 'APOS', 'LPOS', 'CPOS', 'HPOS', 'TPOS', 'SPOS', 'EPOS'],
  bore: ['ABORE', 'LBORE', 'HBORE', 'BORE'],
});

const CANONICAL_LEGACY_FIELD = Object.freeze({
  objectName: 'NAME',
  objectType: 'TYPE',
  directLink: 'MDSLINKREF',
  supportGroupRef: 'CMPSUPREFN',
  parentRef: 'OWNER',
  previousRef: 'PREV-NAME',
  nextRef: 'NEXT-NAME',
  componentRef: 'ComponentRefNo',
  nodeNumber: 'NodeNumber',
  nodeName: 'NodeName',
  supportTag: 'SupportTag',
  supportType: 'MDSSUPPTYPE',
  supportFunction: 'MDSSUPPFUNC',
  supportKind: 'SUPPORT_KIND',
  supportGap: 'CMPSUPGAP',
  dtxrPosition: 'DTXR_POS',
  dtxrPs: 'DTXR_PS',
  dtxr: 'DTXR',
  bore: 'BORE',
});

const IDENTITY_HYPHEN_POLICIES = new Set(['REQUIRED', 'OPTIONAL', 'FORBIDDEN']);
const HIERARCHY_MATCH_POLICIES = new Set(['EXACT_ONLY', 'PARENT', 'ROOT']);
const RELATIONSHIP_CONFLICT_POLICIES = new Set(['REJECT', 'GROUP_REF_WINS']);
const COORDINATE_AUTHORITY_POLICIES = new Set(['CORROBORATION_ONLY', 'FALLBACK']);
const FIELD_CONFLICT_POLICIES = new Set(['REJECT', 'FIRST_CONFIGURED']);

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}
function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function upperEnum(value, fallback = '') {
  return text(value || fallback).toUpperCase();
}
function normalizeFieldList(value, fallback = []) {
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(value?.aliases)
      ? value.aliases
      : typeof value === 'string'
        ? [value]
        : fallback;
  return [...new Set((raw || []).map(text).filter(Boolean))];
}
function hasEvidenceValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
function stableEvidenceValue(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableEvidenceValue).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableEvidenceValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(typeof value === 'string' ? value.trim() : value);
}
function displayEvidenceValue(value) {
  if (value && typeof value === 'object') return stableEvidenceValue(value);
  return text(value);
}

export function sourceSchemaEnabled(config = {}) {
  return safeObject(config.sourceSchema).enabled === true;
}

export function validateSourceSchemaConfig(config = {}) {
  if (!sourceSchemaEnabled(config)) return { valid: true, errors: [], warnings: [] };
  const schema = safeObject(config.sourceSchema);
  const identity = safeObject(schema.identity);
  const relationships = safeObject(schema.relationships);
  const coordinates = safeObject(schema.coordinates);
  const fields = safeObject(schema.fields);
  const errors = [];
  const warnings = [];

  const prefixes = Array.isArray(identity.supportPrefixes)
    ? identity.supportPrefixes.map((value) => text(value).toUpperCase()).filter(Boolean)
    : [];
  if (!prefixes.length) errors.push('sourceSchema.identity.supportPrefixes must be an explicit non-empty array.');
  if (!IDENTITY_HYPHEN_POLICIES.has(upperEnum(identity.hyphenPolicy))) {
    errors.push('sourceSchema.identity.hyphenPolicy must be REQUIRED, OPTIONAL, or FORBIDDEN.');
  }
  const maxDepth = Number(identity.maxHierarchyDepth);
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 12) {
    errors.push('sourceSchema.identity.maxHierarchyDepth must be an integer from 0 to 12.');
  }
  if (!HIERARCHY_MATCH_POLICIES.has(upperEnum(identity.hierarchyMatch))) {
    errors.push('sourceSchema.identity.hierarchyMatch must be EXACT_ONLY, PARENT, or ROOT.');
  }
  if (upperEnum(identity.matchBoundary, 'FULL_TOKEN') !== 'FULL_TOKEN') {
    errors.push('sourceSchema.identity.matchBoundary currently supports only FULL_TOKEN.');
  }

  const conflictPolicy = upperEnum(relationships.conflictPolicy, 'REJECT');
  if (!RELATIONSHIP_CONFLICT_POLICIES.has(conflictPolicy)) {
    errors.push('sourceSchema.relationships.conflictPolicy must be REJECT or GROUP_REF_WINS.');
  }
  const coordinateAuthority = upperEnum(coordinates.authority, 'CORROBORATION_ONLY');
  if (!COORDINATE_AUTHORITY_POLICIES.has(coordinateAuthority)) {
    errors.push('sourceSchema.coordinates.authority must be CORROBORATION_ONLY or FALLBACK.');
  }
  if (coordinates.coordinateOnlyFallback === true && coordinateAuthority !== 'FALLBACK') {
    errors.push('coordinateOnlyFallback=true requires sourceSchema.coordinates.authority=FALLBACK.');
  }
  if (!FIELD_CONFLICT_POLICIES.has(upperEnum(schema.fieldConflictPolicy, 'REJECT'))) {
    errors.push('sourceSchema.fieldConflictPolicy must be REJECT or FIRST_CONFIGURED.');
  }

  const relationshipRoles = [
    ...normalizeFieldList(relationships.identityRoles, ['objectName', 'supportTag']),
    ...normalizeFieldList(relationships.groupRoles, ['supportGroupRef']),
    ...normalizeFieldList(relationships.linkRoles, ['directLink']),
  ];
  for (const role of [...new Set(relationshipRoles)]) {
    if (!Object.prototype.hasOwnProperty.call(fields, role)) {
      warnings.push(`sourceSchema.fields.${role} is omitted; semantic role ${role} is disabled.`);
    }
  }
  if (!Object.prototype.hasOwnProperty.call(fields, 'position')) {
    warnings.push('sourceSchema.fields.position is omitted; coordinate corroboration/fallback is disabled.');
  }
  if (!text(schema.profileId)) warnings.push('sourceSchema.profileId is blank; provenance will not identify the source policy profile.');
  return { valid: errors.length === 0, errors, warnings };
}

function assertValidSourceSchema(config = {}) {
  const validation = validateSourceSchemaConfig(config);
  if (!validation.valid) throw new Error(`Invalid XML-CII source schema: ${validation.errors.join(' ')}`);
  return validation;
}

export function resolveSourceSchema(config = {}) {
  const enabled = sourceSchemaEnabled(config);
  const supplied = safeObject(config.sourceSchema);
  if (enabled) assertValidSourceSchema(config);
  const suppliedFields = safeObject(supplied.fields);
  const fields = {};
  for (const [role, legacyAliases] of Object.entries(LEGACY_FIELDS)) {
    if (enabled) {
      fields[role] = Object.prototype.hasOwnProperty.call(suppliedFields, role)
        ? normalizeFieldList(suppliedFields[role], [])
        : [];
    } else {
      fields[role] = normalizeFieldList(suppliedFields[role], legacyAliases);
    }
  }

  if (!enabled) {
    return {
      enabled: false,
      profileId: '',
      fields,
      fieldConflictPolicy: 'FIRST_CONFIGURED',
      identity: {
        supportPrefixes: ['PS'], hyphenPolicy: 'REQUIRED', maxHierarchyDepth: 1,
        hierarchyMatch: 'PARENT', matchBoundary: 'FULL_TOKEN',
      },
      relationships: {
        identityRoles: ['objectName', 'supportTag'], groupRoles: ['supportGroupRef'], linkRoles: ['directLink'],
        expandIdentityToGroup: false, objectNameIsGroupAuthority: false, conflictPolicy: 'REJECT',
      },
      coordinates: { authority: 'CORROBORATION_ONLY', coordinateOnlyFallback: false },
    };
  }

  const identity = safeObject(supplied.identity);
  const relationships = safeObject(supplied.relationships);
  const coordinates = safeObject(supplied.coordinates);
  return {
    enabled: true,
    profileId: text(supplied.profileId),
    fields,
    fieldConflictPolicy: upperEnum(supplied.fieldConflictPolicy, 'REJECT'),
    identity: {
      supportPrefixes: identity.supportPrefixes.map((value) => text(value).toUpperCase()).filter(Boolean),
      hyphenPolicy: upperEnum(identity.hyphenPolicy),
      maxHierarchyDepth: Number(identity.maxHierarchyDepth),
      hierarchyMatch: upperEnum(identity.hierarchyMatch),
      matchBoundary: upperEnum(identity.matchBoundary, 'FULL_TOKEN'),
    },
    relationships: {
      identityRoles: normalizeFieldList(relationships.identityRoles, ['objectName', 'supportTag']),
      groupRoles: normalizeFieldList(relationships.groupRoles, ['supportGroupRef']),
      linkRoles: normalizeFieldList(relationships.linkRoles, ['directLink']),
      expandIdentityToGroup: relationships.expandIdentityToGroup === true,
      objectNameIsGroupAuthority: relationships.objectNameIsGroupAuthority === true,
      conflictPolicy: upperEnum(relationships.conflictPolicy, 'REJECT'),
    },
    coordinates: {
      authority: upperEnum(coordinates.authority, 'CORROBORATION_ONLY'),
      coordinateOnlyFallback: coordinates.coordinateOnlyFallback === true,
    },
  };
}

function attributeObject(value) {
  const raw = safeObject(value);
  return safeObject(raw.attributes || raw.ATTRIBUTES || raw.rawAttributes || raw.attrs || raw);
}
function caseInsensitiveEntry(source, alias) {
  const wanted = text(alias).toUpperCase();
  for (const [key, value] of Object.entries(safeObject(source))) {
    if (text(key).toUpperCase() === wanted && hasEvidenceValue(value)) return { key, value };
  }
  return null;
}

export function sourceFieldEvidence(value, role, config = {}) {
  const schema = resolveSourceSchema(config);
  const aliases = schema.fields[role] || [];
  const raw = safeObject(value);
  const attrs = attributeObject(value);
  const matches = [];
  const seen = new Set();
  for (const alias of aliases) {
    for (const [scope, source] of [['attributes', attrs], ['object', raw]]) {
      const hit = caseInsensitiveEntry(source, alias);
      if (!hit) continue;
      const location = `${scope}:${text(hit.key).toUpperCase()}`;
      if (seen.has(location)) continue;
      seen.add(location);
      matches.push({ alias, field: hit.key, value: hit.value, scope });
    }
  }
  const byValue = new Map();
  for (const match of matches) {
    const key = stableEvidenceValue(match.value);
    if (!byValue.has(key)) byValue.set(key, displayEvidenceValue(match.value));
  }
  const distinctValues = [...byValue.values()];
  return { role, matches, distinctValues, conflict: distinctValues.length > 1, selected: matches[0] || null };
}

export function readSourceField(value, role, config = {}) {
  const schema = resolveSourceSchema(config);
  const evidence = sourceFieldEvidence(value, role, config);
  if (evidence.conflict && schema.fieldConflictPolicy === 'REJECT') return '';
  return evidence.selected?.value || '';
}
export function sourceFieldName(value, role, config = {}) {
  return sourceFieldEvidence(value, role, config).selected?.field || '';
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function supportIdentityRegex(config = {}) {
  const identity = resolveSourceSchema(config).identity;
  const prefix = identity.supportPrefixes.map(escapeRegex).join('|');
  if (!prefix) return null;
  const separator = identity.hyphenPolicy === 'OPTIONAL' ? '-?'
    : identity.hyphenPolicy === 'FORBIDDEN' ? '' : '-';
  const depth = Math.max(0, Number(identity.maxHierarchyDepth) || 0);
  const suffix = depth > 0 ? `(?:\\.\\d+){0,${depth}}` : '';
  return new RegExp(`(?:^|[^A-Z0-9])\\/?(${prefix})${separator}(\\d+${suffix})(?=$|[^A-Z0-9.])`, 'i');
}

export function normalizeSupportIdentity(value, config = {}) {
  const regex = supportIdentityRegex(config);
  if (!regex) return '';
  const match = regex.exec(text(value).toUpperCase());
  return match ? `${match[1].toUpperCase()}-${match[2]}` : '';
}
export function supportIdentityVariants(value, config = {}) {
  const normalized = normalizeSupportIdentity(value, config);
  if (!normalized) return [];
  const policy = resolveSourceSchema(config).identity.hierarchyMatch;
  if (policy === 'EXACT_ONLY') return [normalized];
  const [root, ...suffix] = normalized.split('.');
  if (!suffix.length) return [normalized];
  if (policy === 'PARENT') {
    const parent = [root, ...suffix.slice(0, -1)].join('.');
    return parent && parent !== normalized ? [normalized, parent] : [normalized];
  }
  const out = [normalized];
  for (let length = suffix.length - 1; length >= 0; length -= 1) {
    const candidate = [root, ...suffix.slice(0, length)].filter(Boolean).join('.');
    if (candidate && !out.includes(candidate)) out.push(candidate);
  }
  return out;
}
export function supportIdentityRoot(value, config = {}) {
  const normalized = normalizeSupportIdentity(value, config);
  return normalized ? normalized.split('.')[0] : '';
}

function identitiesFromRoles(value, roles, config = {}) {
  const out = [];
  for (const role of roles) {
    for (const variant of supportIdentityVariants(readSourceField(value, role, config), config)) {
      if (!out.includes(variant)) out.push(variant);
    }
  }
  return out;
}
export function sourceSupportIdentities(value, config = {}) {
  const schema = resolveSourceSchema(config);
  if (schema.enabled) return identitiesFromRoles(value, schema.relationships.identityRoles, config);
  const out = identitiesFromRoles(value, ['objectName', 'directLink', 'supportGroupRef', 'supportTag'], config);
  const raw = safeObject(value);
  for (const candidate of [raw.name, raw.component?.name, raw.componentName]) {
    for (const variant of supportIdentityVariants(candidate, config)) if (!out.includes(variant)) out.push(variant);
  }
  return out;
}
export function sourceTopologyIdentities(value, config = {}) {
  return identitiesFromRoles(value, ['parentRef', 'previousRef', 'nextRef'], config);
}

export function sourceRelationshipEvidence(value, config = {}) {
  const schema = resolveSourceSchema(config);
  const roleRoots = [];
  const addRole = (role, authority) => {
    const rawValue = readSourceField(value, role, config);
    const root = supportIdentityRoot(rawValue, config);
    if (root) roleRoots.push({ role, authority, root, rawValue: text(rawValue) });
  };
  for (const role of schema.relationships.groupRoles) addRole(role, 'GROUP');
  for (const role of schema.relationships.linkRoles) addRole(role, 'LINK');
  if (schema.relationships.objectNameIsGroupAuthority) addRole('objectName', 'OBJECT_NAME');

  const uniqueRoots = [...new Set(roleRoots.map((entry) => entry.root))];
  const conflict = uniqueRoots.length > 1;
  let roots = uniqueRoots;
  if (conflict && schema.relationships.conflictPolicy === 'REJECT') roots = [];
  if (conflict && schema.relationships.conflictPolicy === 'GROUP_REF_WINS') {
    const groupRoots = [...new Set(roleRoots.filter((entry) => entry.authority === 'GROUP').map((entry) => entry.root))];
    roots = groupRoots.length === 1 ? groupRoots : [];
  }
  return { roleRoots, uniqueRoots, roots, conflict, rejected: conflict && roots.length === 0 };
}
export function sourceRelationshipRoots(value, config = {}) {
  return sourceRelationshipEvidence(value, config).roots;
}
export function sourceAuthorityPolicy(config = {}) {
  const schema = resolveSourceSchema(config);
  return {
    enabled: schema.enabled,
    profileId: schema.profileId,
    expandIdentityToGroup: schema.relationships.expandIdentityToGroup,
    relationshipConflictPolicy: schema.relationships.conflictPolicy,
    coordinateAuthority: schema.coordinates.authority,
    coordinateOnlyFallback: schema.coordinates.coordinateOnlyFallback,
    hierarchyMatch: schema.identity.hierarchyMatch,
  };
}

export function normalizeOwnerBranchName(value) {
  return text(value)
    .replace(/<\/?Branchname[^>]*>/gi, '')
    .replace(/^\s*=\s*/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, '')
    .replace(/\/B0*(\d+)$/i, '/B$1')
    .replace(/^\/*/, '/')
    .toUpperCase();
}
export function ownerBranchVariants(value) {
  const full = normalizeOwnerBranchName(value);
  const variants = new Set();
  if (full) variants.add(full);
  if (full.endsWith('/')) variants.add(full.slice(0, -1));
  const noBranch = full.replace(/\/B\d+$/i, '');
  if (noBranch && noBranch !== full) variants.add(noBranch);
  const noQuotes = full.replace(/["']/g, '');
  if (noQuotes && noQuotes !== full) variants.add(noQuotes);
  const noQuotesNoBranch = noQuotes.replace(/\/B\d+$/i, '');
  if (noQuotesNoBranch && noQuotesNoBranch !== noQuotes) variants.add(noQuotesNoBranch);
  return [...variants].filter(Boolean);
}

export function parseSourcePoint(point) {
  if (point === undefined || point === null || point === '') return null;
  if (Array.isArray(point) && point.length >= 3) {
    const [x, y, z] = point.slice(0, 3).map(Number);
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
  }
  if (typeof point === 'object') {
    const x = Number(point.x ?? point.X ?? point.E ?? point.east);
    const y = Number(point.y ?? point.Y ?? point.N ?? point.north);
    const z = Number(point.z ?? point.Z ?? point.U ?? point.EL ?? point.elev ?? point.elevation);
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
  }
  const source = text(point);
  if (!source) return null;
  const directional = {};
  source.replace(/\b(E|W|N|S|U|D|EL)\s*[:=]?\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/gi, (_, axis, raw) => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return '';
    const key = axis.toUpperCase();
    if (key === 'E') directional.x = numeric;
    else if (key === 'W') directional.x = -numeric;
    else if (key === 'N') directional.y = numeric;
    else if (key === 'S') directional.y = -numeric;
    else if (key === 'U' || key === 'EL') directional.z = numeric;
    else if (key === 'D') directional.z = -numeric;
    return '';
  });
  if ([directional.x, directional.y, directional.z].every(Number.isFinite)) return directional;
  const values = source.match(/-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return values.length >= 3 ? { x: values[0], y: values[1], z: values[2] } : null;
}

export function resolveCoordinateAlignment(config = {}) {
  const explicit = safeObject(config.coordinateAlignment);
  if (sourceSchemaEnabled(config)) {
    if (!Object.keys(explicit).length) {
      return {
        explicit: true, mode: 'NONE', offsetMm: { x: 0, y: 0, z: 0 }, applyToFields: [],
        matchToleranceMm: Math.max(finite(config.coordinateTolerance, 1), 0), calibrationToleranceMm: 1,
        minimumCalibrationSamples: 3, scope: 'GLOBAL',
      };
    }
    const mode = upperEnum(explicit.mode, 'NONE');
    if (!['NONE', 'MANUAL', 'AUTO'].includes(mode)) throw new Error(`Invalid coordinateAlignment.mode: ${mode}`);
    const rawOffset = safeObject(explicit.manualOffsetMm || explicit.offsetMm || explicit.offset);
    return {
      explicit: true,
      mode,
      offsetMm: {
        x: finite(rawOffset.x ?? rawOffset.xOffset, 0),
        y: finite(rawOffset.y ?? rawOffset.yOffset, 0),
        z: finite(rawOffset.z ?? rawOffset.zOffset, 0),
      },
      applyToFields: normalizeFieldList(explicit.applyToFields, []).map((value) => value.toUpperCase()),
      matchToleranceMm: Math.max(finite(explicit.matchToleranceMm ?? explicit.tolerance, finite(config.coordinateTolerance, 1)), 0),
      calibrationToleranceMm: Math.max(finite(explicit.calibrationToleranceMm, 1), 0.001),
      minimumCalibrationSamples: Math.max(1, Math.round(finite(explicit.minimumCalibrationSamples, 3))),
      scope: upperEnum(explicit.scope, 'GLOBAL'),
    };
  }

  if (Object.keys(explicit).length) {
    const mode = upperEnum(explicit.mode, 'NONE');
    const rawOffset = safeObject(explicit.manualOffsetMm || explicit.offsetMm || explicit.offset);
    return {
      explicit: true,
      mode: ['NONE', 'MANUAL', 'AUTO'].includes(mode) ? mode : 'NONE',
      offsetMm: {
        x: finite(rawOffset.x ?? rawOffset.xOffset, 0),
        y: finite(rawOffset.y ?? rawOffset.yOffset, 0),
        z: finite(rawOffset.z ?? rawOffset.zOffset, 0),
      },
      applyToFields: normalizeFieldList(explicit.applyToFields, ['POSI']).map((value) => value.toUpperCase()),
      matchToleranceMm: Math.max(finite(explicit.matchToleranceMm ?? explicit.tolerance, finite(config.coordinateTolerance, 1)), 0),
      calibrationToleranceMm: Math.max(finite(explicit.calibrationToleranceMm, 1), 0.001),
      minimumCalibrationSamples: Math.max(1, Math.round(finite(explicit.minimumCalibrationSamples, 3))),
      scope: upperEnum(explicit.scope, 'GLOBAL'),
    };
  }

  const legacy = safeObject(config.dtxrPositionOffset);
  return {
    explicit: false,
    mode: legacy.enabled === true ? 'MANUAL' : 'NONE',
    offsetMm: { x: finite(legacy.xOffset, 0), y: finite(legacy.yOffset, 0), z: finite(legacy.zOffset, 0) },
    applyToFields: ['POSI'],
    matchToleranceMm: Math.max(finite(legacy.tolerance, finite(config.coordinateTolerance, 1)), 0),
    calibrationToleranceMm: Math.max(finite(legacy.autoCalibratePrecision, 1), 0.001),
    minimumCalibrationSamples: Math.max(1, Math.round(finite(legacy.autoCalibrateMinSamples, 2))),
    scope: 'GLOBAL',
  };
}

export function shouldAutoCalibrateCoordinates(config = {}) {
  const alignment = resolveCoordinateAlignment(config);
  if (sourceSchemaEnabled(config) || alignment.explicit) return alignment.mode === 'AUTO';
  const legacy = safeObject(config.dtxrPositionOffset);
  return legacy.enabled !== false && legacy.autoCalibrate !== false;
}
export function applyCoordinateAlignment(point, fieldName, config = {}) {
  if (!point) return null;
  const alignment = resolveCoordinateAlignment(config);
  if (alignment.mode !== 'MANUAL') return { ...point };
  const field = text(fieldName).toUpperCase();
  if (alignment.applyToFields.length && !alignment.applyToFields.includes(field)) return { ...point };
  return {
    x: point.x + alignment.offsetMm.x,
    y: point.y + alignment.offsetMm.y,
    z: point.z + alignment.offsetMm.z,
  };
}

export function readSourcePosition(value, config = {}) {
  const schema = resolveSourceSchema(config);
  const positionEvidence = sourceFieldEvidence(value, 'position', config);
  if (positionEvidence.conflict && schema.fieldConflictPolicy === 'REJECT') return null;
  const selected = positionEvidence.selected;
  if (selected) {
    const rawPoint = parseSourcePoint(selected.value);
    if (rawPoint) {
      return {
        field: selected.field,
        rawValue: selected.value,
        rawPoint,
        point: applyCoordinateAlignment(rawPoint, selected.field, config),
        alignment: resolveCoordinateAlignment(config),
      };
    }
  }
  if (schema.enabled) return null;
  const raw = safeObject(value);
  const fallback = parseSourcePoint(raw.position || raw.point || '');
  return fallback ? {
    field: 'position', rawValue: raw.position || raw.point, rawPoint: fallback, point: fallback,
    alignment: resolveCoordinateAlignment(config),
  } : null;
}

export function canonicalizeStagedAttributes(attrs = {}, config = {}, rawObject = {}) {
  const out = { ...safeObject(attrs) };
  const source = { ...safeObject(rawObject), attributes: out };
  for (const [role, canonical] of Object.entries(CANONICAL_LEGACY_FIELD)) {
    const value = readSourceField(source, role, config);
    if (hasEvidenceValue(value) && !hasEvidenceValue(out[canonical])) out[canonical] = value;
  }
  const position = readSourcePosition(source, config);
  if (position?.point) {
    out.SUPPORTCOORD = { ...position.point };
    out.__SOURCE_POSITION_FIELD = position.field;
    out.__SOURCE_POSITION_RAW = position.rawValue;
  }
  return out;
}

export function walkStagedSource(stagedJson, config = {}) {
  let parsed = stagedJson;
  if (typeof stagedJson === 'string') {
    try { parsed = JSON.parse(stagedJson); } catch { return []; }
  }
  const out = [];
  function walk(value, branchName = '', path = '$') {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, branchName, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    const rawAttrs = attributeObject(value);
    const attrs = canonicalizeStagedAttributes(rawAttrs, config, value);
    const type = text(value.type || readSourceField({ ...value, attributes: attrs }, 'objectType', config)).toUpperCase();
    const hasChildren = Array.isArray(value.children);
    const branch = (type === 'BRANCH' || hasChildren)
      ? text(value.name || readSourceField({ ...value, attributes: attrs }, 'parentRef', config) || branchName)
      : branchName;
    const record = {
      component: value,
      attrs,
      rawAttrs,
      branchName: branch,
      type,
      _path: path,
      position: readSourcePosition({ ...value, attributes: rawAttrs }, config),
    };
    record.supportIdentities = sourceSupportIdentities({ ...value, attributes: attrs, component: value }, config);
    record.topologyIdentities = sourceTopologyIdentities({ ...value, attributes: attrs, component: value }, config);
    record.relationshipEvidence = sourceRelationshipEvidence({ ...value, attributes: attrs, component: value }, config);
    record.relationshipRoots = record.relationshipEvidence.roots;
    out.push(record);
    if (hasChildren) value.children.forEach((child, index) => walk(child, branch, `${path}.children[${index}]`));
  }
  walk(parsed);
  return out;
}

export function sourceSchemaDefaults() {
  return {
    enabled: false,
    profileId: '',
    fields: {},
    fieldConflictPolicy: 'REJECT',
    identity: {
      supportPrefixes: [], hyphenPolicy: 'REQUIRED', maxHierarchyDepth: 1,
      hierarchyMatch: 'EXACT_ONLY', matchBoundary: 'FULL_TOKEN',
    },
    relationships: {
      identityRoles: ['objectName', 'supportTag'], groupRoles: ['supportGroupRef'], linkRoles: ['directLink'],
      expandIdentityToGroup: false, objectNameIsGroupAuthority: false, conflictPolicy: 'REJECT',
    },
    coordinates: { authority: 'CORROBORATION_ONLY', coordinateOnlyFallback: false },
  };
}
