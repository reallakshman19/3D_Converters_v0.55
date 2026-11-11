# P8 PR #751 source-admission validation

VALIDATION_ID: P8-PR751-SOURCE-ADMISSION-20260906
PR: #751
LATEST_MATERIAL_HEAD_VALIDATED: feed79cb2e797eb6fdd3926255ad356aec09d8f3
MAIN_OBSERVED: c5815ae827edc231b933f56554218e642e60c179
NODE_VERSION: v22.16.0

## Intended exact repository command

```bash
node --test \
  tests/flange-face-binding-source-admission.test.mjs \
  tests/flange-face-binding-source-register.test.mjs
```

STATUS: NOT_RUN
OBSERVATION: A native authenticated checkout of private repository `reallaksh19/3D_Converters` remains unavailable in the current connector/container boundary. Direct Git access cannot resolve GitHub, and no PR-triggered workflow run exists for the current head.
ORACLE: exact authenticated repository checkout required for native PASS.

## Prior focused byte-custody reconstruction

STATUS: PASS_SUPPORTING_RECONSTRUCTION
OBSERVATION: LOCAL_EXECUTION over reconstructed focused dependency set at the pre-LEG-004 head
ORACLE: IMPLEMENTATION_COUPLED regression coverage plus issue/checklist source-governance rules
NODE_VERSION: v22.16.0
RESULT: 24 tests / 24 pass / 0 fail / 0 skipped

The prior reconstruction retained exact GitHub blob custody for the focused source-admission/register/hash/CLI/test files and used only a constants-only reduction of `advanced-analysis-interface-adapter.js`. It remains supporting evidence and is not promoted to exact-checkout PASS.

## LEG-004 supporting behavior reproduction

STATUS: PASS_SUPPORTING_REPRODUCTION
OBSERVATION: LOCAL_EXECUTION over a focused reproduction of the repaired admission/register contracts
ORACLE: IMPLEMENTATION_COUPLED regression coverage plus the documented `PROJECT_CONTROLLED -> independent review -> INDEPENDENTLY_CHECKED` source-governance sequence
NODE_VERSION: v22.16.0
RESULT: 28 tests / 28 pass / 0 fail / 0 skipped
DURATION_REPORTED_BY_NODE: 83.478595 ms

The LEG-004 run specifically verifies:

- a `PROJECT_CONTROLLED` candidate fingerprint remains valid after only the controlled state transition to `INDEPENDENTLY_CHECKED`;
- public pre-review fingerprinting rejects `DRAFT`;
- public pre-review fingerprinting rejects `INDEPENDENTLY_CHECKED`;
- public pre-review fingerprinting rejects `RETIRED`;
- admission still requires `INDEPENDENTLY_CHECKED`;
- `REJECTED` and `NOT_RUN` review dispositions fail closed;
- review replay after `selectedFaceId` changes is rejected;
- stale final semantic hashes remain rejected;
- the pre-review CLI rejects a `DRAFT` candidate;
- source authority and all automatic-binding/Code/design/governing flags remain non-authorizing.

Supporting syntax parse also passed for the repaired admission module and review-fingerprint CLI.

Current GitHub content custody after repair:

- `flange-face-binding-source-admission.js` — `0278eaa4da35e6ba5f7c44e9086f88407342e85f`;
- `flange-face-binding-source-admission.test.mjs` — `8075d2735ccc2bdea37a9c34b4b2819281b40ff0`;
- existing source register remains `9254991c257b04bb26c15dc69d92cfcbf63660a5`;
- existing register test remains `342387a1489936eb366d11d508b465c1a4980cb1`.

The 28/28 result is intentionally labeled supporting reproduction rather than exact byte-for-byte/native checkout execution.

## Validation findings and repairs

### Review replay

The initial admission implementation did not bind an accepted review to exact candidate semantics. PR #751 added `reviewedSubmissionHash` over all source-record semantics except `recordState` and final `semanticHash`, so a semantic change such as `selectedFaceId` invalidates the review.

### Review workflow operability

PR #751 added a pre-review fingerprint CLI, updated the issue form/workflow/checklist to carry the exact hash, and aligned review disposition vocabulary to `ACCEPTED | REJECTED | NOT_RUN`.

### Pre-review state bypass — LEG-004

The public fingerprint helper still accepted every generic source-register state. Because `recordState` is excluded from the stable review fingerprint, a `DRAFT` or `RETIRED` candidate could be fingerprinted and later changed only to `INDEPENDENTLY_CHECKED`.

LEG-004 closes that path:

- public pre-review fingerprinting requires `PROJECT_CONTROLLED`;
- admission independently requires `INDEPENDENTLY_CHECKED`;
- admission recomputes the same state-independent reviewed projection internally, rather than calling the public pre-review helper;
- the generic source-register/sealer remains unchanged.

## Protected unchanged boundaries

No result in this record establishes or changes:

```text
codeCompliance            true
designAuthority           true
governingEligible         true
automaticBindingProducer  true
```

No model geometry, flange face, opening direction, mating side, interface identity, engineering tolerance, master data or solver result is inferred or defaulted by this PR.

One real independently accepted controlled project source remains externally required by issue #750. Exact authenticated PR-head test execution remains `NOT_RUN`; supporting evidence must not be relabeled as native PASS.
