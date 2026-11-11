# WIP — KD320 Q1 Formal Exit / Q2 Admission Gate

## Recovery header

- WORK_INTENT: IMPLEMENT
- CRITICALITY: ENGINEERING_CRITICAL
- BRANCH: `agent/hp-kd320-q1-formal-exit`
- BASE: `main@e67b5790a8c6f63ff1fc33edd848facfdc90537a`
- PREDECESSOR: PR663 merged at base SHA.
- BACKUP: `backup/hp-kd320-q1-formal-exit-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_SUCCESSOR
- PRODUCTION_KERNEL_CHANGED: NO
- UI_CHANGED: NO
- LICENSED_SOURCE_CONTENT_ADDED: NO

## Mission

Close the formal qualification-boundary gap between Q1 and Q2. Q2 previously inferred `q1Complete` from verified receipts + independently checked semantics alone, while the formal Q1 audit requires E01-E08 PASS and G0/G1 PASS as well.

## RCA

Formal Q1 audit in `scripts/audit-b313-ch9-kd320-q1.mjs` defines completion as:

```text
2 verified source receipts
+ all 14 independently checked semantics
+ E01-E08 PASS
+ G0 PASS
+ G1 PASS
```

Merged Q2 intake after PR663 defined:

```text
q1Complete = receiptsComplete && semanticsComplete
```

This allowed a structurally complete future Q2 candidate to bypass the formal evidence-ledger gate.

A second regression was identified after PR663: `tests/b313-chapter-ix-kd320-q2-candidate.test.mjs` still used the old QF023 SEM002-011 set and omitted QF022 semantic/receipt refs because the full repository suite was NOT_RUN before PR663 merge.

A third pre-existing diagnostic gap was exposed by extended execution: after Q1 completion, a missing QF022/QF023 slot changed state correctly but did not emit the explicit `PRIMARY_PUBLISHED_ORACLE_MISSING` / `PROJECT_ORACLE_MISSING` blocker.

## Implementation

New `kd320-q1/formal-exit.js` validates a redacted formal Q1 exit attestation bound to:

```text
record = VR-B313-CH9-KD320-NATIVE-001-Q1
status = Q1_COMPLETE_Q2_ORACLE_POPULATION_ALLOWED
exact B31.3-2024 + VIII-3-2025 receipt document hashes
all SEM001-014 source/locator/opaque-semantic bindings
exact E01-E08 PASS reference set
exact G0/G1 PASS reference set
controlled evidence-ledger secure ref + SHA-256
Q1 audit-report secure ref + SHA-256
attestor + independent checker identities/timestamps
permanently false native/design/Code authority
```

Canonical source binding is rechecked independently:

```text
SEM001      -> Q1-SRC-B313-2024
SEM002-014  -> Q1-SRC-VIII3-2025
```

Q2 now computes:

```text
q1Complete = receiptsComplete && semanticsComplete && q1Exit.ready
```

When formal Q1 is complete, absent oracle slots are explicitly enumerated as blockers.

## Authority boundary

```text
production route             USER_CALCULATED_KD3
nativeCoreKd3Qualified       false
codeCompliance               false
canUseForDesignAuthority     false
productionKernelAllowed      false
automaticPromotionAllowed    false
```

No KD320 equation, fatigue-curve data, licensed Code text, production arithmetic, UI, workflow, or authority promotion is added.

## Validation so far

Local focused execution was built from the exact committed module/test bytes and checked against Git blob identities.

```text
formal-exit.js lines                      148
q2 intake.js lines                        279
formal-exit.js syntax                     PASS
q2 intake.js syntax                       PASS
focused formal/Q2/file-verifier tests     PASS 27/27
receipt+semantic Q1 bypass                PASS / blocked
E08 or G1 omission                        PASS / blocked
receipt hash mismatch                     PASS / blocked
semantic locator/ref mismatch             PASS / blocked
noncanonical SEM001 source                PASS / blocked
attestor/checker collision                PASS / blocked
authority promotion in attestation        PASS / blocked
QF022/QF023 semantic custody              PASS / retained
missing post-Q1 oracle blocker             PASS / explicit after fix
file verifier with complete candidate     PASS
```

Exact local/Git blob identity confirmed for:

```text
formal-exit.js                             6717815bf5ca580f9ec8ff8ed1cae80899e22455
formal-exit-attestation.template.json      6cca42c427f09a333906124b2eed33119a08c4a4
q2/intake.js                               d24156d8912d3f6125465f040d134b85b35c12b4
q1 formal-exit test                        a9d608dfb9500ca7f3d74b18df12e381ad5c1de2
q2 blocker-enumeration test                3ec836bb0caaa99a9853e094312fda9dd9151b1e
q2 candidate test                          1f6e16643784dc950cdbeb01b88872dfdf170d2a
existing Q2 file verifier                  7e543cea45f1263de05260b104a487cb948c4d74
```

Classification: `LOCAL_EXECUTION / IMPLEMENTATION_COUPLED`, strengthened by exact Git blob identity. It is not independent ASME/KD320 engineering qualification.

Full repository-native suite: `NOT_RUN / ENVIRONMENT_BLOCKED` because the execution container still cannot resolve `github.com` for checkout.

## Remaining before PR allocation

1. Final structural-error review for malformed Q1 exit records.
2. Final branch/main re-grounding and changed-file reconciliation.
3. Create PR-numbered recovery artifacts.
4. Open draft PR; do not merge without explicit owner authority for that PR.

## Appendix A — takeover questions

1. Does Q2 still require formal E01-E08/G0-G1 exit rather than inferring Q1 from receipts/semantics?
2. Are receipt hashes and every SEM001-014 locator/ref bound to the attestation?
3. Is SEM001 bound only to B31.3 and SEM002-014 only to VIII-3?
4. Can any missing/invalid attestation produce `q1Complete=true`? It must not.
5. Are native/design/Code authorities still false in every returned state?
6. Is any licensed Code text/equation/curve data present? It must not be.
7. Are absent QF022/QF023 slots explicit blockers after formal Q1 exit?
8. Which checks are real runtime PASS versus NOT_RUN?
