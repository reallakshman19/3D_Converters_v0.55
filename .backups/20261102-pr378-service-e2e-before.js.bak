import { enrichInputXmlDocument } from './xml-cii-inputxml-enrichment.js';
import { runXmlCii2019StandaloneEngineJob } from './xml-cii-workflow-engine-client.js?v=20261001-single-weight-owners-1';
import { createWorkflowDiagnostics, normalizeWorkflowResult } from './xml-cii-workflow-types.js';
import { applyStandaloneSifFacts } from './xml-cii-standalone-sif-apply.js';
import { enrichStandaloneXmlForRun } from './xml-cii-standalone-run-parity.js?v=20261008-p0-mode-b-parity-1';
import { buildXmlCiiBranchOccurrences } from './xml-cii-branch-scope.js';
import { auditConfiguredBranchFormats } from './xml-cii-branch-format-release.js';

function parseSupportConfig(raw) {
  try {
    const value = JSON.parse(String(raw ?? '') || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function applyEffectiveFactsToJob(job) {
  const config = parseSupportConfig(job.supportConfigJson);
  const weightOverrides = job.weightOverrides && typeof job.weightOverrides === 'object' ? job.weightOverrides : {};
  if (Object.keys(weightOverrides).length) {
    config.overrides = { ...(config.overrides || {}), rigidWeight: { ...(config.overrides?.rigidWeight || {}), ...weightOverrides } };
  }
  if (Array.isArray(job.previewFacts) && job.previewFacts.length) config.previewFacts = job.previewFacts;
  if (Array.isArray(job.manualFacts) && job.manualFacts.length) config.manualFacts = job.manualFacts;
  if (Array.isArray(job.supportMapperRules) && job.supportMapperRules.length) config.supportMapperRules = job.supportMapperRules;
  return { ...job, supportConfigJson: JSON.stringify(config, null, 2) };
}

function mergeInputXmlEngineResult(enrichedResult, engineResult, outputMode) {
  const logs = [...(enrichedResult.logs || []), ...(Array.isArray(engineResult.logs) ? engineResult.logs : [])];
  const diagnostics = createWorkflowDiagnostics({
    ...(enrichedResult.diagnostics || {}),
    sourceKind: 'inputxml',
    outputKind: 'enrichedInputXML',
    branch: 'direct-inputxml-enrichment-plus-cii-compatibility',
    engineDiagnostics: engineResult.diagnostics || null,
    warnings: [
      ...((Array.isArray(enrichedResult.diagnostics?.warnings) ? enrichedResult.diagnostics.warnings : [])),
      ...((Array.isArray(engineResult.diagnostics?.warnings) ? engineResult.diagnostics.warnings : [])),
    ],
  });
  if (!engineResult.ok) {
    return normalizeWorkflowResult({ ...enrichedResult, ok: false, diagnostics, logs, error: engineResult.error || 'InputXML CII compatibility route failed.' });
  }
  return normalizeWorkflowResult({
    ...enrichedResult,
    enrichedText: outputMode === 'cii-only' ? '' : enrichedResult.enrichedText,
    enrichedName: outputMode === 'cii-only' ? '' : enrichedResult.enrichedName,
    ciiText: engineResult.ciiText,
    ciiName: engineResult.ciiName,
    diagnostics,
    logs,
  });
}

function normalizeXmlEngineResult(engineResult) {
  const engineDiagnostics = engineResult?.diagnostics && typeof engineResult.diagnostics === 'object' ? engineResult.diagnostics : null;
  const diagnostics = createWorkflowDiagnostics({
    ...(engineDiagnostics || {}),
    sourceKind: 'xml',
    outputKind: 'enrichedXML',
    branch: 'psi116-xml-compatibility-engine',
    engineDiagnostics,
    warnings: Array.isArray(engineDiagnostics?.warnings) ? engineDiagnostics.warnings : [],
  });
  return normalizeWorkflowResult({
    ...engineResult,
    sourceKind: 'xml',
    outputKind: 'enrichedXML',
    diagnostics,
  });
}

function blockedRunParityResult(job, parity) {
  const evidence = parity?.evidence || null;
  const error = parity?.error
    || (!parity?.applied ? 'Standalone run parity did not release a verified converter input.' : '')
    || (!evidence ? 'Standalone run parity evidence is missing.' : '')
    || 'Standalone run parity verification failed.';
  return normalizeXmlEngineResult({
    ok: false,
    sourceKind: 'xml',
    outputKind: 'enrichedXML',
    enrichedText: '',
    enrichedName: '',
    ciiText: null,
    ciiName: null,
    diagnostics: {
      schema: 'xml-cii-2019-workflow-diagnostics/v1',
      sourceKind: 'xml',
      outputMode: job?.options?.outputMode || 'enriched-only',
      warnings: [error],
      runParityStats: parity?.stats || {},
      runParityEvidence: evidence,
      converterInputReleased: false,
    },
    logs: Array.isArray(parity?.logs) ? parity.logs : [],
    error,
  });
}

function noImportedEnrichment(config) {
  return !['linelist','pipingClass','material','weight'].some(key=>
    (Array.isArray(config?.[key]?.masterRows)&&config[key].masterRows.length)||
    (Array.isArray(config?.[key]?.mapRows)&&config[key].mapRows.length));
}
// Base XML conversion deliberately withholds *all* ambiguous optional values.
// Governed Final decisions must never be dropped by this direct source route.
async function runBaseXmlWithoutEnrichment(job,runtime,reason,formatAudit=null) {
  const config=parseSupportConfig(job.supportConfigJson);
  const explicitFacts=Object.keys(config.overrides||{}).length||
    Object.keys(job.weightOverrides||{}).length||
    (job.previewFacts?.length||0)||(job.manualFacts?.length||0)||
    (job.supportMapperRules?.length||0)||
    (config.previewFacts?.length||0)||(config.manualFacts?.length||0)||
    (config.supportMapperRules?.length||0);
  if(job.xml229NativeFinalPacket||explicitFacts)
    return blockedRunParityResult(job,{
      error:'BASE_XML_REQUIRES_SEPARATE_GOVERNED_FINAL_REVIEW: accepted or authored engineering inputs cannot be silently discarded',
    });
  // Preserve geometry, coordinate/JSON custody and converter options; withhold
  // only optional master-derived enrichment and configured format identities.
  const sourceConfig={...config};
  for(const key of ['linelist','pipingClass','material','rating','weight',
      'regexTester','formats','overrides','previewFacts','manualFacts'])
    delete sourceConfig[key];
  const raw={...job,supportConfigJson:JSON.stringify(sourceConfig),
    previewFacts:[],manualFacts:[],supportMapperRules:[],weightOverrides:{}};
  // Selected staged JSON remains present and independently fail-closed.
  const result=await runXmlCii2019StandaloneEngineJob(raw,runtime);
  const normalized=normalizeXmlEngineResult(result);
  if(normalized.diagnostics)normalized.diagnostics.optionalEnrichment={
    status:'WITHHELD',reason,
    checkedBranchCount:formatAudit?.checkedCount||0,
    unresolvedFormatCount:formatAudit?.failures?.length||0,
    nativeReleaseNotImplied:true,
  };
  return normalized;
}

export async function runXmlCii2019WorkflowService(job, runtime = {}) {
  const factedJob = applyEffectiveFactsToJob(job);
  if (factedJob.sourceKind === 'inputxml') {
    const enrichedResult = enrichInputXmlDocument(factedJob);
    const sif = applyStandaloneSifFacts(enrichedResult.enrichedText, 'inputxml', factedJob.sifFacts);
    const finalEnrichedResult = { ...enrichedResult, enrichedText: sif.text };
    if (factedJob.options.outputMode === 'enriched-only') return normalizeWorkflowResult(finalEnrichedResult);
    const engineJob = { ...factedJob, sourceText: sif.text, sourceName: enrichedResult.enrichedName, options: { ...factedJob.options, outputMode: 'cii-only' } };
    const engineResult = await runXmlCii2019StandaloneEngineJob(engineJob, runtime);
    return mergeInputXmlEngineResult(finalEnrichedResult, engineResult, factedJob.options.outputMode);
  }

  // Format identity is enrichment-only; complete source scope remains audited.
  const occurrences = buildXmlCiiBranchOccurrences(factedJob.sourceText);
  const auditConfig = parseSupportConfig(factedJob.supportConfigJson);
  const audit = auditConfiguredBranchFormats(occurrences, auditConfig);
  if (audit.blocked) return runBaseXmlWithoutEnrichment(factedJob,runtime,
    'CONFLICTING_OR_UNMATCHED_FORMAT_ENRICHMENT',audit);
  if(noImportedEnrichment(auditConfig)&&
     !Array.isArray(auditConfig.regexTester?.formats)&&
     !Array.isArray(auditConfig.formats))
    return runBaseXmlWithoutEnrichment(factedJob,runtime,
      'NO_IMPORTED_MASTER_ENRICHMENT',audit);

  const parityRunner = typeof runtime.runParityEnricher === 'function'
    ? runtime.runParityEnricher
    : enrichStandaloneXmlForRun;
  const parity = await parityRunner(factedJob);
  if (!parity?.applied || parity?.error || !parity?.evidence || parity.evidence.ok !== true) {
    return blockedRunParityResult(factedJob, parity);
  }
  const finalAudit = auditConfiguredBranchFormats(occurrences, auditConfig, parity.branchRows);
  if (finalAudit.blocked) return runBaseXmlWithoutEnrichment(factedJob,runtime,
    'PREVIEW_ENRICHMENT_IDENTITY_CONFLICT',finalAudit);

  const engineJob = { ...factedJob, sourceText: parity.xmlText };
  const result = await runXmlCii2019StandaloneEngineJob(engineJob, runtime);
  if (Array.isArray(result?.logs) && parity.logs.length) result.logs = [...parity.logs, ...result.logs];
  const normalized = normalizeXmlEngineResult(result);
  if (normalized.diagnostics) {
    normalized.diagnostics.runParityStats = parity.stats;
    normalized.diagnostics.runParityEvidence = parity.evidence;
    normalized.diagnostics.converterInputReleased = true;
    normalized.diagnostics.converterInputDigest = parity.evidence.engineInputDigest;
  }
  return normalized;
}
