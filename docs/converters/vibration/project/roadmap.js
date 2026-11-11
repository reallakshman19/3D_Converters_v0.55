import { assertVibrationIntegrityProject } from './schema.js';

function lineById(project, lineId) {
  if (lineId == null) return null;
  return project.subjects.lines.find((line) => line.lineId === lineId) ?? null;
}

function lineLabel(line) {
  return line.legacyEit?.lineReference || line.legacyEit?.lineDescription || line.legacyEit?.rid || line.lineId;
}

function countLabel(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function measurementGuidanceStates(project, lineId) {
  if (!lineId || !project.measurementEvidence) return Object.freeze({});
  const sessions = project.measurementEvidence.sessions.filter((session) => session.scope.lineId === lineId);
  if (!sessions.length) return Object.freeze({});
  const sessionIds = new Set(sessions.map((session) => session.sessionId));
  const products = project.measurementEvidence.products.filter((product) => sessionIds.has(product.sessionId));
  const channelCount = sessions.reduce((total, session) => total + session.channels.length, 0);
  const states = {
    'basic-measurement': Object.freeze({
      dataState: 'DATA_AVAILABLE',
      message: `${countLabel(sessions.length, 'measurement session')} · ${countLabel(channelCount, 'channel')}`,
      evidenceState: 'VALIDATED_FIELD_MEASUREMENT_EVIDENCE',
    }),
  };
  if (products.length) {
    states['specialist-measurement'] = Object.freeze({
      dataState: 'DATA_AVAILABLE',
      message: countLabel(products.length, 'derived signal product'),
      evidenceState: 'VALIDATED_DERIVED_SIGNAL_EVIDENCE',
    });
  }
  return Object.freeze(states);
}

function mergePresentationStates(evidenceStates, explicitStates) {
  const merged = {};
  const keys = new Set([...Object.keys(evidenceStates), ...Object.keys(explicitStates)]);
  for (const key of keys) merged[key] = Object.freeze({ ...(evidenceStates[key] ?? {}), ...(explicitStates[key] ?? {}) });
  return Object.freeze(merged);
}

export function buildVibrationRoadmapStateFromProject(project, { lineId = null, mechanismStates = {} } = {}) {
  assertVibrationIntegrityProject(project);
  const selected = lineById(project, lineId) ?? project.subjects.lines[0] ?? null;
  const measurementStates = measurementGuidanceStates(project, selected?.lineId ?? null);
  return Object.freeze({
    eitImport: project.sourceImports?.eit ?? null,
    mechanismStates: mergePresentationStates(measurementStates, mechanismStates),
    context: Object.freeze({
      projectId: project.project.projectId,
      projectTitle: project.project.title,
      lineId: selected?.lineId ?? null,
      eitRid: selected?.legacyEit?.rid ?? null,
      projectLines: Object.freeze(project.subjects.lines.map((line) => Object.freeze({
        lineId: line.lineId, label: String(lineLabel(line)), eitRid: line.legacyEit?.rid ?? null,
      }))),
    }),
  });
}
