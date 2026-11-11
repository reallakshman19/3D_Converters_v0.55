# PR378 — XML229 base XML→CII independent of optional enrichment

HANDOVER_READINESS: READY_FOR_DRAFT_REVIEW
PR_RECOVERY_STATE: DRAFT_PUBLISHED_VALIDATION_PENDING
WORK_INTENT: IMPLEMENT
CRITICALITY: ENGINEERING_CRITICAL (source/CI candidate boundary)
TAKEOVER_AUTHORITY: NOT_APPLICABLE_NEW_OWNER_DIRECTED_ASSIGNMENT
EXECUTION_MODE: MANUAL
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED
REPOSITORY: reallakshman19/3D_Converters
PR_URL: https://github.com/reallakshman19/3D_Converters/pull/378
SOURCE_ISSUE: https://github.com/reallakshman19/3D_Converters/issues/376
BRANCH: fix/xml229-preview-substage-timing-20261101
BASE_MAIN: 2477a6fdee1002d5063bc51e94777ba940e6fa82
IMPLEMENTATION_BASIS_HEAD: ea60bb5557682ef3ee6bcc07788ce2c7d1e07920
REPORT_BASIS_HEAD: ea60bb5557682ef3ee6bcc07788ce2c7d1e07920
COORDINATION: COORDINATION_REQUIRED; open legacy #260 overlaps canonical GC-PW Worker, #253 Preview integration, #371 adjacent native BM2.
CURRENT_STAGE: DRAFT_PUBLISHED
HIGHEST_RISK: broad native/source authority regression not yet tested in real browser; proposed raw route must not discard accepted masses or selected staged JSON.
EXACT_NEXT_ACTION: run focused Node J04, full original XML/no-master, single-master, all-master Chromium original Preview and direct/native conversion; inspect only PR378 exact code and update this report on any failures; coordinate #260 before any merge.

## Owner's authoritative core concept (2026-11-01)
XML→CII base conversion must occur even if Line List, Piping Class master or Material Map is missing, even when Line Key/Piping Class regex is missing or conflicting. These masters are optional ENRICHMENT ONLY. Rating token is always optional. Two conflicting configured Format identities must cause TWO separate 4 Preview review passes, neither silently accepted. Preserve legitimate engineering source, mass, native geometry and output-release gates separately. This supersedes the initial Preview-timing-only WIP mission. Timing/optimization remains issue #376 follow-up, not implemented here.

## Production trace (verified SOURCE_INSPECTION)
- tabs/.../xml-cii-workflow-service.js previously returned blockedRunParityResult before native invocation when `auditConfiguredBranchFormats(...).blocked`, and again when parity Preview format facts were unqualified.
- The output checklist already marks `branch-format-authority` a nonblocking enrichment warning (`blocking:false`).
- The legacy Preview core already computes `formatPreviewPasses` separately for conflicting enabled formats, and renderer.js already draws two read-only pass tables.
- The current original verified GC-PW Worker created `verifiedPreviewResult` from `computed.branchRows/nodeRows` but omitted `computed.formatPreviewPasses` so the normal Worker-backed Preview UI never received the two independent reviews.
- Branch-format extractor already requires only Line Key and Piping Class for its matched identity; Rating is optional and absent Rating cannot create format ambiguity by itself.

## Code at ea60bb5557682ef3ee6bcc07788ce2c7d1e07920
1. xml-cii-workflow-service.js (+docs identical):
   - Existing direct API format audit retained, but unresolved optional formats now route to the UNCHANGED engine with original XML and an empty optional support configuration; no Preview candidate is promoted.
   - When no imported masters and no explicit multi-format config, direct base XML is also executed without master enrichment.
   - If *post-Preview* enrichment identity conflicts, original XML is used rather than unqualified parity-enriched XML.
   - Selected stagedJsonText is retained; Python staged-position ambiguity still fails closed.
   - A native Final packet or accepted rigidWeight override prohibits dropping accepted mass inputs through raw fallback; governed review/packet remains separate.
   - Diagnostic `optionalEnrichment` reports WITHHELD/reason and explicitly indicates it grants no native release.
