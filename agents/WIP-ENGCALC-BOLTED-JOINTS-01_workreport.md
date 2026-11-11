# WIP-ENGCALC-BOLTED-JOINTS-01 Work Report

EXECUTION_CLASS: ENGINEERING_CRITICAL
CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-01
BRANCH: agent/engcalc-bolted-joints-phase1-20260902
BASE_MAIN: bff53e336bdbddbe0fb829b7991ca5ed27fc836a
TAKEOVER_AUTHORITY: NEW_CHAIN_OWNER_AUTHORIZED_SCOPE
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Start the critical path for `Engineering Calculations -> Flanges & Joints` with a new-file-only, fail-closed SI implementation of the rated-flange external-load / UG-44(b) relationship, explicit joint-face load resolution, a direct Node CLI, and independent analytical/PV Elite regression evidence.

## Scope delivered

- `converters/engineering-calculations/flange/ug44.js`
  - pure SI kernel;
  - explicit rated/design pressure, gasket reaction diameter, moment factor, bending moment and opening axial force;
  - equivalent bending/axial pressure components;
  - rated-pressure cap on maximum pressure;
  - acceptance equation cross-form;
  - finite/range fail-closed input validation.
- `converters/engineering-calculations/flange/joint-loads.js`
  - joint-face moment transport `M_target = M_source + r x F`;
  - in-plane resultant bending `hypot(Mx, My)`;
  - opening-only axial load selection;
  - transverse shear/torsion retained for downstream bolt-group work.
- `scripts/calc-flange-ug44.mjs`
  - direct executable CLI using SI JSON input.
- `tests/flange-ug44-core.test.mjs`
  - exact analytical pressure-equivalence fixture;
  - acceptance-equation equivalence;
  - four rounded displayed PV Elite C101 examples;
  - load-resolution and moment-transport checks;
  - fail-closed geometry check.

## Authority boundary

```text
calculationId          FLANGE.RATED_LOAD.UG44B (kernel method identity)
engineeringAuthority  NONE_PENDING_SOURCE_QUALIFICATION
screeningAuthority    NOT_AUTHORIZED
codeCompliance        false
designAuthority       false
registryIntegrated    false
UIIntegrated          false
```

The implementation follows the equation and Pmax relationship displayed in the user-supplied PV Elite report. It does not embed copyrighted Code text or claim current-code design authority.

## Source / benchmark grounding

User-supplied PV Elite C101 report identifies ASME UG-44(b), PVP2013-97814 methodology attribution, and displays the governing relationship plus example inputs/outputs. The report values are rounded, so the PV Elite regression uses a 2% relative tolerance and is explicitly classified as rounded-source cross-solver evidence rather than an exact oracle.

Exact arithmetic is instead protected by a hand-constructed SI analytical case whose expected equivalent pressure and Pmax are derived independently of the production implementation.

## Repository coordination

Current open PR landscape was inspected before mutation. No active open PR was found claiming the new flange rated-load / bolted-joint numerical domain. Existing open Engineering Calculations work is concentrated in vibration, B31.3/HP, XML/CII and unrelated support domains.

Classification: `SAFE` for new files in the flange-rated-load domain. Future edits to shared registry/UI files require a fresh overlap check.

## Backup compliance

This leg intentionally changes new files only. No existing file was edited, so the repository-required `node utils/backup.js save <file> ...` pre-edit command was not bypassed. Registry/UI integration is deferred until a native checkout can execute that backup command before touching existing shared files.

## Validation

```text
new JS/MJS physical line policy        PASS by source inspection (<300 lines)
function-size policy                    PASS by source inspection (small pure functions)
focused exact-byte reconstruction       PASS 6/6 via local Node execution
repository-native node --test           NOT_RUN / no native private-repo checkout
hosted CI                               NOT_RUN
browser                                 NOT_APPLICABLE for kernel/CLI slice
independent human engineering review    NOT_RUN
```

The 6/6 execution used reconstructed files matching the authored source in this branch; it is supporting local execution evidence, not a repository-native exact-checkout PASS.

## Highest risk

The numerical arithmetic is implemented and cross-checked, but production registration is intentionally blocked until source/code-edition qualification and backup-compliant shared-file integration are completed.

## EXACT_NEXT_ACTION

Reconcile the branch against live `main`, open a draft PR for this bounded kernel/CLI slice, then create a post-validation relay endpoint that records the exact PR/head and preserves registry/UI integration as the next leg.
