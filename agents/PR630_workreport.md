# PR630 — XML→CII parent Run-parity discarded Weight scan

# CURRENT RECOVERY STATE — READ FIRST

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
PR_OR_WIP: PR630
PR_URL: https://github.com/reallaksh19/3D_Converters/pull/630
BRANCH: agent/xml-cii-run-parity-weight-scan-20260818
PR_HEAD_LAST_VALIDATED: 253907664283793cb384a34adce137b0fad27358
REPORT_BASIS: CODE_HEAD_2539076_PLUS_METADATA_ONLY_RECONCILIATION
MAIN_HEAD_LAST_CHECKED: 1d5930638e6f9714a2c29af328fe15a4e6b8b7f6
MERGE_BASE: bca7fc9390c018753d09161052b0bf2fd54e33ce
BASE_DRIFT: SAFE_TO_CONTINUE / ONE_UNRELATED_HIGH_PR_QUALIFICATION_COMMIT
REPORT_SYNC: CURRENT
APPENDIX_A_STATUS: NOT_REQUIRED_NEW_WORK_ITEM
GROUNDING_EPOCH: GE-004
CURRENT_STAGE: DRAFT_REVIEW
CURRENT_BLOCKER: FULL_REPOSITORY_BROWSER_EQUIVALENCE_NOT_RUN
HIGHEST_RISK: Complete-repository/browser branch-row equivalence is still NOT_RUN; exact-byte deterministic suppression/restoration tests pass.
LAST_DURABLE_CHECKPOINT: PR #630 head 2539076 was draft/open/mergeable with declared scope, zero reviews/threads, zero commit statuses and zero PR-triggered workflow runs observed.
EXACT_NEXT_ACTION: Await independent review/CI or continue the performance roadmap in a separate work item; do not widen or merge PR630 without owner authorization.
```

## Handover

PR #630 removes a duplicate Weight-Master scoring pass from the **parent** Run-parity Preview call. That caller consumes only `branchRows`; the parent Preview nevertheless ranks eligible nodes against Weight Master rows before returning discarded `nodeRows`.

A new 24-line helper temporarily sets only `config.weight.masterRows = []` during that synchronous parent Preview invocation and restores the exact original array in `finally`. The same config object and all other Weight settings are preserved. Later standalone adapted Preview/Weight Match still receives the full Weight Master and remains final Weight authority.

This does not yet create a true branch-only Preview; node traversal remains.

## Ground truth / scope

- PR: #630, draft/open, mergeable at GE-004;
- PR base: `main@1d5930638e6f9714a2c29af328fe15a4e6b8b7f6`;
- original merge base: `bca7fc9390c018753d09161052b0bf2fd54e33ce`;
- target source did not change across the one-commit main drift;
- code + migrated-custody head validated: `253907664283793cb384a34adce137b0fad27358`;
- final changed-file inventory is confined to the two production modules, focused test, exact backup, and PR/WIP custody records;
- no exact-file overlap with #628 or #616;
- stale C5W claim overlap is authority-level only; adapted dryrun/rating/incremental and shared Weight ranker remain excluded.

Production files:
- `tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js`;
- `tabs/model-converters/converters/xmltocii2019_helper/xml-cii-parent-run-parity-weight-scope.js`.

Qualification/custody:
- `tests/xml-cii-parent-run-parity-weight-scan.test.mjs`;
- exact pre-edit backup;
- PR/WIP metadata.

## Performance change

```text
Before parent parity:
branch/process Preview + eligibleNodes × WeightMaster ranking -> nodeRows discarded

After:
branch/process Preview + eligibleNodes × zero WeightMaster rows -> branchRows consumed
```

The PR removes Weight Master row examination/candidate allocation/sorting from this parent pass. It does not claim to remove node traversal, DTXR resolution, or later standalone adapted Weight ranking.

## Authority / negative assurance

Preserved:
- same parent Preview branch/process resolver;
- same config object and synchronous config mutations;
- all non-master Weight settings;
- exact master-array identity after success/throw;
- full original master rows for later standalone adapted Preview;
- output parity verification remains fail-closed.

No engineering values, formulas, unit conversions, master data, Weight scoring thresholds/candidate semantics, overrides, support/GAP, topology, writer/runtime, Python or workflows changed.

## Validation

`VAL-001 PASS / SOURCE_INSPECTION / NONE` — parent caller consumes only branchRows; parent Preview source performs Weight ranking in the node loop after branch-row construction.

`VAL-002 PASS / LOCAL_EXECUTION / NONE` — mandatory repository backup command executed before existing-source edit. Backup #1 Git blob is exact pre-edit target `b7a9a541a6dfbbfe1d566b5ea251d9ca11081437`.

`VAL-003 PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED` — syntax plus focused deterministic regression passed. A 100,000-row Weight Master is exposed as zero rows during the callback; non-master Weight config, config identity, Preview mutation, exact restoration on success/throw, branchRows-only return, and production source integration are asserted.

`VAL-004 PASS / EXACT_BYTE_CUSTODY / NONE`:
- modified parent parity `ef13ef3f08c310741cdce95f237b4318ccd040cd`;
- helper `c3a6f88db3032aa661adec0493534e720a875e3c`;
- test `8196deb5bf00129ca807b924229dbd6d108c18cd`.

`VAL-005 NOT_RUN / ENVIRONMENT_BLOCKED` — full repository/browser real parent Preview branch-row before/after equivalence.

`VAL-006 NOT_RUN / GITHUB_STATE` — on checked PR head `2539076`, GitHub returned zero PR-triggered workflow runs and zero commit status contexts. This is not a CI PASS.

`VAL-007 PASS / GITHUB_STATE / NONE` — PR was open, draft and mergeable; review submissions = 0 and review threads = 0 at GE-004.

## Continuation

Keep PR draft. Do not widen into WeightMasterIndex, C5W incremental Preview, adapted Preview refactoring, or committed Preview snapshot. The next roadmap slice should be a new WIP/PR after fresh coordination grounding. Merge only on a new explicit owner instruction.
