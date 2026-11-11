# PR770 — XML→CII 2019 Standalone robust-fix handover

## Recovery header

```text
HANDOVER_READINESS: READY_WITH_VALIDATION_DEBT
PR_RECOVERY_STATE: MERGED_VALIDATION_DEBT_OPEN
WORK_INTENT: HANDOVER / CONTINUE_VALIDATION_ONLY
CRITICALITY: ENGINEERING_CRITICAL
REPOSITORY: reallaksh19/3D_Converters
ISSUE: 769
PR: 770
MERGE_METHOD: SQUASH
MERGED_HEAD: 6afc5e996bae7c40e0932ef00ea1d0fc9afda02f
MERGE_COMMIT: 0ba752fbebcb55440815015bc87b687323d8caae
CURRENT_MAIN_AT_HANDOVER_CREATION: 9b22a6640852362ca344ae1be67865746a4e850e
CHAIN_ID: XMLCII-ISSUE-769
CURRENT_ENDPOINT: EP-0019
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: reallaksh19/Common@fed57820909f4984a97d67437340df952b73a5ab
MERGE_AUTHORITY: OWNER_ONLY / EXERCISED
OWNER_MERGE_AUTHORIZATION: merge proceed next
ISSUE_STATE: OPEN
ENGINEERING_STATE: COMPLETE
QUALIFICATION_STATE: PARTIAL_PASS_REMAINDER_BLOCKED
WRITE_AUTHORITY: READ_ONLY_UNLESS_EXECUTED_TEST_PROVES_DEFECT
```

## What the original prompt/work brief was

I cannot preserve or expose hidden system/developer prompts in this repository. The operative **user-originated engineering brief** was Issue #769 plus the Owner's progression commands. The complete work brief was:

### Mission

Root-cause and robustly repair XML→CII 2019 Standalone defects in `1 Source & Masters`, including directly coupled Weight Match, Preview, branch-line mapping, Regex Tester, large-master import, and post-run validation paths. Fix authority boundaries rather than adding UI-only patches or duplicate calculation/mapping logic.

### TASK-001 — Line-list field autodetection

Required outcomes:

- `From` and `To` autodetect from explicit semantics, including synthetic `__EMPTY_*` columns formed from multi-row headers.
- `Density Mixed`, `Density Gas`, and `Density Liquid` remain distinct.
- Generic `Density` must not steal a phase-specific density column.
- `Fluid` / phase resolves from explicit semantic evidence.
- `Line Seq No` must not be mapped to Piping Class or another incompatible field.
- Persisted mappings must be semantically revalidated rather than trusted blindly.
- Add multi-row/synthetic-header regressions.

### TASK-002 — Rigid-weight authority / apparent 100× result

Audit the complete lifecycle across Weight Match, the consolidated rigid review, XML enrichment, run/finalization, and the CII writer.

Required outcomes:

- One explicit authority chain: catalog candidate kg → Match-1 kg → reviewed/final kg → XML Weight kg → CII force units.
- Preserve current kg→CII `×10` unless an independent oracle proves it wrong.
- Eliminate stale/legacy override double-authority that can create an apparent 100× symptom.
- Keep provenance (`catalog`, `manual`, `match1`, `final`, `legacy`) and invalidate stale later-stage authority when inputs change.
- All modalities resolve through one final-weight authority.
- E2E regression must prove one conversion, not two.

### TASK-003 — Empirical weight health

Empirical A1/A2 is validation-only, never engineering authority.

Required outcomes:

- Row-level health for every resolved Weight Match row.
- `✓` inside ±30%, `⚠` outside ±30%, `?` with no estimate.
- Details expose observed kg, A1/A2 estimate(s), deviation, basis/model, and source.
- Keep the detailed report as drill-down/export.
- Remove/deprecate misleading automatic “all good” behavior that was not an independent oracle.

### TASK-004 — Large piping-class/master import

Required outcomes:

- Separate `parse → normalize → in-memory commit → optional persistence` boundaries.
- Active session remains usable if persistence/quota fails.
- Do not persist redundant full raw + normalized + workbook copies for large masters.
- Prefer lazy/selected-sheet conversion where compatible.
- Report storage failure accurately, not as parse failure.
- Qualify 10k / 50k / 100k rows or document a measured ceiling.

