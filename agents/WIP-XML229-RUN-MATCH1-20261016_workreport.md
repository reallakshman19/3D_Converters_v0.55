# XML229 G4 Run truth + Match-1 authority regression correction

**Scope:** Owner requested immediate Step-1 coding on held draft #276. Base `3badfdbb02c5e39ae9ac5081f8e5a8c0e7caa46d`. Source and served renderer mirrors must remain byte-identical. No GC-PW scorer, actual Match-1/Final ledger, native converter, or Run release gate is changed.

## Root causes reproduced from exact CI

1. The existing `tests/xml-cii-standalone-esm-fixture-helper.js` uses a multiline `STATIC_IMPORT_RE` that consumes a preceding `import './xml-cii-adapted-authority-migration.js';` when a subsequent `from './other.js'` import appears. The extracted specifiers omit the side-effect module. The standalone 5 Run test then fails with `ERR_MODULE_NOT_FOUND` while constructing its temporary ESM fixture, under both Node 22/24. Fix: independently scan side-effect import statements; retain existing named/export matching; add explicit scanner and real recursive fixture closure assertions. No fake stub of production migration.

2. The legacy Model Converter Weight Match renderer stores accepted Match-1 provenance via `buildXmlCiiRigidWeightMatch1Provenance` and sets `wmAccepted=true` only from `saveInput` after an explicit selected suggestion/manual edit. But its visible status is `Accepted · Suggested` or `Accepted · Manual`, which the canonical `weightMatchAuthorityPresentation` classifies as `RESOLVED_AUTHORITY`, not accepted Match-1. #776/#781 CI expects the distinct `Accepted · Match-1` authority marker and fails. Fix: render `Accepted · Match-1 · Suggested` or `Accepted · Match-1 · Manual` **only in the existing explicit acceptance handler**; retain candidate/manual provenance. Strengthen regression using the real presentation selector for both positive accepted states and negative unaccepted candidate.

This is a **presentation authority repair**, not acceptance from proposals, and not automatic Final approval. Original 423/2961 Owner coverage, native CII physical consumption and large-JSON performance remain unverified.

## Validation and deployment

Exact-head Node22/24 Run UI, #776/#781 Weight validation and source/docs mirror are required. Before CI: NOT_RUN. Private Owner data and real native CII: NOT_RUN. Other repo-wide C05/LFJ failures remain independent; do not waive or assert full green. No merge or deployment until the scoped tests succeed and the Owner approves integration.

Recovery: original unmodified files backed up under `.backups/20261016-xml229-run-match1/`. Keep this PR a standalone draft into #276. If any active Master/Final behavior changes or a proposal is accepted implicitly, stop/revert.

**Next action:** review exact-head focused jobs and actual rendered Weight Match state; if green, merge this scoped repair **into held #276**, not main; continue private Owner-scale G2/G5 qualification separately.
