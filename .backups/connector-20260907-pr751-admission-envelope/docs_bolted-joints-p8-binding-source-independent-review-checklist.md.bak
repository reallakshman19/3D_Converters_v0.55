# P8 flange-face binding source independent-review checklist

## Purpose

This checklist is the admission gate for converting controlled project evidence into one real `FlangeFaceBindingSourceRecord.v1`.

It does not authorize geometry inference, create a runtime record automatically, or replace independent engineering judgement. Every populated field must be traceable to a controlled source. If any required item is ambiguous, inferred only from bounding-box/text/topology heuristics, or unsupported by the project source, the record remains blocked.

## A. Record and project control

- [ ] `recordId` is unique within the project binding register.
- [ ] `recordRevisionId` identifies the reviewed revision.
- [ ] `projectId` exactly identifies the controlled project context.
- [ ] Proposed `recordState` is `PROJECT_CONTROLLED` or `INDEPENDENTLY_CHECKED` only after the corresponding project control/review evidence exists.
- [ ] No placeholder or template token remains.

## B. Exact 3D model custody

- [ ] `modelId` identifies the exact model.
- [ ] `modelRevisionId` identifies the exact reviewed model revision/hash/version.
- [ ] `globalFrameId` identifies the global frame used for the point and the analysis interface.
- [ ] Length unit is explicitly `m` at the binding contract boundary.
- [ ] `sourceSchema` is exactly `rvm-converter-stage/v1`.
- [ ] `sourceKind`, `sourceFile`, `sourceRef` and `sourcePath` are retained from the controlled model evidence.
- [ ] `nativeKind` is retained only as evidence; it is not used to infer physical-flange authority.
- [ ] `componentRole = PHYSICAL_FLANGE` is supported by a controlled project source, not text/native-kind recognition alone.

## C. Physical calculation-face identity

- [ ] `jointId` is the intended bolted-joint calculation identity.
- [ ] `componentId` resolves to the exact physical flange entity.
- [ ] `selectedFaceId` identifies the exact engineering calculation face.
- [ ] `selectedPortId` identifies the corresponding controlled port/connection identity.
- [ ] The selected face is not chosen solely from EP1/EP2 ordering, PCF chain direction, nearest topology, bounding-box extent or visual appearance.
- [ ] `referencePointGlobalM` is the physical flange-face reference point in the declared global frame.
- [ ] The source of the reference point is independently traceable.

## D. Opening direction and mating side

- [ ] `openingDirection` is explicitly one of `POSITIVE_LOCAL_X`, `POSITIVE_LOCAL_Y`, `POSITIVE_LOCAL_Z`.
- [ ] The positive sign is supported by controlled engineering semantics, not inferred from model primitive orientation alone.
- [ ] `matingSideId` identifies the physical mating member/side used by the joint calculation.
- [ ] Face orientation and mating-side declarations are mutually consistent.
- [ ] The reviewer has checked that opening/closing sense will not be reversed when the analysis load is transformed to the flange frame.

## E. Advanced_Analysis interface custody

The P8 adapter remains pinned to:

```text
repository  reallaksh19/Advanced_Analysis
commit      eabb93cd44c59ce182d73284cb707653917e07c8
```

- [ ] `sourceRepository` exactly matches the pinned repository.
- [ ] `sourceCommit` exactly matches the pinned commit.
- [ ] `interfaceSetSemanticHash` matches the supplied qualified interface set.
- [ ] `interfaceId` resolves exactly and uniquely.
- [ ] `interfaceSemanticHash` matches the selected interface.
- [ ] `frameSemanticHash` matches the selected interface basis/frame.
- [ ] `reportingSignConvention` matches the supplied interface and is understood by the reviewer.
- [ ] The interface reference point and flange-face reference point relationship is explicitly verified; no silent second moment transport is introduced.

## F. Source provenance

Each semantic declaration must have a non-empty controlled source identifier:

- [ ] `bindingSourceId`
- [ ] `modelEntitySourceId`
- [ ] `calculationFaceSourceId`
- [ ] `openingDirectionSourceId`
- [ ] `matingSideSourceId`
- [ ] `globalFrameSourceId`
- [ ] `analysisInterfaceSourceId`

The reviewer has confirmed:

- [ ] source identifiers resolve to retained evidence;
- [ ] source revisions/hashes are recorded where the governing project system provides them;
- [ ] no source ID merely points back to the unreviewed record itself.

## G. Ambiguity and tolerance policy

Required fixed policy:

```text
identityPolicy        EXACT_IDENTIFIERS_ONLY
ambiguityDisposition UNAMBIGUOUS_REQUIRED
candidateCount        1
```

