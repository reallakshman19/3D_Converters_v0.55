export const XML_CII_RIGID_WEIGHT_BUCKETS = Object.freeze({
  final: 'rigidWeightFinal',
  match1: 'rigidWeightMatch1',
  match1Provenance: 'rigidWeightMatch1Provenance',
  legacy: 'rigidWeight',
});

const MATCH1_PROVENANCE_SCHEMA = 'xml-cii-rigid-weight-match1-provenance/v1';
let weightMasterFingerprintCache = new WeakMap();

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function positive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function uniqueKeys(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];
}

function positiveBucket(value) {
  const out = {};
  for (const [key, raw] of Object.entries(plainObject(value))) {
    const numeric = positive(raw);
    if (text(key) && numeric !== null) out[key] = numeric;
  }
  return out;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value) {
  const source = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizedRef(value) {
  return text(value).replace(/^=/, '').replace(/\s+/g, '').toUpperCase();
}

function normalizedRating(value) {
  return text(value).replace(/#/g, '').replace(/\s+/g, '').toUpperCase();
}

function rounded(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const scale = 10 ** digits;
  return Math.round(numeric * scale) / scale;
}

export function xmlCiiWeightMasterRowsFingerprint(rows) {
  if (!Array.isArray(rows) || !rows.length) return 'none:0';
  const cached = weightMasterFingerprintCache.get(rows);
  if (cached) return cached;
  const fingerprint = `${rows.length}:${fnv1a(stableStringify(rows))}`;
  weightMasterFingerprintCache.set(rows, fingerprint);
  return fingerprint;
}

export function xmlCiiWeightMasterRevision(config = {}) {
  const weight = plainObject(config?.weight);
  const explicit = text(
    weight.masterRevision
      ?? weight.appliedMasterRevision
      ?? weight.revision
      ?? weight.masterSourceRevision,
  );
  const rows = Array.isArray(weight.masterRows) ? weight.masterRows : [];
  const persistedFingerprint = text(weight.masterFingerprint ?? weight.masterRowsFingerprint);
  const fingerprint = rows.length
    ? xmlCiiWeightMasterRowsFingerprint(rows)
    : (persistedFingerprint || 'none:0');
  return `${explicit || 'implicit'}|${fingerprint}`;
}

export function xmlCiiRigidWeightProposalBasis(issue = {}, config = {}) {
  return {
    key: text(issue.key),
    branchName: text(issue.branchName),
    nodeNumber: text(issue.nodeNumber),
    endpoint: text(issue.endpoint),
    componentType: text(issue.componentType).toUpperCase(),
    componentRefNo: normalizedRef(issue.componentRefNo),
    lengthMm: rounded(issue.lengthMm),
    lengthAuthority: text(issue.elementLengthSource || issue.lengthAuthority || 'unknown'),
    boreMm: rounded(issue.boreMm),
    rating: normalizedRating(issue.rating),
    weightMasterRevision: xmlCiiWeightMasterRevision(config),
  };
}

function candidateAudit(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') return null;
  const row = plainObject(candidate.rowData);
  const rowIdentity = {
    type: text(candidate.type || candidate.valveType),
    typeDesc: text(candidate.typeDesc),
    rowBore: rounded(candidate.rowBore ?? candidate.boreMm),
    rowRating: normalizedRating(candidate.rowRating ?? candidate.rating),
    rowLength: rounded(candidate.rowLength ?? candidate.lengthMm),
    masterWeightKg: rounded(candidate.masterWeight ?? candidate.weight),
    weightMethod: text(candidate.weightMethod),
    rowFingerprint: Object.keys(row).length ? fnv1a(stableStringify(row)) : '',
  };
  return rowIdentity;
}

export function buildXmlCiiRigidWeightMatch1Provenance(issue = {}, config = {}, candidate = null, options = {}) {
  const basis = xmlCiiRigidWeightProposalBasis(issue, config);
  const acceptedWeightKg = positive(options.weightKg ?? candidate?.selectedWeight ?? candidate?.suggestedWeight ?? candidate?.weight);
  return {
    schema: MATCH1_PROVENANCE_SCHEMA,
    fingerprint: fnv1a(stableStringify(basis)),
    basis,
    acceptedWeightKg,
    acceptanceMethod: text(options.acceptanceMethod) || (candidate ? 'candidate' : 'manual'),
    candidate: candidateAudit(candidate),
  };
}

function currentIssueMap(issues = []) {
  const out = new Map();
  for (const issue of Array.isArray(issues) ? issues : []) {
    const key = text(issue?.key);
    if (key) out.set(key, issue);
  }
  return out;
}

function changedBasisFields(saved = {}, current = {}) {
  const fields = [];
  const keys = new Set([...Object.keys(saved || {}), ...Object.keys(current || {})]);
  for (const key of keys) {
    if (stableStringify(saved?.[key]) !== stableStringify(current?.[key])) fields.push(key);
  }
  return fields;
}

export function validateXmlCiiRigidWeightMatch1(config = {}, issues = []) {
  const overrides = plainObject(config?.overrides);
  const weights = positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1]);
  const provenance = plainObject(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1Provenance]);
  const issueByKey = currentIssueMap(issues);
  const validWeights = {};
  const validProvenance = {};
  const stale = {};

  for (const [key, weightKg] of Object.entries(weights)) {
    const saved = plainObject(provenance[key]);
    const issue = issueByKey.get(key);
    if (!Object.keys(saved).length || saved.schema !== MATCH1_PROVENANCE_SCHEMA) {
      stale[key] = { reason: 'missing-provenance', weightKg };
      continue;
    }
    if (!issue) {
      stale[key] = { reason: 'component-not-found', weightKg, savedFingerprint: text(saved.fingerprint) };
      continue;
    }
    const current = buildXmlCiiRigidWeightMatch1Provenance(issue, config, null, { weightKg });
    if (text(saved.fingerprint) !== text(current.fingerprint)) {
      stale[key] = {
        reason: 'basis-changed',
        weightKg,
        savedFingerprint: text(saved.fingerprint),
        currentFingerprint: text(current.fingerprint),
        changedFields: changedBasisFields(saved.basis, current.basis),
      };
      continue;
    }
    validWeights[key] = weightKg;
    validProvenance[key] = saved;
  }

  return {
    validWeights,
    validProvenance,
    stale,
    validCount: Object.keys(validWeights).length,
    staleCount: Object.keys(stale).length,
  };
}

