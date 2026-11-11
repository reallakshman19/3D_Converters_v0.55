import {
  HP_PIPING_CLASS_PRODUCT_BULK_HEADERS,
} from './hp-piping-class-product-bulk-input.js';
import {
  HP_PIPING_CLASS_STATE_BULK_HEADERS,
  HP_PIPING_CLASS_CYCLE_BULK_HEADERS,
} from './hp-piping-class-transient-bulk-input.js';
import { HP_PIPING_CLASS_KD_BULK_HEADERS } from './hp-piping-class-kd-bulk-input.js';
import { HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION } from './hp-piping-class-intake-package.js';
import { previewHpPipingClassIntakePackageForReview } from './hp-piping-class-intake-package-review.js';

function text(value) { return String(value ?? '').trim(); }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function blankable(value) { return value === undefined || value === null ? '' : value; }
function issue(code, message, details = {}) { return Object.freeze({ code, message, details }); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function onlyKeys(value, allowed, path, issues, ignored = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const allowedSet = new Set([...allowed, ...ignored]);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) issues.push(issue(
      'INTAKE_PACKAGE_EXPORT_FIELD_UNSUPPORTED',
      `${path}.${key} is not representable by ${HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION}; export stopped to prevent silent loss.`,
      { path: `${path}.${key}` },
    ));
  }
}

function validateRepresentability(project, issues) {
  onlyKeys(project?.metadata, ['projectId', 'classId', 'revision'], 'metadata', issues, ['referenceSampleId', 'referenceSource']);
  onlyKeys(project?.methodManifest, ['b313Edition', 'viii3Edition'], 'methodManifest', issues,
    ['calculationMode', 'nativeCoreKd3Qualified', 'codeCompliance', 'canUseForDesignAuthority']);
  onlyKeys(project?.classBasis, ['designPressureMpa', 'internalAllowanceMm', 'externalAllowanceMm'], 'classBasis', issues);
  onlyKeys(project?.transient?.spectrum, ['spectrumId', 'designLifeYears', 'preparedBy', 'checkedBy', 'approvedBy', 'status'], 'transient.spectrum', issues);

  for (const [index, product] of (project?.products ?? []).entries()) {
    onlyKeys(product, ['productId', 'nominalSize', 'calculationBasis', 'wallState'], `products[${index}]`, issues);
    if (product?.calculationBasis?.mode !== 'DIRECT_ENGINEERING_INPUT') {
      issues.push(issue(
        'INTAKE_PACKAGE_EXPORT_GOVERNED_PRODUCT_UNSUPPORTED',
        `Product ${text(product?.productId) || index} uses ${product?.calculationBasis?.mode || 'unknown'}; v1 editable package export supports DIRECT_ENGINEERING_INPUT only.`,
        { productId: text(product?.productId), mode: product?.calculationBasis?.mode ?? null },
      ));
    }
    onlyKeys(product?.calculationBasis,
      ['mode', 'outsideDiameterMm', 'allowableStressMpa', 'nominalWallMm', 'minusTolerancePct'],
      `products[${index}].calculationBasis`, issues);
    onlyKeys(product?.wallState,
      ['fatigueWallBasis', 'measuredCurrentWallMm', 'futureInternalLossMm', 'futureExternalLossMm'],
      `products[${index}].wallState`, issues);
  }

  for (const [index, state] of (project?.transient?.states ?? []).entries()) {
    onlyKeys(state, ['spectrumId', 'stateId', 'pressureMpa', 'materialTemperatureC', 'structuralTemperatureC'], `transient.states[${index}]`, issues);
  }
  for (const [index, cycle] of (project?.transient?.transitions ?? []).entries()) {
    onlyKeys(cycle, ['spectrumId', 'cycleId', 'fromStateId', 'toStateId', 'totalCycles', 'cyclesPerYear', 'category', 'provenanceId'], `transient.transitions[${index}]`, issues);
  }

  const governedByCycle = new Map((project?.transient?.transitions ?? []).map((row) => [text(row?.cycleId), row]).filter(([id]) => id));
  for (const [pkgIndex, pkg] of (project?.fatigueEvidence ?? []).entries()) {
    onlyKeys(pkg, ['productId', 'externalResults'], `fatigueEvidence[${pkgIndex}]`, issues);
    const rows = pkg?.externalResults ?? [];
    if (!Array.isArray(rows) || !rows.length) {
      issues.push(issue(
        'INTAKE_PACKAGE_EXPORT_EMPTY_KD_PACKAGE_UNSUPPORTED',
        `Fatigue package ${text(pkg?.productId) || pkgIndex} has no external result rows; v1 cannot round-trip an empty KD shell.`,
        { productId: text(pkg?.productId) },
      ));
      continue;
    }
    for (const [rowIndex, row] of rows.entries()) {
      onlyKeys(row,
        ['cycleId', 'locationId', 'fromStateId', 'toStateId', 'userAlternatingStressIntensityMpa', 'equivalentAlternatingStressMpa', 'permissibleCycles', 'calculationBasis'],
        `fatigueEvidence[${pkgIndex}].externalResults[${rowIndex}]`, issues);
      const governed = governedByCycle.get(text(row?.cycleId));
      if (!governed || text(row?.fromStateId) !== text(governed?.fromStateId) || text(row?.toStateId) !== text(governed?.toStateId)) {
        issues.push(issue(
          'INTAKE_PACKAGE_EXPORT_KD_STATE_BINDING_MISMATCH',
          `${text(pkg?.productId)}:${text(row?.cycleId)} external result state-pair custody does not reproduce the governed transition; export stopped rather than silently rebinding evidence.`,
          {
            productId: text(pkg?.productId), cycleId: text(row?.cycleId),
            externalFromStateId: text(row?.fromStateId), externalToStateId: text(row?.toStateId),
            governedFromStateId: text(governed?.fromStateId), governedToStateId: text(governed?.toStateId),
          },
        ));
      }
      if (row?.calculationBasis && Object.keys(row.calculationBasis).length) {
        issues.push(issue(
          'INTAKE_PACKAGE_EXPORT_KD_BASIS_UNSUPPORTED',
          `${text(pkg?.productId)}:${text(row?.cycleId)} contains external calculationBasis custody not representable by v1; export stopped to prevent evidence loss.`,
          { productId: text(pkg?.productId), cycleId: text(row?.cycleId) },
        ));
      }
    }
  }
}

