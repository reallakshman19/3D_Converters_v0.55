import { updateWorkflowState } from './xml-cii-adapted-state.js?v=20261001-weight-output-2';
import { ensureMasterRuntime, persistChangedMasterDetailed } from './xml-cii-adapted-master-runtime.js';
import { requestMeasuredFullRender } from './xml-cii-adapted-perf.js';
import { masterDatasetCoordinator as coordinator } from './xml-cii-adapted-master-dataset-runtime.js?v=20261006-c05-5-5-persistence-retry-1';

function nextPersistenceFailures(state, key, failure = null) {
  const next = { ...(state?.masterPersistenceFailures || {}) };
  if (failure) next[key] = Object.freeze({ ...failure });
  else delete next[key];
  return next;
}

function persistenceFailureRecord(key, datasetId, phase, persistence = {}) {
  const failure = persistence?.failure || persistence?.failures?.[0] || null;
  if (!failure && phase !== 'restart-custody') return null;
  return {
    key,
    datasetId: String(datasetId || ''),
    phase,
    name: String(failure?.name || 'StorageError'),
    message: String(failure?.message || 'Browser restart custody could not be saved.'),
    quotaLimited: !!persistence?.quotaLimited,
  };
}

export function masterImportPersistenceStatus(baseMessage, workerPersistence = null, custodyPersistence = null) {
  if (workerPersistence?.persisted === false) {
    const cause = workerPersistence.quotaLimited ? 'browser storage quota' : 'IndexedDB storage error';
    const detail = String(workerPersistence.failure?.message || '').trim();
    return `${baseMessage} Parse/import succeeded. Active session is usable, but durable IndexedDB persistence failed due to ${cause}${detail ? ` (${detail})` : ''}. Reload will not restore this session-only dataset as durable. Use Retry durable save before reload.`;
  }
  if (custodyPersistence?.failures?.length) {
    const cause = custodyPersistence.quotaLimited ? 'browser storage quota' : 'browser storage error';
    return `${baseMessage} Parse/import succeeded, but restart custody could not be saved due to ${cause}. Active session remains usable. Use Retry durable save before reload.`;
  }
  return masterPersistenceStatus(baseMessage, custodyPersistence || {
    failures: [], indexedDbBacked: false, compact: false, quotaLimited: false, normalizedPersisted: false,
  });
}

