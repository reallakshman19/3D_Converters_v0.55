# WIP-XMLCII-WEIGHT-TOP5-20260818 — legacy Weight Match bounded top-five

## Recovery state

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
REPOSITORY: reallaksh19/3D_Converters
PR_OR_WIP: WIP-XMLCII-WEIGHT-TOP5-20260818
BRANCH: agent/xml-cii-weight-match-top5-20260818
MAIN_HEAD_LAST_CHECKED: 3a26d25902ef8d6f304422cba507f2500dfa61a1
MERGE_BASE: 3a26d25902ef8d6f304422cba507f2500dfa61a1
IMPLEMENTATION_HEAD: 160f37e643cc2bc7cd6e5bdab55d21a7625ad6c3
CURRENT_STAGE: PR_ALLOCATION_READY
CURRENT_BLOCKER: NONE
```

## Mission

Optimize the legacy standalone Weight Match candidate ranking only. Current correctness already keeps the top five per issue; the performance defect is that each issue scored/allocated all valid master candidates, sorted the full scored list, then sliced five.

The implementation replaces that full list/sort with a stable bounded list of at most five rows. Candidates are still scored in Weight Master source order. A candidate inserts only ahead of a strictly lower score, so equal-score order remains source order, matching stable JavaScript sort semantics.

## Ground truth / scope

- main: `3a26d25902ef8d6f304422cba507f2500dfa61a1` after #632 and #628 merges;
- production target: `tabs/xml-cii-2019-standalone/xml-cii-weight-match.js`;
- pre-edit blob: `3312ea78d6fdfde8ea82130b4ed30597ca40b2d1`;
- modified blob: `b909e7557d291b7a7c61a11ee38736763c03d3e8`;
- focused test blob: `93f109fb3ee55864adcd64bf32bcebbc586b49b7`;
- no open PR or active claim found for this exact production file;
- #616 Preview Search and all C5/C5M adapted Preview files are excluded.

## Complexity

Before: per issue `M` scored-row allocations plus a full `M log M` sort, then keep five.

After: per issue one `M` scan with a bounded five-row insertion list. Finalization still sorts per-issue lists, but those lists contain at most five rows.

## Semantic invariants

Preserved: score weights and tolerances, candidate filtering, candidate IDs, candidate fields, top-five per issue, stable tie order, issue grouping, override selection, finalized weights, diagnostics and support-config writeback. This work does **not** assert or change any global-vs-per-issue top-five correctness behavior; current main was already per issue.

## Validation

- PASS / SOURCE_INSPECTION — current full per-issue sort isolated.
- PASS / POLICY — mandatory repository backup command executed before edit; backup blob equals pre-edit `3312ea78...` and was committed before production mutation.
- PASS / SYNTAX — production and focused test.
- PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED — `XML CII legacy Weight Match bounded top-five checks passed.`
- PASS / LEGACY_EQUIVALENCE — optimized candidate rows deep-equal an independent legacy `map -> stable sort -> slice(0,5)` reference across mixed scores and >5 exact ties.
- PASS / SCALE_STRUCTURAL — 100 issues × 10,000 master rows; instrumented `Array.sort` observed no sorted array larger than five rows.
- PASS / EXACT_BYTE_CUSTODY — remote blobs equal locally executed production/test SHA values.
- NOT_RUN / ENVIRONMENT_BLOCKED — complete repository-native/browser suite.

## Changed scope at implementation head

Six files only: exact pre-edit backup, WIP report/status/claim, one production module, one focused test. No workflows changed.

## Next action

Open a fresh draft PR, migrate WIP custody to PR-numbered records, release WIP claim, inspect exact final PR head/checks/reviews/threads, and keep unmerged without a new owner instruction for that new PR.
