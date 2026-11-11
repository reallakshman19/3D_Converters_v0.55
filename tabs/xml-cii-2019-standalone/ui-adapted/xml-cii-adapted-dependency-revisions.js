const MASTER_BASIS = Object.freeze({
  lineList: Object.freeze({ rowsKey: 'lineRows', revisionKey: 'lineListAppliedRevision' }),
  pipingClass: Object.freeze({ rowsKey: 'pipingClassRows', revisionKey: 'pipingClassAppliedRevision' }),
  materialMap: Object.freeze({ rowsKey: 'materialMapRows', revisionKey: 'materialAppliedRevision' }),
  weight: Object.freeze({ rowsKey: 'weightMasterRows', revisionKey: 'weightAppliedRevision' }),
});

export const XML_CII_DEPENDENCY_REVISION_KEYS = Object.freeze([
  'sourceModelRevision',
  'lineListAppliedRevision',
  'pipingClassAppliedRevision',
  'materialAppliedRevision',
  'weightAppliedRevision',
  'supportConfigRevision',
  'branchLineMapRevision',
]);

function integerRevision(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

export function branchLineMapSignature(config) {
  const map = config?.linelist?.branchLineKeyMap;
  return JSON.stringify(stableObject(map && typeof map === 'object' && !Array.isArray(map) ? map : {}));
}

function withoutIndependentMasterDomains(config) {
  const source = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  const next = { ...source };
  for (const [section, rowKey] of [['linelist', 'masterRows'], ['pipingClass', 'masterRows'], ['material', 'mapRows'], ['weight', 'masterRows']]) {
    const value = source[section];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const cleaned = { ...value };
    delete cleaned[rowKey];
    delete cleaned.fieldMap;
    if (section === 'linelist') delete cleaned.branchLineKeyMap;
    if (Object.keys(cleaned).length) next[section] = cleaned;
    else delete next[section];
  }
  return next;
}

export function supportConfigSignature(config) {
  return JSON.stringify(stableObject(withoutIndependentMasterDomains(config)));
}

function initialMasterRevision(state, masterKey) {
  const def = MASTER_BASIS[masterKey];
  const context = state?.masterContext;
  const applied = integerRevision(context?.appliedMappingRevision?.[masterKey]);
  const rows = context?.[def.rowsKey];
  return Math.max(applied, Array.isArray(rows) && rows.length ? 1 : 0);
}

export function initializeDependencyRevisionState(state, parsedConfig = state?.masterContext?.config || {}) {
  const revisions = {
    sourceModelRevision: String(state?.sourceText || '') ? 1 : 0,
    supportConfigRevision: supportConfigSignature(parsedConfig) === '{}' ? 0 : 1,
    branchLineMapRevision: branchLineMapSignature(parsedConfig) === '{}' ? 0 : 1,
  };
  for (const [key, def] of Object.entries(MASTER_BASIS)) revisions[def.revisionKey] = initialMasterRevision(state, key);
  return {
    dependencyRevisions: Object.freeze(revisions),
    dependencyRevisionBasis: Object.freeze({
      supportConfigSignature: supportConfigSignature(parsedConfig),
      branchLineMapSignature: branchLineMapSignature(parsedConfig),
    }),
  };
}

function masterAuthorityChanged(previous, next, masterKey) {
  const def = MASTER_BASIS[masterKey];
  const prevContext = previous?.masterContext;
  const nextContext = next?.masterContext;
  if (prevContext?.[def.rowsKey] !== nextContext?.[def.rowsKey]) return true;
  return integerRevision(prevContext?.appliedMappingRevision?.[masterKey])
    !== integerRevision(nextContext?.appliedMappingRevision?.[masterKey]);
}

export function advanceDependencyRevisionState(previous, next, parsedConfig = next?.masterContext?.config || {}) {
  const prior = previous?.dependencyRevisions || initializeDependencyRevisionState(previous).dependencyRevisions;
  const priorBasis = previous?.dependencyRevisionBasis || initializeDependencyRevisionState(previous).dependencyRevisionBasis;
  const nextSupportSignature = supportConfigSignature(parsedConfig);
  const nextBranchSignature = branchLineMapSignature(parsedConfig);
  const revisions = {
    ...prior,
    sourceModelRevision: integerRevision(prior.sourceModelRevision) + (String(previous?.sourceText || '') !== String(next?.sourceText || '') ? 1 : 0),
    supportConfigRevision: integerRevision(prior.supportConfigRevision) + (priorBasis.supportConfigSignature !== nextSupportSignature ? 1 : 0),
    branchLineMapRevision: integerRevision(prior.branchLineMapRevision) + (priorBasis.branchLineMapSignature !== nextBranchSignature ? 1 : 0),
  };
  for (const [key, def] of Object.entries(MASTER_BASIS)) {
    revisions[def.revisionKey] = integerRevision(prior[def.revisionKey]) + (masterAuthorityChanged(previous, next, key) ? 1 : 0);
  }
  return {
    dependencyRevisions: Object.freeze(revisions),
    dependencyRevisionBasis: Object.freeze({ supportConfigSignature: nextSupportSignature, branchLineMapSignature: nextBranchSignature }),
  };
}

export function dependencyRevisionSnapshot(state) {
  const revisions = state?.dependencyRevisions || initializeDependencyRevisionState(state).dependencyRevisions;
  return Object.fromEntries(XML_CII_DEPENDENCY_REVISION_KEYS.map((key) => [key, integerRevision(revisions[key])]));
}

export function dependencyRevisionKey(state, keys) {
  const snapshot = dependencyRevisionSnapshot(state);
  return (keys || []).map((key) => `${key}:${snapshot[key] ?? 0}`).join('|');
}
