export const VIBRATION_ROADMAP_SCOPE_CHOICES_SCHEMA = 'VibrationRoadmapScopeChoices.v1';

export const VIBRATION_ROADMAP_SCOPE_CHOICES_AUTHORITY = Object.freeze({
  purpose: 'CURRENT_REGISTER_SCOPE_NAVIGATION_ONLY',
  identitySource: 'VibrationWorkspaceModel.currentRows',
  createsCaseIdentity: false,
  persistenceAuthority: 'NONE',
  determinesApplicability: false,
  determinesCompleteness: false,
  determinesNextAction: false,
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
});

function clean(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function choiceFromRow(row) {
  const rowKey = clean(row?.rowKey);
  const line = clean(row?.line);
  const canonicalId = clean(row?.canonicalId);
  if (!rowKey || !line || !canonicalId) return null;
  return Object.freeze({ rowKey, line, caseId: clean(row?.caseId), canonicalId });
}

function validChoice(choice) {
  return clean(choice?.rowKey) === choice?.rowKey
    && clean(choice?.line) === choice?.line
    && clean(choice?.canonicalId) === choice?.canonicalId
    && (choice?.caseId == null || clean(choice.caseId) === choice.caseId);
}

function duplicateRowKey(choices) {
  const keys = choices.map((choice) => choice.rowKey);
  return new Set(keys).size !== keys.length;
}

export function formatVibrationRoadmapScopeChoiceLabel(choice) {
  const line = clean(choice?.line) ?? 'Unassigned line';
  const caseId = clean(choice?.caseId) ?? 'No case ID';
  const canonicalId = clean(choice?.canonicalId) ?? 'Unassigned scope';
  return `${line} · ${caseId} · ${canonicalId}`;
}

export function buildVibrationRoadmapScopeChoices(rows = [], selectedRowKey = null) {
  const choices = rows.map(choiceFromRow).filter(Boolean);
  const selected = clean(selectedRowKey);
  const ambiguous = duplicateRowKey(choices);
  const selectedPresent = selected != null && choices.some((choice) => choice.rowKey === selected);
  const state = ambiguous
    ? 'AMBIGUOUS_ROW_KEY'
    : selected && !selectedPresent
      ? 'SELECTED_ROW_UNAVAILABLE'
      : choices.length ? 'AVAILABLE' : 'NO_REGISTER_SCOPES';
  return Object.freeze({
    schema: VIBRATION_ROADMAP_SCOPE_CHOICES_SCHEMA,
    state,
    selectedRowKey: state === 'AVAILABLE' ? selected : null,
    choices: Object.freeze(state === 'AVAILABLE' ? choices : []),
    authority: VIBRATION_ROADMAP_SCOPE_CHOICES_AUTHORITY,
  });
}

export function isGovernedVibrationRoadmapScopeChoices(value) {
  const authority = value?.authority;
  const choices = value?.choices;
  const selected = clean(value?.selectedRowKey);
  if (value?.schema !== VIBRATION_ROADMAP_SCOPE_CHOICES_SCHEMA || value.state !== 'AVAILABLE') return false;
  if (!Array.isArray(choices) || !choices.length || choices.some((choice) => !validChoice(choice))) return false;
  if (duplicateRowKey(choices) || !selected || !choices.some((choice) => choice.rowKey === selected)) return false;
  return authority?.purpose === 'CURRENT_REGISTER_SCOPE_NAVIGATION_ONLY'
    && authority?.identitySource === 'VibrationWorkspaceModel.currentRows'
    && authority?.createsCaseIdentity === false
    && authority?.persistenceAuthority === 'NONE'
    && authority?.determinesApplicability === false
    && authority?.determinesCompleteness === false
    && authority?.determinesNextAction === false
    && authority?.engineeringAuthority === 'NONE'
    && authority?.screeningAuthority === 'NOT_AUTHORIZED'
    && authority?.designAuthority === false;
}

export function resolveVibrationRoadmapScopeSelection(scopeChoices, rowKey) {
  if (!isGovernedVibrationRoadmapScopeChoices(scopeChoices)) return null;
  const key = clean(rowKey);
  if (!key) return null;
  return scopeChoices.choices.find((choice) => choice.rowKey === key) ?? null;
}
