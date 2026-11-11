# PR702 — CII fixed-FORTRAN syntax authority convergence

## Recovery header

```text
PR = 702
WORK_INTENT = IMPLEMENT
REPOSITORY_STATE = DRAFT_HANDOVER_READY_RUNTIME_NOT_RUN
MUTATION_AUTHORITY = WRITE_ALLOWED_BOUNDED
CRITICALITY = ENGINEERING_CRITICAL
EXECUTION_MODE = AUTO
AUTO_STATE = STOPPED_ENVIRONMENT_BOUNDARY
MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED
BASE_MAIN = ca8d391ac5f829f53bebb3c37adf0547c34a67b4
BRANCH = agent/cii-fortran-format-authority-fix-20260826
COORDINATION = SAFE
```

## Handover in 60 Seconds

PR #702 reconciles CAESAR II CII fixed-FORTRAN syntax authorities discovered during V11/V14 Writer2 cross-checking. The engineering patch is intentionally bounded to duplicated/stale validation authority; it does **not** change the V11↔V14 converter, Writer behavior, topology, units, browser runtime, numerical engineering values, generic numeric semantics, or workflows.

Implemented corrections:

1. `converters/scripts/cii14_section_rules.py`
   - Ver14 `ALLOWBLS`: **26 → 28 physical rows/block**.
   - Authority basis: Ver14 = **168 logical items / 28 rows**; V11 = 153 / 26.

2. `converters/scripts/cii_syntax_check_2019.py`
   - V11/CII2019 `FORCMNT`: **13 → 20 rows/block**.
   - V11/CII2019 `FLANGES`: **11 → 12 rows/block**.
   - auxiliary block validation and derived-count reporting now count **physical payload rows**, including blank fixed rows, rather than silently dropping blanks.

3. `converters/scripts/test_cii_format_authority_convergence.py`
   - seven focused regression/falsifier tests lock V11 map convergence, Ver14 ALLOWBLS/SIF/REDUCER deltas, stale 26-row Ver14 ALLOWBLS rejection, #1042 CONTROL I13 custody, Writer-relevant block cardinalities, and blank physical-row preservation.

## Why the blank-row change is required

`cii2019_section_rules.py` explicitly distinguishes fixed-record physical rows from nonblank rows. Real FLANGES data can contain a genuinely blank physical row; dropping it before cardinality division converts a correct 12-row record into an apparent 11-row record. The legacy checker was therefore internally inconsistent even after changing the FLANGES constant to 12.

PR702 now aligns both validation and derived block-count reporting with physical fixed-record custody.

## Protected engineering invariants

```text
CONTROL rows 1-3             = 2X,6I13
CONTROL row 4                = 2X,I13
CONTROL row1 field4          = NONAM
CONTROL row2 field4          = RESTRAINT count
ELEMENT                      = 15 rows/block V11 and V14
RESTRANT                     = 24 rows/block V11 and V14
SIF&TEES                     = 10 rows/block V11; 14 V14
REDUCERS                     = 1 row/block V11; 2 V14
MISCEL_1 mixed I13/G13.6     = untouched
SIF item15/item16 semantics  = unchanged; owned by cii_v11_v14_sif.py
```

No generic REAL rendering or D-exponent behavior was changed.

## Authority evidence

The patch is grounded in the live repository sources at main `ca8d391ac5f829f53bebb3c37adf0547c34a67b4`:

- `cii_v11_v14.py`: V11 ALLOWBLS 153/26; V14 168/28.
- `cii_v11_v14_validate.py`: Ver14 `ALLOWBLS=28`, `SIF&TEES=14`, `REDUCERS=2` independent target envelope.
- `docs/cii/cii-v14-v11-import-rca.md`: records the repaired 28↔26 ALLOWBLS and semantic SIF mapping.
- `test_cii_v11_v14.py`: retained native-pair and ALLOWBLS 28↔26 regressions.
- `cii2019_section_rules.py`: V11 `FORCMNT=20`, `FLANGES=12`, and explicit physical-row preservation.
- `cii2019_flanges_sync.py`: neutral-file FLANGES definition = 72 values on 12 physical lines.

## Engineering commits

```text
f4597e8417364007a3d68f2ee21d10dd3c5d9131
  Ver14 ALLOWBLS 26 -> 28

607a4ebd27b890b83fd60e3cc9b4362952db2e2c
  V11 FORCMNT 13 -> 20; FLANGES 11 -> 12

51004e5a24877bc07aad5ba0815e2b2c0a4ac389
  initial convergence/falsifier suite

a2e5f5188141ce8adfdcb402869d4e699749aef2
  physical auxiliary row custody in validation/reporting

d4af9710f1bb6f4f5550e04a02d6f7ca599ae239
  blank-row FLANGES validation/report regressions
```

Hosted patch inspection confirms:

```text
cii14_section_rules.py
  one authority value + explanatory comment

cii_syntax_check_2019.py
  FORCMNT 13 -> 20
  FLANGES 11 -> 12
  two nonblank-filter -> physical-row-count changes

test_cii_format_authority_convergence.py
  new 135-line / seven-test suite
```

## Backup custody

Repository-native `node utils/backup.js save ...` is `NOT_RUN / ENVIRONMENT_BLOCKED` because this runtime cannot obtain a native checkout (`github.com` DNS resolution failure).

Before production mutation, exact Git preimages were retained:

