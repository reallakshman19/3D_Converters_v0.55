# XML229 L3 — committed PSI116 TopoFix → fresh GC-PW Worker source custody

**Status: Draft / DO NOT MERGE.** Stacked on L2 PR #341 and L1 PR #340. Nonreleasing; no Owner control-cutover.

## Operator path

1. Under **PSI116 Topology Sidecar**, analyze the immutable original XML. Review the proposed action IDs explicitly; choose only justified topology changes.
2. Generate the TopoFix transaction and validate it. Download and retain **original XML**, **committed TopoFix XML**, **TopoFix source-lineage JSON**, and **verified pre-Final handoff JSON**. The Sidecar only writes the final two receipts after an independent Python transaction replay.
3. In Source & Master select the **committed TopoFix XML as the new current XML source**. Re-index O1 staged JSON under a new source generation and select all source Branch occurrences. Verify four current masters. Do **not** restore any prior Final review or Weight backup.
4. In verified Weight, expand **TopoFix → new GC-PW Worker (pre-Final only)**; attach the original PSI116 XML, lineage JSON and handoff JSON. Choose **Verify and start NEW GC-PW Worker**. This explicit action runs the same protected GC-PW Worker service as ordinary Preview after source and O1/master attestation.
5. Re-review all engineering facts and selected kg under the new InputBasis. All previous Final decisions remain at their old, incompatible source basis. Native CII is a separate strict output-proof gate.

## Provenance proof and data minimization

The handoff compares original and fixed UTF-8 XML SHA-256 digests, the reviewed transaction digest/action set, every original Branch/Node ordinal, every retained/removed destination ordinal, and each node’s source/fixed **semantic SHA-256** using the PSI116 L2 Python canonical representation. Cross-branch connected nodes remain separately identified original occurrences, even when they share a finalized NodeNumber. No source files or original JSON are uploaded to the repository.

The accepted handoff result is **only** `XML229.TopoFixFreshGC-PWWorkerHandoff.v1`: it holds the actual freshly opened Worker session and an in-memory bounded `XML229.TopoFixFreshGC-PWWorkerProvenance.v1` record linked to the Worker’s basis ID and O1 generation. The provenance can be read only while that exact session remains current and open; it contains hashes and counts, not the original XML, uploaded JSON, mass decisions or CII bytes.

The existing production input resolver still requires a current one-source/full-branch selection, current O1 indexed JSON Blob, effective config, four-master custody and revision lease. The Worker independently recomputes the new InputBasis and engineering fact population; no separate Worker authority has been introduced. When an earlier session is available, its O1 generation and basis ID must differ from the new ones.

## Strict boundaries

- **Never** apply an old accepted Final session or restore its review backup to the new TopoFix Worker.
- **Never** interpret the verified TopoFix handoff JSON as an authenticated Owner authorization, or as independent CII release authority. At import, JavaScript checks hashes/ordinal identities; it does not itself rerun the PSI116 Python topology transaction. The producing L2 Sidecar performed the independent replay.
- The receipt does not attest original browser-upload byte identity if decoding or BOM normalization changed it. That requires separate byte-level ingestion evidence.
- If an old Worker is unavailable (e.g. after page reload), the O1 generation’s chronological newness relative to that Worker cannot be proven solely from an imported JSON receipt; the new source/Worker basis remains cryptographically distinct.
- The normal native CII runner remains unchanged: it cannot substitute reviewed TopoFix XML into an existing Final basis, bypass original-lineage checks or enable Download without actual emitted CII proof.
- The UI deliberately suppresses suggested-weight **automatic Final commits** for the TopoFix-fresh Worker session. Explicit engineering decisions remain available through existing protected review controls.

## Verification limits

L3 tests include source mismatch, forged ordinal/node SHA, duplicate mapping, stale session, reused O1 generation, old Final authority and forged ready-Worker receipt. The real Firstpass integration test covers an independently reviewed 216→215-node TopoFix transaction and both original/fixed per-node digests. CI passes do not replace live Owner-browser testing with authorized original/O1 inputs, fresh current masters, and independent native emitted-output evidence.
