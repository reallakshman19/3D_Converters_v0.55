# PR639 — FIT controlled EI T2.2 runtime provenance

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED_FOR_OWNER_DIRECTED_ASSIGNMENT
EXECUTION_MODE: AUTO
AUTO_STATE: COMPLETE_PHASE
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED
REPOSITORY: reallaksh19/3D_Converters
PR: 639
BRANCH: agent/vibration-fit-source-authority-20260818
BASE: main
BASE_HEAD: d9d14d13b089c968c989544ddbdf023063b43e67
IMPLEMENTATION_BASIS_HEAD: 6165852d74942d73790cd2f69bd16ade169cdcbf
HOSTED_EVIDENCE_HEAD: 503afd9456430e6722d1db38007567147dc53c0a
BASE_RELATION_AT_HOSTED_CHECK: ahead 22 / behind 0
CHANGED_FILES_AT_HOSTED_CHECK: 14 / 14 explained / 0 unexplained
CURRENT_STAGE: HANDOVER
CURRENT_BLOCKER: REPOSITORY_NATIVE_EXECUTION_UNAVAILABLE
HIGHEST_RISK: preserve numerical FIT freeze and keep method-source authority distinct from benchmark execution authority
EXACT_NEXT_ACTION: leave PR639 draft; reconcile source-registry ownership only after PR635 is resolved
```

## Result

Runtime FIT provenance now follows the existing governed source hierarchy: EI AVIFF T2.2 is the governing method source; published EI worked examples are benchmark evidence; the controlled worked-example DOCX is the owner qualification anchor; the retained CRF-4-1 workbook is migration/parity evidence only.

No FIT numerical formula, coefficient, applicability limit, multiphase rule, expected benchmark value or tolerance was intentionally changed. Screening/design qualification was not promoted by this PR.

## Validation truth

```text
existing governed FIT specification                PASS / SOURCE_INSPECTION
source-basis EI/workbook role agreement            PASS / SOURCE_INSPECTION
runtime method-source precedence                   PASS / SOURCE_INSPECTION
benchmark execution remains non-authorizing        PASS / SOURCE_INSPECTION
errata non-applicability retained                  PASS / SOURCE_INSPECTION
numerical source diff isolation                    PASS / COMPARE_INSPECTION
representative numeric expected values unchanged   PASS / TEST_ORACLE_INSPECTION
stack/file reconciliation                          PASS / 14 of 14 / behind 0
repository-native FIT tests                        NOT_RUN
repository-native Engineering API tests            NOT_RUN
checkout attempt                                   NOT_RUN / ENVIRONMENT_BLOCKED / DNS
browser FIT result/export journey                  NOT_RUN
combined statuses on hosted evidence head          0 returned -> NOT_RUN, not PASS
PR workflow runs on hosted evidence head           0 returned -> NOT_RUN, not PASS
review threads                                     0
```

Known existing debt: `tests/engineering-calculation-core.test.mjs` on main still describes the old benchmark-only FIT catalogue while the current production adapter is already screening-qualified. It was not expanded into this focused provenance PR.

Global vibration source-registry synchronization is intentionally excluded because PR635 owns that file. Draft only; no merge authority.
