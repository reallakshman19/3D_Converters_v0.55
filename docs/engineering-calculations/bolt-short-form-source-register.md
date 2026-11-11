# Bolt Short-Form Preload / Torque — Source Register

Status: `BENCHMARK_ONLY / NOT DESIGN OR ASSEMBLY PROCEDURE AUTHORITY`

Chain: `ENGCALC-BOLTED-JOINTS`

PR: `#706`

## Purpose

This register defines the evidence and limitations for the caller-input-driven bolt short-form kernel. It does not authorize a universal preload percentage, nut factor, lubricant value, bolt grade database, or flange assembly procedure.

## Implemented reference relationships

The current kernel implements only explicit-input arithmetic:

- target preload: `F = A_s * S_ref * alpha`;
- short-form torque: `T = K * F * d`;
- tensile stress: `sigma = F / A_s`;
- reference-stress utilization: `sigma / S_ref`.

`A_s`, `S_ref`, `alpha`, `K`, and `d` are caller inputs. No production material, thread, friction, coating, lubricant, gasket, or preload-percentage database is embedded.

## Source ledger

| Source | Classification | Supports | Does not support | Disposition |
|---|---|---|---|---|
| User-supplied `Bolt Torques.xls` | `LEGACY_CALCULATION` | Explicit `T = N * Po * D` / nut-factor style torque relation; preload constructed from stress area, reference strength and an explicit fraction; notes show nut factor depends on lubricant | Does not establish current governing standard, universal K, or universal preload percentage | Reference/legacy regression only |
| User-supplied `Bolt Torque Calc.xls` | `LEGACY_DETAILED_CALCULATION` | More detailed thread/bearing-friction torque model and bolt stress concepts | Not yet formula-audited in modern workbook form; not equivalent to the short-form K model | Reserved for later detailed-friction leg |
| ExcelCalcs Detailed Bolted Joint Calculations | `SECONDARY_REFERENCE` | Preload-centric joint model; separates thread/collar friction and joint stiffness/stress effects | User-maintained calculator is not governing engineering authority | Architecture/reference only |
| DesignCalculators bolt torque page | `SECONDARY_REFERENCE` | `T = K F D`; target preload and friction/scatter are explicit engineering inputs | Example K/preload ranges are not universal design values | Formula/reference only |
| EngiCalcHub bolt torque page | `SECONDARY_REFERENCE` | `T = K F d`; metric stress-area approximation; explicitly notes torque/preload scatter and limited applicability of simple preload conventions | Its example preload convention is not suitable as a universal gasketed-flange rule | Formula/reference only |
| EngineeringDesigner bolt torque article | `SECONDARY_REFERENCE` | `T = K D F`; emphasizes K variability with finish/lubrication and need for traceable/measured K in critical joints | Does not establish one universal K | Formula/reference only |
| User-supplied paper `bolt Paper-65.pdf`, *The effect of bolt tightening methods and sequence on the performance of gasketed bolted flange joint assembly* | `RESEARCH_EVIDENCE` | Tightening method/sequence changes achieved bolt preload scatter, bolt bending and gasket contact stress; supports treating preload as primary and torque as one assembly method | Study results are specific to the investigated flange/configuration and are not universal acceptance values | Qualitative assembly-model evidence |

## Web references supplied for this work

- `https://www.excelcalcs.com/calcs/repository/Machines/Bolts-and-Threads/Detailed-Bolted-Joint-Calculations/`
- `https://designcalculators.co.in/bolt-torque`
- `https://engicalchub.com/calculators/bolt-torque-calculator/`
- `https://www.engineeringdesigner.co.uk/how-to-calculate-bolt-torque/`

These are retained as secondary references, not controlled governing sources.

## Protected engineering interpretation

1. **Preload is primary.** Torque is an indirect assembly control used to generate preload.
2. **No universal nut factor.** `K` varies materially with thread/bearing friction, finish, coating, lubricant, reuse, temperature and assembly condition.
3. **No universal preload fraction.** A percentage of proof/yield/reference stress must be selected by the applicable joint/assembly method and project requirements; the kernel therefore requires `preloadFraction` explicitly.
4. **Short-form torque is not a detailed friction model.** The later detailed model must separately resolve thread geometry, thread friction and bearing/collar friction and should not be made numerically identical by calibration.
5. **Gasketed flange assembly needs additional checks.** Gasket seating/contact, flange rotation, bolt interaction, relaxation and tightening sequence are outside the present short-form kernel.
6. **Installation torsional stress is not evaluated yet.** The kernel explicitly reports `installationTorsionalStressEvaluated=false`.

## Authority gates before production design use

- qualified thread/stress-area basis;
- qualified bolt material/proof/yield/allowable data by temperature;
- qualified nut-factor or friction data tied to finish/lubricant/assembly condition;
- selected preload basis and governing assembly procedure;
- installation combined tensile/torsional stress method;
- gasket/flange-specific preload requirements where applicable;
- independent execution of the focused bolt tests;
- central Engineering Calculations registration with non-misleading UI semantics;
- independent engineering review.

## Current authority state

```text
calculationState   = REFERENCE_KERNEL_ONLY
engineeringAuthority = NONE
codeCompliance     = false
designAuthority    = false
governingEligible  = false
```

The numerical result is only the result of the explicit input assumptions. It must not be presented as a qualified bolt assembly torque or flange-joint acceptance without the unresolved authority and validation gates above.
