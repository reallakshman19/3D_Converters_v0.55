# PR663 — KD320 Q2 Oracle Semantic-Custody Hardening

## Recovery header

- PR: #663
- TITLE: `qual(hp): harden KD320 Q2 oracle semantic custody`
- BRANCH: `agent/hp-kd320-q2-semantic-custody`
- BASE: `main@12f9601b7fe9441f7cf7750da5892c09e5ebab7a`
- PREDECESSOR: PR660 merged by squash at the base SHA.
- CRITICALITY: ENGINEERING_CRITICAL
- PR_STATE: OPEN_DRAFT_HANDOVER_READY
- BACKUP: `backup/hp-kd320-q2-semantic-custody-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR663
- PRODUCTION_KERNEL_CHANGED: NO
- UI_CHANGED: NO
- LICENSED_SOURCE_CONTENT_ADDED: NO

## Handover in 60 seconds

PR663 fixes a Q2 qualification-contract traceability gap before any real controlled KD320 oracle is admitted.

Prior to this PR, Q1 required all 14 semantics and edition reconciliation covered SEM002...013, but QF023 required only SEM002...011 and QF022 carried no explicit method-semantic/target-receipt refs. A future complete candidate could therefore omit applicability/fail-closed oracle custody.

PR663 makes both QF022/QF023 explicitly carry SEM002...013 and binds source receipts:

```text
QF023 -> Q1-SRC-B313-2024 + Q1-SRC-VIII3-2025
QF022 -> Q1-SRC-VIII3-2025
```

It also publishes a deterministic chain-custody map and rejects correction-parameter references to non-method Q1 semantics such as SEM001 or SEM014.

## Method semantic set

```text
SEM-002 stress-state/component selection
SEM-003 Salt
SEM-004 associated mean stress
SEM-005 compression/negative/zero-mean branch treatment
SEM-006 correction parameters
SEM-007 Seq semantics/limits
SEM-008 fatigue-curve selection
SEM-009 curve evaluation/interpolation/endpoints
SEM-010 N semantics/boundaries
SEM-011 material/environment/temperature
SEM-012 applicability envelope
SEM-013 fail-closed limits/ambiguous inputs
```

Q1 itself still requires SEM001...014. SEM001 is B31.3 invocation/routing and SEM014 is result/review/release custody; they are not valid numerical correction-parameter semantics.

## Authority boundary

```text
nativeCoreKd3Qualified       false
codeCompliance               false
canUseForDesignAuthority     false
productionKernelAllowed      false
automaticPromotionAllowed    false
```

Production remains `USER_CALCULATED_KD3`.

No KD320 formula, fatigue-curve point, licensed ASME text, Q1 receipt promotion, controlled semantic content, product UI, workflow file, or production numerical kernel is added.

## Changed-file ledger — 14 intended files

Qualification contract/docs:

1. `engineering/hp-class-standardization/qualification/kd320-q2/intake.js`
2. `engineering/hp-class-standardization/qualification/kd320-q2/csv-intake.js`
3. `engineering/hp-class-standardization/qualification/kd320-q2/candidate.template.json`
4. `engineering/hp-class-standardization/qualification/kd320-q2/README.md`

Tests:

5. `tests/b313-chapter-ix-kd320-q2-blocker-enumeration.test.mjs`
6. `tests/b313-chapter-ix-kd320-csv-intake.test.mjs`
7. `tests/b313-chapter-ix-kd320-csv-four-record-intake.test.mjs`
8. `tests/b313-chapter-ix-kd320-q2-template-contract.test.mjs`

Recovery:

9. `agents/WIP-hp-kd320-q2-semantic-custody_workreport.md`
10. `agents/status/WIP-hp-kd320-q2-semantic-custody.yaml`
11. `agents/claims/WIP-hp-kd320-q2-semantic-custody.yaml`
12. `agents/PR663_workreport.md`
13. `agents/status/PR663.yaml`
14. `agents/claims/PR663.yaml`

## Validation ledger

| Check | Result |
|---|---|
| Live-base grounding | PASS — GitHub reference `12f9601...` |
| Exact pre-recovery head | `4cca2df72c12e916370df0b3d68213de7f6828ae` |
| Branch relation at pre-recovery head | PASS — 14 ahead / 0 behind |
| Changed-file reconciliation | PASS — 14 / 14 intended |
| GitHub mergeability | PASS — `mergeable=true` |
| `intake.js` syntax | PASS — LOCAL_EXECUTION |
| `csv-intake.js` syntax | PASS — LOCAL_EXECUTION |
| Focused semantic-custody harness | PASS — 9 assertion groups / IMPLEMENTATION_COUPLED |
| Full-custody Q2 candidate | PASS — reaches `Q2_ORACLE_ADMISSION_READY`, authority false |
| QF023 missing SEM012/013 | PASS — fail closed |
| QF022 missing SEM013 | PASS — fail closed |
| QF022 missing VIII3 receipt | PASS — fail closed |
| correction param with SEM014 | PASS — fail closed |
| project/published CSV focused paths | PASS — required refs retained |
| Commit status entries | 0 returned — NOT_RUN, not PASS |
| PR-triggered workflow runs | 0 returned — NOT_RUN, not PASS |
| Reviews / review threads | 0 / 0 |
| Full committed tests | NOT_RUN / ENVIRONMENT_BLOCKED |
| Full repository-native suite | NOT_RUN / ENVIRONMENT_BLOCKED |
| Served browser | NOT_RUN / NO_UI_CHANGE |
| Independent KD320 engineering qualification | NOT_RUN / REAL_Q1_Q2_EVIDENCE_PENDING |

No unexecuted check is represented as PASS. The exact final branch head after this recovery-only update is recorded in the PR body/GitHub state rather than self-referentially rewriting this file again.

## Contract-version decision

`kd320-q2-admission-candidate/v1` is retained. No real candidate can yet be Q2-admitted because controlled Q1 receipts and semantic extraction are still pending. This is fail-closed tightening before first admission, not migration of qualified records. If an external draft candidate exists, it must be updated with the newly required explicit refs before admission.

## Concurrent PR coordination

- PR661: vibration field-measurement verification kernel; no shared files/domain.
- PR662: vibration visual-inspection evidence kernel; no shared files/domain.
- PR649: stale vibration workbench; no shared Q2 qualification files.

Classification: `AUTHORITY_INDEPENDENT / NO_CHANGED_FILE_OVERLAP`.

## Real engineering blocker after PR663

PR663 does not fabricate evidence. Native KD320 remains blocked until real independently checked data exist:

```text
Q1-SRC-B313-2024 secure receipt/hash/locators/checker
Q1-SRC-VIII3-2025 secure receipt/hash/locators/checker
KD320-SEM-001...014 controlled extraction + independent check
PVP2025-154710 retained paper SHA
2023->2025 SEM002...013 controlled reconciliation
QF022 full numerical chain + admission custody
QF023 full independent project numerical chain + custody
```

## EXACT_NEXT_ACTION

Leave PR663 draft and unmerged. On any later merge request, re-ground live main and PR663, verify the 14-file scope and authority boundary, refresh status/workflow/review truth, and require explicit owner merge authorization for PR663.
