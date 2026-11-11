# WIP-XMLCII-MATERIAL-INDEX-20260818 — Preview Material authority indexing

# CURRENT RECOVERY STATE — READ FIRST

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: MANUAL
MERGE_AUTHORITY: OWNER_ONLY
REPOSITORY: reallaksh19/3D_Converters
PR_OR_WIP: WIP-XMLCII-MATERIAL-INDEX-20260818
BRANCH: agent/xml-cii-material-authority-index-20260818
IMPLEMENTATION_HEAD: b7306c1acdbd1960725841776f3d7699656b3751
MAIN_HEAD_LAST_CHECKED: e3fa32bf3e6d919d9ed3e3e17aa32fae2beea14e
MERGE_BASE: e3fa32bf3e6d919d9ed3e3e17aa32fae2beea14e
BASE_DRIFT: NONE / 0 BEHIND
CURRENT_STAGE: PR_ALLOCATION_READY
CURRENT_BLOCKER: NONE
HIGHEST_RISK: Full repository/browser execution with real dependencies remains NOT_RUN; focused local reconstruction proves lookup/caching invariants but is implementation-coupled.
EXACT_NEXT_ACTION: Open a draft PR, migrate custody to PR-numbered records, then inspect exact final head/checks/reviews/threads. Do not merge without new owner authorization.
```

## Mission

Remove repeated full Line List normalization/scans from `applyPreviewMaterialCodeAuthority()` and avoid repeated pure Material Map fuzzy resolution for identical material strings during one apply pass.

## Ground truth and coordination

- base/main: `e3fa32bf3e6d919d9ed3e3e17aa32fae2beea14e` (PR #630 squash merge);
- pre-edit Material authority blob: `fa13b47a2fdb28922ef86c73716c9ca9c6a85e14`;
- modified exact blob: `a8a83aba58f4bb5a96452d2191f657d251970247`;
- focused test blob: `3eef61caaab5b4bf12c24772707bccdc14d8688d`;
- compare to main at implementation reconciliation: 5 commits ahead / 0 behind before this metadata update;
- no exact-file overlap with PR #628 or PR #616;
- C5M owns `xml-cii-adapted-preview-incremental.js`, not this Material authority file. Authority overlap is `COORDINATION_REQUIRED_BOUNDED` and the C5M file remains untouched.

## Implementation

`buildPreviewMaterialLineListIndex(config)` now traverses/normalizes Line List master rows once and records the first source row for each canonical alias, including a blank material value. A row with multiple target aliases selects the candidate with the smallest source index so legacy source-order semantics are preserved.

`resolvePreviewMaterialCodeAuthority(row, config, context)` remains backward compatible for two-argument callers. When an apply-scoped context is supplied, Line List lookup is O(1) per alias rather than a fresh full scan.

`applyPreviewMaterialCodeAuthority()` creates an ephemeral context with the Line List index and a `Map` for pure Material Map resolver results. The cache key is exact process-material text and exists only for one apply call. Override/pinned-conflict/fallback decisions are still executed independently per row.

## Complexity boundary

Before:

```text
B branch rows × L Line List rows (normalize + compare)
+ B branch rows × M Material Map rows for repeated process material
≈ O(B×L + B×M)
```

After:

```text
L Line List rows once + B alias lookups
+ U unique process materials × M Material Map rows
≈ O(L + B + U×M), where U <= B
```

No claim is made that all Material authority work is O(1); piping-class fallback and per-row override/conflict decisions remain unchanged.

## Semantic invariants / negative assurance

Preserved:
- direct `processMaterial` / `lineListMaterial` priority;
- first matching Line List source-row behavior, including first-match blank material;
- source order across `lineKey` and `lineKeyProposed` aliases;
- exact Material Map resolver, thresholds, ambiguity rules, candidate ordering and confidence;
- material-scoped override behavior and conflict diagnostics;
- piping-class fallback and review flags;
- no persistent cache or authoritative state mutation.

No master values, formulas, units, support/GAP, topology, writer/runtime, Python, workers, workflows, dryrun/core/rating/Bore-Wall or shared fuzzy resolver code changed.

## Mandatory backup

Before production edit, exact main bytes were reconstructed and verified with Git blob SHA. The repository command

```text
node utils/backup.js save tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js "P0/P1 Preview Material indexing: pre-edit main@e3fa32b authority module"
```

created backup #1. The committed backup reuses exact Git blob `fa13b47a2fdb28922ef86c73716c9ca9c6a85e14`.

## Validation

`VAL-001 PASS / SOURCE_INSPECTION` — current code path and first-match semantics traced from live main.

`VAL-002 PASS / LOCAL_EXECUTION / POLICY` — mandatory pre-edit backup executed; backup blob equals pre-edit source blob.

`VAL-003 PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED` — syntax checks and `tests/xml-cii-preview-material-authority-index.test.mjs` passed on exact modified bytes. Result: `XML CII Preview Material authority indexing checks passed.`

Focused cases prove:
- first matching blank Line List row remains authoritative over a later matching material row;
- earliest source row wins across `lineKey` and `lineKeyProposed` aliases;
- 10,000 Line List rows are numerically read exactly once while resolving 100 branch rows;
- repeated identical process material scans a 250-row Material Map no more than the one-row baseline within a single apply pass;
- cached pure resolver output does not cache final per-row authority: manual/override source remains per-row;
- exact material mapping still resolves expected `MAT1` in the controlled case.

`VAL-004 PASS / EXACT_BYTE_CUSTODY` — remote production and test blobs match the locally executed Git hashes exactly.

`VAL-005 NOT_RUN / ENVIRONMENT_BLOCKED` — complete repository/native dependency suite and real browser Preview equivalence; local reconstruction uses minimal explicit dependency stubs only for focused execution.

## Changed-file ledger before PR allocation

- exact backup of Material authority module;
- this WIP report/status/claim;
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js`;
- `tests/xml-cii-preview-material-authority-index.test.mjs`.

No workflow file is changed.
