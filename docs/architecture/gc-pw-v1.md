# GC-PW/1.0 — portable Preview/Weight contract conformance (integrator I01)

**Status:** Candidate interface/negative-test specification; not adopted by running XML→CII yet.  
**Owner:** [architecture #999](https://github.com/reallaksh19/3D_Converters/issues/999), executed under [#1003](https://github.com/reallaksh19/3D_Converters/issues/1003).  
**Consumers:** [Agent-P #1000](https://github.com/reallaksh19/3D_Converters/issues/1000) (4 Preview) and [Agent-W #1001](https://github.com/reallaksh19/3D_Converters/issues/1001) (6 Weight Match + Rigid Weights Need Review).
**Basis:** main at 485310e7f5e5472a1b189fde6d4dff677af071f2, Common V3.2 protocol at c6cbe524915281760b516660d4330ba0f51d44b4.
**Original authority:** docs/Overall_roadmap.md §7 X004 and owner issue #781/#769, with #998 owner-observed Preview hang.

## Decision / rejected approaches

Adopt **one domain-neutral, JSON-serializable local fact/review contract**, adaptable through domain, store, execution and presentation adapters. Keep the existing master-index workers and engineering resolution algorithms instead of rewriting them. Do not import the current Preview or Weight UI into the contract; do not implement HTTP, remote authentication, a deployment target or the Advanced_Analysis domain.

Rejected: changing only a spinner/timeout; copying all master rows into UI to implement the contract; making separate computed facts in Preview and Weight; treating every first ranked proposal as accepted; reusing metadata-only file size/row-count caches; embedding XML-CII concepts into the base envelope; deploying a generic server framework before a local read-model is proven.

**This PR is I01 foundation only**: a pure validator and negative/positive conformance tests. It does not improve actual Preview performance or affect shipped product behavior.

## Source-level reality at takeover

The existing converters/worker-contract.js accepts ArrayBuffer converter-run messages and is intentionally not used for new GC-PW data transfer. converters/xml-cii2019-core/rigid-weight-authority.js uses FNV-1a-style row fingerprint and WeakMap; no cryptographic immutable basis is guaranteed by that module. Preview renderer caches keyed by XML length/prefix and master counts, and Weight renderer by filename/size/JSON length/master count. These risk stale results; the live route will need separate migration. The #998 measured owner-scale browser RED remains required before any live Preview migration.

## Versioned interfaces

The module contracts/gc-pw-v1/contract.mjs exports:

- SCHEMA_VERSION, ContractError (stable machine code and JSON-path, no UI state).
- canonicalJson, digestCanonical, digestUtf8 and assertContentDigest: deterministic JSON digests and byte-for-byte UTF-8 text attestation by WebCrypto. Callers must hash actual source/staged text, not just its metadata. The contract cannot prove a producer read the correct file without content custody.
- makeBasisRef / validateBasisRef / assertBasisDigest. A complete InputBasis binds source contents, branch selection, staged source, mapped master dataset contents/revisions, configuration and overrides. An unchanged row count is **not** an unchanged master.
- validateFactRecord, validateProposal: facts have exact occurrence identity, domain/field/unit, authority and provenance. Proposed values are not accepted output.
- validateDecisionCommand / validateDecisionBatch: explicitly scoped, version-expected commands; duplicate commands, double decisions on one occurrence, wrong scope/basis and missing manual weight are rejected. **Persistence/idempotency across requests and optimistic CAS execution remain to be implemented by the future decision store**, not falsely claimed here.
- validatePage / assertCompletePopulation: reading one virtualized page cannot pass as entire selected input population. Page total consistency, cursor continuation, final cursor and unique identities verified; the verifier **requires an independent expectedTotalCount** derived from source-selection custody, so a truncated producer cannot simply underreport its own total.
- validateJobEvent: worker progress cannot claim success before a known completed total or for an old basis; failed jobs carry code/stage/retryability.
- validateSnapshotRef: X004 stages stay precisely \`preview\`, \`RigidMatch1\`, \`Rigidmatch2\` with immutable digest and revision; creation/freeze and cross-stage chain verification are later integration concerns.

These are **validation adapters**, not mutable producer, datastore, cache, domain engine, queue, cancellation backend, or converter run writer. The proposed typed interfaces in #999 remain normative; this module documents its additional strict preconditions as a candidate for #999 A1 schema approval.

### Contract constraints

- Objects must have a plain JSON shape, no browser File or DOM element, no native Map/Date/ArrayBuffer, no functions/symbols/undefined/NaN/Infinity, cyclic input or unsafe object keys.
- SHA256 values must be 64 hex characters; makeBasisRef SHA-binds the canonical entire envelope except the digest field itself; assertBasisDigest rejects changed, equal-length values.
- The portable common \`FactRecord\` supports any subject/field/unit (the non-XML test uses a pressure instrument). The XML-CII adapter supplies Line Key/Class/Rating/B31.3 and actual weight rules. Weight Proposal is specialized to positive numerical quantities and includes a unit; downstream XML-CII enforces kg.
- Same source ID cannot occur twice in sourceRefs, but distinct branch/node occurrences within a source are permitted and must not be keyed solely by engineering NodeNumber. Mode A source isolation and Mode B original lineage are XML-CII adapter obligations.
- A \`Page.complete=true\` means its computation basis is complete, **not** that the page contains all rows. assertCompletePopulation verifies full traversal. Never use UI limits as the total universe for bulk selection or export.
- The \`authority=proposed\` / suggestion evidence is not an accepted decision. \`unresolved\` or \`conflict\` require null value, not silently manufactured 0.
- X004 snapshot names and freeze points are immutable. Match-1 and Match-2 are independent review decisions. Output must separately hash JS engine input, Python parse input and CII; no Preview-vs-Run self-parity substitution for an independent engineering oracle.

## Execution topology and forward compatibility

Local-first ports: openBasis, getFacts (paged), getProposals (paged), applyDecisions (transactional), getSnapshot, verifyRun, subscribeJob, cancelJob. The public ports exchange JSON-compatible envelopes. An API transport can be implemented later without importing Web APIs or changing domain semantics. Keep the core independent of network URL/path/auth.

**Write topology:** Agent-P owns Preview fact producer/presentation; Agent-W owns Weight scorer and Match-1/Match-2 presentations. Integrator owns this validator, contract revisions, shared worker/router integrations and complete CII run oracle. Their modules can be tested separately against a read-only mock while either counterpart is incomplete; integration PRs are serialized at exact heads.

## Mandatory qualification and known gaps

The independent tests cover same-length source or same-count master modifications, wrong basis, duplicate source/scope, unsafely typed numeric data, arbitrary domain fixture, stale proposals, explicit acceptance, duplicate transactions, incomplete/truncated pages, out-of-order jobs and exact snapshot stage names.

This **does not yet prove**: actual owner 385/10699/383/1595 Preview browser responsiveness; all legacy exact/fuzzy matching semantics; Match-1/Final implementation; domain-specific matching unit and mass conservation; full Mode A/B run/output; transport cancellation; repository/engine integration; source/docs deployment. These remain in #1000/#1001/#999/#927 and require independent real XML/master output oracles.

## Contract evolution

Freeze GC-PW/1.0 semantic meanings in #999; this implementation is an A1 candidate. Refinement that changes validation requirements is proposed on #999 with an explicit before/after conformance fixture and an additive 1.1 version plan. Breaking meaning changes require 2.0 and dual-read migration. Neither offloaded agent silently modifies the common validator or schema. Avoid promoting the candidate merely because its isolated tests pass.

## Test command

\`node --test tests/gc-pw-v1-contract.test.mjs\` — Node 18+ with WebCrypto from node:crypto in test only. No test execution is inferred from the presence of this file. Exact-head hosted log/report must be cited separately.
