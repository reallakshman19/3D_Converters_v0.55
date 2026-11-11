export const HP_PIPING_CLASS_KD_BULK_HEADERS = Object.freeze([
  'cycle_id',
  'location_id',
  'user_salt_mpa',
  'seq_mpa',
  'permissible_cycles',
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? '').trim();
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

function parseNumber(raw, { allowBlank = false, minimum = null, exclusiveMinimum = null } = {}) {
  const value = text(raw);
  if (!value && allowBlank) return { ok: true, value: null };
  const number = Number(value);
  if (!Number.isFinite(number)) return { ok: false, value: null };
  if (minimum !== null && number < minimum) return { ok: false, value: null };
  if (exclusiveMinimum !== null && number <= exclusiveMinimum) return { ok: false, value: null };
  return { ok: true, value: number };
}

function governedTransitions(project, issues) {
  const transitions = project?.transient?.transitions;
  if (!Array.isArray(transitions) || !transitions.length) {
    issues.push(issue('KD_BULK_GOVERNED_CYCLES_REQUIRED', 'At least one governed pressure cycle is required.'));
    return [];
  }
  const seen = new Set();
  for (const transition of transitions) {
    const cycleId = text(transition?.cycleId);
    if (!cycleId) {
      issues.push(issue('KD_BULK_GOVERNED_CYCLE_ID_REQUIRED', 'Every governed pressure cycle requires cycleId.'));
      continue;
    }
    if (seen.has(cycleId)) {
      issues.push(issue('KD_BULK_GOVERNED_CYCLE_DUPLICATE', `Governed cycle ${cycleId} is duplicated.`, { cycleId }));
    }
    seen.add(cycleId);
  }
  return transitions;
}

function normalizeRows(lines, delimiter, transitions, issues) {
  const governedIds = new Set(transitions.map((row) => text(row?.cycleId)).filter(Boolean));
  const parsedByCycle = new Map();
  lines.forEach((line, offset) => {
    const parsed = parseRecord(line, delimiter);
    const rowNumber = offset + 2;
    if (!parsed.ok || parsed.cells.length !== HP_PIPING_CLASS_KD_BULK_HEADERS.length) {
      issues.push(issue('KD_BULK_ROW_SHAPE_INVALID', `Row ${rowNumber} must contain exactly five columns.`, { rowNumber }));
      return;
    }
    const [cycleRaw, locationRaw, saltRaw, seqRaw, nRaw] = parsed.cells;
    const cycleId = text(cycleRaw);
    const locationId = text(locationRaw);
    if (!cycleId) issues.push(issue('KD_BULK_CYCLE_ID_REQUIRED', `Row ${rowNumber} requires cycle_id.`, { rowNumber }));
    else if (parsedByCycle.has(cycleId)) issues.push(issue('KD_BULK_CYCLE_DUPLICATE', `cycle_id ${cycleId} is duplicated in the bulk table.`, { cycleId, rowNumber }));
    else if (!governedIds.has(cycleId)) issues.push(issue('KD_BULK_CYCLE_UNKNOWN', `cycle_id ${cycleId} is not a governed pressure cycle.`, { cycleId, rowNumber }));
    if (!locationId) issues.push(issue('KD_BULK_LOCATION_REQUIRED', `Row ${rowNumber} requires location_id.`, { cycleId, rowNumber }));

    const salt = parseNumber(saltRaw, { allowBlank: true, minimum: 0 });
    const seq = parseNumber(seqRaw, { minimum: 0 });
    const permissible = parseNumber(nRaw, { allowBlank: true, exclusiveMinimum: 0 });
    if (!salt.ok) issues.push(issue('KD_BULK_USER_SALT_INVALID', `Row ${rowNumber} user_salt_mpa must be blank or finite and >= 0.`, { cycleId, rowNumber }));
    if (!seq.ok) issues.push(issue('KD_BULK_SEQ_INVALID', `Row ${rowNumber} seq_mpa must be finite and >= 0.`, { cycleId, rowNumber }));
    if (!permissible.ok || (seq.ok && seq.value > 0 && permissible.value === null)) {
      issues.push(issue('KD_BULK_N_INVALID', `Row ${rowNumber} permissible_cycles must be > 0 when Seq is nonzero.`, { cycleId, rowNumber }));
    }
    if (cycleId && !parsedByCycle.has(cycleId)) {
      parsedByCycle.set(cycleId, {
        cycleId,
        locationId,
        userAlternatingStressIntensityMpa: salt.ok ? salt.value : null,
        equivalentAlternatingStressMpa: seq.ok ? seq.value : null,
        permissibleCycles: permissible.ok ? permissible.value : null,
      });
    }
  });

  const missing = [...governedIds].filter((cycleId) => !parsedByCycle.has(cycleId));
  if (missing.length) {
    issues.push(issue('KD_BULK_CYCLE_MISSING', `Bulk table is missing ${missing.length} governed cycle(s): ${missing.join(', ')}.`, { missing }));
  }
  return transitions.map((transition) => parsedByCycle.get(text(transition.cycleId))).filter(Boolean);
}

export function previewHpPipingClassKdBulkInput(project, evidenceIndex, sourceText) {
  const issues = [];
  const pkg = project?.fatigueEvidence?.[evidenceIndex];
  if (!pkg) issues.push(issue('KD_BULK_PACKAGE_NOT_FOUND', 'The selected KD review product was not found.'));
  const transitions = governedTransitions(project, issues);
  const normalizedText = String(sourceText ?? '').replace(/^\uFEFF/, '').trim();
  if (!normalizedText) issues.push(issue('KD_BULK_TEXT_REQUIRED', 'Paste or load a Seq/N table before validation.'));
  if (!pkg || !transitions.length || !normalizedText) {
    return { ok: false, delimiter: null, rows: [], issues, summary: { governedCycles: transitions.length, parsedRows: 0 } };
  }

  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim());
  const delimiter = lines[0]?.includes('\t') ? '\t' : ',';
  const header = parseRecord(lines[0] ?? '', delimiter);
  if (!header.ok || header.cells.join('|') !== HP_PIPING_CLASS_KD_BULK_HEADERS.join('|')) {
    issues.push(issue('KD_BULK_HEADER_MISMATCH', `Header must be exactly: ${HP_PIPING_CLASS_KD_BULK_HEADERS.join(',')}.`));
  }
  const rows = header.ok ? normalizeRows(lines.slice(1), delimiter, transitions, issues) : [];
  return {
    ok: issues.length === 0,
    delimiter: delimiter === '\t' ? 'TSV' : 'CSV',
    rows,
    issues,
    summary: { governedCycles: transitions.length, parsedRows: rows.length },
  };
}

