# PR517 — AIV PF-02 Production Freeze Work Report

## Recovery header

```text
HANDOVER_READINESS: READY
WORK_INTENT: IMPLEMENT
REPOSITORY_STATE: EXISTING_PR
MUTATION_AUTHORITY: EVIDENCE_AND_RECOVERY_WRITE_ALLOWED
PRODUCTION_MUTATION_AUTHORITY: BLOCKED_PENDING_LIVE_REPRODUCTION
CRITICALITY: ENGINEERING_CRITICAL
EXECUTION_MODE: AUTO
AUTO_STATE: RUNNING_BLOCKED_AT_LIVE_PRODUCT_GATE
SCOPE_AUTHORITY: ISSUE_513_PF02_READINESS_EXECUTABLE_PARITY
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR517
PR: 517
BRANCH: agent/aiv-pf02-readiness-contract-20260815
LIVE_MAIN_BASIS: 3c3a01ebe00abaa739252c2e67bacb5126540182
OLD_PR_HEAD: 4c6e15c80ba6f2ebb4985397575f044eb0893048
REGROUND_COMMIT: 132f50e6311b2a869dc616d9c2cb4b505c088927
BACKUP_BRANCH: backup/pr517-pre-reground-20260819
GROUNDING_EPOCH: PR517-PF02-GE-20260819-AUTO-01
TAKEOVER_DISPOSITION: SALVAGE_PARTIAL_EVIDENCE_ONLY
APPENDIX_A_STATUS: PASS_95_OF_100_SCOPE_LIMITED
```

## Handover in 60 seconds

PF-02 owns one question:

> Does `READY_FOR_QUALIFICATION` represent the same executable engineering precondition enforced by the registered AIV screening path?

Current-main tracing still says **not proven**, and now identifies concrete parity mismatches at source level. Production code is not patched because PF-02's own live-product-first gate remains binding.

The branch was rebuilt linearly on current main with the original six evidence/recovery files. The old branch head is preserved at `backup/pr517-pre-reground-20260819`.

## Current production trace

```text
CSV / table input
  -> AIV tabular parsers
  -> buildAivReadiness()
  -> readiness counts
  -> isAivScreeningReady()
  -> buildAivEngineeringScreeningRequest()
  -> calculateEngineering(VIB.AIV.ACOUSTIC)
  -> adapter validateInput()
  -> calculateAiv(... qualificationMode='screening')
  -> calculateAivKernelCandidateSource()
  -> point contribution / combination
  -> assessment SCREENING result
```

Authority remains:

```text
screening result scope          ASSESSMENT
line/case summary authority     false
design authority               false
SVG/pixel distance authority    false
```

## Concrete current-main mismatch evidence

### Unsupported quantity unit

Current tabular quantity parsing requires a value+unit pair but preserves the unit string without checking the numerical kernel's unit envelope.

Current readiness validates source mass flow by positive value only:

```text
if (!(row.massFlow.value > 0)) -> invalid
```

It does not validate `row.massFlow.unit`.

The current kernel accepts only:

```text
kg/s
kg/h
```

and otherwise throws:

```text
AIV_CANDIDATE_UNIT_UNSUPPORTED
```

A supporting local execution of exact extracted current source logic proved:

```text
parser quantity { value: 53482, unit: 'lb/h' }  -> preserved
kernel massFlowKgS(...)                         -> AIV_CANDIDATE_UNIT_UNSUPPORTED
```

Therefore readiness can lack a unit blocker for an input that the numerical path rejects. This is a concrete **source-contract parity mismatch**, but it is not represented as a full registered-API or browser reproduction.

### Pressure ordering

Current readiness checks positive absolute pressure and gauge-reference evidence, but does not compare resolved upstream and downstream absolute pressures.

The current kernel explicitly requires:

```text
p1PaAbs > p2PaAbs
```

and throws `AIV_CANDIDATE_PRESSURE_DROP_INVALID` otherwise.

Supporting extracted source-logic execution confirmed equal absolute pressures hit that kernel rejection.

### Other parity domains still requiring executable matrix coverage

Source inspection also requires exact-current-head execution for:
- temperature unit/domain;
- pressure units after gauge/absolute basis resolution;
- molecular-weight units;
- distance units;
- diameter units;
- complete assessment-type method envelope;
- trim/sonic edge cases;
- valid controlled D.2.3 positive path.

No unsupported engineering state is promoted to a conclusion based only on source inspection.

## Current source custody

