# P8 — Advanced_Analysis interface-load adapter qualification

## Purpose

This note records the narrow P8 source boundary implemented in PR #743. It qualifies a cross-repository handoff from the controlled `linear-piping-interface-set/v1` and `linear-piping-interface-recovery/v1` contracts in `reallaksh19/Advanced_Analysis` into the explicit `JointModelContext.v1` resolver introduced by PR #742.

It does **not** qualify automatic 3D flange detection, governed flange/bolt/gasket master resolution, a flange solver, or design authority.

## Pinned source

```text
repository  reallaksh19/Advanced_Analysis
commit      eabb93cd44c59ce182d73284cb707653917e07c8
```

Relevant source surfaces at that revision:

- `src/core/linear-piping-interface/contracts.js`
- `src/core/linear-piping-interface/interface-set.js`
- `src/core/linear-piping-interface/recovery.js`
- `src/core/linear-piping-interface/public-api.js`
- `src/core/linear-fea-contract/units.js`
- `src/core/shared-primitives/canonical-json.js`

## Source contract facts

The interface definition contract carries a validated orthonormal right-handed basis, analysis node identity, source entity identity, explicit global reference point, local reference-to-node lever, reporting sign convention, source revision/hash evidence and semantic hash.

The recovery contract carries, per interface and load case:

```text
forceGlobal
momentAtNodeGlobal
forceLocal
momentAtNodeLocal
momentAtReferenceLocal
referencePointGlobal
leverReferenceToNodeLocal
frameSemanticHash
reportingSignConvention
physicalLoadCaseHash
analysisResultSemanticHash
recovery semantic/evidence hashes
```

The source recovery relation is:

```text
momentAtReferenceLocal
  = momentAtNodeLocal
  + leverReferenceToNodeLocal x forceLocal
```

where the declared lever is `node - reference`. This is statically equivalent to the P3/P8 global transport relation:

```text
M_reference = M_node + (r_node - r_reference) x F
```

The Advanced_Analysis public interface-recovery API declares SI units as:

```text
length  m
force   N
moment  N*m
```

The P8 resolver uses `N.m`; PR #743 therefore records only the notation normalization `N*m -> N.m` with identity scale factor 1. No dimensional conversion is hidden in the adapter.

## What the adapter admits

Only `NOZZLE` and `EQUIPMENT` interfaces are admitted. `SUPPORT` and `ANCHOR` are rejected by this flange-specific boundary.

The adapter requires:

- exact source repository and pinned commit identity;
- exact qualified interface-set and recovery schema shapes;
- independently recomputed interface, interface-set, recovery-result, recovery and evidence hashes;
- matching interface identities between set and each recovery;
- exact source SI units;
- exact reporting sign convention supplied by the caller; no automatic sign reversal;
- matching recovery frame hash and reference-point evidence;
- explicit caller declaration `referencePointRole = FLANGE_FACE` plus `referencePointSourceId`;
- explicit `openingDirection` plus `openingDirectionSourceId`;
- explicit non-negative `resultConsistencyTolerance`; there is no tolerance default.

The adapter then supplies the source interface basis to `JointModelContext.v1`, uses the interface basis origin as the load source point, uses the interface reference point as the flange-face target point, and feeds signed global force/moment components into the established P3 transport followed by the P8 `R^T` rotation.

As an independent consistency check, the resulting local force and transported face moment must reproduce the upstream `forceLocal` and `momentAtReferenceLocal` within the explicitly supplied tolerance.

## Explicit non-inferences

The source contract does not itself identify a `FLANGE` interface kind. Consequently this adapter does not infer that an arbitrary NOZZLE/EQUIPMENT interface reference point is a flange face and does not infer which interface basis direction is the physical opening normal. Both statements remain explicit project/source declarations with provenance IDs.

The adapter also does not:

- derive an engineering face frame from 3D bounding boxes or routing axes;
- decompose scalar force/moment resultants;
- infer or reverse load sign convention;
- infer missing load components;
- resolve flange, bolt or gasket master records;
- combine preload with operating external loads;
- invoke UG-44, bolt-group, strength, sealing or other solvers;
- register the route in the central scalar Engineering Calculations registry;
- add UI behavior.

## Authority

```text
sourceAuthority             QUALIFIED_CROSS_REPOSITORY_INTERFACE_CONTRACT_NON_AUTHORIZING
automatic3dExtraction       false
masterBindingsResolved      false
solverInvoked               false
codeCompliance              false
canUseForDesignAuthority    false
governingEligible           false
```

## Validation gate

Focused command:

```bash
node --test tests/flange-advanced-analysis-interface-adapter.test.mjs
```

Source-reconstructed exact-GitHub-blob execution may support implementation evidence, but it does not replace exact native PR-head execution or independent engineering review.

## Remaining P8 gate

Before automatic model-driven flange calculations can be claimed, a controlled handoff must bind the model/interface evidence to a specific flange face and opening direction without caller interpretation, and governed master resolution must be qualified separately. Solver invocation and UI remain later bounded legs.