2. xml229-original-blob-gcpw-worker.mjs (+docs identical):
   - returns `computed.formatPreviewPasses` alongside authoritative original-source Preview rows; read-only presentation only, no effect on engineering FactRecords, physical census or Final decisions.
3. tests/xml-cii-j04-service-release-gate.test.mjs:
   - Replaced the two old requirements that optional conflicts block conversion, retaining all original independent population/identity audit tests.
   - New transport tests assert original XML preserved, absent masters start native engine, staged JSON is preserved, source-bound Final packet cannot be dropped, conflicting parity XML is not sent to native engine.
   - Synthetic stub CII is explicitly a transport oracle, not real native proof.

## Protected invariants / negative assurance
No edits to branch-format extraction, Regex Tester editor/persistence, master values, rating, material, weights, accepted Final CAS, native writer/Pyodide, source units, topology, native independent CII parser, or selection. Raw fallback uses original XML and does not auto-pick Format 1/2; all old enrichment fail-closed audits still report their own conflicts. No stashed approved kg is applied to a newly changed InputBasis. The implementation is a *first scoped candidate*, not final engineering acceptance.

## Incomplete acceptance / risks
- RISK-1: source-bound Final packet requiring raw fallback remains explicitly HELD. This is intentional; cannot safely strip accepted masses just to produce CII.
- RISK-2: selected JSON may still fail mandatory position binding, independent of optional masters and regex.
- RISK-3: no exact Owner loaded staged JSON, format configuration or four-master bytes in GitHub tests supplied to this session.
- RISK-4: no real Chromium/production native execution of this HEAD; code must remain draft.
- RISK-5: direct-service optional master subset coverage is not yet real-browser validated; don't claim all combinations PASS.
- RISK-6: #260 overlap includes Worker path. Coordinate before integration.
- RISK-7: branch name contains legacy "preview-substage-timing" from the initial WIP; issue/PR/report define superseding approved scope unambiguously.

## Validation evidence
- SOURCE_INSPECTION / PASS / analytical: original format gate mismatch and pass handoff omission reproduced on main SHA.
- GIT_OBJECT_CHECK / PASS: source/docs modified file blob SHA identical by using same content for each path; old original blobs backed up before edits.
- ROOT/DOCS runtime parity / NOT_RUN: only byte-equality is asserted, not browser behavior.
- TARGETED_NODE / NOT_RUN as of implementation head (no full clone/DNS in this session); expected scripts: `node --test tests/xml-cii-j04-service-release-gate.test.mjs`, `node --test tests/xml-cii-j04-multi-format-preview.test.mjs`.
- CHROMIUM real EF05 41-branch Preview two passes / NOT_RUN.
- ALL 0/1/3 MASTER CARDINALITIES actual native CII / NOT_RUN.
- INDEPENDENT native CII mass/geometry/full-output reconciliation / NOT_RUN.
- GitHub Actions: initial workflow checks queued/in-progress; one unrelated job passed, *overall green not claimed*.
- Independent reviewer/Owner engineering acceptance / NOT_RUN.

## Changed-file ledger
- Production exact: `tabs/xml-cii-2019-standalone/xml-cii-workflow-service.js`; `tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs`
- Mirrors: `docs/tabs/xml-cii-2019-standalone/xml-cii-workflow-service.js`; `docs/tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs`
- Regression: `tests/xml-cii-j04-service-release-gate.test.mjs`
- Nine exact baseline backups in `.backups/20261101-issue376/` (producer, Preview button, worker, service and tests; some producer/button backups are conservative and unedited).
- Recovery report: initial `agents/WIP-XML229-PREVIEW-TIMING-20261101_workreport.md`, superseded by this current PR report.
- PR status and claim in `agents/status/PR378.yaml` / `agents/claims/PR378.yaml`.
All paths belong to this one PR, no other branch edited.

