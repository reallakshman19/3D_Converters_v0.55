import { detectXmlCiiWorkflowSourceKind } from './xml-cii-workflow-source-detect.js';
import { xmlCiiBranchScopeFromState } from './xml-cii-branch-scope.js';
import { auditConfiguredBranchFormats } from './xml-cii-branch-format-release.js';
import { projectXml229RunChecklist } from './integration/xml229-verified-output-readiness.mjs';
import {buildXml229RunHoldAudit} from './integration/xml229-run-hold-audit.mjs';
import { hasXml229GovernedNativeHold, isXml229XmlOnlyApproved } from './integration/xml229-output-participation.mjs';

function text(value) { return String(value ?? '').trim(); }
function array(value) { return Array.isArray(value) ? value : []; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function bytes(value) { return new TextEncoder().encode(String(value ?? '')).length; }

function parseConfig(value) {
  try { return { ok: true, value: JSON.parse(text(value) || '{}') }; }
  catch (error) { return { ok: false, error: error?.message || String(error) }; }
}

function sourceText(input) { return text(input.sourceText || input.sourceFileText); }
function resolvedKind(input) { return input.sourceKind === 'auto' ? detectXmlCiiWorkflowSourceKind(sourceText(input)) : (input.sourceKind || 'xml'); }
function hasResult(input) { return !!input.result?.enrichedText || !!input.result?.ciiText || !!input.result?.topologyFindingsText || input.result?.ok === true; }

function row(id, label, ok, message, opts = {}) {
  return { id, label, status: ok ? 'ready' : (opts.status || 'missing'), severity: ok ? 'ok' : (opts.severity || 'warning'), blocking: !!opts.blocking && !ok, message, detail: opts.detail || '' };
}

function topologyActionIds(input) {
  const value = input.options?.topologyActionIds;
  const rows = Array.isArray(value) ? value : String(value ?? '').split(/[\s,;]+/);
  return [...new Set(rows.map((entry) => String(entry).trim()).filter(Boolean))];
}

function optionRows(input, kind) {
  const rows = [row('source-loaded', 'Source loaded', !!sourceText(input) || !!input.sourceFile, 'Source text or file is available.', { blocking: true, severity: 'error' })];
  rows.push(row('source-kind', 'Source kind resolved', ['xml', 'inputxml'].includes(kind), `Resolved source kind: ${kind}.`, { blocking: true, severity: 'error' }));
  rows.push(row('support-config-valid', 'Support config valid', parseConfig(input.supportConfigJson).ok, 'Support/config JSON is parseable.', { blocking: true, severity: 'error' }));
  rows.push(row('output-mode', 'Output mode selected', !!input.options?.outputMode, `Output mode: ${input.options?.outputMode || 'not selected'}.`, { blocking: true, severity: 'error' }));
  return rows;
}

function topologyRows(input, kind) {
  const options = input.options || {};
  const requested = options.analyzeTopology === true || options.generateTopoFix === true || options.useTopoFixForCii === true || !!input.xml229TopoFixFreshReviewPending;
  if (!requested) return [];
  const ids = topologyActionIds(input);
  return [
    row('topology-source-mode', 'PSI116 topology source mode', kind === 'xml', kind === 'xml' ? 'Topology analysis will run against the effective PSI116 XML.' : 'Topology analysis is not available for InputXML source mode.', { blocking: true, severity: 'error' }),
    row('topology-analysis-enabled', 'Analyze PSI116 topology', options.analyzeTopology === true, 'Analyze topology must be enabled before correction.', { blocking: options.generateTopoFix === true || options.useTopoFixForCii === true, severity: 'error' }),
    row('topofix-action-ids', 'Reviewed TopoFix action IDs', options.generateTopoFix !== true || ids.length > 0, options.generateTopoFix === true ? `${ids.length} reviewed action ID(s) selected.` : 'No correction requested; action IDs are optional.', { blocking: options.generateTopoFix === true, severity: 'error' }),
    ...(hasOriginalJsonSourceOnlyRunHold(input) &&
      (options.generateTopoFix === true || options.useTopoFixForCii === true || input.xml229TopoFixFreshReviewPending)
      ? [row('topofix-prefinal-review', 'TopoFix and fresh Weight review', false,
        'Analyze topology, review and commit selected actions, then start a fresh Weight review from the committed XML. Prior Final decisions do not transfer.',
        {blocking:true,severity:'warning',status:'held'})] : []),
    row('topofix-use-dependency', 'Use committed TopoFix for CII dependency', options.useTopoFixForCii !== true || options.generateTopoFix === true, options.useTopoFixForCii === true ? 'CII will use the fixed XML only after the transaction commits.' : 'CII will use the original effective XML.', { blocking: options.useTopoFixForCii === true, severity: 'error' }),
    row('topofix-output-mode', 'TopoFix CII output mode', options.useTopoFixForCii !== true || ['cii-only', 'both'].includes(options.outputMode), options.useTopoFixForCii === true ? `Output mode ${options.outputMode || 'not selected'} must include CII.` : 'TopoFix is not selected as CII input.', { blocking: options.useTopoFixForCii === true, severity: 'error' }),
  ];
}

function branchFormatAuthorityRows(input) {
  const parsed = parseConfig(input.supportConfigJson);
  if (!parsed.ok) return []; // The existing support-config-valid gate handles invalid JSON.
  const config = object(parsed.value);
  const explicit = Array.isArray(config.regexTester?.formats) || Array.isArray(config.formats);
  if (!explicit) return []; // Legacy single-format flows retain their current readiness contract.
  const selected = xmlCiiBranchScopeFromState(input);
  if (!selected.applicable) return [];
  const audit = auditConfiguredBranchFormats(selected.selectedBranchOccurrences, config, null, { includeCandidates: true });
  const ok = !selected.blocked && !audit.blocked;
  const unmatched = audit.failures.filter(failure => failure.status === 'UNMATCHED').length;
  const ambiguous = audit.failures.filter(failure => failure.status === 'AMBIGUOUS').length;
  return [row('branch-format-authority', 'Configured branch format identity',
    ok,
    ok ? `${audit.checkedCount} selected branch occurrences have one resolved configured identity.`
      : selected.blocked && !audit.blocked
        ? 'Selected branch scope cannot be resolved; refresh selection against the original XML.'
        : `${audit.failures.length} of ${audit.checkedCount} selected branch occurrences have unresolved or conflicting configured formats (${unmatched} UNMATCHED; ${ambiguous} AMBIGUOUS). See first 20 format diagnostics below.`,
    // An unresolved source enrichment identity warrants Preview review, but
    // XML→CII conversion must still run on the available original XML.
    { blocking: false, severity: 'warning', status:'unresolved-enrichment',
      detail: JSON.stringify(audit.failures.slice(0, 20)) })];
}

function xmlRows(input) {
  const regex = !!input.regexTesterResult;
  const resolver = !!input.resolverJsonTraceResult;
  const manual = !!input.manualElementSideloadResult;
  return [
    ...branchFormatAuthorityRows(input),
    row('regex', 'Regex status for XML mode', regex, regex ? 'Regex tester result is available.' : 'Regex tester has not been run yet.'),
    row('resolver-json', 'Resolver / JSON Trace status for XML mode', resolver, resolver ? 'Resolver / JSON Trace result is available.' : 'Resolver / JSON Trace has not been built yet.'),
    row('manual-restraints', 'Manual restraints status for XML mode', manual, manual ? 'Manual restraint review result is available.' : 'Manual restraint review has not been run yet.'),
  ];
}

/**
 * The original JSON O1 receipt attests *only* durable source indexing.
 * Even INDEX_COMMITTED does not prove Preview, Weight/Final or native CII.
 * Preserve ordinary standalone XML as legacy/optional; block the governed
 * source-bound route whenever a selected original JSON source is present.
 */
function selectedOriginalJsonSourceReceipts(input) {
  const own = input?.xml229StagedSourceReceipt;
  const selected = (input?.sourceBatch?.sources || [])
    .filter(source => source?.enabled !== false)
    .map(source => source?.xml229StagedSourceReceipt || source?.workflow?.xml229StagedSourceReceipt)
    .filter(Boolean);
  return [...(own ? [own] : []), ...selected];
}
export function hasOriginalJsonSourceOnlyRunHold(input = {}) {
  return hasXml229GovernedNativeHold(input)||(!isXml229XmlOnlyApproved(input)&&
    input.xmlProcessingMode!=='mode-b'&&/<PipeStressExport(?:\s|>)/.test(input.sourceText||''));
}
function originalJsonAuthorityRows(input) {
  const receipts=selectedOriginalJsonSourceReceipts(input);
  if (!receipts.length) return hasOriginalJsonSourceOnlyRunHold(input)?[row(
    'xml229-original-json-engineering-authority','XML source → Final → native CII release authority',false,
    'Current source-bound Final decisions must be consumed and independently reconciled against actual native CII.',
    {blocking:true,severity:'warning',status:'held'})]:[];
  if (!hasOriginalJsonSourceOnlyRunHold(input))return [row(
    'xml229-xml-only-output-participation',
    'Explicit XML-only native output participation',
    true,
    'Owner selected current-basis XML-only conversion. Optional original JSON, GC-PW decisions and preview facts are excluded from the native conversion job; normal XML branch-format and converter preflights still apply.',
    {blocking:false}
  )];
  const phaseCounts = [...new Set(receipts.map(receipt => String(receipt?.phase || 'UNKNOWN')))];
  return [row('xml229-original-json-engineering-authority',
    'Original JSON → Preview → Weight/Final → native CII release authority',
    false,
    'Original JSON O1 source indexing (' + phaseCounts.join(', ') +
    ') is source-only. Even a verified engineering Preview and reviewed GC-PW Weight/Final session do not establish independent native CII Final/output consumption. Run is HELD until native output authority is verified; configured branch identity (whatever its verified occurrence count) and legacy cached rows never authorize it.',
    {blocking:true,severity:'warning',status:'held'})];
}


// A completed Final session can be valid while individual instrument owners
// cannot be represented by the native RIGID-only mass writer. When the exact
// current Run candidate returns its source-bound preflight, surface a separate
// actionable HOLD, not a converter crash. This is presentation only: never
// turn evidence into classification, reuse Final kg or authorize native CII.
function nativeInstrumentOwnerHoldRows(input) {
  const result = input.result;
  const evidence = result?.xml229NativeOwnerPreflight;
  if (!hasOriginalJsonSourceOnlyRunHold(input) ||
      result?.error !== 'NATIVE_RIGID_OWNER_UNSUPPORTED' ||
      evidence?.schema !== 'XML229.NativeOwnerPreflight.v1' ||
      !Array.isArray(evidence.unsupportedOwners) ||
      evidence.unsupportedOwners.length === 0) return [];
  const count = evidence.unsupportedOwners.length;
  return [row('xml229-instrument-native-owner-authority',
    'Instrument source classification for governed CII',
    false,
    count + ' accepted instrument owner(s) lack source RIGID classification. ' +
      'Native CII remains HELD; review engineering authority, revise the source ' +
      'only where justified, and perform a new Final weight review. ' +
      'XML-only testing remains a separate explicit option.',
    {blocking:true, severity:'warning', status:'held'})];
}

function inputXmlRows(input) {
  const matched = Number(input.manualElementSideloadResult?.summary?.matchedRows || input.result?.diagnostics?.sideLoadMatched || 0);
  return [row('inputxml-side-load', 'InputXML side-load status', matched > 0 || !!text(input.elementSideLoadText), `InputXML side-load evidence rows: ${matched || 'not built yet'}.`)];
}

function cachedRows(storageKey, picker) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return picker(parsed?.data ?? parsed);
  } catch { return false; }
}

