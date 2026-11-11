# WIP-XML229-STRICTINDEX-20261016: Preview repeated-index elimination
Parent #274 G2. Owner requested implementation. Engineering-critical; draft only.

## Current GitHub truth and lineage
Base is PR #280 head 2f494f57c12a9ae4e117977b0b51885e87e17ae3 (draft stacked on #276 head 23e6500b, neither merged to main). Main is 9944a5bf. Candidate first code head 56a99be14e9ed34f2fb8fd86ff2f713b3f622791. PR #281 G0/G1 remains separate draft on main; its 24/30 passing workflows are not performance qualification.

## Production trace and falsifier
The original-json-gcpw Worker invokes xmlCiiDryRunPreview on actual staged JSON and full selected masters. Strict Line Authority dry-run rejects similar-linekey/similar-lineseq, rebuilding each automatic-match branch as a fragment with the SAME stagedJsonText and strict Line List config. Previously every core Preview rebuild called buildStagedDtxrIndex on that full JSON again: K automatic branches caused K strict JSON DTXR index rebuilds after the initial baseline. This is source-verified repeated work, NOT a measured root cause of the Owner private-data hang.

The patch lazily builds the strict staged index once within one Preview call, and passes it to each repaired fragment through a read-only runtime.stagedIndex port. A missing port keeps exact legacy parsing. No branch, identity, scoring, authority, mass, owner, accepted Final or native conversion logic changes. K-dependent index work drops to at most one strict index build; actual runtime speed and memory remain UNVERIFIED. If DTXR source provenance, branch/node rows, units or native result differ from original, revert.

## Changed-file ledger and scope
- tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js: lazy one-index-per-repair-group.
- tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun-core.js: consume optional prebuilt staged index, fallback to old calculation.
- Their exact docs/tabs mirrored copies for served parity.
- tests/xml-cii-preview-strict-line-authority.test.mjs: fake index in test temp directory; 2 strict repairs share 1 index, reject fuzzy proposals unchanged, no auto rows build 0 extra staged indexes.
- Three pre-edit backups under .backups/20261016-xml229-strict-index/.

No workflow, native Python, final decision writer, GC-PW scorer, XML-only participation, default governed hold, or Preview worker transports are changed.

## Validation integrity and concerns
Node syntax / targeted strict tests / actual Chromium / private Owner corpus: NOT_RUN until verified; test is written, not claimed passing. A fake staged index counting parse calls cannot establish identical real DTXR value/provenance or native result. Full source-specific Owner 41/423, three supplied masters + automatically loaded 1595 Valve Weight rows, 385/10699/383 masters and original staged JSON must be qualified; public EF05 synthetic/public fixture != Owner acceptance. Profile cold/warm CPU duration and peak memory before claims.

Independent LFJ/Preview/GC-PW workers remain G2/G3 architecture work. Current XML229 Worker still hosts combined Preview and GC-PW. Requires explicit transport/ownership ADR before split; not covered by this fast-path optimization. Existing PR #280 watchdog stops endless waiting but is not a performance solution.

Owner-specific v3.6 label/plan for G2, exclusive runtime write lease, and Owner merge/deploy remain required. Do not invent acceptance. No CII release authorization.

EXACT_NEXT_ACTION: open draft PR stacked on #280; inspect exact SHA, CI and actual source-level strict tests; independently compare full core Preview DTXR/census/sourced masses and outputs on public and Owner data, stop on drift; plan independent Worker split as separate scoped implementation with transport budget.
