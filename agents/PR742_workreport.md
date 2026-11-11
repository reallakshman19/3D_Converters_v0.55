# PR742 workreport — P8 explicit joint-face resolver

## Assignment

Implement the smallest P8 production slice admitted by PR #741: a pure fail-closed resolver/transform layer for explicit engineering flange-face context and signed six-DOF loads. Do not add automatic model extraction, master resolution, solver invocation, registry integration or UI.

## Grounding

```text
repository  reallaksh19/3D_Converters
main        78b361d1f649d41378f568ebe1a237c4bc140c73
base PR     #741
base head   fd2bb9f9391a3c44868098ee4564f356ec32a7b0
branch      feat/engcalc-p8-explicit-joint-face-resolver-20260905
PR          #742
mode        AUTO
```

PR #740 was owner-authorized and squash-merged only into stacked PR #739. None of this stack is on `main`.

## P3 dependency reconciliation

The common rigid-body resultant transport is not reimplemented. This branch copies the exact PR #732 file:

`converters/engineering-calculations/mechanics/load-resultant.js`

Blob identity:

```text
PR732 blob   3707a1cb3278eb67637c404a85b2012e50b4f481
PR742 blob   3707a1cb3278eb67637c404a85b2012e50b4f481
identity     PASS
```

Relationship preserved:

`M_target = M_source + (r_source - r_target) x F`

## Material implementation

New file:

`converters/engineering-calculations/flange/joint-model-context.js`

Exports:

```text
JOINT_MODEL_CONTEXT_SCHEMA = JointModelContext.v1
EXPLICIT_JOINT_FACE_RESOLVER_METHOD = FLANGE.MODEL_CONTEXT.EXPLICIT_FACE_RESULTANT
resolveExplicitJointModelContext()
```

The resolver requires:

- model, revision, joint and component identity;
- explicit global frame identity;
- flange-face reference point in metres;
- distinct local face frame with X/Y/Z axes expressed in global coordinates;
- unit-length, mutually orthogonal, right-handed axes;
- explicit positive opening direction;
- mating-side identity;
- unique load-case identity and source identity;
- signed `Fx/Fy/Fz/Mx/My/Mz` in the declared global frame;
- explicit source reference point;
- exact SI units `m`, `N`, `N.m`;
- explicit flange, bolt and gasket master record IDs.

Per load case, the resolver:

1. transports the resultant from the supplied source point to the flange face with the reconciled P3 primitive;
2. projects force and moment onto the declared local basis (`R^T`);
3. retains signed local force and moment components;
4. reports positive opening force and closing force separately;
5. reports transverse shear resultant, in-plane bending resultant and signed torsion.

No scalar force or moment resultant can be decomposed into six components by this API.

## Master-data boundary

The three master record IDs are provenance/custody metadata only:

```text
resolutionState        IDENTITY_ONLY_NOT_RESOLVED
masterBindingsResolved false
```

The resolver does not query stores, evaluate maturity, interpolate values or grant authority.

## Authority boundary

```text
sourceAuthority          EXPLICIT_CALLER_SUPPLIED_CONTEXT_ONLY
automaticModelRoute      false
solverInvoked            false
codeCompliance           false
canUseForDesignAuthority false
governingEligible        false
centralRegistry           NOT_REGISTERED
UI                        NOT_MODIFIED
```

## Focused regression

New test:

`tests/flange-joint-model-context.test.mjs`

Coverage:

- identity-frame transformation;
- one-time reference-point moment transport;
- nontrivial right-handed frame rotation;
- explicit non-Z opening axis;
- opening versus closing force separation;
- non-unit and non-orthogonal frame rejection;
- left-handed frame rejection;
- source-frame mismatch rejection;
- exact SI-unit requirement;
- duplicate case rejection;
- unresolved master-binding semantics;
- non-authorizing/no-solver flags.

## Validation truth

Exact GitHub blob bytes were matched before supporting local execution under Node:

```text
P3 transport blob  3707a1cb3278eb67637c404a85b2012e50b4f481
resolver blob      70b2978ea703c2498edb685f7256402cb890cb50
test blob          964969d302e5e68af78a6f8f04d196d460c98078
focused tests      12
pass               12
fail                0
classification     PASS / SOURCE_RECONSTRUCTED_EXACT_GITHUB_BLOBS
```

Physical lines:

```text
joint-model-context.js  208 < 300
```

Exact native PR-head checkout execution remains:

`NOT_RUN / ENVIRONMENT_BLOCKED`

Exact native gate:

```bash
node --test tests/flange-joint-model-context.test.mjs
```

Independent engineering review remains `NOT_RUN`.

## Backup truth

Before mutating `agents/agentchain.md`, its exact connector-visible content was committed to:

`.backups/connector-20260905-p8-resolver/agents_agentchain_before_ep0031.md.bak`

This is connector evidence only. Native repository backup execution with `node utils/backup.js save ...` remains `NOT_RUN / CONNECTOR_ONLY_ENVIRONMENT` and is not represented as PASS.

## Remaining P8 blockers

The explicit resolver closes only the transformation contract. Automatic integration is still blocked because the inspected model/result routes do not yet provide a qualified combination of:

- engineering flange-face frame provenance;
- signed six-component load resultants;
- units;
- case identity;
- load reference point;
- model/component provenance.

Do not infer the face frame from a bounding box or routing axis. Do not decompose scalar `RESULTANTF` / `RESULTANTM` values. Do not resolve governed masters or invoke a flange/bolt solver in the same source-adapter slice.

## Next action

Run the exact native focused test on PR #742. If it passes and a concrete controlled source route can satisfy the full explicit contract, qualify that single adapter as the next P8 slice. Otherwise preserve the current block.

## Merge

Draft. `MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED`.
