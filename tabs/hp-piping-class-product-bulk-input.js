export const HP_PIPING_CLASS_PRODUCT_BULK_HEADERS = Object.freeze([
  'product_id',
  'nominal_size',
  'od_mm',
  'allowable_stress_mpa',
  'nominal_wall_mm',
  'minus_tolerance_pct',
  'internal_allowance_mm',
  'external_allowance_mm',
  'fatigue_wall_basis',
  'measured_current_wall_mm',
  'future_internal_loss_mm',
  'future_external_loss_mm',
]);

export const HP_PIPING_CLASS_PRODUCT_BULK_MAX_ROWS = 500;

const WALL_BASES = new Set(['END_OF_LIFE_EFFECTIVE', 'PROJECTED_END_OF_LIFE']);

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

function parseNumber(raw, { allowBlank = false, minimum = null, exclusiveMinimum = null, maximumExclusive = null } = {}) {
  const value = text(raw);
  if (!value) return allowBlank ? { ok: true, value: null } : { ok: false, value: null };
  const number = Number(value);
  if (!Number.isFinite(number)) return { ok: false, value: null };
  if (minimum !== null && number < minimum) return { ok: false, value: null };
  if (exclusiveMinimum !== null && number <= exclusiveMinimum) return { ok: false, value: null };
  if (maximumExclusive !== null && number >= maximumExclusive) return { ok: false, value: null };
  return { ok: true, value: number };
}

function sameNumber(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-12;
}

function existingGovernedProducts(project) {
  return (project?.products ?? []).filter((product) => product?.calculationBasis?.mode === 'GOVERNED_BASIS_PACKAGE');
}

