import './xml-cii-adapted-authority-migration.js';
import { DEFAULT_WEIGHT_MASTER_ROWS } from '../../../converters/xml-cii2019-core/default-weight-master-rows.js';
import {
  withXmlCiiEffectiveRigidWeightLegacyView,
  withXmlCiiRigidWeightMatch1,
  xmlCiiEffectiveRigidWeightMap,
} from '../../../converters/xml-cii2019-core/rigid-weight-authority.js?v=20260928-issue776-authority-2';
import {
  saveMasterContextToLocalStorage,
  updateWorkflowState,
  xmlCiiEnrichedConfigFromState,
} from './xml-cii-adapted-state.js';
import { appendEmpiricalWeightValidationReport } from './xml-cii-adapted-weight-validation-report.js?v=20260928-issue776-authority-2';
import { compactDatasetBackedConfig } from './xml-cii-adapted-master-runtime.js';
import { materializeMasterDatasetRows, rankMasterDatasetWeightIssues } from './xml-cii-adapted-master-dataset-runtime.js?v=20260930-issue781-weight-liveness-cache-1';
import { installWeightMatchAuthorityPresentation } from './xml-cii-adapted-weight-match-authority-ui.js?v=20260930-issue781-weight-ux-1';

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function escapeHtml(value) {
  return text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hasWeightRows(config) {
  return Array.isArray(config?.weight?.masterRows) && config.weight.masterRows.length > 0;
}

async function ensureWeightRows(config, masterContext, materializeRows = materializeMasterDatasetRows) {
  const out = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  const residentRows = Array.isArray(masterContext?.weightMasterRows) && masterContext.weightMasterRows.length
    ? masterContext.weightMasterRows
    : null;
  const datasetRef = masterContext?.datasetRefs?.weight;

  // Dataset custody is authoritative. If compatibility hydration has been removed,
  // fetch only this master for the current operation instead of accepting defaults.
  if (datasetRef?.datasetId && !residentRows && !hasWeightRows(out)) {
    const rows = await materializeRows('weight', datasetRef);
    if (rows.length !== Number(datasetRef.rowCount || 0)) {
      throw new Error(`Weight dataset materialization mismatch: expected ${Number(datasetRef.rowCount || 0)}, received ${rows.length}.`);
    }
    out.weight = out.weight && typeof out.weight === 'object' && !Array.isArray(out.weight)
      ? { ...out.weight }
      : {};
    out.weight.masterRows = rows;
    const revision = Number(masterContext?.appliedMappingRevision?.weight || out.weight.masterRevision || 0);
    if (revision > 0) out.weight.masterRevision = revision;
    if (datasetRef.masterFingerprint) out.weight.masterFingerprint = datasetRef.masterFingerprint;
    return out;
  }

  if (hasWeightRows(out)) return out;
  const rows = residentRows || DEFAULT_WEIGHT_MASTER_ROWS;
  out.weight = out.weight && typeof out.weight === 'object' && !Array.isArray(out.weight)
    ? { ...out.weight }
    : {};
  out.weight.masterRows = rows.map((row) => ({ ...row }));
  return out;
}

export async function weightMatchConfigFromState(state, options = {}) {
  const materializeRows = options.materializeRows || materializeMasterDatasetRows;
  const context = state?.masterContext || {};
  const datasetRef = context?.datasetRefs?.weight;
  const base = compactDatasetBackedConfig(xmlCiiEnrichedConfigFromState(state), context);
  if (datasetRef?.datasetId) {
    const out = { ...base };
    out.weight = out.weight && typeof out.weight === 'object' && !Array.isArray(out.weight) ? { ...out.weight } : {};
    delete out.weight.masterRows;
    const revision = Number(context?.appliedMappingRevision?.weight ?? out.weight.masterRevision ?? datasetRef.datasetRevision ?? 0);
    if (revision > 0) out.weight.masterRevision = revision;
    if (datasetRef.masterFingerprint) out.weight.masterFingerprint = String(datasetRef.masterFingerprint);
    return out;
  }
  return ensureWeightRows(base, context, materializeRows);
}

function persistConfig(stateRef, config) {
  const compactConfig = compactDatasetBackedConfig(config, stateRef.current.masterContext || {});
  const masterContext = { ...(stateRef.current.masterContext || {}), config: compactConfig };
  stateRef.current = updateWorkflowState(stateRef.current, {
    supportConfigJson: JSON.stringify(compactConfig, null, 2),
    masterContext,
  });
  saveMasterContextToLocalStorage(stateRef.current.masterContext);
}

function ensureOverrides(config) {
  if (!config.overrides || typeof config.overrides !== 'object' || Array.isArray(config.overrides)) {
    config.overrides = {};
  }
  return config.overrides;
}

function changedWeightMap(nextConfig, baseline) {
  const bucket = nextConfig?.overrides?.rigidWeight;
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return {};
  const changes = {};
  for (const [key, rawValue] of Object.entries(bucket)) {
    const value = Number(rawValue);
    if (!key || !Number.isFinite(value) || value <= 0) continue;
    if (Number(baseline?.[key]) !== value) changes[key] = value;
  }
  return changes;
}

function persistSharedWeightMatchConfig(stateRef, nextConfig, baseline, calculationBasis) {
  const current = calculationBasis && hasWeightRows(calculationBasis)
    ? calculationBasis
    : nextConfig;
  const proposalMeta = { ...(nextConfig?.overrides?.rigidWeightProposalMeta || {}) };
  const overrides = {
    ...(nextConfig?.overrides || {}),
    rigidWeight: { ...(current?.overrides?.rigidWeight || {}) },
  };
  delete overrides.rigidWeightProposalMeta;
  const clean = {
    ...nextConfig,
    weight: { ...(nextConfig?.weight || {}), masterRows: [...(current?.weight?.masterRows || [])] },
    overrides,
  };
  const changes = changedWeightMap(nextConfig, baseline);
  for (const [key, provenance] of Object.entries(proposalMeta)) {
    const value = Number(nextConfig?.overrides?.rigidWeight?.[key]);
    if (key && Number.isFinite(value) && value > 0 && provenance && typeof provenance === 'object') changes[key] = value;
  }
  const staged = withXmlCiiRigidWeightMatch1(clean, changes, proposalMeta);
  persistConfig(stateRef, staged);
  return staged;
}

export function renderAdaptedWeightMatchPanelV2(card, stateRef) {
  card.__xmlCiiWeightAuthorityPresentationCleanup?.();
  card.__xmlCiiWeightAuthorityPresentationCleanup = null;
  card.innerHTML = '<div class="model-converters-workflow-detail-note">Loading shared Weight Match authority…</div>';
  void (async () => {
    try {
      const [renderer, parity] = await Promise.all([
        import('../../model-converters/converters/xmltocii2019_helper/weight-match-renderer.js?v=20260930-issue781-weight-liveness-cache-1'),
        import('../xml-cii-standalone-run-parity.js?v=20260928-issue776-authority-2'),
      ]);
      const shared = await parity.loadParentWeightMatchModules();
      if (
        typeof renderer.xmlCiiRenderWeightMatchPhase !== 'function'
        || typeof shared.bindXmlCiiWeightMatchPhase !== 'function'
        || typeof shared.enrichXmlForCii2019 !== 'function'
      ) {
        throw new Error('Shared Weight Match renderer contract is incomplete.');
      }
      const state = stateRef.current;
      const weightDatasetRef = state?.masterContext?.datasetRefs?.weight || null;
      let calculationBasis = await weightMatchConfigFromState(state);
      const rendererConfig = withXmlCiiEffectiveRigidWeightLegacyView(calculationBasis);
      let baseline = xmlCiiEffectiveRigidWeightMap(calculationBasis);
      const xmlFile = state.sourceFile || (state.sourceText
        ? new File([state.sourceText], 'source.xml', { type: 'application/xml' })
        : null);
      card.innerHTML = renderer.xmlCiiRenderWeightMatchPhase();
      shared.bindXmlCiiWeightMatchPhase(card, {
        xmlFile,
        stagedJsonText: state.stagedJsonText || '',
        config: rendererConfig,
        enrichXmlForCii2019: shared.enrichXmlForCii2019,
      weightDatasetRef,
      rankWeightIssues: weightDatasetRef?.datasetId ? async (issues, request = {}) => {
        const compactConfig = compactDatasetBackedConfig(request.config || rendererConfig, stateRef.current.masterContext || {});
        return rankMasterDatasetWeightIssues('weight', weightDatasetRef.datasetId, issues, compactConfig, {
          ratingMode: request.ratingMode || 'preview',
          previewRatingSnapshot: request.snapshot || {},
        });
      } : null,
      resolveWeightValidationMasterRows: weightDatasetRef?.datasetId
        ? async () => materializeMasterDatasetRows('weight', weightDatasetRef)
        : async () => calculationBasis?.weight?.masterRows || [],
        onSaveConfig: (nextConfig) => {
          const saved = persistSharedWeightMatchConfig(stateRef, nextConfig, baseline, calculationBasis);
          calculationBasis = saved;
          baseline = xmlCiiEffectiveRigidWeightMap(saved);
        },
        ensureOverrides,
        resolveStagedJsonText: async () => ({
          text: stateRef.current.stagedJsonText || '',
          label: stateRef.current.stagedJsonFile?.name || '',
        }),
      });
      card.__xmlCiiWeightAuthorityPresentationCleanup = installWeightMatchAuthorityPresentation(card);
      appendEmpiricalWeightValidationReport(card, stateRef);
    } catch (error) {
      card.innerHTML = `<div class="model-converters-workflow-detail-note" style="border-color:#b91c1c;color:#fecaca;background:#450a0a;">Weight Match was not started because the shared Preview Rating authority could not load: ${escapeHtml(error?.message || error)}</div>`;
      console.error('Standalone Weight Match authority load failed:', error);
    }
  })();
}
