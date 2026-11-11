# KD320 edition reconciliation gate

This gate reconciles the published `PVP2025-154710` numerical cross-check, which explicitly uses ASME BPVC VIII-3 **2023**, against the controlled project target **VIII-3 2025** before that evidence can be submitted to the Q2 oracle-admission process.

It does not contain licensed Code text, KD320 equations, fatigue-curve points, or native arithmetic.

Required semantic rows are `KD320-SEM-002` through `KD320-SEM-013`. Each row must retain the 2023 publication locator, controlled-2025 locator, opaque controlled semantic reference, comparison disposition, comparator custody, and a distinct independent checker.

Permitted dispositions are:

- `IDENTICAL`
- `EQUIVALENT_WITH_NON_NUMERICAL_EDITORIAL_CHANGE`
- `CHANGED_REQUIRES_NEW_ORACLE`
- `NOT_COMPARABLE`
- `PENDING_CONTROLLED_2025_SOURCE`

Only the first two can satisfy a semantic row. Any changed or non-comparable item requires a new target-2025 oracle. Even a fully reconciled candidate does **not** admit `KD3-QF-022`; it only becomes eligible for submission through the PR622 Q2 admission gate.

Run:

```bash
node scripts/verify-b313-ch9-kd320-edition-reconciliation.mjs <candidate.json>
node scripts/verify-b313-ch9-kd320-edition-reconciliation.mjs <candidate.json> --require-ready
```
