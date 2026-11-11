# WIP — KD320 Q2 Controlled Evidence + Oracle Admission

## Recovery Header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
WORK_INTENT: QUALIFICATION_EVIDENCE
CRITICALITY: ENGINEERING_CRITICAL
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: AUTO
AUTO_STATE: RUNNING
MERGE_AUTHORITY: OWNER_ONLY / NOT_GRANTED
REPOSITORY: reallaksh19/3D_Converters
WIP: WIP-hp-kd320-q2-admission
BRANCH: agent/hp-kd320-q2-admission-intake
STACKED_BASE_PR: 619
STACKED_BASE_HEAD: e32ab20c44b2f1b60e2a117fb05c2d87023637de
MAIN_AT_GROUNDING: 22b7b57fed3e78534da41342fc3240c8d27369c3
NATIVE_CORE_KD320: NOT_QUALIFIED / BLOCKED
CODE_COMPLIANCE: FALSE
DESIGN_AUTHORITY: FALSE
HIGHEST_RISK: Treating evidence-intake readiness as native calculation or product authority.
EXACT_NEXT_ACTION: Publish the exact tested Q2 intake as a stacked draft PR on PR619; reconcile live base, diff, reviews and checks.
```

## Mission

Implement the next safe qualification increment after PR619: a machine-verifiable intake contract for controlled KD320 semantic evidence and independent numerical oracle custody.

This WIP does not implement KD320 arithmetic and does not modify Q1 evidence, the existing oracle catalog, production fatigue code, HP UI, package scripts, or workflows.

## Grounding / coordination

Current main at implementation grounding:

```text
22b7b57fed3e78534da41342fc3240c8d27369c3
```

PR619 is the only open KD320 successor and is the explicit stacked dependency:

```text
PR619 head = e32ab20c44b2f1b60e2a117fb05c2d87023637de
state      = OPEN / DRAFT
mergeable  = TRUE
```

No existing `kd320-q2` implementation was found.

```text
PR619 coordination = STACKED_DEPENDENCY
exact-file overlap = NONE
authority overlap = COORDINATED / SAME QUALIFICATION PROGRAM
```

## Inherited Q1/Q2 gates

Existing Q1 evidence ledger requires E01-E08 and G0-G1 plus independent semantic checker custody before Q2 numerical expectations may be populated.

Existing oracle catalog reserves:

```text
KD3-QF-022 = independent published numerical example
KD3-QF-023 = independently checked project calculation
```

Therefore one project calculation may be retained as useful evidence, but cannot by itself complete Q2.

## Implemented capability

```bash
node scripts/verify-b313-ch9-kd320-q2-candidate.mjs <candidate.json>
node scripts/verify-b313-ch9-kd320-q2-candidate.mjs <candidate.json> --require-ready
```

Candidate schema:

```text
kd320-q2-admission-candidate/v1
```

Derived states:

```text
Q1_CONTROLLED_EVIDENCE_PENDING
Q1_COMPLETE_Q2_ORACLE_PENDING
Q2_PROJECT_ORACLE_RETAINED_PRIMARY_PENDING
Q2_PRIMARY_ORACLE_RETAINED_PROJECT_PENDING
Q2_ORACLE_ADMISSION_READY
```

No caller-provided readiness flag is trusted.

## Controlled-source custody

Exactly two source receipts are accepted:

```text
Q1-SRC-B313-2024
Q1-SRC-VIII3-2025
```

Each requires VERIFIED state, secure-storage reference, canonical SHA-256, exact locators, verifier custody, and a distinct independent checker.

Licensed source text is not stored in repository artifacts.

## Semantic custody

Exactly 14 canonical rows are accepted:

```text
KD320-SEM-001 ... KD320-SEM-014
```

Each must be independently checked and retain controlled source reference, exact locator, opaque controlled semantic reference, units, sign rule, selection rule, interpolation rule, applicability rule, extractor custody, and distinct independent checker custody.

Unexpected semantic/receipt rows are rejected rather than silently ignored.

## Numerical oracle custody

Both numerical oracle slots retain:

```text
Salt
-> associated mean-stress quantity
-> correction parameters
-> Seq
-> N
```

Project slot:

```text
KD3-QF-023
INDEPENDENT_CHECKED_PROJECT_CALCULATION
B31.3 2024
VIII-3 2025
KD3-FATIGUE-001
ROUTE-KD3-2024
```

It also requires controlled Q1 receipt/semantic references and distinct calculator/checker custody.

Primary-published slot:

```text
KD3-QF-022
PRIMARY_PUBLISHED_NUMERICAL_ORACLE
VIII-3 2025
KD3-FATIGUE-001
```

It requires bibliographic identity, exact locator, canonical source SHA-256 and distinct extraction/admission custody.

## Authority invariant

Every state, including `Q2_ORACLE_ADMISSION_READY`, returns:

```text
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
productionKernelAllowed = false
automaticPromotionAllowed = false
```

A ready Q2 candidate authorizes only:

```text
Q3_ISOLATED_NATIVE_KERNEL_IMPLEMENTATION_CANDIDATE
```

not production execution.

## Validation

Executed locally on exact authored executable/test files:

```text
intake.js syntax                       PASS
verifier CLI syntax                    PASS
focused candidate tests                9 / 9 PASS
partial Q1 pending state               PASS
project-only oracle state              PASS
full Q2 admission state                PASS
checker identity collision             PASS
semantic omission                      PASS
full Salt->mean->params->Seq->N chain  PASS
authority promotion rejection          PASS
unexpected semantic row rejection      PASS
file verifier contract                 PASS
```

Template smoke:

```text
default CLI exit        0
template state          Q1_CONTROLLED_EVIDENCE_PENDING
--require-ready exit    2
native authority        false
```

Exact publication blobs:

```text
intake.js                  a36dfd88aa713554b110cc427578a93a6a771051
candidate.template.json    9e1957b122244a1c227e6644a030a47edc9cf0c6
README.md                  28c08866627c6b8befecb970b28d9b5a587186ce
verifier CLI               7e543cea45f1263de05260b104a487cb948c4d74
focused test               56ea0b87c751af03e0d7acf476f54e6ef32262a8
```

Full repository/Q1 execution is NOT_RUN in this isolated workspace.

## Changed-file plan

```text
engineering/hp-class-standardization/qualification/kd320-q2/intake.js
engineering/hp-class-standardization/qualification/kd320-q2/candidate.template.json
engineering/hp-class-standardization/qualification/kd320-q2/README.md
scripts/verify-b313-ch9-kd320-q2-candidate.mjs
tests/b313-chapter-ix-kd320-q2-candidate.test.mjs
agents/WIP-hp-kd320-q2-admission_workreport.md
agents/status/WIP-hp-kd320-q2-admission.yaml
agents/claims/WIP-hp-kd320-q2-admission.yaml
```

All are new files. No existing file is edited.

## Appendix A

```text
A1 Production Trace        20/20
A2 Failure Isolation       20/20
A3 Authority / Invariant   20/20
A4 Independent Validation  19/20
A5 Minimal Patch Boundary  20/20
TOTAL                       99/100
```

One point is withheld because the full repository/Q1 verification chain is not executed in this isolated workspace.

## Hard boundary after this WIP

This intake does not supply the missing engineering evidence. Native KD320 arithmetic remains prohibited until a real candidate provides controlled B31.3/VIII-3 receipt custody, all 14 independently checked semantics, the project numerical oracle, and the primary published numerical oracle.
