# PR706 Work Report

CHAIN_ID: ENGCALC-BOLTED-JOINTS
LEG_ID: LEG-01
PR: 706
BRANCH: agent/engcalc-bolted-joints-phase1-20260902
BASE_MAIN: bff53e336bdbddbe0fb829b7991ca5ed27fc836a
CHECKPOINT_HEAD: 7a764b7b58acceece0949069ffe1f439170f50e7
STATE: READY_FOR_REVIEW_BOUNDED_SLICE
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Start `Engineering Calculations -> Flanges & Joints` with a bounded rated-flange external-load kernel and 3D joint-load primitives, without silently widening into registry/UI or design authority.

## Delivered capability

- pure SI `FLANGE.RATED_LOAD.UG44B` arithmetic kernel;
- equivalent bending and opening-axial pressure components;
- rated-pressure cap on calculated maximum pressure;
- explicit acceptance-equation cross-form;
- joint-face moment transport `M_target = M_source + r x F`;
- opening-only axial force selection;
- resultant in-plane bending, transverse shear and torsion retention;
- direct Node CLI;
- analytical and PV Elite rounded-display regression source.

## Engineering authority

```text
engineeringAuthority = NONE_PENDING_SOURCE_QUALIFICATION
screeningAuthority   = NOT_AUTHORIZED
codeCompliance       = false
designAuthority      = false
registryIntegrated   = false
UIIntegrated         = false
```

## Source and benchmark state

The user-supplied PV Elite C101 report identifies ASME UG-44(b), attributes the method to PVP2013-97814, and displays the acceptance/Pmax relationships and nozzle examples. Its displayed inputs are rounded, so those examples are used only as rounded-input cross-solver checks with a declared 2% relative tolerance.

Independent arithmetic is protected by a hand-constructed SI fixture that exactly establishes equivalent pressure and Pmax without importing the production implementation.

## Validation truth

```text
source/architecture inspection           PASS
new-file JS/MJS line policy              PASS by inspection
small-function / named-export policy     PASS by inspection
reconstructed exact-authored Node tests  PASS 6/6
repository-native exact-checkout tests   NOT_RUN
hosted CI                                NOT_RUN
browser                                  NOT_APPLICABLE
independent engineering review           NOT_RUN
```

The 6/6 local execution is supporting reconstructed execution; it is not relabeled as repository-native validation.

## Coordination / overlap

Open PRs were inspected before mutation. No active claim was found over the new flange rated-load / bolted-joint numerical domain. Shared Engineering Calculations registry/UI files are intentionally not claimed or edited in this PR.

## Backup compliance

All source/test/CLI changes in the bounded implementation are new files. The relay-index promotion edit is preceded by backup generated using `node utils/backup.js save agents/agentchain.md ...` on exact branch bytes, with resulting artifacts committed under `.backups/`.

## Changed-file intent

- flange kernel and joint-load primitives;
- focused test and CLI;
- relay/workreport/status/claim artifacts;
- backup artifacts required for the relay-index update.

No workflow, existing numerical solver, writer, runtime, canvas or Engineering Calculations registry/UI file is modified.

## Highest risk

Current arithmetic is not yet production-authorized because code-edition/source qualification, flange/gasket database authority and native registry integration remain open.

## EXACT_NEXT_ACTION

In the next leg, perform a backup-compliant edit of the existing Engineering Calculations registry to expose the method only at a non-authorizing qualification state, after independently re-running the focused test in a native checkout and re-grounding shared-file overlap.
