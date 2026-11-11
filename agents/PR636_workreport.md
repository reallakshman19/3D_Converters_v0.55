# PR636 — parent Run-parity branch-only Preview

## Recovery state

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED_STALE_MERGED_PREDECESSOR
MERGE_AUTHORITY: OWNER_AUTO_MODE_GRANTED
REPOSITORY: reallaksh19/3D_Converters
PR_OR_WIP: PR636
PR_URL: https://github.com/reallaksh19/3D_Converters/pull/636
BRANCH: agent/xml-cii-parent-branch-only-20260818
PR_ALLOCATION_HEAD: eed8db00a7e14b7538d9921e4e23e0b0af1f1ad9
IMPLEMENTATION_HEAD: 18ffc7480b12d9c3b69db3d3b3ddb2bb305ea561
MAIN_HEAD_LAST_CHECKED: 765d15e87def22291792ddb533df9ea532fb3f67
MERGE_BASE: 765d15e87def22291792ddb533df9ea532fb3f67
CURRENT_STAGE: CI_REVIEW
CURRENT_BLOCKER: NONE
```

## Mission

Complete the parent Run-parity execution-granularity target left open by merged #630. The parent caller consumes only dry-run Preview `branchRows`; PR636 makes that call explicitly branch-only so the later node Weight-review construction/ranking block is not executed.

## Implementation

- legacy `xmlCiiDryRunPreview` accepts an optional fourth argument and derives `branchRowsOnly` only when `options?.branchRowsOnly === true`;
- complete branch rows are produced through the unchanged authority logic first;
- branch-only then skips the node-row review traversal/ranking block;
- normal Preview remains the default and still returns node rows;
- Run-parity helper forwards `{ branchRowsOnly: true }` and no longer mutates `config.weight.masterRows`.

Final production scope is two modules only. `enrichment-run-parity.js` is byte-identical to main; its backup is conservative pre-edit evidence from a considered-but-dropped import query bump.

## Performance boundary

PR630 already removed discarded `eligibleNodes × WeightMasterRows` scoring. PR636 removes the remaining discarded node-row review traversal/ranking block after branch rows are complete.

It does not remove legitimate branch-authority node/staged inspection used for staged bore/DTXR evidence.

## Byte custody

```text
pre-edit Preview                 a347007b2b233715c13eb0ced28a5003d9b0079b
modified Preview                 77be866dd2e5107dba6baddf55f29617cff38913
pre-edit helper                  c3a6f88db3032aa661adec0493534e720a875e3c
modified helper                  afb983d539ed55aba56ad7e9ca300399dca8050f
integration unchanged            ef13ef3f08c310741cdce95f237b4318ccd040cd
pre-edit predecessor test        8196deb5bf00129ca807b924229dbd6d108c18cd
modified focused test            e527603b4a7663932e7f6d68c1883f19022ee678
backup-before-edit commit        f5eb647dfebed4ed01008696bfb0ba8c771f0958
implementation commit            18ffc7480b12d9c3b69db3d3b3ddb2bb305ea561
```

## Validation

- PASS / SOURCE_DEPENDENCY_TRACE.
- PASS / PREDECESSOR_RECONCILIATION — live #630 merged; stale ACTIVE metadata superseded.
- PASS / POLICY — mandatory backups before production mutation, exact blob equality.
- PASS / SYNTAX — Preview/helper/integration/test.
- PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED — helper/static successor regression.
- PASS / LOCAL_EXECUTION / STUBBED_IMPORT_BOUNDARY — actual Preview normal vs branch-only: same branch rows; normal nodeRows=1/rankCalls=1; branch-only nodeRows=0/rankCalls=0.
- PASS / EXACT_BYTE_CUSTODY.
- PASS / SCOPE — only two production modules modified; no workflows.
- NOT_RUN / ENVIRONMENT_BLOCKED — complete repository-native/browser suite and real product timing.

## Predecessor / coordination

PR #630 is authoritatively closed/merged at `e3fa32bf...`; its committed ACTIVE claim/status are stale and superseded for these exact files by PR636 custody. No exact-file overlap with #616. Adapted Preview/C5/C5M and shared Weight-ranker files are excluded.

## Merge policy

Owner auto-mode authorization applies to this target-architecture slice. Merge only after exact final-head reconciliation confirms zero-behind, mergeable, expected scope, and no actionable review/check failure. Missing hosted CI remains NOT_RUN rather than PASS.
