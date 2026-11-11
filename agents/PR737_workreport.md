# PR737 Workreport — P6 GRE Equivalent-Pressure Source Qualification

## Mission

Qualify the owner-supplied `FLANGE LEAKAGE CHECK GRE.xls` source only far enough to define a safe non-authorizing migration boundary for issue #721 P6.

## Grounding

- main: `78b361d1f649d41378f568ebe1a237c4bc140c73`
- base stack: PR #734 on PR #733
- P2 exact focused execution: `NOT_RUN`
- P3 exact native execution: `NOT_RUN`
- P4 exact native execution: `NOT_RUN`
- P5: blocked by explicitly unchecked embedded equations
- latest relay: EP-0026

## Source custody

```text
file      FLANGE LEAKAGE CHECK GRE.xls
bytes     437760
SHA-256   44dd5e17daac62274f75bced45532b8c3344e293630c8a99226b996ca496d49f
Git blob  2ba444cf85d0130b86a2e079c11c5bc4f06a72b0
```

The uploaded bytes reproduce the repository Git blob exactly.

## Formula audit

BIFF8 record-level recovery establishes the populated `Equivalent FLG` chain:

```text
Pq = 2*PN
PEQbending [MPa] = 16*Mb[N.m]*1000/(pi*G[mm]^3)
PEQaxial [MPa] = IF(F="NA",0,4*ABS(F)/(pi*G[mm]^2))
PFD [barg] = PSYS[barg] + 10*(PEQbending+PEQaxial)
PASS when PFD <= f2*Pq
```

Recovered named factors:

```text
f2d = 0.6944
f2s = 0.56
f2h = 0.7448
```

## Independent replay

Ten complete populated rows on `Equivalent FLG` were independently recalculated:

- 10/10 `Pq` values match;
- 30/30 bending equivalent-pressure values match;
- 30/30 axial equivalent-pressure values match;
- 30/30 total equivalent flange-pressure values match;
- 30/30 pass/fail inequalities match.

Overall numeric replay: `PASS 100/100`.

## Engineering interpretation

This workbook is a pressure-equivalence screening calculation. It does not predict leakage flow or probability and does not solve gasket compression/contact, flange separation, bolt redistribution or nonlinear joint behavior.

The workbook cites memo `KRO/604201v0` dated 02-06-2006, but the memo is not in the controlled package. Project/manufacturer applicability therefore remains unresolved.

## Authority

```text
sourceRole             LEGACY_EQUIVALENT_PRESSURE_SCREENING
physicalLeakRateModel  NOT_PRESENT
controlledMemoBasis    UNRESOLVED
codeCompliance         false
designAuthority        false
governingEligible      false
```

## Backup truth

The repository's mandated native backup command cannot be executed in the connector-only environment. Before editing the mutable chain index, an exact connector-side copy is stored at:

`.backups/connector-20260904-p6/agents_agentchain_before_ep0026.md.bak`

This is evidence only and is not relabeled as a native backup-command PASS.

## Next action

Implement the recovered screen in a separate stacked PR as a new-file-only `SCREENING_REFERENCE_ONLY` kernel with explicit SI inputs and workbook regression. Keep leak-rate, gasket-contact/seating stress, separation mechanics, registry/UI integration and authority promotion out of that patch.
