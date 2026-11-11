# FLANGE.RATED_LOAD.UG44B — Source Authority Register

Status: `BENCHMARK_ONLY / NOT CODE OR DESIGN AUTHORITY`

Chain: `ENGCALC-BOLTED-JOINTS`

PR: `#706`

## Purpose

This register separates calculation provenance, governing authority, master-data authority, and validation evidence for `FLANGE.RATED_LOAD.UG44B`. It does not promote the registered calculation above `BENCHMARK_ONLY` and does not populate production flange/gasket masters.

## Production method boundary

The current kernel evaluates the scalar relationship using explicit caller inputs:

- `PR` — flange pressure-temperature rating;
- `PD` — flange design pressure;
- `G` — gasket reaction diameter;
- `FM` — moment factor;
- `ME` — resolved in-plane bending moment at the flange face;
- `FE` — opening/tensile axial force at the flange face.

The kernel does **not** currently derive `PR`, `G`, or `FM` from ASME tables or master data. Therefore the arithmetic implementation and the engineering authority of those inputs are separate qualification problems.

## Source ledger

| Source | Classification | What it supports | What it does not support | Production disposition |
|---|---|---|---|---|
| ASME BPVC Section VIII Division 1, 2025 official ASME product metadata | `AUTHORITATIVE_EDITION_IDENTITY` | Confirms the current public ASME product edition is BPVC VIII-1 2025 | Does not expose licensed UG-44(b) clause/table text in the evidence set | Required governing edition; exact method/table verification remains unresolved |
| ASME PVP2013-97814, Warren Brown, *Improved Analysis of External Loads on Flanged Joints* | `PRIMARY_METHOD_PROVENANCE` | Origin/provenance of the rated-flange external-load methodology | Not itself Code/design authority | Retain as method provenance and technical background |
| Code Case 2901 public reproduction / historical text | `HISTORICAL_CODE_CASE_EVIDENCE` | Shows the historical equation form and applicability concepts that preceded/incorporated into UG-44(b) | Public reproduction is not controlled current ASME authority; later revisions exist | Benchmark/source-trace evidence only until controlled current revision is verified |
| User-supplied PV Elite C101 nozzle-flange MAWP report | `CROSS_SOLVER_BENCHMARK` | Identifies UG-44(b), displays the equation/Pmax form, opening-only axial treatment, pressure-rating cap behavior, and numerical nozzle examples | Does not replace the governing Code; displayed values are rounded; does not independently qualify master tables | Accepted cross-solver benchmark only |
| `Flange UG 44.xlsx` and `Flange Rating Vs Nozzle loads -Rev.3.xlsx` | `LEGACY_CALCULATION_DATA` | Useful regression rows and evidence of prior project usage | Contains manually altered/scenario data and ungoverned values; not Code authority | Do not import directly as production master authority |
| Secondary technical articles describing UG-44(b)/Code Case 2901 | `SECONDARY_REFERENCE` | Useful for locating method history, revisions, and implementation cautions | Not a governing engineering source | Discovery/reference only |

## Current official edition evidence

Official ASME public metadata identifies `BPVC.VIII.1 - 2025` as the current Section VIII Division 1 product edition.

Reference:

`https://www.asme.org/codes-standards/find-codes-standards/bpvc-viii-1-bpvc-section-viii-rules-construction-pressure-vessels-division-1`

This evidence establishes edition identity only. The exact licensed 2025 `UG-44(b)` text, table values, footnotes, and cross-referenced requirements are not present in the repository evidence set and remain `UNRESOLVED`.

## Method provenance

The method is traced to Warren Brown's ASME PVP paper:

`PVP2013-97814 — Improved Analysis of External Loads on Flanged Joints`

DOI:

`10.1115/PVP2013-97814`

The paper is technical provenance, not a substitute for the governing BPVC edition.

## Historical Code Case evidence

Public reproductions of Code Case 2901 show the relationship in the form:

`16 ME + 4 FE G <= pi G^3 [(PR - PD) + FM PR]`

and identify applicability controls including welding-neck-flange scope, assembly bolt-load requirements, bolt-material requirements, consistent units, and use of external tensile axial force.

Later secondary sources report revisions to Code Case 2901 after the original 2017 approval. Consequently, historical `FM` values or applicability text must not be frozen into production from an old reproduction without controlled verification against the currently selected Code basis.

## Cross-solver benchmark custody

The supplied PV Elite C101 report is retained as an independent solver comparison, not an authority source. It supports regression of:

- the scalar equation form;
- `Pmax` pressure-cap behavior;
- opening/tensile axial force treatment;
- examples for multiple nozzle sizes/load states;
- linkage to ASME B16.5 / B16.47 pressure ratings in the report output.

Because the report displays rounded inputs, those rows must not be used to reverse-author exact table values or tighten tolerances beyond what the displayed precision supports.

## Production authority gates

Before `FLANGE.RATED_LOAD.UG44B` can be considered for authority above `BENCHMARK_ONLY`, all of the following must be controlled and verified:

1. **Governing method** — licensed/controlled 2025 BPVC VIII-1 UG-44(b) or explicitly selected current approved Code Case basis, including all applicability clauses and footnotes.
2. **Moment factor `FM`** — table/source, edition/revision, flange type, size/class applicability, interpolation prohibition/permission, and any revision-specific changes.
3. **Pressure rating `PR`** — governed ASME B16.5/B16.47 edition, material group, class, temperature, and pressure-temperature rating lookup.
4. **Gasket reaction diameter `G`** — governed derivation from the applicable Code/gasket geometry rather than a free spreadsheet constant.
5. **Bolting/assembly applicability** — current bolt-material and assembly/preload requirements referenced by the governing method.
6. **Flange applicability** — exact permitted flange types/standards/sizes/classes and exclusions.
7. **Static-head/pressure reference** — explicit definition of `PD` at the flange and pressure reference convention.
8. **Independent validation** — exact-head focused tests plus at least one controlled authoritative worked reconstruction and cross-solver benchmark.
9. **Browser/result semantics** — UI must continue to distinguish arithmetic equation satisfaction from Code/design acceptance.

## Master-data custody contract — proposed, not yet production data

Any future governed flange record supporting this method should carry at minimum:

```text
standard
standardEdition
nominalSize
pressureClass
series
flangeType
materialGroup
temperature
pressureRating
pressureUnit
momentFactor
momentFactorSource
momentFactorRevision
gasketReactionDiameterBasis
sourceDocument
sourceSectionOrTable
sourceRevision
qualificationState
reviewedBy
reviewDate
```

`PR`, `FM`, and `G` should never be silently sourced from an unversioned spreadsheet row.

## Explicit unresolved items

- Exact licensed 2025 UG-44(b) equation/table/footnote verification: `UNRESOLVED`.
- Current active Code Case 2901 revision and its relationship to the selected 2025 Code basis: `UNRESOLVED`.
- Controlled B16.5/B16.47 2025 pressure-temperature master records: `UNRESOLVED`.
- Controlled `FM` table master records: `UNRESOLVED`.
- Controlled gasket reaction-diameter derivation: `UNRESOLVED`.
- Focused exact-head Node test execution: `NOT_RUN`.
- Browser acceptance: `NOT_RUN`.
- Independent engineering review: `NOT_RUN`.

## Protected interpretation

Until the unresolved gates above are closed:

```text
calculationState   = BENCHMARK_ONLY
codeCompliance     = false
designAuthority    = false
governingEligible  = false
```

`equationSatisfied = true` means only that the implemented reference relationship is numerically satisfied for the supplied inputs. It must not be published as a Code-compliance or design-acceptance statement.