function previewDone(input) {
  if (input.previewDiagnosticsAuditReport) return true;
  return ['xml-cii-pv-cache-v6', 'xml-cii-pv-cache-v5'].some((key) => cachedRows(key, (data) => array(data?.branchRows).length > 0 || array(data?.nodeRows).length > 0));
}

function weightMatchDone(input) {
  if (input.weightMatchResult) return true;
  return cachedRows('xml-cii-wm-cache-v1', (data) => array(data).length > 0);
}

function supportMapperDone(input) {
  if (input.supportTypeMapperResult || array(input.supportTypeMapperConfig).length) return true;
  const parsed = parseConfig(input.supportConfigJson);
  if (!parsed.ok) return false;
  if (array(parsed.value?.supportMapperRules).length > 0) return true;
  const kindMap = parsed.value?.supportKindToXmlType;
  if (kindMap && typeof kindMap === 'object' && Object.keys(kindMap).length > 0) return true;
  return array(parsed.value?.keywordRules).length > 0;
}

function commonRows(input) {
  // Legacy cache records do not attest the current original XML + staged JSON
  // Worker basis; only a live verified GC-PW completion may promote these rows.
  const governed = hasOriginalJsonSourceOnlyRunHold(input);
  const preview = !governed && previewDone(input);
  const weight = !governed && weightMatchDone(input);
  const mapper = supportMapperDone(input);
  return [
    row('import-masters', 'Import Masters status', !!input.masterContext, 'Master context is available.'),
    row('preview-audit', 'Preview / Diagnostics / Matched Audit status', preview, preview ? 'Preview / dry-run data is available.' : 'Preview has not been built yet.'),
    row('weight-match', 'Weight Match status', weight, weight ? (input.weightMatchStatus || 'Weight Match data is available.') : 'Weight Match result is not available.'),
    row('support-mapper', 'Support Type Mapper status', mapper, mapper ? (input.supportTypeMapperStatus || 'Support mapper rules are available.') : 'Support mapper result is not available.'),
    row('run-result', 'Run result available after run', hasResult(input), hasResult(input) ? 'Run result is available.' : 'No run result yet.', { status: 'pending' }),
  ];
}

