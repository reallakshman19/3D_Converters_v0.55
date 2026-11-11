# PR624 Work Report — XML→CII Preview Line List Preindex

## Current state

- PR: #624 — `perf(xml-cii): preindex Preview Line List lookups`
- Branch: `agent/xml-cii-preview-line-index`
- Baseline main: `a639719abda2619f2c507a210ea50560f14c6174`
- Baseline note: main advanced from `eef94949961970171d1366f5b6a9d421b3cc0d9f` during implementation because PR #615 landed. The intervening commit touched vibration/roadmap files only; the PR was rebuilt directly on `a639719...`.
- Merge authorization: **NOT GIVEN**. Keep draft/unmerged.
- Worker offload: **NOT ADMITTED** by this PR.

## Objective

Remove repeated `O(branches × Line List rows)` Line List key/fuzzy preparation from XML→CII 2019 Preview before considering worker offload, while preserving existing engineering authority and strict-line fail-closed behavior.

## RCA

The current Preview core performs, per branch:

1. a full Line List exact/alias scan;
2. if that misses, a second full fuzzy scan;
3. row-key extraction, normalization, digit-run extraction and Dice-bigram preparation are repeated inside those scans.

The retained browser timing investigation established the 250-row semantic rebuild near/above the 50 ms long-task boundary and identified indexing as the required next action before workers. Those browser measurements were advisory Chromium-main-thread evidence, not repository-native exact-checkout qualification.

## Implementation

### Production files

1. `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-line-index-core.js`
   - pure exact/alias/fuzzy preindex primitives;
   - preserves first-exact and unique-alias semantics;
   - retains every ambiguous alias candidate;
   - precomputes row digit runs and row key/sequence bigrams;
   - preserves fuzzy threshold/tie behavior;
   - creates a sparse lookup array at original source indexes.

2. `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-line-index.js`
   - derives branch Line Key and isolated fuzzy token once;
   - builds row metadata once;
   - unions exact/alias/fuzzy candidate indexes;
   - for branches without any candidate, retains every same-Service row so `service-process-fallback` sees the same admissible population;
   - preserves original Line List array length and source indexes;
   - does not mutate the caller's config or master rows;
   - handles sparse input rows defensively.

3. `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js`
   - only first core build receives the prepared sparse Line List view;
   - strict fuzzy rebuild still receives `masterRows: []` from the original config;
   - Bore/Wall, Material and Rating authorities continue to receive the original full config.

### Explicit non-changes

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun-core.js`: **UNCHANGED**.
- `converters/scripts/inputxml_to_cii2019.py`: **UNCHANGED**.
- No worker, Web Worker, thread, task-queue or transport implementation.
- No change to final strict automatic `similar-linekey` / `similar-lineseq` rejection.

## Authority-safety analysis

### Exact / alias

The preindex preserves original source indexes in the sparse array. Exact match therefore returns the same source row/index. Duplicate exact keys preserve the production first-row precedence. Unique alias remains unique. When aliases are ambiguous, all alias candidates remain populated, so the existing core still sees the same ambiguity before fuzzy fallback.

### Fuzzy

The preindex reproduces the existing sequence score, Dice similarity, `0.95` key weighting, `0.55` floor, and first-best/tie rule. It only moves row preparation outside the repeated per-branch scan.

### Service process fallback

`service-process-fallback.js` admits rows by exact Service equality before optional class/connection narrowing. For a branch with no exact/alias/fuzzy candidate, the adapter retains all same-Service rows at their original indexes. Therefore downstream class filtering and majority-consensus behavior operate on the same admissible population.

### Retained timing harness shape

The browser harness creates controlled Line List keys `PERF90000000...`, while real `SYS-0010.xml` branch `/ASIM-1847-3"-S8810333-91261M7-01/B1` derives `S8810333`. The branch Service resolves to `ASIM`, not `PERF`. Regressions assert that 250- and 1000-row PERF timing masters do not re-enter the expensive lookup population through key or Service authority.

## Validation

### Completed locally — implementation-coupled

Command used in the materialized mini dependency closure:

```text
node --test \
  tests/xml-cii-preview-strict-line-authority.test.mjs \
  tests/xml-cii-preview-line-index.test.mjs \
  tests/xml-cii-preview-line-index-service.test.mjs \
  tests/xml-cii-preview-line-index-duplicate-exact.test.mjs
```

Result: **15/15 PASS**.

Coverage includes:

- exact source-index preservation;
- duplicate exact first-row precedence;
- unique service-prefix alias;
- ambiguous alias retention;
- fuzzy line-sequence first-best parity;
- multi-branch union/index preservation;
- 1000-row exact reduction;
- retained SYS-0010 timing-master mismatch at 250 and 1000 rows;
- dense-vs-sparse Service consensus equivalence;
- SYS-0010 `ASIM` Service excludes `PERF` rows;
- optimized first build / strict empty-master rebuild routing;
- strict automatic fuzzy rejection;
- explicit exact branch mapping preservation.

