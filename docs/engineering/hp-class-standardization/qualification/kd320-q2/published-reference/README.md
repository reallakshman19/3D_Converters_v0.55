# KD320 published-reference prefill

This directory retains primary published numerical cross-check evidence for the KD320 Q2 program without admitting that evidence as the target `KD3-QF-022` oracle.

Target qualification identity:

- ASME B31.3: 2024
- ASME BPVC Section VIII Division 3: 2025
- method: `KD3-FATIGUE-001`
- target oracle slot: `KD3-QF-022`

The retained publications are intentionally edition-mismatched cross-checks:

- `PVP2025-154710` uses ASME VIII-3 2023 and retains a full published `Salt -> associated mean stress -> correction parameter evidence -> Seq -> N` numerical table.
- `PVP2024-123674` uses ASME VIII-3 2021 and retains a second published VIII-3 fatigue assessment, but not the full Q2 numerical chain.

Neither record is admissible for the target 2025 oracle until all of the following are independently established:

1. retained paper bytes have a canonical SHA-256;
2. the controlled VIII-3 2025 source is available through `Q1-SRC-VIII3-2025`;
3. the relevant method semantics are reconciled from the paper's Code edition to the controlled 2025 edition;
4. an independent admission check is recorded;
5. the Q2 candidate verifier accepts the resulting target-2025 oracle record.

Publication year must never be treated as Code edition. No formula expression or licensed ASME Code text is stored in this directory.

Run:

```bash
node scripts/audit-b313-ch9-kd320-published-reference-prefill.mjs
```
