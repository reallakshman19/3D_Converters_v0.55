# P8 3D joint integration — source and contract qualification

## Status

```text
programme          ENGCALC-BOLTED-JOINTS / issue #721
leg                P8 / 3D model integration
state              CONTRACT_QUALIFIED / IMPLEMENTATION_BLOCKED
codeCompliance     false
designAuthority    false
governingEligible  false
```

This note qualifies the current repository seams that may feed bolted-joint/flange calculations. It does not add a model resolver, load transform, master lookup, solver invocation, UI path, or authority promotion.

## Grounding

The P8 target remains:

```text
3D extraction
  -> local coordinate transformation
  -> flange-face load resolution
  -> governed master lookup
  -> selected qualified method(s)
  -> flange / bolt / gasket solvers
  -> load-case envelope
  -> traceable result/report
```

Earlier exact-native validation obligations remain open. P3 bolt-group productization is also still a separate open PR (#732), not an ancestor of this P8 stack. Therefore this leg defines the contract without importing or duplicating P3 mechanics.

## Repository surfaces inspected

### 1. 3DV Conv JSON selection path

`converters/xml-cii2019-core/custom-input-seljson-source.js` already accepts `rvm-converter-stage/v1` or the 3DV viewer selection wrapper. The source can carry:

- model/source kind and units;
- selected item identity and source reference;
- source/semantic parent path;
- native/render kind and attributes;
- explicit `transform3x4` / `matrix3x4` data;
- local and world bounding boxes;
- explicit native start/end/center geometry when present.

The adapter also recognizes flange-like native kinds as `FLAN`.

This is useful model-context evidence, but its current axis extraction is a routing convenience, not a qualified flange-face frame. When no explicit local axis exists it can infer an axis from the longest local bounding-box dimension. That fallback is unacceptable for P8 engineering load transformation because it does not prove:

- which flange face is the calculation face;
- the positive face normal/opening direction;
- circumferential X/Y orientation;
- orthonormality/right-handedness of the engineering frame;
- mating-side identity.

**P8 rule:** bounding-box-derived orientation may support visualization/routing only. It cannot define an engineering load frame.

### 2. Canonical InputXML component contracts

`contracts/inputxml/v1/catalogs/inputxml-component-contract-catalog.json` contains explicit `FLANGE` and `FORCESMOMENTS` families.

The flange contract requires an explicit flange source record, two face nodes, thickness/weight/diameter and deterministic ownership, but is currently `UNSUPPORTED_BLOCKING` for the CII projection route.

The `FORCESMOMENTS` family is also `UNSUPPORTED_BLOCKING` until its field contract is verified.

`contracts/inputxml/v1/inventory/inputxml-field-occurrence.csv` independently records `DISPLACEMENTS|FORCESMOMENTS|UNIFORM|WIND|OFFSETS|EXPANSION_JOINT|REDUCER|FLANGES` as `NOT_PARSED` in the current CII-authority path, with active data required to block rather than silently disappear.

**P8 rule:** InputXML `FORCESMOMENTS` must not be treated as an available six-DOF joint-load source today.

### 3. Native CAESAR II ACCDB/MDB parser

`parser/accdb-mdb.js` already discovers force and moment units and preserves load-case identity for some CAESAR output tables. Its current restraint-summary projection stores `RESULTANTF` and `RESULTANTM` magnitudes with case identity.

Those scalar resultants are insufficient for flange/joint P8 because the engineering contract requires signed components:

```text
Fx, Fy, Fz, Mx, My, Mz
```

at a declared reference point and in a declared source frame.

**P8 rule:** scalar force/moment resultants may be displayed as evidence but cannot be decomposed or back-calculated into six-DOF components.

## Canonical P8 joint-context contract

A future implementation should consume a structure equivalent to:

```text
JointModelContext.v1
  jointId
  modelSource
    sourceId
    sourceRevision/hash
    sourceUnits
  modelIdentity
    componentRef
    componentPath
    nativeKind
    matingSideId
  flangeFace
    pointGlobalM = {x,y,z}
    frameId
    axesGlobal
      x = unit vector
      y = unit vector
      z = unit vector
    openingAxis = +z or -z, explicit
    basisSource
  loadCases[]
    caseId
    sourceLoadId
    sourceFrameId
    sourcePointGlobalM
    forceGlobalN = {x,y,z}
    momentGlobalNm = {x,y,z}
  masterBindings
    flangeMasterRecordId
    boltMasterRecordId(s)
    gasketMasterRecordId
```

All identity, axes, reference points, units and load-case provenance are mandatory for an engineering calculation route. Empty, ambiguous, inferred-nearest or silently defaulted identity is a hard failure.

## Required load transformation

For a global/source resultant at point `r_s` and the selected flange face point `r_f`:

```text
M_face_global = M_source_global + (r_s - r_f) x F_global
```

For an orthonormal matrix `R = [x_local y_local z_local]` whose columns are the local basis vectors expressed globally:

```text
F_local      = R^T F_global
M_face_local = R^T M_face_global
```

The implementation must verify basis finiteness, unit length, mutual orthogonality and right-handedness. It must not normalize a materially invalid basis into apparent validity without reporting the source defect.

Reference-point transport occurs exactly once. A load source already reported at the flange face must declare that point explicitly; no heuristic zero-offset assumption is allowed.

## UG-44 consumption boundary

After the load is resolved in the qualified local flange frame:

- the declared opening-direction axial component is the only axial-force term supplied to the UG-44 reference method;
- local in-plane bending components form the bending resultant required by that method;
- torsion and transverse shear remain separate components for methods that consume them;
- the load-case ID and original source resultant remain attached to every derived quantity.

No generic absolute-value operation may erase opening/closing direction before method-specific sign treatment.

## Model identity to master identity

3D geometric recognition does not grant master-data authority.

A flange-like object may identify a candidate component, but governed flange/bolt/gasket master binding requires explicit project identity sufficient for exact-match lookup. Size/class/type/material/gasket/bolting identity must not be inferred from bounding-box diameter alone.

Ambiguous or incomplete identity returns a blocked binding state rather than nearest-size/class selection.

## P8 admission matrix

| Capability | Current evidence | P8 admission |
|---|---|---|
| selected model item identity/path | present in 3DV selection path | `CANDIDATE_CONTEXT` |
| explicit model transform matrix | supported by 3DV selection path | `CANDIDATE_CONTEXT` |
| bbox-derived local axis | routing convenience | `NOT_ENGINEERING_FRAME` |
| explicit qualified flange-face frame | not established | `BLOCKED` |
| InputXML six-DOF forces/moments | field family exists but is unverified/not parsed | `BLOCKED` |
| ACCDB support resultant magnitude | present for some output restraint rows | `EVIDENCE_ONLY` |
| ACCDB signed six-component joint load | not established in inspected parser path | `BLOCKED` |
| governed model-to-master binding | not implemented | `BLOCKED` |
| P3 reference-point mechanics | exists in separate PR #732 | `DEPENDENCY_NOT_IN_STACK` |
| automatic model-to-solver execution | not implemented | `BLOCKED` |

## Exact next implementation slice

The next production P8 slice is admitted only when its dependency relation is explicit. It should be a pure resolver/transform layer, not UI code, and should:

1. accept an explicit, verified flange-face frame and explicit six-DOF load cases;
2. validate frame orthonormality/right-handedness and source/reference-point identity;
3. preserve model and load provenance;
4. transform force/moment vectors and transport moments exactly once;
5. output canonical local joint load cases without invoking flange/bolt/gasket solvers;
6. remain non-authorizing and fail closed on ambiguous model/master identity.

Do not duplicate the P3 moment-transport function. The P8 implementation should consume the landed/rebased common mechanics module once that dependency is available.

## Blockers before full P8 automation

- land/reconcile the common P3 resultant-transport contract into the P8 ancestry, or provide an explicitly reviewed equivalent dependency;
- define a qualified flange-face frame source from the 3D/model pipeline;
- define a qualified six-DOF analysis-result source with signed components, units, case identity and reference point;
- define controlled mapping from model identity to exact-match flange/bolt/gasket master identities;
- obtain executable validation and independent engineering review before any authority promotion.

No UI/reporting work should precede the stable P8 data contract.