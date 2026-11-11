# P8 PR #751 source-admission validation

VALIDATION_ID: P8-PR751-SOURCE-ADMISSION-20260906
PR: #751
LATEST_MATERIAL_HEAD_VALIDATED: 6fb9f91cb2a7420fe2173b117e399846332fa416
MAIN_OBSERVED: c5815ae827edc231b933f56554218e642e60c179
NODE_VERSION: v22.16.0

## Intended exact repository command

```bash
node --test \
  tests/flange-face-binding-source-admission.test.mjs \
  tests/flange-face-binding-source-register.test.mjs
```

STATUS: NOT_RUN
OBSERVATION: A native authenticated checkout of private repository `reallaksh19/3D_Converters` remains unavailable in the current connector/container boundary. No PR-triggered workflow run exists for the observed head.
ORACLE: exact authenticated repository checkout required for native PASS.

## Prior supporting evidence

- pre-LEG-004 focused byte-custody reconstruction: PASS_SUPPORTING_RECONSTRUCTION, 24/24, Node v22.16.0;
- LEG-004 source-governance reproduction: PASS_SUPPORTING_REPRODUCTION, 28/28, Node v22.16.0;
- LEG-005 reviewer-independence delta: PASS_SUPPORTING_DELTA, 3/3, Node v22.16.0;
- exact authenticated checkout remains NOT_RUN throughout.

## LEG-006 admission-envelope validation

STATUS: PASS_SUPPORTING_DELTA
OBSERVATION: exact current admission-module and validator-CLI bytes were syntax checked; focused local behavior used the exact admission module + exact semantic-hash helper with a stubbed source-register dependency.
ORACLE: persisted source-custody integrity behavior; issue #750 requirement to preserve exact validation/provenance truth.
NODE_VERSION: v22.16.0
RESULT: 5 tests / 5 pass / 0 fail / 0 skipped

Exact current GitHub blobs verified locally with `git hash-object`:

```text
flange-face-binding-source-admission.js
GitHub blob: c5b2af60daaa2f65391a1f47fb08cb8937cd2a47
local blob:  c5b2af60daaa2f65391a1f47fb08cb8937cd2a47

validate-flange-face-binding-source-admission.mjs
GitHub blob: 4a3cfb6ded590309a3dc346d24f2efdff080ae73
local blob:  4a3cfb6ded590309a3dc346d24f2efdff080ae73
```

`node --check` on both exact blobs: PASS.

Focused supporting execution verifies:

- an intact admitted envelope validates and carries `admissionSemanticHash`;
- changing `independentReview.reviewEvidenceId` invalidates the retained admission hash;
- changing a non-authorizing authority flag (`governingEligible`) invalidates the reconstructed envelope/hash;
- changing review provenance and re-admitting produces a different admission hash;
- the persisted-admission validator CLI accepts intact JSON and rejects a tampered authority flag.

The focused behavior harness stubs the source-register dependency and therefore validates only the LEG-006 admission-envelope delta. It is not a substitute for the exact repository focused suite.

Current material GitHub custody:

- admission module — `c5b2af60daaa2f65391a1f47fb08cb8937cd2a47`;
- admission test — `a53b9e7bf27b6df789ec2a2f38d7c1a692b11e8d`;
- admission validator CLI — `4a3cfb6ded590309a3dc346d24f2efdff080ae73`;
- source register — `9254991c257b04bb26c15dc69d92cfcbf63660a5` unchanged.

## Validation findings and repairs

### Review replay

The initial admission implementation did not bind an accepted review to exact candidate semantics. PR #751 added `reviewedSubmissionHash` over all source-record semantics except `recordState` and final `semanticHash`, so reviewed semantic changes invalidate the review.

### Review workflow operability

PR #751 added a pre-review fingerprint CLI, aligned the issue form/workflow/checklist to the exact hash, and aligned disposition vocabulary to `ACCEPTED | REJECTED | NOT_RUN`.

### Pre-review state bypass — LEG-004

Public pre-review fingerprinting requires `PROJECT_CONTROLLED`; admission independently requires `INDEPENDENTLY_CHECKED` and verifies the same state-independent reviewed projection internally.

### Reviewer independence was documentary only — LEG-005

`independentReview.preparer` is required and normalized preparer/reviewer collisions fail closed. This is string-level self-review prevention only, not identity or credential authentication.

### Persisted admission provenance was not integrity-bound — LEG-006

Before LEG-006, the sealed source record had a semantic hash, but the admitted envelope's independent-review provenance and authority flags had no retained machine-verifiable integrity hash. A persisted JSON admission could be edited after creation without invalidating the record semantic hash.

LEG-006 adds:

- `admissionSemanticHash` over the complete admission envelope except the hash field itself;
- `validateFlangeFaceBindingSourceAdmission()` to reconstruct the admissible envelope and verify its retained hash;
- `scripts/validate-flange-face-binding-source-admission.mjs` for persisted artifact validation;
- negative coverage for review-evidence and authority-flag tampering;
- workflow/checklist requirements to retain the exact admitted JSON and expected `admissionSemanticHash`.

The admission hash is custody tamper evidence only when the expected hash is retained independently under project control. It is not a digital signature, identity authentication, or proof of historical authenticity if both an artifact and its hash are replaced together.

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
