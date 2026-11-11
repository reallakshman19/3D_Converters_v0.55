# XML229 R2 — external read-only diagnostic log

**Owner constraint:** "leave the CII py converter, if you want publish a log" (Issue #229).

## Purpose and authority boundary

This PR extracts the **read-only** R2-A native engine byte witness, R2-B source/Final
commitment, and R2-C1 original-physical-to-enriched-XML matcher out of
oversized draft PR #260 onto an independent branch from `main`.

It also provides a pure external report builder and CLI:
`tabs/xml-cii-2019-standalone/integration/xml229-r2-external-diagnostic-log.mjs`
and `scripts/xml229-r2-external-log-cli.mjs`.

**No existing Python converter file, CII writer, application Run handler, UI
panel, Weight/Final acceptance logic, or release gate is changed.**
These are library/reporting functions, **not yet wired to production**. The CLI
consumes pre-collected metadata receipts only; it NEVER invokes the converter.

## Example

```sh
node scripts/xml229-r2-external-log-cli.mjs \
  --input tests/fixtures/xml229-r2-synthetic-receipts.json \
  --out /tmp/xml229-r2/external-diagnostic
```

The command produces `external-diagnostic.json` and
`external-diagnostic.csv`. CI attaches **synthetic-only** samples, not actual
Owner records or source file contents.

## Data contract

Pass one selected original source and a complete list of independently
enumerated original physical identities, with:

- `runId`, `sourceId`, `basisId`, `originalJsonSha256`,
  `sourceGenerationId`;
- `originalPhysicalRows` with canonical physical `occurrenceId`,
  `branchOccurrenceIndex`, original `nodeOrdinal`, `componentSignature`,
  and distinct `sourceKg`, `match1Kg`, `finalKg`, `effectiveKg`;
- optional exact current `finalIntent` (R2-B), `engineWitness` (R2-A),
  `transferManifest` (R2-C1), and read-only `nativeSlotReceipt` (R2-C2).

The reporter checks source/basis/generation digests and original population
cardinality. It rejects repeated or noncanonical original identities,
cross-source transfer, wrong mass, duplicate native slots, mismatched
Final/engine/CII hashes, and forged release claims. Where evidence does not
exist, output marks a **HOLD** with reason and leaves unknown native slots and
CII weights empty, rather than guessing a match by NodeNumber (including -1).

R2-C1 only proves exact-source enrichment when branch ordinal, original
physical signature, NodeNumber and Position still identify exactly one
engine-input component. Real cleanup, splitting, or renamed geometry may
require an external independently attested lineage; those cases stay HOLD.
The separate read-only Python RIGID audit in draft #260 is **not** migrated
or invoked by this PR; Python converter itself is completely untouched.

## Status and caveats

- `nativeCiiReleaseAuthorized` is **always false**.
- The generated log is not an engineering approval or independent source
  attestation. It cannot authenticate the honesty of a caller-supplied
  physical population or evidence receipt.
- A RIGID slot being observed does not verify VALV/INST/FLAN or full native CII
  output. Without all-kind output custody, release remains HOLD.
- Large Owner corpus qualification (41/28 branch scope, original 622,915
  occurrences, 4 authentic masters, 100 MiB / 2M occurrence range) belongs
  to the other production integration workpacks, not this log-only PR.

**Next:** independently review this narrow PR, then coordinate receipt
collection in the P4 Worker and converter boundaries without editing the
CII Python converter. Keep unmerged PR #260 draft; do not wholesale merge or
claim deployed live UI.
