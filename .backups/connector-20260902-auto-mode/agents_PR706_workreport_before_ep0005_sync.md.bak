# PR706 Work Report

CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-01
PR: 706
BRANCH: agent/engcalc-bolted-joints-phase1-20260902
BASE_MAIN: bff53e336bdbddbe0fb829b7991ca5ed27fc836a
MATERIAL_CHECKPOINT_HEAD: 5ea2aa31e0f6b136510532ab5eb6801e7e66ec88
SOURCE_REGISTER_HEAD: 26888cd04401bb3bc9764c0ba4acad4e392367d3
STATE: BLOCKED_VALIDATION_REQUIRED
EXECUTION_MODE: AUTO
AUTO_STATE: BLOCKED
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_MISSION
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Implement the approved `Engineering Calculations -> Flanges & Joints / Bolts` plan, beginning with a bounded rated-flange external-load calculation, while preserving independent validation, source/master authority and fail-closed result semantics.

## Delivered capability

- pure SI `FLANGE.RATED_LOAD.UG44B` arithmetic kernel;
- equivalent bending and opening-axial pressure components;
- rated-pressure cap on calculated maximum pressure;
- acceptance-equation cross-form;
- joint-face moment transport `M_target = M_source + r x F`;
- opening-only axial force selection and resultant in-plane bending;
- direct Node CLI;
- analytical and PV Elite rounded-display regression source;
- BENCHMARK_ONLY Engineering Calculation adapter;
- registration in the existing default registry and public Engineering Calculations index;
- central-engine unit-conversion/registration regression source;
- source-authority register at `docs/engineering-calculations/flange-ug44-source-register.md`.

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

`equationSatisfied=true` remains a numerical statement about the implemented reference relationship, not Code/design acceptance.

## AUTO MODE state

The owner explicitly activated `AUTO MODE`. The chain was advanced automatically through the next safe non-production contribution. AUTO did not waive validation gates or merge authority.

A hard stop is now active because the approved next engineering-critical production mutation is conditional on exact/native focused test execution, and this connector runtime cannot execute the repository command.

## Source and benchmark state

The new source-authority register separates:

- official ASME BPVC VIII-1 2025 edition identity;
- exact current licensed UG-44(b) clause/table authority, still unresolved;
- Warren Brown PVP2013-97814 method provenance;
- historical Code Case 2901 evidence;
- PV Elite C101 cross-solver benchmark status;
- legacy spreadsheet evidence;
- future governed `PR`, `FM` and `G` master-data custody.

No historical/public secondary table value was promoted into production master data.

## Validation truth

```text
source/architecture inspection                 PASS
main/base drift                                 PASS / zero behind at material checkpoint
open PR registry/index overlap search          PASS / no competing claim observed
prior reconstructed kernel tests               PASS 6/6 supporting only
hosted checkout + Node 22 execution             PASS
hosted central index/registry initialization   PASS / indirect integration evidence
hosted HP qualification suite                  FAIL 14/15 / OUT_OF_SCOPE_HP_PARITY
focused flange exact/native tests              NOT_RUN / ENVIRONMENT_BLOCKED
browser                                         NOT_RUN
independent engineering review                  NOT_RUN
```

### Hosted failure isolation

GitHub Actions run `33601912543`, job `100157263996`, executed on the PR #706 merge ref. The single failure is in `tests/hp-piping-class-orchestrator-parity.test.mjs`, where an existing source-regex expectation references `PIPE.B313.CH9.FATIGUE_USER_CALCULATED` while the HP orchestrator contains `PIPE.B313.CH9.FATIGUE_USER_REVIEW`.

PR #706 changes neither that HP test nor the HP orchestrator. The failure remains recorded as a real hosted FAIL outside this chain's flange material boundary; it is not repaired here merely to produce a green run.

## Source-authority result

Official public ASME metadata establishes `BPVC.VIII.1 - 2025` as the current Section VIII Division 1 product edition. That evidence does not expose or qualify the exact licensed 2025 UG-44(b) equation/table/footnotes. Those remain `UNRESOLVED` and prevent authority promotion.

The implementation continues to require caller-provided `PR`, `G` and `FM`; therefore the kernel is not silently acting as an ASME master-data source.

## Coordination / overlap

No competing open PR was previously found naming `converters/engineering-calculations/default-registry.js` or `converters/engineering-calculations/index.js`. Re-check current PR/path and authority overlap before any later shared-file or master-data mutation.

## Backup compliance

The original new implementation files did not need pre-edit backups. Earlier `agents/agentchain.md` edit has a native `utils/backup.js` record.

For later existing-file edits performed through this connector runtime, exact pre-edit byte copies are committed under `.backups/`. The mandated native `node utils/backup.js save ...` command is unavailable here and remains `NOT_RUN / ENVIRONMENT_BLOCKED`; connector copies are evidence only, not policy-equivalent PASS.

## Changed-file intent

The current PR contains the flange kernel/load primitives, BENCHMARK_ONLY adapter, central registry/index registration, focused tests/CLI, source-authority documentation, and relay/status/claim/backup custody. No workflow, HP numerical method, vibration authority, runtime, writer or canvas ownership change is part of this mission.

## Highest risk

Further production progress would require pretending an unexecuted focused test is a PASS or importing unqualified Code/master data. Both are prohibited. The source register improves traceability but does not remove those gates.

## EXACT_NEXT_ACTION

Run exactly:

```bash
node --test tests/flange-ug44-core.test.mjs tests/flange-ug44-registry.test.mjs
```

against the exact PR #706 head in a native checkout. Record `PASS` or `FAIL`. If PASS, re-ground main/open-PR overlap and then continue AUTO with the smallest governed flange/gasket master-data custody implementation. If FAIL, isolate and patch only the first wrong boundary.

## Durable relay

AUTO activation endpoint: `agents/agentchain/ENGCALC-BOLTED-JOINTS/EP-0004.md`.

Next durable endpoint records the validation hard stop.
