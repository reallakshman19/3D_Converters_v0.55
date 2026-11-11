# PR #615 Stage 4 — FIT Natural-Frequency Custody

## Recovery control

```text
WORK_INTENT       IMPLEMENT
REPOSITORY_STATE  EXISTING_PR
MUTATION_AUTHORITY WRITE_ALLOWED by Owner `proceed`
CRITICALITY       ENGINEERING_CRITICAL
EXECUTION_MODE    MANUAL
BASE_BRANCH       main
LIVE_MAIN_START   22b7b57fed3e78534da41342fc3240c8d27369c3
PR                #615
BRANCH            agent/vibration-eit-roadmap-20260818
PRE_STAGE_HEAD    8900bb955aba680c21eaeee553dd07aeddff71be
IMPLEMENTATION_HEAD_BEFORE_REPORT 574e1e778b1030ed52430d9bfd2749a1a6329daf
PR_STATE          OPEN / DRAFT / UNMERGED
MERGE_AUTHORITY   OWNER_ONLY / NOT_GRANTED
```

Four non-overlapping XML->CII `main` commits were already outstanding at Stage-4 start. They remain a merge-time reconciliation item; Stage 4 does not import them into the vibration branch merely to appear current.

## Why Stage 4 narrowed to frequency only

Re-grounding showed the other proposed M5 custody work is already landed on `main`:

- #582 — explicit wall/span/support/process/scenario engineering basis;
- #584 — exact nominal catalogue custody without DN/schedule inference;
- #586 — geometry-consistency authority blocked with no invented tolerance;
- #588 — STANDARD/NORMAL -> ACTUAL conversion authority blocked.

Stage 4 therefore does **not** duplicate geometry, support/span, process reference basis, multiphase resolution, or operating-scenario custody.

## Defect corrected

Before Stage 4, optional `NATURAL_FREQUENCY` was accepted by the facility planner when only these were present:

```text
finite number
non-empty unit
```

The selected row was then copied directly into:

```text
request.inputs.naturalFrequency
request.inputUnits.naturalFrequency
```

The existing enrichment model already carries:

```text
source
sourceRevision
recordId
status
reviewer
```

but the facility request boundary did not require those provenance fields before an `fn` could reach the optional FIT advanced branch.

Protected invariant:

```text
SUPPLIED_NATURAL_FREQUENCY != CUSTODIED_NATURAL_FREQUENCY
UNCUSTODIED_FN MUST NOT ENTER REQUEST.INPUTS
```

Natural frequency remains optional. No row means the standard FIT request remains available.

## New contract

Added:

```text
converters/vibration/facility/fit-frequency-custody.js
FitFacilityNaturalFrequencyCustody.v1
```

States:

```text
NOT_PROVIDED
CUSTODIED
INCOMPLETE
```

Selection:

```text
CASE_SPECIFIC
GLOBAL
NOT_PRESENT
```

A supplied row becomes `CUSTODIED` only when:

```text
value is finite and > 0
unit is non-blank
source is non-blank
sourceRevision is non-blank
recordId is non-blank
status is non-blank
```

`reviewer` is preserved when supplied but is deliberately not invented as a mandatory approval rule.

The contract does not infer or normalize a source-method taxonomy such as MEASURED / FEA / ANALYTICAL / VENDOR. It only proves that the supplied engineering quantity has traceable source identity/status metadata.

Authority is fixed at:

```text
authority                FREQUENCY_PROVENANCE_CUSTODY_ONLY
numericalMethodAuthority false
engineeringAuthority     NONE
screeningAuthority       NOT_AUTHORIZED
designAuthority          false
```

## Exact-scope behavior

Case-specific evidence has precedence.

```text
case-specific row exists
  -> use that row only
  -> if incomplete, fail closed
  -> DO NOT fall back to global

no case-specific row
  -> global row may be used
```

This prevents a case-scoped but incomplete frequency from being silently replaced by a different global value.

## Production integration

### `fit-engineering-basis.js`

Revision-bumped:

```text
FitFacilityEngineeringBasis.v1
-> FitFacilityEngineeringBasis.v2
```

The basis now:

- resolves `FitFacilityNaturalFrequencyCustody.v1`;
- merges frequency `missing`, `invalid`, and `reasons` into readiness;
- exposes `engineeringBasis.frequency`;
- exposes `trace.frequencyCustody`.

No calculation ID or FIT numerical method revision changes.

### `fit-plan-item.js`

Removed the independent `resolveNaturalFrequency()` path.

Request construction now reads only:

```text
engineeringBasis.frequency.resolved
```

If custody is incomplete, facility readiness is `NOT_READY` and `request=null`.

If frequency is absent, `frequency.state=NOT_PROVIDED` and no natural-frequency input is written.

Existing source-trace compatibility is retained:

```text
sourceTrace.frequency
sourceTrace.geometry.naturalFrequency
```

both point to the governed custody trace.

