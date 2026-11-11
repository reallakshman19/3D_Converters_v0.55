# P8 explicit joint model context

## Scope

`JointModelContext.v1` is the first production-facing transformation boundary for the bolted-joint/flange P8 programme. It accepts only explicit caller-supplied engineering context and does not perform automatic model extraction, master lookup or solver execution.

Implementation:

`converters/engineering-calculations/flange/joint-model-context.js`

Method identity:

`FLANGE.MODEL_CONTEXT.EXPLICIT_FACE_RESULTANT`

## Required identity and geometry

The caller supplies:

- model identity and revision identity;
- joint and component identity;
- a declared global Cartesian frame;
- flange-face reference point in metres;
- a distinct local flange-face frame whose X/Y/Z axes are expressed in the global frame;
- explicit positive opening direction (`POSITIVE_LOCAL_X`, `POSITIVE_LOCAL_Y` or `POSITIVE_LOCAL_Z`);
- explicit mating-side identity.

The local axes must be finite unit vectors, mutually orthogonal and right handed with `X × Y = Z`. Bounding-box or longest-axis inference is not accepted by this resolver.

## Load contract

Each load case supplies:

- unique case identity;
- source/provenance identity;
- source frame identity equal to the declared global frame;
- source reference point in metres;
- signed `Fx/Fy/Fz` in N;
- signed `Mx/My/Mz` in N.m.

Only exact canonical SI units are accepted in this slice:

```text
length = m
force  = N
moment = N.m
```

No implicit unit conversion is performed.

## Mechanics

The P3 resultant transport implementation is reconciled byte-for-byte from PR #732:

```text
M_face_global = M_source_global + (r_source - r_face) × F_global
```

The local flange-face result is then obtained by projection onto the declared orthonormal basis:

```text
F_local      = R^T F_global
M_face_local = R^T M_face_global
```

Reference-point transport is therefore performed once before frame rotation.

The resolver reports, without invoking a flange method:

- signed opening-axis force;
- positive opening force;
- closing force;
- transverse shear resultant;
- in-plane bending moment resultant;
- signed torsional moment.

This preserves shear and torsion as traceable quantities rather than silently feeding them into methods that do not consume them.

## Master-binding boundary

Exact flange, bolt and gasket master record IDs are mandatory metadata so downstream integration cannot lose intended custody. This resolver does not query or validate those stores.

```text
resolutionState        IDENTITY_ONLY_NOT_RESOLVED
masterBindingsResolved false
```

## Authority

```text
sourceAuthority          EXPLICIT_CALLER_SUPPLIED_CONTEXT_ONLY
automaticModelRoute      false
solverInvoked            false
codeCompliance           false
canUseForDesignAuthority false
governingEligible        false
```

The function is deliberately not added to the scalar Engineering Calculations registry or UI.

## Validation

Exact GitHub blob identities used for supporting execution:

```text
P3 transport  3707a1cb3278eb67637c404a85b2012e50b4f481
P8 resolver   70b2978ea703c2498edb685f7256402cb890cb50
P8 test       964969d302e5e68af78a6f8f04d196d460c98078
```

Supporting exact-blob reconstructed execution: `12/12 PASS`.

Exact native PR-head execution remains `NOT_RUN / ENVIRONMENT_BLOCKED` until observed.

## Remaining automatic-integration gate

A later automatic source adapter must provide, without inference:

1. controlled flange-face engineering-frame provenance;
2. signed six-component force/moment resultants;
3. units;
4. load-case identity;
5. source reference point;
6. model/component provenance.

Scalar `RESULTANTF` / `RESULTANTM` values and geometry-derived routing axes are insufficient and must not be decomposed or promoted into this contract.