function buildPackageObject(project) {
  const classBasis = project.classBasis ?? {};
  const spectrum = project.transient?.spectrum ?? {};
  return {
    schemaVersion: HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION,
    metadata: {
      projectId: text(project.metadata?.projectId),
      classId: text(project.metadata?.classId),
      revision: text(project.metadata?.revision),
    },
    method: {
      b313Edition: text(project.methodManifest?.b313Edition),
      ...(text(project.methodManifest?.viii3Edition) ? { viii3Edition: text(project.methodManifest.viii3Edition) } : {}),
    },
    classBasis: { designPressureMpa: project.classBasis?.designPressureMpa },
    spectrum: {
      spectrumId: text(spectrum.spectrumId),
      ...(finite(spectrum.designLifeYears) ? { designLifeYears: spectrum.designLifeYears } : {}),
      ...(text(spectrum.preparedBy) ? { preparedBy: text(spectrum.preparedBy) } : {}),
      ...(text(spectrum.checkedBy) ? { checkedBy: text(spectrum.checkedBy) } : {}),
      ...(text(spectrum.approvedBy) ? { approvedBy: text(spectrum.approvedBy) } : {}),
      ...(text(spectrum.status) ? { status: text(spectrum.status) } : {}),
    },
    tables: {
      products: {
        headers: [...HP_PIPING_CLASS_PRODUCT_BULK_HEADERS],
        rows: (project.products ?? []).map((product) => [
          text(product.productId), text(product.nominalSize),
          product.calculationBasis?.outsideDiameterMm, product.calculationBasis?.allowableStressMpa,
          product.calculationBasis?.nominalWallMm, product.calculationBasis?.minusTolerancePct,
          classBasis.internalAllowanceMm, classBasis.externalAllowanceMm,
          text(product.wallState?.fatigueWallBasis), blankable(product.wallState?.measuredCurrentWallMm),
          blankable(product.wallState?.futureInternalLossMm), blankable(product.wallState?.futureExternalLossMm),
        ]),
      },
      states: {
        headers: [...HP_PIPING_CLASS_STATE_BULK_HEADERS],
        rows: (project.transient?.states ?? []).map((state) => [
          text(state.stateId), state.pressureMpa, state.materialTemperatureC, state.structuralTemperatureC,
        ]),
      },
      cycles: {
        headers: [...HP_PIPING_CLASS_CYCLE_BULK_HEADERS],
        rows: (project.transient?.transitions ?? []).map((cycle) => [
          text(cycle.cycleId), text(cycle.fromStateId), text(cycle.toStateId), cycle.totalCycles,
          blankable(cycle.cyclesPerYear), text(cycle.category), blankable(cycle.provenanceId),
        ]),
      },
      kd: (project.fatigueEvidence ?? []).map((pkg) => ({
        productId: text(pkg.productId),
        headers: [...HP_PIPING_CLASS_KD_BULK_HEADERS],
        rows: (pkg.externalResults ?? []).map((row) => [
          text(row.cycleId), text(row.locationId), blankable(row.userAlternatingStressIntensityMpa),
          row.equivalentAlternatingStressMpa, blankable(row.permissibleCycles),
        ]),
      })),
    },
  };
}

