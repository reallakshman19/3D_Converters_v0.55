# QE-XMLCII-769-EXACT-BLOB-004 — BM-008 B31.3 exact execution

WORK_ITEM_KEY: github:reallaksh19/3D_Converters#769
CHAIN_ID: XMLCII-ISSUE-769
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-RELEASE
QUESTION_SET_ID: QS-XMLCII-769-RELEASE-001
BENCHMARK: BM-008
RESULT: PASS
EXECUTED_AT_UTC: 2026-09-17T02:23:31Z
NODE_VERSION: v22.16.0
MAIN_BASIS: 75f830a4201d42a31534b6e76b41f7828eb0aee2
MERGED_PRODUCTION_COMMIT: 0ba752fbebcb55440815015bc87b687323d8caae
EXECUTION_MODE: connector-materialized exact Git blobs; committed regression executed unchanged

## Executed regression

`tests/xml-cii-b313-preview-blocker-provenance.test.mjs`

Observed output:

`xml-cii B31.3 preview blocker provenance tests: PASS`

The test was executed unchanged under Node v22.16.0 after every production/test dependency was reconstructed and verified with `git hash-object` against the GitHub blob SHA. No mocks, stubs, factor substitutions, or generated-master reductions were used.

## Exact blob manifest

- `tests/xml-cii-b313-preview-blocker-provenance.test.mjs` — `5b53172e7bb16aeb1ff9db14a73a1e99421249ef`
- `converters/xml-cii2019-core/b313-preview-wall-update.js` — `5a34dd52e3941b200a58fdfe54c2b72d721c7789`
- `converters/b313-material-factors/index.js` — `def37b3fcca4d56b0df01b654781ac9c9c38a91c`
- `converters/b313-material-factors/default-b313-material-factor-data.js` — `f016ba5a1b43099d1945c95fb3d2372178aaae98`
- `converters/pipe-wall-master/index.js` — `5809c1b6c5b511108969cabb745fc14ce6f21259`
- `converters/pipe-wall-master/pipe-wall-master.js` — `6aa991042d40ba9a36c0797c8707eea5c0de5b85`
- `converters/pipe-wall-master/default-pipe-wall-master-rows.js` — `7230cff1f3452e1a51adb7a23b5ced43392a5ecf`
- `converters/b313-thickness/index.js` — `2e67cb7458a3a1cb1d0e3732b7fdb957481504a6`
- `converters/b313-thickness/b313-straight-pipe.js` — `7d291bb6cdafdc05a18e76cbb055f200b3688588`
- `converters/b313-thickness/b313-units.js` — `9e5e928d0efc5d11581310bab60c6b6d3e46f185`
- `converters/b313-thickness/b313-tolerance.js` — `99da357e4f6c9c84c53702b5f2f2878e09df4343`
- `converters/b313-thickness/b313-applicability.js` — `217a67c48f4bce8866c9e5b7e85f2247f02603e8`
- `converters/b313-thickness/b313-wall-selection.js` — `575f9bbc38cdd588760bcc692081071d044e9bc0`
- `converters/b313-thickness/b313-ratios.js` — `1af8e6d026dc3edb52b3f179a1505149a97cc253`

Independent benchmark file also hash-verified:

- `Benchmarks/B313MaterialFactors/a106-grb-full-pipeline-benchmark.json` — `e17860182c5df86245ec78a2a0ad816ae5f8445f`

## Qualified controls

The unchanged committed regression proves all of the following on the merged implementation:

1. `ASTM A106-B` resolves to governed identity `CS-A106-B` while retaining line-list source provenance.
2. At 0 °C / SEAMLESS, candidate S/E/W/Y rows with `BENCHMARK_ONLY` qualification are explicitly rejected by strict automatic authority; accepted strict statuses remain only `PROJECT_APPROVED` and `VERIFIED`.
3. Strict A106 factor resolution fails closed with `B313_FACTOR_DATA_INCOMPLETE` rather than promoting benchmark-only records.
4. Generic `SS` remains ambiguous and cannot be silently promoted to one material identity.
5. TP304 E reports `MANUFACTURING_ROUTE_REQUIRED` when route evidence is absent.
6. Manual S/E/W/Y fallback is rejected without a controlled source reference; a complete controlled manual fallback is explicit and marked `designAuthority: false`.
7. A106 benchmark arithmetic executes ASME B31.3-2024 §304.1.2 Eq. (3a) with 12.5% negative mill tolerance and returns required nominal thickness `12.553618958106954 mm`.
8. The project Pipe Wall Master selects `12.7 mm`, preferred Schedule `60`, with equivalent schedules `60 / XS`.

A separate exact-module numerical execution using the same repository benchmark also returned `12.553618958106954 mm` before the full committed regression was run.

## Qualification boundary

BM-008 is PASS. This does not qualify BM-009 or any unrelated remaining debt. BM-002 still lacks full XML→CII writer E2E, BM-004 remains unexecuted, BM-005 still lacks 50k/100k capacity qualification, and BM-009 remains unexecuted.
