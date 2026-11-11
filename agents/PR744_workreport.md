# PR744 work report — P8 sealed flange-face binding

## Assignment

Advance issue #721 P8 by replacing repeated per-call flange-face/opening declarations with a sealed, source-traceable semantic binding between one 3DV/RVM model entity and the qualified `Advanced_Analysis` interface/recovery source from PR #743.

This assignment is deliberately limited to the binding contract and wrapper. It does not qualify an automatic binding producer, resolve governed master data, invoke solvers, register a calculation, or change UI/reporting.

## Grounding

```text
main                     78b361d1f649d41378f568ebe1a237c4bc140c73
base PR                  #743
base head                92e016146a63f926449ecad525ee549d6495f336
material head            53d1d1b9054105e1ab3ee51f593cee129ab9a449
branch                    feat/engcalc-p8-flange-face-binding-20260905
Advanced_Analysis source eabb93cd44c59ce182d73284cb707653917e07c8
```

At grounding, PR #743 was open, draft, mergeable and unmerged. Its exact native focused test remained `NOT_RUN / ENVIRONMENT_BLOCKED`. No earlier validation state is promoted by this work.

## Delivered production code

`converters/engineering-calculations/flange/flange-face-binding.js`

Git blob:

```text
fe90af2b3e9157ca138a019185dccc5df5b2ad9f
```

Physical source length from the creating commit: **217 lines**, below the repository's 300-line production-JS limit.

Named exports:

```text
FLANGE_FACE_BINDING_SCHEMA
FLANGE_FACE_BINDING_METHOD
FLANGE_FACE_BINDING_SOURCE_AUTHORITY
sealFlangeFaceBinding
adaptBoundAdvancedAnalysisFlangeToJointModelContext
```

The module seals `FlangeFaceBinding.v1`, retaining model/joint/component identity, exact 3DV/RVM source identity, pinned analysis-interface hashes, the physical flange-face point, positive local opening direction, mating side, and source/provenance IDs.

The model entity must explicitly declare `componentRole = PHYSICAL_FLANGE`. `nativeKind` is retained only as evidence and is not used to infer that role.

Before delegation to the PR #743 adapter, the wrapper requires exact equality for:

```text
interfaceSetSemanticHash
interfaceId
interfaceSemanticHash
frameSemanticHash
reportingSignConvention
referencePointGlobal
```

No reference-point transport or frame-rotation equation is duplicated in this leg.

## Focused tests

`tests/flange-face-binding.test.mjs`

Git blob:

```text
7c1e99ba2a7863ccdc77f7aebb96c15550233b05
```

The suite covers:

- deterministic binding sealing/hash custody;
- bounded adapter handoff without separate face/opening parameters;
- retained 3DV entity identity;
- stale binding-hash rejection;
- wrong source-schema rejection;
- explicit `PHYSICAL_FLANGE` requirement;
- interface-set hash mismatch rejection;
- interface hash mismatch rejection;
- frame hash mismatch rejection;
- flange-face point mismatch rejection;
- reporting-sign mismatch rejection;
- anonymous source-reference rejection;
- non-authorizing output flags.

Execution status is intentionally not overstated:

```text
source blob custody       PASS
test blob custody         PASS
focused suite             NOT_RUN / ENVIRONMENT_BLOCKED
exact native PR-head      NOT_RUN / ENVIRONMENT_BLOCKED
independent review        NOT_RUN
```

Exact gate:

```bash
node --test tests/flange-face-binding.test.mjs
```

## 3DV source boundary

The current `rvm-converter-stage/v1` selection seam exposes source file, item/reference identity, native kind, source path and geometry metadata. It also contains a longest-local-bounding-box-axis fallback for routing purposes.

That fallback is not accepted here as engineering flange-face authority. The binding carries an explicit controlled decision for physical flange role, face point, opening direction and mating side. Automatic production of that binding remains unresolved.

## Authority boundary

```text
sourceAuthority          CONTROLLED_PROJECT_SEMANTIC_BINDING_NON_AUTHORIZING
automatic3dExtraction    false
geometryInferenceUsed    false
automaticBindingProducer false
masterBindingsResolved   false
solverInvoked            false
codeCompliance           false
canUseForDesignAuthority false
governingEligible        false
```

## Backup truth

Before `agents/agentchain.md` is modified, its connector-visible pre-EP0033 content is retained at:

`.backups/connector-20260905-p8-face-binding/agents_agentchain_before_ep0033.md.bak`

Native `node utils/backup.js save ...` execution remains `NOT_RUN / CONNECTOR_ONLY_ENVIRONMENT`. The connector copy is evidence only and is not classified as policy-equivalent backup execution.

## Remaining blockers

1. exact native PR #744 focused test execution;
2. independent engineering review;
3. controlled qualification of a producer for `FlangeFaceBinding.v1` if automatic integration is desired;
4. governed flange/bolt/gasket master resolution;
5. later solver invocation and acceptance/reporting integration.

No merge authority is granted by this report.