function surface(project) {
  return {
    metadata: [text(project?.metadata?.projectId), text(project?.metadata?.classId), text(project?.metadata?.revision)],
    method: [text(project?.methodManifest?.b313Edition), text(project?.methodManifest?.viii3Edition)],
    classBasis: [project?.classBasis?.designPressureMpa, project?.classBasis?.internalAllowanceMm, project?.classBasis?.externalAllowanceMm],
    spectrum: project?.transient?.spectrum ?? null,
    products: (project?.products ?? []).map((p) => [p.productId, p.nominalSize, p.calculationBasis?.outsideDiameterMm, p.calculationBasis?.allowableStressMpa, p.calculationBasis?.nominalWallMm, p.calculationBasis?.minusTolerancePct, p.wallState?.fatigueWallBasis, p.wallState?.measuredCurrentWallMm ?? null, p.wallState?.futureInternalLossMm ?? null, p.wallState?.futureExternalLossMm ?? null]),
    states: (project?.transient?.states ?? []).map((s) => [s.stateId, s.pressureMpa, s.materialTemperatureC, s.structuralTemperatureC]),
    cycles: (project?.transient?.transitions ?? []).map((c) => [c.cycleId, c.fromStateId, c.toStateId, c.totalCycles, c.cyclesPerYear ?? null, c.category ?? '', c.provenanceId ?? null]),
    kd: (project?.fatigueEvidence ?? []).map((pkg) => [pkg.productId, (pkg.externalResults ?? []).map((r) => [r.cycleId, r.fromStateId, r.toStateId, r.locationId, r.userAlternatingStressIntensityMpa ?? null, r.equivalentAlternatingStressMpa, r.permissibleCycles ?? null])]),
  };
}

export function buildHpPipingClassIntakePackageExport(project) {
  const issues = [];
  if (!project || typeof project !== 'object') return { ok: false, issues: [issue('INTAKE_PACKAGE_EXPORT_PROJECT_REQUIRED', 'A current HP Piping Class project is required.')], package: null };
  validateRepresentability(project, issues);
  if (issues.length) return { ok: false, issues, package: null };
  const pkg = buildPackageObject(project);
  const reimport = previewHpPipingClassIntakePackageForReview(pkg);
  if (!reimport.ok) {
    const detail = (reimport.issues ?? []).slice(0, 4).map((row) => `${row.code}: ${row.message}`).join(' | ');
    return {
      ok: false,
      issues: [issue('INTAKE_PACKAGE_EXPORT_REIMPORT_BLOCKED', `Generated v1 package did not pass the existing package/canonical preflight.${detail ? ` ${detail}` : ''}`, { issues: clone(reimport.issues ?? []) })],
      package: null,
      reimport,
    };
  }
  const roundTripOk = JSON.stringify(surface(project)) === JSON.stringify(surface(reimport.project));
  if (!roundTripOk) {
    return { ok: false, issues: [issue('INTAKE_PACKAGE_EXPORT_ROUNDTRIP_MISMATCH', 'Generated package re-import changed one or more package-owned engineering inputs or derived KD state-pair custody.')], package: null, reimport };
  }
  return {
    ok: true,
    issues: [],
    package: pkg,
    serialized: `${JSON.stringify(pkg, null, 2)}\n`,
    reimport,
    roundTrip: Object.freeze({ ok: true, schemaVersion: HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION }),
  };
}

