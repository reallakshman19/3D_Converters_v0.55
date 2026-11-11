# PR615 Stage 7 — Measurement-Driven Roadmap + Resizable Right Rail

## Scope

Stage 7 makes the existing non-binding vibration roadmap consume validated project measurement evidence and improves the right-side rail interaction.

```text
validated .vibproj measurementEvidence
  -> selected-line presentation state
  -> Basic Measurement / Specialist Measurement roadmap nodes

right rail
  -> collapse toward the right
  -> adjustable desktop width
```

No screening/applicability/result/RCA authority is created.

## Grounding

```text
WORK_INTENT       IMPLEMENT
CRITICALITY       ENGINEERING_CRITICAL
PR                #615
BRANCH            agent/vibration-eit-roadmap-20260818
START_HEAD        acdafae62987c89c8f4f43e2826e4589e50075a1
START_MAIN        eef94949961970171d1366f5b6a9d421b3cc0d9f
MERGE_AUTHORITY   NOT_GRANTED
```

PR615 already owns `converters/vibration/project/**`, `converters/vibration/roadmap/**`, and the three `tabs/vibration-roadmap-*` presentation paths. Active FIT/AIV/SBC workspaces and the shared Engineering Calculations tab remain excluded.

## Implementation

`converters/vibration/project/roadmap.js` now derives presentation-only node state from the validated measurement package for the selected project line:

```text
selected-line MeasurementSession count > 0
  -> basic-measurement.dataState = DATA_AVAILABLE

selected-line derived SignalProduct count > 0
  -> specialist-measurement.dataState = DATA_AVAILABLE
```

Messages expose session/channel/product counts only. They do not assert completion, acceptance, applicability, screening result, or RCA conclusion.

Explicit mechanism/node presentation state is merged over measurement-derived state. The controller keeps that explicit state separately so derived evidence from one line cannot become sticky when another line is selected.

`specialist-measurement` is presented in `VERIFY` with `basic-measurement`; `Predictive Analysis / RCA` remains in `DIAGNOSE`. This is a navigation taxonomy only.

### Right rail

Desktop width policy:

```text
MIN      260 px
DEFAULT  320 px
MAX      520 px
```

The panel uses `--vibration-roadmap-width` for the third grid column. A left-edge separator supports pointer drag and keyboard resizing:

```text
ArrowLeft   wider by 16 px
ArrowRight  narrower by 16 px
Home        260 px
End         520 px
```

Collapsed presentation uses a 44 px grid column and `justify-self:end`, so the rail collapses toward/pins to the right. The resize separator is absent while collapsed.

At responsive widths (`<=1180px`) the roadmap becomes a stacked row and the desktop resize separator is hidden. A collapsed responsive rail remains a 44 px right-aligned tab.

## Validation

Test-first commits were created before production mutation. During validation a stale-state defect was found: the initial controller fed project-derived measurement node state back into the next project rebuild. That would allow Line-1 `DATA` to remain after switching to Line 2. A dedicated regression was added before the repair; the controller now maintains `explicitMechanismStates` separately.

Controlled reconstructed execution on modified production files whose local Git hashes exactly match committed blobs:

```text
project/roadmap.js          816729d1ea390d78f6ac588c26f92a996fe0aa8a  64 lines
roadmap/registry.js         427cab8403483a2eff03452d3f3b704de1660c64  64 lines
roadmap/projection.js       d84fcf51130340cf3f97917d5700ec479b0c6216  98 lines
roadmap-panel.js            dfe6031a3ad9d7176e020b45bdce8b0f2e45e498  36 lines
roadmap-controller.js       386c4158120fbfabbf4506db85816b4c745c8b5d  269 lines
roadmap-panel.css           ebf59ceccfe2ea5aecba0aaa125d2ac9bc4446f1  9 physical lines
```

Syntax:

```text
node --check project/roadmap.js        PASS
node --check roadmap/registry.js       PASS
node --check roadmap/projection.js     PASS
node --check roadmap-panel.js          PASS
node --check roadmap-controller.js     PASS
```

Focused Stage-7 controlled harness:

```text
selected-line basic measurement DATA                     PASS
selected-line specialist derived evidence DATA           PASS
other-line evidence does not leak                        PASS
explicit presentation state overlays evidence            PASS
specialist measurement appears under VERIFY              PASS
width clamp 260/320/520                                  PASS
expanded resize separator                                PASS
collapsed rail has no resize separator                   PASS
controller separates explicit vs project-derived state   PASS
CSS variable width + right-pinned collapse               PASS
TOTAL                                                     PASS 10/10
```

The controlled harness uses exact modified production bytes and minimal stubs for unrelated imports. It is not represented as a complete-checkout repository test.

## Authority invariants

```text
MEASUREMENT_EVIDENCE_NE_SCREENING_RESULT
ROADMAP_DATA_STATE_NE_ASSESSMENT_COMPLETE
ROADMAP_RESIZE_NE_ENGINEERING_STATE
COLLAPSE_RESIZE_PRESENTATION_ONLY
NO_SHARED_TAB_MUTATION
NO_MECHANISM_WORKSPACE_MUTATION
```

## NOT_RUN

```text
repository-native Stage-7 test in complete checkout   NOT_RUN
served browser pointer/keyboard acceptance            NOT_RUN
full Vibration/FIT/AIV/SBC release suites             NOT_RUN
independent engineering review                        NOT_RUN
```

Do not treat source inspection or Node reconstruction as browser acceptance. Keep PR615 draft/unmerged and reconcile current `main` before merge qualification.
