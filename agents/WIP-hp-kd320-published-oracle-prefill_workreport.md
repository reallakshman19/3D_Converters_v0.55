# WIP — KD320 Published Numerical Oracle Prefill

## Recovery Header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
WORK_INTENT: QUALIFICATION_EVIDENCE
CRITICALITY: ENGINEERING_CRITICAL
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: AUTO
MERGE_AUTHORITY: OWNER_ONLY / NOT_GRANTED
REPOSITORY: reallaksh19/3D_Converters
WIP: WIP-hp-kd320-published-oracle-prefill
BRANCH: agent/hp-kd320-published-oracle-prefill
STACKED_BASE_PR: 622
STACKED_BASE_HEAD: ea3ca3281ee9f41beba664b99263ca1dbcc48756
MAIN_AT_REGROUND: eef94949961970171d1366f5b6a9d421b3cc0d9f
NATIVE_CORE_KD320: NOT_QUALIFIED / BLOCKED
Q2_ORACLE_ADMISSION_READY: FALSE
CODE_COMPLIANCE: FALSE
DESIGN_AUTHORITY: FALSE
```

## Mission

Retain useful primary published VIII-3 KD-3 numerical cross-check evidence for `KD3-QF-022` while preventing publication year, an older Code edition, or a paper-derived numerical table from being silently promoted into the target VIII-3 2025 oracle.

This WIP does not modify Q1 controlled source receipts, Q1 semantic rows, the Q2 candidate template, production fatigue arithmetic, the HP UI, package scripts, or workflows.

## Retained published references

### PVP2025-154710

- DOI: `10.1115/PVP2025-154710`
- publication year: 2025
- paper-declared ASME VIII-3 edition: 2023
- retained numerical source: Section 3.2 / Table 3
- retained rows: 6
- chain represented in the paper data: alternating stress intensity -> associated mean stress -> correction parameter evidence -> equivalent alternating stress -> permissible cycles
- source PDF SHA-256: pending retained source bytes
- target-2025 reconciliation: not performed
- independent admission: not performed
- QF-022 eligibility: false

### PVP2024-123674

- DOI: `10.1115/PVP2024-123674`
- publication year: 2024
- paper-declared ASME VIII-3 edition: 2021
- retained numerical source: Section 5.1.4 / Table 8
- retained rows: 6
- reported cumulative damage: 0.172
- full Salt -> mean -> parameters -> Seq -> N chain: not retained
- source PDF SHA-256: pending retained source bytes
- target-2025 reconciliation: not performed
- independent admission: not performed
- QF-022 eligibility: false

The evidence registry stores numerical values and engineering metadata only. It does not reproduce licensed ASME Code text or a Code formula expression.

## Usable capability

```bash
node scripts/audit-b313-ch9-kd320-published-reference-prefill.mjs
```

The auditor checks:

1. target identity remains `KD3-QF-022 / VIII-3 2025 / KD3-FATIGUE-001`;
2. all authority flags remain false;
3. source SHA-256 custody;
4. Code-edition match to target 2025;
5. controlled 2025 edition reconciliation;
6. independent admission custody;
7. numerical-chain completeness and basic numerical validity;
8. no prefill artifact can auto-admit QF-022.

## Validation

Executed locally after interruption recovery:

```text
node syntax                     PASS
focused prefill tests           5 / 5 PASS
failures                        0
```

Exact published/tested technical blobs:

```text
candidates.json  97c5bc58e2874be90f4da333fb93b0c5e5c42f0b
README.md        a611c260263050a532a97c20886b05ac8ebb9c90
auditor          61f9757aa3d513cb4cb9428ada49c763e59e33a0
test             212283ae1c6ca0e0deb81282a7a7cdb10443575e
```

The local candidates file used for re-execution was a semantically equivalent reconstruction of the already-created candidate blob; therefore the test result qualifies auditor behavior and evidence semantics, not byte-for-byte re-execution of the candidate JSON blob.

## Authority invariant

```text
targetQf022Ready             = false
q2OracleAdmissionReady       = false
nativeCoreKd3Qualified       = false
codeCompliance               = false
canUseForDesignAuthority     = false
productionKernelAllowed      = false
automaticPromotionAllowed    = false
```

Even if apparent edition/hash/reconciliation/admission fields are changed to qualifying values inside the prefill artifact, the auditor rejects automatic QF-022 admission. Final admission must occur through the controlled PR622 Q2 candidate process after target-2025 reconciliation.

## Next action

1. retain actual source PDF bytes and canonical SHA-256 for the selected published oracle;
2. reconcile the paper's VIII-3 edition semantics against controlled `Q1-SRC-VIII3-2025`;
3. record independent admission custody;
4. construct the target-2025 `KD3-QF-022` Q2 candidate row;
5. run PR622 strict verifier;
6. do not begin Q3 native arithmetic until the real candidate reaches `Q2_ORACLE_ADMISSION_READY`.
