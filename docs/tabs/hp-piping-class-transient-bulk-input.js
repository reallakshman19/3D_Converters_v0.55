export const HP_PIPING_CLASS_STATE_BULK_HEADERS = Object.freeze([
  'state_id',
  'pressure_mpa',
  'material_temperature_c',
  'structural_temperature_c',
]);

export const HP_PIPING_CLASS_CYCLE_BULK_HEADERS = Object.freeze([
  'cycle_id',
  'from_state_id',
  'to_state_id',
  'total_cycles',
  'cycles_per_year',
  'category',
  'provenance_id',
]);

export const HP_PIPING_CLASS_TRANSIENT_BULK_MAX_STATES = 200;
export const HP_PIPING_CLASS_TRANSIENT_BULK_MAX_CYCLES = 1000;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? '').trim();
}

function identity(value) {
  return text(value).toUpperCase();
}

function issue(code, message, details = {}) {
  return Object.freeze({ code, message, details });
}

function parseRecord(line, delimiter) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else cell += char;
  }
  if (quoted) return { ok: false, cells: [] };
  cells.push(cell.trim());
  return { ok: true, cells };
}

function parseNumber(raw, { allowBlank = false, minimum = null } = {}) {
  const value = text(raw);
  if (!value) return allowBlank ? { ok: true, value: null } : { ok: false, value: null };
  const number = Number(value);
  if (!Number.isFinite(number)) return { ok: false, value: null };
  if (minimum !== null && number < minimum) return { ok: false, value: null };
  return { ok: true, value: number };
}

function tableLines(sourceText) {
  return String(sourceText ?? '').replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((line) => line.trim());
}

function parseTable(sourceText, headers, maximumRows, prefix, label, issues) {
  const normalized = String(sourceText ?? '').replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    issues.push(issue(`${prefix}_TEXT_REQUIRED`, `${label} table is required.`));
    return { delimiter: null, rows: [] };
  }
  const lines = tableLines(normalized);
  if (lines.length < 2) issues.push(issue(`${prefix}_ROWS_REQUIRED`, `${label} table must contain the exact header and at least one data row.`));
  if (lines.length - 1 > maximumRows) issues.push(issue(`${prefix}_ROW_LIMIT`, `${label} table contains ${lines.length - 1} rows; maximum is ${maximumRows}.`));
  const delimiter = lines[0]?.includes('\t') ? '\t' : ',';
  const header = parseRecord(lines[0] ?? '', delimiter);
  if (!header.ok || header.cells.join('|') !== headers.join('|')) {
    issues.push(issue(`${prefix}_HEADER_MISMATCH`, `Header must be exactly: ${headers.join(',')}.`));
  }
  return {
    delimiter: delimiter === '\t' ? 'TSV' : 'CSV',
    rows: header.ok ? lines.slice(1, maximumRows + 1).map((line, offset) => ({ rowNumber: offset + 2, parsed: parseRecord(line, delimiter) })) : [],
  };
}

function existingIdentityMap(rows, field) {
  return new Map((rows ?? []).map((row) => [identity(row?.[field]), text(row?.[field])]).filter(([key]) => key));
}

