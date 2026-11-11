# PR745 work report — P8 binding producer source qualification

## Assignment

Qualify the current repository seams for a future automatic `FlangeFaceBinding.v1` producer after owner-authorized PR #744 was squash-merged into stacked base PR #743.

This assignment is source/contract qualification only.

## Grounding

```text
main                                 78b361d1f649d41378f568ebe1a237c4bc140c73
base PR                              #743
base head after owner merge          86120e4384f33fb950737e50899b38aea5be2d29
owner-authorized predecessor PR      #744
#744 squash merge                    86120e4384f33fb950737e50899b38aea5be2d29
material qualification head          9a9c69f3fe55c581f57e1aadc075289b40327914
```

The predecessor merge changed the stacked base branch only. `main` remained unchanged.

## Sources inspected

### 3DV selection conversion

`converters/xml-cii2019-core/custom-input-seljson-source.js`

Useful evidence:

- `rvm-converter-stage/v1` intake;
- source file/reference/native kind/path retention;
- explicit transform and native geometry support.

Blocking limits:

- flange-like route classification is source/native-kind based;
- local-axis fallback may choose the longest local bounding-box dimension;
- no authoritative calculation face, opening direction or mating-side semantic.

### RVM rows to UXML

`rvm-pcf-extract/RvmRowsToUxmlAdapter.js`

Useful evidence:

- topology-only conversion from existing RVM/JSON extracted rows;
- FLANGE endpoint anchor/port roles;
- EP1/EP2 coordinate retention.

Blocking limits:

- component-type detection uses textual source fields;
- EP1/EP2 accept multiple aliases/triplets;
- produced anchors are `ALIASED_SOURCE` confidence;
- no calculation-face/opening-direction/mating-side authority;
- no exact `Advanced_Analysis` semantic binding.

### UXML face model

`uxml/UxmlFaceModelBuilder.js`

Useful evidence:

- validates UXML before building the face model;
- FLANGE/BLIND-FLANGE are supported two-ended families;
- deterministic endpoint face records;
- component axis can be derived from `EP2 - EP1`.

Blocking limits:

- two endpoint faces remain symmetric engineering candidates;
- axis direction does not determine the positive opening normal;
- no engineering mating-side designation;
- source classification authority is inherited, not upgraded.

### UXML UniversalTopoGraph

`uxml/UxmlUniversalTopoGraphBuilder.js`

Useful evidence:

- deterministic endpoint grouping and edge generation;
- exact coincidence distinguished from `WITHIN_CONNECT_TOLERANCE`;
- disconnected required faces are reported.

Blocking limits:

- default connection tolerance is 6 mm and is configurable;
- geometric connectivity is not engineering mating-side authority;
- no cross-system `Advanced_Analysis` interface binding.

## Admission result

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

No current source is promoted to producer authority.

## Validation truth

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

The exact pre-edit connector-visible `agents/agentchain.md` was retained at:

`.backups/connector-20260905-p8-binding-producer-qualification/agents_agentchain_before_ep0034.md.bak`

This is evidence only and is not classified as policy-equivalent native backup execution.

## Hard stop

Do not implement an automatic producer from current bbox/text/alias/topology inference. Obtain or define a controlled upstream export or project binding register that explicitly supplies:

- physical flange entity identity;
- selected calculation face/port identity;
- oriented positive opening normal;
- mating-side identity;
- engineering global frame and units;
- exact model revision;
- exact `Advanced_Analysis` interface-set/interface/frame identities;
- drift-detectable provenance/evidence hashes;
- ambiguity/tolerance policy.

Then implement the producer in a separate bounded PR.

## Merge authority

`OWNER_ONLY_NOT_GRANTED` for PR #745. No merge was performed in this leg.
