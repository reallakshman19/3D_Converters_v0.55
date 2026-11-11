# PR #751 work report — P8 flange source admission

## Mission

Add one fail-closed source-submission admission boundary for issue #750 without inventing controlled project facts or enabling automatic flange binding.

## Live basis

- PR: #751
- branch: `work/engcalc-p8-750-source-admission-20260906`
- base/main observed: `c5815ae827edc231b933f56554218e642e60c179`
- Common protocol: `engineering-pr-delivery-v2@3e21f0054ab8d80b7fe045e7c105a81643fcbbf7`
- work item: `github:reallaksh19/3D_Converters#750`
- merge authority: OWNER_ONLY; merge authorized: FALSE

## Delivered implementation

- `converters/engineering-calculations/flange/flange-face-binding-source-admission.js`
  - requires `recordState = INDEPENDENTLY_CHECKED`;
  - requires exact independent-review provenance fields and `disposition = ACCEPTED`;
  - requires a matching stable `reviewedSubmissionHash` over the reviewed candidate semantics;
  - reuses the existing v1 sealer/register validator;
  - preserves `PROJECT_SOURCE_CUSTODY_ONLY` and all non-authorizing flags.
- `scripts/compute-flange-face-binding-source-review-hash.mjs`
  - fingerprints one exact project-controlled candidate before independent review;
  - returns `recordId`, `recordRevisionId` and `reviewedSubmissionHash`;
  - changes no record state and grants no authority.
- `scripts/admit-flange-face-binding-source.mjs`
  - reads one JSON submission and applies the same fail-closed admission boundary.
- `tests/flange-face-binding-source-admission.test.mjs`
  - positive path plus DRAFT/PROJECT_CONTROLLED/RETIRED, REJECTED/NOT_RUN, incomplete provenance, stale-hash and review-replay negative paths;
  - verifies review-hash stability across `PROJECT_CONTROLLED -> INDEPENDENTLY_CHECKED`;
  - verifies the pre-review CLI fingerprints the intended controlled candidate.

## Source-governance workflow alignment

The issue form, controlled-source workflow and independent-review checklist now require the exact `reviewedSubmissionHash` used by the software admission contract.

The checklist disposition vocabulary is aligned to issue #750 and the runtime admission contract:

```text
ACCEPTED | REJECTED | NOT_RUN
```

The previous checklist-only `ACCEPT | REJECT | HOLD` wording is no longer used for admission.

## Protected invariants

No geometry inference, automatic binding producer, master resolution, solver invocation, Code-compliance claim, design authority or governing eligibility was introduced. The existing generic sealer/hash primitive was not modified.

The review fingerprint excludes only `recordState` and final `semanticHash`; every project/model/joint/face/opening/mating/interface/provenance/tolerance semantic remains review-bound.

## Validation truth

- exact authenticated repository focused Node tests: NOT_RUN;
- supporting reconstructed focused execution: PASS 24/24 on Node v22.16.0;
- new review-fingerprint CLI syntax: PASS / supporting local `node --check`;
- new CLI local Git blob: `d5fbb4e9c6d7a15e557c37127b94734ddc2121c3`, matching GitHub;
- updated admission test local Git blob: `c8749fabdb4fac7c8a78bcd16df00ac1d636ee99`, matching GitHub;
- PR-triggered workflow runs: none observed;
- supporting reconstruction remains explicitly non-native because the Advanced_Analysis adapter import was reduced to its two exact pinned constants;
- validation details: `ValidationRecords/BoltedJoints/P8-pr751-source-admission-validation.md`.

## Remaining blockers

- authenticated exact-checkout execution remains unavailable;
- independent PR review has not yet occurred;
- no real controlled project source record exists.

PR #751 may be presented for independent review, but these blockers prevent any merge-readiness or issue-completion claim.

## EXACT_NEXT_ACTION

Obtain independent PR review and, when an authenticated exact checkout is available, execute:

```bash
node --test tests/flange-face-binding-source-admission.test.mjs tests/flange-face-binding-source-register.test.mjs
```

Do not merge without explicit Owner authorization. Keep issue #750 open until one real independently accepted controlled source is supplied.