## Data-entry compatibility

The existing FIT blocker CSV already carries:

```text
Source
Source Revision
Record ID
Status
Reviewer
```

and its conversion to enrichment preserves revision/record/reviewer and writes an explicit manual-blocker status. Therefore the new frequency provenance requirements are satisfiable through the existing tabular input mechanism; no new CSV format or UI field is required in Stage 4.

Controlled EI facility benchmark generation currently does not supply `NATURAL_FREQUENCY`, so standard benchmark paths are not newly blocked.

## Test-first evidence

The focused regression was committed before production repair:

```text
tests/vibration-facility-fit-frequency-custody.test.mjs
```

It freezes eight expectations:

1. no fn -> standard request remains READY / no request frequency;
2. supplied fn with incomplete provenance -> NOT_READY;
3. zero/negative supplied fn -> NOT_READY;
4. complete case fn -> CUSTODIED and passed unchanged;
5. complete global fn -> used only with no case row;
6. incomplete case fn shadows global and fails closed;
7. reviewer optional but retained;
8. custody creates no numerical/design authority.

## Validation evidence

### Exact custody module execution

Available Node runtime, exact Stage-4 custody module with dependency stubs matching the production lookup/trace contract:

```text
node --check fit-frequency-custody.js  PASS
focused custody cases                  PASS 8/8
```

Material cases:

```text
NOT_PROVIDED                           PASS
missing sourceRevision/recordId/status PASS
zero / negative / NaN                  PASS
case-specific CUSTODIED                PASS
global fallback                        PASS
incomplete case shadows global         PASS
reviewer optional                      PASS
no authority promotion                 PASS
```

### Controlled plan-item integration harness

Executed the Stage-4 `fit-engineering-basis` + `fit-plan-item` logic with controlled non-frequency M5 dependencies:

```text
node --check fit-engineering-basis.js PASS
node --check fit-plan-item.js         PASS
no fn standard request                PASS
incomplete fn blocks request          PASS
case fn passed unchanged              PASS
bad case shadows valid global         PASS
TOTAL                                 PASS 4/4
```

This is a focused reconstructed dependency harness, not a claim that the repository-native M5 suite ran.

### Protected numerical blobs

Verified unchanged after mutation:

```text
converters/vibration/fit/method.js
2965155fe1d4d9081b91d1ff1113d7fb50ddbfd8

converters/vibration/fit/applicability.js
1bb9e1627948af74a00b964ea9048a77adc2c871

converters/vibration/fit/calculate.js
2a92e6efedefffe4ab66ab000f0c3e648c9e5e86
```

Therefore Stage 4 does not alter:

```text
FIT equations / coefficients
support-classification equations
1 < fn <= 3 Hz advanced boundary
standard/refined LOF logic
benchmark oracle values/tolerances
```

### Size guard

GitHub line-300 probes return empty content for:

```text
fit-frequency-custody.js
fit-engineering-basis.js
fit-plan-item.js
vibration-facility-fit-frequency-custody.test.mjs
```

All remain below the repository 300-physical-line ceiling.

### Truthful NOT_RUN

```text
repository-native current-head focused test   NOT_RUN / connector-only checkout limitation
existing full M5 engineering-basis suite      NOT_RUN
full Vibration/FIT/AIV/SBC release suites     NOT_RUN
served browser acceptance                     NOT_RUN
independent engineering review                NOT_RUN
```

No absent hosted workflow/status is treated as PASS.

## Backup custody

Exact connector-source pre-edit copies were committed before mutation:

```text
.backups/connector-20260818-pr615-stage4/converters/vibration/facility/fit-engineering-basis.js
  original blob 688e86d273b8682ae620cd81fedd95353b500f22

.backups/connector-20260818-pr615-stage4/converters/vibration/facility/fit-plan-item.js
  original blob 685fc4a60b879e08cb73c84cfb166d1efa6bc9b8
```

Native `utils/backup.js` execution is not claimed because no native repository checkout/network is available.

## Coordination / negative assurance

Open-PR searches found no exact active claim for the two facility files or natural-frequency custody.

Known claims remain untouched:

- #479 FIT top-level workspace;
- #506 shared Engineering Calculations tab + AIV runtime;
- #508 mechanism-matrix/SBC view paths;
- #539/#540 FIT adapter/family/console authority presentation.

Stage 4 does not touch:

```text
active mechanism workspaces
engineering equations
T1 applicability
multi-item reducers
EI main-line aggregation
benchmark values/tolerances
generic multi-module EIT export
design/code authority
Product Freeze
workflow files
```

## EXACT_NEXT_ACTION

Re-ground current `main`, PR head, reviews/checks and base drift; update PR615 current workreport/status/claim and PR description with Stage-4 evidence. Keep the PR draft/unmerged. Subsequent work should address the next unblocked evidence/custody gap rather than inventing AIV/deadleg multi-item reduction.