### TASK-005 — Regex Tester confidence/sampling

Required outcomes:

- Separate composite confidence from exact master coverage, sample count, and distinct count.
- Never display composite `95%` as though it were exact-match percentage.
- Group representative branches by structural/token signature and show counts.
- Keep “show all” as explicit drill-down.
- Preserve token-role highlighting.

### TASK-006 — Branch → Line List Auto Detect / Auto-Suggest / Apply Pattern

Representative examples included `/GLRD...P4110005...`, `B4110004`, and `/...P4110010...`.

Required outcomes:

- Exact loaded line-list key has highest authority.
- Progressive family generalization such as `P4110010 → P411001X → P41100XX ...` is allowed only against actual loaded keys.
- Auto-map only when exactly one authoritative loaded key survives.
- Multiple survivors are ambiguity and must not be silently chosen.
- Never rewrite designator families such as `B... → P...` without an explicit authorized rule.
- Reuse one resolver across normal Preview, Mode A, Auto-Suggest, and project matching.
- Apply Pattern must make extraction/result-template behavior visible with a live example; raw regex remains advanced.
- Every generated result must be validated against loaded line-list authority.

### TASK-007 — B31.3 Preview blockers / governed factors

Required outcomes:

- Do not weaken fail-closed applicability/calculation gates.
- Show exact blockers and each required input's value/source/authority/status.
- Resolve material identity from governed line-list / piping-class / material-master evidence only when unique.
- Resolve E/Y/S/W only from authorized, unambiguous material/code data.
- Resolve OD from governed NPS/DN + dimension standard when unique/allowed.
- Keep blocking ambiguity, conflicting standards, missing corrosion allowance, missing pressure units, unresolved material identity, etc.
- Use an independent B31.3 numerical oracle before relaxing eligibility.

### TASK-008 — State migration/cache invalidation

Required outcomes:

- Version persisted mapping/weight state where needed.
- Legacy entries remain evidence, never silent final authority.
- Invalidate derived resolution when source/master revisions change.
- Preview, Finalise, single-file run, and Mode-A must share resolvers rather than diverging copies.

### Inputs/evidence baseline

- INPUT-001 current `main` at issue creation: `e16fe79fd0a2d542cc2475c9e4a40f9aa6fc701f`.
- INPUT-002 reported synthetic/multi-row line-list headers and expected semantics.
- INPUT-003 reported rigid-weight discrepancy/popup behavior; exact representative source pair was initially unresolved.
- INPUT-004 reported 10k+ master failure where storage/quota surfaced as parse failure.
- INPUT-005 branch family examples.
- INPUT-006 Regex Tester confidence/sampling issue.
- INPUT-007 B31.3 blocked rows/material-factor expectation; authoritative material/code oracle initially unresolved.

### Engineering invariants / no-patch boundaries

- No duplicate engineering weight calculation authority.
- No hidden second kg→CII conversion.
- Empirical models remain validation-only.
- No ambiguous branch-family auto-commit.
- No storage/persistence exception relabeled as parse failure.
- No B31.3 factor synthesized from ambiguous material identity.
- No weakening fail-closed engineering gates just to make Preview appear green.
- No broad refactor outside the XML→CII standalone work item.
- New JS normally <300 physical lines; functions normally <40 logical lines when practical.

### Benchmark baseline

- BM-001 synthetic multi-row line-list mapping.
- BM-002 weight lifecycle E2E proving one kg→CII scale.
- BM-003 stale/legacy override negative test.
- BM-004 empirical ±30% exact-boundary tests.
- BM-005 master import 10k/50k/100k plus quota fault injection.
- BM-006 branch unique/ambiguous/designator-negative cases.
- BM-007 Regex confidence-vs-coverage and representative clustering.
- BM-008 independent B31.3 numerical/provenance cases.
- BM-009 full XML→CII standalone regression.

At chain creation, all benchmarks were NOT_RUN.

### Owner progression commands actually used

- `ok proceed with fixes`
- repeated `proceed next` / `proceednext` / `ok, proceed next`
- `merge proceed next` — explicit Owner merge authorization
- subsequent `proceed next` commands — post-merge validation-only progression

