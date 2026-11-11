# WIP — KD320 2023→2025 Edition Reconciliation Gate

## Recovery Header

```text
HANDOVER_READINESS: READY
WORK_INTENT: QUALIFICATION_EVIDENCE
CRITICALITY: ENGINEERING_CRITICAL
EXECUTION_MODE: AUTO
MERGE_AUTHORITY: OWNER_ONLY / NOT_GRANTED
REPOSITORY: reallaksh19/3D_Converters
BRANCH: agent/hp-kd320-edition-reconciliation
STACKED_BASE: PR623
TARGET: KD3-QF-022 / VIII-3 2025
SOURCE_REFERENCE: PVP2025-154710 / VIII-3 2023
NATIVE_CORE_KD320: NOT_QUALIFIED / BLOCKED
```

## Mission

Provide a machine-verifiable gate for reconciling the published PVP2025-154710 numerical cross-check, which cites VIII-3 2023, against the controlled VIII-3 2025 project target before the evidence can be submitted through the Q2 oracle-admission process.

No licensed Code text, KD320 formula, fatigue-curve points, production arithmetic, UI, central registry, or workflow is introduced.

## Contract

Required semantic comparison rows are `KD320-SEM-002` through `KD320-SEM-013`. Each row retains source and target edition, exact publication and controlled-source locators, opaque controlled-semantic reference, comparison disposition, comparator custody, and distinct independent-checker custody.

Allowed dispositions:

```text
IDENTICAL
EQUIVALENT_WITH_NON_NUMERICAL_EDITORIAL_CHANGE
CHANGED_REQUIRES_NEW_ORACLE
NOT_COMPARABLE
PENDING_CONTROLLED_2025_SOURCE
```

Only the first two can satisfy a row. Changed/non-comparable evidence requires a new target-2025 oracle.

## Authority boundary

Even a complete reconciliation returns:

```text
targetQf022Ready = false
q2OracleAdmissionReady = false
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
productionKernelAllowed = false
automaticPromotionAllowed = false
```

The only ready-state action is `SUBMIT_RECONCILED_PUBLISHED_ORACLE_THROUGH_Q2_ADMISSION`.

## Validation

```text
Node syntax                PASS
focused tests              10 / 10 PASS
template audit mode        PASS / pending state
strict template mode       FAIL-CLOSED / exit 2
new JS/MJS max lines       150 (<300)
```

Coverage includes full pending blocker enumeration through SEM-013, complete equivalence, changed semantics, missing locator, checker collision, source-edition spoofing, authority-promotion rejection, semantic-set mismatch, hash custody, and file-verifier parity.

## Hard boundary

The actual 2023→2025 engineering comparison remains `NOT_RUN / EVIDENCE_PENDING` because controlled licensed VIII-3 2025 semantics and source bytes are not available in this runtime. The gate must not be populated from inference.
