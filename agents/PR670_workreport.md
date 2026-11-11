# PR670 — KD320 Q1 Controlled Source Custody

## Recovery header
- PR: #670
- TITLE: `qual(hp): harden KD320 Q1 controlled source custody`
- BRANCH: `agent/hp-kd320-q1-source-custody`
- BASE_AT_ALLOCATION: `main@2f34c3904b6a4d70c577461e1ae3191f1bf4f713`
- PREDECESSOR: PR669 merged at `4246f1a088cf06f072a28660c6d49613fbb65013`
- CRITICALITY: ENGINEERING_CRITICAL
- STATE: OPEN_DRAFT_HANDOVER_READY
- BACKUP: `backup/hp-kd320-q1-source-custody-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR670

## Handover in 60 seconds
PR670 fixes a real G0 custody weakness: the B31.3-2024 receipt previously had no mandatory restricted controlled-source identity while VIII-3 did.

Canonical ownership is now:

```text
Q1-SRC-B313-2024  <-> SRC-B313-2024-CONTROLLED
Q1-SRC-VIII3-2025 <-> SRC-VIII3-2025-CONTROLLED
```

Both remain pending. No licensed source bytes, hashes, locators, semantics, equations, curve points, or numerical oracle values were manufactured.

## Fail-closed source-custody contract
`source-custody.js` requires:

- exact unique receipt/source IDs;
- one-to-one bidirectional ownership;
- ASME restricted source identity in `SECURE_STORE`;
- exact B31.3 2024 / VIII-3 2025 receipt identity;
- public-source-content prohibition;
- formula/curve oracle flags false;
- pending receipts have no premature secure evidence;
- verified receipts have secure ref, canonical SHA-256, exact locators, verifier timestamp and distinct checker timestamp;
- verified receipt pairs only with `CONTROLLED_SOURCE_RECONCILED`;
- `sourceCustodyComplete = true` only when terminal status and every structural/evidence rule passes.

Synthetic terminal statuses alone are insufficient.

## Current real engineering state

```text
sourceCustodyComplete = false
E01 = PENDING
E02 = PENDING
E03-E08 = PENDING
G0 = BLOCKED_PENDING_E01_E02
G1 = BLOCKED_PENDING_E03_E08
```

The repository does not contain the controlled document bytes/hashes/locators. Searches of the connected Drive did not locate a matching controlled B31.3/ASME standard by name. Therefore source verification and semantic extraction remain `NOT_RUN`.

## Changed-file ledger
Engineering/test scope:

1. `engineering/hp-class-standardization/qualification/kd3-oracle/source-ledger.json`
2. `engineering/hp-class-standardization/qualification/kd320-q1/source-receipts.json`
3. `engineering/hp-class-standardization/qualification/kd320-q1/source-custody.js`
4. `engineering/hp-class-standardization/qualification/kd320-q1/SOURCE_CUSTODY_READINESS.md`
5. `scripts/verify-b313-ch9-kd320-q1.mjs`
6. `tests/b313-chapter-ix-kd320-q1-source-custody.test.mjs`

Recovery scope:
- `agents/WIP-hp-kd320-q1-source-custody_workreport.md`
- `agents/status/WIP-hp-kd320-q1-source-custody.yaml`
- `agents/claims/WIP-hp-kd320-q1-source-custody.yaml`
- `agents/PR670_workreport.md`
- `agents/status/PR670.yaml`
- `agents/claims/PR670.yaml`

## Validation ledger

```text
source-custody.js lines              191
source-custody.js exact Git blob     9da1f93753c3c93a4e64497115230e01b3f77bc5
source-custody.js syntax             PASS / LOCAL_EXECUTION_EXACT_BLOB
focused source-custody harness       PASS 6/6 / IMPLEMENTATION_COUPLED
baseline pending custody             PASS / structurally valid, incomplete
status-only terminal state           PASS / blocked
missing SHA/locators/check custody   PASS / blocked
wrong bidirectional ownership        PASS / blocked
wrong receipt edition                PASS / blocked
complete synthetic custody package   PASS / structural completion only; authority false
committed repository test file       NOT_RUN / NO_NATIVE_CHECKOUT
Q1 verify wrapper                    NOT_RUN / NO_NATIVE_CHECKOUT
full repository-native suite         NOT_RUN / ENVIRONMENT_BLOCKED
real E01/E02 source verification     NOT_RUN / CONTROLLED_DOCUMENTS_UNAVAILABLE
SEM-001...014 extraction             NOT_RUN / CONTROLLED_DOCUMENTS_UNAVAILABLE
```

Do not convert `NOT_RUN` to PASS.

## Hosted reconciliation receipt
At engineering/recovery head `3ca1fbb580805348233375de761b16a9bae56946`:

```text
live main                     2f34c3904b6a4d70c577461e1ae3191f1bf4f713
branch relation               ahead 9 / behind 0
changed files                 12 / 12 intended
GitHub mergeable              true
commit status entries         0 returned -> NOT_RUN, not PASS
PR-triggered workflow runs    0 returned -> NOT_RUN, not PASS
reviews / review threads      0 / 0
```

Subsequent commits are recovery metadata only; engineering and test blobs are frozen.

## Authority boundary

```text
production route             USER_CALCULATED_KD3
nativeCoreKd3Qualified       false
codeCompliance               false
canUseForDesignAuthority     false
productionKernelAllowed      false
automaticPromotionAllowed    false
```

## Exact next action
Leave PR670 draft/unmerged until explicit owner authorization. After merge, the next engineering action is not more software plumbing: obtain the real controlled B31.3-2024 and VIII-3-2025 project copies and complete the secure receipt/hash/locator/checker handoff.

## Appendix A — takeover questions
1. What specific custody defect did PR670 close?
2. What is the exact receipt ↔ controlled-source mapping?
3. Why can public official identity not substitute for the controlled source?
4. Which evidence is mandatory for a verified receipt?
5. Can terminal status strings alone complete custody? No.
6. What is `sourceCustodyComplete` now? False.
7. Which Q1 evidence items remain pending? E01-E08.
8. Which gates remain blocked? G0/G1.
9. Was any licensed content or KD320 arithmetic added? No.
10. Which validations are PASS vs NOT_RUN?
