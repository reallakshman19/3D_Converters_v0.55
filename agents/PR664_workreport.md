# PR664 — Assessment evidence currentness receipts Work Report

## Current recovery state

- PR: #664
- TITLE: `feat(vibration): add assessment evidence currentness receipts`
- BRANCH: `agent/vibration-assessment-evidence-20260819`
- BASE / MERGE BASE: `main@12f9601b7fe9441f7cf7750da5892c09e5ebab7a`
- ENGINEERING_BASIS_HEAD: `e659bfd35ead074ce5319ded0dca6251806e521c`
- LAST_FULL_PR_STATE_OBSERVED_HEAD: `bd214492dbcd683617970eb94084f4c325f4bf47`
- CRITICALITY: ENGINEERING_CRITICAL
- PR_STATE: OPEN_DRAFT_HANDOVER_READY
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED
- COORDINATION: SAFE

Later commits after `ENGINEERING_BASIS_HEAD` are recovery/custody metadata only. Product/test blobs are frozen below.

## Handover in 60 seconds

Phase 4A delivers:

```text
VibrationAssessmentEvidenceReceipt.v1
  -> VibrationAssessmentEvidenceLedger.v1
  + current method/input/source basis
  -> VibrationAssessmentEvidenceCurrentness.v1
  -> VibrationAssessmentEvidenceLedgerCurrentness.v1
```

A receipt preserves result evidence and calculation-basis fingerprints. Loading or revalidating it can never create a current engineering result.

Receipt data binds exact assessment item + mechanism + line/case/canonical scope, calculation time, method ID/revision, qualification revision, method-definition hash, engineering-input hash, source-basis hash, JSON-safe result payload and bounded authority-at-calculation metadata.

Receipt creation requires `CURRENT_RESULT` at calculation time. The item factory accepts only `VibrationMechanismAssessmentItem.v1` with a current non-null result.

Receipt authority is always:

```text
authority                       ASSESSMENT_RESULT_EVIDENCE_ONLY
createsCurrentEngineeringResult false
screeningAuthority              NOT_AUTHORIZED
designAuthority                 false
rootCauseAuthority              false
codeCompliance                  false
safetyAuthority                 false
```

Currentness states are `BASIS_UNAVAILABLE`, `EVIDENCE_CURRENT`, and `STALE_EVIDENCE`. `EVIDENCE_CURRENT` is freshness only, never `CURRENT_RESULT` authority. Parity covers method ID/revision, qualification revision, method-definition hash, engineering-input hash and source-basis hash. Missing current basis fails closed.

No `VibrationIntegrityProject.v2` schema is declared here; a future Project v2 should consume this seam rather than inventing persistence currentness inline.

## Product/test paths

- `converters/vibration/project/assessment-evidence.js`
- `converters/vibration/project/assessment-currentness.js`
- `tests/vibration-assessment-evidence.test.mjs`
- `tests/vibration-assessment-currentness.test.mjs`

All are new files; existing-file backup is `NOT_APPLICABLE`.

## Validation truth

```text
live repository/source grounding             PASS / SOURCE_INSPECTION
ownership/coordination                       PASS
actual mechanism-item schema constant        PASS / SOURCE_INSPECTION
source syntax                                PASS / LOCAL_EXECUTION
physical-line policy                         PASS: 184 / 101 / 103 / 90
focused behavior                             PASS 14/14
exact product/test Git blob identity         PASS
receipt forged-authority rejection           PASS
unsupported authority snapshot rejection     PASS
stale-item receipt rejection                 PASS
JSON-safe result payload                     PASS
exact-basis evidence-current                 PASS
basis-unavailable fail-closed                PASS
method/input/source staleness reasons        PASS
ledger history/currentness counts            PASS
repository-native focused tests              NOT_RUN / ENVIRONMENT_BLOCKED
browser acceptance                           NOT_APPLICABLE / no UI
independent numerical verification            NOT_APPLICABLE / no numerical change
```

Exact validated blobs:

```text
assessment-evidence.js                 1985c63f7f279d224787678278b7eb269d8a5b4e
assessment-currentness.js              0ee935a26d0efdf71add21e2a2c01546966ed3ff
vibration-assessment-evidence.test     7390083a08187be94ba51a4489549e9a121eadc2
vibration-assessment-currentness.test  5ce1b039814f7ca54a8b223697ab184db059f39e
```

The 14/14 execution used those exact product/test bytes with a narrow local stub only for the pre-existing mechanism-item schema constant; the actual repo constant was separately inspected and matches.

## Last full PR-state reconciliation

Observed at head `bd214492dbcd683617970eb94084f4c325f4bf47`:

```text
base / merge base           12f9601b7fe9441f7cf7750da5892c09e5ebab7a
ahead / behind              15 / 0
changed files               10 intended / 0 unexplained
mergeable                   true
state / draft               open / true
reviews                     0
review threads              0
commit status entries       0 -> NOT_RUN
PR-triggered workflow runs  0 -> NOT_RUN
```

Any later head movement from report/status synchronization is recovery-only. Refresh live state again before merge.

## Coordination / logical stop

- PR661 measurement verification, PR662 visual evidence and PR664 assessment-evidence currentness are independent foundation PRs.
- PR649 work-item currentness does not own this project receipt/currentness domain.
- Do not declare Project v2 or verification persistence by duplicating these unmerged contracts into a stacked branch.

Once the foundations are stable, Project v2 can persist `assessmentEvidence[]`, verification requirements/dispositions and visual evidence, and revalidate all receipt currentness on load without self-promotion. Phase 7C can then build the persistent line/case Verify workspace on that stable project model.

## EXACT_NEXT_ACTION

STOP at Owner gate. Do not merge. On explicit Owner progression, re-ground current main/PR head and run repository-native focused tests before merge decision.
