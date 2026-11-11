# Bolt Detailed Friction Torque — Source Register

## Calculation identity

```text
Domain: Engineering Calculations -> Bolts -> Torque -> Detailed Friction Model
Production path: converters/engineering-calculations/bolts/detailed-friction.js
State: REFERENCE_KERNEL_ONLY
Code compliance: false
Design authority: false
Governing eligible: false
```

The model deliberately keeps target preload as the primary bolt quantity and calculates tightening torque from explicit geometry and friction inputs. It does not infer preload from a default percentage and does not hide thread/bearing friction inside a single nut factor.

## S1 — Owner-supplied legacy workbook

Source: `Bolt Torque Calc.xls`

Authority classification: `LEGACY_CALCULATION / IMPLEMENTATION_EVIDENCE`

A binary text inspection of the workbook exposes the following human-readable calculation labels/equation banner:

```text
Torquing of bolts
Basic Bolt geometry
Pitch, p
Diameter, D
Height of fundamental triangle, H
Tensile Stress Area, As
Minor diameter, Ks
Initial tensioning load, Po
Basic effective diameter, Es
Lead Angle, l
Coeff of friction, m1
Coeff of friction, m2
Included angle of thread, 2a
Torque, T
Inner bearing area of nut, di
Outer bearing area, do

H = p cos a
Es = D - 0.75 H
Ks = D - 17 H / 12
As = pi (Es + Ks)^2 / 16
tan l = p / (pi Es)
```

The displayed torque equation is interpreted dimensionally as the following **linearized** decomposition for tightening, with the workbook's `/12` conversion applying when inch-pound inputs are reported as ft-lb:

```text
T_linearized = Po * [
    (Es/2) * tan(l)
  + (Es/2) * m1 / cos(a)
  + ((do + di)/4) * m2
]
```

This interpretation is implemented only as `calculateLegacyLinearizedDetailedTorque()` / the legacy comparison wrapper. It is not treated as a governing standard and is not presented as the exact V-thread friction relation.

### Legacy geometry mapping

```text
H   -> fundamentalTriangleHeightM
Es  -> pitchDiameterM
Ks  -> minorDiameterM
As  -> tensileStressAreaM2
l   -> helixAngleRad
m1  -> threadFrictionCoefficient
m2  -> bearingFrictionCoefficient
2a  -> includedThreadAngleDeg
Po  -> preloadN
```

For a single-start 60-degree thread this reproduces the familiar relationships:

```text
H  = p cos 30 deg
Es = D - 0.75 H
Ks = D - (17/12) H
As = pi (Es + Ks)^2 / 16
lead = pitch
tan(lambda) = lead / (pi Es)
```

Multi-start threads are supported only by explicitly setting `starts`, which changes `lead = starts * pitch`; this is an implementation extension and not inferred from the workbook.

## S2 — NASA RP-1228 Fastener Design Manual

Source: Richard T. Barrett, NASA Reference Publication 1228, *Fastener Design Manual*, 1990.

Primary public record:

https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19900009424.pdf

NASA Technical Reports Server record:

https://ntrs.nasa.gov/citations/19900009424

Authority classification: `CONTROLLED_PUBLIC_ENGINEERING_REFERENCE`, not a project Code/design authority.

NASA gives the torque coefficient relation:

```text
T = K F d

K = (dm / (2 d))
    * (tan(psi) + mu sec(alpha))
      / (1 - mu tan(psi) sec(alpha))
    + 0.625 mu_c
```

where the manual identifies `dm` as thread mean diameter, `psi` as thread helix angle, `mu` as thread friction coefficient, `alpha` as thread angle and `mu_c` as bearing/clamping-surface friction coefficient.

The production reference kernel rewrites this as a direct torque decomposition and generalizes the bearing term:

```text
T_thread = F * dm/2
           * (tan(psi) + mu_t sec(alpha))
             / (1 - mu_t tan(psi) sec(alpha))

T_bearing = F * mu_b * r_b

T_total = T_thread + T_bearing
```

Setting `r_b = 0.625 d` recovers the NASA coefficient form exactly.

The generalized `r_b` is intentionally an explicit input. The code does not assume the NASA `0.625 d` bearing geometry for every joint.

## S3 — Bearing-radius assumption used for legacy comparison

The legacy workbook displays inner and outer nut-bearing diameters and an arithmetic diameter term `(do + di)/4` in the torque equation. The helper:

```text
calculateBearingFrictionRadiusUniformWear()
```

therefore returns:

```text
r_b = (do + di) / 4
```

and labels the assumption `UNIFORM_WEAR_ARITHMETIC_MEAN_RADIUS`.

This bearing-radius assumption is used only when the caller explicitly requests the legacy-workbook wrapper. The exact detailed solver accepts `bearingFrictionRadiusM` directly and does not select a pressure/wear model silently.

## S4 — Assembly context

Source: owner-supplied `bolt Paper-65.pdf`, *The effect of bolt tightening methods and sequence on the performance of gasketed bolted flange joint assembly*.

Authority classification: `REFERENCE / ASSEMBLY-BEHAVIOR EVIDENCE`.

The paper supports the architecture-level conclusions that torque-controlled assembly introduces thread/bearing-friction sensitivity and installation torsion, and that achieved preload is affected by tightening procedure and elastic interaction. It is not used as the numerical equation authority for the detailed torque kernel.

## Model separation

The code intentionally exposes two separate methods:

```text
DETAILED_V_THREAD_FRICTION_REFERENCE
    NASA exact friction/helix coupling relation

LEGACY_LINEARIZED_THREAD_BEARING_FRICTION_REFERENCE
    owner workbook displayed additive/linearized relation
```

The linearized result must not be renamed or promoted as the exact relation merely because the numerical difference is small for a particular fixture.

## Explicit inputs

The exact detailed solver requires:

```text
preloadN
nominalDiameterM
pitchDiameterM
leadM
threadHalfAngleDeg
threadFrictionCoefficient
bearingFrictionCoefficient
bearingFrictionRadiusM
```

The legacy wrapper additionally accepts:

```text
pitchM
includedThreadAngleDeg
starts
innerBearingDiameterM
outerBearingDiameterM
```

and derives legacy geometry/bearing radius transparently.

## Explicit exclusions

This patch does not establish or model:

```text
real project friction coefficients
lubricant/coating qualification
prevailing/running torque
preload scatter from torque control
tool accuracy
embedding or relaxation
thermal preload change
joint stiffness/load fraction
installation torsional/von-Mises acceptance
thread stripping
fatigue
PCC-1 or VDI 2230 project compliance
```

Those require separate methods/data qualification.

## Validation oracle

The focused analytical tests are independent hard-coded constructions, not expected values copied from production output. They cover:

- legacy 60-degree thread geometry;
- arithmetic bearing radius `(do + di)/4`;
- a direct exact V-thread numerical fixture;
- NASA `K` identity recovered with `r_b = 0.625 d`;
- frictionless limit `T = F * lead / (2 pi)`;
- exact versus legacy-linearized distinction;
- fail-closed invalid geometry and singular denominator.

## Qualification state

```text
method_state: REFERENCE_KERNEL_ONLY
source_basis:
  NASA_RP_1228: QUALIFIED_FOR_REFERENCE_EQUATION
  Bolt_Torque_Calc.xls: QUALIFIED_AS_LEGACY_DISPLAYED_EQUATION_EVIDENCE
real_friction_data: UNRESOLVED
code_compliance: false
design_authority: false
governing_eligible: false
```
