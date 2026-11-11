# WIP — KD320 Q1 Formal Exit Intake + Combined Package Preview

## Recovery header
- WORK_INTENT: IMPLEMENT
- CRITICALITY: ENGINEERING_CRITICAL
- BRANCH: `agent/hp-kd320-q1-package-preview`
- ORIGINAL_BASE: `main@7f7ce459c8f059b503b045bbdebbe10d303b1044` (PR666 merge)
- CURRENT_BASE: `main@b9ffa16180a1fea017505f8e39775fb9f87523ac`
- RESTACK: completed after two unrelated vibration commits advanced main
- BACKUP: `backup/hp-kd320-q1-package-preview-pre-edit-20260819`
- MODE: AUTO
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_SUCCESSOR
- PRODUCTION_KERNEL_CHANGED: NO
- LICENSED_SOURCE_CONTENT_ADDED: NO

## Mission
Keep the four existing top-level KD320 record classes unchanged and add the missing `CONTROLLED_SOURCE` formal-Q1-exit sub-package plus one combined browser-memory Q1 package preview.

```text
2 verified controlled-source receipts
+ 14 independently checked semantic records
+ formal Q1 exit attestation
+ exact receipt-hash bindings
+ exact semantic locator / opaque-ref bindings
+ E01-E08 exact PASS refs
+ G0/G1 exact PASS refs
+ evidence-ledger SHA-256 + audit-report SHA-256
+ distinct attestor/checker
-> Q1_COMPLETE_Q2_ORACLE_PENDING
```

## Implementation
1. Added `kd320-q1/package-preview.js`.
   - parses one redacted formal-exit JSON object;
   - joins receipt and semantic preview evidence;
   - delegates final readiness to `evaluateKd320Q2AdmissionCandidate`;
   - returns permanently false native/design/Code authority;
   - produces the browser formal-exit template from the formal-exit constants.
2. Updated `hp-kd320-evidence-intake-tab.js`.
   - no fifth top-level record class;
   - `CONTROLLED_SOURCE` now has semantic + formal-exit sub-packages;
   - latest receipt/semantic/attestation packages persist in browser memory;
   - every upload recomputes one combined Q1 state;
   - no persistence/admission/kernel mutation.
3. Updated engineering workspace cache identity.
4. Added package regressions and extended static UI contract tests.
5. Added a parity regression requiring the browser-generated formal-exit template to equal `formal-exit-attestation.template.json`.

## Fail-closed matrix covered
```text
2 receipts + 14 semantics, no attestation   BLOCK
missing E08                                 BLOCK
missing G1                                  BLOCK
wrong B31.3 receipt hash                    BLOCK
altered SEM-012 locator                     BLOCK
SEM-001 rebound to VIII-3                   BLOCK
attestor == checker                         BLOCK
productionKernelAllowed=true                STRUCTURAL FAIL
exact package                               Q1_COMPLETE_Q2_ORACLE_PENDING
QF022/QF023 absent after Q1                 explicit Q2 blockers
```

## Authority boundary
```text
production route             USER_CALCULATED_KD3
nativeCoreKd3Qualified       false
codeCompliance               false
canUseForDesignAuthority     false
productionKernelAllowed      false
automaticPromotionAllowed    false
```

## Validation
The execution container still cannot resolve `github.com`, so a native repository checkout/full suite is unavailable. Focused validation used exact Git blobs reconstructed locally.

```text
package-preview.js blob                    3576facdcedfaf5db61acdf457e3342e6c238de3
formal-exit.js blob                        42baebe9e430fe4e456da74b3c2b9dc960a4dbf5
q2/intake.js blob                          d24156d8912d3f6125465f040d134b85b35c12b4
formal-exit template blob                  6cca42c427f09a333906124b2eed33119a08c4a4
UI module blob                             819ecd0273536aa42610fb1cfe17e5dc99c11c19
package-preview.js syntax                  PASS / EXACT_BLOB
UI module syntax                           PASS / EXACT_BLOB
joined package core harness                PASS 11/11 / EXACT CORE BLOBS
UI fail-closed/static assertions           PASS 22/22 / EXACT UI BLOB
browser/template parity                    PASS / exact committed template
full authored repository test files        NOT_RUN / NO_CHECKOUT
full repository-native suite               NOT_RUN / ENVIRONMENT_BLOCKED
served-browser interaction                 NOT_RUN / NO_BROWSER_RUNTIME
independent KD320 engineering qualification NOT_RUN / REAL_CONTROLLED_EVIDENCE_PENDING
```

## Current branch relation
After restack onto `main@b9ffa16180a1fea017505f8e39775fb9f87523ac`:

```text
ahead  1
behind 0
files  8 intended before PR-numbered recovery
```

The two intervening main commits are vibration-only and do not overlap KD320 files.

## Changed-file ledger before PR allocation
1. `engineering/hp-class-standardization/qualification/kd320-q1/package-preview.js`
2. `tabs/hp-kd320-evidence-intake-tab.js`
3. `tabs/engineering-workspace-tab.js`
4. `tests/b313-chapter-ix-kd320-q1-package-preview.test.mjs`
5. `tests/hp-kd320-evidence-intake-ui.test.mjs`
6. `agents/WIP-hp-kd320-q1-package-preview_workreport.md`
7. `agents/status/WIP-hp-kd320-q1-package-preview.yaml`
8. `agents/claims/WIP-hp-kd320-q1-package-preview.yaml`

## Appendix A — takeover questions
1. Are there still exactly four first-class CSV record classes?
2. Does formal exit remain a `CONTROLLED_SOURCE` sub-package rather than a new record class?
3. Can receipts + semantics alone ever display Q1 complete? They must not.
4. Does the combined preview call the Q1/Q2 evaluator rather than reimplementing engineering semantics?
5. Are E01-E08 and G0/G1 exact sets enforced by the formal-exit evaluator?
6. Are receipt hashes and all SEM001-014 locator/opaque refs bound exactly?
7. Is SEM001 canonical to B31.3 and SEM002-014 canonical to VIII-3?
8. Can the UI write into project/oracle/production state? It must not.
9. Does successful Q1 still leave native/design/Code authority false?
10. Which validation is PASS versus NOT_RUN?
