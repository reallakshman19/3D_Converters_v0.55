# PR #615 Work Report — Current Recovery Authority

## Recovery header

```text
WORK_INTENT        IMPLEMENT
REPOSITORY_STATE   EXISTING_PR
CRITICALITY        ENGINEERING_CRITICAL
EXECUTION_MODE     MANUAL / CONNECTOR-FIRST
BASE_BRANCH        main
BRANCH             agent/vibration-eit-roadmap-20260818
PR                 #615
PR_STATE           DRAFT / UNMERGED
MERGE_AUTHORITY    OWNER_ONLY / NOT_GRANTED
REPORT_BASIS_HEAD  4921ca566ef2db224b44a0695a3d3a3a54c8fbe7
REPORT_BASIS_MAIN  eef94949961970171d1366f5b6a9d421b3cc0d9f
```

`REPORT_BASIS_HEAD` is intentionally the pre-report recovery basis, not this file's containing commit.

Detailed stage records:

```text
agents/PR615_stage2_source_identity.md
agents/PR615_stage3_mechanism_reduction.md
agents/PR615_stage4_fit_frequency_custody.md
agents/PR615_stage5_measurement_custody.md
agents/PR615_stage6_measurement_persistence.md
agents/PR615_stage7_measurement_roadmap_resize.md
```

## Handover in 60 Seconds

PR615 currently owns:

```text
EnergyInstituteEit.v5 compatibility import
  -> VibrationIntegrityProject.v1 (.vibproj)
       -> validated VibrationMeasurementEvidencePackage.v1 persistence
  -> EngineeringMethodSource.v1
  -> non-binding VibrationRoadmapProjection.v1
       -> selected-line measurement DATA projection
       -> collapsible/resizable right rail
  -> MechanismNumericResult.v1
  -> MechanismLineResult.v1
  -> EiMainLineAggregation.v2

FIT facility data
  -> FitFacilityEngineeringBasis.v2
  -> FitFacilityNaturalFrequencyCustody.v1

Field evidence
  -> VibrationMeasurementSession.v1
  -> VibrationSignalProduct.v1
  -> VibrationMeasurementEvidencePackage.v1
```

Authority remains deliberately separated:

```text
.eit import / .vibproj        compatibility + persistence only
roadmap                       presentation/navigation only
measurement roadmap DATA      evidence-presence display only
source registry               source identity only
measurement session/product   evidence only
frequency custody             provenance only
mechanism reducer             reduction custody only
EI main-line aggregate        governed screening aggregate only
```

No persistence/UI/source/measurement/custody layer creates design, code, screening applicability, completion, or root-cause authority.

## Stage summaries

### Stage 1 — EIT / project / roadmap

Generic multi-module `.eit` compatibility import; deterministic `.vibproj`; transactional load; non-binding Phase × Scope × Specialty right roadmap; import/open/save/line selection. Imported values remain historical/review-required. Persisted current-result authority is rejected.

Historical reconstructed evidence: `25/25 PASS` on the corresponding Stage-1 surface.

### Stage 2 — method/source identity

`EngineeringMethodSource.v1`; distinct technical-module/section/flowchart/equation/table/figure/page locators. Ambiguous T2 labels remain reconciliation-required. Thermowell EI-T4 vs current ASME identity remains explicit conflict evidence.

Focused evidence: `10/10 PASS`.

### Stage 3 — mechanism reduction

```text
ASSESSMENT_UNIT_LOF != MECHANISM_LINE_LOF
one mechanism -> at most one EI main-line contributor
```

`ONE -> structural identity`, `ZERO -> INCOMPLETE`, `MANY -> INCOMPLETE` until a mechanism-specific reducer is qualified. No universal child max reducer. `EiMainLineAggregation.v2` consumes mechanism-line results only.

Focused evidence: reducer/result `8/8 PASS`; aggregation harness `4/4 PASS`.

### Stage 4 — FIT natural-frequency custody

Reused landed #582/#584/#586/#588 M5 basis work. Added `FitFacilityNaturalFrequencyCustody.v1`. A supplied frequency requires finite positive value, unit, source, source revision, record ID and status. Case-specific incomplete evidence cannot fall back to global. Absence remains valid for standard FIT.

Protected FIT numerical blobs remain unchanged. Focused evidence: `8/8 + 4/4 PASS`.

### Stage 5 — field measurement custody

Added `VibrationMeasurementSession.v1`, `VibrationSignalProduct.v1`, and `VibrationMeasurementEvidencePackage.v1`.

Raw acquisition references are immutable/hash-pinned. Derived evidence binds exact session/channel/raw hashes plus processing recipe/version. Package validation rejects dangling references, raw-hash mismatch, duplicate IDs and screening/design/RCA promotion. No signal-processing math exists.

Focused exact-byte evidence: `10/10 PASS`.

### Stage 6 — measurement evidence persistence

Validated measurement evidence can survive deterministic `.vibproj` save/open while remaining non-authoritative. Measurement sessions must reference project lines. Legacy non-empty `measurements[]` is rejected. Old V1 projects without `measurementEvidence` remain loadable. Persisted `currentResults` remain rejected.