```text
cii14_section_rules.py
  original blob = fa0aed33322dd6995427bce440edbd465efcc897
  backup blob   = fa0aed33322dd6995427bce440edbd465efcc897

cii_syntax_check_2019.py
  original blob = 37f7092a0e11c775c62139254fc1001dcc9b0776
  backup blob   = 37f7092a0e11c775c62139254fc1001dcc9b0776
```

The first connector-side syntax-checker backup was accidentally reconstructed with unrelated lexical REAL edits. It was detected **before any production mutation** and corrected by commit `847064fe4939fc761cdedf26c44ded5b4347c845`, which points the backup path to the exact original Git blob. Final backup custody is exact.

## Issues / disposition

```text
ISS-CII-FMT-001  V14 ALLOWBLS 26-vs-28 authority conflict      FIXED_IN_BRANCH
ISS-CII-FMT-002  V11 FORCMNT=13 / FLANGES=11 stale constants FIXED_IN_BRANCH
ISS-CII-FMT-003  blank physical aux rows collapsed by checker FIXED_IN_BRANCH
```

## Final hosted reconciliation

Observed before handoff freeze:

```text
main                                      ca8d391ac5f829f53bebb3c37adf0547c34a67b4
PR                                        #702
state                                     OPEN
DRAFT                                     true
merged                                    false
mergeable                                 true
changed files                             8
reviews                                   0
review threads                            0
PR-triggered workflow runs                0
merge authority                           NOT GRANTED
```

Exact hosted changed-file set:

```text
.backups/connector-20260826-cii-format-authority/converters_scripts_cii14_section_rules.py.bak
.backups/connector-20260826-cii-format-authority/converters_scripts_cii_syntax_check_2019.py.bak
agents/PR702_workreport.md
agents/claims/PR702.yaml
agents/status/PR702.yaml
converters/scripts/cii14_section_rules.py
converters/scripts/cii_syntax_check_2019.py
converters/scripts/test_cii_format_authority_convergence.py
```

## Validation ledger

| Check | Status | Observation | Oracle | Notes |
|---|---|---|---|---|
| live main / PR grounding | PASS | REMOTE_EXECUTION | GitHub | base unchanged, PR open/draft/mergeable |
| exact pre-edit backup identity | PASS | REMOTE_EXECUTION | Git blob SHA | exact byte custody |
| final hosted changed-file scope | PASS | REMOTE_EXECUTION | GitHub PR | exactly eight files |
| three authority-value patch | PASS | REMOTE_EXECUTION | hosted patch | bounded values only |
| physical-row behavior patch | PASS | REMOTE_EXECUTION | hosted patch | exactly two count sites |
| seven-test source syntax | PASS | LOCAL_EXECUTION_RECONSTRUCTED | Python `compile()` | exact authored test text; not repo execution |
| authority cross-check | PASS | SOURCE_INSPECTION | repository qualified sources | values/record semantics converge |
| reviews / threads | PASS | REMOTE_EXECUTION | GitHub | none outstanding |
| PR-triggered workflow runs | NOT_RUN | REMOTE_OBSERVATION | GitHub | zero runs exist; not a PASS substitute |
| exact native checkout | NOT_RUN | LOCAL_EXECUTION | NONE | DNS environment block |
| repository-native focused test | NOT_RUN | NOT_OBSERVED | NONE | exact checkout unavailable |
| full CII Python regression suite | NOT_RUN | NOT_OBSERVED | NONE | exact checkout unavailable |
| actual CAESAR import | NOT_RUN | NOT_OBSERVED | NONE | no external acceptance claim |

No `NOT_RUN` is promoted to PASS.

## Current verdict

```text
ENGINEERING PATCH          IMPLEMENTED
SOURCE AUTHORITY           RECONCILED
HOSTED PATCH SCOPE         CLEAN
REGRESSION FALSIFIERS      AUTHORED
EXACT PYTHON EXECUTION     NOT_RUN_ENVIRONMENT
PR STATE                   DRAFT / HANDOVER_READY
MERGE                      NOT AUTHORIZED
```

## EXACT_NEXT_ACTION

On an exact checkout:

```text
cd converters/scripts
python test_cii_format_authority_convergence.py
```

Then run adjacent V11/V14 converter, mixed-record, section-rule, flange, and merge regression suites. Record genuine PASS/FAIL in this report/status. If all required gates pass, the PR can be considered for ready-for-review; merging still requires explicit Owner authorization.

## Appendix A — takeover qualification

Incoming agent must answer from live repository/PR702 state before further engineering mutation:

1. State current main, PR702 head, draft/merge state, merge authority, and exact changed-file list.
2. Prove Ver14 ALLOWBLS = 168 items / 28 rows and identify the stale 26-row authority repaired here.
3. Prove V11 FORCMNT=20 and FLANGES=12, and explain why blank fixed rows must remain in physical block cardinality.
4. Trace CONTROL row1/field4 NONAM and row2/field4 RESTRAINT in 1-based neutral-file and zero-based implementation notation.
5. Explain the V11/V14 SIF&TEES 10/14 row difference and item15/item16 semantic swap.
6. Confirm no converter, Writer, topology, units, generic numeric, D-exponent, or workflow authority was widened.
7. Distinguish remote/source/reconstructed-syntax PASS from exact repository runtime NOT_RUN.
8. Verify both backup blob identities and explain the corrected initial backup-custody incident.
9. Show the blank-row falsifier: 12 physical FLANGES rows with one blank pass; 11 physical rows fail.

No merge action is permitted without explicit Owner authorization.
