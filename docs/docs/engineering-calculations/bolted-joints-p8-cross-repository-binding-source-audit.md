# P8 cross-repository flange-face binding source audit

## Purpose

This audit extends the P8 source search beyond `3D_Converters` to connected owner repositories that expose 3D/RVM geometry, UXML/PCF topology, and `Advanced_Analysis` interface definitions. The objective is narrow: determine whether an existing controlled source can populate a real `FlangeFaceBindingSourceRecord.v1` without inventing flange-face semantics.

This is source qualification only. It does not create a binding record, infer a physical flange face, implement a producer, resolve masters, invoke solvers, or promote engineering authority.

## Pinned repositories reviewed

```text
3DV_v1.0a       main @ a469b5482529a73045d60017934431dcd13ff0ce
3D_Viewer_v2.0a main @ be65a0604c5f6f0144b80816ab446bbc049cdaf1
Advanced_Analysis main @ b4eb0cea9a7a73ddaec86210373ed6f3acb714eb
```

The P8 analysis adapter remains pinned separately to `Advanced_Analysis@eabb93cd44c59ce182d73284cb707653917e07c8`; reviewing the newer default branch here does not silently repin that dependency.

## 1. Native RVM StageModel evidence

`3DV_v1.0a` exposes an RVM evidence pipeline and emits `RvmStageModel.v1`. Its UI integration documentation explicitly characterizes the output as evidence visibility and requires:

```text
parserComplete: false
visualParityClaimed: false
```

The documentation also distinguishes RVM-binary geometry from ATT-derived schematic geometry and does not claim production rendering or parser completeness.

The native primitive decoder retains:

- native primitive code/kind;
- `transform3x4` and its 3x3 linear part;
- origin;
- local/world bounding boxes;
- decoded native parameters;
- `geometryBasis.source = rvm-native-primitive` with `confidence = native-evidence`.

For supported primitives the parameter decoder identifies limited intrinsic geometry. For example, code 8 cylinders declare `localAxis = z`; code 7 snouts expose radii, height, offsets and shear parameters.

### Engineering limitation

The transform validator establishes only a finite 12-value affine matrix. The helper separately computes column scales; it does not establish that the 3x3 part is an orthonormal right-handed rigid-body rotation. Therefore the matrix cannot be treated automatically as an engineering flange-face basis without an additional qualification step.

More importantly, decoded primitive geometry does not supply the complete P8 semantic tuple:

```text
physical flange entity
selected calculation face/port
positive opening direction
mating side
exact Advanced_Analysis interface binding
```

A cylinder local axis or primitive end plane is geometric evidence, not authority for which physical face is the calculation joint face or which sign is opening.

Qualification:

```text
native RVM source identity               PASS / EVIDENCE
native primitive transform               PASS / EVIDENCE
native primitive local-axis hints        PASS / EVIDENCE
rigid orthonormal flange-face frame      NOT_ESTABLISHED
physical calculation-face authority      NOT_ESTABLISHED
opening-direction authority              NOT_ESTABLISHED
mating-side authority                    NOT_ESTABLISHED
binding-record admission                 BLOCKED
```

## 2. ATT-managed hierarchy flange recipes

`3DV_v1.0a/stage/parser/AttManagedHierarchyToStageModel.js` builds procedural schematic geometry from exported APOS/LPOS/POS/bore/DTXR attributes. The source itself states that this geometry is a reasonable engineering schematic and **not exact native geometry**; exact geometry requires the RVM binary evidence pipeline.

For flange-like records the recipe uses the APOS-to-LPOS span and, for a non-blind flange, creates a weld-neck hub followed by a `raisedFaceDisk` toward the recipe end. This is useful to understand the visualization convention, but it is a derived rendering recipe. It is not a controlled declaration that LPOS is the project calculation face or that APOS→LPOS defines positive joint opening.

Qualification:

```text
ATT component identity                   CANDIDATE_CONTEXT
APOS/LPOS span                           EVIDENCE_ONLY
procedural raised-face recipe            EVIDENCE_ONLY
project calculation-face authority       FAIL / DERIVED_SCHEMATIC
opening-direction authority              FAIL / DERIVED_SCHEMATIC
binding-record admission                 BLOCKED
```

## 3. UXML / PCF topology evidence

