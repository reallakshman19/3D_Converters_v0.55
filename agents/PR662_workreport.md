# PR662 — Visual inspection evidence kernel Work Report

## Current recovery state — read first

- PR: #662
- TITLE: `feat(vibration): add visual inspection evidence kernel`
- BRANCH: `agent/vibration-visual-inspection-20260819`
- BASE / MERGE BASE: `main@12f9601b7fe9441f7cf7750da5892c09e5ebab7a`
- ENGINEERING_BASIS_HEAD: `3e49cc78cdc468075dd85b18b60fb6e36be6feb3`
- LAST_FULL_PR_STATE_OBSERVED_HEAD: `50884643b3c37ed478a03dfb55aa2ce2301cc3ee`
- CRITICALITY: ENGINEERING_CRITICAL
- PR_STATE: OPEN_DRAFT_HANDOVER_READY
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED
- COORDINATION: SAFE

Later commits after `ENGINEERING_BASIS_HEAD` are recovery/custody metadata only. Product/test blobs are frozen below.

## Handover in 60 seconds

Phase 7B delivers:

```text
VibrationVisualInspectionRecord.v1
  -> VibrationVisualInspectionEvidencePackage.v1
  -> VibrationVisualInspectionStatus.v1
  -> VibrationProjectVisualInspectionProjection.v1
```

It is independent of PR661 measurement verification and intentionally does not add persistence/UI.

This is **not** an EI AVIFF T5/T6 checklist transcription. Every visual evidence/status authority carries `eiChecklistCoverage = NOT_CLAIMED_NON_EXHAUSTIVE_CAPTURE`.

## Engineering behavior

- Exact line/case/operating-case snapshot scope is mandatory.
- Stored and requested scopes require canonical `sha256:` snapshot hashes.
- Subjects cover pipe/component, support/restraint, SBC, tubing, intrusive element, other.
- Generic observation vocabulary covers support condition, fastener looseness, fretting/wear, weld/attachment surface condition, SBC/tubing relative motion, rubbing/contact, insulation/cladding damage, leakage/staining, other.
- Direct states: `OBSERVED`, `NOT_OBSERVED`, `NOT_INSPECTED`, `UNRESOLVED`.
- OBSERVED/UNRESOLVED require notes.
- Optional photo/report refs are immutable + hash pinned.
- Inspector and source provenance are retained.

Scope workflow states:

```text
NO_VISUAL_EVIDENCE
UNRESOLVED_VISUAL_OBSERVATIONS
VISUAL_EVIDENCE_INCOMPLETE
OBSERVED_CONDITIONS_REQUIRE_REVIEW
VISUAL_EVIDENCE_RECORDED
```

Precedence is fail closed: `UNRESOLVED > NOT_INSPECTED > OBSERVED > RECORDED_ONLY`.

`OBSERVED` is a review trigger, not a root-cause or screening conclusion. `NOT_OBSERVED` is inspection-specific evidence only, not safety acceptance. Malformed requested snapshot hashes fail explicitly rather than looking like valid scopes with no evidence.

`evaluateProjectVibrationVisualInspection(project, evidence)` validates existing `VibrationIntegrityProject.v1`, rejects unknown lines, groups exact scopes and reports review states/counts without project mutation or persistence.

## Authority boundary

```text
eiChecklistCoverage                NOT_CLAIMED_NON_EXHAUSTIVE_CAPTURE
determinesApplicability            false
determinesAssessmentCompleteness   false
screeningAuthority                 NOT_AUTHORIZED
designAuthority                    false
rootCauseAuthority                 false
codeCompliance                     false
safetyAuthority                    false
```

No EI numerical method, threshold, mechanism reducer, governing LOF, main-line aggregation, T1 applicability logic, signal processing, project schema, workflow file, runtime/writer/canvas path, or existing production file changed.

## Re-grounding

Initial base was `93a682a3...`; main advanced by unrelated HP-only PR660 to `12f9601b7fe9441f7cf7750da5892c09e5ebab7a`. The visual tree was replayed byte-for-byte onto that main before PR allocation.

## Product/test paths

Production:
- `converters/vibration/visual-inspection/contracts.js`
- `converters/vibration/visual-inspection/evaluate.js`
- `converters/vibration/project/visual-inspection.js`

Tests:
- `tests/vibration-visual-inspection.test.mjs`
- `tests/vibration-project-visual-inspection.test.mjs`

All are new files; existing-file backup is `NOT_APPLICABLE`.

## Validation truth

```text
source syntax                                   PASS / LOCAL_EXECUTION
physical-line policy                            PASS: 223 / 85 / 64 / 110 / 59
focused visual behavior                         PASS 13/13
exact product/test blob identity                PASS
current project-fixture schema compatibility    PASS / SOURCE_INSPECTION
malformed requested snapshot hash               PASS / fail closed
wrong-scope evidence exclusion                  PASS
immutable/hash-pinned artifact custody          PASS
no authority promotion                          PASS
project immutability / non-persistence          PASS
repository-native focused tests                 NOT_RUN / ENVIRONMENT_BLOCKED
browser acceptance                              NOT_APPLICABLE / no UI
independent numerical verification               NOT_APPLICABLE / no numerical change
```

Exact validated product/test blobs:

```text
contracts.js                     70bd8fb744a2575ea7430729a3ea1ab802d61558
evaluate.js                      606c6401b934da9b0964db4ac3ce1dac1b0da5d3
project/visual-inspection.js     66daefad206cda389f33f593bde55b34f0a7e600
visual inspection test           79b167869954520c75b659dc0905b57402961236
project visual inspection test   fa4cde518cadfb4041d13223ae5d2440f38899b6
```

The 13/13 execution used those exact product/test bytes with a narrow local reconstruction for the existing project validator. The actual current project validator was separately inspected and the fixture satisfies its contract. This is supporting evidence, not repository-native suite PASS.

## Last full PR-state reconciliation

Observed at head `50884643b3c37ed478a03dfb55aa2ce2301cc3ee`:

```text
base / merge base           12f9601b7fe9441f7cf7750da5892c09e5ebab7a
ahead / behind              13 / 0
changed files               11 intended / 0 unexplained
mergeable                   true
state / draft               open / true
reviews                     0
review threads              0
commit status entries       0 -> NOT_RUN
PR-triggered workflow runs  0 -> NOT_RUN
```

Any later head movement from this report/status synchronization is recovery-only. Before merge, refresh live head/main relation and hosted checks again.

## Decisions

- visual evidence remains separate from waveform/signal evidence;
- generic observation codes do not claim complete EI T5/T6 checklist authority;
- observed condition is evidence/review trigger, not root cause or screening failure;
- not-observed is inspection-specific evidence only, not safety acceptance;
- persistence/UI/integration with PR661 belongs Phase 7C after both evidence models exist;
- requested evaluation scope meets the same canonical snapshot hash contract as stored evidence.

## Logical continuation / stop condition

Phase 7C genuinely depends on both PR661 and PR662. Do **not** duplicate or stack these unmerged evidence models into a third branch. Once their integration basis is stable, Phase 7C can add persistent verification lifecycle + line/case Verify workspace; Phase 7D then adds diagnosis, corrective action and post-modification confirmation.

## EXACT_NEXT_ACTION

STOP at Owner gate. Do not merge. On explicit Owner progression, first re-ground current main/PR head and run repository-native focused tests before merge decision.