function normalizeRows(lines, delimiter, project, issues) {
  const seen = new Map();
  const rows = [];
  const governedByIdentity = new Map(existingGovernedProducts(project).map((product) => [text(product.productId).toUpperCase(), product]));
  const directByIdentity = new Map(
    (project?.products ?? [])
      .filter((product) => product?.calculationBasis?.mode === 'DIRECT_ENGINEERING_INPUT')
      .map((product) => [text(product.productId).toUpperCase(), text(product.productId)]),
  );

  lines.forEach((line, offset) => {
    const rowNumber = offset + 2;
    const parsed = parseRecord(line, delimiter);
    if (!parsed.ok || parsed.cells.length !== HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.length) {
      issues.push(issue('PRODUCT_BULK_ROW_SHAPE_INVALID', `Row ${rowNumber} must contain exactly ${HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.length} columns.`, { rowNumber }));
      return;
    }

    const [
      productRaw, nominalSizeRaw, odRaw, stressRaw, wallRaw, toleranceRaw,
      internalAllowanceRaw, externalAllowanceRaw, wallBasisRaw,
      measuredRaw, futureInternalRaw, futureExternalRaw,
    ] = parsed.cells;

    const productId = text(productRaw);
    const nominalSize = text(nominalSizeRaw);
    const identityKey = productId.toUpperCase();
    if (!productId) issues.push(issue('PRODUCT_BULK_PRODUCT_ID_REQUIRED', `Row ${rowNumber} requires product_id.`, { rowNumber }));
    else if (seen.has(identityKey)) issues.push(issue('PRODUCT_BULK_PRODUCT_ID_DUPLICATE', `product_id ${productId} duplicates row ${seen.get(identityKey)} (case-insensitive identity).`, { productId, rowNumber }));
    else seen.set(identityKey, rowNumber);
    if (!nominalSize) issues.push(issue('PRODUCT_BULK_NOMINAL_SIZE_REQUIRED', `Row ${rowNumber} requires nominal_size (for example NPS 4).`, { productId, rowNumber }));
    if (governedByIdentity.has(identityKey)) {
      issues.push(issue('PRODUCT_BULK_GOVERNED_PRODUCT_WRITE_BLOCKED', `Row ${rowNumber} targets governed product ${governedByIdentity.get(identityKey)?.productId ?? productId}; bulk CSV may manage direct-input products only.`, { productId, rowNumber }));
    }
    const existingDirectId = directByIdentity.get(identityKey);
    if (existingDirectId && existingDirectId !== productId) {
      issues.push(issue('PRODUCT_BULK_PRODUCT_ID_CASE_RENAME_BLOCKED', `Row ${rowNumber} changes existing direct product identity ${existingDirectId} only by letter case. Use the exact existing product_id to preserve fatigue/result custody.`, { productId, existingProductId: existingDirectId, rowNumber }));
    }

    const od = parseNumber(odRaw, { exclusiveMinimum: 0 });
    const stress = parseNumber(stressRaw, { exclusiveMinimum: 0 });
    const wall = parseNumber(wallRaw, { exclusiveMinimum: 0 });
    const tolerance = parseNumber(toleranceRaw, { minimum: 0, maximumExclusive: 100 });
    const internalAllowance = parseNumber(internalAllowanceRaw, { minimum: 0 });
    const externalAllowance = parseNumber(externalAllowanceRaw, { minimum: 0 });
    const measured = parseNumber(measuredRaw, { allowBlank: true, exclusiveMinimum: 0 });
    const futureInternal = parseNumber(futureInternalRaw, { allowBlank: true, minimum: 0 });
    const futureExternal = parseNumber(futureExternalRaw, { allowBlank: true, minimum: 0 });

    if (!od.ok) issues.push(issue('PRODUCT_BULK_OD_INVALID', `Row ${rowNumber} od_mm must be finite and > 0.`, { productId, rowNumber }));
    if (!stress.ok) issues.push(issue('PRODUCT_BULK_ALLOWABLE_STRESS_INVALID', `Row ${rowNumber} allowable_stress_mpa must be finite and > 0.`, { productId, rowNumber }));
    if (!wall.ok) issues.push(issue('PRODUCT_BULK_NOMINAL_WALL_INVALID', `Row ${rowNumber} nominal_wall_mm must be finite and > 0.`, { productId, rowNumber }));
    if (!tolerance.ok) issues.push(issue('PRODUCT_BULK_TOLERANCE_INVALID', `Row ${rowNumber} minus_tolerance_pct must be finite, >= 0 and < 100.`, { productId, rowNumber }));
    if (!internalAllowance.ok) issues.push(issue('PRODUCT_BULK_INTERNAL_ALLOWANCE_INVALID', `Row ${rowNumber} internal_allowance_mm must be finite and >= 0.`, { productId, rowNumber }));
    if (!externalAllowance.ok) issues.push(issue('PRODUCT_BULK_EXTERNAL_ALLOWANCE_INVALID', `Row ${rowNumber} external_allowance_mm must be finite and >= 0.`, { productId, rowNumber }));
    if (!measured.ok) issues.push(issue('PRODUCT_BULK_MEASURED_WALL_INVALID', `Row ${rowNumber} measured_current_wall_mm must be blank or finite and > 0.`, { productId, rowNumber }));
    if (!futureInternal.ok) issues.push(issue('PRODUCT_BULK_FUTURE_INTERNAL_LOSS_INVALID', `Row ${rowNumber} future_internal_loss_mm must be blank or finite and >= 0.`, { productId, rowNumber }));
    if (!futureExternal.ok) issues.push(issue('PRODUCT_BULK_FUTURE_EXTERNAL_LOSS_INVALID', `Row ${rowNumber} future_external_loss_mm must be blank or finite and >= 0.`, { productId, rowNumber }));

    const fatigueWallBasis = text(wallBasisRaw);
    if (!WALL_BASES.has(fatigueWallBasis)) {
      issues.push(issue('PRODUCT_BULK_WALL_BASIS_INVALID', `Row ${rowNumber} fatigue_wall_basis must be END_OF_LIFE_EFFECTIVE or PROJECTED_END_OF_LIFE.`, { productId, rowNumber }));
    }

    const hasMeasured = measured.value !== null;
    const hasAnyFuture = futureInternal.value !== null || futureExternal.value !== null;
    if (!hasMeasured && hasAnyFuture) {
      issues.push(issue('PRODUCT_BULK_BROWNFIELD_WALL_INCOMPLETE', `Row ${rowNumber} future wall loss requires measured_current_wall_mm.`, { productId, rowNumber }));
    }
    if (hasMeasured && (futureInternal.value === null || futureExternal.value === null)) {
      issues.push(issue('PRODUCT_BULK_BROWNFIELD_LOSS_REQUIRED', `Row ${rowNumber} measured wall requires both future loss columns explicitly, including 0 when applicable.`, { productId, rowNumber }));
    }
    if (fatigueWallBasis === 'PROJECTED_END_OF_LIFE' && !hasMeasured) {
      issues.push(issue('PRODUCT_BULK_PROJECTED_WALL_REQUIRES_MEASUREMENT', `Row ${rowNumber} PROJECTED_END_OF_LIFE requires measured wall and explicit future losses.`, { productId, rowNumber }));
    }

    let minimumAsManufacturedWallMm = null;
    let effectiveNetWallMm = null;
    let projectedEndOfLifeWallMm = null;
    if (wall.ok && tolerance.ok) {
      minimumAsManufacturedWallMm = wall.value * (1 - tolerance.value / 100);
      if (od.ok && wall.value >= od.value / 2) {
        issues.push(issue('PRODUCT_BULK_WALL_GE_RADIUS', `Row ${rowNumber} nominal wall ${wall.value} mm must be less than OD/2 (${od.value / 2} mm).`, { productId, rowNumber }));
      }
      if (internalAllowance.ok && externalAllowance.ok) {
        effectiveNetWallMm = minimumAsManufacturedWallMm - internalAllowance.value - externalAllowance.value;
        if (!(effectiveNetWallMm > 0)) {
          issues.push(issue('PRODUCT_BULK_EFFECTIVE_WALL_NONPOSITIVE', `Row ${rowNumber} gives effective net wall ${effectiveNetWallMm} mm after tolerance and allowances; it must be > 0.`, { productId, rowNumber, minimumAsManufacturedWallMm, effectiveNetWallMm }));
        }
      }
    }
    if (hasMeasured && futureInternal.value !== null && futureExternal.value !== null) {
      projectedEndOfLifeWallMm = measured.value - futureInternal.value - futureExternal.value;
      if (!(projectedEndOfLifeWallMm > 0)) {
        issues.push(issue('PRODUCT_BULK_PROJECTED_WALL_NONPOSITIVE', `Row ${rowNumber} gives projected end-of-life wall ${projectedEndOfLifeWallMm} mm; it must be > 0.`, { productId, rowNumber, projectedEndOfLifeWallMm }));
      }
    }

    rows.push(Object.freeze({
      productId,
      nominalSize,
      outsideDiameterMm: od.value,
      allowableStressMpa: stress.value,
      nominalWallMm: wall.value,
      minusTolerancePct: tolerance.value,
      internalAllowanceMm: internalAllowance.value,
      externalAllowanceMm: externalAllowance.value,
      fatigueWallBasis,
      measuredCurrentWallMm: measured.value,
      futureInternalLossMm: futureInternal.value,
      futureExternalLossMm: futureExternal.value,
      minimumAsManufacturedWallMm,
      effectiveNetWallMm,
      projectedEndOfLifeWallMm,
    }));
  });

  return rows;
}