All authored production modules passed `node --check` in the local materialized closure.

### Committed for repository-native execution

- `tests/xml-cii-preview-line-index-adapter.test.mjs`
  - imports the production adapter directly;
  - asserts 250/1000 retained timing shape produces `lookupRows = 0`;
  - asserts exact match remains at source index 7;
  - asserts unmatched WATER branch retains all same-Service rows `[2,5,9]`.

### NOT_RUN / unresolved validation

- Full repository-native Node test suite: **NOT_RUN** in the available execution container because a complete checkout cannot be cloned there.
- Exact-checkout retained Chromium timing harness on PR #624: **NOT_RUN** until repository CI/browser execution is available.
- Post-index 50 ms worker-admission decision: **UNRESOLVED** until exact Chromium timing executes.

Do not substitute the prior advisory Chromium mirror timing for this post-change exact-checkout gate.

## Changed-file ledger

| Path | Status | Purpose |
|---|---|---|
| `.backups/PREVLINEIDX_tabs_xml_cii_2019_standalone_ui_adapted_xml_cii_adapted_preview_dryrun_js.bak` | added | exact pre-edit wrapper custody |
| `.backups/PREVLINEIDX_tests_xml_cii_preview_strict_line_authority_test_mjs.bak` | added | exact pre-edit strict-test custody |
| `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js` | modified | route first core build through preindex |
| `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-line-index-core.js` | added | pure index/fuzzy-selection primitives |
| `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-line-index.js` | added | production adapter / sparse-view construction |
| `tests/xml-cii-preview-line-index.test.mjs` | added | pure selection parity/regression |
| `tests/xml-cii-preview-line-index-service.test.mjs` | added | Service fallback preservation |
| `tests/xml-cii-preview-line-index-adapter.test.mjs` | added | direct production adapter regression |
| `tests/xml-cii-preview-line-index-duplicate-exact.test.mjs` | added | duplicate exact first-row precedence |
| `tests/xml-cii-preview-strict-line-authority.test.mjs` | modified | first-build index routing + strict fail-closed regression |
| `agents/PR624_workreport.md` | added | living implementation/validation/handover record |

## Decisions / risks

- **DEC:** Keep the 600+ line Preview core untouched in this PR; optimize through a prepared sparse view.
- **DEC:** Preserve array length and original indexes rather than compressing to dense rows, because row index is observable provenance.
- **RISK:** Core still performs cheap loop iterations over sparse holes. If post-index Chromium remains above target, the successor optimization may introduce a dense indexed view carrying explicit original-index metadata, but that requires separate qualification because it changes the core interface.
- **RISK:** Prior advisory timing reduction cannot be applied numerically to this exact sparse-view implementation without rerunning the retained browser harness.
- **RISK:** GitHub Actions historically failed to start for the retained timing workflow; do not treat absent runs as a pass.

## Handover status

The PR is handover-ready from an implementation/custody perspective, but **not qualified for merge** until repository-native tests and the retained exact Chromium timing gate are executed or explicitly waived by the owner.

## Appendix A — next-agent expert questionnaire

1. Can you prove that the preindex exact-match result returns the same original Line List row and original index as `_xmlCiiFindLineListRow` for duplicate/exact-key cases?
2. Can you prove that an ambiguous alias set remains ambiguous inside the unchanged core rather than being collapsed by the preindex?
3. For a branch with no exact/alias/fuzzy Line List candidate, can you demonstrate that every row admissible to `buildXmlCiiServiceProcessFallback` remains present after sparse filtering, including optional Piping Class narrowing?
4. Does the strict wrapper still rebuild every automatic `similar-linekey`/`similar-lineseq` result with an empty Line List master, and can you show this with a repository-native test?
5. Does any downstream Bore/Wall, Material or Rating authority receive the sparse config instead of the original full config?
6. On the retained `SYS-0010.xml` browser timing ladder, what are the post-index semantic medians for 0, 250, 1000 and 3×/250 cases, and which case(s) exceed 50 ms?
7. If 1000 rows or 3× scale remain above 50 ms, can you separate time spent in sparse-hole iteration, Piping Class lookup, material resolution and other authorities before proposing worker offload?
8. Can you confirm `converters/scripts/inputxml_to_cii2019.py` and `xml-cii-adapted-preview-dryrun-core.js` remain byte-identical to main?
9. Can you reproduce the full repository-native XML→CII Preview regression suite with no failures and record any NOT_RUN tests explicitly?
10. Based on measured post-index Chromium evidence, is worker admission technically justified, or is another synchronous/indexing optimization still the lower-risk engineering action?
