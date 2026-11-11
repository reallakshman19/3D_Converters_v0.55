# PR672 — PR1290 KD320 Candidate Adjudication

## Recovery header
- PR: #672
- TITLE: `qual(hp): quarantine and adjudicate Advanced_Analysis PR1290 KD320 candidate evidence`
- BRANCH: `agent/hp-kd320-pr1290-candidate-adjudication`
- BASE_AT_ALLOCATION: `main@cd88796a69075cb63565ea08f3dbbab5dfe32c6e`
- SOURCE_CANDIDATE: `Advanced_Analysis#1290@ef9445469fbddd3a34e51c83e295bb749ae79c73`
- CRITICALITY: ENGINEERING_CRITICAL
- STATE: OPEN_DRAFT_HANDOVER_READY
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR672

## Handover in 60 seconds
PR672 does not qualify native KD320. It quarantines the newly merged `Advanced_Analysis#1290` B31.3/KD-2/KD-3 package as `PROJECT_SOURCE_EXTRACTION_CANDIDATE` and creates a machine-verifiable adjudication boundary.

The package is useful candidate extraction evidence, but cannot satisfy either controlled Q1 receipt or promote any `KD320-SEM-001...014` item.

## Current engineering truth

```text
production route                   USER_CALCULATED_KD3
source candidate class             PROJECT_SOURCE_EXTRACTION_CANDIDATE
canSatisfyControlledSourceReceipt  false
canPromoteQ1SemanticItem           false
q1EvidenceStateMayChange           false
nativeCoreKd3Qualified             false
codeCompliance                     false
canUseForDesignAuthority           false
productionKernelAllowed            false
automaticPromotionAllowed          false
```

## Candidate blockers encoded

```text
PR1290_B313_TARGET_RECEIPT_Q1_SRC_B313_2024_NOT_SATISFIED
PR1290_VIII3_TARGET_RECEIPT_Q1_SRC_VIII3_2025_NOT_SATISFIED
PR1290_B313_MIXED_OR_NON_TARGET_EDITION_CLAIM
PR1290_B313_CONTROLLED_SOURCE_IDENTITY_INCOMPLETE
PR1290_KD2_EDITION_UNDECLARED
PR1290_KD3_2013_TO_2025_RECONCILIATION_REQUIRED
PR1290_INDEPENDENT_CHECKER_CUSTODY_MISSING
PR1290_PUBLIC_STANDARD_SOURCE_BYTES_CANNOT_SATISFY_SECURE_Q1_RECEIPT
PR1290_FATIGUE_CURVE_POINTS_NOT_TARGET_EDITION_QUALIFIED
PR1290_CURVE_BELOW_DOMAIN_RULE_AMBIGUOUS
PR1290_SEM014_RESULT_RELEASE_CUSTODY_NOT_ESTABLISHED
```

The auditor also inventories the PR1290 `0.90` clamp, `700 F` threshold, `Kr`, `Ke`, analytical curve fits and log-log interpolation as `CANDIDATE_UNVERIFIED` only.

## Semantic mapping

All canonical semantic IDs are represented in the candidate manifest:

```text
SEM-001      B31.3 routing candidate
SEM-002..013 KD-2/KD-3 candidate extraction
SEM-014      NOT_ESTABLISHED
```

Every candidate row has `promotable=false`.

## Arithmetic-only checks

Three independent consistency checks are retained without Code-authority claims:

```text
B31.3 candidate thickness <-> pressure round trip
KD-2 candidate bore stress-intensity identity
KD-3 candidate log-log interpolation midpoint identity
```

Permanent label:

```text
ARITHMETIC_CONSISTENCY_ONLY_NOT_CODE_QUALIFICATION
```

## Changed-file ledger
Engineering/test scope:

1. `engineering/hp-class-standardization/qualification/kd320-q1/pr1290-candidate-reconciliation.json`
2. `engineering/hp-class-standardization/qualification/kd320-q1/pr1290-candidate-audit.js`
3. `scripts/audit-b313-ch9-kd320-pr1290-candidate.mjs`
4. `tests/b313-chapter-ix-kd320-pr1290-candidate.test.mjs`

Recovery scope:
- `agents/PR672_workreport.md`
- `agents/status/PR672.yaml`
- `agents/claims/PR672.yaml`

No production kernel, UI, master data, Q1 receipt or fatigue-curve runtime file is changed.

## Validation ledger

```text
candidate-audit.js lines                220
candidate-audit.js exact Git blob       af1f6214f9ad93fff84a8f19b2d4db7eb24baa7a
candidate-audit.js exact local blob     af1f6214f9ad93fff84a8f19b2d4db7eb24baa7a
candidate-audit.js syntax               PASS / LOCAL_EXECUTION_EXACT_BLOB
CLI syntax                              PASS / LOCAL_EXECUTION
focused candidate harness               PASS 6/6 / IMPLEMENTATION_COUPLED
pinned-byte drift                       PASS / blocked
source SHA mismatch                     PASS / blocked
authority promotion                     PASS / blocked
edition/source/endpoint blockers        PASS / enumerated
candidate arithmetic identities         PASS / NON_CODE_AUTHORITY
actual PR1290 full directory CLI run    NOT_RUN / NO_NATIVE_CHECKOUT_OR_BINARY_MATERIALIZATION
full repository-native suite            NOT_RUN / ENVIRONMENT_BLOCKED
commit status entries                   0 returned -> NOT_RUN
PR-triggered workflow runs              0 returned -> NOT_RUN
reviews / review threads                0 / 0
```

Do not convert any `NOT_RUN` item to PASS.

## Repository-operation note
During branch setup a placeholder file was accidentally created on `main` and immediately removed. The tree returned to the exact pre-operation tree (`457b7c6a70c82ae793e61fb54e6b81d6e7f48388`), so there is no net file-content change; two no-op history commits remain on `main`. Main history was not rewritten.

## Exact next action
After PR672 is reviewed/merged by explicit owner authority, stop software plumbing. Obtain the real secure controlled B31.3-2024 and VIII-3-2025 receipts, then adjudicate candidate statements against target-edition source evidence into independently checked `KD320-SEM-001...014`. Only after Q1 exit should QF022/QF023 be completed.

## Appendix A — takeover questions
1. Why can PR1290 not satisfy `Q1-SRC-B313-2024`?
2. Why does `edition: 2024 / 2022` block B31.3 authority?
3. Why is an undeclared KD-2 edition a blocker even if the arithmetic is correct?
4. What target-edition reconciliation is required for the KD-3 2013 package?
5. Why are source PDF SHA matches integrity evidence but not Code qualification?
6. Which PR1290 normative claims remain `CANDIDATE_UNVERIFIED`?
7. What is the state of SEM-014?
8. Can the arithmetic-only checks promote Q1? No.
9. What production route remains active? `USER_CALCULATED_KD3`.
10. Which validations are PASS and which are NOT_RUN?
