# PR628 — XML→CII Preview Bore/Wall indexing

# CURRENT RECOVERY STATE — READ FIRST

## 1. Recovery Header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: MANUAL
AUTO_STATE: NOT_ACTIVE
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_MISSION
PHASE_PROGRESSION: MANUAL
MERGE_AUTHORITY: OWNER_ONLY

REPOSITORY: reallaksh19/3D_Converters
SOURCE_TASK: Owner-directed XML→CII (2019) Standalone source-level performance remediation.
PR_OR_WIP: PR628
BRANCH: agent/xml-cii-bore-wall-index-20260818
PR_URL: https://github.com/reallaksh19/3D_Converters/pull/628
PR_HEAD_OBSERVED: 24377670067e0ada1ec7b0f6632a1c03b6fb23cf
REPORT_BASIS_HEAD: 24377670067e0ada1ec7b0f6632a1c03b6fb23cf
MAIN_HEAD_LAST_CHECKED: bca7fc9390c018753d09161052b0bf2fd54e33ce
MERGE_BASE: bca7fc9390c018753d09161052b0bf2fd54e33ce
REPORT_SYNC: CURRENT_FOR_CODE_HEAD; SELF-METADATA UPDATE MAY ADVANCE PR HEAD ONLY
APPENDIX_A_STATUS: NOT_REQUIRED_NEW_WORK_ITEM
GROUNDING_EPOCH: GE-004
CURRENT_TAKEOVER: NONE

CURRENT_STAGE: DRAFT_REVIEW_WAITING_FOR_EXTERNAL_EVIDENCE
LAST_COMPLETED_STAGE: PR_HEAD_RECONCILIATION
CURRENT_BLOCKER: NONE
HIGHEST_RISK: Repository-native real-core execution is still not observed; no PR workflow/status/review evidence exists yet.
LAST_DURABLE_CHECKPOINT: PR #628 code head 2437767… is based on current main with behind_by=0, all 11 changed files are within declared production/qualification/custody scope, and no checks/reviews/threads are present.
EXACT_NEXT_ACTION: Keep PR draft. When checks or review evidence appears, reconcile actionable findings at the then-current head. Do not merge without Owner authorization.
```

## 2. Handover in 60 Seconds

PR #628 implements the first confirmed P0 performance slice from the XML→CII Standalone audit. Preview Bore/Wall now prepares StagedJson wall evidence and exact Piping-Class wall matches once per Preview call, then performs indexed lookups inside the branch loop.

Authority is unchanged: direct DTXR wall wins, exact class/DN wall remains fallback before weaker DTXR schedule evidence, the `96620|250` benchmark correction remains higher authority than master rows, node bore correction remains active, and invalid StagedJson remains fail-soft.

The PR is open and **draft**. It has no observed PR workflow runs, commit statuses, submitted reviews, or review threads at the checked code head. This is recorded as `NOT_OBSERVED`, not PASS/FAIL.

No Weight Match code is changed. The earlier junior “global top five” correctness claim was falsified on exact main bytes before any production change: current main already applies the top-five slice per issue.

## 3. Repository Ground Truth

Grounding `GE-004`:

- PR #628: open, draft, not merged;
- base/main/merge-base: `bca7fc9390c018753d09161052b0bf2fd54e33ce`;
- checked PR head: `24377670067e0ada1ec7b0f6632a1c03b6fb23cf`;
- compare against main: `ahead`, `behind_by: 0`;
- changed files at checked head: 11, all expected (2 production, 1 focused test, 2 exact backups, PR/WIP custody records);
- no `.github/workflows/` changes;
- #616 remains isolated to Preview-search and is untouched;
- no active PR was found claiming the two Bore/Wall production files;
- GitHub PR field `mergeable: false` is not treated as a conflict verdict because there is no base drift, failed check, or conflict evidence from compare; mergeability remains unresolved/non-authoritative here.

Pre-edit source blobs preserved by required backups:

- Bore/Wall authority: `8955e316b36c1769746759aeeb43e34926d47ecb`;
- wall evidence: `04ff82f24dfa9e7a112c17228d1fe24de0b32a55`.

Validated modified code/test blobs before PR metadata commits:

- wall evidence: `1de4824a50955bfdeaaca94532970c30055a6b90`;
- Bore/Wall authority: `a7f666f5f4389fdf8fa0681296ebe603461fda57`;
- focused test: `739fccec5360e3626e4065838333230f60fad6d9`.

## 4. Mission / Scope / Acceptance

Mission: remove per-branch whole-StagedJson and whole-Piping-Class preparation in Preview Bore/Wall without changing engineering authority or published facts.

Production scope:

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-wall-evidence.js`;
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js`.

Qualification/custody scope:

- `tests/xml-cii-preview-bore-wall-index.test.mjs`;
- exact pre-edit backups;
- `agents/PR628_*` plus superseded WIP records.

Explicit exclusions: #616 search file; Preview cache/orchestration; core DTXR resolver/ledger; Material/Weight authority; support/GAP; writer/runtime; Python; topology; formulas; units; workers; workflows.

Acceptance:

1. StagedJson parse/walk once per Bore/Wall application — **PASS focused**.
2. Piping Class wall scan once per application — **PASS focused**.
3. first exact master row behavior retained — **PASS independent reference**.
4. `96620|250` correction precedence retained — **PASS**.
5. canonical `/B<n>` grouping/evidence order retained — **PASS independent reference**.
6. direct DTXR wall above class fallback — **PASS focused integration**.
7. invalid StagedJson fail-soft — **PASS**.
8. node bore correction active — **PASS focused integration**.
9. repository-native real-core execution — **NOT_OBSERVED**.

## 5. Implementation State

| Work item | State | Notes |
|---|---|---|
| staged branch evidence index | COMPLETE | one parse/walk; ordered canonical-branch buckets |
| exact class/DN wall index | COMPLETE | correction-first; first-row/null behavior preserved |
| Bore/Wall consumer | COMPLETE | indexes built once before branch map loop |
| focused regression | COMPLETE | independent lookup reference + structural scan-count checks |
| backups | COMPLETE | exact pre-edit source bytes |
| draft PR | COMPLETE | #628 |
| PR checks/reviews | NOT_OBSERVED | no runs/statuses/reviews/threads at checked head |

## 6. Engineering Item Register

| ID | Type | Priority | Status | Summary |
|---|---|---|---|---|
| IMP-001 | performance | P0 | IMPLEMENTED | staged parse/walk removed from branch loop |
| IMP-002 | performance | P0 | IMPLEMENTED | Piping-Class exact-wall scan removed from branch loop |
| RISK-001 | authority | P0 | QUALIFIED_FOCUSED | ordering/correction/first-row behavior covered |
| RISK-002 | validation | P1 | OPEN | native real-core execution not yet observed |
| DEC-001 | authority | P0 | ACTIVE | lookup preparation only; no authority-value changes |

## 7. Technical Change

Before:

```text
B × (parse/walk S staged components + scan P class rows)
≈ O(B×S + B×P)
```

After:

```text
parse/walk S once + scan P once + B indexed lookups
≈ O(S + P + B)
```

The existing compatibility helpers remain callable. The production authority now consumes the prepared indexes directly.

A deliberate first-row invariant is encoded in `buildExactClassWallIndex()`: the first class/DN key is inserted even when its wall result is `null`, so a later duplicate valid row cannot replace an earlier invalid first match. This reproduces the prior `.find()` followed by validation. Benchmark corrections seed the map before master rows and cannot be overwritten.

## 8. Authority and Negative Assurance

Authority remains:

```text
staged/XML wall evidence
→ existing DTXR wall evidence ledger
→ DIRECT_WALL wins
→ exact Piping Class class/DN wall fallback
→ weaker DTXR schedule evidence
→ Preview publication
```

No engineering values, unit conversion, schedule values, correction constants, DTXR parsing policy, Material/Weight authority, support/GAP rules, writer/runtime logic, Python logic, topology, or workflow configuration changed.

## 9. Validation

```text
VAL-001 PASS — backup policy
Exact pre-edit reconstructions matched GitHub source blobs; repository `node utils/backup.js save` was executed before source edits; exact backups are committed.

