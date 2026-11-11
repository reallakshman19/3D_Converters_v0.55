# Bolt Detailed Friction — Applicability Guard

This note qualifies the legacy geometry helper introduced with the detailed-friction reference kernel.

## Legacy `Bolt Torque Calc.xls` geometry

The workbook-displayed relationships

```text
H  = p cos(a)
Es = D - 0.75 H
Ks = D - 17 H / 12
As = pi (Es + Ks)^2 / 16
```

are qualified here only for the workbook's 60-degree included thread form (`a = 30 deg`). The production helper therefore fails closed when `includedThreadAngleDeg` is not 60 degrees.

This guard is intentional. Extending `H = p cos(a)` to arbitrary included angles would not be a source-supported general thread-geometry relation.

## Exact V-thread torque solver

`calculateDetailedFrictionTorque()` remains capable of accepting an explicitly supplied:

```text
pitchDiameterM
leadM
threadHalfAngleDeg
```

for other V-thread forms. In those cases the caller is responsible for supplying geometry from a qualified thread standard/source; the legacy workbook geometry helper must not be used to invent it.

## Validation

A dedicated negative fixture in `tests/bolt-detailed-friction-applicability.test.mjs` verifies that a 55-degree request fails closed rather than silently extrapolating the legacy geometry.

Authority remains unchanged:

```text
state              = REFERENCE_KERNEL_ONLY
codeCompliance      = false
designAuthority     = false
governingEligible   = false
```
