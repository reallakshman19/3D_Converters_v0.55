# PR659 — Bulk USER_CALCULATED_KD3 Cycle Input Work Report

## Recovery header

- PR: #659
- TITLE: `feat(hp): add bulk USER_CALCULATED_KD3 cycle input`
- BRANCH: `agent/hp-kd-bulk-input`
- BASE: `main@767ccd16ff6f1f8cb286551c57b0043f88885c9b`
- PREDECESSOR: PR656 merged by squash at the base SHA.
- CRITICALITY: ENGINEERING_CRITICAL
- PR_STATE: OPEN_DRAFT_HANDOVER_READY
- BACKUP: `backup/hp-kd-bulk-input-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR659

## Handover in 60 seconds

PR659 adds one collapsed bulk editor inside the existing KD Review for `USER_CALCULATED_KD3`.

Accepted table:

```text
cycle_id,location_id,user_salt_mpa,seq_mpa,permissible_cycles
```

CSV or TSV. The complete governed cycle set is required.

The bulk editor validates before writing working values. It rejects malformed, duplicate, unknown or missing cycles; blank locations; invalid stress; and invalid N. Audit/calculation-basis fields are not part of the bulk contract and are never overwritten.

The existing HP workbench is not edited. `hp-piping-class-kd-bulk-workbench-tab.js` wraps it, injects the collapsed editor, maps valid bulk values to the existing row bindings, and invokes the existing Calculate action. This preserves the current controller and governed master-runtime custody. Explicit project context is preserved until a real base-workbench mutation occurs.

## Authority boundary

```text
calculationMode            USER_CALCULATED_KD3
nativeCoreKd3Qualified     false
codeCompliance             false
canUseForDesignAuthority   false
```

No numerical kernel, project schema, Q1/Q2 evidence contract, fatigue curve/master table or workflow file is changed.

## Validation

| Check | Result |
|---|---|
| Bulk parser/apply | PASS 6/6 — LOCAL_EXECUTION / IMPLEMENTATION_COUPLED |
| Bulk UI/source contract | PASS 4/4 — LOCAL_EXECUTION |
| Focused total | PASS 10/10 — LOCAL_EXECUTION |
| Explicit-context edge | PASS — source contract + local syntax |
| New JS size policy | PASS — parser 167 lines; wrapper 240 lines |
| Original HP workbench preservation | PASS — not present in PR659 changed files |
| HP workspace integration | PASS — one HP-loader hunk only |
| Live main drift | PASS — main remains `767ccd16ff6f1f8cb286551c57b0043f88885c9b` |
| Branch relation | PASS — 15 ahead / 0 behind at reconciliation |
| Changed-file ledger | PASS — exact 11 expected paths |
| GitHub mergeability | PASS — `mergeable=true` while draft |
| Commit statuses | NOT_RUN — zero returned |
| PR workflow runs | NOT_RUN — zero returned |
| Reviews / review threads | 0 / 0 |
| Full repository-native tests | NOT_RUN / ENVIRONMENT_BLOCKED |
| Served browser acceptance | NOT_RUN |

No unexecuted check is represented as PASS.

## Coordination

PR649 remains open/draft but is now stale against newer `main` (`mergeable=false` at this reconciliation). Its shared-file intent is still only the Calculations loader cache identity; PR659 changes only the HP Piping Class loader. PR649 must re-ground later and preserve PR659's HP loader if PR659 lands first.

## Changed-file ledger — exact 11

1. `agents/PR659_workreport.md`
2. `agents/WIP-hp-kd-bulk-input_workreport.md`
3. `agents/claims/PR659.yaml`
4. `agents/claims/WIP-hp-kd-bulk-input.yaml`
5. `agents/status/PR659.yaml`
6. `agents/status/WIP-hp-kd-bulk-input.yaml`
7. `tabs/engineering-workspace-tab.js`
8. `tabs/hp-piping-class-kd-bulk-input.js`
9. `tabs/hp-piping-class-kd-bulk-workbench-tab.js`
10. `tests/hp-piping-class-kd-bulk-input.test.mjs`
11. `tests/hp-piping-class-kd-bulk-ui.test.mjs`

## EXACT_NEXT_ACTION

Leave PR659 draft/unmerged. If the owner explicitly authorizes merge of PR659, re-ground live main and PR649 once more, verify the same 11-file boundary and exact head, then squash merge. Otherwise the next product increment should focus on engineering result usability rather than additional evidence UI.
