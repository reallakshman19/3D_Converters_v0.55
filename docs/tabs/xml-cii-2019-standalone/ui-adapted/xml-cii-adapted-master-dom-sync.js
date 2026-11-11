import { MASTER_FIELDS } from './xml-cii-adapted-fields-config.js';
import { effectiveDraftFieldMap, masterMappingStatus } from './xml-cii-adapted-master-runtime.js';
import { perfCount } from './xml-cii-adapted-perf.js';

export function masterMappingHealthText(masterKey, fieldMap = {}) {
  const fields = MASTER_FIELDS[masterKey]?.fields || [];
  const required = fields.filter((field) => field.required);
  const mappedRequired = required.filter((field) => !!fieldMap[field.name]).length;
  const mappedTotal = fields.filter((field) => !!fieldMap[field.name]).length;
  const summary = required.length
    ? `Mapped ${mappedTotal}/${fields.length}; required ${mappedRequired}/${required.length}`
    : `Mapped ${mappedTotal}/${fields.length}`;
  const help = masterKey === 'lineList'
    ? 'Line List uses the XML->CII Import Master detector first, then dynamic fuzzy fallback for standalone-only fields.'
    : 'Dynamic fuzzy mapping uses header aliases and row previews.';
  return `${summary}. ${help}`;
}

export function masterMappingStatusText(status) {
  return status?.dirty
    ? `Mapping status: MODIFIED — NOT APPLIED. Current calculation basis: Applied mapping revision ${status.revision}. Preview uses applied mapping revision ${status.revision}.`
    : `Mapping status: APPLIED. Revision: ${status?.revision ?? 0}. Preview uses applied mapping revision ${status?.revision ?? 0}.`;
}

function syncStatusStyle(node, dirty) {
  if (!node?.style) return;
  node.style.border = dirty ? '1px solid rgba(245,158,11,.5)' : '1px solid rgba(16,185,129,.35)';
  node.style.background = dirty ? 'rgba(245,158,11,.08)' : 'rgba(16,185,129,.06)';
}

function masterCard(container, masterKey) {
  return container.querySelector?.(`[data-master="${masterKey}"]`) || null;
}

function mappingHealthNode(container, masterKey) {
  return container.querySelector?.(`[data-master-mapping-health="${masterKey}"]`)
    || masterCard(container, masterKey)?.querySelector?.('.xml-cii-master-column-mapping .xml-cii-phase-help')
    || null;
}

export function syncMasterDraftDom(container, state, config, masterKey) {
  if (!container || !masterKey) return { updated: false, reason: 'missing-target' };
  const context = state?.masterContext || {};
  const fieldMap = effectiveDraftFieldMap(context, config || {}, masterKey);
  const status = masterMappingStatus(context, config || {}, masterKey);
  let touched = 0;

  const statusNode = container.querySelector?.(`[data-master-mapping-status="${masterKey}"]`);
  if (statusNode) {
    statusNode.textContent = masterMappingStatusText(status);
    statusNode.dataset.mappingDirty = status.dirty ? 'true' : 'false';
    syncStatusStyle(statusNode, status.dirty);
    touched += 1;
  }

  const healthNode = mappingHealthNode(container, masterKey);
  if (healthNode) {
    healthNode.textContent = masterMappingHealthText(masterKey, fieldMap);
    touched += 1;
  }

  const mappingSelects = container.querySelectorAll?.(`[data-master-key="${masterKey}"][data-master-field-map]`) || [];
  for (const select of mappingSelects) {
    const field = select.dataset?.masterFieldMap;
    if (!field) continue;
    const nextValue = String(fieldMap[field] || '');
    if (select.value !== nextValue) select.value = nextValue;
    touched += 1;
  }

  for (const action of ['apply-master-mapping', 'discard-master-mapping']) {
    const button = container.querySelector?.(`[data-action="${action}"][data-master-key="${masterKey}"]`);
    if (!button) continue;
    button.disabled = !status.dirty;
    if (button.style) button.style.cursor = status.dirty ? 'pointer' : 'not-allowed';
    touched += 1;
  }

  const writeBackNode = container.querySelector?.('.xml-cii-master-actions .xml-cii-phase-help');
  if (writeBackNode && state?.importMastersWriteBackStatus != null) {
    writeBackNode.textContent = String(state.importMastersWriteBackStatus || '');
    touched += 1;
  }

  perfCount('masterPartialDomUpdateCount');
  return {
    updated: touched > 0,
    touched,
    dirty: status.dirty,
    revision: status.revision,
    fieldMap: { ...fieldMap },
  };
}
