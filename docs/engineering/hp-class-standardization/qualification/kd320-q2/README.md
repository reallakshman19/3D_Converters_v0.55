# KD320 Q2 Controlled Evidence + Oracle Admission

This folder defines a **qualification-only intake contract** for the evidence required before any isolated native KD320 kernel may be authored.

It does not contain KD320 equations, Code text, fatigue-curve points, production calculation code, or authority-promotion logic.

## Candidate command

```bash
node scripts/verify-b313-ch9-kd320-q2-candidate.mjs <candidate.json>
```

Add `--require-ready` when the command should exit non-zero unless the candidate has reached:

```text
Q2_ORACLE_ADMISSION_READY
```

## Required sequence

The evaluator derives the sequence; it never trusts a caller-supplied readiness flag.

```text
controlled B31.3 + VIII-3 receipts
  -> all 14 Q1 semantic items independently checked
  -> formal Q1 evidence ledger E01-E08 PASS
  -> formal Q1 gates G0 + G1 PASS
  -> independently checked Q1 exit attestation bound to exact receipt hashes + semantic locators/refs
  -> Q1 complete
  -> independently checked project calculation (KD3-QF-023)
  -> primary published numerical example (KD3-QF-022)
  -> Q2_ORACLE_ADMISSION_READY
  -> Q3 isolated native-kernel implementation candidate
```

**Receipts plus semantic rows alone are not Q1 completion.** The Q2 candidate must carry `q1ExitAttestation`, produced only after the formal Q1 evidence-ledger gate is complete. The attestation is redacted/public-safe and binds the controlled evidence ledger and Q1 audit report by secure reference + SHA-256; it does not reproduce licensed Code text.

A project calculation by itself is useful evidence but does not satisfy the independent published-primary requirement.

## Numerical custody retained by each oracle

Each numerical oracle must retain the complete numerical chain:

```text
Salt
  -> associated mean-stress quantity
  -> correction parameters
  -> Seq
  -> N
```

Q1 still requires all `KD320-SEM-001...014`. Q2 oracle custody is narrower and method-specific: both QF022 and QF023 must explicitly cite every `KD320-SEM-002...013` semantic item. This keeps the numerical oracle tied to stress selection, mean-stress treatment, correction parameters, fatigue-curve selection/evaluation, material/temperature selection, applicability, and fail-closed limits.

The admission evaluator also exposes the required stage-to-semantic custody map:

```text
Salt                         -> KD320-SEM-003
associated mean stress       -> KD320-SEM-004
correction parameters        -> KD320-SEM-006
Seq                          -> KD320-SEM-007
fatigue-curve selection      -> KD320-SEM-008
fatigue-curve evaluation     -> KD320-SEM-009
N                            -> KD320-SEM-010
material / temperature       -> KD320-SEM-011
applicability envelope       -> KD320-SEM-012
fail-closed limits           -> KD320-SEM-013
```

`KD320-SEM-002` is additionally required because the numerical chain depends on the controlled governing stress-state/component selection.

Source-receipt custody is explicit:

- QF023 must reference both `Q1-SRC-B313-2024` and `Q1-SRC-VIII3-2025`;
- QF022 must reference `Q1-SRC-VIII3-2025` after direct 2025 sourcing or controlled edition reconciliation.

This is evidence custody only. The intake does not recompute Seq or N and does not encode Code equations or fatigue-curve data.

## Formal Q1 exit binding

`q1ExitAttestation` must validate against the candidate's exact controlled evidence:

```text
recordId                    VR-B313-CH9-KD320-NATIVE-001-Q1
status                      Q1_COMPLETE_Q2_ORACLE_POPULATION_ALLOWED
source receipt hashes       exact B31.3-2024 + VIII-3-2025 candidate hashes
semantic bindings           exact SEM-001...014 source/locator/opaque-ref bindings
evidence PASS set           exactly E01...E08
gate PASS set               exactly G0,G1
controlled evidence ledger  secure ref + sha256
Q1 audit report             secure ref + sha256
attestor/checker             distinct identities + UTC timestamps
authority                    permanently false
```

Canonical semantic source binding is independently rechecked at this boundary: SEM-001 belongs to the B31.3 receipt; SEM-002...014 belong to the VIII-3 receipt.

## Licensed-source boundary

Do not commit licensed ASME source text to this public repository.

Candidate files may remain outside the repository and reference secure controlled storage through:

- canonical document SHA-256;
- exact source locators;
- opaque controlled semantic references;
- controlled evidence/audit hashes;
- extractor/verifier identity and timestamp;
- distinct independent-checker identity and timestamp.

The repository templates contain placeholders only.

## Authority

Even a fully admitted candidate returns:

```text
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
productionKernelAllowed = false
automaticPromotionAllowed = false
```

`Q2_ORACLE_ADMISSION_READY` authorizes only the next **qualification implementation stage**. It does not authorize production or design use.
