# PR #751 work report — P8 flange source admission

## Mission

Add one fail-closed source-submission admission boundary for issue #750 without inventing controlled project facts or enabling automatic flange binding.

## Live basis

- PR: #751 / open / ready for independent review / mergeable
- branch: `work/engcalc-p8-750-source-admission-20260906`
- base/main observed: `c5815ae827edc231b933f56554218e642e60c179`
- Common protocol: `engineering-pr-delivery-v2@a5dda23c988ea2e800bb44c28768ec6b9d51e180`
- Common drift from prior basis `3e21f0054ab8d80b7fe045e7c105a81643fcbbf7`: metadata/non-protocol only; comparison changed `books/**` and did not change `skills/engineering-pr-delivery-v2/**`
- work item: `github:reallaksh19/3D_Converters#750`
- merge authority: OWNER_ONLY; merge authorized: FALSE

## Delivered implementation

- `flange-face-binding-source-admission.js`
  - pre-review fingerprint requires `PROJECT_CONTROLLED`;
  - admission requires `INDEPENDENTLY_CHECKED`, `ACCEPTED`, matching `reviewedSubmissionHash`, explicit preparer/reviewer provenance, and reviewer/preparer separation;
  - emits `admissionSemanticHash` binding the full admitted custody envelope;
  - exports persisted-envelope validation against the reconstructed admission contract;
  - preserves `PROJECT_SOURCE_CUSTODY_ONLY` and all non-authorizing flags.
- `compute-flange-face-binding-source-review-hash.mjs` fingerprints one exact project-controlled candidate before review.
- `admit-flange-face-binding-source.mjs` admits one reviewed JSON submission and emits the sealed envelope hash.
- `validate-flange-face-binding-source-admission.mjs` verifies a persisted admission artifact and fails closed on stale/tampered envelope state.
- Focused tests cover state gates, review replay, reviewer independence, stale record hashes, admission-envelope integrity, and CLI behavior.

## Source-governance workflow alignment

The issue form/workflow/checklist retain the pre-review evidence contract and require post-admission custody of the exact admitted JSON plus `admissionSemanticHash`.

The envelope hash covers the sealed record, independent-review provenance, reviewed-submission fingerprint, source authority and false authority-promotion flags. It is custody tamper evidence when its expected value is retained independently; it is not a digital signature, identity authentication or proof of historical authenticity if the artifact and hash are both replaced.

## Protected invariants

No geometry inference, automatic binding producer, master resolution, solver invocation, Code-compliance claim, design authority or governing eligibility was introduced. The existing generic source-register/sealer remains unchanged.

## Validation truth

- exact authenticated repository focused Node tests: **NOT_RUN**;
- prior supporting evidence: 24/24 reconstruction; 28/28 LEG-004 reproduction; 3/3 LEG-005 delta; 5/5 LEG-006 delta;
- EP-0008 full focused exact-file materialization: **PASS 33/33**, Node v22.16.0;
- all 11 source/test/script files in the focused import closure matched their GitHub blob IDs before execution; no stubs/reductions remained;
- this 33/33 result is `PASS_SUPPORTING_EXACT_FILE_MATERIALIZATION`, not authenticated-checkout PASS;
- PR-triggered workflow runs: none observed;
- independent PR review: NOT_RUN;
- real controlled #750 source: BLOCKED / not supplied;
- validation record: `ValidationRecords/BoltedJoints/P8-pr751-source-admission-validation.md`.

## Remaining blockers

- authenticated exact-checkout execution remains unavailable;
- independent PR review has not occurred;
- no real controlled project source record exists.

PR #751 remains review-ready, not merge-ready.

## EXACT_NEXT_ACTION

Obtain independent PR review and, when an authenticated exact checkout is available, execute:

```bash
node --test tests/flange-face-binding-source-admission.test.mjs tests/flange-face-binding-source-register.test.mjs
```

Do not merge without explicit Owner authorization. Keep issue #750 open until one real independently accepted controlled source is supplied.
