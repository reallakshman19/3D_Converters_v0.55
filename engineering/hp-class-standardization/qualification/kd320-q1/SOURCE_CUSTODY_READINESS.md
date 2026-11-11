# KD320 Q1 Controlled Source Custody Readiness

## Purpose

This document defines the minimum non-licensed handoff required to move KD320 Q1 source custody from `PENDING` to independently verified evidence.

It does **not** contain ASME text, equations, fatigue-curve values, inferred semantics, or numerical KD320 defaults.

## Canonical source ownership

```text
Q1-SRC-B313-2024
  <-> SRC-B313-2024-CONTROLLED
  -> SEM-001
  -> E01
  -> part of E08

Q1-SRC-VIII3-2025
  <-> SRC-VIII3-2025-CONTROLLED
  -> SEM-002...SEM-014
  -> E02
  -> E03...E08 as referenced by the semantic contract
```

Public ASME product/catalog pages establish edition/scope identity only. They are not formula, semantic, fatigue-curve, or numerical oracles.

## Required source-officer handoff per controlled document

For **each** controlled source, the secure evidence system must provide the following metadata without copying licensed source content into this repository:

```text
controlled source ID
receipt ID
secure storage reference
exact controlled document edition
SHA-256 of the exact controlled document bytes
exact source locator list required by the Q1 semantic inventory
verified-by identity + UTC timestamp
independent-check identity + UTC timestamp
```

Required identity pair:

```text
SRC-B313-2024-CONTROLLED <-> Q1-SRC-B313-2024
SRC-VIII3-2025-CONTROLLED <-> Q1-SRC-VIII3-2025
```

The verifier and independent checker must be different normalized identities.

## State transition

### Current state

```text
controlled source status = PENDING_SECURE_HASH_AND_LOCATOR_RECONCILIATION
receipt status           = PENDING_CONTROLLED_SOURCE_RECEIPT
E01 / E02                = PENDING
G0                       = BLOCKED_PENDING_E01_E02
```

### Permitted terminal source-custody state

Only after the real controlled source has been reconciled and independently checked:

```text
controlled source status = CONTROLLED_SOURCE_RECONCILED
receipt status           = CONTROLLED_RECEIPT_VERIFIED
```

The source-custody audit requires both state strings **and** valid bidirectional ownership. Status edits alone cannot make source custody complete.

## B31.3-2024 custody scope

The B31.3 controlled document is required to establish the exact Chapter IX invocation/routing/applicability custody represented by `KD320-SEM-001`.

Minimum repository outcome after controlled extraction and independent check:

```text
Q1-SRC-B313-2024 = CONTROLLED_RECEIPT_VERIFIED
KD320-SEM-001     = INDEPENDENTLY_CHECKED
E01               = eligible for PASS
E08               = still depends on all of its required controlled semantics
```

No paragraph number beyond what is independently verified from the controlled document should be entered merely because a public product page, legacy code, project specification, or secondary summary mentions it.

## VIII-3-2025 custody scope

The controlled VIII-3 document is required for `KD320-SEM-002...014`, including stress-state selection, alternating/mean-stress semantics, correction parameters, fatigue-curve custody, permissible-cycle semantics, material/temperature rules, applicability, fail-closed rules, and result-evidence custody.

Minimum repository outcome after controlled extraction and independent check:

```text
Q1-SRC-VIII3-2025 = CONTROLLED_RECEIPT_VERIFIED
KD320-SEM-002...014 = INDEPENDENTLY_CHECKED
```

E02-E08 may only be promoted when their own referenced semantic requirements are satisfied. G1 still requires E03-E08 PASS.

## Fail-closed rules

The following must remain blocked:

```text
missing controlled source slot
missing receipt -> controlled-source reference
wrong controlled source reused by another receipt
controlled source -> wrong receipt back-reference
public identity substituted for controlled source
publicRepositoryContentAllowed != false
formulaOracle != false
fatigueCurveOracle != false
verified receipt while source status is unreconciled
terminal status strings with any structural binding defect
```

## Authority after G0/G1

Even when Q1 source and semantic evidence eventually passes:

```text
nativeCoreKd3Qualified       = false
codeCompliance               = false
canUseForDesignAuthority     = false
productionKernelAllowed      = false
automaticPromotionAllowed    = false
```

The only Q1 exit effect is permission to proceed to independently sourced Q2 oracle completion.