export function buildOutputRunChecklist(input = {}) {
  const kind = resolvedKind(input);
  return [...optionRows(input, kind), ...topologyRows(input, kind), ...commonRows(input),
    ...originalJsonAuthorityRows(input),
    ...nativeInstrumentOwnerHoldRows(input),
    ...(kind === 'inputxml' ? inputXmlRows(input) : xmlRows(input))];
}

function artifact(kind, label, name, value, mime) {
  const available = text(value).length > 0;
  return { kind, label, available, filename: available ? name : '', bytes: available ? bytes(value) : 0, mime, downloadAction: available ? `download-${kind}` : '' };
}

export function buildOutputArtifactRows(input = {}, manifest = {}) {
  const result = object(input.result);
  return [
    artifact('enriched', 'Enriched XML/InputXML', result.enrichedName || 'enriched-output.xml', result.enrichedText, 'application/xml;charset=utf-8'),
    artifact('cii', 'CII', result.ciiName || 'output.cii', result.ciiText, 'text/plain;charset=utf-8'),
    artifact('diagnostics', 'Diagnostics JSON', 'xml-cii-diagnostics.json', result.diagnostics ? JSON.stringify(result.diagnostics, null, 2) : '', 'application/json;charset=utf-8'),
    artifact('manifest', 'Run Manifest JSON', 'xml-cii-run-manifest.json', hasResult(input) ? JSON.stringify(manifest, null, 2) : '', 'application/json;charset=utf-8'),
  ];
}

