# PR709 Work Report

CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-02
PR: 709
BRANCH: agent/engcalc-bolt-installation-strength-20260902
BASE_MAIN: d043376eb623822c657904f707bccf199b3356b3
LATEST_MATERIAL_HEAD: 6ff6e56fee4444908bbb877bca6dc67bacd8db87
STATE: ACTIVE_AUTO
EXECUTION_MODE: AUTO
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_MISSION
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Implement the next bounded bolting action: installation torsional stress and combined axial/torsional von-Mises utilization after torque/preload resolution, without central registry/UI integration or authority promotion.

## Delivered capability

`converters/engineering-calculations/bolts/installation-strength.js` now provides:

- installation axial stress `sigma = F/A_s`;
- solid-circle torsional shear `tau = 16 T_thread/(pi d_s^3)`;
- axial/torsional von-Mises stress `sigma_vm = sqrt(sigma^2 + 3 tau^2)`;
- utilization against explicit `referenceStressPa`;
- explicit `stressSectionDiameterM` rather than silently using nominal diameter;
- `calculateInstallationStrengthFromDetailedTorque(...)`, which consumes `threadTorqueNm` from the detailed-friction result and records bearing/total wrench torque as excluded from bolt-section torsion;
- fail-closed validation and non-authorizing metadata.

The direct CLI is `scripts/calc-bolt-installation-strength.mjs`.

## Torque-path invariant

For this reference:

```text
T_transmitted_through_assessed_bolt_section = T_thread
T_bearing                                   = excluded
T_total_wrench                              = excluded
```

A controlled source or specific joint configuration demonstrating a different path is a falsifier and must supersede this reference for that application.

## Engineering authority

```text
installationStrengthState = REFERENCE_KERNEL_ONLY
codeCompliance            = false
designAuthority           = false
governingEligible         = false
registryIntegrated        = false
```

Real material/reference-stress, thread and friction master authority remains unresolved.

## Validation truth

A source-reconstructed Node 22 workspace executed the exact newly authored installation-strength module/test/CLI content:

```text
bolt-installation-strength.test.mjs      PASS 8/8
CLI analytical fixture                   PASS
new JS/MJS line limits                   PASS
new JS/MJS syntax checks                 PASS
```

A second integration fixture exercised the intended detailed-friction -> installation-strength torque path using the previously qualified detailed-friction equation reproduction:

```text
bolt-installation-strength-detailed-torque equivalent integration   PASS 2/2
```

This integration execution is supporting evidence; it is not relabeled as exact native full-repository execution.

Still open:

```text
exact native full-repository execution   NOT_RUN / ENVIRONMENT_BLOCKED
browser                                  NOT_APPLICABLE for standalone kernel/CLI
independent engineering review           NOT_RUN
real master-data qualification           UNRESOLVED
```

## Independent analytical fixture

For:

```text
F       = 10,000 N
A_s     = 58e-6 m^2
T_thread= 10 N.m
d_s     = 0.01 m
S_ref   = 640 MPa
```

the independent expected values are:

```text
sigma   = 172.413793103 MPa
tau     = 50.929581789 MPa
sigma_vm= 193.669778117 MPa
U       = 0.3026090283
```

The detailed-friction reference fixture with `T_thread = 10.29818664494525 N.m` and `d_s = 0.008159696016958068 m` produces the independently precomputed installation result:

```text
tau     = 96.540363436 MPa
sigma_vm= 240.202647468 MPa
U       = 0.3753166367 against 640 MPa
```

## Source / evidence

- `docs/engineering-calculations/bolt-installation-strength-source-register.md`;
- prior NASA RP-1228 detailed-torque reference basis;
- owner-supplied `Bolt Torque Calc.xls` as legacy context only;
- owner-supplied Abid/Khan bolted-flange paper as qualitative evidence that torque tightening introduces significant torsional stress and combined loading.

## Changed-file intent

New engineering files only:

- `converters/engineering-calculations/bolts/installation-strength.js`;
- `tests/bolt-installation-strength.test.mjs`;
- `tests/bolt-installation-strength-detailed-torque.test.mjs`;
- `scripts/calc-bolt-installation-strength.mjs`;
- `docs/engineering-calculations/bolt-installation-strength-source-register.md`.

Relay/index/backup/status/claim files are delivery custody only. No central registry, UI, workflow, runtime, writer, canvas, unrelated HP/vibration calculation, or master-data authority is changed.

## Highest risk

The main remaining engineering risk is authority and applicability rather than arithmetic: the stress-section diameter, material/reference stress, residual torsion behavior and assembly procedure require qualified project data/methodology before design use.

## EXACT_NEXT_ACTION

After closing this bounded leg, re-ground a separate central-integration leg if the owner wants these bolt reference calculators exposed through Engineering Calculations. Keep all new bolt methods non-authorizing until real source/master-data and method authority are qualified.
