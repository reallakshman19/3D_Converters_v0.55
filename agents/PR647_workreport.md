# PR647 Work Report — SBC connection structural/evidence authoring

## Identity

```text
PR                    #647
branch                agent/sbc-connection-evidence-20260819
stack base            PR646 / agent/sbc-full-vertical-ui-20260819
base SHA              706b692581326803a091fe6418c0a2bdf1d627f0
implementation head   5b49894d4a48c460b361c6d66af46902a83b5063
hosted inspection     b933ea3cdc2fc2a8f6537c5f931599e9a57712b1
criticality           ENGINEERING_CRITICAL
state                 OPEN / DRAFT
execution mode        AUTO
merge authority       OWNER_ONLY / NOT_GRANTED
```

Primary issue #563; family gate #429; Type-3 source/freeze neighbor #514 / PR546.

## Mission and delivered behavior

PR646 made the SBC vertical truthful as Type 1–4, but only scope + explicit Type were editable for the full vertical. PR647 adds governed **project-input structural/evidence authoring for Type 1, Type 2 and Type 4** while retaining every current engineering-authority boundary.

Production trace:

```text
SBC workspace
-> exact connection/facility scope
-> explicit Type 1 / 2 / 4 selection
-> VibrationSbcConnectionAuthoringStore.v1
-> exact SbcTypeInputContract.v1 paths
-> explicit project value + explicit project evidence reference
-> existing SBC-UNIT-* reference semantic trace
-> existing validateSbcTypeInputStructure()
-> structural/project-evidence readiness presentation
```

This chain ends before numerical SBC execution.

## Appendix A

```text
A1 Production Trace              19/20
A2 Current Failure Isolation     19/20
A3 Authority / Invariant         20/20
A4 Independent Validation        18/20
A5 Next-Commit / Minimal Patch   19/20
TOTAL                            95/100
DISPOSITION                      QUALIFIED_FOR_BOUNDED_SBC_CONNECTION_AUTHORING
```

## Authoring model

`tabs/vibration-integrity-sbc-connection-model.js` — 296 physical lines.

It provides:

- immutable per-scope project-input custody;
- exact contract-path values + evidence references;
- explicit parsing only; no inferred/default engineering values;
- Type retarget that preserves common fields and discards hidden old Type-specific fields;
- nested structural input made only from explicit valid values;
- the existing SBC structural validator as rules authority;
- existing `SBC-UNIT-*` reference semantic traces;
- independent project-evidence completeness;
- permanent `engineeringAuthority=NONE`, `screeningAuthority=NOT_AUTHORIZED`, `designAuthority=false`, `numericalExecutionAllowed=false`.

## UI behavior

`tabs/vibration-integrity-sbc-connection-view.js` — 104 physical lines.

- Type 1/2/4 contract fields are editable project inputs.
- Source-native unit / reference semantic trace appears where available.
- Every value has an explicit project evidence reference.
- Exact missing/invalid/contradictory conditions are visible.
- Structural completeness and project-evidence completeness remain distinct.
- Numerical execution is visibly disabled.

Type 3 deliberately renders:

```text
NO SECOND INPUT AUTHORITY
```

and continues to use the existing Type-3 candidate panel. PR546 remains authoritative for Type-3 source/freeze reconciliation.

A source review corrected two presentation hazards before handoff:

1. `STRUCTURE_COMPLETE_PROJECT_EVIDENCE_INCOMPLETE` remains warning-styled rather than being treated as complete by substring matching.
2. the UI says `Reference semantic trace`, not `Controlled semantic reference`, because current `SBC-UNIT-*` rows are explicitly reference-only / PDF-review-pending.

## Shell / audit integration

The Vibration shell initializes the new authoring store and routes only Type 1/2/4 generic connection edits into it. Audit events:

```text
SBC_CONNECTION_AUTHORING_CHANGED / VALUE_CHANGED
SBC_CONNECTION_AUTHORING_CHANGED / EVIDENCE_REF_CHANGED
```

These edits do not mutate Type-3 candidate currentness and do not promote FIT/SBC governing authority.

## Cache custody

Current authoring UI key:

```text
20260819-sbc-connection-authoring-1
```

Propagated:

```text
index.html
-> main-rhbg-fitguard.js
-> core/app.js
-> core/engineering-tabs-extension.js
-> tabs/engineering-workspace-tab.js
-> tabs/engineering-calculations-tab.js
-> tabs/vibration-integrity-tab.js
-> tabs/vibration-integrity-user-data-shell.js
-> SBC workspace / connection view / connection model
```

Unchanged Type-3 numerical/currentness descendants remain on `20260815-sbc-pf05-cache-1`; AIV retains `20260816-aiv-canvas-release-1`.

## Regression source committed

`tests/vibration-sbc-connection-authoring.test.mjs` plus updated cache tests pin:

- complete Type-1 structural/project evidence still has no numerical authority;
- structural completeness != project-evidence completeness;
- FIT-only main-line rejection;
- Type-2 same-main-line confirmation and contradictory parent-line failure;
- Type-4 distinct-main-line bridge structure;
- invalid positive-number syntax not injected into structural input;
- missing fields remain missing / no hidden defaults;
- `SBC-UNIT-*` reference traces remain non-qualified/non-numerical;
- Type-3 generic UI contains no duplicate editable fields;
- numerical execution stays disabled;
- startup-to-authoring cache identity is pinned;
- Type-3 PF-05, AIV and Mechanical custody stay separate.