export function applyHpPipingClassKdBulkInput(project, evidenceIndex, sourceText) {
  const preview = previewHpPipingClassKdBulkInput(project, evidenceIndex, sourceText);
  if (!preview.ok) return { ...preview, applied: false };
  const pkg = project.fatigueEvidence[evidenceIndex];
  const existing = new Map((pkg.externalResults ?? []).map((row) => [text(row?.cycleId), row]));
  const transitions = project.transient.transitions;
  const values = new Map(preview.rows.map((row) => [row.cycleId, row]));
  pkg.externalResults = transitions.map((transition) => {
    const cycleId = text(transition.cycleId);
    const bulk = values.get(cycleId);
    const next = clone(existing.get(cycleId)) ?? { calculationBasis: {} };
    next.cycleId = cycleId;
    next.fromStateId = text(transition.fromStateId);
    next.toStateId = text(transition.toStateId);
    next.locationId = bulk.locationId;
    next.equivalentAlternatingStressMpa = bulk.equivalentAlternatingStressMpa;
    if (bulk.userAlternatingStressIntensityMpa === null) delete next.userAlternatingStressIntensityMpa;
    else next.userAlternatingStressIntensityMpa = bulk.userAlternatingStressIntensityMpa;
    if (bulk.permissibleCycles === null) delete next.permissibleCycles;
    else next.permissibleCycles = bulk.permissibleCycles;
    return next;
  });
  return { ...preview, applied: true };
}