## Coordination and release
Do not merge, rebase, auto-merge or deploy. Exactly open PR378 for engineering review. Open old PR260 has overlapping files, so coordination required. Fix-02 stage-position diagnostics, run-hold UI, performance optimization and broader architecture in issue #376 are NOT INCLUDED in this PR. Direct native result is not release evidence. Keep PR as DRAFT.

## Continuation
The first actionable next command in a complete checkout is `node --test tests/xml-cii-j04-service-release-gate.test.mjs tests/xml-cii-j04-multi-format-preview.test.mjs`. Review root/docs parity and CI exact head, inspect any failed test, then run actual EF05 4 Preview and real XML-only conversion with no and partial masters and selected JSON negative guard. Do not amend independent expected values to hide failures.

## Post-publication guard tightening — ea60bb5557682ef3ee6bcc07788ce2c7d1e07920
The first PR code did not sufficiently guard manually authored Preview facts/support mappings on the raw route. A subsequent exact-head commit now rejects fallback rather than silently dropping job/manual/Preview/supportMapper facts or nonempty config overrides. It retains all non-master source configuration fields (including dtxrPositionOffset geometry/JSON calibration) while deleting only optional master-derived formatting/mapping fields. Two focused transport tests were added for authored fact refusal and preserving coordinate calibration. The source/docs mirror code remains byte-identical. This refinement changes no native mass authority or staged JSON failure policy.

Exact-head current CI sampled immediately after ea60bb5557682ef3ee6bcc07788ce2c7d1e07920: workflows QUEUED; no complete acceptance claimed. Additional Node/Chrome/native output validation remains NOT_RUN in this session. The legacy WIP and PR report reflect scope supersession from timing-only plan to optional enrichment. Do not change another PR to address this.


## Full EF05 end-to-end qualification — exact tested code head 182218290fbce6624d322ffb156434c8eb567100
The draft is **not authorized for merge**. 2026-11-02 GitHub Actions run https://github.com/reallakshman19/3D_Converters/actions/runs/41361694868 checked out this exact head and used a local isolated HTTP server + actual Chromium + native Pyodide/Python engine.

### PASS — user-facing no-master XML-only conversion (actual browser clicks)
- Source: `Benchmarks/EF-05-PRO.TEST.xml`, SHA256 `2573883480af904096dea2663c9cf585be2db28dd047785397b4d61edee0a030`, 898252 original bytes, 41 branches, 1654 nodes.
- Fresh page: source XML file selection -> Output/Run -> explicit XML-only participation -> Run -> browser CII download -> downloaded file independently checked by `converters/scripts/cii_syntax_check_2019.py`.
- `XML229_ISSUE376_REAL_UI_DOWNLOAD`: PASS, filename `EF-05-PRO.TEST_xml_to_cii2019_standalone.cii`; 1,540,393 B, 600 ELEMENTS, 16,380ms elapsed, SHA256 `b4b563854f5ad647cd72d8a985436961a855b0a5f731c7b2a50f06eea227e32a`. No master imports, no selected staged JSON, no governed Final release.
- Source-safe CI artifact: https://github.com/reallakshman19/3D_Converters/actions/runs/41361694868/artifacts/13104973673; JSON `stages.issue376UiXmlOnly`. Original full E2E JSON root has `ok:false` because *later* combined Weight advisory step fails; per-phase PASS is independently witnessed.

### PASS — browser Worker native with optional formats
Same exact browser run: real JavaScript service -> Worker -> Pyodide -> CII generated for both zero-masters and two conflicting enabled formats; both independently syntax PASS, same CII digest, 600 elements, 183 RIGID, `nativeReleaseNotImplied:true`. Exact log markers `XML229_ISSUE376_REAL_BROWSER_NATIVE`, `stages.issue376BrowserNative`.