The 3D repositories carry the same UXML endpoint conventions already inspected in `3D_Converters`: flange components have `FLANGE_END_1` / `FLANGE_END_2`, and topology builders can establish endpoint connectivity or route direction.

That information is useful for candidate identity and connectivity, but it remains topology. Endpoint ordering, connectivity, PCF chain direction, or proximity does not establish which flange end is the engineering calculation face, which side is the mating member, or the positive opening normal.

Qualification:

```text
flange endpoint identity                 PASS / TOPOLOGY
connectivity evidence                    PASS / TOPOLOGY
physical calculation-face authority      FAIL / TOPOLOGY_ONLY
opening-direction authority              FAIL / TOPOLOGY_ONLY
mating-side engineering authority        FAIL / TOPOLOGY_ONLY
binding-record admission                 BLOCKED
```

## 4. Advanced_Analysis source/interface evidence

Current `Advanced_Analysis` retains source ancestry and allows explicit NOZZLE/EQUIPMENT interface definitions with source entity ID, local basis, reference point, sign convention and source evidence.

The reviewed current-branch checks are simulated/fixture declarations. They demonstrate a strong controlled interface contract, but the fixture code itself supplies the interface basis/reference point/source evidence. The repository search found no `PHYSICAL_FLANGE`, selected flange-face, mating-side, or opening-direction source that cross-binds a 3D model entity to an analysis interface.

The existing P8 adapter therefore remains correctly bounded: it can consume a qualified six-DOF interface, but it cannot derive the missing physical joint semantics from `interfaceKind = NOZZLE/EQUIPMENT` or `sourceEntityId` alone.

Qualification:

```text
signed six-DOF interface contract        QUALIFIED_BY_EXISTING_P8_DEPENDENCY
source entity ancestry                   PASS / INTERFACE_CONTEXT
physical flange-face cross-binding       NOT_FOUND
opening-direction source                 NOT_FOUND
mating-side source                       NOT_FOUND
real project binding record              NOT_FOUND
```

## Combined admission result

No reviewed connected repository currently provides a complete controlled source suitable for admission as a real `FlangeFaceBindingSourceRecord.v1`.

```text
3DV native geometry                      EVIDENCE_ONLY
ATT flange recipe                        EVIDENCE_ONLY
UXML / PCF topology                      EVIDENCE_ONLY
Advanced_Analysis interface              QUALIFIED_LOAD/FRAME_CONTEXT_ONLY
real controlled cross-system record      NOT_FOUND
automatic FlangeFaceBinding.v1 producer  NOT_ADMITTED
```

The blocker is semantic custody, not absence of geometry or load data.

## Required controlled source

The next admissible source must explicitly and versionably declare, for one real project joint:

- exact 3D model ID and revision;
- exact physical flange model entity;
- selected calculation face/port identity;
- physical flange-face point in the declared global frame;
- positive opening direction;
- mating-side identity;
- exact global frame and units;
- exact `Advanced_Analysis` interface-set/interface/frame/sign identities;
- provenance IDs for each declaration;
- explicit position/orientation tolerances and their source;
- unambiguous single-candidate disposition;
- independent engineering review.

Until such a source exists, no geometry-derived, topology-derived, text-derived or fixture-derived record is to be promoted to project-controlled status.

## Validation truth

```text
3DV main grounding                       PASS
3D_Viewer_v2.0a main grounding           PASS
Advanced_Analysis main grounding         PASS
native RVM decoder inspection            PASS
ATT flange-recipe inspection             PASS
UXML/PCF topology search                  PASS
Advanced_Analysis binding-source search  PASS
real controlled binding source found     FAIL / NOT_FOUND
calculation code changed                 NOT_APPLICABLE
native numerical execution               NOT_APPLICABLE
independent engineering review           NOT_RUN
```

## Authority boundary

```text
sourceRole                P8_CROSS_REPOSITORY_SOURCE_AUDIT
sourceAuthority           EVIDENCE_ONLY
producerAdmission         BLOCKED_REAL_CONTROLLED_RECORD_MISSING
automaticBindingProducer  false
automatic3dExtraction     false
masterBindingsResolved    false
solverInvoked             false
codeCompliance            false
designAuthority           false
governingEligible         false
```
