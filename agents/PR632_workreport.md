# PR632 — XML→CII Preview Material authority indexing

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: MANUAL
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR632
REPOSITORY: reallaksh19/3D_Converters
PR_OR_WIP: PR632
PR_URL: https://github.com/reallaksh19/3D_Converters/pull/632
BRANCH: agent/xml-cii-material-authority-index-20260818
IMPLEMENTATION_HEAD: b7306c1acdbd1960725841776f3d7699656b3751
GITHUB_STATE_CHECKED_HEAD: 1c3ee3127ed6a0de22f89c269c33def3c2a62d11
MAIN_HEAD_LAST_CHECKED: e3fa32bf3e6d919d9ed3e3e17aa32fae2beea14e
MERGE_BASE: e3fa32bf3e6d919d9ed3e3e17aa32fae2beea14e
BASE_DRIFT: NONE / ZERO_BEHIND
CURRENT_STAGE: DRAFT_REVIEW
CURRENT_BLOCKER: NONE
HIGHEST_RISK: Complete repository/browser real-dependency Preview equivalence remains NOT_RUN; focused exact-byte invariants pass in reconstructed execution.
EXACT_NEXT_ACTION: Await owner/review or an environment capable of repository-native/browser qualification. Keep draft and do not merge without new explicit owner authorization.
```

## Mission and implementation

PR #632 removes repeated Preview Material preparation work without changing Material authority. `applyPreviewMaterialCodeAuthority()` now builds one Line List alias/source index per apply pass and one ephemeral cache for the pure Material Map fuzzy resolver.

The Line List index records the earliest source row for each canonical alias, including blank Material. Rows with both `lineKey` and `lineKeyProposed` choose the smallest source index across aliases, preserving legacy source-order behavior. Material Map resolver results are cached only by exact process-material text for one apply call; override, conflict, source, review and piping-class fallback decisions remain per-row and uncached.

## Complexity

```text
before ≈ O(B×L + B×M)
after  ≈ O(L + B + U×M), U <= B
```

`B` = branch rows, `L` = Line List rows, `M` = Material Map rows, `U` = unique exact process-material strings in one apply.

## Authority / negative assurance

Preserved: direct process-material priority, earliest matching source-row semantics including blank-first, exact fuzzy resolver thresholds/ambiguity/candidates/confidence, material-scoped overrides/conflicts, piping-class fallback, review flags and all master values.

No support/GAP, topology, units, formulas, writer/runtime, Python, workers, workflows, dryrun/core/rating/Bore-Wall or shared fuzzy resolver code changed. No persistent cache or cross-run authority was introduced.

## Validation

- PASS / SOURCE_INSPECTION — live-main dependency and legacy first-match semantics traced.
- PASS / POLICY — mandatory pre-edit backup command executed; backup blob equals pre-edit source `fa13b47a2fdb28922ef86c73716c9ca9c6a85e14`.
- PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED — syntax + focused regression; output: `XML CII Preview Material authority indexing checks passed.`
- PASS / EXACT_BYTE_CUSTODY — production `a8a83aba58f4bb5a96452d2191f657d251970247`; test `3eef61caaab5b4bf12c24772707bccdc14d8688d`.
- NOT_RUN / ENVIRONMENT_BLOCKED — complete repository/native dependency suite and real browser Preview equivalence.

Focused regression covers blank-first source semantics, source order across aliases, one 10k Line List traversal across 100 branches, one resolver scan per repeated material within an apply, per-row override/source separation, and controlled exact `MAT1` mapping.

## GitHub reconciliation at checked head `1c3ee312...`

- PR: open, draft, mergeable=true, merged=false;
- branch relation: ahead of main, behind_by=0;
- changed files: 9, all explained (production, test, exact backup, PR/WIP custody); no workflow files;
- PR-triggered workflow runs: 0 returned / NOT_RUN;
- commit status contexts: 0 returned / NOT_RUN;
- reviews: 0;
- review threads: 0.

The metadata commit containing this checkpoint is intentionally outside `GITHUB_STATE_CHECKED_HEAD`; implementation byte custody remains pinned separately above. A final live PR/status check should be used for mutable GitHub state.

## Coordination

No exact-file overlap with #628 Bore/Wall or #616 Preview Search. C5M owns `xml-cii-adapted-preview-incremental.js`, not this file; overlap is authority-level only and bounded. PR #630 is merged and is the direct base lineage.

## Delivery state

Draft. The owner authorization used to merge #630 does not authorize merging #632. Keep unmerged until a new explicit owner instruction.
