# PR669 — Formal KD320 Q1 Package Preview

## Recovery header
- PR: #669
- TITLE: `feat(hp): add formal KD320 Q1 package preview`
- BRANCH: `agent/hp-kd320-q1-package-preview`
- BASE: `main@b9ffa16180a1fea017505f8e39775fb9f87523ac`
- PREDECESSOR: PR666 merged formal Q1 exit gate.
- MODE: AUTO
- CRITICALITY: ENGINEERING_CRITICAL
- STATE: OPEN_DRAFT_HANDOVER_READY
- BACKUP: `backup/hp-kd320-q1-package-preview-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR669
- PRODUCTION_KERNEL_CHANGED: NO
- LICENSED_SOURCE_CONTENT_ADDED: NO

## Handover in 60 seconds
PR669 closes the product-workflow gap left after PR666. Formal Q1 exit became mandatory, but the KD320 Evidence Intake could not upload the formal-exit attestation or join it with the receipt + semantic packages.

The PR keeps exactly four top-level record classes and adds formal exit only as a `CONTROLLED_SOURCE` sub-package.

```text
CONTROLLED_SOURCE receipt CSV (2 rows)
+ CONTROLLED_SOURCE semantic CSV (14 rows)
+ CONTROLLED_SOURCE formal-exit JSON (1 object)
              ↓
previewKd320Q1Package()
              ↓
evaluateKd320Q2AdmissionCandidate()
              ↓
Q1_CONTROLLED_EVIDENCE_PENDING
or
Q1_COMPLETE_Q2_ORACLE_PENDING
```

No evidence is persisted or admitted by the UI.

## Engineering boundary
```text
production route             USER_CALCULATED_KD3
nativeCoreKd3Qualified       false
codeCompliance               false
canUseForDesignAuthority     false
productionKernelAllowed      false
automaticPromotionAllowed    false
```

No Code text, KD320 equations, curve points, native numerical kernel, project persistence, oracle write, or production mutation is introduced.

## Implementation
### `kd320-q1/package-preview.js`
- parses one formal-exit JSON object;
- validates receipt/semantic sub-package availability/count before joining;
- builds only a Q2 admission candidate;
- delegates formal Q1 gate authority to the merged evaluator;
- forces returned authority false;
- generates the browser formal-exit template from merged formal-exit constants.

### Evidence Intake UI
- retains four first-class record modes;
- retains semantic sub-package;
- adds formal Q1 exit JSON sub-package;
- adds a single combined Q1 package preview;
- keeps latest three sub-packages in browser memory only;
- recomputes the joined state after each upload;
- displays native/design authority false.

### Template custody
The browser-generated exit template is regression-locked to `formal-exit-attestation.template.json` using deep structural equality.

## Fail-closed cases
```text
2 receipts + 14 semantics, no attestation   BLOCK
E08 absent                                  BLOCK
G1 absent                                   BLOCK
B31.3 document hash changed                 BLOCK
SEM-012 locator changed                     BLOCK
SEM-001 rebound to VIII-3                   BLOCK
attestor/checker same identity              BLOCK
productionKernelAllowed=true                STRUCTURAL FAIL
complete exact package                      Q1_COMPLETE_Q2_ORACLE_PENDING
QF022/QF023 absent after Q1                 explicit blockers
```

## Validation ledger
Focused validation was executed against exact Git blobs because a full checkout is unavailable in the execution environment.

```text
package-preview.js blob                    3576facdcedfaf5db61acdf457e3342e6c238de3
formal-exit.js blob                        42baebe9e430fe4e456da74b3c2b9dc960a4dbf5
q2/intake.js blob                          d24156d8912d3f6125465f040d134b85b35c12b4
formal-exit template blob                  6cca42c427f09a333906124b2eed33119a08c4a4
UI module blob                             819ecd0273536aa42610fb1cfe17e5dc99c11c19
package-preview.js syntax                  PASS / EXACT_BLOB
UI module syntax                           PASS / EXACT_BLOB
joined package core harness                PASS 11/11 / IMPLEMENTATION_COUPLED
UI fail-closed/static assertions           PASS 22/22 / EXACT_UI_BLOB
browser/repository template parity         PASS
full authored repository tests             NOT_RUN / NO_CHECKOUT
full repository-native suite               NOT_RUN / ENVIRONMENT_BLOCKED
served-browser interaction                 NOT_RUN / NO_BROWSER_RUNTIME
independent KD320 engineering qualification NOT_RUN / REAL_CONTROLLED_EVIDENCE_PENDING
```

Do not convert any NOT_RUN item into PASS.

## Hosted reconciliation
At engineering/recovery head `ddbdc74f8dbd451697c19697ecc5ee0458513735` before final metadata synchronization:

```text
base / merge base             b9ffa16180a1fea017505f8e39775fb9f87523ac
branch relation               ahead 7 / behind 0
changed files                 11 / 11 intended
GitHub mergeable              true
state / draft                 open / true
commit status entries         0 -> NOT_RUN, not PASS
PR-triggered workflow runs    0 -> NOT_RUN, not PASS
reviews                       0
review threads                0
```

Subsequent branch commits after this receipt are recovery-metadata synchronization only; the validated engineering/test blobs listed above do not move.

## Changed-file ledger
Engineering/UI/tests:
1. `engineering/hp-class-standardization/qualification/kd320-q1/package-preview.js`
2. `tabs/hp-kd320-evidence-intake-tab.js`
3. `tabs/engineering-workspace-tab.js`
4. `tests/b313-chapter-ix-kd320-q1-package-preview.test.mjs`
5. `tests/hp-kd320-evidence-intake-ui.test.mjs`

Recovery:
6. `agents/WIP-hp-kd320-q1-package-preview_workreport.md`
7. `agents/status/WIP-hp-kd320-q1-package-preview.yaml`
8. `agents/claims/WIP-hp-kd320-q1-package-preview.yaml`
9. `agents/PR669_workreport.md`
10. `agents/status/PR669.yaml`
11. `agents/claims/PR669.yaml`

## Remaining real blocker
Software intake plumbing should stop here unless a genuine defect is found. Formal Q1 still needs real controlled source evidence and independent checking for both receipts, SEM001-014, E01-E08, G0/G1 and the exit attestation. Q2 then needs QF022/QF023.

## Appendix A — takeover questions
1. Are there exactly four first-class record classes?
2. Is formal exit only a CONTROLLED_SOURCE sub-package?
3. Can receipts + semantics alone ever show Q1 complete? No.
4. Is final readiness delegated to the merged Q1/Q2 evaluator?
5. Are exact hashes, semantic bindings, E01-E08 and G0/G1 retained?
6. Is the generated template identical to the repository custody template?
7. Can the UI persist/admit evidence? No.
8. Is USER_CALCULATED_KD3 still the only production route?
9. Is every native/design/Code authority false?
10. Which checks are PASS vs NOT_RUN?

## EXACT_NEXT_ACTION
Leave PR669 draft and unmerged. Next engineering activity is controlled Q1 evidence closure, not additional qualification UI/plumbing, unless a real defect is discovered.
