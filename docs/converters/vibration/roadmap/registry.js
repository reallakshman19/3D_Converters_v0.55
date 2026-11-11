import { listEnergyInstituteEitModules } from '../eit/module-registry.js';
import { resolveVibrationRoadmapSourceBinding } from '../source/registry.js';

export const VIBRATION_ROADMAP_REGISTRY_SCHEMA = 'VibrationRoadmapRegistry.v1';
export const VIBRATION_ROADMAP_REGISTRY_REVISION = 'VIB-ROADMAP-GUIDE-2026-08-18-MEASUREMENT-1';

const PHASES = [
  { id: 'IDENTIFY', label: 'Identify' }, { id: 'SCREEN', label: 'Screen' },
  { id: 'VERIFY', label: 'Verify' }, { id: 'DIAGNOSE', label: 'Diagnose' },
  { id: 'MITIGATE', label: 'Mitigate' }, { id: 'CONFIRM', label: 'Confirm' },
];

const GUIDANCE_NODES = [
  { id: 'mechanism-identification', label: 'Mechanism Identification', phase: 'IDENTIFY', scope: 'CROSS_SCOPE', specialty: 'GENERAL', target: null },
  { id: 'visual-piping', label: 'Visual Assessment — Piping', phase: 'VERIFY', scope: 'CROSS_SCOPE', specialty: 'FIELD_DYNAMICS', target: null },
  { id: 'visual-tubing', label: 'Visual Assessment — Tubing', phase: 'VERIFY', scope: 'CROSS_SCOPE', specialty: 'FIELD_DYNAMICS', target: null },
  { id: 'basic-measurement', label: 'Basic Vibration Measurement', phase: 'VERIFY', scope: 'CROSS_SCOPE', specialty: 'FIELD_DYNAMICS', target: null },
  { id: 'specialist-measurement', label: 'Specialist Measurement', phase: 'VERIFY', scope: 'CROSS_SCOPE', specialty: 'FIELD_DYNAMICS', target: null },
  { id: 'predictive-analysis', label: 'Predictive Analysis / RCA', phase: 'DIAGNOSE', scope: 'CROSS_SCOPE', specialty: 'PREDICTIVE_RCA', target: null },
  { id: 'mainline-mitigation', label: 'Main-Line Corrective Action', phase: 'MITIGATE', scope: 'MAINLINE', specialty: 'MITIGATION', target: null },
  { id: 'branch-mitigation', label: 'SBC Corrective Action', phase: 'MITIGATE', scope: 'BRANCH_ATTACHMENT', specialty: 'MITIGATION', target: null },
  { id: 'thermowell-mitigation', label: 'Thermowell Corrective Action', phase: 'MITIGATE', scope: 'BRANCH_ATTACHMENT', specialty: 'MITIGATION', target: null },
  { id: 'good-design-practice', label: 'Good Design Practice', phase: 'MITIGATE', scope: 'CROSS_SCOPE', specialty: 'MITIGATION', target: null },
  { id: 'post-mod-verification', label: 'Post-Modification Verification', phase: 'CONFIRM', scope: 'CROSS_SCOPE', specialty: 'VERIFICATION', target: null },
];

function withSource(node) {
  return {
    ...node,
    source: resolveVibrationRoadmapSourceBinding({ mechanismId: node.mechanismId ?? null, nodeId: node.id }),
  };
}

function screeningNodes() {
  return listEnergyInstituteEitModules().map((module) => withSource({
    id: `mechanism-${module.mechanismId}`, label: module.label, phase: module.phase,
    scope: module.scope, specialty: module.specialty, mechanismId: module.mechanismId,
    eitModuleCode: module.code,
    target: module.calculationId ? { type: 'CALCULATION', calculationId: module.calculationId } : null,
  }));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export const VIBRATION_ROADMAP_PHASES = freeze(PHASES.map((phase) => ({ ...phase })));
export const VIBRATION_ROADMAP_NODES = freeze([
  ...screeningNodes(), ...GUIDANCE_NODES.map(withSource),
].map((node) => ({ ...node })));

export const VIBRATION_ROADMAP_REGISTRY = freeze({
  schema: VIBRATION_ROADMAP_REGISTRY_SCHEMA,
  revision: VIBRATION_ROADMAP_REGISTRY_REVISION,
  phases: VIBRATION_ROADMAP_PHASES,
  nodes: VIBRATION_ROADMAP_NODES,
  authority: {
    purpose: 'VISUAL_NAVIGATION_GUIDANCE_ONLY', determinesApplicability: false,
    determinesCompleteness: false, engineeringAuthority: 'NONE',
    screeningAuthority: 'NOT_AUTHORIZED', designAuthority: false,
  },
});