function countRows(value) { return Array.isArray(value) ? value.length : 0; }
function summaryCount(value, key) { return Number(value?.summary?.[key] || value?.[key] || 0); }

export function buildRunManifest(input = {}) {
  const kind = resolvedKind(input);
  const result = object(input.result);
  return {
    schema: 'xml-cii-2019-output-run-manifest/v1',
    sourceMode: kind,
    outputMode: input.options?.outputMode || 'enriched-only',
    nativeOutputParticipation: isXml229XmlOnlyApproved(input)?'explicit-xml-only':'governed',
    sourceBytes: sourceText(input).length ? bytes(sourceText(input)) : Number(input.sourceFile?.size || 0),
    masterRowCounts: object(input.masterContext?.rowCounts),
    regex: { matched: summaryCount(input.regexTesterResult, 'matchedCount'), rejected: summaryCount(input.regexTesterResult, 'rejectedCount') },
    resolver: { matched: summaryCount(input.resolverJsonTraceResult, 'matchedFacts'), rejected: summaryCount(input.resolverJsonTraceResult, 'rejectedFacts') },
    manualOrSideLoad: { matched: summaryCount(input.manualElementSideloadResult, 'matchedRows'), rejected: summaryCount(input.manualElementSideloadResult, 'rejectedRows') },
    previewAudit: { matched: summaryCount(input.previewDiagnosticsAuditReport, 'matchedFacts'), rejected: summaryCount(input.previewDiagnosticsAuditReport, 'rejectedFacts') },
    weightMatch: { issues: countRows(input.weightMatchResult?.issueRows), finalized: countRows(input.weightMatchResult?.finalizedRows) },
    supportMapper: { previewRows: countRows(input.supportTypeMapperResult?.previewRows), diagnostics: countRows(input.supportTypeMapperResult?.diagnostics) },
    topology: {
      analyze: input.options?.analyzeTopology === true,
      generateTopoFix: input.options?.generateTopoFix === true,
      useTopoFixForCii: input.options?.useTopoFixForCii === true,
      selectedActionIds: topologyActionIds(input),
      committed: result.topoFixCommitted === true,
      ciiInputSource: result.ciiInputSource || 'original',
      preFinalLineageReceiptAvailable: !!result.topoFixLineageText,
      freshBasisHandoffAvailable: !!result.topoFixPreFinalHandoffText,
    },
    artifacts: { enriched: !!result.enrichedText, cii: !!result.ciiText, topologyFindings: !!result.topologyFindingsText, topologyPlan: !!result.topologyFixPlanText, topoFixXml: !!result.topoFixXmlText, topoFixLineage: !!result.topoFixLineageText, topoFixPreFinalHandoff: !!result.topoFixPreFinalHandoffText, diagnostics: !!result.diagnostics, manifest: hasResult(input) },
  };
}