## What was implemented and merged

PR #770 was squash-merged on 2026-09-16T23:56:05Z.

### Mapping / TASK-001

- Semantic profiling for synthetic multi-row headers.
- Exact From/To semantics.
- Distinct phase-density mapping with generic-density non-stealing.
- `Fluid` phase handling.
- `lineSeqNo` detection and semantic persisted-map revalidation.
- Intentional sharing only where line-number semantics allow it.

### Large master / TASK-004

- Parse/import error boundary separated from persistence failure.
- Normalized session state commits before optional browser persistence.
- Persistence failure is fail-soft and session remains usable.
- Compact persistence removes redundant raw/workbook copies for large payloads.

Residual design note: workbook parsing still eagerly converts all sheets; the acceptance item for 50k/100k capacity remains open.

### Regex / Branch / TASK-005 + TASK-006

- Composite confidence separated from exact master coverage.
- Representative structural buckets added without reducing scoring population.
- Branch resolver keeps exact-first authority.
- Progressive family masks auto-map only on one unique loaded survivor.
- Ambiguity blocks.
- B→P designator mutation remains prohibited.
- Apply Pattern generated results must match loaded line-list authority.

### Weight lifecycle / TASK-002

- Central rigid-weight precedence: `Final > Match-1 > legacy > source XML`.
- Standalone Weight Match writes Match-1, not legacy final authority.
- Match-1 revision invalidates stale Final.
- Final review writes Final authority.
- Run/Preview receive transient effective legacy-compatible projections rather than persisting ambiguity back into state.
- Legacy popup path made read-only/non-interactive.
- Existing writer scale remains `10`; no second multiplication was demonstrated.

### Empirical / TASK-003

- Per-row `✓ ±30%`, `⚠ >30%`, `? Unvalidated` health.
- Tooltip/detail evidence includes observed/source/A1/A2/deviation.
- Validation remains read-only.
- Exactly ±30% is inside the healthy threshold.

### B31.3 / TASK-007

- No numerical authority was relaxed.
- Material identity source and factor rejection evidence were made explicit.
- BENCHMARK_ONLY/SCREENING factors remain excluded from strict automatic authority.
- Exact temperature/route/qualification blocker details are exposed.
- OD/wall provenance remains governed.
- Controlled manual factor fallback requires complete values plus a controlled source reference and is not promoted to design authority.

### Migration / TASK-008

- Shared authority schema migration invalidates derived Preview/Weight Match/rating caches once.
- Migration is idempotent.
- Imported masters, mappings, support config, and legacy weight evidence are preserved.
- No numerical migration promotes legacy rigid weights into Match-1 or Final.

## Merge state

```text
PR #770                 MERGED_SQUASH
merged head             6afc5e996bae7c40e0932ef00ea1d0fc9afda02f
merge commit            0ba752fbebcb55440815015bc87b687323d8caae
post-merge terminal     75f830a4201d42a31534b6e76b41f7828eb0aee2
issue                    #769 OPEN
branch                   issue-769/xml-cii-standalone-fixes
```

Merge was explicitly Owner-authorized. Merge did not upgrade incomplete benchmark states to PASS.

## Validation truth at handover

```text
BM-001  PASS
        exact-blob synthetic semantic mapping 5/5
        evidence QE-XMLCII-769-EXACT-BLOB-001

BM-002  PARTIAL_PASS_SCALE_PATH
        exact invocation runtime emits one --weight-scale 10
        Python writer consumes weight_scale once
        full XML→CII writer E2E still open

BM-003  PASS
        exact rigid-weight authority runtime verifies Final > Match-1 > legacy > XML
        stale Final invalidation verified

BM-004  NOT_RUN_ENVIRONMENT_BLOCKED
        empirical ±30% regression exists but full estimator/master closure has not executed

BM-005  PARTIAL_PASS_11K
        exact 11k quota/persistence regression 2/2
        50k and 100k capacity points still open

BM-006  PASS
        exact Branch→Line regression 6/6

BM-007  PASS
        exact Regex confidence/bucketing regression 3/3

BM-008  PASS
        committed B31.3 blocker/provenance regression executed unchanged against 14 byte-identical main blobs
        strict BENCHMARK_ONLY rejection, ambiguity, route-required E, manual fallback controls, and A106 numerical/wall-selection benchmark all passed
        evidence QE-XMLCII-769-EXACT-BLOB-004

BM-009  NOT_RUN_ENVIRONMENT_BLOCKED
        full standalone regression suite not executed
```

