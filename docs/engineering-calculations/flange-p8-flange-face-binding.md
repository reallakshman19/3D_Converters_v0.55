# P8 sealed flange-face binding

## Purpose

`FlangeFaceBinding.v1` is the controlled semantic handoff between a selected 3DV/RVM model entity and the qualified `Advanced_Analysis` interface/recovery source admitted by PR #743.

The binding removes repeated caller interpretation from the P8 adapter call. It does **not** infer flange-face engineering semantics from geometry.

## Qualified evidence carried by the binding

The sealed record retains:

- model, model revision, joint and component identity;
- 3DV/RVM source schema, source kind, source file, stable source reference, source path and native kind;
- an explicit `PHYSICAL_FLANGE` component role supplied by the controlled binding source;
- the pinned `Advanced_Analysis` repository and commit;
- interface-set, interface and frame semantic hashes;
- the required reporting sign convention;
- the physical flange-face reference point;
- the positive local opening direction and mating-side identity;
- provenance IDs for the binding, model entity, face point, opening direction and mating side;
- a deterministic semantic hash over the complete binding record.

The existing 3DV selection seam exposes `rvm-converter-stage/v1` records with source file, selection item identity, native kind, source path and geometric metadata. Its routing-axis fallback can derive a longest-bounding-box axis. That geometric fallback is **not** used by this binding as flange-face engineering authority.

## Required consistency checks

Before an `Advanced_Analysis` recovery is adapted, the binding must agree exactly with the supplied interface set on:

```text
interfaceSetSemanticHash
interfaceId
interfaceSemanticHash
frameSemanticHash
reportingSignConvention
referencePointGlobal
```

The wrapper then delegates force/moment processing to the already-qualified PR #743 adapter and PR #742 `JointModelContext.v1` resolver. Reference-point transport and frame rotation are therefore not reimplemented in this leg.

## What is deliberately not inferred

The implementation does not infer any of the following from `nativeKind`, a transform matrix, local/world bounding boxes, routing axes or component type:

- which physical surface is the calculation flange face;
- which local axis is the positive opening direction;
- mating-side identity;
- flange/bolt/gasket master identity or authority;
- load sign reversal;
- load-case combinations;
- Code compliance or acceptance.

A source record may contain a flange-like native kind such as `WeldNeckFlange`; this is retained as evidence only. The binding must separately and explicitly carry `componentRole = PHYSICAL_FLANGE` from a controlled project/source decision.

## Authority boundary

```text
sourceAuthority          CONTROLLED_PROJECT_SEMANTIC_BINDING_NON_AUTHORIZING
automatic3dExtraction    false
geometryInferenceUsed    false
masterBindingsResolved   false
solverInvoked            false
codeCompliance           false
canUseForDesignAuthority false
governingEligible        false
```

This leg does not qualify automatic model extraction and does not resolve governed master records.

## Validation gate

Focused test command:

```bash
node --test tests/flange-face-binding.test.mjs
```

Exact native PR-head execution must be reported separately from any source-reconstructed or connector-side evidence. A missing native run remains `NOT_RUN`.

## Next qualification boundary

The next P8 leg may qualify a producer of `FlangeFaceBinding.v1` only if it has controlled project/source evidence for the physical flange face, opening direction and mating side. Bounding-box/routing-axis heuristics alone are insufficient.

Governed master resolution and any flange/bolt/gasket solver invocation remain separate later work.
