# PR749 Work Report — P8 controlled source submission workflow

## Assignment

Create only the acquisition workflow needed to receive one real controlled flange-face binding source without weakening EP-0037 engineering-source controls.

## Grounding

```text
main      78b361d1f649d41378f568ebe1a237c4bc140c73
base PR   #748
base head b7f4b86fda6411b254ca817dc325b69c0520b935
PR        #749
```

No merge authority was granted.

## Changes

- Added `.github/ISSUE_TEMPLATE/engcalc-flange-face-binding-source.yml`.
- Added `docs/engineering-calculations/bolted-joints-p8-controlled-source-submission-workflow.md`.
- Added EP-0038 governance records.
- Preserved the exact pre-edit `agents/agentchain.md` blob as connector-side `EVIDENCE_ONLY` backup.

## Engineering boundary

The intake requires controlled declarations for physical flange/calculation-face/opening/mating semantics and exact analysis-interface identities. It explicitly rejects geometry/topology heuristics as authority. Acceptance remains `PROJECT_SOURCE_CUSTODY_ONLY`; no producer, master resolution, solver execution, Code claim, design authority or governing eligibility is introduced.

## Validation

```text
issue-form acquisition fields reviewed   PASS / DOCUMENT_INSPECTION
workflow fail-closed boundary reviewed    PASS / DOCUMENT_INSPECTION
calculation code changed                  NOT_APPLICABLE
native numerical execution                NOT_APPLICABLE
real controlled source supplied           FAIL / NOT_SUPPLIED
independent review of real record          NOT_RUN
native backup command                      NOT_RUN / CONNECTOR_ONLY_ENVIRONMENT
connector pre-edit backup                  EVIDENCE_ONLY
```

## Remaining blocker

Further P8 runtime implementation remains blocked until one real controlled source submission is independently accepted and can be constructed/sealed as `FlangeFaceBindingSourceRecord.v1` with exact validation truth preserved.
