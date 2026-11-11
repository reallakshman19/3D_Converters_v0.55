# Bolted Joints / Flanges — P1 Controlled Source Qualification

Status: `PARTIAL / SOURCE GATES IDENTIFIED / NO AUTHORITY PROMOTION`

Issue: `#721`

Chain: `ENGCALC-BOLTED-JOINTS`

Baseline inspected: `main@78b361d1f649d41378f568ebe1a237c4bc140c73`

Date: `2026-09-04`

## Purpose

This checkpoint advances P1 of issue #721 by separating what is established by the committed source package and current public standards metadata from what still requires controlled licensed/project source material.

It does **not** promote any calculation, master record, assembly procedure, Code compliance flag, design authority, or governing eligibility.

## P0 carry-forward

An exact unmodified repository checkout at `541d92b480756c031a30c4e9101b4ec29df1e08d` executed the flange/bolt numerical suites with `64/64 PASS` on Node `v22.22.2`. The Engineering Calculation Console suite remained `18/20` because of two pre-existing vibration-family presentation assertions outside the bolted-joint/flange authority domain.

A repository compare from `541d92b...` to current `main@78b361d...` shows no changes to the bolted-joint/flange calculation kernels, their focused tests, the Engineering Calculation engine/registry/unit files used by those tests, or the scalar bolt adapters. Current-main drift is confined to source-file custody, vibration work, package metadata, agent records, and a separate Engineering Calculations tab integration change. Therefore the `64/64` numerical result remains valid for the unchanged tested bytes, while console acceptance remains separately open.

## Source authority matrix

| Source | Verified public/current fact | Qualification for this programme | What remains unresolved |
|---|---|---|---|
| ASME BPVC Section VIII Division 1 | ASME public product page identifies `BPVC.VIII.1 - 2025` | `AUTHORITATIVE_EDITION_IDENTITY` | Licensed 2025 UG-44(b) clause text, tables, footnotes, cross-references, applicability and exact current method wording are not in the evidence set |
| ASME B16.5 | ASME public product page identifies `B16.5 - 2025`; scope includes pressure-temperature ratings, materials, flange/bolting/gasket/joint requirements for NPS 1/2 through 24 | `AUTHORITATIVE_EDITION_IDENTITY_AND_SCOPE` | Exact pressure-temperature rating rows, material-group mapping, temperature interpolation rules, and project-selected records are not controlled in the repository |
| ASME B16.47 | ASME public product page identifies `B16.47 - 2025`; scope covers NPS 26 through 60 and pressure-temperature ratings | `AUTHORITATIVE_EDITION_IDENTITY_AND_SCOPE` | Exact pressure-temperature rating rows, series/material mapping and project-selected records are not controlled in the repository |
| ASME PCC-1 | ASME public product page identifies `PCC-1 - 2022`; scope is pressure-boundary bolted flange joint assembly with ring-type gaskets within the bolt circle | `AUTHORITATIVE_EDITION_IDENTITY_AND_SCOPE` | Exact project assembly procedure, target bolt stress/preload selection, tightening passes, allowable scatter, tool/friction control and acceptance criteria are not established by public metadata |
| ASME Code Cases for Section VIII | ASME public product metadata identifies the Section VIII Code Cases compilation; a historical 2019 index lists Case 2901 for external-load evaluation of welding-neck flanges under UG-44(b)/(i)/(j) and Division 2 equivalents | `HISTORICAL_CASE_IDENTITY / CURRENT_REVISION_UNRESOLVED` | Current Case 2901 revision/status, exact current text and relationship to the selected 2025 project Code basis |
| PVP2013-97814, Warren Brown | Method provenance for external-load flange evaluation | `PRIMARY_METHOD_PROVENANCE` | Not governing Code/design authority |
| NASA RP-1228 Fastener Design Manual | Public engineering reference for the detailed thread/bearing friction torque relation used by the reference kernel | `QUALIFIED_FOR_REFERENCE_EQUATION` | Does not establish project friction data, PCC-1 compliance, preload targets or design allowables |
| PV Elite C101 report | Displays UG-44 equation/Pmax form, opening-only axial treatment and rounded cross-solver examples; report identifies B16.5/B16.47 2025 ratings | `CROSS_SOLVER_BENCHMARK` | Not governing Code source; displayed inputs are rounded and cannot qualify master tables |
| `Flange UG 44(1).xlsx` + `Flange Rating Vs Nozzle loads -Rev.3.xlsx` | Legacy workbook behaviour and test rows | `LEGACY_CALCULATION_DATA` | Not independent corroborating sources; not master authority |
| `Bolt Torque Calc(1).xls` | Legacy detailed friction/stress implementation evidence | `LEGACY_CALCULATION / IMPLEMENTATION_EVIDENCE` | Contains a documented internal unit inconsistency; not assembly-procedure authority |
| `Bolt Torques(1).xls` | Legacy short-form K-factor/preload/torque evidence | `LEGACY_CALCULATION` | Design column is hand-rounded; does not establish universal K or preload percentage |
| Abid/Khan tightening-method paper | Shows torque-control sensitivity to friction, installation torsion, elastic interaction, bolt preload scatter and gasket-stress variation; compares torque and stretch control for a specific joint | `RESEARCH / ASSEMBLY-BEHAVIOR EVIDENCE` | Study-specific results are not universal assembly limits or project acceptance criteria |

