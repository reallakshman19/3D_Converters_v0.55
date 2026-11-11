# P4/P5 flange strength and rigidity source qualification

Programme: `ENGCALC-BOLTED-JOINTS` / issue #721

State: `SOURCE_QUALIFICATION_ONLY`

This note records what the two owner-supplied legacy flange workbooks actually expose and, equally importantly, what they do **not** establish. It does not turn either workbook into Code authority and it does not authorize a production solver.

## Sources under review

1. `docs/flange/flange design to BS5500.xls`
2. `docs/flange/Integral-type Flange Rigidity Calc - ASME VIII Div 2 App M - UNCHECKED.xls`

The source bytes are already under repository custody through the owner-supplied `docs/flange/` package. This review is restricted to source qualification and implementation admission.

## P4 — `flange design to BS5500.xls`

### What the workbook visibly contains

Recoverable workbook text identifies a detailed bolted-flange calculation with inputs and result sections for:

- design pressure and temperature;
- flange and hub/shell materials;
- gasket type and gasket contact-face geometry;
- bolting material and bolt geometry;
- corrosion allowance and design stresses;
- loads and bolting;
- moment arms and moments;
- flange shape constants;
- operating-condition and bolt-up stress calculations;
- applied/calculated/total flange moment;
- flange-stress and bolt-area conclusions.

The workbook also exposes named quantities and displayed relationships including `N`, `bo`, `b`, `G`, `Am1`, `Am2`, `Am`, `Ab`, `W`, `Wm1`, `Wm2`, `H`, `Hd`, `Ht`, `Hg`, `hd`, `ht`, `hg`, `ho`, `K`, `Cf`, `M`, `Sh`, `Sr` and `St`.

Examples of recoverable displayed text include:

```text
N=(o.d. - i.d.)/2
bo=N/2
G = o.d. - 2b
Am1 = Wm1/Sb
Am = max(Am1, Am2)
Ab=No.Bolts.root area
W = (Ab + Am).Sa/2
Am2=Wm2/Sa
Ht = H - Hd
hd = (C-B-g1)/2
ht = (2C-B-G)/4
ho = sqrt(B.go)
K = A/B
Moment M = Mop.Cf/B
Sh =f.M/(l.g1^2)
Sr =f.M/(B.t^2)
St=MY/t^2 - Z.Sr
```

Other displayed formula strings are visibly incomplete or damaged by legacy binary/text extraction, for example tokens around `b=min(...)`, pressure load terms, area terms, and shape-factor expressions. Those strings must **not** be silently repaired from engineering memory or assumed to mean a modern standard equation.

### What this source does not establish

The workbook does not, from the currently recoverable evidence, establish all of the following to a production standard:

- exact BS 5500 edition/amendment and applicable clause/table/figure identities for every equation;
- unambiguous cell formulas for every displayed term;
- provenance of all shape constants and coefficients;
- current applicability relative to the project's governing flange design standard;
- independent verification of the workbook implementation;
- a validated mapping between the workbook's notation and the application's canonical flange geometry/load model.

### P4 admission decision

`P4_IMPLEMENTATION = BLOCKED_SOURCE_DETAIL`

Before implementing a governing detailed flange-strength kernel, obtain either:

1. an exact formula-level transcription of the relevant workbook cells **and** independently benchmark it, or
2. a controlled governing standard/source with exact equation, table, figure and applicability identity.

A future implementation may use the workbook as `LEGACY_BENCHMARK_ONLY` evidence. It must not infer missing symbols or import the workbook's acceptance conclusion as design authority.

## P5 — integral-flange rigidity workbook

### What the workbook visibly contains

Recoverable text explicitly identifies:

```text
REF: ASME VIII DIV2 Appendix M - Integral Type Flange
```

and exposes inputs/terms for:

- total moment acting in the flange;
- modulus of elasticity at temperature;
- hub thickness at the small end;
- rigidity factor for an integral flange;
- flange outside diameter, inside diameter and thickness;
- a factor involving `K` identified with figure `3-340.1`;
- integral-flange factors identified with figures `3-340.2` and `3-340.3`;
- `Rigidity Index`;
- `Equation : M400 (1)`.

The equation content itself is stored in legacy embedded Microsoft Equation/OLE objects, and the recoverable text does not expose enough equation detail to reconstruct those expressions safely.

The source filename itself is explicitly marked `UNCHECKED`.

### What this source does not establish

The workbook does not establish:

- a checked/approved calculation pedigree;
- exact current Code edition and current applicability of the cited Appendix M / figure numbering;
- machine-readable expressions for the embedded equations;
- independently verified numerical fixtures;
- current acceptance limits and their applicability;
- production authority for a rigidity calculation.

### P5 admission decision

`P5_IMPLEMENTATION = BLOCKED_UNCHECKED_SOURCE_AND_EQUATIONS`

Do not implement a production rigidity solver by guessing the embedded equations. First acquire/verify the exact controlled source, establish the historical-to-current Code mapping if relevant, extract the complete formulas, and independently reproduce at least one numerical case.

## Common authority boundary

```text
sourceRole             LEGACY_REFERENCE_AND_BENCHMARK
codeCompliance         false
designAuthority        false
governingEligible      false
productionAuthorized   false
```

No real material allowables, gasket factors, flange constants, acceptance limits or Code table data are promoted by this qualification.

## Relationship to P2/P3

P2 PR #731 still has exact focused execution `NOT_RUN / ENVIRONMENT_BLOCKED`.

P3 PR #732 has supporting `PASS 18/18 / SOURCE_RECONSTRUCTED`, while exact native PR-head execution remains `NOT_RUN / ENVIRONMENT_BLOCKED`.

The owner's instruction to proceed permits this **source-qualification** step; it is not evidence that the outstanding P2/P3 validation gates passed.

## Exact next engineering action

For P4, perform formula-level source recovery/controlled-source acquisition before writing a detailed flange-strength kernel. Prioritize the P4 strength method before P5 rigidity because the P5 workbook is explicitly `UNCHECKED` and its equations are embedded rather than recoverable as plain text.

If exact source recovery is unavailable, preserve both P4 and P5 as blocked and proceed only to another independently separable backlog item with an explicit owner sequencing decision.