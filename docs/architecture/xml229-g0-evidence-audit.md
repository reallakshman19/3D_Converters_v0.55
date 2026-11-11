# XML229 G0 — first executable evidence-consistency seam (proposal)

Parent: #274; independent LFJ/Preview/GC-PW work #226. Scope: a **read-only, offline** diagnostic. This tool is not an InputBasis authority, not a source byte attestor, not a second scorer, and not a native release permit.

## How to run

```bash
node scripts/xml229-audit-evidence.mjs path/to/xml-cii-output-run-readiness.json
node --test tests/xml229-evidence-audit.test.mjs
```

The first command accepts the existing 10 Output/Run **Download readiness diagnostics JSON** artifact (or a manually assembled redacted object with keys `sourceReceipt`, `sessionReceipt`, `completion`, `finalIntent`, `physicalTransfer`, `nativeBoundary`, `readiness`). It emits `XML229.ReadOnlyEvidenceAudit.v1` with shape and cross-receipt inconsistency codes, missing-evidence fields, counts, and `nativeCiiReleaseAuthorized:false` regardless of supplied values. The report contains no raw source/master/file contents; it is a **structural consistency check only**. Source hashes in user-supplied JSON are not authenticated by the tool. Do not paste private files into public PR/CI.

Exit code: 0 = structurally consistent supplied set (still **not authorized**); 2 = inconsistent; 3 = insufficient evidence; 1 = input/read/usage failure. An ordinary readiness export lacks independent Worker/Final/native receipts, therefore returns exit 3 even if its rows appear ready. G0 may compare this report to displayed badges, but the CLI does not inspect the browser DOM or replace a live Worker challenge.

## Current source-grounded gap

Source/Preview receipt, completed GC-PW review, final-intent, engine-input transfer and native-byte witness exist as distinct schemas. Current public native witness explicitly does *not* prove per-physical-component native consumption. This read-only first seam rejects altered SHA bindings, counts, duplicate transfer owners, and false self-proclaimed release flags; it does not compute or approve an actual engineering value.

## Further implementation gates

G0: Owner runtime asset hashes, private 385/10,699/383/1595 workload, qualified candidate distribution, exact two error messages, PR matrix. G1: Owner-approved basis + receipt schema and independent Writer/Worker owners. G2–G7: independent workers, actual engineering proposer/decision service, pure readiness report, quarantined native qualification, independently verified native slot consumption and Owner acceptance. No G1 release authority is created here.

**Coding protocol:** Owner's v3.6 work-specific `relay/AIM/<WORK>.yaml` and matching parent plan are still unprovided. Do not invent either; this independent draft code must not be presented as a completed v3.6 task or merged until those prerequisites and review ownership are resolved.
