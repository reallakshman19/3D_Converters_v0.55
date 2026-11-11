# PR615 Stage 6 — Measurement Evidence Persistence

## Scope

Persist validated `VibrationMeasurementEvidencePackage.v1` inside `VibrationIntegrityProject.v1` / `.vibproj` without creating engineering, screening, design, or RCA authority.

## Grounding

```text
WORK_INTENT       IMPLEMENT
CRITICALITY       ENGINEERING_CRITICAL
PR                #615
BRANCH            agent/vibration-eit-roadmap-20260818
START_HEAD        5ee6cf4fb0eb302d03e89af3f634978a65a2ebd7
START_MAIN        eef94949961970171d1366f5b6a9d421b3cc0d9f
MERGE_AUTHORITY   NOT_GRANTED
```

`converters/vibration/project/**` is already PR615-owned and does not exist on current `main`. Mechanism workspace claims #479/#506/#508 and coverage #571 are outside this stage and untouched.

## Implementation

Added:

```text
converters/vibration/project/measurement.js
  createEmptyVibrationMeasurementEvidencePackage()
  attachVibrationMeasurementEvidence()

tests/vibration-project-measurement-persistence.test.mjs
```

Changed:

```text
converters/vibration/project/schema.js
converters/vibration/project/from-eit.js
```

Project schema now:

- validates optional `project.measurementEvidence` through the Stage-5 measurement evidence contract;
- requires every measurement session `scope.lineId` to reference an existing project line;
- rejects non-empty legacy `measurements[]` so unvalidated measurement payloads cannot bypass the package contract;
- rejects project-level `rootCauseAuthority=true` and `measurementEvidenceIsCurrentEngineeringAuthority=true`;
- retains backward compatibility for older V1 project files that omit `measurementEvidence`.

New EIT-derived projects seed an empty validated measurement package and explicitly record:

```text
measurementEvidenceIsCurrentEngineeringAuthority = false
rootCauseAuthority = false
```

The bridge clones, validates, attaches, revalidates, and deep-freezes the resulting project. The source project is not mutated.

## Invariants

```text
VIBPROJ_PERSISTENCE != MEASUREMENT_ENGINEERING_AUTHORITY
MEASUREMENT_EVIDENCE != SCREENING_RESULT
MEASUREMENT_EVIDENCE != ROOT_CAUSE_CONCLUSION
MEASUREMENT_SESSION_LINE MUST EXIST IN PROJECT
LEGACY_UNVALIDATED_MEASUREMENTS[] MUST REMAIN EMPTY
PERSISTED_CURRENT_RESULTS REMAIN REJECTED
```

No FFT/PSD/order/coherence/ODS/modal calculation code is introduced.

## Validation

Focused controlled reconstruction:

```text
Stage-6 persistence cases       PASS 7/7
legacy project authority guard  PASS
legacy currentResults guard     PASS
```

Stage-6 cases cover:

1. new project receives empty validated measurement package;
2. valid evidence survives deterministic `.vibproj` round-trip;
3. attachment is immutable and source project is unchanged;
4. measurement session cannot reference an unknown project line;
5. forged measurement root-cause authority fails closed on load;
6. non-empty legacy `measurements[]` fails closed;
7. older V1 project with no `measurementEvidence` remains loadable.

Committed blobs at implementation checkpoint:

```text
project/schema.js                         ed123f469ed5b83a138aa37e2bcd236d282ea0ef
project/measurement.js                    df3d70f18eb50026800546b8ec9c87e29d3fded3
project/from-eit.js                       ef0b4e4fe26a0363d9e96e083250c62db3e3c10c
project measurement persistence test      3fd60902ea42f4d23cfd14da0508ec61371ffae2
```

The focused execution used a reconstructed dependency surface with the exact Stage-5 measurement contract blob; it is not represented as repository-native complete-checkout qualification.

## Still NOT_RUN

```text
repository-native Stage-6 test
complete project/EIT test suite
full Vibration/FIT/AIV/SBC release suites
served browser acceptance
independent engineering review
```

## Negative assurance

No changes to mechanism equations, LOF semantics, signal processing, method applicability, AIV/SBC/FIT workspace code, generic `.eit` export, Product Freeze, design authority, or workflows.
