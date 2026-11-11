# WIP-ENGCALC-BOLT-REGISTRY-20260902 Work Report

CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-03
STATE: PRE_MUTATION
EXECUTION_MODE: AUTO
BASE_DEPENDENCY: PR #709 / agent/engcalc-bolt-installation-strength-20260902@0e1a50da4674e88d11ec38196e8d8d6f3680ec8d
BRANCH: agent/engcalc-bolt-registry-integration-20260902
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Expose the existing non-authorizing bolt reference kernels through the registry-driven Engineering Calculations console as one bounded central-integration contribution.

## Intended calculations

- `BOLT.PRELOAD_TORQUE.SHORT_FORM`
- `BOLT.TORQUE.DETAILED_FRICTION`
- `BOLT.STRENGTH.INSTALLATION_AXIAL_TORSION`

They will remain under the existing `FLANGE` family (`Flanges & Joints`) in this leg. Adding a new contract-level `BOLTS` family is explicitly deferred because that would broaden the shared taxonomy contract.

## Grounding

- current main observed before branch creation: `d043376eb623822c657904f707bccf199b3356b3`;
- direct dependency PR709 head: `0e1a50da4674e88d11ec38196e8d8d6f3680ec8d`;
- intended shared mutation: `converters/engineering-calculations/default-registry.js` only;
- new adapter/test files will be additive;
- no open PR was found claiming `default-registry.js` during re-grounding;
- PR709 is the intentional stacked dependency.

## Protected invariants

- preload remains the primary bolt assembly state;
- detailed torque keeps thread and bearing torque separate;
- installation torsion consumes thread torque only;
- no hidden K, friction, preload fraction, reference stress, or stress-section diameter defaults;
- no real master-data values;
- `codeCompliance=false`, `designAuthority=false`, `governingEligible=false`;
- no bolt-group array/UI integration in this scalar-console leg;
- no workflow/runtime/writer/canvas changes;
- no merge without explicit owner authorization.

## Validation plan

1. registry discovery for all three IDs;
2. central-engine execution with canonical/unit-converted inputs;
3. parity with direct kernels;
4. fail-closed invalid input tests;
5. explicit non-authority assertions;
6. preserve exact native repository execution as `NOT_RUN` unless genuinely executed.

## EXACT_NEXT_ACTION

Create the three adapter definitions as new files, create a registry integration regression, back up `default-registry.js`, then add only the three adapter imports/definitions to the active registry.