### PASS — seven-case real Python source conversion and two Preview review passes
GitHub P1 focused tests run https://github.com/reallakshman19/3D_Converters/actions/runs/41361694602 SUCCESS. The tests include `tests/xml229-issue376-source-native-matrix.mjs`, using real 41-branch XML, real native Python converter and independent CAESAR II 2019 syntax checking with zero, Line List only, Piping Class only, Material Map only, all three loaded without configured format, conflicting enabled Format 1/2, and absent optional Rating. All seven yield identical CII SHA. Two independent read-only Preview format passes exist, no silent selection or required Rating. This is a source/config test, not proof of full private Owner configurational coverage.

### EXPECTED FAIL CLOSED — selected JSON
Actual native use of the public 14.5 MB staged JSON rejects `XML229_STAGED_POSITION_AMBIGUOUS`. This independent position-owner failure remains explicitly unresolved and was not suppressed by #378. Governed engineering Final mass acceptance and independent native release remain separate.

### FAIL — original combined full UI journey
In [workflow #41361694868](https://github.com/reallakshman19/3D_Converters/actions/runs/41361694868), the existing full UI path loaded all 41 branches, four masters and original indexed JSON, ran verified Preview (41 branches) and opened GC-PW Weight review. It then failed `locator.waitFor` at `[data-p4-weight-root] [data-p4-instrument-advisory]`. Therefore the full Action job FAIL is **correct**, even though the separately witnessed XML-only click/download PASS is real. Do not weaken or skip the original independent test to make the workflow green.

### Scope and remaining acceptance
- Main implementation: `xml-cii-workflow-service.js` fallback with original source only, never promoting conflicting enrichment; matching `docs/` mirror; GCPW Worker passes through display-only Format review passes, matching mirror.
- Test code: `tests/xml-cii-j04-service-release-gate.test.mjs`, `tests/xml229-issue376-source-native-matrix.mjs`, `scripts/xml229-issue376-browser-native-probe.mjs`, `scripts/xml229-issue376-ui-click-e2e.mjs` and extra probes in `scripts/xml229-ef05-native-output-e2e.mjs`.
- Tests are intentionally **before** the original legacy Weight advisory, so their positive evidence is not suppressed by that independent failure; the old failing assertion remains intact.
- Not yet independently proved: XML+JSON with unambiguous mandatory claims and Final approved masses, full Owner-configured Format 1/2 **visible** two-pass UI conflict, independent CII physical/geometry/mass Release; Preview slow phase optimization. Do not claim them solved.
- Active PR #260 exact Worker overlap and #253 Preview nearby; coordination required before merge. No native runtime/writer/units change, no master data change, no workflow edit and no deployment.

Validation register: [PASS/REMOTE_EXECUTION/INDEPENDENT_REPRODUCTION] full UI XML-only downloaded .cii and independent syntax; [PASS/REMOTE_EXECUTION/INDEPENDENT_REPRODUCTION] Chromium native two cases; [PASS/REMOTE_EXECUTION/INDEPENDENT_REPRODUCTION] 7 real native Python cases; [PASS/REMOTE_EXECUTION/IMPLEMENTATION_COUPLED] two format passes; [EXPECTED_FAIL/REMOTE_EXECUTION/SAFETY_GUARD] source+JSON ambiguous staged position; [FAIL/REMOTE_EXECUTION/EXISTING_GUI_INTEGRATION] instrument advisory not visible; [NOT_RUN] independent governed Final source→native mass/geometry release.

EXACT_NEXT_ACTION: do **not** merge; keep #378 draft. Coordinate PR260 overlap and review code at tested head 182218290fbce6624d322ffb156434c8eb567100; independently resolve legacy instrument-advisory CI issue under separately approved scope and exercise real Owner private staged JSON+accepted Final packet before native release. Maintain issue #376 for the wider RCA and performance investigation.
