# WIP XML229 candidate Preview and failed-native transparency — 2026-11-02

## Handover in 60 seconds
- Mission: display both distinct source-extracted Format 1/2 Line Keys in main 4 Preview without accepting either as authority; correct run audit to prioritize actual native failure over a format warning; add bounded ambiguous staged position evidence without releasing unverified CII.
- User supplied NativeExecutionDebug.v1: FAILED/STAGED_POSITION_TRANSFER/XML229_STAGED_POSITION_AMBIGUOUS at 27015ms; RunHoldAudit.v1: 249 Final owners / 1743 facts, 0 unresolved; misleading BRANCH_FORMAT_IDENTITY_UNRESOLVED diagnosis.
- Base: main at 2477a6fdee1002d5063bc51e94777ba940e6fa82; new isolated branch fix/xml229-candidate-preview-native-hold-20261102. PR #378 untouched.
- Coordination: PR377 touches separate run-hold explanation and engineering producer; PR378 touches workflow service and Worker; PR260 Worker overlap; PR253 Preview v7. Current exact-file planned edits: editable-preview-table, preview-renderer, run-hold-audit, output-run meaning, Python native staged diagnostic. Classification COORDINATION_REQUIRED for semantic Native audit, no direct PR377 exact-file overwrite.
- Release authority: do not select conflicting formats, change native mass, relax positional ownership, or authorize .cii download on native failure.
- Validation ledger: SOURCE_INSPECTION only, no tests executed yet. Changes in progress.
- Risk: selected JSON original evidence absent, so genuine staged-position ownership root cause not reproducible from uploaded metadata alone. Diagnostic must remain fail closed.
- EXACT_NEXT_ACTION: patch display-only candidates and audit precedence with regression tests; inspect bounded Python position evidence; execute focused tests when feasible and open draft PR; never merge.
