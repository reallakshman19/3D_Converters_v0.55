# WIP — KD320 Q2 Oracle Semantic-Custody Hardening

## Recovery header

- REPOSITORY: `reallaksh19/3D_Converters`
- BRANCH: `agent/hp-kd320-q2-semantic-custody`
- BASE: `main@12f9601b7fe9441f7cf7750da5892c09e5ebab7a`
- PREDECESSOR: PR660 merged by squash at the base SHA.
- CRITICALITY: ENGINEERING_CRITICAL
- WORK_INTENT: QUALIFICATION_CONTRACT_HARDENING
- BACKUP: `backup/hp-kd320-q2-semantic-custody-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_SUCCESSOR
- PRODUCTION_KERNEL_CHANGED: NO
- UI_CHANGED: NO
- LICENSED_SOURCE_CONTENT_ADDED: NO

## Handover in 60 seconds

This branch closes a Q2 traceability gap before any controlled KD320 source or oracle is admitted.

Prior state:

- Q1 correctly required all `KD320-SEM-001...014`.
- 2023->2025 edition reconciliation correctly required `KD320-SEM-002...013`.
- QF023 project-oracle admission required only `KD320-SEM-002...011`.
- QF022 published-oracle admission did not require explicit semantic refs or controlled target-source receipt refs.
- the numerical chain validated numbers and correction-parameter shape, but did not expose deterministic stage-to-semantic custody.

That could allow a future otherwise-complete candidate to omit applicability/fail-closed semantic custody from the oracle while still reaching Q2 readiness.

Current branch requires both QF022 and QF023 to explicitly cite all method semantics `KD320-SEM-002...013`. QF023 must cite both Q1 receipts. QF022 must cite `Q1-SRC-VIII3-2025`. Correction-parameter semantic refs are restricted to the method set rather than Q1 routing/release semantics.

## Engineering custody map

```text
stress-state selection          KD320-SEM-002
Salt                            KD320-SEM-003
associated mean stress          KD320-SEM-004
correction parameters           KD320-SEM-006
Seq                             KD320-SEM-007
fatigue-curve selection         KD320-SEM-008
fatigue-curve evaluation        KD320-SEM-009
N                               KD320-SEM-010
material / temperature          KD320-SEM-011
applicability envelope          KD320-SEM-012
fail-closed limits              KD320-SEM-013
```

SEM-005 remains part of the required full method semantic set because compression/negative/zero-mean branch treatment can govern the mean-stress route even though it is not represented as a separate numerical chain field.

## Authority boundary

Must remain permanently false in this stage:

```text
nativeCoreKd3Qualified       false
codeCompliance               false
canUseForDesignAuthority     false
productionKernelAllowed      false
automaticPromotionAllowed    false
```

No KD320 equation, fatigue-curve point, licensed ASME text, production arithmetic, or automatic promotion path is added.

## Changed-file ledger before PR allocation

1. `engineering/hp-class-standardization/qualification/kd320-q2/intake.js`
   - exact method semantic set = SEM002...013;
   - QF022/QF023 explicit oracle semantic custody;
   - QF023 both receipt refs;
   - QF022 controlled VIII3-2025 receipt ref;
   - deterministic numerical-chain semantic custody map;
   - supplied oracle blockers enumerated even while Q1 is still pending;
   - authority remains false.
2. `engineering/hp-class-standardization/qualification/kd320-q2/csv-intake.js`
   - project CSV now requires SEM002...013;
   - published CSV gains `semantic_refs` and `source_receipt_refs`;
   - correction parameters restricted to method semantics;
   - templates remain value-free.
3. `engineering/hp-class-standardization/qualification/kd320-q2/candidate.template.json`
   - project and published oracle placeholders carry exact method semantics and receipt custody;
   - no engineering values filled.
4. `engineering/hp-class-standardization/qualification/kd320-q2/README.md`
   - documents method-semantic and receipt custody.
5. `tests/b313-chapter-ix-kd320-q2-blocker-enumeration.test.mjs`
   - readiness and negative admission regressions.
6. `tests/b313-chapter-ix-kd320-csv-intake.test.mjs`
   - direct project/published CSV custody regressions.
7. `tests/b313-chapter-ix-kd320-csv-four-record-intake.test.mjs`
   - four-record facade custody regressions.
8. `tests/b313-chapter-ix-kd320-q2-template-contract.test.mjs`
   - candidate template shape/custody/authority regression.

Recovery artifacts are added separately.

## Key decisions

DEC-001 — Q1 completeness still requires all 14 semantics. Q2 oracle method custody requires SEM002...013 only. SEM001 is B31.3 invocation/routing; SEM014 is result/review/release custody. Neither is valid as a correction-parameter semantic ref.

DEC-002 — QF023 cites both B31.3 and VIII3 controlled receipts because it is the project route tied to B31.3 Chapter IX invocation plus VIII3 KD-3 calculation.

DEC-003 — QF022 cites the controlled VIII3-2025 receipt because it is the primary VIII3 numerical oracle. B31.3 receipt custody remains a Q1/QF023 concern.

DEC-004 — retain `kd320-q2-admission-candidate/v1`. No Q2 candidate has reached admission readiness because real Q1 controlled receipts/semantics are still pending. This patch tightens the pre-admission fail-closed contract rather than migrating qualified/admitted records.

DEC-005 — no new evidence UI. Existing four-record UI delegates to the changed intake contract and therefore inherits the gate.

## Validation ledger

| Check | Status | Classification | Notes |
|---|---|---|---|
| Branch grounding | PASS | GITHUB_REFERENCE | exact base `12f9601...` |
| `intake.js` syntax | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | Node v22.16.0 |
| `csv-intake.js` syntax | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | Node v22.16.0 |
| focused Q2 semantic-custody harness | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | 9 assertion groups |
| ready candidate with full custody | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | reaches `Q2_ORACLE_ADMISSION_READY` only; authority stays false |
| QF023 missing SEM012/013 | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | fail closed |
| QF022 missing SEM013 | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | fail closed |
| QF022 missing VIII3 receipt ref | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | fail closed |
| correction parameter using SEM014 | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | fail closed |
| direct project/published CSV focused paths | PASS | LOCAL_EXECUTION / IMPLEMENTATION_COUPLED | new refs retained |
| full committed test files | NOT_RUN | ENVIRONMENT_BLOCKED | no repository checkout |
| full repository-native suite | NOT_RUN | ENVIRONMENT_BLOCKED | github.com DNS unavailable |
| served browser | NOT_RUN | NOT_APPLICABLE | no UI change |
| independent KD320 engineering qualification | NOT_RUN | OUT_OF_SCOPE | real controlled Q1 data still absent |

No unexecuted check is represented as PASS.

## Current true engineering blocker after this branch

This branch does **not** make Q1 or Q2 complete. Real evidence still required:

```text
Q1-SRC-B313-2024 controlled receipt
Q1-SRC-VIII3-2025 controlled receipt
KD320-SEM-001...014 independently checked extraction
PVP2025-154710 retained source SHA
controlled 2023->2025 SEM002...013 reconciliation
QF022 admitted numerical chain
QF023 independent project numerical chain
```

Until those are real and independently checked, `USER_CALCULATED_KD3` remains the production route and native KD320 stays blocked.

## EXACT_NEXT_ACTION

Finish recovery metadata, re-ground live main and PR649 coordination, allocate a draft PR, add PR-numbered recovery records, refresh exact-head mergeability/status/workflow/review truth, and leave the successor unmerged pending explicit owner authorization.
