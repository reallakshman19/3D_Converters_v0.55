# XML229 component and connected-port bore repair

## Current recovery state

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED_NEW_OWNER_ASSIGNMENT
SOURCE_TASK: #351, direct Owner "do it" on 29 October 2026
MAIN_HEAD_LAST_CHECKED: 9ad61417dbd3c473b4e6c0f6fa1aa8eb6005221b
REPORT_BASIS_HEAD: 9ad61417dbd3c473b4e6c0f6fa1aa8eb6005221b
BRANCH: fix/xml229-component-port-bore-6ae1bed6
CURRENT_STAGE: BASELINE
APPENDIX_A_STATUS: NOT_REQUIRED_NEW_WORK_ITEM; this author produced the original RCA, no PR takeover
CURRENT_BLOCKER: NONE
HIGHEST_RISK: selecting a small takeoff diameter must never resize the main-run occurrence of a shared node.
EXACT_NEXT_ACTION: reproduce the PL-BM1 component fact and native takeoff edge, then change only their first wrong authority boundaries.

## Mission and boundaries

Owner requested production-fix PRs for findings #350 and #351. This PR is #351 only. The sibling restraint PR covers existing Progress Page R4 WBS 6.1–6.3. Extend the same governing Page for the bore repair rather than introducing a separate programme. Task-decomposer decision: SPLIT by native engineering mechanism and independently runnable benchmark; KEEP existing WBS 3/4/5/6. No merge authorization.

Expected observable behavior on actual revamped PL-BM1.xml: valve finalized nodes 12370–12380 publish DN250 from their own OD273; native OLET edge 12260–3610 emits OD60.3 from the connected DN50 port while the parent run remains OD323.8. Source occurrence, coordinates, owner population, Final masses and release gates remain unchanged. No hard-coded benchmark identifiers in production, regex policy rewrite, source file edits, or workflow changes.

## Grounding / coordination

The current main and all 89 open PRs were read on 29 October. No repository MASTER_INDEX.md exists. Old claims PR348/349 remain marked ACTIVE in main but their PRs are merged; these are historical custody, not a live lock. Bore index WIP claim is RELEASED and its predecessor PR is not in the live open set. PR260 overlaps the canonical fact producer as an old source-attestation draft; current main already incorporates and advances that producer. This repair starts fresh at main and preserves all of its identity/population checks. PR329/312 overlap native orchestration; their branches are untouched. PR335 changes patched short-element simplification, not the base diameter selector. PR346 changes only the separate topology workspace. Classification: SAFE for this bounded current-main follow-up; recheck before publication.

Local workspace is a verified sparse materialization, not an upstream clone: every baseline file was matched against Git blob SHA (including recovered CRLF bytes). API commits will use the complete current-main tree as their base, so omitted local files cannot become deletions. Local git HEAD is not an upstream SHA.

## Diagnosis and falsifier

ISS-351A: canonical producer uses branch computed.sizeMm although matched source-original Preview node already has the correct bore. Use the occurrence-bound authority; absent or conflicting evidence must not become branch-certified physical data.

ISS-351B: native edge OD defaults to FROM OLET. Its endpoint3→endpoint0 leg shares the endpoint0 node/position with a separate BRAN inlet carrying the small OD. Carry the qualified connected-port dimension on that edge, without mutating either node. Missing evidence retains historical behavior; conflicting connected port ODs must fail closed. Falsifier: a different position, main-run leg or unrelated reference must not acquire the child OD.

## Validation ledger

Historical RCA #351 independently extracted original source dimensions and reproduced both wrong boundaries. Current candidate checks: NOT_RUN at this checkpoint. Required: actual PL source/canonical fact regression; actual native CII ELEMENTS OD; synthetic contrary cases for shared node/position/port ambiguity; existing source-bound producer and native mass suites; root/docs mirror equality. Owner browser session, native CAESAR import and non-author engineering acceptance remain NOT_RUN.

## Changed-file ledger

Only this recovery report is new at BASELINE. Intended sensitive files: canonical producer and served mirror; native base XML→CII module and mirror; small connected-port helper and mirror; focused JS/Python regressions. Source fixtures are read from existing public Benchmarks paths.

## Continuation / takeover challenges

A1 trace source OD273 through per-node Preview, canonical fact and native ELEMENTS. A2 reproduce branch DN300 versus component DN250 without changing source. A3 prove the shared node's main run remains OD323.8. A4 derive expected values from original XML, not changed production output. A5 propose the smallest patch and distinguish missing versus ambiguous port evidence. A future incoming implementer must re-ground and qualify; this is not a self-awarded independent score.

## Candidate validation return

LOCAL_EXECUTION / AUTHORITATIVE_REFERENCE: actual public PL-BM1 full Preview + canonical producer with unmodified xmldom0.9.8, Node24: VERIFIED, 98 physical owners; source valve original ordinal22 publishes DN250, previously300. No source/mass mutation. Python actual PL fixture temporary ID assignment changes only nonpositive IDs; native ELEMENTS span OD60.3, parent OLET nodes OD323.8. Four Python cases PASS including wrong position, main-run/different reference and conflicting ports. Three JS cases PASS including source identity and bore disagreement rejection. Existing native Final mass consumption 24/24 PASS. Native CAESAR import/non-author review NOT_RUN. Python functions stay in the existing base module so the Pyodide loader needs no new package. New JS helper has a production import and a served mirror. Existing native CLI test entry imports the new regression so its unchanged CI workflow executes it.

Changed paths: producer+mirror; physical bore helper+mirror; Python base+mirror; JS and Python regression files; existing native CLI suite import; this report and claim. All are intended. No workflow edits. Current next action: review exact-head CI and independently verify native import before Owner merge.
