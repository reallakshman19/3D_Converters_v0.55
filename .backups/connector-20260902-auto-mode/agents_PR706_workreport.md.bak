# PR706 Work Report

CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-01
PR: 706
BRANCH: agent/engcalc-bolted-joints-phase1-20260902
BASE_MAIN: bff53e336bdbddbe0fb829b7991ca5ed27fc836a
MATERIAL_CHECKPOINT_HEAD: 5ea2aa31e0f6b136510532ab5eb6801e7e66ec88
VALIDATION_HEAD_OBSERVED: 6076ff1c41720ca9a1f830232b692eb3bd402656
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

`equationSatisfied=true` is deliberately not a Code/design PASS.

## Source and benchmark state

The user-supplied PV Elite C101 report is retained as a rounded-input cross-solver benchmark. Independent arithmetic uses a hand-constructed SI pressure-equivalent fixture. Primary governing Code source qualification and governed flange/gasket master data remain unresolved.

## Validation truth

```text
source/architecture inspection                 PASS
main/base drift                                 PASS / zero behind at material checkpoint
open PR exact registry/index name search       PASS / no competing PR found
new adapter line/function policy               PASS by inspection
prior reconstructed kernel tests               PASS 6/6 supporting only
hosted checkout + Node 22 execution             PASS
hosted central index/registry initialization   PASS / indirect integration evidence
hosted HP qualification suite                  FAIL 14/15
focused flange exact-head tests                NOT_RUN
browser                                         NOT_RUN
independent engineering review                  NOT_RUN
```

### Hosted failure isolation

GitHub Actions run `33601912543`, job `100157263996`, executed on the PR #706 merge ref. The single failure occurs in `tests/hp-piping-class-orchestrator-parity.test.mjs`: the test expects source text matching `PIPE.B313.CH9.FATIGUE_USER_CALCULATED`, while the HP orchestrator source contains `PIPE.B313.CH9.FATIGUE_USER_REVIEW`.

PR #706 changes neither that HP test nor the HP orchestrator. The failure is therefore recorded as `FAIL / REMOTE_EXECUTION / OUT_OF_SCOPE_HP_PARITY`, not as a flange numerical failure. The PR is still red; no green status is claimed.

The same run provides limited positive integration evidence: the exact PR checkout loaded the central Engineering Calculations index/default registry successfully and reached HP domain assertions, so the new UG44 definition did not cause registry initialization failure in that run.

## Coordination / overlap

No open PR was found naming `converters/engineering-calculations/default-registry.js` or `converters/engineering-calculations/index.js` before mutation. PR #540 touches FIT adapter/UI and PR #649 touches the Engineering workspace tab; neither owns the two registry files changed here. Re-check before any later shared-file mutation.

## Backup compliance

The initial kernel/load/CLI/test files were new. `agents/agentchain.md` has a repository-native pre-edit backup recorded by `utils/backup.js` for its first edit.

The later registry/index edits have exact connector-side pre-edit byte backups, but the required native `node utils/backup.js save ...` command for those files remains `NOT_RUN / ENVIRONMENT_BLOCKED`. Those copies are evidence only, not policy-equivalent PASS. PR #706 remains draft and is not merge-ready on that basis alone.

## Changed-file intent

Engineering/software scope includes the flange kernel, joint-load primitives, BENCHMARK_ONLY adapter, default-registry/public-index registration, focused tests and CLI, plus relay/status/claim/backup custody. No workflow, writer, runtime, canvas, vibration numerical authority or FIT/AIV numerical method is changed.

## Highest risk

Focused flange tests, primary Code-source qualification, governed flange/gasket data and browser authority presentation remain open. Do not fix the unrelated HP parity test inside this mission merely to make hosted CI green.

## EXACT_NEXT_ACTION

Run `node --test tests/flange-ug44-core.test.mjs tests/flange-ug44-registry.test.mjs` against the exact PR #706 head in a native checkout and record PASS/FAIL before the next engineering-critical production mutation.

## Durable relay

Latest endpoint: `agents/agentchain/ENGCALC-BOLTED-JOINTS/EP-0003.md`.