VAL-002 PASS — syntax
node --check passed for both modified production modules and the focused test on exact modified bytes.

VAL-003 PASS — independent lookup equivalence / structural complexity
node tests/xml-cii-preview-bore-wall-index.test.mjs
Output: XML CII Preview Bore/Wall indexed preparation checks passed.
Observed: 1 JSON parse followed by 100 branch lookups; 0 Piping-Class master row reads after index build; independent legacy staged evidence order; invalid JSON; first-row/null duplicate behavior; correction precedence; NPS mapping; no-match behavior.

VAL-004 PASS_WITH_LIMITATION — focused authority integration
Direct staged wall remains above class wall, exact class remains fallback, and node bore correction remains. The local reconstruction used minimal stubs only at imported DTXR resolver/ledger boundaries so the target modules could execute without a checkout. Independent staged/class lookup equivalence did not depend on those stubs.

VAL-005 NOT_RUN / ENVIRONMENT_BLOCKED — native local repository suite
Direct clone failed `Could not resolve host: github.com`; this is not a product PASS/FAIL.

VAL-006 NOT_OBSERVED — PR workflow/check evidence
At code head 2437767…: `fetch_commit_workflow_runs` returned none; combined status list returned none.

VAL-007 NOT_OBSERVED — review evidence
At code head 2437767…: no submitted reviews and no review threads.
```

## 10. Changed-File Ledger

11 files at checked head:

- 2 modified production Bore/Wall modules;
- 1 new focused test;
- 2 new exact backups;
- `agents/PR628_workreport.md`, `agents/status/PR628.yaml`, `agents/claims/PR628.yaml`;
- superseded WIP workreport/status/claim.

No unexpected or workflow files are present.

## 11. Review / CI State

PR #628 remains draft. No checks/status contexts, PR-triggered workflow runs, reviews, or review threads were observed at the checked code head. Therefore repository-native validation is **not yet available**, rather than green or red.

The branch is not behind main. Do not infer conflict from the PR `mergeable: false` boolean alone; no corroborating conflict evidence has been observed.

## 12. Repository Coordination / Overlap

```text
MASTER_INDEX_CHECKED: absent on main
STATUS_RECORD: agents/status/PR628.yaml
CLAIM_RECORD: agents/claims/PR628.yaml
WIP_STATUS: SUPERSEDED_BY_PR628
WIP_CLAIM: RELEASED
FILE_OVERLAP: none observed
AUTHORITY_OVERLAP: no active owner of exact Bore/Wall production files
DEPENDENCY_OVERLAP: independent of #616; #614 may consume performance evidence later
COORDINATION_STATE: SAFE
```

## 13. Continuation State

```text
Start here: PR #628 current head/check state
Do not redo: implementation, exact backups, focused equivalence qualification
Do not change: DTXR resolver, wall authority order, benchmark correction, engineering values
Validation still required: repository-native check/review evidence when available
Highest-risk remaining item: real-core native execution has not been observed
Exact next action: keep draft; reconcile future actionable CI/review findings; merge only on explicit Owner authorization
```

# APPENDIX A — IMPLEMENTATION TAKEOVER QUALIFICATION

`NOT_REQUIRED_NEW_WORK_ITEM`. Owner authorized this implementation. Future engineering-critical takeover requires repository-specific qualification before mutation.
