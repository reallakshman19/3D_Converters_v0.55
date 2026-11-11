import {
  buildXmlCiiRigidWeightMatch1Provenance,
  withXmlCiiRigidWeightMatch1,
  xmlCiiRigidWeightLifecycleSnapshot,
} from '../../../converters/xml-cii2019-core/rigid-weight-authority.js?v=20260928-issue776-authority-2';
import { replaceModeAState } from './xml-cii-adapted-mode-a-state.js?v=20261001-weight-output-2';
import { createModeASourceProcessingRef, modeARawRef, modeARawState } from './xml-cii-adapted-mode-a-propagation.js?v=20261001-weight-output-2';

function text(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function parseConfig(value) { try { const out = JSON.parse(String(value || '{}')); return out && typeof out === 'object' && !Array.isArray(out) ? out : {}; } catch { return {}; } }
function clone(value) { try { return JSON.parse(JSON.stringify(value)); } catch { return null; } }

function snapshots(stateRef, sourceIds) {
  return [...new Set(sourceIds)].map((sourceId) => {
    const ref = createModeASourceProcessingRef(stateRef, sourceId);
    const config = parseConfig(ref.current.supportConfigJson);
    return {
      sourceId,
      lifecycle: xmlCiiRigidWeightLifecycleSnapshot(config),
    };
  });
}

function restoreLifecycle(config, lifecycle = {}) {
  const next = { ...config, overrides: { ...(config.overrides || {}) } };
  for (const [bucket, values] of [
    ['rigidWeight', lifecycle.legacy],
    ['rigidWeightMatch1', lifecycle.match1],
    ['rigidWeightMatch1Provenance', lifecycle.match1Provenance],
    ['rigidWeightFinal', lifecycle.final],
  ]) {
    if (values && Object.keys(values).length) next.overrides[bucket] = clone(values) || {};
    else delete next.overrides[bucket];
  }
  return next;
}

export function applyModeAWeightChanges(stateRef, changes = [], label = 'Weight Match') {
  if (!changes.length) return false;
  const before = snapshots(stateRef, changes.map((row) => row.sourceId));
  const bySource = new Map();
  for (const change of changes) {
    if (!bySource.has(change.sourceId)) bySource.set(change.sourceId, []);
    if (text(change.key) && Number(change.weight) > 0) bySource.get(change.sourceId).push(change);
  }
  for (const [sourceId, sourceChanges] of bySource.entries()) {
    const ref = createModeASourceProcessingRef(stateRef, sourceId);
    const current = ref.current;
    const config = parseConfig(current.supportConfigJson);
    const weightsByKey = {};
    const provenanceByKey = {};
    for (const change of sourceChanges) {
      weightsByKey[change.key] = Number(change.weight);
      provenanceByKey[change.key] = buildXmlCiiRigidWeightMatch1Provenance(change, config, change.candidate || null, {
        weightKg: change.weight,
        acceptanceMethod: change.acceptanceMethod || (change.candidate ? 'candidate' : 'manual'),
      });
    }
    const next = withXmlCiiRigidWeightMatch1(config, weightsByKey, provenanceByKey);
    ref.current = { ...current, supportConfigJson: JSON.stringify(next, null, 2) };
  }
  const rawRef = modeARawRef(stateRef);
  const latest = modeARawState(rawRef);
  replaceModeAState(rawRef, { ...latest, modeAConsolidatedWeightUndo: { label, snapshots: before, createdAt: new Date().toISOString() } });
  return true;
}

export function undoModeAWeightChanges(stateRef) {
  const raw = modeARawState(stateRef);
  const undo = raw.modeAConsolidatedWeightUndo;
  if (!undo?.snapshots?.length) return false;
  for (const snapshot of undo.snapshots) {
    const ref = createModeASourceProcessingRef(stateRef, snapshot.sourceId);
    const current = ref.current;
    const config = restoreLifecycle(parseConfig(current.supportConfigJson), snapshot.lifecycle);
    ref.current = { ...current, supportConfigJson: JSON.stringify(config, null, 2) };
  }
  const latest = modeARawState(stateRef);
  replaceModeAState(modeARawRef(stateRef), { ...latest, modeAConsolidatedWeightUndo: null });
  return true;
}
