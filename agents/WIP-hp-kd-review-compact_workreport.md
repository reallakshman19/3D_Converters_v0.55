# WIP hp-kd-review-compact — Work Report

## Recovery header

- WORK_INTENT: IMPLEMENT
- CRITICALITY: ENGINEERING_CRITICAL
- BRANCH: `agent/hp-kd-review-compact`
- BASE: `main@95ee50ff78d81465f3e4968f62767d866f8b9da8`
- PREDECESSOR: PR651 merged at the base SHA.
- BACKUP: `backup/hp-kd-review-compact-pre-edit-20260819`
- PR: #656 draft
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_SUCCESSOR
- COORDINATION: PR649 also touches `tabs/engineering-workspace-tab.js`; its intended Calculations-loader cache hunk is independent from this PR's HP Piping Class loader hunk.

## Mission

Make the existing `USER_CALCULATED_KD3` product workflow faster and less evidence-dominated without changing engineering equations, project schema, qualification authority, or evidence custody requirements.

Primary KD Review becomes the engineering table:

`Cycle | state pair | location | CORE Salt | user Salt | external Seq | external N | applied n | Ui=n/N | status`

Repeated calculation-basis custody moves into one collapsed audit section per product. Productivity actions:

- add every uncovered governed cycle in one action;
- copy only first-row `calculationBasis` to remaining cycle rows when one external calculation legitimately covers all cycles.

The copy action never copies cycle identity, state pair, location, Salt, Seq, N or derived usage.

## Protected invariants

- production route remains `USER_CALCULATED_KD3`;
- native KD320 arithmetic remains absent;
- `nativeCoreKd3Qualified=false`;
- Code compliance/design authority remain false;
- existing pressure-cycle Salt, external Seq/N and Miner damage kernels are unchanged;
- `hp-piping-class-project/v2` schema is unchanged;
- Q1/Q2 evidence intake and controlled-source ledgers are unchanged;
- no new evidence screen or workflow file.

## Validation ledger

| Check | Status | Observation | Oracle/limit |
|---|---|---|---|
| Live base | PASS | GitHub | `95ee50ff...` |
| Productivity helper | PASS 3/3 | LOCAL_EXECUTION | implementation-coupled |
| Helper negative assurance | PASS | LOCAL_EXECUTION | basis copy leaves cycle/location/Seq/N unchanged |
| Compact UI contract | PASS | SOURCE_INSPECTION | no browser execution |
| Diff normalization | PASS | GITHUB_COMPARE | workbench now +36/-34 |
| Non-KD workbench preservation | PASS | GITHUB_PATCH_INSPECTION | Design/Static/Cycles/Envelope restored to base |
| Full repository tests | NOT_RUN | ENVIRONMENT_BLOCKED | github.com DNS unavailable locally |
| Workbench module execution | NOT_RUN | ENVIRONMENT_BLOCKED | no full checkout/module graph |
| Browser | NOT_RUN | NOT_OBSERVED | no browser PASS claimed |
| Hosted CI | NOT_RUN_PENDING_REFRESH | NOT_OBSERVED | refresh final head |

## Diff review

RISK-001 RESOLVED — the first workbench implementation compressed formatting in unchanged surrounding functions. It was rebuilt from the exact base blob with only the helper import, KD-specific CSS, KD panel, and two productivity actions reapplied. GitHub compare now reports `tabs/hp-piping-class-workbench-tab.js` as `+36/-34`.

No numerical kernel, schema, Q1/Q2 evidence, master-data, or workflow file is changed.

## EXACT_NEXT_ACTION

Add PR656-numbered recovery artifacts, reconcile the final changed-file set and refresh mergeability/check/review truth. Leave draft/unmerged pending owner authorization for PR656.