```text
converters/vibration/aiv/aiv-readiness.js
  6423267fd49b3d720874a7b699b0b48a657a5df6

converters/vibration/aiv/aiv-calculator.js
  5014342e1436ca9fbf723242a348f768fb842f0c

converters/vibration/aiv/aiv-kernel-candidate.js
  b0967c4c2e9fb98c90b6a3e9028ce9851e9bbcbb

converters/engineering-calculations/adapters/vibration-aiv.js
  2dff38ac41005a7835c14cc3ed9502da46e70524

converters/engineering-calculations/engine.js
  7b37f45cd22789e565ce8c4b1c31d01a263f9c74

converters/vibration/aiv/source-csv.js
  057c57c7d26aaa69b81eeaa0d802d24c3af433c9

converters/vibration/aiv/aiv-tabular-common.js
  7db1eac719093013d8ed3bb9c478e5e246145b63

tabs/vibration-aiv-screening-gate.js
  dcde1fadd5b54f17d07e63da4705680dbcf152d4

tabs/vibration-aiv-screening-request.js
  a9bcef48c9bab98dd8229b5435c6dc87e9f86749
```

## Appendix A — engineering-critical takeover qualification

Basis: current main, current AIV parser/readiness/gate/request/adapter/calculator/kernel/engine, existing PR517 evidence, and the PF-02 live-product gate.

```text
A1 Production Trace               20/20
   Traced current table/parser -> readiness -> UI gate/request -> registered adapter -> calculator -> kernel path.

A2 Current Failure Isolation      20/20
   Isolated concrete unit and pressure-order parity mismatches; falsifier remains the exact-current-head executable UI/API matrix.

A3 Authority / Invariant          20/20
   Assessment-only screening, line/case non-authority, design=false and presentation-distance non-authority remain protected. PF-03 grouping and equations are excluded.

A4 Independent Validation         17/20
   Current source contracts cross-check parser/readiness against kernel rejection and supporting extracted source logic executes the unit/pressure cases. Real registered API and browser matrix remain NOT_RUN.

A5 Next Commit / Minimal Patch    18/20
   Evidence/recovery action is exact. If live reproduction clears the gate, the minimal production correction is one shared PF-02 executable-domain contract consumed by readiness and screening execution, without PF-03 grouping semantics.

TOTAL                              95/100
DISPOSITION                        QUALIFIED_FOR_CURRENT_MAIN_PF02_EVIDENCE_REGROUND_ONLY
PRODUCTION_MUTATION                BLOCKED_PENDING_LIVE_REPRODUCTION
```

The 95/100 score does not waive the live-product gate and does not authorize a production patch.

## Validation truth

Executed/supporting:

```text
current-main source grounding                         PASS / SOURCE_INSPECTION
current PR clean re-ground                            PASS / current-main linear history
unit parser -> kernel mismatch source logic           PASS / LOCAL_EXECUTION_EXTRACTED_CURRENT_LOGIC
pressure-order kernel rejection source logic          PASS / LOCAL_EXECUTION_EXTRACTED_CURRENT_LOGIC
```

Still NOT_RUN:

```text
exact-current-head real application Chromium matrix  NOT_RUN / ENVIRONMENT_BLOCKED
full registered calculateEngineering PF-02 matrix    NOT_RUN / NO_FULL_CHECKOUT
B1-B14 current-head release matrix                    NOT_RUN
native release suite                                  NOT_RUN / ENVIRONMENT_BLOCKED
native node utils/backup.js                           NOT_RUN / NO_CHECKOUT
```

The local source-logic execution is deliberately not labeled a registered-API or browser PASS.

## Production mutation gate

Do **not** modify current AIV readiness/calculator/adapter production code in this environment unless one of the following occurs:

1. a navigation-permitted exact-current-head live app reproduces the PF-02 parity defect, or
2. the Owner explicitly changes/waives the PF-02 live-product-first requirement.

If the live matrix shows no actual parity defect, disposition becomes `NOT_REPRODUCIBLE_ON_CURRENT_MAIN` and no PR506 behavior is replayed.

## Candidate fix shape if the gate clears

Smallest acceptable shape:

```text
PF02ExecutableDomain.v1
  -> parser-independent canonical input checks
  -> readiness consumes same domain checks
  -> screening calculator/adapter consumes same domain checks
```

Must include only PF-02 domains. It must **not** import PR506's PF-03 simultaneous-source-group semantics, change masters/equations/oracles, widen result scope, or grant design authority.

## Current disposition / next action

AUTO mode has reached the exact external execution gate. Update current PF-02 validation records with this current-head source-contract reproduction and hosted state, then keep #517 draft/unmerged and blocked for production mutation until the required live executable matrix becomes available or the Owner changes that gate.