function normalizeStates(project, sourceText, spectrumId, issues) {
  const table = parseTable(sourceText, HP_PIPING_CLASS_STATE_BULK_HEADERS, HP_PIPING_CLASS_TRANSIENT_BULK_MAX_STATES, 'STATE_BULK', 'Operating-state', issues);
  const seen = new Map();
  const existing = existingIdentityMap(project?.transient?.states, 'stateId');
  const states = [];
  for (const entry of table.rows) {
    const { rowNumber, parsed } = entry;
    if (!parsed.ok || parsed.cells.length !== HP_PIPING_CLASS_STATE_BULK_HEADERS.length) {
      issues.push(issue('STATE_BULK_ROW_SHAPE_INVALID', `State row ${rowNumber} must contain exactly ${HP_PIPING_CLASS_STATE_BULK_HEADERS.length} columns.`, { rowNumber }));
      continue;
    }
    const [stateRaw, pressureRaw, materialRaw, structuralRaw] = parsed.cells;
    const stateId = text(stateRaw);
    const key = identity(stateId);
    if (!stateId) issues.push(issue('STATE_BULK_STATE_ID_REQUIRED', `State row ${rowNumber} requires state_id.`, { rowNumber }));
    else if (seen.has(key)) issues.push(issue('STATE_BULK_STATE_ID_DUPLICATE', `state_id ${stateId} duplicates row ${seen.get(key)} (case-insensitive identity).`, { rowNumber, stateId }));
    else seen.set(key, rowNumber);
    const existingId = existing.get(key);
    if (existingId && existingId !== stateId) {
      issues.push(issue('STATE_BULK_STATE_ID_CASE_RENAME_BLOCKED', `State row ${rowNumber} changes existing state identity ${existingId} only by letter case. Use the exact existing state_id to preserve transition/KD custody.`, { rowNumber, stateId, existingStateId: existingId }));
    }

    const pressure = parseNumber(pressureRaw, { minimum: 0 });
    const material = parseNumber(materialRaw);
    const structural = parseNumber(structuralRaw);
    if (!pressure.ok) issues.push(issue('STATE_BULK_PRESSURE_INVALID', `State row ${rowNumber} pressure_mpa must be finite and >= 0.`, { rowNumber, stateId }));
    if (!material.ok) issues.push(issue('STATE_BULK_MATERIAL_TEMPERATURE_INVALID', `State row ${rowNumber} material_temperature_c must be finite.`, { rowNumber, stateId }));
    if (!structural.ok) issues.push(issue('STATE_BULK_STRUCTURAL_TEMPERATURE_INVALID', `State row ${rowNumber} structural_temperature_c must be finite.`, { rowNumber, stateId }));

    states.push(Object.freeze({ spectrumId, stateId, pressureMpa: pressure.value, materialTemperatureC: material.value, structuralTemperatureC: structural.value }));
  }
  return { states, delimiter: table.delimiter };
}

function normalizeCycles(project, sourceText, spectrumId, states, issues) {
  const table = parseTable(sourceText, HP_PIPING_CLASS_CYCLE_BULK_HEADERS, HP_PIPING_CLASS_TRANSIENT_BULK_MAX_CYCLES, 'CYCLE_BULK', 'Governed-cycle', issues);
  const statesById = new Map(states.map((row) => [row.stateId, row]));
  const statesByIdentity = new Map(states.map((row) => [identity(row.stateId), row.stateId]));
  const existing = existingIdentityMap(project?.transient?.transitions, 'cycleId');
  const seen = new Map();
  const transitions = [];
  for (const entry of table.rows) {
    const { rowNumber, parsed } = entry;
    if (!parsed.ok || parsed.cells.length !== HP_PIPING_CLASS_CYCLE_BULK_HEADERS.length) {
      issues.push(issue('CYCLE_BULK_ROW_SHAPE_INVALID', `Cycle row ${rowNumber} must contain exactly ${HP_PIPING_CLASS_CYCLE_BULK_HEADERS.length} columns.`, { rowNumber }));
      continue;
    }
    const [cycleRaw, fromRaw, toRaw, totalRaw, annualRaw, categoryRaw, provenanceRaw] = parsed.cells;
    const cycleId = text(cycleRaw);
    const key = identity(cycleId);
    if (!cycleId) issues.push(issue('CYCLE_BULK_CYCLE_ID_REQUIRED', `Cycle row ${rowNumber} requires cycle_id.`, { rowNumber }));
    else if (seen.has(key)) issues.push(issue('CYCLE_BULK_CYCLE_ID_DUPLICATE', `cycle_id ${cycleId} duplicates row ${seen.get(key)} (case-insensitive identity).`, { rowNumber, cycleId }));
    else seen.set(key, rowNumber);
    const existingId = existing.get(key);
    if (existingId && existingId !== cycleId) {
      issues.push(issue('CYCLE_BULK_CYCLE_ID_CASE_RENAME_BLOCKED', `Cycle row ${rowNumber} changes existing cycle identity ${existingId} only by letter case. Use the exact existing cycle_id to preserve KD custody.`, { rowNumber, cycleId, existingCycleId: existingId }));
    }

    const fromStateId = text(fromRaw);
    const toStateId = text(toRaw);
    for (const [field, stateId] of [['from_state_id', fromStateId], ['to_state_id', toStateId]]) {
      if (!stateId) {
        issues.push(issue('CYCLE_BULK_STATE_ID_REQUIRED', `Cycle row ${rowNumber} requires ${field}.`, { rowNumber, cycleId, field }));
        continue;
      }
      if (!statesById.has(stateId)) {
        const caseMatch = statesByIdentity.get(identity(stateId));
        issues.push(issue(
          caseMatch ? 'CYCLE_BULK_STATE_CASE_MISMATCH' : 'CYCLE_BULK_STATE_UNKNOWN',
          caseMatch ? `Cycle row ${rowNumber} references ${stateId}; imported state identity is ${caseMatch}. State references are exact.` : `Cycle row ${rowNumber} references unknown state ${stateId}.`,
          { rowNumber, cycleId, field, stateId, ...(caseMatch ? { expectedStateId: caseMatch } : {}) },
        ));
      }
    }

    const totalCycles = parseNumber(totalRaw, { minimum: 0 });
    const cyclesPerYear = parseNumber(annualRaw, { allowBlank: true, minimum: 0 });
    if (!totalCycles.ok) issues.push(issue('CYCLE_BULK_TOTAL_CYCLES_INVALID', `Cycle row ${rowNumber} total_cycles must be finite and >= 0.`, { rowNumber, cycleId }));
    if (!cyclesPerYear.ok) issues.push(issue('CYCLE_BULK_CYCLES_PER_YEAR_INVALID', `Cycle row ${rowNumber} cycles_per_year must be blank or finite and >= 0.`, { rowNumber, cycleId }));

    const from = statesById.get(fromStateId);
    const to = statesById.get(toStateId);
    transitions.push(Object.freeze({
      spectrumId,
      cycleId,
      fromStateId,
      toStateId,
      totalCycles: totalCycles.value,
      ...(cyclesPerYear.value === null ? {} : { cyclesPerYear: cyclesPerYear.value }),
      category: text(categoryRaw),
      ...(text(provenanceRaw) ? { provenanceId: text(provenanceRaw) } : {}),
      previewPressureRangeMpa: from && to ? Math.abs(to.pressureMpa - from.pressureMpa) : null,
    }));
  }
  return { transitions, delimiter: table.delimiter };
}