function addFieldChanges(changes, domain, id, before, after, fields) {
  for (const [field, impact] of fields) {
    const left = before?.[field] ?? null;
    const right = after?.[field] ?? null;
    if (left !== right) changes.push(Object.freeze({ domain, id, field, before: left, after: right, impact }));
  }
}

function indexed(rows, field) { return new Map((rows ?? []).map((row) => [text(row?.[field]), row]).filter(([id]) => id)); }
function structuralChanges(changes, domain, beforeMap, afterMap) {
  for (const id of [...beforeMap.keys()].sort()) if (!afterMap.has(id)) changes.push(Object.freeze({ domain, id, field: '$row', before: 'PRESENT', after: 'REMOVED', impact: 'STRUCTURE' }));
  for (const id of [...afterMap.keys()].sort()) if (!beforeMap.has(id)) changes.push(Object.freeze({ domain, id, field: '$row', before: 'ABSENT', after: 'ADDED', impact: 'STRUCTURE' }));
}

export function compareHpPipingClassIntakeReplacement(currentProject, candidateProject) {
  const changes = [];
  addFieldChanges(changes, 'CLASS', 'CLASS',
    {
      projectId: currentProject?.metadata?.projectId,
      classId: currentProject?.metadata?.classId,
      revision: currentProject?.metadata?.revision,
      b313Edition: currentProject?.methodManifest?.b313Edition,
      viii3Edition: currentProject?.methodManifest?.viii3Edition,
      designPressureMpa: currentProject?.classBasis?.designPressureMpa,
      internalAllowanceMm: currentProject?.classBasis?.internalAllowanceMm,
      externalAllowanceMm: currentProject?.classBasis?.externalAllowanceMm,
      spectrumId: currentProject?.transient?.spectrum?.spectrumId,
      designLifeYears: currentProject?.transient?.spectrum?.designLifeYears,
      preparedBy: currentProject?.transient?.spectrum?.preparedBy,
      checkedBy: currentProject?.transient?.spectrum?.checkedBy,
      approvedBy: currentProject?.transient?.spectrum?.approvedBy,
      spectrumStatus: currentProject?.transient?.spectrum?.status,
    },
    {
      projectId: candidateProject?.metadata?.projectId,
      classId: candidateProject?.metadata?.classId,
      revision: candidateProject?.metadata?.revision,
      b313Edition: candidateProject?.methodManifest?.b313Edition,
      viii3Edition: candidateProject?.methodManifest?.viii3Edition,
      designPressureMpa: candidateProject?.classBasis?.designPressureMpa,
      internalAllowanceMm: candidateProject?.classBasis?.internalAllowanceMm,
      externalAllowanceMm: candidateProject?.classBasis?.externalAllowanceMm,
      spectrumId: candidateProject?.transient?.spectrum?.spectrumId,
      designLifeYears: candidateProject?.transient?.spectrum?.designLifeYears,
      preparedBy: candidateProject?.transient?.spectrum?.preparedBy,
      checkedBy: candidateProject?.transient?.spectrum?.checkedBy,
      approvedBy: candidateProject?.transient?.spectrum?.approvedBy,
      spectrumStatus: candidateProject?.transient?.spectrum?.status,
    },
    [
      ['projectId','IDENTITY'],['classId','IDENTITY'],['revision','IDENTITY'],
      ['b313Edition','METHOD_BASIS'],['viii3Edition','METHOD_BASIS'],
      ['designPressureMpa','STRESS_BASIS'],['internalAllowanceMm','STRESS_BASIS'],['externalAllowanceMm','STRESS_BASIS'],
      ['spectrumId','IDENTITY'],['designLifeYears','DAMAGE_BASIS'],
      ['preparedBy','CUSTODY'],['checkedBy','CUSTODY'],['approvedBy','CUSTODY'],['spectrumStatus','CUSTODY'],
    ],
  );

  const pBefore = indexed(currentProject?.products, 'productId'); const pAfter = indexed(candidateProject?.products, 'productId'); structuralChanges(changes, 'PRODUCT', pBefore, pAfter);
  for (const id of [...pBefore.keys()].filter((key) => pAfter.has(key)).sort()) {
    const a = pBefore.get(id); const b = pAfter.get(id);
    addFieldChanges(changes, 'PRODUCT', id,
      { nominalSize:a.nominalSize, mode:a.calculationBasis?.mode, od:a.calculationBasis?.outsideDiameterMm, S:a.calculationBasis?.allowableStressMpa, wall:a.calculationBasis?.nominalWallMm, tol:a.calculationBasis?.minusTolerancePct, wallBasis:a.wallState?.fatigueWallBasis, measured:a.wallState?.measuredCurrentWallMm, futureInternal:a.wallState?.futureInternalLossMm, futureExternal:a.wallState?.futureExternalLossMm },
      { nominalSize:b.nominalSize, mode:b.calculationBasis?.mode, od:b.calculationBasis?.outsideDiameterMm, S:b.calculationBasis?.allowableStressMpa, wall:b.calculationBasis?.nominalWallMm, tol:b.calculationBasis?.minusTolerancePct, wallBasis:b.wallState?.fatigueWallBasis, measured:b.wallState?.measuredCurrentWallMm, futureInternal:b.wallState?.futureInternalLossMm, futureExternal:b.wallState?.futureExternalLossMm },
      [['nominalSize','IDENTITY'],['mode','STRUCTURE'],['od','STRESS_BASIS'],['S','STRESS_BASIS'],['wall','STRESS_BASIS'],['tol','STRESS_BASIS'],['wallBasis','STRESS_BASIS'],['measured','STRESS_BASIS'],['futureInternal','STRESS_BASIS'],['futureExternal','STRESS_BASIS']]);
  }

  const sBefore = indexed(currentProject?.transient?.states, 'stateId'); const sAfter = indexed(candidateProject?.transient?.states, 'stateId'); structuralChanges(changes, 'STATE', sBefore, sAfter);
  for (const id of [...sBefore.keys()].filter((key) => sAfter.has(key)).sort()) addFieldChanges(changes, 'STATE', id, sBefore.get(id), sAfter.get(id), [['pressureMpa','STRESS_BASIS'],['materialTemperatureC','STRESS_BASIS'],['structuralTemperatureC','STRESS_BASIS']]);

  const cBefore = indexed(currentProject?.transient?.transitions, 'cycleId'); const cAfter = indexed(candidateProject?.transient?.transitions, 'cycleId'); structuralChanges(changes, 'CYCLE', cBefore, cAfter);
  for (const id of [...cBefore.keys()].filter((key) => cAfter.has(key)).sort()) addFieldChanges(changes, 'CYCLE', id, cBefore.get(id), cAfter.get(id), [['fromStateId','STRESS_BASIS'],['toStateId','STRESS_BASIS'],['totalCycles','DAMAGE_BASIS'],['cyclesPerYear','DAMAGE_BASIS'],['category','CUSTODY'],['provenanceId','CUSTODY']]);

  const kdRows = (project) => (project?.fatigueEvidence ?? []).flatMap((pkg) => (pkg.externalResults ?? []).map((row) => ({ ...row, key: `${text(pkg.productId)}::${text(row.cycleId)}` })));
  const kBefore = indexed(kdRows(currentProject), 'key'); const kAfter = indexed(kdRows(candidateProject), 'key'); structuralChanges(changes, 'KD', kBefore, kAfter);
  for (const id of [...kBefore.keys()].filter((key) => kAfter.has(key)).sort()) addFieldChanges(changes, 'KD', id, kBefore.get(id), kAfter.get(id), [['fromStateId','FATIGUE_BASIS'],['toStateId','FATIGUE_BASIS'],['locationId','FATIGUE_BASIS'],['userAlternatingStressIntensityMpa','FATIGUE_BASIS'],['equivalentAlternatingStressMpa','FATIGUE_BASIS'],['permissibleCycles','FATIGUE_BASIS']]);

  const impacts = ['IDENTITY','STRUCTURE','METHOD_BASIS','STRESS_BASIS','DAMAGE_BASIS','FATIGUE_BASIS','CUSTODY'];
  const counts = Object.freeze(Object.fromEntries(impacts.map((impact) => [impact, changes.filter((row) => row.impact === impact).length])));
  return Object.freeze({
    ok: true,
    changed: changes.length > 0,
    changes: Object.freeze(changes),
    counts,
    highImpact: counts.STRUCTURE + counts.METHOD_BASIS + counts.STRESS_BASIS + counts.FATIGUE_BASIS > 0,
    summary: Object.freeze({ totalChanges: changes.length, ...counts }),
  });
}
