# GRE / FRP Flange Equivalent-Pressure Source Qualification

## Scope

This record qualifies the owner-supplied legacy workbook `FLANGE LEAKAGE CHECK GRE.xls` only far enough to determine what can be reproduced as a non-authorizing Engineering Calculations benchmark/screening method.

It does **not** qualify a physical leakage-rate model, gasket contact/seating stress method, flange-separation model, or project/design authority.

## Exact source custody

Repository source path:

`docs/flange/FLANGE LEAKAGE CHECK GRE(1).xls`

Owner-uploaded source used for formula recovery:

`FLANGE LEAKAGE CHECK GRE.xls`

Byte identity was checked against the repository blob:

```text
bytes       437760
SHA-256     44dd5e17daac62274f75bced45532b8c3344e293630c8a99226b996ca496d49f
Git blob    2ba444cf85d0130b86a2e079c11c5bc4f06a72b0
```

The local owner-uploaded bytes reproduce the repository Git blob SHA exactly.

## Workbook identity and visible method statement

The workbook contains sheets:

- `Table`
- `HYD`
- `SUS`
- `DES`
- `Equivalent FLG`

Visible workbook text identifies:

`Wavistrong/Fibrestrong leakage test by equivalent pressure method as per memo ref. no.KRO/604201v0 dated 02-06-2006`

The referenced memo itself is not present in the controlled source package. Its applicability, derivation and authority therefore remain unresolved.

## Formula-level recovery

The legacy OLE/BIFF8 workbook was inspected at record level rather than inferred from cell labels.

Observed formula inventory:

```text
Table sheet               224 FORMULA records
Equivalent FLG sheet      231 FORMULA records
Equivalent FLG shared      13 SHRFMLA groups
```

The `Equivalent FLG` calculation chain is directly recoverable from BIFF tokens and visible formula captions.

### Qualified-pressure instance

For the populated `Equivalent FLG` rows in this workbook:

```text
Pq = 2 * PN
```

where `PN` is the flange rating in barg and `Pq` is the workbook's `Qualified pressure (barg)`.

This is a workbook-instance rule only. It is not promoted as a general manufacturer or project rule because the source memo and qualification basis are not controlled here.

### Bending equivalent pressure

With bending moment `Mb` in N·m and mean gasket diameter `G` in mm:

```text
PEQbending [MPa] = 16 * Mb * 1000 / (PI() * G^3)
```

The factor `1000` converts N·m to N·mm.

### Axial equivalent pressure

With axial force `F` in N and `G` in mm:

```text
PEQaxial [MPa] = IF(F = "NA", 0, 4 * ABS(F) / (PI() * G^2))
```

Both tensile and compressive numeric axial loads therefore contribute by magnitude in the recovered equivalent-pressure calculation. This must not be conflated with the opening-only axial-force treatment used by the separate UG-44 reference method.

### Equivalent flange pressure

For each load category:

```text
PFD [barg] = PSYS [barg] + 10 * (PEQbending [MPa] + PEQaxial [MPa])
```

The factor `10` converts MPa to bar.

### Recovered part factors

Named workbook factors resolve to:

```text
f2d = 0.56 * 1.24 = 0.6944   design / long-term including thermal effects
f2s = 0.56 * 1.00 = 0.56     sustained / long-term excluding thermal effects
f2h = 0.56 * 1.33 = 0.7448   hydrotest / short-term
```

### Pass/fail rule

The workbook evaluates:

```text
PFD <= f2 * Pq
```

and displays `Pass` / `Fail` accordingly.

## Independent replay against workbook cached results

Rows 13 through 22 of `Equivalent FLG` contain ten complete populated examples.

The recovered equations were independently recalculated from the stored inputs using exact SI/mm conversions and compared with the workbook cached results:

```text
populated rows                         10
Pq values checked                      10
PEQbending values checked              30
PEQaxial values checked                30
PFD values checked                     30
numeric comparisons total             100
numeric mismatches                       0
pass/fail inequalities checked         30
pass/fail mismatches                     0
```

Representative row 13:

```text
PN = 20 barg
Pq = 40 barg
G = 764 mm
Design:    F = -847 N, Mb = 22 N.m, PFD = 10.020988489867708 barg
Sustained: F = -750 N, Mb = 15 N.m, PFD = 10.018073145831986 barg
Hydrotest: F = -781 N, Mb = 11 N.m, PFD = 15.018292536120411 barg
```

The replay reproduces these cached values exactly at binary-double comparison precision.

## Engineering interpretation

The recovered chain converts external bending and axial load into pressure-like terms and adds them to system pressure before comparison with a factored qualified-pressure quantity. It is therefore an **equivalent-pressure screening calculation**.

It does not calculate leakage flow, leakage probability, gasket compression distribution, residual gasket stress, flange rotation/contact opening, bolt-load redistribution, or separation margin.

The workbook title/labels use the word `leakage`, but the mathematics recovered from the calculation sheet does not constitute a physical leak-rate model.

## Admission decision

```text
sourceRole                   LEGACY_EQUIVALENT_PRESSURE_SCREENING
formulaRecovery              PASS
workbookFixtureReplay         PASS_100_OF_100_NUMERIC_AND_30_OF_30_CHECKS
controlledMemoBasis           UNRESOLVED
physicalLeakRateModel         NOT_PRESENT
contact/separationModel       NOT_PRESENT
codeCompliance                false
designAuthority               false
governingEligible             false
productionAuthorized          false
```

A separately named `LEGACY_BENCHMARK_ONLY` or `SCREENING_REFERENCE_ONLY` kernel may reproduce the recovered equation chain using explicit inputs.

## Implementation constraints

Any implementation based on this workbook must:

1. call the result `equivalent pressure` or `screening pressure`, never a predicted leak rate;
2. expose the system pressure, mean gasket diameter, flange/qualified pressure, part factor, axial force and bending moment explicitly;
3. preserve load-category identity and governing case;
4. treat the recovered `Pq = 2*PN` and `f2` factors as source-workbook data, not hidden universal defaults;
5. keep gasket seating/contact stress and flange separation outputs `NOT_MODELED` unless separately qualified;
6. remain non-authorizing until the source memo/project basis and applicability are controlled and independently reviewed.

## Next engineering action

Implement only the recovered equivalent-pressure screen as a fail-closed non-authorizing kernel with explicit SI inputs and workbook-regression fixtures. Do not add a leak-rate output, gasket-stress acceptance, separation/contact mechanics, central registry entry, or UI integration in the same minimal patch.
