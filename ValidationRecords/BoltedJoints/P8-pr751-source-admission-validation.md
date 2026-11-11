# P8 PR #751 source-admission validation

VALIDATION_ID: P8-PR751-SOURCE-ADMISSION-20260906
PR: #751
LATEST_MATERIAL_HEAD_VALIDATED: 6fb9f91cb2a7420fe2173b117e399846332fa416
PR_HEAD_EXACT_FILES_OBSERVED: 06d69ee7b09bf5ce98d57df550fa852f5f2f7a69
MAIN_OBSERVED: c5815ae827edc231b933f56554218e642e60c179
NODE_VERSION: v22.16.0

## Intended exact repository command

```bash
node --test \
  tests/flange-face-binding-source-admission.test.mjs \
  tests/flange-face-binding-source-register.test.mjs
```

STATUS: NOT_RUN
OBSERVATION: A native authenticated checkout of private repository `reallaksh19/3D_Converters` remains unavailable in the current connector/container boundary. No PR-triggered workflow run exists for the observed PR head.
ORACLE: authenticated repository checkout or an exact PR-triggered workflow is required for native PASS.

## Prior supporting evidence

- pre-LEG-004 focused byte-custody reconstruction: PASS_SUPPORTING_RECONSTRUCTION, 24/24, Node v22.16.0;
- LEG-004 source-governance reproduction: PASS_SUPPORTING_REPRODUCTION, 28/28, Node v22.16.0;
- LEG-005 reviewer-independence delta: PASS_SUPPORTING_DELTA, 3/3, Node v22.16.0;
- LEG-006 admission-envelope delta: PASS_SUPPORTING_DELTA, 5/5, Node v22.16.0;
- exact authenticated checkout remains NOT_RUN throughout.

## EP-0008 exact-file focused-suite materialization

STATUS: PASS_SUPPORTING_EXACT_FILE_MATERIALIZATION
OBSERVATION: The complete import closure for both focused repository tests was assembled in an isolated local tree directly from the exact GitHub file bytes observed at PR head `06d69ee7b09bf5ce98d57df550fa852f5f2f7a69`. Every materialized file was verified with `git hash-object` against its GitHub blob before execution. No stubbed, reduced or substituted dependency remained.
ORACLE: the repository's two focused test files and exact GitHub blob identities for their complete import closure.
NODE_VERSION: v22.16.0
RESULT: 33 tests / 33 pass / 0 fail / 0 cancelled / 0 skipped / 0 todo
DURATION: 145.830546 ms

Exact-file custody manifest:

```text
3707a1cb3278eb67637c404a85b2012e50b4f481  converters/engineering-calculations/mechanics/load-resultant.js
7c443237aa573b79322f24733733955d7b64d878  converters/engineering-calculations/flange/advanced-analysis-semantic-hash.js
70b2978ea703c2498edb685f7256402cb890cb50  converters/engineering-calculations/flange/joint-model-context.js
825e3c63b99c8860caee83ca50c1e41ecffa3f6c  converters/engineering-calculations/flange/advanced-analysis-interface-adapter.js
9254991c257b04bb26c15dc69d92cfcbf63660a5  converters/engineering-calculations/flange/flange-face-binding-source-register.js
c5b2af60daaa2f65391a1f47fb08cb8937cd2a47  converters/engineering-calculations/flange/flange-face-binding-source-admission.js
2cf38939b799ebddff4060a4d52e758b06ed67be  scripts/admit-flange-face-binding-source.mjs
d5fbb4e9c6d7a15e557c37127b94734ddc2121c3  scripts/compute-flange-face-binding-source-review-hash.mjs
4a3cfb6ded590309a3dc346d24f2efdff080ae73  scripts/validate-flange-face-binding-source-admission.mjs
a53b9e7bf27b6df789ec2a2f38d7c1a692b11e8d  tests/flange-face-binding-source-admission.test.mjs
342387a1489936eb366d11d508b465c1a4980cb1  tests/flange-face-binding-source-register.test.mjs
```

This removes the prior supporting-execution dependency-substitution caveat. It is still not an authenticated Git checkout: repository metadata, package state outside this exact import closure and authenticated checkout provenance were not established. Therefore this result must not be relabeled as the native authenticated PASS required by the exact-checkout gate.

## LEG-006 admission-envelope validation

STATUS: PASS_SUPPORTING_DELTA
OBSERVATION: exact current admission-module and validator-CLI bytes were syntax checked; focused local behavior used the exact admission module + exact semantic-hash helper with a stubbed source-register dependency.
ORACLE: persisted source-custody integrity behavior; issue #750 requirement to preserve exact validation/provenance truth.
NODE_VERSION: v22.16.0
RESULT: 5 tests / 5 pass / 0 fail / 0 skipped

The later EP-0008 exact-file execution supersedes the dependency-substitution limitation for supporting focused-suite behavior, while retaining this LEG-006 result as append-only historical evidence.

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

LEG-006 adds `admissionSemanticHash` over the complete admission envelope except itself, reconstructive persisted-admission validation, a validator CLI, negative review/authority tamper coverage, and controlled custody instructions. The hash is tamper evidence only when its expected value is retained independently; it is not a signature or identity proof.

## Protected unchanged boundaries

No result in this record establishes or changes:

```text
codeCompliance            true
designAuthority           true
governingEligible         true
automaticBindingProducer  true
```

No model geometry, flange face, opening direction, mating side, interface identity, engineering tolerance, master data or solver result is inferred or defaulted by this PR. No software check authenticates reviewer credentials or substitutes for retained independent-review evidence.

One real independently accepted controlled project source remains externally required by issue #750. Independent PR review remains NOT_RUN. Exact authenticated PR-head test execution remains `NOT_RUN`; supporting exact-file evidence must not be relabeled as native PASS.
