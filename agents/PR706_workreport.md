# PR706 Work Report

CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-01
PR: 706
BRANCH: agent/engcalc-bolted-joints-phase1-20260902
BASE_MAIN: bff53e336bdbddbe0fb829b7991ca5ed27fc836a
LATEST_MATERIAL_HEAD: 014a4beb5908de60d4ed6f46456918868475515f
LATEST_ENDPOINT: EP-0014
STATE: ACTIVE_AUTO
EXECUTION_MODE: AUTO
AUTO_STATE: DETAILED_FRICTION_REFERENCE_COMPLETE
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_MISSION
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Implement the approved `Engineering Calculations -> Flanges & Joints / Bolts` critical path with source-traceable numerical kernels, explicit load mechanics, non-authorizing master-data custody, independent analytical fixtures, and fail-closed authority semantics.

## Delivered capability

### Flange

- pure SI `FLANGE.RATED_LOAD.UG44B` benchmark kernel;
- flange-face moment transport and opening-load resolution;
- BENCHMARK_ONLY central Engineering Calculations adapter/registration;
- source register and synthetic exact-match flange master custody.

### Bolts

- explicit preload foundation `F = A_s * S_ref * alpha`;
- short-form `T = K F d` with explicit K range and no hidden preload/K defaults;
- synthetic exact-match bolt thread/material/friction master custody;
- linear rigid-plate/equal-stiffness bolt-group reference distribution with force/moment equilibrium residuals;
- detailed thread/bearing-friction reference model:
  - exact V-thread friction/helix relation based on NASA RP-1228;
  - explicit thread and bearing friction coefficients;
  - explicit bearing friction radius;
  - separate pitch, thread, bearing and total torque outputs;
  - effective K only as a derived diagnostic;
  - legacy `Bolt Torque Calc.xls` linearized comparator kept separate;
  - legacy geometry helper constrained to the qualified 60-degree included thread form;
  - direct CLI and analytical/applicability fixtures.

## Detailed-friction source boundary

NASA RP-1228 is the controlled public equation basis for the exact reference model. The owner-supplied `Bolt Torque Calc.xls` is legacy displayed-equation/geometry evidence. These are deliberately separate implementations.

The exact detailed solver accepts caller-supplied pitch diameter, lead and thread half-angle. The legacy geometry helper fails closed for non-60-degree included threads rather than extrapolating `H = p cos(a)` outside its qualified workbook context.

Real lubricant/coating/thread friction data, project assembly procedure, PCC-1/VDI/ISO qualification and Code/design acceptance remain unresolved/not claimed.

## Engineering authority

```text
UG44                         = BENCHMARK_ONLY
bolt short-form              = REFERENCE_KERNEL_ONLY
bolt detailed friction       = REFERENCE_KERNEL_ONLY
legacy geometry scope        = 60_DEGREE_INCLUDED_THREAD_ONLY
bolt-group distribution      = LINEAR_REFERENCE_ONLY
flange/bolt master ceiling   = ENGINEERING_SANDBOX
codeCompliance               = false
designAuthority              = false
governingEligible            = false
new bolt registryIntegrated  = false
```

## Validation truth

```text
source/architecture inspection                         PASS
base drift                                              PASS / zero behind
focused existing flange/bolt source-reconstructed      PASS 36/36
UG44 registry equivalent source-reconstructed           PASS 3/3
detailed-friction source-reconstructed                  PASS 9/9
detailed-friction CLI source-reconstructed              PASS
hosted exact PR checkout + Node 22                      PASS (earlier run)
hosted HP suite                                         FAIL 14/15 / OUT_OF_SCOPE_HP_PARITY
exact native full-repository validation                 NOT_RUN / ENVIRONMENT_BLOCKED
browser                                                  NOT_RUN
independent engineering review                           NOT_RUN
```

The detailed-friction fixture set covers legacy 60-degree geometry, arithmetic bearing radius, independent exact torque arithmetic, NASA K identity with `r_b = 0.625 d`, frictionless limit, exact-vs-linearized separation, invalid/singular cases, and a negative 55-degree legacy-geometry applicability case.

Source-reconstructed execution is not represented as exact native checkout validation.

## Backup truth

Before the material legacy-geometry correction, the repository backup command was executed in the reconstructed Node workspace and the exact pre-edit GitHub source was preserved as:

` .backups/2_converters_engineering_calculations_bolts_detailed_friction_js.bak `

Native full-repository checkout remains unavailable, so this does not establish full native-repository validation.

## Current highest risks

1. Real thread/material/friction master-data authority remains unresolved.
2. Installation torsional and combined axial/torsional bolt strength are not yet implemented.
3. Exact native/full-repository validation remains unavailable.
4. Central bolt calculator registry/UI integration remains a later shared-file mutation.

## EXACT_NEXT_ACTION

Implement installation torsional stress and combined axial/torsional von-Mises utilization as a separate non-authorizing bolt-strength reference using **thread torque only** as the transmitted torsion and an explicit stress-section diameter. Add independent solid-circle torsion analytical fixtures. Do not central-register the new bolt methods in the same minimal patch.

## Durable relay

Latest endpoint: `agents/agentchain/ENGCALC-BOLTED-JOINTS/EP-0014.md`.
