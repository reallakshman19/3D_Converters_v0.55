import { VIBRATION_ROADMAP_PHASES, VIBRATION_ROADMAP_NODES } from './registry.js';

export const VIBRATION_ROADMAP_PROJECTION_SCHEMA = 'VibrationRoadmapProjection.v1';

function importedModuleMap(eitImport, context = {}) {
  const map = new Map();
  if (!eitImport?.lines) return map;
  const selected = context.eitRid == null
    ? eitImport.lines
    : eitImport.lines.filter((line) => String(line.rid) === String(context.eitRid));
  for (const line of selected) {
    for (const payload of line.modules ?? []) {
      if (!payload.known) continue;
      const meaningful = payload.declaredInModules || payload.resultPresent || payload.dataPresent || payload.parseState === 'MALFORMED';
      if (!meaningful) continue;
      const prior = map.get(payload.mechanismId) ?? {
        lineCount: 0, importedResult: false, importedData: false, malformed: false, declared: false,
      };
      prior.lineCount += 1;
      prior.importedResult ||= payload.resultPresent;
      prior.importedData ||= payload.dataPresent;
      prior.malformed ||= payload.parseState === 'MALFORMED';
      prior.declared ||= payload.declaredInModules;
      map.set(payload.mechanismId, prior);
    }
  }
  return map;
}

function explicitNotApplicable(state) {
  return state?.requirementState === 'NOT_APPLICABLE' && Boolean(state?.requirementEvidenceId);
}

function nodeStatus(state, imported) {
  if (state?.attention === true) return 'ATTENTION';
  if (state?.requirementState === 'NOT_APPLICABLE' && !state?.requirementEvidenceId) return 'ATTENTION';
  if (explicitNotApplicable(state)) return 'NOT_APPLICABLE';
  if (state?.actionRequired === true) return 'ACTION';
  if (state?.resultState === 'STALE_RESULT') return 'STALE';
  if (state?.resultState === 'CURRENT_RESULT') return 'CURRENT_RESULT';
  if (state?.dataState === 'DATA_AVAILABLE') return 'DATA';
  if (imported?.malformed) return 'ATTENTION';
  if (imported) return 'IMPORTED';
  return 'AVAILABLE';
}

function nodeDetail(state, imported, status) {
  if (state?.message) return String(state.message);
  if (status === 'NOT_APPLICABLE') return 'Explicit evidence';
  if (status === 'STALE') return 'Result requires rerun';
  if (status === 'CURRENT_RESULT') return 'Current result';
  if (status === 'ACTION') return 'Action required';
  if (status === 'ATTENTION' && imported?.malformed) return 'Imported module detail is malformed';
  if (status === 'IMPORTED') return `${imported.lineCount} imported line${imported.lineCount === 1 ? '' : 's'}`;
  if (status === 'DATA') return 'Project data available';
  return null;
}

function projectNode(node, imported, mechanismStates) {
  const state = node.mechanismId ? mechanismStates[node.mechanismId] ?? null : mechanismStates[node.id] ?? null;
  const status = nodeStatus(state, imported);
  return Object.freeze({
    ...node,
    status,
    detail: nodeDetail(state, imported, status),
    engineeringRequirementRef: state?.engineeringRequirementRef ?? null,
    authority: 'VISUAL_NAVIGATION_GUIDANCE_ONLY',
  });
}

function groupByPhase(nodes) {
  return VIBRATION_ROADMAP_PHASES.map((phase) => Object.freeze({
    ...phase,
    nodes: Object.freeze(nodes.filter((node) => node.phase === phase.id)),
  }));
}

export function buildVibrationRoadmapProjection({ eitImport = null, mechanismStates = {}, context = {} } = {}) {
  const imported = importedModuleMap(eitImport, context);
  const nodes = VIBRATION_ROADMAP_NODES.map((node) => projectNode(
    node,
    node.mechanismId ? imported.get(node.mechanismId) ?? null : null,
    mechanismStates,
  ));
  return Object.freeze({
    schema: VIBRATION_ROADMAP_PROJECTION_SCHEMA,
    context: Object.freeze({ ...context }),
    phases: Object.freeze(groupByPhase(nodes)),
    authority: Object.freeze({
      purpose: 'VISUAL_NAVIGATION_GUIDANCE_ONLY',
      determinesApplicability: false,
      determinesCompleteness: false,
      engineeringAuthority: 'NONE',
      screeningAuthority: 'NOT_AUTHORIZED',
      designAuthority: false,
    }),
  });
}