export function buildXmlCiiValidatedRigidWeightLegacyView(config = {}, issues = []) {
  const base = plainObject(config);
  const overrides = plainObject(base.overrides);
  const validation = validateXmlCiiRigidWeightMatch1(base, issues);
  const legacy = positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.legacy]);

  // A stale/current Match-1 record means this component has entered the
  // governed lifecycle. Never silently fall back to an older legacy override
  // for the same key: doing so can hide a changed geometry/master basis and
  // skip the required engineering review. Final remains higher authority
  // because it is an explicit downstream acceptance.
  for (const key of Object.keys(validation.stale)) delete legacy[key];

  const effective = {
    ...legacy,
    ...validation.validWeights,
    ...positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.final]),
  };
  return {
    config: {
      ...base,
      overrides: {
        ...overrides,
        rigidWeight: effective,
      },
    },
    validation: {
      ...validation,
      suppressedLegacyKeys: Object.keys(validation.stale).filter((key) => positive(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.legacy]?.[key]) !== null),
    },
  };
}

export function resetXmlCiiRigidWeightFingerprintCachesForTests() {
  weightMasterFingerprintCache = new WeakMap();
}

function resolution(bucketName, key, value) {
  const labels = {
    rigidWeightFinal: 'final-review',
    rigidWeightMatch1: 'weight-match-1',
    rigidWeight: 'legacy-override',
  };
  return {
    weightKg: value,
    bucket: bucketName,
    key,
    source: labels[bucketName] || bucketName,
    legacy: bucketName === XML_CII_RIGID_WEIGHT_BUCKETS.legacy,
  };
}

export function resolveXmlCiiRigidWeight(config, keys, sourceWeightKg = null) {
  const overrides = plainObject(config?.overrides);
  const candidates = uniqueKeys(keys);
  for (const bucketName of [
    XML_CII_RIGID_WEIGHT_BUCKETS.final,
    XML_CII_RIGID_WEIGHT_BUCKETS.match1,
    XML_CII_RIGID_WEIGHT_BUCKETS.legacy,
  ]) {
    const bucket = plainObject(overrides[bucketName]);
    for (const key of candidates) {
      const value = positive(bucket[key]);
      if (value !== null) return resolution(bucketName, key, value);
    }
  }
  const source = positive(sourceWeightKg);
  return source === null
    ? { weightKg: null, bucket: '', key: '', source: 'unresolved', legacy: false }
    : { weightKg: source, bucket: 'xmlWeight', key: '', source: 'xml-weight', legacy: false };
}

export function xmlCiiEffectiveRigidWeightMap(config) {
  const overrides = plainObject(config?.overrides);
  return {
    ...positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.legacy]),
    ...positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1]),
    ...positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.final]),
  };
}

export function withXmlCiiEffectiveRigidWeightLegacyView(config) {
  const base = plainObject(config);
  return {
    ...base,
    overrides: {
      ...plainObject(base.overrides),
      rigidWeight: xmlCiiEffectiveRigidWeightMap(base),
    },
  };
}

function nextConfig(config) {
  const base = plainObject(config);
  return {
    ...base,
    overrides: { ...plainObject(base.overrides) },
  };
}

export function withXmlCiiRigidWeightMatch1(config, weightsByKey = {}, provenanceByKey = {}) {
  const next = nextConfig(config);
  const match1 = { ...plainObject(next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1]) };
  const provenance = { ...plainObject(next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1Provenance]) };
  const final = { ...plainObject(next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.final]) };
  for (const [rawKey, rawValue] of Object.entries(plainObject(weightsByKey))) {
    const key = text(rawKey);
    const value = positive(rawValue);
    if (!key || value === null) continue;
    match1[key] = value;
    const nextProvenance = plainObject(provenanceByKey?.[key]);
    if (Object.keys(nextProvenance).length) provenance[key] = nextProvenance;
    else delete provenance[key];
    // An earlier Final Match-2 snapshot retains its separate authority.
    // Updating Match-1 must not silently erase a later accepted final value.
  }
  next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1] = match1;
  if (Object.keys(provenance).length) next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1Provenance] = provenance;
  else delete next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1Provenance];
  if (Object.keys(final).length) next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.final] = final;
  else delete next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.final];
  return next;
}

export function withXmlCiiRigidWeightFinal(config, weightsByKey = {}) {
  const next = nextConfig(config);
  const final = { ...plainObject(next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.final]) };
  for (const [rawKey, rawValue] of Object.entries(plainObject(weightsByKey))) {
    const key = text(rawKey);
    const value = positive(rawValue);
    if (key && value !== null) final[key] = value;
  }
  next.overrides[XML_CII_RIGID_WEIGHT_BUCKETS.final] = final;
  return next;
}

export function xmlCiiRigidWeightLifecycleSnapshot(config) {
  const overrides = plainObject(config?.overrides);
  return {
    legacy: positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.legacy]),
    match1: positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1]),
    match1Provenance: { ...plainObject(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.match1Provenance]) },
    final: positiveBucket(overrides[XML_CII_RIGID_WEIGHT_BUCKETS.final]),
  };
}
