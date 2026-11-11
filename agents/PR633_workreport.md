# PR633 — legacy Weight Match bounded top-five

## Recovery state

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR633
REPOSITORY: reallaksh19/3D_Converters
PR_OR_WIP: PR633
PR_URL: https://github.com/reallaksh19/3D_Converters/pull/633
BRANCH: agent/xml-cii-weight-match-top5-20260818
PR_ALLOCATION_HEAD: 3d597246be612cab7d47253e150713862c73dca8
IMPLEMENTATION_HEAD: 160f37e643cc2bc7cd6e5bdab55d21a7625ad6c3
CHECKED_METADATA_HEAD: c2644d06955aa9ad6c1a0a000414d3205f762cdb
MAIN_HEAD_LAST_CHECKED: 3a26d25902ef8d6f304422cba507f2500dfa61a1
MERGE_BASE: 3a26d25902ef8d6f304422cba507f2500dfa61a1
BASE_DRIFT: NONE / ZERO_BEHIND
CURRENT_STAGE: DRAFT_REVIEW
CURRENT_BLOCKER: NONE
```

## Mission

Remove the full per-issue Weight Master scored-row array and sort from the legacy standalone Weight Match tool while preserving exact per-issue top-five output.

`topWeightCandidatesForIssue()` scans normalized candidates in source order and retains at most five. It inserts only ahead of a strictly lower score, preserving stable source order across equal-score ties.

## Complexity

```text
before: I × [M scored-row allocations + O(M log M) sort]
after:  I × [M scoring scan + bounded <=5 insertion/retention]
```

Finalization still sorts issue candidates, but candidate building guarantees each issue has at most five rows.

## Authority / negative assurance

Preserved: candidate eligibility, candidate IDs/fields/raw refs, scoring weights/tolerances, per-issue grouping, stable tie ordering, overrides, selected candidate/finalized weight, diagnostics, summary and support-config writeback.

This PR does **not** claim a correctness bug in current top-five scope: current main was already top-five per issue. It is performance-only.

No adapted Preview/C5/C5M files, shared Weight ranker, support/GAP, writer/runtime, Python, master values, workflows or workers changed.

## Validation

- PASS / SOURCE_INSPECTION — exact legacy full sort isolated.
- PASS / POLICY — mandatory pre-edit backup; committed backup blob equals `3312ea78d6fdfde8ea82130b4ed30597ca40b2d1`.
- PASS / SYNTAX — production and focused test.
- PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED — `XML CII legacy Weight Match bounded top-five checks passed.`
- PASS / LEGACY_EQUIVALENCE — optimized rows deep-equal independent legacy map/stable-sort/slice reference on mixed/tied fixtures.
- PASS / SCALE_STRUCTURAL — 100 issues × 10,000 master rows; maximum array presented to `Array.sort` is 5.
- PASS / EXACT_BYTE_CUSTODY — production `b909e7557d291b7a7c61a11ee38736763c03d3e8`; test `93f109fb3ee55864adcd64bf32bcebbc586b49b7`.
- NOT_RUN / ENVIRONMENT_BLOCKED — complete repository-native/browser suite.

## Exact GitHub gate at `c2644d06...`

- draft/open/mergeable: true/true/true;
- branch behind main: 0;
- changed files: 9, all scoped and explained;
- `.github/workflows/*` changes: none;
- PR-triggered workflow runs: 0 returned / NOT_OBSERVED;
- commit status contexts: 0 returned / NOT_OBSERVED;
- reviews: 0;
- review threads: 0.

Absence of GitHub contexts is not represented as passing CI.

## Coordination

No open PR/claim exact-file overlap was found for `tabs/xml-cii-2019-standalone/xml-cii-weight-match.js`. #616 and C5/C5M adapted Preview scopes are explicitly excluded.

## Delivery

Draft and unmerged. WIP claim/status are released/superseded by PR633. Keep PR633 unmerged pending a new explicit owner instruction.
