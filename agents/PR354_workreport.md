# Native enriched XML download — current recovery

Owner task (29 October 2026): allow download of the enriched XML artifact; current row shows available=false, filename empty, bytes0. Governing Page: CIIFR R4 WBS6/M27, native XML inspection follow-up. KEEP the existing WBS; no parallel programme. Direct Owner + builder, original author, new implementation assignment (not a PR takeover).

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
MUTATION_AUTHORITY: WRITE_ALLOWED
CRITICALITY: ENGINEERING_CRITICAL (artifact publication)
MAIN_HEAD_LAST_CHECKED: 59df118588837f70ca22dfe0d0573ef874e07dd0
REPORT_BASIS_HEAD: bdd5e581d7c3cc9f6b719454c3a75d395dbc5d3a
CURRENT_STAGE: REVIEW_PENDING
EXACT_NEXT_ACTION: review PR354 and applicable CI policy; after Owner merge/deployment rerun the model and click Download Enriched XML/InputXML.
HIGHEST_RISK: publishing stale source/Final XML or presenting a separately enriched original as the actual native input.

## Live grounding and diagnosis

Main tree15f44df contains PR352 bore fixes. PR353 was merged into its feature base after PR352 had already merged into main; its restraint changes are not in this main tree. This task does not silently integrate that separate branch. All open PRs checked; older #329/#312 overlap engine/native result orchestration but remain untouched. Their existing writer/mass/release guards on current main are preserved. No MASTER_INDEX in source tree. No new workflow changes, runtime/writer switch or source fixture edits.

Current governed candidate forces outputMode=cii-only; engine returns empty enrichedText. Even if an XML existed, candidate and native UI action discard its fields. Result: actual output artifact row remains empty. Simply requesting both would independently enrich original XML and omit Final mass binding, so that is not the requested native inspection artifact.

## Scope and invariants

Export a byte copy of the actual runtime XML after enrichment/geometry checks/accepted mass binding and before CII parsing/serialization. Optional CLI output path, absent by default for old CLI users. Native engine supplies a unique per-job path and reads it only if produced. Retain available XML on later converter/reconciliation failure, with current source and current Final intent guards. XML availability does not authorize CII; failed result has no CII text or release flag. No auto XML download; existing explicit artifact button uses populated filename/text/byte count.

Validation required: real Python CLI exported XML has actual accepted kg; failure after binding retains XML; pre-binding failure produces none; invocation path and engine partial result wiring; real native UI action publishes XML on success and held failure, discards stale source/Worker output, existing output artifact row becomes available. Existing native mass/action suites and source/docs mirrors. Browser/Owner session NOT_RUN until executed. No engineering/native import acceptance claim.

## Intended file ledger and future takeover

Patched CLI parser+mirror (optional export path); runtime custody+mirror (copy actual input); invocation+mirror (job path); engine+mirror (read artifact on success/failure); candidate+mirror (carry fields with freshness); native action+mirror (publish explicit artifact); focused native/UI regressions; this report/status/claim. Incoming implementer must independently trace the actual bound XML path, reproduce absent artifact, prove Final/source freshness and no CII HOLD bypass, run export/native tests, and identify the minimal next patch. No independent self-score is claimed.

## Candidate checkpoint

LOCAL_EXECUTION / AUTHORITATIVE_REFERENCE: real Python native converter exports actual bound XML with Weight12.5 rather than original0, unchanged source identity/position; independently parsed by ElementTree. Explicit downstream CII writer fault leaves XML and no CII. Wrong source SHA publishes no XML; output path collision refuses to overwrite original bytes. Four cases PASS.

LOCAL_EXECUTION / IMPLEMENTATION_COUPLED: real native action/state wrappers and artifact row: XML available=true, filename populated, correct UTF8 bytes, download-enriched enabled on successful native run and held CII failure; no CII fields/authorization leak; stale source refuses XML; explicit XML download, automatic CII behavior unchanged. Existing action and actual CLI suites plus new regressions:26/26 PASS. Existing native Final mass suite24/24 PASS. Seven source/docs pairs byte-identical. Initial CLI-test attempt was NOT_RUN due absent host /tmp; rerun with task-local TMPDIR passed. No browser or Owner trial claimed.

Changed-file ledger: 7 production files and their7 mirrors, existing CLI/action test entries, new JS/Python export regression files, report and claim =20 paths. All paths intentional; no workflow or source fixture changed. Optional CLI output is passive publication, never an alternative native runtime or writer.

CURRENT_STAGE: VALIDATED_LOCAL
EXACT_NEXT_ACTION: fetch exact-head CI after draft PR publication; native import/Owner session still NOT_RUN.

## Exact implementation-head evidence (bdd5e581d7c3cc9f6b719454c3a75d395dbc5d3a)

REMOTE_EXECUTION: native-python-source-transfer PASS; independent-js-cii-mass-check PASS on Node22 and24 (run40871148130); actual Preview PASS (run40871148166); EF05 real native e2e PASS (run40871148285). Existing-stages-browser remained in progress at the last observation. CI overall is NOT green: historical qualification guards fail. Logs123438224610/123438223691/123438220166 inspected separately; no workflow policy is weakened in this PR.

LOCAL_EXECUTION of the full current-main public PL-BM1 Preview/Worker plus actual Python CLI:98 physical owners, all effectiveKg explicitly set0 only for this controlled test (not Owner decisions); exported PL-BM1_enriched.xml904297bytes/1586 retained nodes; native proof sourcePhysicalCount98, massesConsumedInNativeRigid=true, nativeCiiReleaseAuthorized=false. Source bytes read from the existing public fixture. This extends the small12.5kg test; it does not certify the Owner's live session.

Reconciled20 intended PR paths against GitHub list. No unexplained path. Canonical recovery moves to agents/PR354_workreport.md; WIP files remain historical pointers. Only recovery metadata follows the tested implementation head. Source/docs code stays byte-identical.

EXACT_NEXT_ACTION: independently review PR354; Owner may merge the concrete candidate after resolving applicable review/CI policy. Then rerun the current model and click Download Enriched XML/InputXML. No merge authority granted to this agent.

## Final recovery reconciliation

All implementation-head checks finished: existing-stages-browser also PASS. Native/Preview/EF05 checks above apply to the unchanged implementation code; later commits contain recovery metadata only. Final GitHub changed-file census23 =20 original intended paths +canonical PR354 report/status/claim. Historical WIP pointers remain intentional. No unexplained files. CI overall still contains the documented historical guard failures. Current report/header and exact next action are reconciled; HANDOVER_READINESS=READY.
