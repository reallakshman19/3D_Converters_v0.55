# P8 controlled flange-face binding source register

## Purpose

`FlangeFaceBindingSourceRegister.v1` defines the controlled project-source contract required by EP-0034 before any automatic `FlangeFaceBinding.v1` producer can be admitted.

This layer is **source custody only**. It does not infer a flange face from geometry, create a `FlangeFaceBinding.v1`, resolve master data, invoke a flange/bolt/gasket solver, or authorize engineering acceptance.

## Why this contract exists

The current repository can retain 3DV/RVM model identity, derive UXML endpoint/face topology and recover signed six-DOF loads from the pinned `Advanced_Analysis` interface contract. Those seams do not, by themselves, establish the physical calculation face, positive opening direction, mating side or exact cross-system binding.

The source register therefore requires those semantics to be supplied explicitly by a controlled project source rather than inferred from:

- bounding-box or routing-axis heuristics;
- flange-name/text classification;
- aliased EP1/EP2 endpoints;
- topology proximity or connection tolerance;
- interface kind alone.

## Record contract

Each `FlangeFaceBindingSourceRecord.v1` record carries the following controlled identities.

### Record control

- `recordId`
- `recordRevisionId`
- `recordState`: `DRAFT`, `PROJECT_CONTROLLED`, `INDEPENDENTLY_CHECKED` or `RETIRED`
- `projectId`
- deterministic `semanticHash`

The semantic hash uses the same strict canonical JSON / FNV-1a 64-bit helper already pinned for the `Advanced_Analysis` adapter. A stale non-empty hash is rejected.

### Model identity

The model block requires:

- `modelId`
- `modelRevisionId`
- `globalFrameId`
- `lengthUnit = m`
- `sourceSchema = rvm-converter-stage/v1`
- source kind/file/ref/path/native-kind identity
- `componentRole = PHYSICAL_FLANGE`

`nativeKind` is retained as evidence only. It cannot substitute for the explicit physical-flange role.

### Joint and physical face identity

The joint block requires explicit:

- `jointId`
- `componentId`
- `selectedFaceId`
- `selectedPortId`
- `matingSideId`

The geometry block requires:

- `referencePointGlobalM = {x,y,z}`
- one positive opening direction: `POSITIVE_LOCAL_X`, `POSITIVE_LOCAL_Y` or `POSITIVE_LOCAL_Z`

No endpoint or axis is selected automatically.

### Analysis-interface identity

The analysis block is pinned to:

```text
repository  reallaksh19/Advanced_Analysis
commit      eabb93cd44c59ce182d73284cb707653917e07c8
```

and requires exact:

- interface-set semantic hash;
- interface ID;
- interface semantic hash;
- frame semantic hash;
- reporting sign convention.

A later producer must still compare these declarations against the actual supplied interface set before constructing a `FlangeFaceBinding.v1`.

### Source provenance

Each record requires explicit source IDs for:

- binding record;
- model entity;
- calculation face;
- opening direction;
- mating side;
- global frame;
- analysis interface.

This prevents an otherwise complete-looking record from becoming anonymous project data.

### Ambiguity and tolerance policy

The v1 contract is fail-closed:

```text
identityPolicy        EXACT_IDENTIFIERS_ONLY
ambiguityDisposition UNAMBIGUOUS_REQUIRED
candidateCount        1
```

Position and orientation tolerances are mandatory explicit inputs in metres and radians respectively. There are no hidden defaults. A `toleranceSourceId` is also required.

The custody layer stores and validates these values; it does not use them to geometrically infer or select a flange face.

## Register authority boundary

Every register created by the helper is fixed to:

```text
sourceAuthority          PROJECT_SOURCE_CUSTODY_ONLY
automaticBindingProducer false
codeCompliance           false
designAuthority          false
governingEligible        false
```

This contract does not elevate `PROJECT_CONTROLLED` or `INDEPENDENTLY_CHECKED` records to design authority. Those states describe project-source control only.

## Current programme state

The contract now exists, but no real project `FlangeFaceBindingSourceRecord.v1` has been admitted by this leg. Therefore automatic production of `FlangeFaceBinding.v1` remains blocked.

A later production leg may proceed only after a real controlled source record exists and is independently reviewed. That producer must independently verify the record semantic hash and all model/interface/frame/reference-point identities against the actual source objects before returning a binding.

## Focused validation gate

```bash
node --test tests/flange-face-binding-source-register.test.mjs
```

In the current connector-only environment, exact native PR-head execution remains `NOT_RUN / ENVIRONMENT_BLOCKED` unless a workflow or exact checkout becomes available.
