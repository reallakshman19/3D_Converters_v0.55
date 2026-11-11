import { buildSbcConnectionAuthoringProjection } from './vibration-integrity-sbc-connection-model.js?v=20260819-sbc-connection-authoring-1';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function option(value, selected, label = value) {
  return `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
}

function inputControl(field) {
  if (field.kind === 'ENUM') {
    return `<select class="vi-cell-input" data-vi-sbc-connection-field="${esc(field.path)}">
      <option value="">Select explicitly</option>${field.options.map((value) => option(value, field.rawValue)).join('')}
    </select>`;
  }
  if (field.kind === 'BOOLEAN') {
    return `<select class="vi-cell-input" data-vi-sbc-connection-field="${esc(field.path)}">
      <option value="">Select explicitly</option>${option('TRUE', field.rawValue, 'Yes / TRUE')}${option('FALSE', field.rawValue, 'No / FALSE')}
    </select>`;
  }
  const placeholder = field.kind.includes('LIST') ? 'Comma-separated explicit values' : 'Enter project value';
  return `<input class="vi-cell-input" data-vi-sbc-connection-field="${esc(field.path)}" value="${esc(field.rawValue)}" placeholder="${esc(placeholder)}">`;
}

function semanticCell(field) {
  const semantic = field.semanticTrace;
  if (!semantic) return '<span class="vi-empty">No SBC-UNIT row yet</span>';
  const unit = field.nativeUnit ? ` · native ${field.nativeUnit}` : '';
  return `<strong class="vi-mono">${esc(semantic.traceId)}${esc(unit)}</strong><small>${esc(semantic.semantic)}</small><small class="vi-mono">${esc(semantic.sourceLocator)}</small>`;
}

function fieldRows(projection) {
  return projection.fields.map((field) => `<tr>
    <td><strong>${esc(field.label)}</strong><small class="vi-mono">${esc(field.path)}</small></td>
    <td>${inputControl(field)}</td>
    <td>${semanticCell(field)}</td>
    <td><input class="vi-cell-input" data-vi-sbc-connection-evidence="${esc(field.path)}" value="${esc(field.evidenceRef)}" placeholder="Drawing / P&amp;ID / survey / calculation record"></td>
    <td><strong>${esc(field.state)}</strong>${field.parsed.error ? `<small class="vi-mono">${esc(field.parsed.error)}</small>` : ''}</td>
  </tr>`).join('');
}

function problemList(projection) {
  const problems = [
    ...(projection.structuralValidation?.missingFields ?? []).map((path) => `MISSING: ${path}`),
    ...(projection.structuralValidation?.problems ?? []).map((item) => `STRUCTURE: ${item}`),
    ...(projection.syntaxErrors ?? []).map((item) => `INPUT: ${item}`),
    ...(projection.missingEvidenceRefs ?? []).map((path) => `EVIDENCE REF MISSING: ${path}`),
  ];
  if (!problems.length) return '<span class="vi-empty">No structural/project-evidence gaps in the authored record.</span>';
  return `<ul>${problems.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

function type3Boundary(scopeId) {
  return `<section class="vi-card">
    <div class="vi-section-head"><div><h3>Type 3 · existing candidate input custody retained</h3><p>The generic Type 1/2/4 connection editor is intentionally not duplicated for Type 3.</p></div>
      <div class="vi-authority"><strong>CANDIDATE ONLY</strong><span>NO SECOND INPUT AUTHORITY</span></div></div>
    <div class="vi-banner warn"><strong>Type-3 separation.</strong><span>Use the existing Type-3 candidate panel below for scope ${esc(scopeId || '—')}. T3 curves remain quarantined and this workspace does not create a parallel set of calculation inputs.</span></div>
  </section>`;
}

export function renderSbcConnectionAuthoringPanel(state, selectedType) {
  const scopeId = String(state.sbcWorkspaceScopeId ?? '').trim();
  if (selectedType === 'TYPE_3') return type3Boundary(scopeId);
  const projection = buildSbcConnectionAuthoringProjection(
    state.sbcConnectionAuthoringStore,
    scopeId,
    selectedType,
  );
  if (!scopeId || !selectedType) {
    return `<section class="vi-card vi-empty-state"><h3>Connection evidence editor</h3><p>Enter an exact connection/facility scope and explicitly select Type 1, 2 or 4 to author project evidence.</p></section>`;
  }
  const trace = projection.typeConfirmationTrace;
  const complete = projection.status === 'STRUCTURE_AND_PROJECT_EVIDENCE_COMPLETE_NOT_QUALIFIED';
  return `<section class="vi-card">
    <div class="vi-section-head"><div><h3>${esc(selectedType.replace('_', ' '))} · connection project evidence</h3>
      <p>Author structural project inputs and bind each value to its project evidence record. This editor is not a numerical SBC calculator.</p></div>
      <div class="vi-authority"><strong>PROJECT INPUT</strong><span>ENGINEERING AUTHORITY NONE · NUMERICAL EXECUTION BLOCKED</span></div></div>
    <div class="vi-banner${complete ? '' : ' warn'}"><strong>${esc(projection.status)}</strong><span>Structural completeness and project-evidence custody are separate from SBC method qualification, B1/B2 qualification and screening authority.</span></div>
    <div class="vi-summary">
      <div class="vi-metric"><small>Scope</small><strong>${esc(projection.scopeId)}</strong></div>
      <div class="vi-metric"><small>Record revision</small><strong>${esc(projection.recordRevision)}</strong></div>
      <div class="vi-metric"><small>Structural contract</small><strong>${esc(projection.structuralValidation?.structuralStatus ?? 'NOT READY')}</strong></div>
      <div class="vi-metric"><small>Project evidence refs</small><strong>${projection.projectEvidenceComplete ? 'COMPLETE' : 'INCOMPLETE'}</strong></div>
    </div>
    ${trace ? `<div class="vi-import-facts"><span>Type confirmation trace: <strong class="vi-mono">${esc(trace.traceId)}</strong></span><span>Worked example: <strong>${esc(trace.exampleId)}</strong></span><span>Use: <strong>${esc(trace.useAllowed)}</strong></span></div>` : ''}
    <div class="vi-table-wrap"><table class="vi-table"><thead><tr>
      <th>Contract field</th><th>Project value</th><th>Reference semantic trace</th><th>Project evidence reference</th><th>State</th>
    </tr></thead><tbody>${fieldRows(projection)}</tbody></table></div>
    <div class="vi-detail-grid">
      <div><h4>Current gaps / contradictions</h4>${problemList(projection)}</div>
      <div><h4>Authority boundary</h4><ul>
        <li>Project evidence is user-authored and is not controlled-source authority.</li>
        <li>Reference semantic traces are not numerical-method authority.</li>
        <li>Automatic Type classification remains disabled.</li>
        <li>FIT-only main-line evidence remains rejected by the structural contract.</li>
        <li>Even a complete record remains not qualified for numerical execution.</li>
      </ul></div>
    </div>
    <button type="button" class="vi-btn" disabled>Numerical SBC execution unavailable — qualification gates remain open</button>
  </section>`;
}
