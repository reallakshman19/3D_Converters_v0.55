# P8 controlled flange-face binding source submission workflow

## Purpose

This workflow turns the EP-0037 external-source hard stop into an explicit project-source intake path. It does not relax that hard stop and it does not manufacture the missing engineering semantics.

A submission is eligible for review only when it represents exactly one real, retained, project-controlled source capable of populating `FlangeFaceBindingSourceRecord.v1` without inference.

## Intake path

1. Open the **Engineering Calculations — controlled flange-face binding source** issue form.
2. Submit one project/source-record identity only.
3. Supply the exact model revision and global frame plus retained model evidence.
4. Supply controlled declarations for the physical flange, selected calculation face/port, physical face reference point, positive opening direction and mating side.
5. Supply the exact pinned `Advanced_Analysis` interface identities required by the source-register contract.
6. Supply provenance IDs for every semantic declaration and explicit positional/orientation tolerance custody.
7. Record independent engineering review as `ACCEPTED`, `REJECTED` or `NOT_RUN` with reviewer/evidence identity.
8. Only an independently accepted real submission may proceed to record sealing and the exact source-register gate.

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
- exactly one admissible candidate.

A source-owner declaration and an independent engineering acceptance are separate evidence events. `NOT_RUN` review is not acceptance.

## Post-acceptance sequence

Even an accepted submission remains `PROJECT_SOURCE_CUSTODY_ONLY` and non-authorizing. The permitted next sequence is:

```text
accepted real source submission
→ construct candidate FlangeFaceBindingSourceRecord.v1
→ verify and seal record with source-register helper
→ run exact source-register focused test when an exact checkout is available
→ separately scope a fail-closed producer
→ producer verifies accepted record against actual model + qualified Advanced_Analysis objects
→ emit FlangeFaceBinding.v1 only when every identity matches
```

Master resolution, flange/bolt/gasket solver execution, Code compliance, design authority, governing eligibility, UI/registry routing and production release remain outside this workflow.

## Validation truth

This workflow is documentation/administrative acquisition infrastructure. It changes no calculation code and requires no numerical execution. Its presence does not convert any prior `NOT_RUN` validation state to PASS.
