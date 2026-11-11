# P8 flange-face binding producer source qualification

## Scope

This qualification evaluates whether the repository currently contains a controlled automatic source capable of producing `FlangeFaceBinding.v1` without caller interpretation.

It does not implement a producer, resolve governed masters, invoke flange/bolt/gasket solvers, alter the Engineering Calculations registry, or add UI/reporting behavior.

The immediately preceding sealed binding contract was owner-authorized and squash-merged from PR #744 into stacked base PR #743 at `86120e4384f33fb950737e50899b38aea5be2d29`. This did not merge the stack into `main`.

## Producer admission target

A production source may be admitted only when one controlled evidence chain establishes all of the following for one model revision and one joint:

1. exact model/component identity and source revision;
2. authoritative classification of the selected entity as the physical flange used by the calculation;
3. the specific physical flange face used as the calculation reference point;
4. the positive opening direction for that face;
5. the mating-side identity for that face;
6. the engineering global-frame identity and coordinate units;
7. exact binding to the qualified `Advanced_Analysis` interface-set/interface/frame hashes and reporting sign convention;
8. provenance identifiers or hashes sufficient to detect source drift;
9. deterministic failure on ambiguous or contradictory face/topology evidence.

Geometric resemblance, component-name text, bounding-box axes, nearest-face selection, or a configurable connection tolerance are not independently sufficient engineering authority.

## Candidate source review

### 1. 3DV selection seam

`converters/xml-cii2019-core/custom-input-seljson-source.js` accepts `rvm-converter-stage/v1` selection data and retains useful source identity such as source file/reference, native kind, source path, explicit transform data and geometry.

However, its current routing representation is not a flange-face engineering contract:

- flange-like routing classification is based on source/native kind text;
- position resolution may use native start/end/center geometry or transformed local bounding-box geometry;
- the local-axis fallback chooses the longest local bounding-box dimension when an explicit local axis is absent;
- no field establishes which physical flange face is the calculation face;
- no field establishes positive opening direction or mating-side identity.

Disposition: `EVIDENCE_ONLY / NOT_ADMITTED_AS_BINDING_PRODUCER`.

### 2. RVM rows to UXML adapter

`rvm-pcf-extract/RvmRowsToUxmlAdapter.js` is explicitly topology-only. It can create UXML flange components, endpoint anchors and ports from extracted RVM/JSON rows.

Relevant limitations for P8 producer authority are:

- component type detection includes text-based `FLANGE` matching;
- EP1/EP2 points are accepted through multiple source aliases and coordinate triplets;
- created anchors are marked `ALIASED_SOURCE` confidence;
- `FLANGE_END_1` and `FLANGE_END_2` are topology roles, not declared calculation-face roles;
- no source field establishes positive opening direction or the engineering mating side;
- no source binding to an `Advanced_Analysis` interface semantic hash exists in this adapter.

Disposition: `TOPOLOGY_SOURCE / NOT_ADMITTED_AS_BINDING_PRODUCER`.

### 3. UXML face model

`uxml/UxmlFaceModelBuilder.js` converts validated UXML evidence into deterministic face records. `FLANGE` and `BLIND-FLANGE` are among the inline two-end component families. For a two-ended component it creates endpoint faces from EP1/EP2 and derives the component axis from `EP2 - EP1` when both endpoints are available.

This is useful face/topology evidence, but it still does not establish:

- which of the two flange endpoint faces is the calculation face;
- whether the positive opening normal is aligned or anti-aligned with the derived EP1-to-EP2 axis;
- which connected component is the engineering mating side;
- whether the upstream `FLANGE` classification was exact source authority or an alias/text-derived classification;
- an exact cross-system binding to the selected `Advanced_Analysis` interface/frame.

Disposition: `FACE_TOPOLOGY_EVIDENCE / NOT_ADMITTED_AS_BINDING_PRODUCER`.

### 4. UXML UniversalTopoGraph

`uxml/UxmlUniversalTopoGraphBuilder.js` builds deterministic topology evidence by grouping endpoint faces into coordinate nodes and creating endpoint-to-endpoint edges. It distinguishes exact coincidence from `WITHIN_CONNECT_TOLERANCE`; the current default connection tolerance is 6 mm.

This can identify neighboring endpoint components, but P8 cannot reinterpret geometric connectivity as engineering mating-side authority without a controlled invocation profile and source semantics. In particular:

- a nonzero configurable tolerance can create a topological connection that is not an exact physical face identity;
- connected component identity does not establish which flange face is the calculation face;
- topology does not establish the sign of the physical opening normal;
- the graph does not bind the selected port to an `Advanced_Analysis` interface/frame semantic identity.

Disposition: `CONNECTIVITY_EVIDENCE / NOT_ADMITTED_AS_BINDING_PRODUCER`.

## Qualification result

```text
3DV source/model identity retention          PASS
RVM/UXML endpoint topology availability      PASS
UXML face-record availability                PASS
UXML connectivity evidence availability      PASS
physical-flange source authority             FAIL / SOURCE_NOT_SUFFICIENT
specific calculation-face authority          FAIL / SOURCE_NOT_SUFFICIENT
positive opening-direction authority         FAIL / SOURCE_NOT_SUFFICIENT
mating-side engineering authority            FAIL / SOURCE_NOT_SUFFICIENT
cross-system AA interface binding source      FAIL / SOURCE_NOT_PRESENT
automatic FlangeFaceBinding.v1 producer       NOT_ADMITTED
```

The reviewed sources can support traceable evidence and a future producer, but they do not currently close the semantic gap required by `FlangeFaceBinding.v1`.

## Minimum controlled source needed to unblock implementation

One of the following is required before producer code is admissible:

- an upstream model/export contract that explicitly emits physical flange entity ID, calculation face/port ID, oriented opening normal, mating-side ID, global frame and source revision; or
- a controlled project binding register that explicitly records those fields and binds them to exact 3DV/UXML and `Advanced_Analysis` semantic identities.

The source must also define whether face identity requires exact coincidence or a controlled tolerance and must reject ambiguous multiple matches.

A future producer may consume UXML face/topology evidence as corroboration, but it must not elevate `BBOX_DERIVED`, `TOPOLOGY_INFERRED`, text-classified, or otherwise heuristic evidence into engineering authority by itself.

## Authority boundary

```text
sourceRole                P8_BINDING_PRODUCER_SOURCE_QUALIFICATION
producerAdmission         BLOCKED_CONTROLLED_SEMANTIC_SOURCE_MISSING
automaticBindingProducer  false
automatic3dExtraction     false
masterBindingsResolved    false
solverInvoked             false
codeCompliance            false
designAuthority           false
governingEligible         false
```

## Validation truth

This leg is source/contract inspection only. No production calculation code is changed.

```text
source seam inspection                 PASS
producer admission                     FAIL / SOURCE_NOT_SUFFICIENT
calculation implementation             NOT_RUN / NOT_ADMITTED
native PR-head execution               NOT_APPLICABLE / no executable change
browser validation                     NOT_APPLICABLE
independent engineering review         NOT_RUN
native backup command                  NOT_RUN / CONNECTOR_ONLY_ENVIRONMENT
connector pre-edit backup              EVIDENCE_ONLY
```

## Next action

Do not implement an automatic `FlangeFaceBinding.v1` producer from the presently reviewed heuristics. Obtain or define a controlled semantic source/register that explicitly supplies the physical flange face, oriented opening direction and mating side and binds those records to exact model and `Advanced_Analysis` identities. Only then implement the producer in a separate bounded PR.
