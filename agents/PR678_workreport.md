# PR678 — Coherent OperatingScenario M5 Contract — Recovery Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR_HEAD_OBSERVED: eb436f43ec8423cb77f1aad7b39e6441e7eeff9e
REPORT_BASIS_HEAD: eb436f43ec8423cb77f1aad7b39e6441e7eeff9e
MAIN_HEAD_LAST_CHECKED: f19a050f8c542ce07e72d1c00af86142de92257f
MERGE_BASE: f19a050f8c542ce07e72d1c00af86142de92257f
REPORT_SYNC: CURRENT
GROUNDING_EPOCH: GE-003
CURRENT_STAGE: DRAFT_READY_FOR_OWNER_REVIEW
CURRENT_BLOCKER: repository-native committed test remains unavailable in this runtime
HIGHEST_RISK: scenario identity/provenance must never become an implicit engineering-authority or independent-maxima synthesis path
EXACT_NEXT_ACTION: keep PR678 draft; after explicit owner merge authorization, merge exact head then start successor AssessmentUnit->OperatingScenario binding slice

## Handover in 60 Seconds

PR #678 implements issue #429 M5 invariant VIB-INV-006 as a bounded data contract:

> coherent operating scenarios are explicit states; independent maxima are not operating cases.

Existing `VibrationIntegrityDataset.v1` already contains normalized line/case rows. PR678 wraps one exact row in `OperatingScenario.v1` only when the caller explicitly declares `COHERENT_OPERATING_STATE`.

```text
VibrationIntegrityDataset.v1
-> exact datasetId + line + caseId
-> caller declaration COHERENT_OPERATING_STATE
-> one exact operating-case row
-> OperatingScenario.v1
```

PR: `https://github.com/reallaksh19/3D_Converters/pull/678`
Branch: `agent/vib-operating-scenario-m5-20260820`
Current base/main/merge base: `f19a050f8c542ce07e72d1c00af86142de92257f`
Current observed PR head: `eb436f43ec8423cb77f1aad7b39e6441e7eeff9e`
State: OPEN / DRAFT / MERGEABLE / UNMERGED
Merge authority: OWNER_ONLY / NOT_GRANTED_FOR_PR678

## Exact Remote Reconciliation — GE-003

```text
main / merge base       f19a050f8c542ce07e72d1c00af86142de92257f
PR head                 eb436f43ec8423cb77f1aad7b39e6441e7eeff9e
changed paths           7 / all intended
reviews                 0
review threads          0
status contexts         0 returned -> NOT_RUN
PR workflow runs        0 returned -> NOT_RUN
main drift              none observed
mergeable               true
draft                    true
```

Empty status/workflow results are not represented as PASS.

## Implemented Contract

### Identity

Logical scenario identity is:

```text
datasetId + line + caseId
```

This prevents cross-project collisions such as two independent projects both using `L-100 / NORMAL`.

The contract emits:

```text
scenarioId
identityHash
snapshotHash
```

`scenarioId`/`identityHash` remain stable across revisions of the same logical scenario. `snapshotHash` changes when dataset revision/source hash, operating-case provenance, or engineering quantities change.

### Coherence

Scenario creation requires:

```text
coherenceDeclaration = COHERENT_OPERATING_STATE
```

The selector accepts only:

```text
line
caseId
coherenceDeclaration
```

Unknown fields fail closed. There is deliberately no API for independent maxima, “worst case”, pressure override, flow override, or cross-case synthesis.

Permanent coherence flags:

```text
basis = SINGLE_DATASET_OPERATING_CASE_ROW
crossScenarioMixingAllowed = false
independentMaximaSynthesisAllowed = false
designLimitSubstitutionAllowed = false
```

### Provenance

Dataset provenance retained:

```text
datasetId
datasetVersion
sourceHash
canonicalHash
projectionHash
sourceFileName
```

Operating-case provenance retained:

```text
source
sourceRevision
recordId
```

Missing source revision/record ID, dataset version, or source hash remains explicit `INCOMPLETE`; no value is inferred.

### Process basis boundary

Dataset v1 currently does not encode ACTUAL/STANDARD/NORMAL basis, so the scenario says exactly:

```text
processBasis = NOT_REPRESENTED_BY_DATASET_V1
processActualization = NOT_PERFORMED
processActualizationAuthority = NONE
```