These are committed regression sources. Repository-native execution did **not** run in this connector environment.

## Numerical qualification readiness — hard stop

Current governed benchmark registry:

```text
benchmarkExecutionAllowed                  false
productionExpectedValueGenerationForbidden true
TYPE_1 B1  SOURCE_AND_EXPECTED_VALUES_NOT_FROZEN / expectedValuesPresent=false
TYPE_1 B2  MISSING_INDEPENDENT_ENGINEERING_EVIDENCE / expectedValuesPresent=false
TYPE_2 B1  SOURCE_AND_EXPECTED_VALUES_NOT_FROZEN / expectedValuesPresent=false
TYPE_2 B2  MISSING_INDEPENDENT_ENGINEERING_EVIDENCE / expectedValuesPresent=false
TYPE_4 B1  SOURCE_AND_EXPECTED_VALUES_NOT_FROZEN / expectedValuesPresent=false
TYPE_4 B2  MISSING_INDEPENDENT_ENGINEERING_EVIDENCE / expectedValuesPresent=false
```

Source/method gates also retain:

```text
controlled PDF page review           NOT_RUN / ENVIRONMENT_BLOCKED
Flowchart T3-1 reconciliation        NOT_ESTABLISHED
numerical unit policy                NOT_FROZEN
independent engineering review       NOT_ESTABLISHED
SBC-EQ/TBL/CONST/ASS rows            UNPOPULATED
```

Therefore AUTO mode stops before Type 1/2/4 numerical kernels. D5/D6/D8 transcriptions remain structural/reference evidence only and are not reverse-engineered into equations or expected values.

Blocker:

```text
NUMERICAL_QUALIFICATION_BLOCKED_BY_CONTROLLED_SOURCE_AND_B2_EVIDENCE
```

## Scope reconciliation

Implementation-head comparison to exact PR646 base:

```text
ahead / behind          22 / 0
changed files           17 including WIP recovery metadata at that checkpoint
workflow files          0
SBC numerical kernels  0
SBC master/curve data  0
benchmark expected data 0
EI aggregation files   0
```

New recovery files replace the WIP records after PR647 allocation; WIP records are retired.

## Rollback custody

Native backup CLI unavailable. Pre-edit stacked-branch blobs:

```text
tabs/vibration-integrity-sbc-workspace-view.js          713710fa071711120246c28e63f0417658dc3599
tabs/vibration-integrity-user-data-shell.js             73b66e452241ce40cce712b1542f69f771a8db0c
index.html                                              388668902abad55e8d38d3798d30887fddd620f2
main-rhbg-fitguard.js                                   9df44514b214053e0f1a924b3c16dcc37b738aa8
core/app.js                                             b63b35490866bc9403a850a9f7abeaa0021066b5
core/engineering-tabs-extension.js                      01d789e8103989058215d08496ff68a5574f3896
tabs/engineering-workspace-tab.js                       4c94760f8147cc9f40620a195cd804eae96bac8a
tabs/engineering-calculations-tab.js                    ee43b6631c91f3ecf86c4f06d35e9c7f43a03db9
tabs/vibration-integrity-tab.js                         59555e0daf68bfcca540c8f734101cdc91f28d39
tests/vibration-sbc-full-workspace-cache-chain.test.mjs 718be9846919c068197204841c93610608a5d080
tests/vibration-sbc-type3-runtime-cache-chain.test.mjs  6da19827f0d3b4e06f9a8b7da17063124c364dff
```

These blobs are rollback evidence only, not native-backup PASS.

## Validation truth

Hosted inspection on head `b933ea3cdc2fc2a8f6537c5f931599e9a57712b1`:

```text
GitHub mergeable                     true
commit statuses                      0 -> NOT_RUN, not PASS
PR workflow runs                     0 -> NOT_RUN, not PASS
reviews                              0
review threads                       0
```

Other validation:

```text
live source grounding                PASS / GITHUB_SOURCE
Appendix A                           PASS 95/100 / EVIDENCE_REVIEW
stack compare / isolation            PASS / GITHUB_COMPARE + DIFF_INSPECTION
new module size gate                 PASS / 296 + 104 physical lines
native backup CLI                    NOT_RUN / ENVIRONMENT_BLOCKED
native git remote probe              NOT_RUN / ENVIRONMENT_BLOCKED / DNS github.com
repository-native Node tests         NOT_RUN / ENVIRONMENT_BLOCKED
served browser acceptance            NOT_RUN / ENVIRONMENT_BLOCKED
independent SBC engineering review   NOT_RUN
```

No source inspection or committed-but-unexecuted test is represented as runtime/browser PASS.

## Coordination / handoff

- PR647 is stacked on PR646 and must reconcile after PR646 moves/lands.
- PR546 retains Type-3 source/freeze authority; PR647 does not touch its paths or candidate-input custody.
- No workflow change.
- No merge authority.

## Exact next action

Wait for controlled source/B1/B2 engineering evidence (or explicit owner direction on evidence acquisition). Do not implement Type 1/2/4 numerics, promote lifecycle, or merge PR647 without the required authority/evidence gates.
