# WIP-XMLCII-RUN-PARITY-WEIGHT-20260818 — Parent Run-parity discarded Weight scan

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
SOURCE_TASK: Owner-directed XML→CII (2019) Standalone source-level performance remediation.
PR_OR_WIP: WIP-XMLCII-RUN-PARITY-WEIGHT-20260818
BRANCH: agent/xml-cii-run-parity-weight-scan-20260818
PR_HEAD_OBSERVED: 5b7149b23374f33f817c2ce6420ba85b4beadbfd
REPORT_BASIS_HEAD: 5b7149b23374f33f817c2ce6420ba85b4beadbfd
MAIN_HEAD_LAST_CHECKED: 1d5930638e6f9714a2c29af328fe15a4e6b8b7f6
MERGE_BASE: bca7fc9390c018753d09161052b0bf2fd54e33ce
BASE_DRIFT: SAFE_TO_CONTINUE / ONE_UNRELATED_HIGH_PR_QUALIFICATION_COMMIT
REPORT_SYNC: CURRENT
APPENDIX_A_STATUS: NOT_REQUIRED_NEW_WORK_ITEM
GROUNDING_EPOCH: GE-002
CURRENT_STAGE: VALIDATE
CURRENT_BLOCKER: NONE
HIGHEST_RISK: Real parent Preview branch-row equivalence with full repository dependencies remains unexecuted locally; code-level dependency trace and fail-closed helper invariants are qualified.
LAST_DURABLE_CHECKPOINT: Surgical integration complete; exact remote production blob matches locally syntax-checked/tested blob ef13ef3f08c310741cdce95f237b4318ccd040cd.
EXACT_NEXT_ACTION: Recheck active PR overlap, update compact status, run pre-PR changed-file gate, then publish draft PR without merging.
```

## 1. Handover in 60 Seconds

The parent Model Converters Run-parity stage needs only `branchRows` from `xmlCiiDryRunPreview()`. The parent Preview still walks eligible nodes and calls `rankXmlCiiWeightCandidates`, causing a full Weight Master scan for node rankings that this caller discards. Standalone Run later executes the adapted Preview and consumes real node/Weight rows, so this earlier parent scoring pass is redundant.

Implementation adds `xmlCiiParentRunParityBranchRows()`. During only the synchronous parent Preview call it temporarily replaces `config.weight.masterRows` with `[]`, passes the same config object and all other Weight settings unchanged, returns only `branchRows`, and restores the exact original master-row array in `finally`.

This is narrower than a true branch-only Preview mode: node traversal and other node-side work still occur. Only Weight Master scoring is removed from this discarded pass.

## 2. Repository ground truth / coordination

- original merge base: `bca7fc9390c018753d09161052b0bf2fd54e33ce`;
- live main now: `1d5930638e6f9714a2c29af328fe15a4e6b8b7f6`;
- drift commit is High-Pr qualification work; exact target blob on live main remains `b7a9a541a6dfbbfe1d566b5ea251d9ca11081437`;
- classification: `SAFE_TO_CONTINUE`, no rebase/conflict guess required;
- `agents/MASTER_INDEX.md`: absent;
- PR #628 is separate Bore/Wall work;
- PR #616 owns Preview-search only;
- stale active C5W claim owns adapted Preview dryrun/rating/incremental files, not this parent parity file;
- broader Weight authority overlap is acknowledged as `COORDINATION_REQUIRED_BOUNDED`; C5W exact files and the shared Weight ranker are excluded.

## 3. Scope / files

Production:
- `tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js` — one import plus replacement of the direct `.branchRows` call;
- `tabs/model-converters/converters/xmltocii2019_helper/xml-cii-parent-run-parity-weight-scope.js` — 24-line new helper.

Qualification/custody:
- `tests/xml-cii-parent-run-parity-weight-scan.test.mjs`;
- exact pre-edit backup `.backups/1_tabs_model_converters_converters_xmltocii2019_helper_enrichment_run_parity_js.bak`;
- WIP report/status/claim.

Out of scope: adapted Preview, Weight ranking/model semantics, Weight overrides, writer/runtime, Python, support/GAP, Line/Piping/Material/Rating authority, workers, workflows, committed Preview snapshot.

## 4. Technical change

Before parent parity:

```text
parent Preview branch computation
+ for each eligible node: rank against Weight Master
-> caller discards nodeRows
```

After:

```text
save exact config.weight.masterRows reference
config.weight.masterRows = []
try parent Preview using same config object
finally restore exact reference
consume branchRows
```

The expected eliminated work in this stage is the Weight-ranking master-row examination, approximately `O(eligibleNodes × weightMasterRows)` plus candidate allocations/sorts. It does not claim elimination of node traversal itself.

## 5. Authority / invariants

Protected:
1. same parent Preview resolver produces branch/process rows;
2. same `enriched.config` object is passed, so synchronous resolver mutations/provenance remain visible;
3. `weight.npsToDn`, bore token/regex/inch conversion and every non-`masterRows` Weight option remain visible;
4. exact original `masterRows` array identity is restored after success and exception;
5. standalone adapted Preview/Weight Match still receives the original config/master rows later;
6. no parity verification or publication gate is removed.

Falsifier: any branch-row dependency on Weight Master rows, lost config mutation, failed restoration, or any final standalone Weight result change.

## 6. Validation evidence

`VAL-001 PASS / SOURCE_INSPECTION / NONE` — current parent parity consumes only `.branchRows`; parent Preview source shows node Weight ranking after branch-row construction and before return.

`VAL-002 PASS / LOCAL_EXECUTION / NONE` — mandatory backup. Reconstructed target hash before edit was `b7a9a541a6dfbbfe1d566b5ea251d9ca11081437`, matching live main. `node utils/backup.js save ...` produced backup #1; backup Git blob is the same `b7a9a541...`. A local reconstruction-only CommonJS/module-mode conflict was corrected before source mutation and did not affect repository bytes.

`VAL-003 PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED` — syntax and helper regression:

```text
node --input-type=module --check < enrichment-run-parity.js
node --check xml-cii-parent-run-parity-weight-scope.js
node --check tests/xml-cii-parent-run-parity-weight-scan.test.mjs
node tests/xml-cii-parent-run-parity-weight-scan.test.mjs
```

Result: `XML CII parent Run-parity Weight scan suppression checks passed.`

The 100,000-row deterministic case observes zero Weight Master rows inside the parent callback, verifies all other Weight config, preserves exact config identity and Preview-side mutation, and restores exact master-array identity. Exception restoration, empty-master behavior, branchRows-only return, and source integration are also asserted.

`VAL-004 PASS / EXACT_BYTE_CUSTODY / NONE` — remote production blob after update is `ef13ef3f08c310741cdce95f237b4318ccd040cd`, equal to the locally executed modified blob. Helper blob is `c3a6f88db3032aa661adec0493534e720a875e3c`; test blob is `8196deb5bf00129ca807b924229dbd6d108c18cd`.

`VAL-005 NOT_RUN / ENVIRONMENT_BLOCKED` — complete repository/browser parent Preview branch-row before/after equivalence. Direct repository checkout remains unavailable from this execution environment; this must not be stated as PASS.

`VAL-006 NOT_RUN` — repository-native CI/checks, pending draft PR allocation.

## 7. Negative assurance

No engineering values, formulas, unit conversions, master data, Weight ranking thresholds/candidate semantics, overrides, support/GAP semantics, topology, writer/runtime logic, Python conversion, workflow configuration, or output parity gate changed. The new helper does not persist or cache authority.

## 8. Base drift / changed-file gate

At GE-002 live main is one unrelated commit ahead. Target source is byte-identical to the merge-base version, so work is safe to continue without rebasing. Current compare reports only the declared backup, WIP metadata, two production files, and focused test.

## 9. Review / CI

No PR allocated yet. No CI/review state exists for this WIP. Draft publication is the next stage; merge authority remains owner-only.

## 10. Continuation

Do not widen this PR into WeightMasterIndex, adapted Preview, C5W incremental behavior, or committed Preview snapshot work. Recheck exact-file/authority overlap, publish draft, migrate WIP custody to PR-numbered records, inspect exact PR head/checks/reviews, and leave draft.