function runLogLevel(message) {
  if (/traceback|error|exception|^stderr:/i.test(message)) return 'error';
  if (/warning/i.test(message)) return 'warning';
  return 'info';
}

function logRows(input, checklistRows) {
  const fromResult = array(input.result?.logs).map((message) => ({ level: runLogLevel(text(message)), source: 'run', message: text(message) }));
  if (input.result?.error) {
    const ownerHold = checklistRows.some(item =>
      item.id === 'xml229-instrument-native-owner-authority' &&
      item.blocking && item.status === 'held');
    fromResult.push({
      level: ownerHold ? 'warning' : 'error',
      source: ownerHold ? 'native-release-hold' : 'run',
      message: ownerHold
        ? 'NATIVE_RIGID_OWNER_UNSUPPORTED: governed native CII held pending source classification; no CII released.'
        : text(input.result.error),
    });
  }
  const fromChecklist = checklistRows.filter((item) => item.status !== 'ready').map((item) => ({ level: item.severity, source: 'readiness', message: `${item.label}: ${item.message}` }));
  return [...fromChecklist, ...fromResult];
}

function readinessDiagnostics(checklistRows) {
  return checklistRows.filter((item) => item.blocking || item.severity === 'warning')
    .map((item) => ({ level: item.status === 'held' ? 'warning'
      : item.blocking ? 'error' : 'warning',
      source: 'output-run', type: item.id, message: item.message }));
}

