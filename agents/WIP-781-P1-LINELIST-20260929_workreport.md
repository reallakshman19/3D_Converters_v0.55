# WIP-781-P1-LINELIST-20260929 — Issue #781 semantic line-list worksheet selection

## Recovery state

```text
ISSUE = #781
PLAN = IMPLEMENTATION_PLAN rev 1 / issuecomment-5893573324
BASE_MAIN = 7057e3d031663fbe92c22f4a3b8c98cc32d06e7b
BRANCH = agent/issue-781-p1-linelist-sheet-20260929
PR = #783
CRITICALITY = ENGINEERING_CRITICAL
EXECUTION_SCOPE = STEP-781-02 only
HANDOVER_READINESS = READY
PR_RECOVERY_STATE = HEALTHY
MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED
```

## Protocol basis — refreshed at PR-ready boundary

```text
V3.1
Common@1ced68258afeaf50df113b1d38a4ceb9193587e3
TPG-2P-2026-09-28-R3
```

The live Common basis remains unchanged from the durable implementation-plan basis.

## Root cause

The post-#780 XLSX architecture correctly moved workbook parsing and dataset ownership into the master worker, but the UI still handled the worker `SHEETS` response as:

```text
sheetNames[0] -> active sheet -> worker selectSheet()
```

Therefore a cover/readme/revision worksheet in position 0 could become the committed line-list dataset even when the actual line-list worksheet was present elsewhere in the workbook.

Manual sheet selection was already worker-backed and correct on current head. It was deliberately preserved rather than rewritten.

## Implemented selection policy

For `masterKey === lineList` only:

1. exact normalized worksheet name `linelist`;
2. aliases `line list` / `line-list`;
3. semantic scoring of a bounded worker-side sample;
4. deterministic first-sheet fallback.

Name matches are resolved without sampling. Semantic selection samples at most 25 rows per candidate worksheet. It reuses the existing `prepareNormalizedDataset()` path, which in turn uses the existing fuzzy mapper plus `detectLineListFieldMap()`; no parallel line-list field inference engine was introduced.

Semantic eligibility requires populated line identity plus populated engineering companion evidence. Weighted evidence includes piping class, bore, pressure, temperature, material, rating, equipment, density/phase, and hydro-test pressure. A saved mapping alone cannot make an unrelated worksheet win because scoring is based on populated normalized sample values, not mapping labels alone.

Only compact selection metadata crosses the worker boundary:

```text
sheetNames
suggestedSheet
suggestionBasis
suggestionScore
suggestionEvidence
sampledRows
```

No sampled/full workbook rows are returned to the UI. Full selected-sheet rows are parsed only after `selectSheet()` and remain worker/dataset-owned per PR #780.

## Preserved invariants

- Other master types retain first-sheet behavior.
- Manual worksheet selection remains worker-backed and creates a distinct dataset revision.
- Existing line-list field mapping logic is reused, not rewritten.
- Main-thread state keeps sheet metadata/dataset refs, not workbook row arrays.
- IndexedDB/dataset persistence and bounded Preview/search architecture remain unchanged.
- Weak/ambiguous semantic evidence fails back to workbook order rather than guessing.

## Material changed surfaces

Production/runtime:
- `tabs/xml-cii-2019-standalone/workers/master-dataset-sheet-selector.js` — new pure selector/scorer;
- `tabs/xml-cii-2019-standalone/workers/master-dataset-parser.js` — bounded selected-sheet sample parser;
- `tabs/xml-cii-2019-standalone/workers/master-dataset-service.js` — computes line-list suggestion inside worker service and returns compact metadata;
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js` — selects valid `suggestedSheet` with first-sheet fallback.

Mirrors:
- corresponding `docs/` runtime mirrors.

Qualification:
- `tests/xml-cii-issue-781-linelist-sheet-selection.test.mjs`;
- `.github/workflows/issue-781-linelist-sheet-validation.yml`.

Recovery/coordination:
- `.backups/issue-781/p1-linelist/*`;
- `agents/claims/WIP-781-P1-LINELIST-20260929.yaml`;
- `agents/status/WIP-781-P1-LINELIST-20260929.yaml`;
- this report.

## Focused acceptance encoded

- exact `linelist` outranks workbook order and requires no sampling;
- `Line-List` alias outranks workbook order and requires no sampling;
- a semantically valid `Process Data` worksheet beats unrelated `Cover`/`Notes` sheets using the real normalization/mapping machinery;
- unrelated candidate sheets fail back to the first worksheet;
- non-line-list masters preserve first-sheet behavior without semantic sampling;
- worker `SHEETS` response carries suggestion metadata but no sampled/full rows;
- sample ranges are bounded to 25 rows;
- only selected sheet is fully parsed after `SELECT_SHEET`;
- manual selection of another sheet produces a different dataset id/revision;
- UI validates `suggestedSheet` against `sheetNames` and otherwise falls back to first sheet.

## Validation evidence

Validated material head: `27e171e92513e52918ca3ed793eaf356ca8dd6ad`.

| Evidence | Result |
|---|---|
| Issue 781 Line-list Sheet Validation, run `36608097910` | PASS |
| Focused semantic worksheet-selection regression | PASS |
| PR780 master dataset regression suite | PASS |
| Issue 776 XML-CII Authority Validation, run `36608097822` | PASS |
| Issue 776 focused authority regressions | PASS |
| Adjacent authority baseline classification | PASS |
| Exact-head WSW browser conversion | PASS |
| 10k / 50k / 100k master dataset browser scale | PASS |

The report/status-only commits after the material head do not alter production or test behavior; GitHub re-runs the same PR workflows on the final review head.

## Backup truth

The repository-native `node utils/backup.js save ...` command cannot be executed truthfully from the connector-only environment.

```text
native backup utility = NOT_RUN / ENVIRONMENT_BLOCKED
connector exact pre-edit Git blob backups = COMPLETE
```

Exact pre-edit blobs are stored under `.backups/issue-781/p1-linelist/` before the corresponding mutations.

## Falsifiers / reopen conditions

Reopen STEP-781-02 if current-head evidence shows any of these:
- a workbook with an exact/alias line-list sheet still auto-selects another sheet;
- semantic selection requires workbook rows on the UI thread;
- a non-line-list master changes away from first-sheet behavior;
- weak semantic evidence is accepted without line identity + engineering companion evidence;
- manual worksheet change does not commit the selected sheet dataset;
- PR780 dataset/browser-scale regressions are newly introduced.

## Remaining #781 work — not owned by PR #783

1. post-#780 Regex/Token Builder master-evidence plumbing and semantic result taxonomy;
2. Weight Match presentation clarification only;
3. material candidate/106 suggestion presentation using existing evidence;
4. Mode B semantic multi-XML topology compositor as a separate substantial workstream.

## Handoff contract

PR #783 is the review surface for `STEP-781-02` only. It must not absorb Token Builder, Weight Match, material, or Mode B changes. Merge authority remains with the Owner.

## EXACT_NEXT_ACTION

Publish `TASK_RESULT` for STEP-781-02, refresh PR #783 with the qualification evidence, mark it ready for Owner review after final-head CI, then implement the Token Builder evidence-transport slice on a separate bounded branch/PR.
