# WIP-VIB-EIT-ROADMAP-20260818 Work Report

## Recovery Header

- WORK_INTENT: IMPLEMENT
- REPOSITORY_STATE: NEW_PR_REQUIRED
- MUTATION_AUTHORITY: WRITE_ALLOWED
- CRITICALITY: ENGINEERING_CRITICAL
- EXECUTION_MODE: MANUAL
- BASE_BRANCH: main
- BASE_MAIN_SHA: be618ecdfbb11df21e3c16cc1b18d96e5a2472a9
- WORK_BRANCH: agent/vibration-eit-roadmap-20260818
- MERGE_AUTHORITY: OWNER_ONLY / NOT_GRANTED
- REPORT_BASIS_HEAD: be618ecdfbb11df21e3c16cc1b18d96e5a2472a9

## Handover in 60 Seconds

Mission: start the integrated vibration-project/right-roadmap implementation by extracting a generic EnergyInstituteEit.v5 multi-module import core and adding a read-only Phase × Scope × Specialty roadmap projection/renderer. The panel is navigation guidance only and must never determine applicability, LOF, aggregation, completeness, or engineering authority.

Current main is be618ecdfbb11df21e3c16cc1b18d96e5a2472a9. Active overlap is COORDINATION_REQUIRED: PR #571 owns mechanism coverage; PR #539/#540 own engineering-calculation-console-view.js and engineering-calculation-vibration-family.js; PR #506/#517 own AIV hardening; PR #546/#508 own SBC; PR #560 owns docs/FIVroadmap.md. This slice intentionally avoids all claimed production files.

## Mission / Scope

Implement new-file-only first slice:

1. Generic EIT v5 contract/parser that preserves mixed modules and raw legacy payloads.
2. Module registry for observed controlled-v5 tokens fit/fip/mex/aiv/sbc/thw/tra/caf.
3. Read-only roadmap registry/projection using Phase × physical scope × specialty.
4. Standalone panel renderer and CLI inspection seam so capability is executable before shared UI mounting.
5. Focused regressions proving imported data is not promoted to current engineering authority and missing module != NOT_APPLICABLE.

Out of scope: numerical equations; method thresholds; mechanism applicability decisions; raw-item→mainline aggregation correction; current AIV/FIT/SBC workspace state mutation; workflow files; existing-file UI mounting; merge.

## Authority / Invariants

- Imported .eit numerical results are historical/review-required evidence only.
- `modules` declaration is not the sole evidence of a module payload; result/data presence are tracked independently.
- Missing module does not mean NOT_APPLICABLE.
- Roadmap projection is non-authoritative presentation/navigation state only.
- Roadmap collapse/render/navigation cannot change engineering results.
- Known existing calculation IDs may be navigation targets; unknown targets remain capability-only and must not be invented.
- `designAuthority=false`; no new screening authority.

## Coordination

- PR #571: shared mechanism universe/coverage. This slice imports the existing registry only if safe; no coverage files edited.
- PR #539/#540: exact UI-file overlap avoided in first slice.
- PR #506/#517: existing AIV .eit files unchanged; generic parser is additive and does not replace AIV authority handling yet.
- PR #546/#508: SBC runtime/master files unchanged.
- PR #560: roadmap doc unchanged.

Classification: COORDINATION_REQUIRED, SAFE_FOR_NEW_FILE_ONLY_SLICE.

## Current Technical Hypothesis / Falsifier

Hypothesis: the controlled EnergyInstituteEit.v5 structure is multi-module and can be losslessly normalized into non-authoritative module-presence records, which can then drive a non-binding roadmap projection without inspecting calculation internals.

Falsifier: if a controlled-v5 line cannot preserve module declaration/result/detail presence independently, or the roadmap projection requires calculating engineering applicability/LOF to render useful state, stop and redesign before production integration.

## Validation Ledger

- Live main/source grounding: PASS / SOURCE_INSPECTION / GitHub
- Open PR overlap review: PASS / SOURCE_INSPECTION / GitHub
- Native checkout: NOT_RUN / ENVIRONMENT_BLOCKED (`Could not resolve host: github.com`)
- Focused reconstructed Node tests: NOT_RUN
- Repository-native Node tests: NOT_RUN
- Browser acceptance: NOT_RUN

## Changed-file Ledger

Planned new files only:
- agents/WIP-VIB-EIT-ROADMAP-20260818_workreport.md
- converters/vibration/eit/contract.js
- converters/vibration/eit/module-registry.js
- converters/vibration/eit/parse.js
- converters/vibration/roadmap/registry.js
- converters/vibration/roadmap/projection.js
- tabs/vibration-roadmap-panel.js
- scripts/inspect-vibration-eit-roadmap.mjs
- tests/vibration-eit-generic.test.mjs
- tests/vibration-roadmap-projection.test.mjs

## Appendix A — Implementation Qualification

Not a takeover. New work starts from exact current main with no inherited branch implementation. Repository-specific qualification is represented by the production trace/invariants/test plan above; no score is fabricated.

## EXACT_NEXT_ACTION

Create the branch from exact current main, add the new generic EIT contract/module registry/parser, then execute reconstructed focused Node tests against exact file content before adding roadmap projection/renderer.
