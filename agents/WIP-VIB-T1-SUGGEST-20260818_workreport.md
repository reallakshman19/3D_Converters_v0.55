# WIP-VIB-T1-SUGGEST-20260818 — non-authoritative T1 mechanism suggestions

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED_FOR_OWNER_DIRECTED_ASSIGNMENT
EXECUTION_MODE: AUTO
AUTO_STATE: RUNNING
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED
REPOSITORY: reallaksh19/3D_Converters
BRANCH: agent/vibration-t1-suggestions-20260818
BASE: main
BASE_HEAD: d9d14d13b089c968c989544ddbdf023063b43e67
IMPLEMENTATION_BASIS_HEAD: 990ca74afb76871c865a9ad442cdeea1cdb1415a
CURRENT_STAGE: VALIDATE_RECONCILE
CURRENT_BLOCKER: REPOSITORY_NATIVE_EXECUTION_UNAVAILABLE
HIGHEST_RISK: accidentally converting project-context assistance into EI applicability evidence
EXACT_NEXT_ACTION: allocate draft PR after exact file/base reconciliation; keep suggestion display entirely outside identification evidence producer
```

## Mission

Add a small T1 assistance layer that highlights obvious mechanism candidates from explicit project facts while preserving the existing rule that mechanism applicability is established only by explicit engineer/reviewer identification evidence.

## Implemented safety contract

Suggestions:
- require exact line/case/canonical scope;
- require exact boolean enrichment properties with parsed value `true` and `Status=VERIFIED`;
- never set REQUIRED / NOT_APPLICABLE / UNRESOLVED;
- never enter `createVibrationMechanismIdentificationBundle()`;
- never mutate the identification authoring table;
- never count toward completeness;
- are display-only beside the existing explicit authoring workspace;
- retain source/revision/record/reviewer trigger facts;
- grant no source, screening, design, code or engineering authority.

## Initial rules

1. `T1_RECIP_PD_EQUIPMENT_PRESENT` -> `reciprocatingPulsation` / `MAIN_LINE_SECTION`
2. `T1_ROTATING_EQUIPMENT_CONNECTION_PRESENT` -> `mechanicalExcitation` / `MAIN_LINE_SECTION`
3. `T1_DEADLEG_PRESENT` -> `deadlegPulsation` / `DEADLEG_BRANCH`
4. `T1_PRESSURE_REDUCING_GAS_SOURCE_PRESENT` -> `aiv` / `AIV_SOURCE_ASSESSMENT_PAIR`
5. `T1_SMALL_BORE_CONNECTION_PRESENT` -> `smallBoreConnections` / `SBC_CONNECTION`
6. `T1_THERMOWELL_OR_INTRUSIVE_ELEMENT_PRESENT` -> `thermowells` / `INTRUSIVE_ELEMENT`

The app does not infer these facts from equipment names, line names, tags, phase, pressure values, geometry or other free text. This is deliberate to avoid a hidden expert-system boundary.

## Product behavior

`VibrationT1MechanismSuggestion.v1` records carry `PENDING_ENGINEER_REVIEW` plus explicit authority fields showing `automaticApplicabilityRules=false`, `createsIdentificationEvidence=false`, `countsTowardCompleteness=false`, `screeningAuthority=NOT_AUTHORIZED`, and `designAuthority=false`.

The Mechanism Identification page displays suggestions for current workspace scopes and tells the engineer to use the existing `Add identification row` authoring path. There is no suggestion-apply mutation action in v1.

## Validation truth

```text
six-rule exact property vocabulary                 PASS / SOURCE_INSPECTION
verified true + exact-scope gate                    PASS / SOURCE_INSPECTION
unverified/false/wrong-scope/renamed fact rejection PASS / SOURCE_INSPECTION
suggestion -> identification contract rejection    PASS / SOURCE_INSPECTION
UI has no suggestion apply mutation path            PASS / SOURCE_INSPECTION
existing identification producer unchanged         PASS / SOURCE_INSPECTION
reconstructed suggestion module node --check        PASS
reconstructed focused suggestion execution          PASS
repository-native suggestion tests                  NOT_RUN
repository-native identification regression suite   NOT_RUN
browser T1 suggestion display                       NOT_RUN
```

## Re-grounding

Main advanced during implementation by unrelated XML/CII PR636. The branch was re-grounded using the current main tree as the base tree and overlaying only the eight T1-owned blobs. No XML/CII file was copied from the old branch tree. Implementation basis after re-grounding: `990ca74afb76871c865a9ad442cdeea1cdb1415a`.

## Backup truth

Native `node utils/backup.js save ...` is `NOT_RUN / ENVIRONMENT_BLOCKED` in the connector-only environment. The only existing production file changed is `tabs/vibration-integrity-identification-view.js`; its pre-edit main blob is `8216419820697427cf0be1c3c15bce154286746f`.
