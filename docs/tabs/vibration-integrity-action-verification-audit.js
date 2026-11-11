import { appendVibrationIntegrityAuditEvent } from './vibration-integrity-audit-log.js';
import { deriveVibrationIntegrityWorkflowState } from './vibration-integrity-workflow-state.js';

export function auditVibrationActionVerification(state, eventType, details = {}, scopeId = null) {
  if (!state?.auditLog) return;
  const workflow = deriveVibrationIntegrityWorkflowState(state).state;
  state.auditLog = appendVibrationIntegrityAuditEvent(state.auditLog, {
    timestamp: new Date().toISOString(),
    eventType,
    workflowBefore: workflow,
    workflowAfter: workflow,
    scopeId,
    details,
  });
}