export function buildStandaloneOutputRunReadiness(input = {}, {verifiedEngineering = null,sessionState = 'UNKNOWN',leaseDiagnosis = null,candidate = null} = {}) {
  // Recompose one report from one checklist. No DOM-only patches: logs, counts,
  // diagnostics and the Run button all see identical source-bound status.
  const projection = projectXml229RunChecklist(
    input,buildOutputRunChecklist(input),verifiedEngineering);
  const completion=verifiedEngineering?.proof;
  const native=verifiedEngineering?.nativeOutput;
  // After running, re-attest the result to the live original Worker Final.
  // Neither a cached CII nor a forged release flag alone unlocks the gate.
  const nativeVerified=projection.verified===true&&
    completion?.counts?.unresolved===0&&completion?.counts?.match1===0&&
    native?.schema==='XML229.GovernedNativeCandidateResult.v1'&&
    native.nativeCiiReleaseAuthorized===true&&
    native.massConsumptionVerified===true&&
    native.strictOneToOneOwnerMatch===true&&
    native.basisId===completion.basisId&&
    native.sourceId===completion.sourceId&&
    native.sourceGenerationId===completion.sourceGenerationId&&
    native.originalJsonSha256===completion.originalJsonSha256&&
    (completion.reviewSourceKind!=='XML_ONLY'||native.reviewSourceKind==='XML_ONLY'&&
      native.sourceXmlSha256===completion.sourceXmlSha256)&&
    native.physicalCount===completion.verifiedPhysicalCount&&
    native.finalIntentSha256===verifiedEngineering?.finalIntent?.intentSha256&&
    native.actualCiiSha256===input.result?.xml229ActualCiiSha256&&
    input.result?.ok===true&&input.result?.ciiText===native.ciiText;
  const releaseRows=projection.rows.map(item=>
    nativeVerified&&item.id==='xml229-original-json-engineering-authority'
      ?{...item,status:'ready',severity:'ok',blocking:false,
        message:'Current accepted masses were consumed by generated native CII (including confirmed 0 kg). Every original physical maps to one native ELEMENTS → RIGID pointer and a matching emitted mass. CII SHA '+native.actualCiiSha256+'.'}
      :item);
  // The native-release HOLD is a policy boundary, not a diagnosis that
  // Weight is missing. Attach a separately derived first-unverified boundary
  // to the exact same canonical report, never to a DOM-only replacement row.
  const holdAudit = buildXml229RunHoldAudit({
    input,report:{checklistRows:releaseRows},sessionState,leaseDiagnosis,candidate,
    sessionReceipt:verifiedEngineering?.sessionReceipt,
    completion:verifiedEngineering?.proof,
    finalIntent:verifiedEngineering?.finalIntent,
    finalIntentReadError:verifiedEngineering?.finalIntentReadError,
    readError:verifiedEngineering?.readError,
  });
  const verifiedMass=verifiedEngineering?.proof?.counts;
  const massMessage=verifiedEngineering?.proof?.schema==='XML229.P4.RunAdvisory.v1'&&
    verifiedEngineering.proof.basisId===verifiedEngineering.sessionReceipt?.basisId&&
    verifiedMass&&Number.isSafeInteger(verifiedMass.unresolved)&&
    Number.isSafeInteger(verifiedMass.match1)&&Number.isSafeInteger(verifiedMass.final)
    ?verifiedMass.unresolved>0
      ?verifiedMass.unresolved+' original physical(s) still need Applied Weight. '+
        'Assign a positive kg or explicitly confirm zero in Weight Match. '
      :verifiedMass.match1>0
        ?verifiedMass.match1+' physical(s) have Match-1 only; an Owner Final is required. '
        :'Current Worker reports accepted Final masses; no missing mass is implied. '
    :'Current original-source engineering completion is not verified. ';
  const checklistRows = releaseRows.map(item=>
    item.id==='xml229-original-json-engineering-authority'&&item.blocking
      ?{...item,message:massMessage+item.message+' '+
          'Governed native CII release is HELD pending independent full output/child-lineage proof. '+
          'This is a release-policy HOLD, not an exception from the converter. '+
          'Diagnosis: '+holdAudit.diagnosisCode+'. See Run HOLD audit.',
        detail:JSON.stringify({schema:holdAudit.schema,diagnosisCode:holdAudit.diagnosisCode,
          firstUnverifiedBoundary:holdAudit.firstUnverifiedBoundary})}
      :item);
  const manifest = buildRunManifest(input);
  // Do not advertise stale governed CII bytes before a new current-Worker
  // Final-intent check approves the exact generated output.
  const artifactRows = buildOutputArtifactRows(
    hasOriginalJsonSourceOnlyRunHold(input)&&!nativeVerified
      ?{...input,result:null}:input,manifest);
  const blockingCount = checklistRows.filter((item) => item.blocking).length;
  return {
    summary: {
      sourceMode: resolvedKind(input), blockingCount,
      warningCount: checklistRows.filter(item => !item.blocking && item.status !== 'ready').length,
      incompleteStageCount: checklistRows.filter(item => !item.blocking && item.status === 'missing').length,
      checklistCount: checklistRows.length,
      artifactCount: artifactRows.filter(item => item.available).length,
    },
    checklistRows,
    artifactRows,
    logRows: logRows(input, checklistRows),
    manifest,
    diagnostics: readinessDiagnostics(checklistRows),
    runHoldAudit:holdAudit,
    raw: { resultOk: input.result?.ok === true, sourceKind: input.sourceKind || 'auto',
      xml229VerifiedEngineering: projection.verified,
      xml229NativeOutputVerified: nativeVerified,
      xml229XmlOnlyOutput: isXml229XmlOnlyApproved(input) },
  };
}

