# PR706 Work Report

CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-01
PR: 706
BRANCH: agent/engcalc-bolted-joints-phase1-20260902
BASE_MAIN: bff53e336bdbddbe0fb829b7991ca5ed27fc836a
CHECKPOINT_HEAD: 5ea2aa31e0f6b136510532ab5eb6801e7e66ec88
STATE: ACTIVE_VALIDATION_REQUIRED
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Start `Engineering Calculations -> Flanges & Joints` with a bounded rated-flange external-load calculation, 3D joint-load primitives and central Engineering Calculations registration while preserving a fail-closed benchmark-only authority boundary.

## Delivered capability

- pure SI `FLANGE.RATED_LOAD.UG44B` arithmetic kernel;
- equivalent bending and opening-axial pressure components;
- rated-pressure cap on calculated maximum pressure;
- explicit acceptance-equation cross-form;
- joint-face moment transport `M_target = M_source + r x F`;
- opening-only axial force selection;
- resultant in-plane bending, transverse shear and torsion retention;
- direct Node CLI;
- analytical and PV Elite rounded-display regression source;
- benchmark-only Engineering Calculation adapter;
- registration in the existing default registry and public Engineering Calculations index;
- central-engine unit-conversion and registration regression source.

## Engineering authority

```text
engineeringAuthority = NONE_PENDING_SOURCE_QUALIFICATION
calculationState     = BENCHMARK_ONLY
screeningAuthority   = NOT_AUTHORIZED
codeCompliance       = false
designAuthority      = false
governingEligible    = false
registryIntegrated   = true
UIExecutionPath      = SOURCE_WIRED_NOT_BROWSER_VALIDATED
```

`equationSatisfied=true` is deliberately not a Code/design PASS. The adapter's assessment, qualification and provenance keep that distinction explicit.

## Source and benchmark state

The user-supplied PV Elite C101 report identifies ASME UG-44(b), attributes the method to PVP2013-97814, and displays the acceptance/Pmax relationships and nozzle examples. Its displayed inputs are rounded, so those examples remain rounded-input cross-solver checks with a declared 2% relative tolerance.

Independent arithmetic is protected by a hand-constructed SI pressure-equivalent fixture. Primary governing Code source qualification and governed flange master data remain unresolved.

## Validation truth

```text
source/architecture inspection              PASS
main/base drift                              PASS / zero behind at checkpoint
open PR exact registry/index name search    PASS / no competing PR found
new adapter <300 lines                       PASS by inspection
bounded functions / named exports           PASS by inspection
prior reconstructed kernel tests            PASS 6/6 supporting only
exact-head repository-native focused tests  NOT_RUN
hosted CI                                    NOT_RUN
browser                                      NOT_RUN
independent engineering review               NOT_RUN
```

No `NOT_RUN` item is represented as PASS.

## Coordination / overlap

Open PR re-ground before shared-file mutation found no open PR naming `converters/engineering-calculations/default-registry.js` or `converters/engineering-calculations/index.js`. PR #540 touches FIT adapter/UI, and PR #649 touches `tabs/engineering-workspace-tab.js`; neither owns the two registry files changed here. Current classification for the registry/index edits: `SAFE` by observed path/authority search, subject to re-check before any later shared-file edit.

## Backup compliance

The original kernel/load/CLI/test files were new. `agents/agentchain.md` had a repository-native pre-edit backup generated with `node utils/backup.js save` and committed under `.backups/`.

For the later existing registry/index edits, this connector session could not execute the required native backup command. Exact connector-side pre-edit byte copies were committed before mutation:

```text
.backups/connector-20260902-engcalc-ug44-registry/
  converters_engineering-calculations_default-registry.js.bak
  converters_engineering-calculations_index.js.bak
```

This is recorded as `NOT_RUN / ENVIRONMENT_BLOCKED` for the native command and is **not** claimed as policy-equivalent PASS. PR #706 remains draft and is not merge-ready on that basis alone.

## Changed-file intent

Engineering/software scope now includes:

- flange kernel and joint-load primitives;
- benchmark-only adapter;
- default-registry registration and public export;
- focused kernel/registry tests and CLI;
- relay/workreport/status/claim artifacts;
- exact pre-edit backup evidence.

No workflow, writer, runtime, canvas, vibration numerical authority or existing FIT/AIV numerical method is changed.

## Highest risk

The calculator is now discoverable/executable through the generic Engineering Calculations registry at `BENCHMARK_ONLY`, but primary Code-source qualification, flange/gasket master-data authority, exact-head native tests and browser presentation remain open. Any UI presentation that visually implies Code/design acceptance would be a release blocker.

## EXACT_NEXT_ACTION

Run `node --test tests/flange-ug44-core.test.mjs tests/flange-ug44-registry.test.mjs` against the exact PR #706 head in a native checkout and record PASS/FAIL before the next engineering-critical production mutation.

## Durable relay

Latest endpoint: `agents/agentchain/ENGCALC-BOLTED-JOINTS/EP-0002.md`.
