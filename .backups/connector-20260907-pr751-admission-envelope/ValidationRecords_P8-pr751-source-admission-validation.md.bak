# P8 PR #751 source-admission validation

VALIDATION_ID: P8-PR751-SOURCE-ADMISSION-20260906
PR: #751
LATEST_MATERIAL_HEAD_VALIDATED: 963c2691faa22e28ad946efadf55782576b69625
MAIN_OBSERVED: c5815ae827edc231b933f56554218e642e60c179
NODE_VERSION: v22.16.0

## Intended exact repository command

```bash
node --test \
  tests/flange-face-binding-source-admission.test.mjs \
  tests/flange-face-binding-source-register.test.mjs
```

STATUS: NOT_RUN
OBSERVATION: A native authenticated checkout of private repository `reallaksh19/3D_Converters` remains unavailable in the current connector/container boundary. No PR-triggered workflow run exists for the current head.
ORACLE: exact authenticated repository checkout required for native PASS.

## Prior supporting evidence

- pre-LEG-004 focused byte-custody reconstruction: PASS_SUPPORTING_RECONSTRUCTION, 24/24, Node v22.16.0;
- LEG-004 source-governance reproduction: PASS_SUPPORTING_REPRODUCTION, 28/28, Node v22.16.0;
- exact authenticated checkout remains NOT_RUN throughout.

## LEG-005 reviewer-independence validation

STATUS: PASS_SUPPORTING_DELTA
OBSERVATION: LOCAL_EXECUTION over exact current admission-module bytes plus focused stubbed custody dependencies
ORACLE: IMPLEMENTATION_COUPLED negative-control execution + independent-review checklist requirement
NODE_VERSION: v22.16.0
RESULT: 3 tests / 3 pass / 0 fail / 0 skipped

The exact current GitHub admission blob was reconstructed locally and verified with `git hash-object`:

```text
flange-face-binding-source-admission.js
GitHub blob: 52b6f28a721d6acb89d148d6fc631e01620cacbd
local blob:  52b6f28a721d6acb89d148d6fc631e01620cacbd
```

`node --check` on that exact admission blob: PASS.

Focused supporting execution verifies:

- distinct explicit `preparer` and `reviewer` identities proceed through admission;
- missing `preparer` fails closed;
- a preparer identity equivalent to the reviewer after NFKC normalization, trim, whitespace collapse and case folding fails closed.

The focused execution uses stubbed source-register/hash dependencies and therefore validates only the LEG-005 reviewer-independence delta. It is not a substitute for the exact repository focused suite.

Current material GitHub custody:

- admission module — `52b6f28a721d6acb89d148d6fc631e01620cacbd`;
- admission test — `fc95063c5b77b0d9388b5085458a6d6a8a65dfd2`;
- source register remains unchanged from the prior leg.

## Validation findings and repairs

### Review replay

The initial admission implementation did not bind an accepted review to exact candidate semantics. PR #751 added `reviewedSubmissionHash` over all source-record semantics except `recordState` and final `semanticHash`, so reviewed semantic changes invalidate the review.

### Review workflow operability

PR #751 added a pre-review fingerprint CLI, aligned the issue form/workflow/checklist to the exact hash, and aligned disposition vocabulary to `ACCEPTED | REJECTED | NOT_RUN`.

### Pre-review state bypass — LEG-004

Public pre-review fingerprinting now requires `PROJECT_CONTROLLED`; admission independently requires `INDEPENDENTLY_CHECKED` and verifies the same state-independent reviewed projection internally.

### Reviewer independence was documentary only — LEG-005

The checklist required the independent reviewer to be separate from the record author/preparer, but the executable admission object previously carried no preparer identity. A self-review could therefore satisfy the software contract using only a claimed reviewer field.

LEG-005 closes that explicit-contract gap:

- `independentReview.preparer` is now required;
- `independentReview.reviewer` must normalize to a different identity from `preparer`;
- intake form, workflow and checklist carry the same requirement;
- the software check is explicitly documented as string-level separation only, not identity/credential authentication.

## Protected unchanged boundaries

No result in this record establishes or changes:

```text
codeCompliance            true
designAuthority           true
governingEligible         true
automaticBindingProducer  true
```

No model geometry, flange face, opening direction, mating side, interface identity, engineering tolerance, master data or solver result is inferred or defaulted by this PR. No software check authenticates reviewer credentials or substitutes for retained independent-review evidence.

One real independently accepted controlled project source remains externally required by issue #750. Exact authenticated PR-head test execution remains `NOT_RUN`; supporting evidence must not be relabeled as native PASS.