- [ ] exactly one model/interface candidate is admitted;
- [ ] `positionToleranceM` is explicitly supplied and non-negative;
- [ ] `orientationToleranceRad` is explicitly supplied and non-negative;
- [ ] `toleranceSourceId` identifies the controlled basis for those tolerances;
- [ ] tolerances are not silently defaulted by software;
- [ ] tolerances are not used to choose among multiple otherwise ambiguous candidates.

## H. Pre-review fingerprint and controlled state transition

Before independent review:

- [ ] remove all template wrapper fields;
- [ ] set `schema = FlangeFaceBindingSourceRecord.v1` exactly;
- [ ] set `recordState = PROJECT_CONTROLLED` only after project control evidence exists;
- [ ] set `semanticHash = ""`;
- [ ] confirm the candidate contains only the exact v1 record keys;
- [ ] retain the exact candidate bytes/revision that are supplied to the reviewer;
- [ ] identify the record `preparer` in the review-control evidence.

Compute the review fingerprint from that exact candidate:

```bash
node scripts/compute-flange-face-binding-source-review-hash.mjs <record.json>
```

Retain the returned `recordId`, `recordRevisionId` and `reviewedSubmissionHash` with the review evidence.

The `reviewedSubmissionHash` intentionally excludes only `recordState` and final `semanticHash`. Therefore:

- [ ] the fingerprint is unchanged by the controlled `PROJECT_CONTROLLED -> INDEPENDENTLY_CHECKED` state transition;
- [ ] any change to project/model/joint/face/opening/mating/interface/provenance/tolerance semantics changes the fingerprint and requires a new independent review;
- [ ] an accepted review is never replayed against a candidate with different reviewed semantics.

## I. Independent engineering review disposition

Record the independent reviewer separately from the record author/preparer.

```text
preparer:                  ______________________________
reviewer:                  ______________________________
review organization/role: ______________________________
review date:               ______________________________
reviewed record revision:  ______________________________
reviewedSubmissionHash:    fnv1a64:______________________
disposition:               ACCEPTED | REJECTED | NOT_RUN
comments/evidence ref:     ______________________________
```

- [ ] `preparer` identifies the person who prepared the controlled candidate/review package.
- [ ] `reviewer` identifies a different person from the preparer.
- [ ] the reviewer-preparer separation is supported by retained project review evidence, not only by free-text labels.

The admission helper requires both `preparer` and `reviewer` and rejects them when they normalize to the same text after Unicode normalization, trimming, whitespace collapse and case folding. That is a fail-closed software check against explicit self-review. It does **not** authenticate either identity, organization, credential or engineering qualification; those remain independent-review evidence obligations.

Admission is allowed only when disposition is exactly `ACCEPTED`, the `reviewedSubmissionHash` matches the exact candidate semantics, the explicit preparer/reviewer identities differ, and all required checklist items above are satisfied. `REJECTED` and `NOT_RUN` remain blocked states.

After an `ACCEPTED` review:

- [ ] transition `recordState` to `INDEPENDENTLY_CHECKED`;
- [ ] keep `semanticHash = ""` before final sealing;
- [ ] construct the submission JSON with the exact independent-review fields required by `FlangeFaceBindingSourceAdmission.v1`, including `preparer`;
- [ ] verify the admission helper rejects any review-hash mismatch or explicit reviewer/preparer identity collision.

## J. Admission, sealing and validation

Run the focused test gate on the exact target revision when available:

```bash
node --test \
  tests/flange-face-binding-source-admission.test.mjs \
  tests/flange-face-binding-source-register.test.mjs
```

Then admit the reviewed submission:

```bash
node scripts/admit-flange-face-binding-source.mjs <submission.json>
```

- [ ] focused exact-checkout test result is recorded as PASS, FAIL or NOT_RUN without relabeling;
- [ ] admitted output preserves `PROJECT_SOURCE_CUSTODY_ONLY`;
- [ ] sealed record semantic hash is retained with the controlled record;
- [ ] a subsequent semantic modification produces a new review fingerprint, new review evidence where required, new record revision and final semantic hash;
- [ ] retired/superseded records cannot be mistaken for current source authority.

## K. Authority boundary after acceptance

Even an accepted source record remains a source-custody input. It does not by itself grant:

```text
automaticBindingProducer  true
codeCompliance            true
designAuthority           true
governingEligible         true
```

A later separately scoped producer must verify the accepted record against the actual model and qualified `Advanced_Analysis` objects before emitting `FlangeFaceBinding.v1`. Master resolution and solver invocation remain separate later gates.
