QUALIFICATION_EVIDENCE_VERSION: 1
CHAIN_ID: XMLCII-ISSUE-769
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-RELEASE
QUESTION_SET_ID: QS-XMLCII-769-RELEASE-001
EVIDENCE_ID: QE-XMLCII-769-EXACT-BLOB-001
BRANCH_BASIS: b10725b65ce737f8006c3d1671e0a52b50e3e8a9
NODE_VERSION: v22.16.0
EVIDENCE_CLASS: CONNECTOR_MATERIALIZED_EXACT_BLOB_EXECUTION
RECORDED_AT: 2026-09-16T14:37:00Z

# Exact-blob qualification evidence

## Method

The connected environment does not expose a repository checkout and connector-triggered GitHub Actions events produced no runs. For self-contained focused regressions, the exact committed files and their complete import closure were therefore fetched from the Issue #769 branch basis above, materialized in a local execution directory, and verified with `git hash-object` before execution. Every local file listed below matched the GitHub blob SHA exactly. The committed test files were then executed unchanged with Node v22.16.0.

This is real execution of byte-identical branch blobs. It is narrower than a repository-native checkout/full-suite run and does not satisfy BM-009 or the complete release/integration Q4 gate.

## BM-001 — line-list synthetic semantic mapping

STATUS: PASS
COMMAND: `node --test tests/xml-cii-linelist-synthetic-label-mapping.test.mjs`
RESULT: 5 tests / 5 pass / 0 fail

Exact blobs:
- `tests/xml-cii-linelist-synthetic-label-mapping.test.mjs` — `2a2ab2a355cca17053a61abb3788710db9c06366`
- `converters/xml-cii2019-core/linelist-mapping.js` — `2aef5564b9ca9ec0b147c92642345c8aa1f00950`
- `converters/xml-cii2019-core/line-density-resolver.js` — `cec73e0bffad63f72a9a60d5585085d473db1f49`
- `converters/xml-cii2019-core/nps-bore-resolver.js` — `996245846d15d331a6f1f31b4f6270fdf06e2be9`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-fuzzy-mapper.js` — `15a1d0139c6196243e1581f1b80121ae1a8fc1a7`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-fields-config.js` — `faf0c6ceec69d2a8b9d03a59dd35d56f350139b2`

Covered assertions include explicit synthetic `From`/`To`, Gas/Liquid/Mixed density separation, generic-density non-stealing, no mixed→generic core alias, incompatible persisted-map rejection, and normalized canonical From/To values.

## BM-006 — Branch→Line family authority

STATUS: PASS
COMMAND: `node --test tests/xml-cii-branch-line-family-suggestion.test.mjs`
RESULT: 6 tests / 6 pass / 0 fail

Exact blobs:
- `tests/xml-cii-branch-line-family-suggestion.test.mjs` — `3a88e726e92fbda3bc1f4d92b6fe5cc5a9762135`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-branch-line-map-panel.js` — `7ce5d7852b3d5de47c56a92600c2796fbae8c069`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-branch-line-map-actions.js` — `9c82d10c0fb4a0956b1f8a36d68381de0149c7c3`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-branch-line-pattern-detect.js` — `2887dc95a8e1b4ab05e739fe17c5f4ed5437b4fb`

Covered assertions include exact-first authority, unique progressive-family mapping, ambiguous-family fail-close, B→P prohibition, exact-token precedence over family neighbors, and LOW/MEDIUM/HIGH coverage thresholds.

## BM-007 — Regex confidence / authority / representative buckets

STATUS: PASS
COMMAND: `node --test tests/xml-cii-regex-confidence-buckets.test.mjs`
RESULT: 3 tests / 3 pass / 0 fail

Exact blobs:
- `tests/xml-cii-regex-confidence-buckets.test.mjs` — `97947b73c4ea938e7ba38e12c99003662487f15e`
- `tabs/xml-cii-2019-standalone/xml-cii-regex-sample-buckets.js` — `7595e2a3c6f43afbfbf11d13dec293a4ff0719fe`
- `tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js` — `ebae2ecfea98d513784272cfe6ec0205d128b521`
- `tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js` — `5f2fd8084bc22bd11a6582f3bf0f9cfd694844da`

Covered assertions include confidence distinct from exact-master coverage, partial-master evidence remaining review-only even above 0.90 composite confidence, full exact-master evidence enabling governed authority, and representative structural bucket counts with duplicate-source de-duplication.

## Remaining qualification state

- BM-002: NOT_RUN_ENVIRONMENT_BLOCKED
- BM-003: NOT_RUN_ENVIRONMENT_BLOCKED
- BM-004: NOT_RUN_ENVIRONMENT_BLOCKED
- BM-005: NOT_RUN_ENVIRONMENT_BLOCKED
- BM-008: NOT_RUN_ENVIRONMENT_BLOCKED
- BM-009: NOT_RUN_ENVIRONMENT_BLOCKED

The rigid-weight lifecycle regression was not weakened or stubbed when its complete empirical-model dependency closure could not be materialized in the initial attempt. Larger dependencies may be fetched in bounded line ranges in a later qualification progression. No production code was changed by this evidence step.
