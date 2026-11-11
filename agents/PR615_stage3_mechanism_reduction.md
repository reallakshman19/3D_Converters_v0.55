# PR #615 Stage 3 — Mechanism-Level Result Reduction

## Grounding epoch

- WORK_INTENT: IMPLEMENT
- REPOSITORY_STATE: EXISTING_PR
- MUTATION_AUTHORITY: WRITE_ALLOWED by Owner instruction `ok proceed`
- CRITICALITY: ENGINEERING_CRITICAL
- EXECUTION_MODE: MANUAL
- BASE_BRANCH: `main`
- BASE_MAIN_SHA: `1d9340248b11569f7c7c4f02ac429c7d8c66ff81`
- PR: #615, draft/open/mergeable
- REPORT_BASIS_HEAD: `ef5ff76a2a1126cc9156d03594e173f51c5f946a`
- MERGE_AUTHORITY: OWNER_ONLY / NOT_GRANTED

## Coordination decision

Target stack:

```text
AssessmentUnitResult[]
  -> MechanismNumericResult.v1
  -> MechanismLineResult.v1
  -> qualified mechanism reducer
  -> EiMainLineAggregation.v2
```

Live overlap check:

- PR #571 owns mechanism coverage/identification contracts and explicitly excludes EI main-line aggregation.
- no open PR was found for `ei-mainline-aggregation.js`.
- no open PR was found for `MechanismLineResult` other than PR615.
- Stage 3 does not edit `converters/vibration/mechanisms/contracts.js`.
- Stage 3 does not edit FIT/AIV/SBC workspace files claimed by #479/#506/#508.

Classification: `SAFE` for the new result/reducer files; existing aggregation mutation was allowed after exact pre-edit custody was preserved.

## Defect fixed

Pre-Stage3 `ei-mainline-aggregation.js` iterated every required assessment-set item and directly pushed each `item.result.governingLof` into the EI aggregate. That permitted an unqualified cross-layer path such as:

```text
AIV pair 1 LOF
AIV pair 2 LOF
AIV pair 3 LOF
       -> global EI max()
```

without first proving a source-qualified AIV reduction from source-assessment-pair results to one AIV line result.

Stage 3 removes that path.

## Protected invariants

```text
ASSESSMENT_UNIT_LOF != MECHANISM_LINE_LOF
one mechanism -> at most one qualified EI main-line contributor
```

A single assessment unit may pass through by identity because no cross-unit reduction occurs. `MANY` assessment units fail closed until a mechanism-specific multi-item reduction rule is separately qualified.

No universal child-level max reducer is authorized.

## Implemented contracts

### `MechanismNumericResult.v1`

`converters/vibration/mechanisms/result-contracts.js`

Normalizes one `VibrationMechanismAssessmentItem.v1` into explicit numerical/result custody:

- exact mechanism and line/case/canonical scope;
- observed governing LOF retained separately from aggregation eligibility;
- Screening qualification required;
- `CALCULATED + CURRENT_RESULT` required;
- finite non-negative LOF required;
- stale/candidate/invalid evidence remains visible but `aggregationEligible=false`;
- no authority promotion.

### `MechanismLineResult.v1`

Represents one mechanism at one exact line/case/canonical scope.

A numeric `governingLof` is allowed only when:

```text
state = CURRENT_RESULT
aggregationEligible = true
reducer qualification is valid for the input cardinality
no blocking reasons exist
```

Incomplete line results cannot carry a numeric governing LOF.

### `VibrationMechanismReducerRegistry.v1`

`converters/vibration/mechanisms/reducers.js`

V1 explicitly registers each known mechanism and allows:

```text
ONE  -> IDENTITY_SINGLE_ASSESSMENT_UNIT / STRUCTURAL_IDENTITY_ONLY
ZERO -> INCOMPLETE
MANY -> INCOMPLETE / MULTI_ITEM_REDUCTION_UNQUALIFIED:<mechanism>
```

All current `multiItemRule` values are `null`. The registry explicitly states:

```text
universalMultiItemReducer = false
multiItemReductionQualified = false
```

This is deliberate fail-closed custody, not a claim that every mechanism ultimately uses no multi-item reducer.

## EI aggregation migration

`converters/vibration/ei-mainline-aggregation.js` now uses:

```text
EiMainLineAggregation.v2
EiMainLineAggregationPolicy.v2
EI-AVIFF2-MAINLINE-2026-08-18
```

The policy fingerprint now includes reducer-registry revision/fingerprint.

Aggregation flow is now:

```text
T1 identification
  -> coverage/completeness
  -> benchmark readiness
  -> assessment set
  -> MechanismLineResult.v1
  -> one eligible contributor per mechanism
  -> governed cross-mechanism MAX
```