## P1.1 — UG-44 / rated-flange method

### Established

1. The current public BPVC VIII-1 edition identity is 2025.
2. The programme's scalar reference relation is independently corroborated by the PV Elite C101 report and historical Case 2901 evidence.
3. The C101 report supports opening/tensile-only axial-force treatment and `Pmax` capped by the flange pressure rating.
4. B16.5-2025 and B16.47-2025 are the current public edition identities relevant to the report's pressure-rating basis.
5. The committed legacy workbook uses its own conventions for `G`, `PD` and `ME`; those conventions remain regression evidence and are not promoted to Code derivations.

### Not established

The repository still lacks controlled licensed/project evidence for:

- exact 2025 UG-44(b) equation wording and all applicability text;
- current Case 2901 revision/status if the project elects to use the Case;
- `FM` table values and applicability;
- B16.5/B16.47 rating rows and material-group mapping;
- governed `G` derivation;
- bolt-material/assembly requirements referenced by the governing method.

Disposition: `UG44_METHOD_AUTHORITY = BENCHMARK_ONLY`.

## P1.2 — Bolt preload / assembly method

### Established

1. Canonical joint quantity remains clamp/preload; torque is an assembly control/output.
2. `T = K F d` is retained only as an explicit-input short-form relationship.
3. The detailed V-thread model separates thread and bearing friction and requires explicit friction/geometry inputs.
4. Installation-state bolt strength uses axial preload plus transmitted thread-torque torsion as a reference mechanics model.
5. Torque-controlled assembly can produce significant scatter and installation torsion; the supplied research paper supports preserving these effects as explicit limitations.
6. PCC-1-2022 is the current public ASME product edition identity for pressure-boundary bolted flange joint assembly.

### Not established

No project-controlled source currently defines:

- target preload basis or allowable preload range;
- the engineering meaning of `referenceStress` for the project;
- qualified `K`, thread-friction or bearing-friction ranges by finish/coating/lubricant/reuse/temperature;
- assembly sequence/pass requirements;
- allowed bolt-stress scatter or tool accuracy;
- whether residual tightening torsion is retained, partially relaxed or excluded in later operating-state checks;
- when torque, hydraulic tensioning, turn-of-nut or measured elongation is the approved assembly method.

Disposition: `BOLT_ASSEMBLY_AUTHORITY = REFERENCE_KERNEL_ONLY`.

## Required controlled-source package to close P1

P1 can be closed only when the project supplies or formally selects controlled evidence covering the following minimum package:

```text
A. BPVC VIII-1 2025 UG-44(b)
   - exact licensed clause/table/footnotes/cross-references
   - declared project edition-of-record

B. Code Case decision
   - current controlled Case 2901 text/revision if used
   - explicit project decision: use / do not use / superseded by incorporated Code text

C. B16 flange ratings
   - B16.5-2025 controlled pressure-temperature tables
   - B16.47-2025 controlled pressure-temperature tables where applicable
   - material-group mapping and interpolation rules

D. Bolted-joint assembly procedure
   - PCC-1-2022 controlled clauses/appendices used by the project, or approved project procedure derived from them
   - target bolt stress/preload definition
   - tightening method, passes/sequence, tool control and verification
   - friction/K qualification basis and scatter treatment

E. Thread/material properties
   - controlled thread geometry/stress-area basis
   - controlled bolt/nut material strength/reference values at temperature
```

## P2 admission rule

P2 may proceed only in **schema/custody mode** until the controlled package above is available. Synthetic/test records may be used to exercise exact-match lookup and provenance behavior, but real B16 rating values, `FM`, governed `G`, bolt material strengths, or friction/K ranges must not be activated from the legacy workbooks or public metadata alone.

## Authority state after this checkpoint

```text
FLANGE.RATED_LOAD.UG44B
  calculationState  = BENCHMARK_ONLY
  codeCompliance    = false
  designAuthority   = false
  governingEligible = false

Bolt scalar calculations
  methodAuthority   = REFERENCE_KERNEL_ONLY
  codeCompliance    = false
  designAuthority   = false
  governingEligible = false

Real flange/bolt/friction master data
  productionAuthority = NOT_ESTABLISHED
```

## Public references used for edition/scope identity

- ASME BPVC VIII-1 product page: `https://www.asme.org/codes-standards/find-codes-standards/bpvc-viii-1-bpvc-section-viii-rules-construction-pressure-vessels-division-1`
- ASME B16.5-2025 product page: `https://www.asme.org/codes-standards/find-codes-standards/b16-5-pipe-flanges-flanged-fittings-nps-1-2-nps-24-metric-inch-standard/2025`
- ASME B16.47-2025 product page: `https://www.asme.org/codes-standards/find-codes-standards/b16-47-large-diameter-steel-flanges-nps-26-nps-60-metric-inch-standard/2025`
- ASME PCC-1-2022 product page: `https://www.asme.org/codes-standards/find-codes-standards/pressure-boundary-bolted-flange-joint-assembly/2022/print-book`
- ASME Section VIII Code Cases product page: `https://www.asme.org/codes-standards/find-codes-standards/code-cases-boilers-and-pressure-vessels-section-viii-pressure-vessels`

Public product metadata establishes edition/scope identity only; it is not a substitute for licensed technical clauses or project-approved source records.
