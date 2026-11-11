# WIP-XMLCII-PARENT-BRANCH-ONLY-20260818 — parent Run-parity branch-only Preview

## Recovery state

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED_STALE_MERGED_PREDECESSOR
MERGE_AUTHORITY: OWNER_AUTO_MODE_GRANTED
REPOSITORY: reallaksh19/3D_Converters
PR_OR_WIP: WIP-XMLCII-PARENT-BRANCH-ONLY-20260818
BRANCH: agent/xml-cii-parent-branch-only-20260818
MAIN_HEAD_LAST_CHECKED: 765d15e87def22291792ddb533df9ea532fb3f67
IMPLEMENTATION_HEAD: 18ffc7480b12d9c3b69db3d3b3ddb2bb305ea561
CURRENT_STAGE: VALIDATED_READY_FOR_PR
CURRENT_BLOCKER: NONE
```

## Mission

Finish the execution-granularity step left intentionally open by merged PR #630. The parent Model Converters Run-parity call consumes only Preview `branchRows`; normal Preview also constructs node Weight-review rows. This successor adds an opt-in branch-only mode to the legacy parent Preview and makes Run-parity request it, eliminating the discarded node-row traversal/ranking block while preserving ordinary Preview behavior.

## Ground truth / predecessor custody

- current main: `765d15e87def22291792ddb533df9ea532fb3f67` after #633;
- predecessor PR #630 is live `closed/merged=true` at merge commit `e3fa32bf3e6d919d9ed3e3e17aa32fae2beea14e`;
- #630's committed claim/status still say ACTIVE_DRAFT and are stale repository metadata; this successor explicitly supersedes that stale custody based on the authoritative live PR state;
- no exact-file overlap with #616 or adapted C5/C5M Preview files.

## Final implementation

Two production modules change:

1. `preview-renderer.js`
   - `xmlCiiDryRunPreview(xmlText, config, stagedJsonText, options)` accepts opt-in `options?.branchRowsOnly === true`;
   - the full branch row is computed and appended exactly as before;
   - branch-only mode then skips the later node-row traversal/ranking block;
   - normal three-argument Preview behavior is unchanged.

2. `xml-cii-parent-run-parity-weight-scope.js`
   - requests `{ branchRowsOnly: true }` from the same Preview resolver;
   - no longer hides, replaces, or restores `config.weight.masterRows`;
   - passes the same config object through unchanged and returns Preview `branchRows` by identity.

The initially considered import-query bump in `enrichment-run-parity.js` was dropped before publication. That source remains byte-identical to main (`ef13ef3f...`); its pre-edit backup is retained as conservative evidence only.

## Complexity / execution boundary

Merged #630 already eliminated the discarded `eligibleNodes × WeightMasterRows` scoring scan. This successor removes the remaining node-row construction/review traversal block from that parent call after each branch row is complete.

This does **not** claim zero node inspection overall: branch authority still legitimately inspects node/staged evidence for items such as staged bore and DTXR wall evidence while building `branchRows`.

## Byte custody / backup

Mandatory repository backup commands ran before production mutation. Exact pre-edit backup blobs:

```text
preview-renderer.js                         a347007b2b233715c13eb0ced28a5003d9b0079b
xml-cii-parent-run-parity-weight-scope.js  c3a6f88db3032aa661adec0493534e720a875e3c
enrichment-run-parity.js                   ef13ef3f08c310741cdce95f237b4318ccd040cd
predecessor focused regression             8196deb5bf00129ca807b924229dbd6d108c18cd
```

Backup commit precedes implementation: `f5eb647dfebed4ed01008696bfb0ba8c771f0958`.

Final implementation/test blobs:

```text
preview-renderer.js                         77be866dd2e5107dba6baddf55f29617cff38913
xml-cii-parent-run-parity-weight-scope.js  afb983d539ed55aba56ad7e9ca300399dca8050f
enrichment-run-parity.js                   ef13ef3f08c310741cdce95f237b4318ccd040cd (UNCHANGED)
focused regression                         e527603b4a7663932e7f6d68c1883f19022ee678
```

## Validation

- PASS / SOURCE_DEPENDENCY_TRACE — branch rows are the only parent-consumed Preview result.
- PASS / PREDECESSOR_RECONCILIATION — live #630 is merged; stale ACTIVE metadata identified and superseded.
- PASS / POLICY — four mandatory backups executed before mutation and exact blob identities verified.
- PASS / SYNTAX — Preview, helper, unchanged integration and focused regression.
- PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED — successor helper/static regression: `XML CII parent Run-parity branch-only Preview checks passed.`
- PASS / LOCAL_EXECUTION / STUBBED_IMPORT_BOUNDARY — actual modified Preview executed normal vs branch-only on controlled DOM/dependency stubs: normal produced 1 branch row, 1 node row and 1 rank call; branch-only produced the deep-equal branch row, 0 node rows and 0 rank calls.
- PASS / EXACT_BYTE_CUSTODY — remote production/test blobs match locally executed Git hashes.
- PASS / BRANCH_RECONCILIATION — 10 changed files, 0 behind main at implementation head; only Preview/helper production modules differ.
- NOT_RUN / ENVIRONMENT_BLOCKED — complete repository-native/browser suite and real product timing.

## Negative assurance

No adapted Preview/C5/C5M files, shared Weight ranker, engineering master values, formulas, units, support/GAP behavior, writer/runtime, Python, workers or workflows changed.