Pressure reference is copied if supplied. Missing pressure reference remains `UNRESOLVED`.

This PR does not solve #588.

## Authority Boundary

```text
purpose = OPERATING_SCENARIO_IDENTITY_AND_PROVENANCE_ONLY
engineeringAuthority = NONE
screeningAuthority = NOT_AUTHORIZED
designAuthority = false
numericalAuthority = NONE
processActualizationAuthority = NONE
coherenceAuthority = CALLER_DECLARATION_ONLY
determinesApplicability = false
determinesCompleteness = false
crossScenarioMixingAllowed = false
independentMaximaSynthesisAllowed = false
designLimitSubstitutionAllowed = false
```

No mechanism can obtain screening/design authority from scenario construction.

## Changed-File Ledger

Production/test:
- `converters/vibration/dataset/operating-scenario.js` — NEW, 276 physical lines at implementation compare
- `converters/vibration/dataset/index.js` — MODIFIED, export only (+8)
- `tests/vibration-operating-scenario.test.mjs` — NEW, 232 physical lines at implementation compare

Backup/recovery:
- `.backups/connector-20260820-vib-operating-scenario-m5/converters/vibration/dataset/index.js`
- `agents/PR678_workreport.md`
- `agents/status/PR678.yaml`
- `agents/claims/PR678.yaml`

No Project-v2 file, mechanism kernel/adapter, process-actualization authority, geometry-consistency tolerance, source/master, EI aggregation, coverage/completeness, UI, or workflow file is in scope.

## Coordination

- PR665 Project v2: SAFE / NO EXACT FILE OVERLAP. Do not modify `converters/vibration/project/*` in PR678.
- #586 geometry consistency: SHARED_READ; remains blocked by controlled tolerance.
- #588 process actualization: SHARED_READ; remains blocked by controlled conversion authority.
- PR653/655/#545 source qualification: SAFE / unrelated.
- PR675 source campaign: merged predecessor; unrelated.

## Falsification Coverage

1. Exact NORMAL row produces massFlow=100 and pressure=10 from the same row.
2. Exact RELIEF row produces massFlow=50 and pressure=20 from the same row.
3. No API result synthesizes `{massFlow:100, pressure:20}`.
4. `maxPressureAcrossCases` selector field hard fails.
5. Missing/incorrect coherence declaration hard fails.
6. Same datasetId+line+caseId retains logical scenario identity while input/revision changes move snapshot hash.
7. Different datasetId changes scenario identity.
8. Missing case provenance remains explicitly INCOMPLETE.
9. Missing pressure reference remains UNRESOLVED.
10. Snapshot tamper changes content without hash and is rejected.
11. Foreign dataset/schema fails closed.
12. Scenario is deeply frozen.

## Validation Ledger

- #429 VIB-INV-006 trace: PASS / SOURCE_INSPECTION / AUTHORITATIVE_REFERENCE
- current dataset schema/records/assemble trace: PASS / SOURCE_INSPECTION / IMPLEMENTATION_COUPLED
- PR665 overlap inspection: PASS / NO_EXACT_OVERLAP
- reconstructed module syntax: PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
- reconstructed core falsifiers: PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
- physical-line policy at implementation compare: PASS / 276 production, 232 test
- exact pre-edit connector backup: PASS / repository backup path created before `index.js` edit
- exact changed-file negative assurance: PASS / 7 intended paths only
- reviews/review threads: PASS / REMOTE_SOURCE_STATE 0/0
- exact-head status contexts: NOT_RUN / 0 returned
- exact-head PR workflow runs: NOT_RUN / 0 returned
- repository-native committed test: NOT_RUN / ENVIRONMENT_BLOCKED
- browser: NOT_APPLICABLE / DATA_CONTRACT_ONLY
- independent numerical verification: NOT_APPLICABLE / no equation or engineering value changed

No reconstructed execution is represented as repository-native PASS.

## Next Architectural Step After Merge

Do **not** add FIT/AIV/SBC adapter changes to PR678.

The successor integration slice should bind every mechanism `AssessmentUnit` to:

```text
operatingScenarioId
operatingScenarioSnapshotHash
```

and fail if a calculation request tries to combine project/process values from different scenario snapshots. That is the seam toward M12 facility orchestration.

## Merge Authority

```text
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED_FOR_PR678
```
