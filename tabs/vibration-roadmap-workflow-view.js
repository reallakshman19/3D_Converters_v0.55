export const VIBRATION_ROADMAP_WORKFLOW_PRESENTATION_SCHEMA = 'VibrationRoadmapWorkflowPresentation.v1';

const ATTENTION_STATUSES = new Set(['ACTION', 'ATTENTION', 'STALE']);
const PHASE_STATE_LABELS = Object.freeze({
  NEEDS_ATTENTION: 'Needs attention',
  HAS_CURRENT_RESULT: 'Current result present',
  HAS_DATA: 'Evidence/data present',
  AVAILABLE: 'Available',
  NOT_APPLICABLE_ONLY: 'Not applicable',
});

function countByStatus(nodes) {
  const counts = {};
  for (const node of nodes) counts[node.status] = (counts[node.status] ?? 0) + 1;
  return Object.freeze(counts);
}

function phaseState(nodes, counts) {
  if (nodes.some((node) => ATTENTION_STATUSES.has(node.status))) return 'NEEDS_ATTENTION';
  if ((counts.CURRENT_RESULT ?? 0) > 0) return 'HAS_CURRENT_RESULT';
  if ((counts.DATA ?? 0) + (counts.IMPORTED ?? 0) > 0) return 'HAS_DATA';
  if (nodes.length && nodes.every((node) => node.status === 'NOT_APPLICABLE')) return 'NOT_APPLICABLE_ONLY';
  return 'AVAILABLE';
}

function summarizePhase(phase, index) {
  const counts = countByStatus(phase.nodes);
  const state = phaseState(phase.nodes, counts);
  return Object.freeze({
    id: phase.id,
    label: phase.label,
    step: index + 1,
    state,
    stateLabel: PHASE_STATE_LABELS[state],
    counts,
    nodes: phase.nodes,
  });
}

function firstAttention(phases) {
  for (const phase of phases) {
    const node = phase.nodes.find((item) => ATTENTION_STATUSES.has(item.status));
    if (node) return Object.freeze({ phaseId: phase.id, phaseLabel: phase.label, node });
  }
  return null;
}

function activePhase(phases, calculationId) {
  if (!calculationId) return null;
  return phases.find((phase) => phase.nodes.some((node) => (
    node.target?.type === 'CALCULATION' && node.target.calculationId === calculationId
  ))) ?? null;
}

export function buildVibrationRoadmapWorkflowPresentation(projection) {
  if (projection?.schema !== 'VibrationRoadmapProjection.v1') {
    throw new TypeError('Workflow presentation requires VibrationRoadmapProjection.v1.');
  }
  const phases = Object.freeze(projection.phases.map(summarizePhase));
  const nextAttention = firstAttention(phases);
  const active = activePhase(phases, projection.context?.calculationId);
  return Object.freeze({
    schema: VIBRATION_ROADMAP_WORKFLOW_PRESENTATION_SCHEMA,
    phases,
    nextAttention,
    focusPhaseId: nextAttention?.phaseId ?? active?.id ?? null,
    authority: Object.freeze({
      purpose: 'RIGHT_RAIL_WORKFLOW_FOCUS_PRESENTATION_ONLY',
      determinesApplicability: false,
      determinesCompleteness: false,
      determinesPhaseCompletion: false,
      engineeringAuthority: 'NONE',
      screeningAuthority: 'NOT_AUTHORIZED',
      designAuthority: false,
    }),
  });
}