export async function retryCurrentMasterPersistence(stateRef, key, options = {}) {
  const initialContext = ensureMasterRuntime(stateRef.current.masterContext || {});
  const initialRef = initialContext.datasetRefs?.[key];
  if (!initialRef?.datasetId) {
    stateRef.current = updateWorkflowState(stateRef.current, {
      importMastersLoading: false,
      importMastersWriteBackStatus: `No active ${key} dataset is available for persistence retry.`,
    });
    return { ok: false, reason: 'missing-dataset' };
  }

  const basisDatasetId = String(initialRef.datasetId);
  const basisRevision = Number(initialContext.appliedMappingRevision?.[key] || 0);
  const retryPersistence = options.retryPersistence
    || ((masterKey, datasetId) => coordinator.retryPersistence(masterKey, datasetId));
  const persistCustody = options.persistCustody || persistChangedMasterDetailed;

  stateRef.current = updateWorkflowState(stateRef.current, {
    importMastersLoading: true,
    importMastersWriteBackStatus: `Retrying durable persistence for ${key} without reparsing or remapping…`,
  });

  try {
    let workerPersistence = { persisted: true, failure: null, quotaLimited: false };
    if (String(initialRef.persistence || '') === 'session') {
      const result = await retryPersistence(key, basisDatasetId);
      workerPersistence = result?.persistence || { persisted: false, failure: { name: 'Error', message: 'Persistence retry returned no result.' }, quotaLimited: false };

      const currentContext = ensureMasterRuntime(stateRef.current.masterContext || {});
      const currentRef = currentContext.datasetRefs?.[key];
      const currentRevision = Number(currentContext.appliedMappingRevision?.[key] || 0);
      if (String(currentRef?.datasetId || '') !== basisDatasetId || currentRevision !== basisRevision) {
        stateRef.current = updateWorkflowState(stateRef.current, {
          importMastersLoading: false,
          importMastersWriteBackStatus: `Persistence retry result for ${key} was ignored because the active master changed while retry was running.`,
        });
        return { ok: false, reason: 'stale-result' };
      }

      if (workerPersistence.persisted !== true) {
        const failure = persistenceFailureRecord(key, basisDatasetId, 'indexeddb', workerPersistence);
        stateRef.current = updateWorkflowState(stateRef.current, {
          importMastersLoading: false,
          masterPersistenceFailures: nextPersistenceFailures(stateRef.current, key, failure),
          importMastersWriteBackStatus: masterImportPersistenceStatus(
            `Persistence retry for ${key} did not become durable.`,
            workerPersistence,
            null,
          ),
        });
        return { ok: false, reason: 'indexeddb-failure', persistence: workerPersistence };
      }

      const promotedRef = Object.freeze({ ...currentRef, persistence: 'indexeddb' });
      stateRef.current = updateWorkflowState(stateRef.current, {
        masterContext: {
          ...currentContext,
          datasetRefs: { ...(currentContext.datasetRefs || {}), [key]: promotedRef },
        },
      });
    }

    const currentContext = ensureMasterRuntime(stateRef.current.masterContext || {});
    const currentRef = currentContext.datasetRefs?.[key];
    if (String(currentRef?.datasetId || '') !== basisDatasetId
        || Number(currentContext.appliedMappingRevision?.[key] || 0) !== basisRevision) {
      stateRef.current = updateWorkflowState(stateRef.current, {
        importMastersLoading: false,
        importMastersWriteBackStatus: `Persistence retry for ${key} was not applied because the active master changed.`,
      });
      return { ok: false, reason: 'stale-result' };
    }

    const custodyPersistence = persistCustody(key, currentContext);
    const custodyFailure = custodyPersistence?.failures?.length
      ? persistenceFailureRecord(key, basisDatasetId, 'restart-custody', custodyPersistence)
      : null;
    stateRef.current = updateWorkflowState(stateRef.current, {
      importMastersLoading: false,
      masterPersistenceFailures: nextPersistenceFailures(stateRef.current, key, custodyFailure),
      importMastersWriteBackStatus: custodyFailure
        ? masterImportPersistenceStatus(
          `Durable IndexedDB persistence succeeded for ${key}.`,
          workerPersistence,
          custodyPersistence,
        )
        : `Durable persistence retry succeeded for ${key}. Dataset identity and applied mapping revision are unchanged; reload can restore this dataset from IndexedDB.`,
    });
    return {
      ok: !custodyFailure,
      reason: custodyFailure ? 'restart-custody-failure' : 'durable',
      datasetId: basisDatasetId,
      revision: basisRevision,
    };
  } catch (error) {
    const failure = {
      key,
      datasetId: basisDatasetId,
      phase: 'retry',
      name: String(error?.name || 'Error'),
      message: String(error?.message || error || 'Persistence retry failed.'),
      quotaLimited: false,
    };
    stateRef.current = updateWorkflowState(stateRef.current, {
      importMastersLoading: false,
      masterPersistenceFailures: nextPersistenceFailures(stateRef.current, key, failure),
      importMastersWriteBackStatus: `Persistence retry failed for ${key}: ${failure.message} Active session authority remains unchanged; re-import the source if the worker session is no longer available.`,
    });
    return { ok: false, reason: 'retry-error', error };
  }
}

export function bindRetryPersistenceEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="retry-master-persistence"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await retryCurrentMasterPersistence(stateRef, button.dataset.masterKey);
      requestMeasuredFullRender(render);
    });
  });
}

