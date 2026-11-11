import {
  HP_PIPING_CLASS_AUTHORITY_POLICY,
  HP_PIPING_CLASS_PROJECT_VERSION,
  createHpPipingClassProject,
  validateHpPipingClassProject,
} from '../converters/b313-chapter-ix/hp-piping-class-project.js';
import { evaluateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-orchestrator.js';
import {
  createHpPipingClassGovernedBasisPackage,
  loadHpPipingClassMasterStore,
  validateHpPipingClassGovernedBasisCustody,
} from './hp-piping-class-master-store-service.js';

export const HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY = 'format-converters.hpPipingClass.project.v2';
export const HP_PIPING_CLASS_WORKSPACE_CONTROLLER_VERSION = 'hp-piping-class-workspace-controller/v2';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function safeStorage(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : null;
}

function readStoredProject(storage) {
  const store = safeStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistProject(storage, project) {
  const store = safeStorage(storage);
  if (!store) return false;
  try {
    store.setItem(HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

function authorityUnsafe(authority = {}) {
  return authority.calculationMode !== HP_PIPING_CLASS_AUTHORITY_POLICY.calculationMode
    || authority.nativeCoreKd3Qualified !== false
    || authority.codeCompliance !== false
    || authority.canUseForDesignAuthority !== false;
}

function authorityPromotionDetected(result) {
  if (authorityUnsafe(result?.authority)) return true;
  return (result?.products ?? []).some((row) => authorityUnsafe(row?.authority));
}

function promotionBlockedResult(result) {
  return Object.freeze({
    ok: false,
    projectState: 'AUTHORITY_PROMOTION_BLOCKED',
    issues: Object.freeze([{
      path: 'result.authority',
      code: 'AUTHORITY_PROMOTION_NOT_ALLOWED',
      message: 'HP Piping Class workspace rejected a calculation result that did not preserve review-only authority.',
    }]),
    rejectedResult: clone(result),
    authority: Object.freeze({ ...HP_PIPING_CLASS_AUTHORITY_POLICY }),
  });
}

function invalidProjectResult(validation) {
  return Object.freeze({
    ok: false,
    projectState: 'INVALID_PROJECT',
    issues: Object.freeze(clone(validation.issues ?? [])),
    advisories: Object.freeze(clone(validation.advisories ?? [])),
    products: Object.freeze([]),
    authority: Object.freeze({ ...HP_PIPING_CLASS_AUTHORITY_POLICY }),
  });
}

function masterNotLoadedResult() {
  return Object.freeze({
    ok: false,
    code: 'MASTER_STORE_NOT_LOADED',
    message: 'Canonical Chapter IX master store must be loaded before binding a governed basis.',
    canUseForDesignAuthority: false,
  });
}

function advisoryWarning(row) {
  return {
    code: row.code,
    message: `${row.path}: ${row.message}`,
    advisory: true,
  };
}

function withWorkspaceAdvisories(result, advisories) {
  const next = clone(result) ?? {};
  const existing = Array.isArray(next.advisories) ? next.advisories : [];
  const combined = [...existing, ...clone(advisories ?? [])];
  next.advisories = combined;
  next.warnings = [
    ...(Array.isArray(next.warnings) ? next.warnings : []),
    ...(advisories ?? []).map(advisoryWarning),
  ];
  return next;
}

export function createHpPipingClassWorkspaceController({
  initialProject = null,
  storage = globalThis.localStorage,
  evaluator = evaluateHpPipingClassProject,
  masterLoader = loadHpPipingClassMasterStore,
  basisPackageFactory = createHpPipingClassGovernedBasisPackage,
  basisCustodyValidator = validateHpPipingClassGovernedBasisCustody,
} = {}) {
  const stored = initialProject ? null : readStoredProject(storage);
  let project = createHpPipingClassProject(initialProject ?? stored ?? {});
  let calculation = null;
  let masterRuntime = null;
  let revision = 0;
  const listeners = new Set();

  function productionValidation() {
    return validateHpPipingClassProject(project, { validationPolicy: 'PRODUCTION_REVIEW' });
  }

  function snapshot() {
    return Object.freeze({
      controllerVersion: HP_PIPING_CLASS_WORKSPACE_CONTROLLER_VERSION,
      project: clone(project),
      validation: clone(productionValidation()),
      calculation: clone(calculation),
      masterRuntime: clone(masterRuntime),
      revision,
    });
  }

  function emit(reason) {
    const current = snapshot();
    listeners.forEach((listener) => {
      try { listener(current, reason); } catch (error) { console.warn('HP Piping Class workspace listener failed', error); }
    });
    return current;
  }

  function replaceProject(nextProject, { persist = true, reason = 'PROJECT_REPLACED' } = {}) {
    project = createHpPipingClassProject(nextProject ?? {});
    calculation = null;
    revision += 1;
    if (persist) persistProject(storage, project);
    return emit(reason);
  }

  function mutateProject(mutator, options = {}) {
    if (typeof mutator !== 'function') throw new TypeError('mutateProject requires a mutator function.');
    const draft = clone(project);
    mutator(draft);
    return replaceProject(draft, { ...options, reason: options.reason ?? 'PROJECT_EDITED' });
  }

  async function loadMasterStore(options = {}) {
    if (typeof masterLoader !== 'function') throw new TypeError('masterLoader must be a function.');
    const result = await masterLoader(options);
    masterRuntime = clone(result);
    revision += 1;
    emit(result?.ok ? 'MASTER_STORE_LOADED' : 'MASTER_STORE_BLOCKED');
    return clone(masterRuntime);
  }

  function bindGovernedBasis(productIndex, selection = {}) {
    const index = Number(productIndex);
    if (!Number.isInteger(index) || index < 0 || index >= project.products.length) {
      return Object.freeze({
        ok: false,
        code: 'PRODUCT_INDEX_INVALID',
        message: 'A valid project product index is required.',
        canUseForDesignAuthority: false,
      });
    }
    if (!masterRuntime?.ok || !masterRuntime.store) return masterNotLoadedResult();
    const built = basisPackageFactory({
      store: masterRuntime.store,
      materialId: selection.materialId,
      b313Edition: selection.b313Edition,
      materialTemperatureC: selection.materialTemperatureC,
      productId: selection.productId,
    });
    if (!built?.ok) return clone(built);
    mutateProject((draft) => {
      const product = draft.products[index];
      product.productId = String(selection.productId ?? product.productId ?? '').trim();
      product.calculationBasis = {
        mode: 'GOVERNED_BASIS_PACKAGE',
        basisPackage: clone(built.basisPackage),
      };
      product.wallState ??= { fatigueWallBasis: 'END_OF_LIFE_EFFECTIVE' };
    }, { reason: 'GOVERNED_BASIS_BOUND' });
    return Object.freeze({
      ok: true,
      productIndex: index,
      productId: String(selection.productId ?? '').trim(),
      basisPackage: clone(built.basisPackage),
      authority: clone(built.authority),
      canUseForDesignAuthority: false,
    });
  }

  function governedCustodyIssues() {
    const governed = project.products
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => product?.calculationBasis?.mode === 'GOVERNED_BASIS_PACKAGE');
    if (!governed.length) return [];
    if (!masterRuntime?.ok || !masterRuntime.store) {
      return governed.map(({ index }) => ({
        path: `products[${index}].calculationBasis.basisPackage`,
        code: 'MASTER_STORE_NOT_LOADED',
        message: 'Canonical master-store custody has not been loaded. Embedded basis-package calculation may proceed for engineering review; custody reconciliation is deferred.',
      }));
    }
    return governed.flatMap(({ product, index }) => {
      const checked = basisCustodyValidator({
        store: masterRuntime.store,
        basisPackage: product.calculationBasis.basisPackage,
      });
      return checked?.ok ? [] : [{
        path: `products[${index}].calculationBasis.basisPackage`,
        code: checked?.code || 'GOVERNED_BASIS_CUSTODY_ADVISORY',
        message: checked?.message || 'Governed basis did not reproduce canonical master-store custody; calculation may proceed for engineering review and must not be treated as design authority.',
      }];
    });
  }

  function calculate(options = {}) {
    const validation = productionValidation();
    if (!validation.ok) {
      calculation = invalidProjectResult(validation);
      revision += 1;
      emit('CALCULATION_BLOCKED_INVALID_PROJECT');
      return calculation;
    }
    const custodyAdvisories = governedCustodyIssues();
    const evaluated = evaluator(project, {
      includeEvidence: options.includeEvidence !== false,
    });
    calculation = authorityPromotionDetected(evaluated)
      ? promotionBlockedResult(evaluated)
      : withWorkspaceAdvisories(evaluated, custodyAdvisories);
    revision += 1;
    emit(calculation.ok ? 'CALCULATION_COMPLETED_REVIEW_ONLY' : 'CALCULATION_BLOCKED');
    return clone(calculation);
  }

  function clearStoredProject() {
    const store = safeStorage(storage);
    if (store?.removeItem) {
      try { store.removeItem(HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY); } catch {}
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('subscribe requires a function.');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({
    getSnapshot: snapshot,
    replaceProject,
    mutateProject,
    loadMasterStore,
    bindGovernedBasis,
    calculate,
    subscribe,
    clearStoredProject,
  });
}

export function serializeHpPipingClassWorkspaceProject(project) {
  const normalized = createHpPipingClassProject(project ?? {});
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function parseHpPipingClassWorkspaceProject(raw) {
  const parsed = JSON.parse(String(raw ?? ''));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('HP Piping Class project JSON must contain an object.');
  }
  if (parsed.schemaVersion && parsed.schemaVersion !== HP_PIPING_CLASS_PROJECT_VERSION) {
    throw new TypeError(`Unsupported HP Piping Class project schema: ${parsed.schemaVersion}`);
  }
  return createHpPipingClassProject(parsed);
}