function classAllowanceConsistency(rows, issues) {
  if (!rows.length) return null;
  const first = rows[0];
  for (const row of rows.slice(1)) {
    if (!sameNumber(row.internalAllowanceMm, first.internalAllowanceMm) || !sameNumber(row.externalAllowanceMm, first.externalAllowanceMm)) {
      issues.push(issue(
        'PRODUCT_BULK_CLASS_ALLOWANCE_CONFLICT',
        `Class allowances must be identical on every row. ${first.productId} uses ${first.internalAllowanceMm}/${first.externalAllowanceMm} mm internal/external while ${row.productId} uses ${row.internalAllowanceMm}/${row.externalAllowanceMm} mm.`,
        { firstProductId: first.productId, conflictingProductId: row.productId },
      ));
    }
  }
  return Object.freeze({
    internalAllowanceMm: first.internalAllowanceMm,
    externalAllowanceMm: first.externalAllowanceMm,
  });
}

export function previewHpPipingClassProductBulkInput(project, sourceText) {
  const issues = [];
  const normalizedText = String(sourceText ?? '').replace(/^\uFEFF/, '').trim();
  if (!normalizedText) {
    issues.push(issue('PRODUCT_BULK_TEXT_REQUIRED', 'Paste or load a product matrix before validation.'));
    return { ok: false, delimiter: null, rows: [], issues, summary: { parsedRows: 0, governedProductsPreserved: existingGovernedProducts(project).length } };
  }

  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) issues.push(issue('PRODUCT_BULK_ROWS_REQUIRED', 'Product matrix must contain a header and at least one product row.'));
  if (lines.length - 1 > HP_PIPING_CLASS_PRODUCT_BULK_MAX_ROWS) {
    issues.push(issue('PRODUCT_BULK_ROW_LIMIT', `Product matrix contains ${lines.length - 1} rows; maximum is ${HP_PIPING_CLASS_PRODUCT_BULK_MAX_ROWS}.`));
  }
  const delimiter = lines[0]?.includes('\t') ? '\t' : ',';
  const header = parseRecord(lines[0] ?? '', delimiter);
  if (!header.ok || header.cells.join('|') !== HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.join('|')) {
    issues.push(issue('PRODUCT_BULK_HEADER_MISMATCH', `Header must be exactly: ${HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.join(',')}.`));
  }
  const rows = header.ok ? normalizeRows(lines.slice(1, HP_PIPING_CLASS_PRODUCT_BULK_MAX_ROWS + 1), delimiter, project, issues) : [];
  const classBasisPatch = classAllowanceConsistency(rows, issues);
  const importedIds = new Set(rows.map((row) => row.productId));
  const existingDirect = (project?.products ?? []).filter((product) => product?.calculationBasis?.mode === 'DIRECT_ENGINEERING_INPUT');
  const removedDirectProductIds = existingDirect.map((product) => text(product.productId)).filter((id) => id && !importedIds.has(id));
  const retainedDirectProductIds = existingDirect.map((product) => text(product.productId)).filter((id) => id && importedIds.has(id));
  const governedProductIds = existingGovernedProducts(project).map((product) => text(product.productId)).filter(Boolean);

  return {
    ok: issues.length === 0,
    delimiter: delimiter === '\t' ? 'TSV' : 'CSV',
    rows,
    issues,
    classBasisPatch,
    plan: Object.freeze({
      importedDirectProductIds: Object.freeze(rows.map((row) => row.productId)),
      retainedDirectProductIds: Object.freeze(retainedDirectProductIds),
      removedDirectProductIds: Object.freeze(removedDirectProductIds),
      preservedGovernedProductIds: Object.freeze(governedProductIds),
    }),
    summary: Object.freeze({
      parsedRows: rows.length,
      retainedDirectProducts: retainedDirectProductIds.length,
      removedDirectProducts: removedDirectProductIds.length,
      governedProductsPreserved: governedProductIds.length,
    }),
  };
}

