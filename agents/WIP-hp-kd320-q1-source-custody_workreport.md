# WIP — KD320 Q1 Controlled Source Custody

## Recovery header
- WORK_INTENT: IMPLEMENT
- CRITICALITY: ENGINEERING_CRITICAL
- BRANCH: `agent/hp-kd320-q1-source-custody`
- BASE: `main@2f34c3904b6a4d70c577461e1ae3191f1bf4f713`
- PREDECESSOR: PR669 merged at `4246f1a088cf06f072a28660c6d49613fbb65013`
- BACKUP: `backup/hp-kd320-q1-source-custody-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_SUCCESSOR
- PRODUCTION_KERNEL_CHANGED: NO
- UI_CHANGED: NO
- LICENSED_SOURCE_CONTENT_ADDED: NO

## Mission
Harden the real Q1 source-custody boundary before any controlled receipt can support E01/E02 and G0.

## RCA
Merged Q1 had an asymmetric controlled-source ledger:

```text
Q1-SRC-B313-2024   -> controlledLedgerSourceRef = null
Q1-SRC-VIII3-2025  -> SRC-VIII3-2025-CONTROLLED
```

The Q1 audit only checked `controlledLedgerSourceRef` when supplied. This left the B31.3 receipt without a mandatory public-ledger identity for its restricted controlled copy.

## Fix
Canonical one-to-one custody is now:

```text
Q1-SRC-B313-2024  <-> SRC-B313-2024-CONTROLLED
Q1-SRC-VIII3-2025 <-> SRC-VIII3-2025-CONTROLLED
```

Both controlled source slots remain `PENDING_SECURE_HASH_AND_LOCATOR_RECONCILIATION`. Both receipts remain `PENDING_CONTROLLED_SOURCE_RECEIPT`.

`source-custody.js` rejects:
- missing/duplicate/reused source identity;
- wrong receipt -> controlled-source binding;
- wrong controlled-source -> receipt back-reference;
- non-restricted source type/storage/license;
- public content permission;
- formula/fatigue-curve oracle promotion;
- wrong standard/edition on the receipt;
- pending receipt carrying premature source evidence;
- verified receipt without secure reference, canonical SHA-256, exact locators, verifier custody, or independent checker custody;
- verified receipt paired with unreconciled source status;
- terminal status strings with any structural/evidence defect.

`sourceCustodyComplete` requires both terminal statuses **and** zero blockers.

## Source availability grounding
Repository search found only source-routing metadata and pending slots, not controlled standard bytes/hashes/locators. Connected Drive searches for B31.3/ASME-named controlled standards did not return a matching controlled standard. Therefore no source hash, locator, semantic definition, or Q1 PASS state is manufactured by this PR.

## Current engineering truth

```text
E01 = PENDING
E02 = PENDING
E03-E08 = PENDING
G0 = BLOCKED_PENDING_E01_E02
G1 = BLOCKED_PENDING_E03_E08
sourceCustodyComplete = false
```

## Changed-file ledger
1. `engineering/hp-class-standardization/qualification/kd3-oracle/source-ledger.json`
2. `engineering/hp-class-standardization/qualification/kd320-q1/source-receipts.json`
3. `engineering/hp-class-standardization/qualification/kd320-q1/source-custody.js`
4. `engineering/hp-class-standardization/qualification/kd320-q1/SOURCE_CUSTODY_READINESS.md`
5. `tests/b313-chapter-ix-kd320-q1-source-custody.test.mjs`
6. `scripts/verify-b313-ch9-kd320-q1.mjs`
7. recovery files only after this ledger

## Validation truth

```text
source-custody.js syntax             PASS / LOCAL_EXECUTION_EXACT_BLOB
source-custody.js Git blob           9da1f93753c3c93a4e64497115230e01b3f77bc5
exact blob identity                  PASS
focused source-custody harness       PASS 6/6 / IMPLEMENTATION_COUPLED
missing controlled source            PASS / blocked
wrong bidirectional ownership        PASS / blocked
status-only completion               PASS / blocked
missing verified receipt evidence    PASS / blocked
complete synthetic custody structure PASS / authority remains false
committed repository test file       NOT_RUN / NO_NATIVE_CHECKOUT
Q1 verify wrapper                    NOT_RUN / NO_NATIVE_CHECKOUT
full repository-native suite         NOT_RUN / ENVIRONMENT_BLOCKED
served browser                       NOT_APPLICABLE / NO_UI_CHANGE
real E01/E02 source verification     NOT_RUN / CONTROLLED_DOCUMENTS_UNAVAILABLE
SEM-001...014 extraction             NOT_RUN / CONTROLLED_DOCUMENTS_UNAVAILABLE
```

Do not convert any NOT_RUN entry into PASS.

## Authority boundary

```text
production route             USER_CALCULATED_KD3
nativeCoreKd3Qualified       false
codeCompliance               false
canUseForDesignAuthority     false
productionKernelAllowed      false
automaticPromotionAllowed    false
```

## Exact next engineering action
Obtain the real controlled B31.3-2024 and VIII-3-2025 documents through the secure project source process. For each document, record the secure storage reference, SHA-256 of exact bytes, exact Q1 locators, verifier identity/time and distinct independent checker identity/time. Only then move the corresponding source/receipt states and begin semantic extraction.

## Appendix A — takeover questions
1. Are there exactly two required Q1 controlled receipts?
2. Does each receipt have exactly one distinct controlled-ledger source?
3. Is the ownership bidirectional?
4. Can a public ASME identity substitute for the controlled source? No.
5. Can status strings alone set `sourceCustodyComplete=true`? No.
6. What verified-receipt evidence is mandatory?
7. Are controlled source bytes or licensed text committed here? No.
8. Are E01/E02 still pending? Yes.
9. Is G0 still blocked? Yes.
10. Is native KD320 authority still false? Yes.
