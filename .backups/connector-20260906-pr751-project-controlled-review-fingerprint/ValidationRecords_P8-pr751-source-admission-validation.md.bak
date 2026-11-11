# P8 PR #751 source-admission validation

VALIDATION_ID: P8-PR751-SOURCE-ADMISSION-20260906
PR: #751
PR_HEAD_VALIDATED: 0083361bab2ba29efb28f6c15b9b31a66e127b09
MAIN_OBSERVED: c5815ae827edc231b933f56554218e642e60c179
NODE_VERSION: v22.16.0

## Intended exact repository command

```bash
node --test \
  tests/flange-face-binding-source-admission.test.mjs \
  tests/flange-face-binding-source-register.test.mjs
```

STATUS: NOT_RUN
OBSERVATION: A native authenticated checkout of private repository `reallaksh19/3D_Converters` was unavailable in the current connector/container boundary. No GitHub PR-triggered workflow run was available to substitute for that execution.
ORACLE: exact repository checkout required for native PASS.

## Reconstructed focused execution

STATUS: PASS_SUPPORTING_RECONSTRUCTION
OBSERVATION: LOCAL_EXECUTION over a reconstructed focused dependency set
ORACLE: IMPLEMENTATION_COUPLED regression coverage plus issue/checklist source-governance rules
NODE_VERSION: v22.16.0
RESULT: 24 tests / 24 pass / 0 fail / 0 skipped
DURATION_REPORTED_BY_NODE: 85.320853 ms

The reconstruction used exact GitHub blob bytes for the focused source-custody files, including:

- `converters/engineering-calculations/flange/flange-face-binding-source-admission.js` — `250618d9b9f797863ed9c64648a9c590a1d1d0b6`;
- `converters/engineering-calculations/flange/flange-face-binding-source-register.js` — `9254991c257b04bb26c15dc69d92cfcbf63660a5`;
- `converters/engineering-calculations/flange/advanced-analysis-semantic-hash.js` — `7c443237aa573b79322f24733733955d7b64d878`;
- `scripts/admit-flange-face-binding-source.mjs` — `2cf38939b799ebddff4060a4d52e758b06ed67be`;
- `scripts/compute-flange-face-binding-source-review-hash.mjs` — `d5fbb4e9c6d7a15e557c37127b94734ddc2121c3`;
- `tests/flange-face-binding-source-admission.test.mjs` — `c8749fabdb4fac7c8a78bcd16df00ac1d636ee99`;
- `tests/flange-face-binding-source-register.test.mjs` — `342387a1489936eb366d11d508b465c1a4980cb1`.

The imported `advanced-analysis-interface-adapter.js` remains reduced in the reconstructed environment to its two exact pinned constants because neither focused test executes the adapter function. This limitation keeps the result supporting-only rather than an authenticated exact-checkout PASS.

The new review-fingerprint CLI also passed `node --check` in the reconstructed environment, and its local Git blob SHA exactly matched the GitHub blob above.

## Validation findings and repairs

### Review replay

The initial admission implementation did not bind review identity/evidence/disposition to exact candidate semantics. An accepted review could therefore be replayed against another valid record.

PR #751 now computes `reviewedSubmissionHash` over all record semantics except `recordState` and final `semanticHash`. This preserves the same review hash across the controlled `PROJECT_CONTROLLED -> INDEPENDENTLY_CHECKED` state transition while binding project/model/joint/face/frame/interface/provenance/tolerance semantics.

Negative verification confirms that changing `selectedFaceId` while reusing the prior accepted review is rejected.

### Review workflow operability

After adding `reviewedSubmissionHash`, the repository still lacked a supported way to generate that fingerprint before independent review, and the intake/checklist language did not require the exact new field. The independent-review checklist also used `ACCEPT / REJECT / HOLD`, while issue #750 and the admission contract use `ACCEPTED / REJECTED / NOT_RUN`.

PR #751 now:

- adds `scripts/compute-flange-face-binding-source-review-hash.mjs`;
- tests the pre-review fingerprint path using a `PROJECT_CONTROLLED` candidate;
- updates the issue form to collect the exact `reviewedSubmissionHash`;
- updates the controlled submission workflow to compute the hash before review and carry it through the state transition;
- aligns the independent-review checklist disposition values exactly with issue #750 and the software contract.

## Protected unchanged boundaries

No result in this record establishes or changes:

```text
codeCompliance            true
designAuthority           true
governingEligible         true
automaticBindingProducer  true
```

No model geometry, flange face, opening direction, mating side, interface identity, engineering tolerance, master data or solver result is inferred or defaulted by this PR.

One real independently accepted controlled project source remains externally required by issue #750. Exact native PR-head test execution remains `NOT_RUN`; the supporting reconstruction must not be relabeled as native PASS.