function sameStateSnapshot(left, right) {
  if (!left || !right || text(left.stateId) !== text(right.stateId)) return false;
  return ['pressureMpa', 'materialTemperatureC', 'structuralTemperatureC'].every((field) => left[field] === right[field]);
}

function externalCustodyStatus(project, importedCycles, importedStates, row) {
  const cycle = importedCycles.get(text(row?.cycleId));
  if (!cycle) return { retained: false, reason: 'CYCLE_REMOVED' };
  if (text(row?.fromStateId) !== cycle.fromStateId || text(row?.toStateId) !== cycle.toStateId) {
    return { retained: false, reason: 'STATE_PAIR_CHANGED' };
  }
  const existingStates = new Map((project?.transient?.states ?? []).map((state) => [text(state?.stateId), state]));
  const fromSame = sameStateSnapshot(existingStates.get(cycle.fromStateId), importedStates.get(cycle.fromStateId));
  const toSame = sameStateSnapshot(existingStates.get(cycle.toStateId), importedStates.get(cycle.toStateId));
  if (!fromSame || !toSame) return { retained: false, reason: 'STATE_VALUE_CHANGED' };
  return { retained: true, reason: null };
}

function custodyPlan(project, states, transitions) {
  const importedCycles = new Map(transitions.map((row) => [row.cycleId, row]));
  const importedStates = new Map(states.map((row) => [row.stateId, row]));
  const packages = [];
  const removedExternalRows = [];
  let retainedExternalRows = 0;
  for (const pkg of project?.fatigueEvidence ?? []) {
    const retainedCycleIds = [];
    const removedCycleIds = [];
    for (const row of pkg?.externalResults ?? []) {
      const status = externalCustodyStatus(project, importedCycles, importedStates, row);
      if (status.retained) {
        retainedCycleIds.push(text(row?.cycleId));
        retainedExternalRows += 1;
      } else {
        removedCycleIds.push(text(row?.cycleId));
        removedExternalRows.push(Object.freeze({ productId: text(pkg?.productId), cycleId: text(row?.cycleId), reason: status.reason }));
      }
    }
    const retained = new Set(retainedCycleIds);
    const missingCycleIds = transitions.map((row) => row.cycleId).filter((cycleId) => !retained.has(cycleId));
    packages.push(Object.freeze({
      productId: text(pkg?.productId),
      retainedCycleIds: Object.freeze(retainedCycleIds),
      removedCycleIds: Object.freeze(removedCycleIds),
      missingCycleIds: Object.freeze(missingCycleIds),
      packageRemovedIfApplied: retainedCycleIds.length === 0 && (pkg?.externalResults ?? []).length > 0,
    }));
  }
  return Object.freeze({ packages: Object.freeze(packages), retainedExternalRows, removedExternalRows: Object.freeze(removedExternalRows) });
}

