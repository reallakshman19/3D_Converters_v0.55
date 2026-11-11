# PR361 — Explicit configured branch format participation
REPORT_BASIS_HEAD: 81080af8569057a08f1fa6d4dddadc4ae7ca6313
Builder: Owner-assigned6ae1bed6; same-builder continuation, not takeover.
WORK_INTENT IMPLEMENT; REPOSITORY_STATE EXISTING_PR; MUTATION_AUTHORITY WRITE_ALLOWED; CRITICALITY ENGINEERING_CRITICAL.
CURRENT_STATE SUBMITTED_REVIEW_HELD; draft OPEN. Production/test bytes validated at above head. Any later containing commit is recovery-only unless this report explicitly says otherwise.

## Handover in 60 Seconds
Owner's latest audit: all195Final, zero unresolved, native candidate NOT_REACHED, execution blocker branch-format-authority. All41branches are AMBIGUOUS: correct Format1 P8810021 / 31441C4 / 300 / 8 competes with Format2 31441C4 / PP / blank / 8. This is not the earlier source-model or manual click-handler fault.
Implemented a visible checkbox per format, lossless boolean normalization/writeback, shared exclusion honoring disabled first slot too, and legacy projections from first enabled format. No automatic choice or silent config reset.
35 local checks PASS;59 remote regex regression checks PASS; actual root/docs Chromium41branch disable/save/reload/re-enable/all-disabled PASS, no page errors.
Exact work: /workspace/scratch/8570fe275718/suggestion-fix/repo; fix/xml229-explicit-format-enable-6ae1bed6.
Highest risk: claiming a config prerequisite repair establishes Owner CII output or that old accepted Final transfers across a changed engineering basis. Neither is established.
EXACT_NEXT_ACTION: Owner/reviewer inspect exact production diff and15historical preflight failures; merge/deploy only with explicit Owner authorization. After deployment disable only the unused format, save, rebuild Preview and follow current Weight readiness before native Run.

## Live repository truth / coordination
Base/main d98723600c11df8fa13f010cb1080b9eb76d2749, re-read unchanged after browser evidence. Branch directly based on main; no base drift. Initial17changed files reconciled exactly against PR API; canonical recovery allocation adds3new records and forwards3WIP records (20total expected).
PR360 externally merged and deployed; its listener/source activation production paths are untouched here.
Live open PR346 topology,335 short elements,329 runtime/orchestration,315 editable drafts,312/311 native ownership,308 tests and older workstreams inspected. September Regex claim survives ACTIVE in main but no corresponding live open PR; stale predecessor claim is not evidence of current activity. No MASTER_INDEX in live tree.
SAFE bounded participation repair. Shared state module overlap with old PR315/329 is disclosed; only regex-format-enabled branch added. Their branches, runtime, Final and native interfaces untouched. Same-builder continuation; no self-scored takeover exam.
Review API: no submissions, no inline threads observed at tested source head.

## First wrong boundary / diagnosis
ISS-1 USER_SUPPLIED: both configured positional formats return nonempty identity fields; conflicting interpretations correctly HOLD. We do not know how the shifted mapping entered Owner config.
ISS-2 SOURCE_INSPECTION and RED LOCAL_EXECUTION: mergeConfig dropped format.enabled; Save Config silently reintroduced excluded candidates.
ISS-3 SOURCE_INSPECTION and RED LOCAL_EXECUTION: unusedAlternativeTemplate returned for index0 before testing enabled:false, so first-slot exclusion was ignored.
ISS-4 SOURCE_INSPECTION: editor tab selected the rules to edit; no control explicitly selected their participation.
Prediction/falsifier: an explicit Format2 exclusion must survive UI save, committed nested/root arrays and reload, and resolve all41 through shared extraction/Run. Re-enable must restore conflicts; all-disabled must be UNMATCHED. All observed PASS in real browser.

## Implementation / decisions
DEC-1 Preserve existing configured formats with absent flag; do not silently disable an authored alternative. Existing untouched alternative template remains unconfigured.
DEC-2 Explicit enabled:false excludes any index, including0; enabled:true deliberately activates even an untouched template.
DEC-3 Shared isBranchFormatEnabled determines extraction and checkbox state. Normalization preserves booleans without synthesizing flags. Both committed config arrays retain them; legacy projection uses first enabled format.
DEC-4 UI uses existing production updateRegexTesterConfig → runStandaloneRegexTester → applyStandaloneRegexTesterResult, including normal config dependency invalidation. No private Final/backup copied.
DEC-5 Existing genuine disagreements remain AMBIGUOUS. We neither prefer Format1 nor validate a line/class by guessing master membership.
No runtime/writer, geometry/topology, support, master, kg/scoring, physical-owner, source revision, native output or workflow edits.

