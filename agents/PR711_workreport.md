# PR711 Work Report

CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-03
PR: 711
BRANCH: agent/engcalc-bolt-registry-integration-20260902
STACKED_BASE: agent/engcalc-bolt-installation-strength-20260902
BASE_DEPENDENCY_HEAD: 0e1a50da4674e88d11ec38196e8d8d6f3680ec8d
MATERIAL_HEAD: e3c38ab22409db2e5afbda76f8948cbe6001d31b
LATEST_ENDPOINT: EP-0017
STATE: BLOCKED_AUTO
EXECUTION_MODE: AUTO
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_MISSION
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Expose the existing short-form torque, detailed-friction torque, and installation combined-stress reference kernels through the existing registry-driven Engineering Calculations console, without changing equations, master-data authority, the contract family taxonomy, or UI/runtime ownership.

## Delivered capability

Registered calculation IDs:

```text
BOLT.PRELOAD_TORQUE.SHORT_FORM
BOLT.TORQUE.DETAILED_FRICTION
BOLT.STRENGTH.INSTALLATION_AXIAL_TORSION
```

All three definitions use the existing `FLANGE` family / `Flanges & Joints` catalogue.

### Short-form adapter

Inputs: explicit tensile area, reference stress, preload fraction, nominal diameter, Kmin/Knom/Kmax.

Outputs: target preload, target stress, torque range, tensile stress and reference-stress utilization.

### Detailed-friction adapter

Inputs: explicit preload, nominal/pitch diameter, lead, thread half-angle, thread friction, bearing friction and bearing friction radius.

Outputs: pitch/thread/bearing/total torque, thread friction/coupling torque, denominator and derived effective K.

### Installation-strength adapter

Inputs: preload, tensile area, **thread torque**, stress-section diameter and reference stress.

Outputs: axial stress, torsional shear, von-Mises stress and utilization.

## Authority boundary

```text
method qualification         = IMPLEMENTED
data qualification           = BENCHMARK_ONLY
codeCompliance               = false
designAuthority              = false
governingEligible            = false
real master data             = UNRESOLVED
new contract family          = false
new UI framework             = false
bolt-group central UI        = NOT_INCLUDED
```

## Shared-file custody

Only one existing runtime file is changed:

`converters/engineering-calculations/default-registry.js`

Its pre-edit bytes are preserved in:

`.backups/5_converters_engineering-calculations_default-registry_js.bak`

The backup is an exact connector-reconstructed copy; native `node utils/backup.js save ...` execution is not claimed.

## Validation truth

```text
open-PR overlap grounding                          PASS / SOURCE_INSPECTION
registry contract/family compatibility             PASS / SOURCE_INSPECTION
unit quantity support                              PASS / SOURCE_INSPECTION
pending-ID collision check                         PASS / SOURCE_INSPECTION
independent analytical fixture recomputation       PASS / INDEPENDENT_ANALYTICAL_RECALC
central registry regression source                 COMMITTED
exact native central registry regression           NOT_RUN / ENVIRONMENT_BLOCKED
hosted PR711 workflow                              NOT_RUN / zero run observed at material checkpoint
browser console acceptance                         NOT_RUN
independent engineering review                     NOT_RUN
```

No adapter result is represented as project approval, Code compliance, or design authority.

## Changed-file intent

Engineering/runtime:

- `converters/engineering-calculations/adapters/bolt-short-form.js`
- `converters/engineering-calculations/adapters/bolt-detailed-friction.js`
- `converters/engineering-calculations/adapters/bolt-installation-strength.js`
- `converters/engineering-calculations/default-registry.js`

Validation:

- `tests/bolt-engineering-calculations-registry.test.mjs`

Delivery/recovery:

- `agents/WIP-ENGCALC-BOLT-REGISTRY-20260902_workreport.md`
- `agents/PR711_workreport.md`
- `agents/agentchain/ENGCALC-BOLTED-JOINTS/EP-0017.md`
- `agents/status/PR711.yaml`
- `agents/claims/PR711.yaml`
- `agents/agentchain.md`
- `.backups/*` and `.backups/log.json`

## Highest risks

1. PR711 is stacked on unmerged PR709 and must not be treated as a standalone main merge.
2. The committed central registry test has not executed in an exact native checkout.
3. Browser presentation/execution of the three new registry entries is not yet proven.
4. Real material/thread/friction/reference-stress master authority remains unresolved.

## EXACT_NEXT_ACTION

Run on an exact checkout of the stacked PR711 head:

```bash
node --test \
  tests/bolt-installation-strength.test.mjs \
  tests/bolt-installation-strength-detailed-torque.test.mjs \
  tests/bolt-engineering-calculations-registry.test.mjs
```

If PASS, wait for explicit owner disposition of PR709. After PR709 lands, re-ground PR711 onto resulting `main`, preserve the same narrow registry scope, repeat the focused tests, then perform browser console acceptance. Do not merge PR711 without separate explicit owner authorization.