The aggregation rule is now named:

```text
MAX_APPLICABLE_QUALIFIED_MECHANISM_LINE_LOF
```

Caller-supplied `mechanismLineResults`, reducer registries, and reducer overrides are forbidden in this slice so a second authority store cannot be injected.

Output now includes `mechanismLineResults` for auditability. Contributors contain the line-result ID, source item IDs, reduction record, and one mechanism-level LOF.

## Main falsifier changed

The old M4 regression expected three qualified AIV child items to contribute individually and return `0.63`.

That expectation is intentionally reversed. With AIV items `[0.21, 0.63, 0.47]` and no qualified AIV multi-item reducer, the required result is:

```text
state             = INCOMPLETE
eiMainLineLof     = null
contributors      = []
line result state = INCOMPLETE
reason            = MECHANISM_LINE_REDUCTION:aiv:MULTI_ITEM_REDUCTION_UNQUALIFIED:aiv
```

Single-item FIT and single-item AIV identity cases remain usable, and the governed cross-mechanism maximum still applies after both have one qualified mechanism-line result.

## Backup custody

Exact pre-edit branch bytes were preserved before mutation:

```text
.backups/connector-20260818-pr615-stage3/converters/vibration/ei-mainline-aggregation.js
.backups/connector-20260818-pr615-stage3/tests/vibration-ei-mainline-aggregation.test.mjs
```

The native repository backup CLI was not available because there is no native checkout/network in the execution environment. This is recorded as exact connector-source custody, not as a backup-CLI PASS.

## Validation ledger

### Reducer contract execution

Available local Node surface using the Stage-3 result/reducer implementation:

```text
node --check result-contracts.js                    PASS
node --check reducers.js                           PASS
vibration-mechanism-line-result focused harness   PASS 8/8
```

Material falsifiers covered:

- one current Screening item -> identity line result;
- stale -> incomplete, observed LOF retained;
- candidate -> incomplete;
- undefined/NaN/Infinity/negative LOF -> incomplete;
- three AIV items -> no implicit max;
- zero items -> incomplete, not N/A;
- reducer registry has no universal multi-item rule;
- scope/mechanism mismatch and unknown mechanism -> fail closed.

Evidence classification:

```text
STATUS      PASS
OBSERVATION LOCAL_EXECUTION / reconstructed focused surface
ORACLE      IMPLEMENTATION_COUPLED + explicit independent falsifier expectations
```

### Aggregator integration harness

The migrated aggregation logic was executed with controlled stubs for coverage/benchmark dependencies while using the Stage-3 reducer/result implementation:

```text
FIT one-item identity                  PASS
FIT + AIV one-item max                 PASS
AIV MANY fail-closed                   PASS
caller mechanismLineResults override   PASS
TOTAL                                  PASS 4/4
```

This is a focused integration harness, not execution of the repository's native coverage/benchmark/matrix stack.

### Source/size inspection

- current aggregator source contains the reducer call and no direct contributor loop over `item.result.governingLof`;
- `ei-mainline-aggregation.js` has no content at line 295 -> `<295` physical lines;
- `result-contracts.js` has no content at line 300 -> `<300`;
- `reducers.js` has no content at line 300 -> `<300`;
- focused Stage-3 test has no content at line 300 -> `<300`.

### Truthful remaining gates

- repository-native current-head M4 test: `NOT_RUN / ENVIRONMENT_BLOCKED`;
- full Vibration/FIT/AIV/SBC regression suites: `NOT_RUN`;
- matrix consumer current-head execution: `NOT_RUN`;
- served browser: `NOT_RUN`;
- independent engineering review: `NOT_RUN`.

No missing hosted run/status is treated as PASS.

## Negative assurance

Stage 3 does **not** change:

- EI equations or coefficients;
- T1 applicability rules;
- benchmark oracle values/tolerances;
- mechanism screening/design authority;
- Product Freeze state;
- FIT/AIV/SBC numerical workspaces;
- `converters/vibration/mechanisms/contracts.js`;
- generic `.eit` export;
- workflow files.

## Appendix A

NOT_REQUIRED_FOR_CONTINUATION — same active implementation agent and same PR; not a takeover. Engineering-critical authority and validation rules remain in force.

## EXACT_NEXT_ACTION

Re-ground PR615 and active claims. The next common engineering stack should define/qualify actual multi-item mechanism reducers only where controlled method evidence supports them, starting with the highest-value live multi-unit mechanisms (AIV source-assessment pairs and deadleg branches) or, if source evidence remains unresolved, proceed instead to FIT physical/process custody without inventing reduction rules. Leave PR615 draft/unmerged unless the Owner explicitly authorizes merge.
