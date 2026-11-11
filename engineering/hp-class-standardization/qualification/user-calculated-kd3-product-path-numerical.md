# USER_CALCULATED_KD3 Product-Path Numerical Regression

## Qualification identity

- Scope: HP Piping Class `USER_CALCULATED_KD3` software product path.
- Purpose: independently hand-check physical wall custody, CORE pressure-cycle Salt, external Seq/N ingestion, Miner `n/N`, cumulative `ΣU`, JSON round-trip, and permanent review-only authority.
- This is **not** native KD320 qualification.
- This does **not** validate mean-stress correction, fatigue-curve selection/interpolation, or externally supplied Seq/N against ASME VIII-3.
- Native KD320, Code compliance, and design authority remain false.

## Fixed physical input

| Quantity | Value |
|---|---:|
| Outside diameter D | 114.3 mm |
| Nominal wall t_nom | 13.49 mm |
| Minus manufacturing tolerance | 12.5% |
| Internal allowance | 3.0 mm |
| External allowance | 0.0 mm |
| Low pressure | 2 MPa |
| High pressure | 20 MPa |

## Independent hand calculation

Minimum as-manufactured wall:

```text
t_min = 13.49 × (1 - 0.125)
      = 11.80375 mm
```

Selected end-of-life fatigue wall:

```text
t_fatigue = 11.80375 - 3.0 - 0.0
          = 8.80375 mm
```

Bore diameter and diameter ratio:

```text
D_i = 114.3 - 2 × 8.80375
    = 96.6925 mm

Y = D / D_i
  = 114.3 / 96.6925
  = 1.1820978876334773
```

For thick-cylinder bore pressure stress, the governing principal stress difference for this pressure-only case is:

```text
S_p(P) = 2 P Y² / (Y² - 1)
```

Therefore:

```text
S_p(2 MPa)  = 14.066554624558583 MPa
S_p(20 MPa) = 140.66554624558586 MPa

ΔS_p = 126.59899162102727 MPa
Salt = ΔS_p / 2
     = 63.29949581051363 MPa
```

The oracle is intentionally sensitive to the fatigue-wall basis. If nominal wall `13.49 mm` were used incorrectly instead of `8.80375 mm`, the same pressure cycle would produce:

```text
Salt_wrong_nominal = 43.23041554660033 MPa
error vs correct    = -31.704960690350337%
```

If minimum as-manufactured wall `11.80375 mm` were incorrectly used without subtracting the 3 mm internal allowance:

```text
Salt_wrong_min_as_mfg = 48.59336739500539 MPa
error vs correct      = -23.232615405864976%
```

Thus the regression will materially detect wall-custody regressions rather than merely checking a rounded number.

## Two-cycle external Seq/N fixture

Seq and N below are synthetic external inputs used only to qualify ingestion and Miner bookkeeping. They are **not** asserted as ASME KD320-derived values.

| Cycle | State pair | Applied n | Hand Salt MPa | External Seq MPa | External N | Ui=n/N |
|---|---|---:|---:|---:|---:|---:|
| C1 | LOW → HIGH | 500 | 63.29949581051363 | 70 | 10000 | 0.05 |
| C2 | HIGH → LOW | 1200 | 63.29949581051363 | 85 | 30000 | 0.04 |

Cumulative Miner usage:

```text
ΣU = 500/10000 + 1200/30000
   = 0.05 + 0.04
   = 0.09
```

Expected software review result:

```text
usageWithinUnity = true
referenceStatus  = REFERENCE_PASS
projectState     = CALCULATED_NOT_AUTHORIZED
```

## Executed software path represented by the regression

```text
NPS4 reference project
  -> add second governed pressure cycle
  -> create missing governed KD row
  -> copy the existing checked external calculation basis
  -> bulk CSV Seq/N application
  -> HP workspace controller calculate()
  -> central HP orchestrator
  -> CORE selected fatigue wall
  -> CORE pressure-cycle Salt cross-check
  -> external Seq/N consumption
  -> CORE Miner n/N and ΣU
  -> JSON serialize / parse
  -> repeat calculation
```

The committed executable regression is:

```text
tests/hp-piping-class-kd-product-path-numerical.test.mjs
```

## Authority boundary

The regression must continue to prove:

```text
calculationMode           USER_CALCULATED_KD3
nativeCoreKd3Qualified    false
codeCompliance            false
canUseForDesignAuthority  false
```

A PASS of this regression qualifies only the bounded software plumbing and numerical bookkeeping described above. It cannot promote native KD320 or ASME design authority.
