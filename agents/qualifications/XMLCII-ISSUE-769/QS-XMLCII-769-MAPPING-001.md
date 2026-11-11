QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
CHAIN_ID: XMLCII-ISSUE-769
QUESTION_SET_ID: QS-XMLCII-769-MAPPING-001
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-MAPPING-MASTER-IMPORT
QUALIFICATION_BASIS_HEAD: e16fe79fd0a2d542cc2475c9e4a40f9aa6fc701f
OWNER_QUALIFICATION_BASELINE: QB-ISSUE-769-A
QUESTION_SET_STATUS: CURRENT
QUESTION_SET_ADMISSION_STATUS: PENDING_INDEPENDENT_ADMISSION_ON_TAKEOVER

# Q1 — Production Trace
Repository anchors: `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-fuzzy-mapper.js`; `converters/xml-cii2019-core/linelist-mapping.js`; standalone Source & Masters field configuration.
Production object/case: a synthetic multi-row line-list column set containing `From`, `To`, `Density Mixed`, `Density Gas`, `Density Liquid`, `Fluid`, `Line Seq No`, and `Piping class` under `__EMPTY_*` keys.
Concrete payload: the literal labels `From`, `To`, `Density Mixed`, `Density Gas`, `Density Liquid`, `Line Seq No`; a phase label `Fluid`; a wrong persisted candidate `Line Seq No -> Piping class`.
Required derivation: trace one column from imported row/header evidence through fuzzy/core detection, claim arbitration, semantic validation, normalized row access, and Preview consumption. Identify exactly where explicit evidence can be lost or overridden and why an incompatible persisted map must be rejected.
Required numerical/technical evidence: exact selected field keys before and after detection for at least one multi-row density column and the Line Seq/Piping Class conflict.
First authority/ownership boundaries: imported source header evidence -> canonical mapping resolver -> normalized row -> UI presentation.
Fail if: explicit labels are treated as lower authority than value shape, phase-specific density collapses into generic density, or the answer relies on UI labels without tracing the resolver.

# Q2 — Current Unresolved Problem / Failure Isolation
Repository anchors: standalone master upload/parser events and `xml-cii-adapted-master-runtime.js` persistence path.
Calculation/reconstruction: reconstruct a 10k-row piping-class import from XLSX parse through normalization, in-memory state commit, and browser persistence. Separate the first operation that can emit `Failed to parse file` from the later `localStorage.setItem`/quota boundary.
Concrete payload: `10k` rows; error text `Failed to parse file`; duplicate candidate representations raw rows + normalized rows + workbook data.
Required derivation: estimate relative serialized duplication and identify which failure boundary can throw after parsing has already succeeded. State a fault-injection case where storage throws while active-session import remains valid.
Required numerical/technical evidence: show at least the multiplicative representation count and one bounded byte/quota scenario sufficient to distinguish parse success from persistence failure.
Predicted intermediate values: parsed workbook/selected rows exist before persistence; a quota exception occurs only at persistence; session state remains usable if persistence is fail-soft.
First wrong boundary: catch/error ownership that re-labels persistence failure as parse failure and/or persists redundant large payloads.
Falsifier: if a pure parse-only run fails before normalization with the same source, persistence is not the first wrong boundary.
Fail if: the answer merely recommends increasing quota or suppressing the exception.

# Q3 — Authority / Invariant
Repository anchors: line-list FIELD_RULES/detection order/fallbacks; standalone fuzzy mapping claim logic.
Required technical work: state the precedence and exclusivity invariants for explicit semantic headers, generic Density, phase-specific density, From/To, Line Seq No, and Piping Class.
Concrete payload: `generic Density`; `phase-specific density`; labels `Gas`, `Liquid`, `Mixed`; explicit `From` and `To`.
Required derivation: demonstrate why a column whose multi-row semantic path includes `Density` + `Gas` cannot be claimed by generic Density, and how persisted mappings are revalidated without silently inventing missing fields.
Authority/source trace: imported header evidence -> canonical semantic resolver; data-shape inference is lower authority and must not override explicit labels.
Protected invariant: no permissive fallback from phase-specific density to generic Density; no incompatible field claim; no duplicate ownership except an explicitly documented shared-key contract.
First wrong boundary: semantic classifier/claim arbitration, not downstream Preview formatting.
Falsifier: a true generic Density column with no phase qualifier must still map correctly.
Invalid shortcut: hard-coding one `__EMPTY_12` key or one workbook layout.
Fail if: the proposed rule relies on column position rather than semantics.

# Q4 — Independent Validation
Repository anchors: new focused mapping/import tests plus repository-wide XML→CII standalone tests.
Required technical work: define validation that is independent of production success signals and preserves `NOT_RUN` honestly.
Concrete payload: `10k`, `50k`, `100k` row master sizes; exactly ±30 is not relevant to this scope and must not leak from later weight work; one quota fault injection; one synthetic multi-row header fixture.
Calculation/reconstruction: for mapping, construct expected field-map values by literal semantic rules before invoking production code; for persistence, inject a deterministic storage quota failure after successful parse/normalize.
Required derivation: specify expected outputs and failure ownership for each case and why a green import UI alone is not an oracle.
Independent oracle: literal expected mapping table from Owner-provided labels plus a deterministic storage stub/fault injector that distinguishes parse from persistence.
Required numerical/technical evidence: 10k/50k/100k row counts, persisted representation counts/bytes where measured, and exact map keys for the fixture.
Units/sign/tolerance: byte measurements reported as measured values; no invented performance threshold.
Falsifier: if session import is lost when persistence fails, the fix is incomplete even if the alert text improves.
Fail if: source inspection or compilation is promoted to benchmark PASS.

# Q5 — Next Contribution / Minimal Patch
Repository anchors: same mapping and master-runtime owners plus focused tests.
Required technical work: identify the smallest legitimate production-owner changes for TASK-001/TASK-004 without touching weight, B31.3, writer scale, roadmap, or unrelated refactors.
Concrete payload: `no broad refactor`; `no storage exception relabeled as parse failure`; explicit labels and 10k+ import behavior from Issue #769.
Required derivation: name the first wrong mapping/persistence boundaries, expected before/after behavior, tests, backup requirement, and rollback condition.
Safe patch boundary: semantic header classifier/claim validation + line-list normalization/fallback ownership; master parse/persistence error ownership and compact persistence only where necessary.
Expected before/after evidence: before, phase-qualified density or From/To may be missed/misclaimed and quota may surface as parse failure; after, exact semantic fixture passes and storage failure leaves active session usable with accurate diagnostics.
Protected unchanged domains: kg→CII scale, rigid-weight authority, B31.3 engineering factors, branch-family mapping, roadmap content.
Validation required: focused regression tests + full standalone suite when executable + large-row qualification/fault injection.
Negative test: true generic Density still maps; ambiguous/unsupported fields remain unmapped; parse failure remains a parse failure; quota failure is not.
Rollback/falsifier boundary: revert if the change causes explicit label regressions, silently discards required workbook behavior, or changes engineering numerical output outside the authorized scope.
No-patch condition: if source inspection proves the first wrong boundary lies in a different authority owner, stop and re-scope rather than layering a compatibility shim.
Fail if: the answer proposes a downstream UI-only patch or changes unrelated engineering authority.