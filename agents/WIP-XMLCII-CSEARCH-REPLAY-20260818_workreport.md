# WIP-XMLCII-CSEARCH-REPLAY-20260818 — clean Preview-search lazy replay

## Recovery state

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: OWNER_AUTO_MODE_REPLAY_OF_PR616
MERGE_AUTHORITY: OWNER_AUTO_MODE_GRANTED
REPOSITORY: reallaksh19/3D_Converters
PR_OR_WIP: WIP-XMLCII-CSEARCH-REPLAY-20260818
BRANCH: agent/xml-cii-preview-search-lazy-replay-20260818
MAIN_HEAD_LAST_CHECKED: d9d14d13b089c968c989544ddbdf023063b43e67
CURRENT_STAGE: BASELINE
CURRENT_BLOCKER: NONE
```

## Mission

Land the useful target-architecture behavior from draft PR #616 through a clean current-main replay that satisfies the repository's mandatory backup-command policy.

The target is one production module:

`tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-preview-search.js`

Current main eagerly normalizes every Line List Preview-search row and can parse `supportConfigJson` repeatedly from row normalization. The replay keeps the #616 design: a Proxy-backed Array view that normalizes/memoizes Line List rows only when accessed and parses fallback config once per view build.

## PR616 recovery / takeover appendix

Authoritative live PR #616 remains open/draft and is 16 commits behind current main. Its production file, test, and relevant dependencies have not changed on main since its merge-base. However its own workreport states that `node utils/backup.js save ...` was NOT_RUN and the backup was materialized through the connector instead. Under the current repository policy that historical branch is not merge-admissible.

Owner instruction in this conversation grants auto-mode authority to continue the TARGET architecture. This WIP therefore replays the exact qualified implementation onto current main with a real mandatory backup command before mutation, then will supersede/close #616 after successor PR allocation.

Historical #616 qualified blobs:

```text
pre-edit production  18bc26a0a42dbcc92041dc21e8814bf4e4183fd3
implementation       aeaf20b55ea13e370696db665e03a926cc7d485a
focused test          da1234503f0bce4ac0a90a2cee52396e2beba44f
```

## Authority invariants

- APPLIED `master.rows` remain authoritative over raw fallback rows.
- DRAFT mapping is not admitted.
- non-Line-List masters retain their existing array identity.
- `Array.isArray(...) === true` remains true for the lazy Line List view.
- virtual-row/search engine is unchanged.
- no engineering values/formulas, support/GAP, Material/Weight authority, Python CORE, writer/runtime, topology, workers, persistence or workflows change.

## Validation plan

- run exact repository backup command against current-main production blob before mutation;
- replay the exact #616 implementation/test blobs;
- execute the 100k focused regression on a controlled local reconstruction with exact production/test/virtual-row logic and a minimal imported Line List normalizer boundary;
- reconcile branch against current main and inspect final GitHub checks/reviews/threads;
- repository-native/browser execution remains NOT_RUN unless independently available.
