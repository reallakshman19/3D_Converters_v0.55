# PR637 — clean lazy Preview-search replay

## Recovery state

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: OWNER_AUTO_MODE_REPLAY_OF_PR616
MERGE_AUTHORITY: OWNER_AUTO_MODE_GRANTED
REPOSITORY: reallaksh19/3D_Converters
PR_OR_WIP: PR637
PR_URL: https://github.com/reallaksh19/3D_Converters/pull/637
BRANCH: agent/xml-cii-preview-search-lazy-replay-20260818
PR_ALLOCATION_HEAD: fc1fd9437c1b23f2b10837054fae66211987cd5d
IMPLEMENTATION_HEAD: fc1fd9437c1b23f2b10837054fae66211987cd5d
MAIN_HEAD_LAST_CHECKED: d9d14d13b089c968c989544ddbdf023063b43e67
MERGE_BASE: d9d14d13b089c968c989544ddbdf023063b43e67
CURRENT_STAGE: CI_REVIEW
CURRENT_BLOCKER: NONE
```

## Mission

Land lazy Preview-search preparation as part of the XML→CII TARGET architecture while repairing the protocol gap in historical draft #616.

## Implementation

One production module changes: `xml-cii-adapted-import-preview-search.js`.

- use parsed `masterContext.config` when committed;
- otherwise parse `supportConfigJson` once per Line List view;
- expose a Proxy-backed Array view for Line List rows;
- normalize and memoize a row only on first numeric access;
- preserve APPLIED-over-raw authority, `Array.isArray`, virtual-row compatibility and non-Line-List array identity.

## PR616 recovery / takeover

#616 remained open/draft, 16 commits behind current main, with no source/dependency drift for this feature. Its implementation and test were valid, but its own workreport recorded the mandatory repository backup command as NOT_RUN. PR637 is an owner-authorized clean replay from current main; #616 is to be closed as superseded after PR637 custody is active.

Historical and replay blob identity:

```text
pre-edit production  18bc26a0a42dbcc92041dc21e8814bf4e4183fd3
implementation       aeaf20b55ea13e370696db665e03a926cc7d485a
focused test          da1234503f0bce4ac0a90a2cee52396e2beba44f
```

## Backup / history ordering

The exact current-main pre-edit production file was reconstructed and verified as `18bc26a0...`. The repository command ran successfully before mutation:

`node utils/backup.js save tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-preview-search.js "TARGET lazy Preview search clean replay: pre-edit main@d9d14d1"`

Committed backup is byte-identical and backup commit `9ac0b3d31a585c3f38ae837b5fcbdaf85b615e8a` precedes implementation commit `fc1fd9437c1b23f2b10837054fae66211987cd5d`.

## Validation

Exact production/test Git hashes matched the intended replay before execution.

Focused 100k Node regression: **4/4 PASS**.

```text
source rows                  100000
normalized before access     0
initial virtual window       60
first complete search        100000 normalized; match 99999
second search                no additional normalization
clear query                  no additional normalization
fallback config parses       1
committed config parses      0
```

Evidence classification:

- PASS / SOURCE_NO_DRIFT — implementation and relevant virtual-row/search dependencies unchanged since #616 merge-base.
- PASS / POLICY — mandatory backup command executed before replay mutation; exact pre-edit blob.
- PASS / SYNTAX — production/test.
- PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED_WITH_STUBBED_NORMALIZER_BOUNDARY — 4/4 focused test.
- PASS / EXACT_BYTE_CUSTODY — production/test match historical qualified blobs.
- PASS / BRANCH_RECONCILIATION — direct current-main base, zero behind at allocation.
- NOT_RUN / ENVIRONMENT_BLOCKED — complete repository-native/browser suite and browser timing.

## Authority / negative assurance

APPLIED mapping remains authority; DRAFT is not admitted. No Preview dryrun/incremental files, engineering formulas/values, Material/Weight authority, support/GAP, Python CORE, CII writer/runtime, topology, persistence, workers or workflows change.

## Merge policy

Owner auto-mode authorization applies. Merge only after exact final-head gate confirms mergeable, zero-behind, expected scope and no actionable check/review failure. Missing hosted CI is NOT_RUN, not PASS.
