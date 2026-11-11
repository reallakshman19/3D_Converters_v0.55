# BC4 — Original Excel LineList as a JSON fixture

The Owner provided `BC4.xlsx` (241,036 bytes, original SHA-256
`3e3b8494f9e70bffd92f5c13492c8c0421739c29a086d41f41306f0d386f240a`).

Its `LineList` sheet was converted read-only into
[`BC4.LineList.json`](./BC4.LineList.json) and **committed as UTF-8 JSON**.
The conversion preserves every one of the 385 nonempty rows following the
workbook's first numerical header row, including 3 nested header rows and
382 engineering line entries. All 41 source columns are retained per row as
strings, including original blank values.

## Load using the production application

The application's `master-dataset-parser.parseTextSource` imports JSON
objects with a `rows` array. Select `BC4.LineList.json` when importing
the **Line List** master in Source & Master; use your intended mapping and
explicitly apply it. This file is a source fixture, **not** a saved applied
master configuration, and it does not reconstruct the historic dataset ID.

Run a source-contract regression without any Excel binary:

```bash
node --test tests/xml229-bc4-linelist-fixture.test.mjs
```

GitHub Actions tests Node.js 22 and 24 against this exact committed JSON,
using the real `parseTextSource` and `prepareNormalizedDataset` functions.
The source bytes are pinned by `BC4.fixture.json`.

### Conversion custody

- Original workbook SHA-256: `3e3b8494f9e70bffd92f5c13492c8c0421739c29a086d41f41306f0d386f240a`
- JSON size: **199,182 bytes**
- JSON SHA-256: `53b322405795dc7a74c1154043c31bf9c8b2a1763f207cabf0c7f1888fd9c1bb`
- JSON Git blob SHA-1: `6b84b5e350e76de05db0c4a858da39114cddbc70`
- Production auto-mapped 385-row digest: `65548a7e176534c457b7be41b50b64b22a54f869a5606ffc2ddff856d67c7f53`
- Production auto-map digest: `d85c6c7fa1e59f649451f01141b79e39ce693646b429846922ee3e6e49701717`

**Historical master acceptance remains blocked:** the saved Owner session has
different applied normalized-row and field-map SHA-256 values. Matching a row
count does not authorize substitution or approvals. The original workbook is
not required to execute this committed JSON fixture. Optional byte-preserving
XLSX installer remains available for archival comparisons only.

**Do not alter historical Match-1, approve Final or release governed native CII
based on this fixture.**
