import {
  VIBRATION_ASSESSMENT_UNIT_TYPES,
  VIBRATION_IDENTIFICATION_DISPOSITIONS,
  VIBRATION_REQUIRED_QUALIFICATIONS,
} from '../converters/vibration/mechanisms/coverage.js';
import { collectVibrationT1Suggestions } from '../converters/vibration/mechanisms/identification-suggestions.js';
import { VIBRATION_MECHANISM_IDS } from '../converters/vibration/mechanisms/registry.js';
import {
  vibrationIdentificationAuthoringRowState,
  vibrationIdentificationAuthoringSummary,
} from './vibration-integrity-identification-model.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function option(value, selected, label = value) {
  return `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
}

function selectCell(rowIndex, field, value, values, blankLabel) {
  return `<select data-vi-identification-row="${rowIndex}" data-vi-identification-cell="${field}">
    ${option('', value, blankLabel)}${values.map((item) => option(item, value)).join('')}
  </select>`;
}

function inputCell(rowIndex, field, value, placeholder = '') {
  return `<input type="text" value="${esc(value)}" placeholder="${esc(placeholder)}"
    data-vi-identification-row="${rowIndex}" data-vi-identification-cell="${field}">`;
}

function stateCell(row) {
  const state = vibrationIdentificationAuthoringRowState(row);
  const errors = state.errors.length
    ? `<small class="vi-mono">${esc(state.errors.join('; '))}</small>`
    : '';
  return `<strong>${esc(state.status)}</strong>${errors}`;
}

function tableRows(table) {
  if (!table.rows.length) {
    return '<tr><td colspan="11" class="vi-table-empty">No mechanism-identification evidence has been authored.</td></tr>';
  }
  return table.rows.map((row, index) => `<tr>
    <td>${stateCell(row)}</td>
    <td>${selectCell(index, 'mechanismId', row.mechanismId, VIBRATION_MECHANISM_IDS, 'Select mechanism')}</td>
    <td>${inputCell(index, 'line', row.line, 'Line')}</td>
    <td>${inputCell(index, 'caseId', row.caseId, 'Case or blank')}</td>
    <td>${inputCell(index, 'canonicalId', row.canonicalId, 'Canonical ID')}</td>
    <td>${selectCell(index, 'assessmentUnitType', row.assessmentUnitType, VIBRATION_ASSESSMENT_UNIT_TYPES, 'Select unit type')}</td>
    <td>${selectCell(index, 'disposition', row.disposition, VIBRATION_IDENTIFICATION_DISPOSITIONS, 'Select disposition')}</td>
    <td>${selectCell(index, 'requiredQualification', row.requiredQualification, VIBRATION_REQUIRED_QUALIFICATIONS, 'Select only if REQUIRED')}</td>
    <td>${inputCell(index, 'sourceId', row.sourceId, 'Project/source reference')}</td>
    <td>${inputCell(index, 'reason', row.reason, 'Reviewed basis / rule reference')}</td>
    <td><button type="button" class="vi-row-link" data-vi-identification-delete="${index}">Delete</button></td>
  </tr>`).join('');
}

function summary(table) {
  const counts = vibrationIdentificationAuthoringSummary(table);
  const cards = [
    ['Rows', counts.rows], ['Ready', counts.ready], ['Incomplete', counts.incomplete],
    ['Invalid', counts.invalid], ['Empty', counts.empty],
  ];
  return `<div class="vi-summary">${cards.map(([label, value]) => (
    `<div class="vi-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`
  )).join('')}</div>`;
}

function suggestionData(state) {
  const scopes = (state.workspace?.rows ?? []).map((row) => ({
    line: row.line, caseId: row.caseId ?? null, canonicalId: row.canonicalId,
  }));
  const enrichment = state.envelope?.workflow?.dataset?.enrichment ?? [];
  return collectVibrationT1Suggestions({ scopes, enrichment });
}

function suggestionRows(suggestions) {
  if (!suggestions.length) {
    return '<tr><td colspan="7" class="vi-table-empty">No verified T1 suggestion facts are present for current facility scopes.</td></tr>';
  }
  return suggestions.map((item) => `<tr>
    <td><strong>${esc(item.mechanismId)}</strong></td>
    <td>${esc(item.scope.line)}</td><td>${esc(item.scope.caseId ?? '—')}</td><td>${esc(item.scope.canonicalId)}</td>
    <td>${esc(item.triggerFact.label)}<small class="vi-mono">${esc(item.triggerFact.property)} = true · VERIFIED</small></td>
    <td>${esc(item.suggestedAssessmentUnitType)}</td>
    <td><strong>PENDING ENGINEER REVIEW</strong><small>${esc(item.triggerFact.source || 'Project source')} · ${esc(item.ruleId)}</small></td>
  </tr>`).join('');
}

function suggestionSection(state) {
  const suggestions = suggestionData(state);
  return `<section class="vi-card">
    <div class="vi-section-head"><div><h3>T1 mechanism suggestions</h3>
      <p>Exact verified project facts can highlight likely mechanism reviews. Suggestions are context assistance only; use Add identification row to record the engineer/reviewer disposition.</p></div></div>
    <div class="vi-banner warn"><strong>Suggestions are not applicability evidence.</strong><span>No suggestion is passed to the identification producer, no disposition is inferred, and no completeness requirement can be satisfied until explicit identification evidence is authored and valid.</span></div>
    <div class="vi-table-wrap"><table class="vi-table"><thead><tr>
      <th>Suggested mechanism</th><th>Line</th><th>Case</th><th>Canonical ID</th><th>Verified trigger fact</th><th>Suggested unit</th><th>State</th>
    </tr></thead><tbody>${suggestionRows(suggestions)}</tbody></table></div>
  </section>`;
}

export function renderVibrationIdentificationAuthoring(state) {
  const table = state.mechanismIdentificationAuthoring;
  return `${suggestionSection(state)}<section class="vi-card vi-workspace-card">
    <div class="vi-section-head"><div>
      <h3>Mechanism identification evidence</h3>
      <p>Author explicit project/source evidence for one exact line/case/canonical scope. The registry supplies mechanism names only; this workspace never selects applicability, assessment unit, disposition, or authority for you.</p>
    </div><button type="button" data-vi-identification-add>Add identification row</button></div>
    <div class="vi-banner warn"><strong>Identification authority only.</strong><span>Source ID is retained provenance text, not proof of controlled-source qualification. REQUIRED / NOT_APPLICABLE / UNRESOLVED are explicit user/reviewer dispositions. No screening, design, code, or numerical authority is granted here.</span></div>
    ${summary(table)}
    <div class="vi-table-wrap"><table class="vi-table"><thead><tr>
      <th>State</th><th>Mechanism</th><th>Line</th><th>Case</th><th>Canonical ID</th>
      <th>Assessment unit</th><th>Disposition</th><th>Required qualification</th><th>Source ID</th><th>Reason / rule reference</th><th>Action</th>
    </tr></thead><tbody>${tableRows(table)}</tbody></table></div>
    <p class="vi-note">A non-empty incomplete/invalid row fails closed. Evidence is used only for an exact matching facility scope; evidence authored for another scope cannot satisfy this row.</p>
  </section>`;
}