Focused controlled reconstruction: `7/7 PASS` plus retained Stage-1 authority/current-result guards `2/2 PASS`.

### Stage 7 — measurement-driven VERIFY roadmap + adjustable right rail

Project roadmap state derives evidence-presence state only for the selected project line:

```text
selected-line MeasurementSession(s)
  -> Basic Vibration Measurement = DATA

selected-line derived SignalProduct(s)
  -> Specialist Measurement = DATA
```

`DATA` does not mean complete, acceptable, current screening result, or RCA conclusion. Evidence on another line does not light the selected line. Explicit mechanism/node presentation state remains a separate overlay.

`Specialist Measurement` is displayed in `VERIFY`; `Predictive Analysis / RCA` remains in `DIAGNOSE`. This is navigation taxonomy only.

Right-rail desktop policy:

```text
MIN        260 px
DEFAULT    320 px
MAX        520 px
COLLAPSED   44 px
```

The left edge is the resize separator. Pointer drag left widens; drag right narrows. Keyboard support:

```text
ArrowLeft   +16 px
ArrowRight  -16 px
Home         260 px
End          520 px
```

Collapsed state is a 44 px tab with `justify-self:end`, so it collapses toward/pins to the right. At `<=1180px`, the roadmap becomes a stacked row and the desktop resize separator is hidden.

During validation a real defect was detected and repaired: initial controller logic recycled project-derived measurement DATA as the next rebuild's mechanism input, allowing Line-1 evidence to become sticky after selecting Line 2. The controller now retains `explicitMechanismStates` separately from project-derived state.

Exact modified production blobs used in focused validation:

```text
project/roadmap.js          816729d1ea390d78f6ac588c26f92a996fe0aa8a
roadmap/registry.js         427cab8403483a2eff03452d3f3b704de1660c64
roadmap/projection.js       d84fcf51130340cf3f97917d5700ec479b0c6216
roadmap-panel.js            dfe6031a3ad9d7176e020b45bdce8b0f2e45e498
roadmap-controller.js       386c4158120fbfabbf4506db85816b4c745c8b5d
roadmap-panel.css           ebf59ceccfe2ea5aecba0aaa125d2ac9bc4446f1
```

Focused controlled reconstruction:

```text
selected-line basic measurement DATA                     PASS
selected-line specialist derived evidence DATA           PASS
other-line evidence isolation                            PASS
explicit presentation state overlay                      PASS
specialist measurement under VERIFY                      PASS
width clamp 260/320/520                                  PASS
expanded accessible resize separator                     PASS
collapsed right tab has no resize separator              PASS
explicit/project-derived controller separation           PASS
CSS variable width + right-pinned collapse               PASS
TOTAL                                                     PASS 10/10
```

All Stage-7 modified JS files remain below 300 lines; controller is 269 lines.

Browser pointer/keyboard acceptance remains `NOT_RUN`; source/Node checks are not browser evidence.

## Coordination

Known neighboring active ownership remains:

```text
#479 FIT workspace
#506 shared Engineering Calculations tab + AIV runtime
#508 SBC facility/workspace
#571 mechanism coverage/identification
#539/#540 FIT adapter/family/console presentation
```

Stage 7 touched only PR615-owned project/roadmap/right-panel paths and tests/recovery records. It did not edit the shared Engineering Calculations tab or FIT/AIV/SBC mechanism workspaces.

## Permanent negative assurance

PR615 does not authorize:

```text
new engineering equations or coefficients
automatic T1 applicability
unqualified multi-item reducers
measurement-to-LOF or measurement-to-screening substitution
measurement evidence as assessment-complete state
signal-processing algorithms
automatic RCA conclusions
persisted measurement evidence as current engineering authority
natural-frequency source-method inference
DN/schedule geometry inference
STANDARD/NORMAL process actualization inference
persisted current-result promotion
generic multi-module .eit export authority
design/code authority
Product Freeze
workflow changes
```

## Validation truth still NOT_RUN

```text
repository-native Stage-7 focused test in complete checkout
complete project/EIT test suite
existing full M5 suite
repository-native M4/matrix suite
full Vibration/FIT/AIV/SBC release suites
served browser pointer/keyboard acceptance
independent engineering review
```

No absent hosted status/workflow is treated as PASS.

## Current risks / debt

- branch still requires current-main reconciliation before merge qualification;
- mechanism-workspace project-context propagation remains blocked by #479/#506/#508;
- coverage integration remains owned by #571;
- AIV/deadleg MANY reduction remains unresolved and must not be guessed;
- signal-processing runtime and measurement acceptance/RCA rules remain unqualified;
- generic multi-module `.eit` export remains deferred;
- browser acceptance for drag/keyboard/responsive rail behavior remains outstanding.

## EXACT_NEXT_ACTION

Keep PR615 draft/unmerged. Final live reconciliation must quote the branch head after all recovery commits; do not try to make the report self-reference its containing commit. Before any merge attempt: reconcile current main, execute repository-native qualification in a complete checkout, perform served-browser acceptance for the right rail, and obtain independent engineering review. Do not merge without explicit Owner authorization.
