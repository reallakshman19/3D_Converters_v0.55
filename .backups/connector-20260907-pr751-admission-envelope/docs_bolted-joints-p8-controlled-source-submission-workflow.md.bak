# P8 controlled flange-face binding source submission workflow

## Purpose

This workflow turns the EP-0037 external-source hard stop into an explicit project-source intake path. It does not relax that hard stop and it does not manufacture the missing engineering semantics.

A submission is eligible for review only when it represents exactly one real, retained, project-controlled source capable of populating `FlangeFaceBindingSourceRecord.v1` without inference.

## Intake path

1. Open the **Engineering Calculations — controlled flange-face binding source** issue form.
2. Submit one project/source-record identity only.
3. Supply the exact model revision and global frame plus retained model evidence.
4. Supply controlled declarations for the physical flange, selected calculation face/port, physical flange-face reference point, positive opening direction and mating side.
5. Supply the exact pinned `Advanced_Analysis` interface identities required by the source-register contract.
6. Supply provenance IDs for every semantic declaration and explicit positional/orientation tolerance custody.
7. Identify the record `preparer`; the independent reviewer must be a different identified person.
8. Construct the exact candidate `FlangeFaceBindingSourceRecord.v1` with `recordState=PROJECT_CONTROLLED` and `semanticHash=""`.
9. Compute the stable pre-review fingerprint:

```bash
node scripts/compute-flange-face-binding-source-review-hash.mjs <record.json>
```

10. Give the exact candidate plus returned `recordId`, `recordRevisionId` and `reviewedSubmissionHash` to the independent engineering reviewer.
11. Record independent engineering review as `ACCEPTED`, `REJECTED` or `NOT_RUN` with `preparer`, reviewer/role/evidence identity and the exact `reviewedSubmissionHash`.
12. Only after `ACCEPTED`, transition the candidate to `recordState=INDEPENDENTLY_CHECKED`, keep `semanticHash=""`, and submit the record plus independent-review object through the admission CLI.
13. Only an admitted real submission may proceed to retained final record sealing/custody and the exact focused test gate.

The `reviewedSubmissionHash` excludes only `recordState` and the final record `semanticHash`. It is therefore stable across the controlled `PROJECT_CONTROLLED -> INDEPENDENTLY_CHECKED` state transition, but any change to project/model/joint/face/opening/mating/interface/provenance/tolerance semantics invalidates the prior review fingerprint and requires a new review.

## Fail-closed rules

The following evidence may support investigation but cannot substitute for a controlled project declaration:

- bounding-box orientation or longest-axis routing heuristics;
- primitive transform/orientation by itself;
- flange text, native-kind or shape recognition;
- ATT-derived schematic flange recipes;
- UXML/PCF EP1/EP2 ordering or route/chain direction;
- topology proximity, connectivity, nearest-candidate selection or hidden tolerance defaults.

If a required field lacks controlled evidence, record it as unavailable and keep the candidate blocked. Do not derive or back-fill the missing semantic.

## Required v1 ambiguity policy

```text
identityPolicy            EXACT_IDENTIFIERS_ONLY
ambiguityDisposition      UNAMBIGUOUS_REQUIRED
candidateCount             1
positionToleranceM         explicit controlled value
orientationToleranceRad   explicit controlled value
toleranceSourceId          explicit controlled source ID
```

The tolerances are verification inputs. They are not authority to choose among multiple candidate faces or mating sides.

## Independent review boundary

The reviewer must independently verify the retained evidence supporting:

- exact model/revision/global-frame custody;
- `PHYSICAL_FLANGE` identity;
- selected calculation face and selected port;
- physical face point;
- positive opening direction;
- mating side;
- exact `Advanced_Analysis` interface-set/interface/frame/sign identities;
- provenance for each declaration;
- explicit tolerance basis;
- exactly one admissible candidate;
- the exact `reviewedSubmissionHash` for the reviewed candidate revision.

The admission contract requires explicit `preparer` and `reviewer` identities and rejects them when they normalize to the same string after Unicode normalization, trimming, whitespace collapse and case folding. This is a fail-closed separation check only; it does not authenticate a person, organization, credential or engineering qualification. Those remain controlled review evidence obligations.

A source-owner/preparer declaration and an independent engineering acceptance are separate evidence events. `NOT_RUN` review is not acceptance. A review must not be reused after any reviewed semantic changes.

## Post-acceptance sequence

Even an accepted submission remains `PROJECT_SOURCE_CUSTODY_ONLY` and non-authorizing. The permitted next sequence is:

```text
project-controlled candidate + identified preparer
→ compute reviewedSubmissionHash
→ independent review by a different identified reviewer
→ ACCEPTED review
→ transition recordState to INDEPENDENTLY_CHECKED
→ admit source submission with matching review hash
→ retain sealed FlangeFaceBindingSourceRecord.v1
→ run exact admission + source-register focused tests when an exact checkout is available
→ separately scope a fail-closed producer
→ producer verifies accepted record against actual model + qualified Advanced_Analysis objects
→ emit FlangeFaceBinding.v1 only when every identity matches
```

Admission command:

```bash
node scripts/admit-flange-face-binding-source.mjs <submission.json>
```

Focused test command:

```bash
node --test \
  tests/flange-face-binding-source-admission.test.mjs \
  tests/flange-face-binding-source-register.test.mjs
```

Master resolution, flange/bolt/gasket solver execution, Code compliance, design authority, governing eligibility, UI/registry routing and production release remain outside this workflow.

## Validation truth

This workflow is source-governance acquisition infrastructure. The review-fingerprint helper and admission helper validate custody contracts only; they perform no engineering calculation and grant no engineering authority. Exact-checkout execution must remain PASS/FAIL/NOT_RUN as actually observed and must not be inferred from documentation presence.
