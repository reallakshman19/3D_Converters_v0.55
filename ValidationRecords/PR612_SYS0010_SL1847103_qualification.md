# PR #612 — SYS-0010 / SL-1847103 qualification record

## Scope

Benchmark-anchored qualification for the reported XML→CII(2019) standalone defect at `SL-1847103.2.1`.

This record deliberately distinguishes **recovered source evidence** from **qualification reconstruction**. The repository contains the real `Benchmarks/css/SYS-0010.xml`, but the complete original StagedJson used during the failing JsonTrace run is not committed. Only the reported REST record is recoverable from the prior defect evidence.

## Real benchmark XML evidence

From `Benchmarks/css/SYS-0010.xml`:

- NodeNumber: `140`
- NodeName: `SL-1847103.2.1`
- ComponentType: `ANCI`
- ComponentRefNo: `=1006649732/144940`
- Position: `(854513.44, 3934222.04, 106100.00)` mm

## Exact reported failing StagedJson REST record

Recovered defect evidence:

- `NAME=/SL-1847103.2.1`
- `OWNER=/SL-1847103.2/B1`
- `PREV-NAME=PS01264.1`
- `POS=(854513.44, 3934222.04, 6100)` mm
- `POSI=E 854513.44mm N 3934222.04mm U 6100mm`
- `COMPRE==1006649732/143989`
- `CMPSUPREFN=SL-1847103 (REF)`
- `CMPSUPTYPE=REST`
- `MDSSUPPFUNC=PIPE-REST`
- `MDSSUPPTYPE=PIPE-REST`
- no member-owned `CMPSUPGAP`

The XML/staged component references are different (`.../144940` versus `.../143989`), so component-reference equality is not a valid recovery route for this sample.

## Coordinate qualification

Configured manual alignment:

```text
ΔX = 0 mm
ΔY = 0 mm
ΔZ = +100000 mm
```

Result:

```text
Staged raw  = (854513.44, 3934222.04,   6100.00)
+ offset     = (        0,          0, 100000.00)
Aligned      = (854513.44, 3934222.04, 106100.00)
XML          = (854513.44, 3934222.04, 106100.00)
Residual     = 0.000 mm
```

Strict identity result:

```text
/SL-1847103.2.1 -> SL-1847103.2.1
CMPSUPREFN=SL-1847103 (REF) -> relationship root SL-1847103
```

## Reconstructed family qualification

The missing original GUIDE/LINESTOP StagedJson records are **not available**. For qualification only, the test fixture encodes the reported engineering evidence under the same `SL-1847103` group:

- GUIDE: `GT500` / `PG-S-3`, `CMPSUPGAP=GAP=10mm`
- LINESTOP: `ST501` / `LS-S2-3`, `CMPSUPGAP=GAP=35mm`

These companion records are marked `RECONSTRUCTED` in `tests/xml-cii-source-schema-sys0010-benchmark.test.mjs`; their synthetic `NAME`/`MDSLINKREF` values must not be cited as recovered source records.

Expected member-owned CII restraint result:

```text
REST      -> +Y   gap 0
GUIDE     -> GUI  gap 10
LINESTOP  -> LIM  gap 35
```

## Execution status

A local benchmark-anchor harness was executed against the real XML node and exact reported REST values. It confirmed:

- strict identity: PASS
- relationship root: PASS
- manual +100000 mm Z alignment: PASS
- aligned/XML residual: `0.000 mm`
- reconstructed mapping invariant: `+Y / GUI 10 / LIM 35`

A repository-native Node test is committed as `tests/xml-cii-source-schema-sys0010-benchmark.test.mjs` and a branch-only runner exists at `.github/workflows/xml-cii-source-schema-pr612.yml`.

At the time of this record, connector-authored branch pushes had not started a visible GitHub Actions run, so **repository-native Node execution is not claimed as passed yet**.

## Qualification conclusion

The benchmark proves the datum and identity portions of the reported defect exactly. The intended relationship/GAP result is also exercised by the production test fixture, but a literal replay of the original failing StagedJson cannot be completed until the original companion GT/ST records (or the full StagedJson file) are available.