export function previewHpPipingClassTransientBulkInput(project, { statesText = '', cyclesText = '' } = {}) {
  const issues = [];
  const spectrumId = text(project?.transient?.spectrum?.spectrumId);
  if (!spectrumId) issues.push(issue('TRANSIENT_BULK_SPECTRUM_ID_REQUIRED', 'Set the class Spectrum ID before validating bulk states/cycles.'));
  const normalizedStates = normalizeStates(project, statesText, spectrumId, issues);
  const normalizedCycles = normalizeCycles(project, cyclesText, spectrumId, normalizedStates.states, issues);
  const plan = custodyPlan(project, normalizedStates.states, normalizedCycles.transitions);
  return {
    ok: issues.length === 0,
    spectrumId,
    statesDelimiter: normalizedStates.delimiter,
    cyclesDelimiter: normalizedCycles.delimiter,
    states: normalizedStates.states,
    transitions: normalizedCycles.transitions,
    issues,
    plan,
    summary: Object.freeze({
      parsedStates: normalizedStates.states.length,
      parsedCycles: normalizedCycles.transitions.length,
      totalDeclaredCycles: normalizedCycles.transitions.reduce((sum, row) => sum + (Number.isFinite(row.totalCycles) ? row.totalCycles : 0), 0),
      retainedExternalRows: plan.retainedExternalRows,
      removedExternalRows: plan.removedExternalRows.length,
      fatiguePackages: plan.packages.length,
      fatiguePackagesNeedingCycleRows: plan.packages.filter((row) => row.missingCycleIds.length > 0).length,
    }),
  };
}

export function applyHpPipingClassTransientBulkInput(project, input = {}) {
  const preview = previewHpPipingClassTransientBulkInput(project, input);
  if (!preview.ok) return { ...preview, applied: false, project: null };

  const next = clone(project) ?? {};
  next.metadata ??= {};
  delete next.metadata.referenceSampleId;
  delete next.metadata.referenceSource;
  next.transient ??= {};
  next.transient.states = preview.states.map((row) => ({ ...row }));
  next.transient.transitions = preview.transitions.map((row) => {
    const { previewPressureRangeMpa, ...transition } = row;
    return transition;
  });

  const importedCycles = new Map(next.transient.transitions.map((row) => [row.cycleId, row]));
  const importedStates = new Map(next.transient.states.map((row) => [row.stateId, row]));
  const retainedPackages = [];
  const removedFatigueProductIds = [];
  const removedExternalRows = [];
  for (const pkg of Array.isArray(next.fatigueEvidence) ? next.fatigueEvidence : []) {
    const kept = [];
    for (const row of pkg?.externalResults ?? []) {
      const status = externalCustodyStatus(project, importedCycles, importedStates, row);
      if (status.retained) kept.push(row);
      else removedExternalRows.push(Object.freeze({ productId: text(pkg?.productId), cycleId: text(row?.cycleId), reason: status.reason }));
    }
    if (kept.length > 0 || (pkg?.externalResults ?? []).length === 0) {
      pkg.externalResults = kept;
      retainedPackages.push(pkg);
    } else removedFatigueProductIds.push(text(pkg?.productId));
  }
  next.fatigueEvidence = retainedPackages;

  return {
    ...preview,
    applied: true,
    project: next,
    plan: Object.freeze({
      ...preview.plan,
      removedExternalRows: Object.freeze(removedExternalRows),
      removedFatigueProductIds: Object.freeze(removedFatigueProductIds),
      retainedFatigueProductIds: Object.freeze(retainedPackages.map((pkg) => text(pkg?.productId)).filter(Boolean)),
    }),
  };
}