## Validation ledger
All results below use production/test bytes at 81080af8569057a08f1fa6d4dddadc4ae7ca6313; local node24 and remote checkout exact head.
- PASS LOCAL_EXECUTION / analytical source labels + implementation-coupled regression:35cases across new4checks, live Regex interaction acceptance, Run format diagnostics, actual Preview multi-format and shared extractor. Disabled Format2 resolves41; disabled first picks valid alternative; all-disabled/empty/conflicting remain held; legacy/multi-format behavior and original config preserved.
- RED before patch:3newcases failed on dropped false, disabled first ignored and all-disabled remained AMBIGUOUS. Resolved by PR. No expected engineering answer/tolerance weakened.
- Initial local acceptance missing sparse smart-ui source dependency: NOT_RUN that check; fetched exact main dependency and reran35PASS. Product failure not claimed.
- PASS SOURCE/ARTIFACT_INSPECTION:syntax, five root/docs pairs,14prod/test path whitelist.
- PASS REMOTE_EXECUTION / actual Chromium production UI: job124523361363 (regex-bounded-evidence-scale) logs exact81080af8; root/docs each41occurrences,41resolved,41re-enabled conflicts, persisted=true, allDisabledHeld=true, runtimeErrors=[]; existing10k/50k/100kscale checks also PASS. Local Chromium NOT_RUN (binary absent), no mock browser claim.
- PASS REMOTE_EXECUTION: regex-master-evidence job124523361185:43+13+3tests,0fail.
- PASS REMOTE_EXECUTION: branch-formats124523361159, Full-occurrence Format2/custody124523361348, p1-regex-and-run-authority124523360502.
- PASS REMOTE_EXECUTION: EF05 actual native XML-only E2E124523361464: public41branch XML +14.5MB original JSON +4masters; actual downloaded CII599elements1667596bytes; explicit XML-only route. Governed unresolved source correctly HELD; NOT Owner governed approval.
- PASS REMOTE_EXECUTION: existing-stages-browser124523361481 fully completed11:26:42Z: Weight cancellation recovery, original Preview→Weight and public EF05 original JSON stages. No failure.
- CI completed snapshot:71PASS,15FAIL,0running (86jobs). All15failure logs individually inspected:13old4f14beb merge-base pins; C05.1 qualification-only changed-path allowlist; C05.5.4 only-workflow-file fence vs old8eebbc base. PREEXISTING restrictive preflight, product tests not reached. Workflows untouched; no blanket all-green claim.
- Progress page local:105NodePASS; Python41PASS/1skip; native CLI schema/history checkPASS. Initial static WBS membership expectation omitted newly addedM34; explicitly updated list to include6.10 and reran105PASS. No engineering oracle changed.
- NOT_OBSERVED: Owner's exact current persisted config or governed native CII after applying exclusion; source receipt does not establish it.

## Changed-file ledger
- converters/xml-cii2019-core/branch-format-extraction.js
- tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js
- tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js
- tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-tester.js
- docs/converters/xml-cii2019-core/branch-format-extraction.js
- docs/tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js
- docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js
- docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-tester.js
- tests/xml-cii-issue-781-live-regex-acceptance.test.mjs
- tests/browser/xml-cii-issue-781-live-regex-acceptance.html
- tabs/xml-cii-2019-standalone/ui-adapted/xml229-regex-format-control.mjs
- docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-regex-format-control.mjs
- tests/xml229-explicit-format-enable.test.mjs
- tests/xml229-explicit-format-browser-cases.mjs
Ten production paths=five mirrored pairs; four test paths. New browser cases imported into existing CI harness and4pure tests imported by existing Node entry. No workflow edits.
Six recovery records: agents/PR361_workreport.md, status/PR361.yaml, claims/PR361.yaml;3WIP forwarders.
Existing edited paths backed up via utils/backup.js; backup files not committed.

## Progress page / public evidence
Existing Page PR84, branch pp/ciifr-production-return-6ae1bed6, updated head56ea92738c2508acd9091bedf28c53431660ea5c. WBS6.10/M34 added under existingWBS6; no duplicate project/rootWBS. New format card and frozen Test page comparison link PR361. Audited native CLI events0546–0550 appended, prior events retained. PR360 deployed predecessor distinguished from current41branch blocker. Page PR remains unpublished with material base drift; no merge/deploy claimed.
Private source/audit, Ownerkg and private CII not published.

## Open risks / review / release
RISK-1 Owner config changes can invalidate engineering basis; follow production Preview/Weight readiness. No silent preservation/transplant of accepted Final.
RISK-2 Format2 may genuinely apply to different branch families; Owner explicitly disables only if unused, or scopes/corrects regexes. Real multi-format resolving tests retained.
RISK-3 Main deployed PR360 does not contain this repair until PR361 is reviewed/merged/deployed.
Merge authority OWNER_ONLY_NOT_GRANTED. No merges attempted.

## Appendix A / continuation
Same assigned builder; takeover scoring NOT_APPLICABLE. Successor begins read-only, re-grounds live head/diff/claims, traces checkbox→saved config→shared extractor→Preview/Run with opposite cases, and qualifies before engineering-sensitive edits.

## Closure checkpoint
Final reconciliation:20paths expected after canonical allocation, main unchanged, no reviews/threads. All production/test blobs remain exactly those executed at81080af8; following commit changes six recovery records only. CI15failure logs inspected individually, no introduced product failure observed. No merge/deploy, Owner governed output or Page publication claimed.