Exact BM-008 numerical result: A106 Gr B / 0 °C / 51.1 barg / OD 273 mm / CA 6 mm / S=20 ksi / E=W=1 / Y=.4 / 12.5% negative mill tolerance → required nominal `12.553618958106954 mm` → selected `12.7 mm`, preferred Schedule `60`, equivalent `60 / XS`.

## Qualification evidence files

- `agents/qualifications/XMLCII-ISSUE-769/QE-XMLCII-769-EXACT-BLOB-001.md`
- `agents/qualifications/XMLCII-ISSUE-769/QE-XMLCII-769-EXACT-BLOB-002.md`
- `agents/qualifications/XMLCII-ISSUE-769/QE-XMLCII-769-EXACT-BLOB-003.md`
- `agents/qualifications/XMLCII-ISSUE-769/QE-XMLCII-769-EXACT-BLOB-004.md`

Canonical qualification runner:

```bash
node scripts/verify-issue-769-xml-cii.mjs
node scripts/verify-issue-769-xml-cii.mjs --full
```

The runner exists to make remaining validation reproducible. Do not represent it as PASS unless it actually executes.

## Current control-plane state and repair note

`CURRENT.md` correctly records EP-0019 and BM-008 PASS. During the original BM-008 checkpoint sequence, connector write ordering left the mutable baton inconsistent: `ACTIVE.md` and the Issue Active Handover remained at EP-0018, and EP-0019 was not attached to `main` even though `CURRENT.md` referenced it.

This handover creation repairs that bookkeeping by:

1. preserving the pre-repair `ACTIVE.md` exactly under `.backups/issue-769/HANDOVER-20260917/`;
2. restoring `agents/chains/XMLCII-ISSUE-769/endpoints/EP-0019.md`;
3. synchronizing the mutable `ACTIVE.md` and Issue Active Handover to EP-0019;
4. retaining BM-008 PASS exactly as supported by QE-004.

No production code is changed by this repair.

## Important constraints for the next custodian

- Issue #769 stays OPEN until validation debt is cleared or the Owner separately authorizes closure.
- Do not change the final kg→CII scale from 10 without an independent unit oracle.
- Do not allow legacy `rigidWeight` to outrank Final or Match-1.
- Empirical estimates are health validation only, never final weight authority.
- Do not silently choose ambiguous branch families or mutate designators.
- Do not promote BENCHMARK_ONLY or SCREENING B31.3 factor rows into strict automatic authority.
- Material identity is not numeric S/E/W/Y authority.
- Do not infer full regression PASS from source inspection, mergeability, or partial exact-blob execution.
- Production mutation is allowed only after an executed failing regression identifies a concrete first wrong boundary.

## Exact next actions

Recommended order:

1. **BM-004 empirical exact execution** — materialize the full empirical estimator/master closure byte-identically and run the committed ±30% boundary regression unchanged. Required controls include exactly `70/130` healthy for a 100 kg estimate and `69.9/130.1` abnormal, plus missing-estimate `?` behavior.
2. **BM-002 full writer E2E** — execute one representative XML→CII path proving e.g. 12.5 kg becomes 125 CII force once, with no stale legacy override winning upstream.
3. **BM-005 50k/100k** — run capacity points or establish a measured supported ceiling with evidence; retain quota-failure session usability.
4. **BM-009 focused/full standalone regression** — run the canonical runner focused and `--full` in a real checkout/trusted CI.
5. If all required obligations PASS, reconcile Issue #769's definition-of-done and ask the Owner whether to close the issue. Do not close it by inference.

## Handover in 60 seconds

The implementation is already merged. The remaining job is not feature work: it is **qualification debt closure**. BM-001/003/006/007/008 are PASS; BM-002 and BM-005 are partial; BM-004 and BM-009 are unexecuted. Start with BM-004 or BM-002. Keep all existing engineering authority boundaries fail-closed. Only patch production if a real executed test fails.
