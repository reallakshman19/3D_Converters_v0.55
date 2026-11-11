# WIP-VIB-FIT-SOURCE-20260818 — FIT controlled source authority alignment

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED_FOR_OWNER_DIRECTED_ASSIGNMENT
EXECUTION_MODE: AUTO
AUTO_STATE: RUNNING
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED
REPOSITORY: reallaksh19/3D_Converters
BRANCH: agent/vibration-fit-source-authority-20260818
BASE: main
BASE_HEAD: d9d14d13b089c968c989544ddbdf023063b43e67
CURRENT_STAGE: VALIDATE_RECONCILE
CURRENT_BLOCKER: REPOSITORY_NATIVE_EXECUTION_UNAVAILABLE
HIGHEST_RISK: changing FIT numerical behavior while correcting provenance, or confusing method-source authority with benchmark execution authority
EXACT_NEXT_ACTION: allocate draft PR after exact base/file reconciliation; preserve all FIT numerical and applicability behavior
```

## Mission

Correct FIT runtime/source provenance drift. The governed FIT specification already states that EI AVIFF 2nd Edition T2.2 is the governing method source and the retained CRF-4-1 workbook is migration/parity evidence only. This slice aligns runtime/result metadata to that existing qualification; it does not create new screening authority.

## Controlled source chain now carried by runtime

```text
1. Governing method source
   reallaksh19/Common @ fb549185b9b27edc2379734240320a85c5bef9f6
   EI - AVIFF Guidelines 2nd Edition.pdf
   blob 9d3eccc56429411e17c07a579bdebbd13cb0bdc5
   locator T2.2 Flow Induced Turbulence

2. Governed implementation specification
   docs/vibration/FIT-Engineering-Method-Specification-v1.md

3. Published benchmark source
   EI - AVIFF Guidelines 2nd Edition_Examples.pdf
   blob 3e2517d0df527a051084fc02e69cb7afa31f8d47
   Appendix D / D2 + D4

4. Owner qualification anchor
   Energy-Institute-AVIFF---Worked-Examples.doc.docx
   blob ceee15ed5f7f320045d5f3979024e2e8664613f2

5. Retained workbook
   CRF-4-1 / FIT.xlsm
   role MIGRATION_PARITY_EVIDENCE_ONLY
```

Official EI errata custody remains explicit as `REVIEWED_NOT_APPLICABLE_TO_FIT_T2_2`; no FIT correction is invented from the AIV/valve-transient errata pages.

## Runtime semantics

- `FIT_REFERENCE_AUTHORITY = CONTROLLED_EI_T2_2_SCREENING_REFERENCE` for the domain method/result.
- `FIT_WORKBOOK_REFERENCE_AUTHORITY = WORKBOOK_REFERENCE_ONLY` for retained workbook evidence.
- `calculateFit().provenance.source` is now the governed EI source.
- `calculateFit().provenance.workbookReference` is the retained migration/parity source.
- Engineering Calculation screening mode carries `engineeringAuthority=SCREENING`.
- Engineering Calculation benchmark mode uses the same EI method source but carries `engineeringAuthority=WORKBOOK_REFERENCE_ONLY`, `screeningAuthority=NOT_AUTHORIZED`.
- `designAuthority=false` remains unchanged.

## Numerical non-change evidence

Exact compare against main currently shows production changes limited to metadata/provenance:

```text
method.js                            +15 / -1
calculate.js                         +4 / -1
index.js                             +3 / -0
vibration-fit adapter                +11 / -3
source-basis-evidence.js             +46 / -0
```

No correlation coefficient, span equation, FVF rule, LOF arithmetic, natural-frequency bound, diameter bound, multiphase resolver or benchmark expected value was intentionally changed. Dedicated regressions retain the existing representative gas and D4 numerical values.

## Test changes

- Added `vibration-fit-source-authority.test.mjs` for source precedence, errata custody, equation IDs and representative numerical invariance.
- Added `vibration-fit-engineering-source-authority.test.mjs` proving screening/benchmark share the same method source and same numeric D4 output while retaining different execution authority.
- Updated `vibration-fit-workbook-reference.test.mjs` only to remove the stale expectation that raw `calculateFit()` is benchmark-only; its existing numerical expected values are unchanged.

## Known pre-existing test drift

`tests/engineering-calculation-core.test.mjs` on current main still describes the FIT definition as the old benchmark-only workbook reference even though the current production adapter is already `ei-aviff2-fit-screening-v1 / SCREENING`. That file is not expanded into this focused provenance PR; its stale central-catalog assertions remain separate existing test debt.

## Validation truth

```text
existing governed FIT specification             PASS / SOURCE_INSPECTION
source-basis EI/workbook role agreement         PASS / SOURCE_INSPECTION
runtime method-source precedence                PASS / SOURCE_INSPECTION
benchmark execution remains non-authorizing     PASS / SOURCE_INSPECTION
errata non-applicability retained               PASS / SOURCE_INSPECTION
numerical source diff isolation                 PASS / COMPARE_INSPECTION
representative numeric expected values unchanged PASS / TEST_ORACLE_INSPECTION
branch relation                                  PASS / ahead 15 / behind 0
repository-native FIT tests                      NOT_RUN
repository-native Engineering API tests          NOT_RUN
checkout attempt                                 NOT_RUN / ENVIRONMENT_BLOCKED / DNS
browser FIT result/export journey                NOT_RUN
```

## Exclusions

- no FIT equations/correlations or coefficients;
- no diameter/span/frequency applicability changes;
- no multiphase resolver changes;
- no benchmark expected values/tolerances;
- no screening/design authority promotion;
- no global vibration source-registry edit (PR635 owns that file);
- no workflow changes;
- no merge.

## Backup truth

Native `node utils/backup.js save ...` is `NOT_RUN / ENVIRONMENT_BLOCKED`. Pre-edit main blobs:

```text
converters/vibration/fit/method.js                              2965155fe1d4d9081b91d1ff1113d7fb50ddbfd8
converters/vibration/fit/source-basis-evidence.js               d3ca231b8b5228c55fdac5bc99ea208300a75727
converters/vibration/fit/calculate.js                           2a92e6efedefffe4ab66ab000f0c3e648c9e5e86
converters/vibration/fit/index.js                               f261bef8e0be3efaf74d3ff89c2342892be33632
converters/engineering-calculations/adapters/vibration-fit.js   eef88d59846a5c779d5f56b71b9502955ddf1b41
tests/vibration-fit-workbook-reference.test.mjs                 6e253a4e57ea601f6faf17c6013030d56c803f24
```