function productFromRow(row, existing = null) {
  const next = clone(existing) ?? {};
  next.productId = row.productId;
  next.nominalSize = row.nominalSize;
  next.calculationBasis = {
    ...(clone(existing?.calculationBasis) ?? {}),
    mode: 'DIRECT_ENGINEERING_INPUT',
    outsideDiameterMm: row.outsideDiameterMm,
    allowableStressMpa: row.allowableStressMpa,
    nominalWallMm: row.nominalWallMm,
    minusTolerancePct: row.minusTolerancePct,
  };
  next.wallState = {
    ...(clone(existing?.wallState) ?? {}),
    fatigueWallBasis: row.fatigueWallBasis,
  };
  for (const field of ['measuredCurrentWallMm', 'futureInternalLossMm', 'futureExternalLossMm']) {
    const value = row[field];
    if (value === null) delete next.wallState[field];
    else next.wallState[field] = value;
  }
  return next;
}

export function applyHpPipingClassProductBulkInput(project, sourceText) {
  const preview = previewHpPipingClassProductBulkInput(project, sourceText);
  if (!preview.ok) return { ...preview, applied: false, project: null };

  const next = clone(project) ?? {};
  next.metadata ??= {};
  delete next.metadata.referenceSampleId;
  delete next.metadata.referenceSource;
  next.classBasis ??= {};
  next.classBasis.internalAllowanceMm = preview.classBasisPatch.internalAllowanceMm;
  next.classBasis.externalAllowanceMm = preview.classBasisPatch.externalAllowanceMm;

  const existingProducts = Array.isArray(next.products) ? next.products : [];
  const existingDirect = new Map(
    existingProducts
      .filter((product) => product?.calculationBasis?.mode === 'DIRECT_ENGINEERING_INPUT')
      .map((product) => [text(product.productId), product]),
  );
  const importedProducts = preview.rows.map((row) => productFromRow(row, existingDirect.get(row.productId)));

  const rebuilt = [];
  let insertedDirectMatrix = false;
  for (const existing of existingProducts) {
    if (existing?.calculationBasis?.mode === 'GOVERNED_BASIS_PACKAGE') {
      rebuilt.push(existing);
      continue;
    }
    if (!insertedDirectMatrix) {
      rebuilt.push(...importedProducts);
      insertedDirectMatrix = true;
    }
  }
  if (!insertedDirectMatrix) rebuilt.push(...importedProducts);
  next.products = rebuilt;

  const finalIds = new Set(next.products.map((product) => text(product.productId)).filter(Boolean));
  const evidenceBefore = Array.isArray(next.fatigueEvidence) ? next.fatigueEvidence : [];
  const removedFatigueProductIds = evidenceBefore
    .map((pkg) => text(pkg?.productId))
    .filter((id) => id && !finalIds.has(id));
  next.fatigueEvidence = evidenceBefore.filter((pkg) => finalIds.has(text(pkg?.productId)));

  return {
    ...preview,
    applied: true,
    project: next,
    plan: Object.freeze({
      ...preview.plan,
      removedFatigueProductIds: Object.freeze(removedFatigueProductIds),
      retainedFatigueProductIds: Object.freeze(next.fatigueEvidence.map((pkg) => text(pkg?.productId)).filter(Boolean)),
    }),
  };
}
