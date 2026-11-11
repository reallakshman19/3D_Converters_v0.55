# Bolt Installation Strength — Source / Authority Register

## Method ID

`INSTALLATION_AXIAL_THREAD_TORSION_VON_MISES_REFERENCE`

## Purpose

Provide a non-authorizing reference calculation for bolt stress **during torque tightening** after preload and transmitted thread torque have been established by a separate assembly calculation.

This method is not a substitute for a qualified Code, PCC-1, VDI 2230, ISO 16047, manufacturer or project assembly procedure.

## Input custody

The solver requires explicit SI inputs:

- `preloadN` — installation axial preload;
- `tensileStressAreaM2` — area used for installation axial stress;
- `threadTorqueNm` — torque transmitted through the threaded bolt section;
- `stressSectionDiameterM` — explicit equivalent solid circular diameter used for torsional stress;
- `referenceStressPa` — explicit comparison stress.

No default proof/yield fraction, stress-section diameter, material strength or friction coefficient is introduced here.

## Torque-path basis

The merged detailed-friction model exposes thread torque and bearing torque separately. For this reference, bolt-section torsion uses:

`T_transmitted = T_thread`

Bearing friction torque and total wrench torque are **not** added to the assessed bolt-section torsion. The working hypothesis is that bearing friction closes locally at the rotating bearing interface while the thread torque is transmitted through the threaded stress section.

This path remains a reference assumption. A controlled source or specific joint geometry showing a different torque path is a falsifier and must supersede this method for that application.

## Mechanics equations

### Axial stress

`σ = F / A_s`

### Solid circular torsional shear

For an explicit equivalent solid circular stress-section diameter `d_s`:

`τ_max = 16 T_thread / (π d_s^3)`

### Axial + torsion von Mises stress

`σ_vm = sqrt(σ^2 + 3 τ_max^2)`

### Reference utilization

`U = σ_vm / S_ref`

The solver reports `withinReferenceStress = (U <= 1)`, but this is only comparison arithmetic. It is not Code/design acceptance unless the reference stress and method authority are separately qualified.

## Source classification

| Source | Role | Authority |
|---|---|---|
| NASA RP-1228 Fastener Design Manual | Prior controlled reference for the detailed thread/bearing torque model and torque-component separation | `REFERENCE`; not project/Code authority |
| Owner-supplied `Bolt Torque Calc.xls` | Legacy detailed torque / bolt-stress context | `LEGACY_CALCULATION`; not governing authority |
| Muhammad Abid & Yasir Mehmood Khan, *The effect of bolt tightening methods and sequence on the performance of gasketed bolted flange joint assembly* | Supports the engineering observation that torque tightening introduces torsional stress and that combined axial/torsional stress can approach yielding earlier than axial stress alone | `INDEPENDENT_REFERENCE`; study-specific, not universal acceptance |
| Classical solid-circle torsion and von-Mises identities | Mechanics basis independently reproduced in focused analytical fixtures | `REFERENCE_KERNEL_BASIS`; non-authorizing |

## Validation fixtures

`tests/bolt-installation-strength.test.mjs` independently checks:

1. `σ = F/A_s`;
2. `τ = 16T/(πd^3)`;
3. a precomputed combined axial/torsion von-Mises fixture;
4. the zero-thread-torque axial-only limit;
5. the pure-torsion von-Mises identity;
6. a detailed-torque adapter fixture using the prior thread-torque result;
7. invariance to changes in bearing torque when thread torque is unchanged;
8. fail-closed invalid geometry/reference inputs.

## Authority boundary

```text
calculationState   = REFERENCE_KERNEL_ONLY
codeCompliance     = false
designAuthority    = false
governingEligible  = false
registryIntegrated = false
```

## Limitations

- Installation tightening state only; operating pressure/external-load bolt stresses are not combined here.
- The torsional section is represented by an explicit equivalent solid circular diameter.
- Thread-root notch/stress concentration, local contact, bending and multiaxial notch effects are not included.
- Residual torsion after tightening, relaxation, embedding, preload scatter and tightening-sequence interaction are not included.
- Material/reference-stress qualification remains external to this solver.
- Real thread/material/friction master data remain unresolved unless separately governed.
