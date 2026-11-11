# PR281 — XML229 G0 offline consistency seam — recovery-first work report

**PR:** https://github.com/reallakshman19/3D_Converters/pull/281 (**OPEN / DRAFT**). **Parent:** #274, owner-intake #229, independent-Worker aim #226. **Base:** `main@9944a5bf521cb67dcabf887d8a5ccce61d4857d2`. **Candidate before this report commit:** `5b24c0631e9323669cb4869c699f2f7de67e7c99`; re-read live PR head after any change. **Owner instruction:** 2026-10-16 start implementation; no merge/deploy/native output authorization.

## Scope and status

A bounded read-only implementation, **not** production integration or engineering proof. New files only:
- `contracts/xml229-evidence-v1/audit.mjs` pure shape / cross-receipt structural inspector; non-authorizing
- `scripts/xml229-audit-evidence.mjs` offline CLI; exit 0=consistent submitted fields, 2=inconsistent, 3=incomplete, 1=invalid/read
- `tests/xml229-evidence-audit.test.mjs` seven synthetic positive/negative Node scenarios
- `docs/architecture/xml229-g0-evidence-audit.md` usage, trust limits, G0–G7 handoff
- `agents/WIP-XML229-G0EVIDENCE-20261016_workreport.md` original auditable takeover
- this PR-numbered report

There are no changes to main Worker/client, UI/DOM, scorer, Run/qualification logic, native converter, package scripts or CI workflows.

## Source-level findings (A1–A5)

A1: existing XML229 source receipt, complete Preview facts, GC-PW Match-1/Final, hashed intent, physical engine-input transfer and native-byte witness are **separate** contracts; the last two never attest native physical-slot consumption. A2: screenshot 41/423/2961 is complete fact **population**, not resolved mass; 0/0/0/423 weight counts need original `<Weight>` and candidate-coverage investigation; old main changes visible readiness DOM without canonical report update. A3: no joined false authority, no source/mass rewriting, no imaginary Final; no CII release from hash/byte witness. A4: local Node22.16.0 exact-file self-contained `node --test tests/xml229-evidence-audit.test.mjs`: **7/7 PASS**. Independently verified GitHub blob SHAs match local for audit, CLI, tests, docs and WIP report; **actual served browser, private source/master, native engine** = NOT_RUN. A5: next permitted change is a source-bound G0 evidence and agreed G1 contract shape, not a native gate bypass.

## Validation and current live constraints

- `PR281@5b24c063` generated GitHub Actions; earliest inspection showed several PASS, some IN_PROGRESS and some FAIL on repository-wide XML-CII/C05 workflows. **Exact final-head CI=NOT_VERIFIED; do not claim all green.** Recheck after this report-only commit and classify red jobs against main before accepting.
- Existing PRs: #273 open draft (mature UI); #276 open draft (integrated readiness); #278 and #279 merged **into #276 only**; #280 open draft on #276. No integration PR conflicts created by this isolated new-file change.
- G0 Owner asset hash/private input/candidate coverage, exact two Output error strings (#275), G1 approved receipt interface, G2 Worker performance, G3 review completion, G4 canonical UI, G5 actual native physical slot, G6 cutover, G7 Owner source-specific acceptance are **OPEN**.
- **Work-specific v3.6 `relay/AIM/<WORK>.yaml` and matching approved label-bound plan are not supplied.** Cannot claim canonical v3.6 task, child-issue evidence or qualified phase progression. Do not invent these. Owner/Coordinator HOLD, native governed Run gate and OWNER_ONLY merge remain.

## Highest risk and falsifier

This audit checks caller-supplied records; it does **not** re-hash live source/master bytes, validate cryptographic provenance of exported receipts, or prove native CII lineage. It always returns `authoritative:false` and `nativeCiiReleaseAuthorized:false`; even a structurally `CONSISTENT` result is not release approval. An actual current-basis evidence chain or Worker read may later differ; that does not justify changing the audit to output `ready` automatically.

**EXACT_NEXT_ACTION:** Reconcile final GitHub CI exact latest head and independently compare against untouched main for failing checks. Capture real Owner-served asset URL/hash, permitted redacted readiness export and candidate distribution. Obtain work-specific v3.6 label/plan and exclusive integrator/Worker/native write leases before any shared runtime or engineering semantics mutation. Post progress on #274, retain draft; no merge/deploy.

## Hardening checkpoint — 2026-10-16
- Code SHA after privacy hardening: `2ea1ceee13d20353953c8e81b55020b1e0270bad` (this work report will create a documentation-only successor commit).
- `auditXml229Evidence` now explicitly whitelists `source,match1,final,unresolved` numeric counters; arbitrary extra caller fields are not echoed into diagnostics. Removed unused helper.
- Node v22.16.0 local **8/8 PASS** on GitHub-identical tested blobs: audit `0e3694d549ab23767c1c130446f326f2e969ba00`, test `bf980d9be1d95ff463bc198abf80f290da7e394b`. Manual Git blob comparisons established content equivalence to local test files.
- Hosted CI at this final documentation checkpoint: **NOT_YET_VERIFIED**, repository-wide workflows may fail independently; no native engine, private data or served UI qualification.
- EXACT_NEXT_ACTION remains source-bound G0 evidence and Owner/Coordinator approval for G1/runtime, not a second ad-hoc patch.

## G1 candidate implementation checkpoint — 2026-10-16 16:09 UTC Owner continuation

Owner expressly requested "proceed now"; G1 contract **candidate only** added inside the existing isolated draft without changing Worker execution paths:
- contracts/xml229-evidence-v1/live-basis-attestation.mjs: imports ACTUAL GC-PW assertBasisDigest + attestLiveBasis; verifies original staged JSON SHA, source ID and generation, 7-per-physical fact census, current Worker lease before/after async SHA, and actual source/master rows and mapping bytes. Always returns reviewDecisionsAuthorized:false, nativeQualificationAuthorized:false, nativeCiiReleaseAuthorized:false. Rejected stale source/generation/master/lease, not a new scorer or Run authority.
- tests/xml229-g1-live-basis-attestation.test.mjs: 12 authored Node 22 tests on synthetic four-master current-basis input (positive byte custody plus changed same-length XML, master content/mapper, staged JSON, wrong SHA/generation, fact census, late closed Worker, no lease, forged basis, selection/config changes). **G1 tests NOT_RUN** on exact head: code authored and statically inspected, not falsely marked PASS.
- docs/architecture/xml229-g1-live-lease-contract.md: G1 schema, portability boundaries, trust model, unresolved live original JSON byte-encoding hypothesis and integration approval requirements.

Validation: Previous immutable G0 candidate 8/8 locally PASS; earlier exact PR head 8ca495b had 30 hosted workflows, 24 success and 6 failures. Two failures inspected: Issue 835 is an intentional child-scope file fence rejecting PR281 out-of-scope paths; Issue 776 encountered an existing regex/Weight acceptance test expectation mismatch. Other CI failures not yet dispositioned. **No implication that latest G1 head has passed tests.**

Work-specific v3.6 Owner-approved Common label 3DC-XML-CII at version 2.2.0 exists but task_outcome O1 applies to LFJ; it contains no Writable lab directive or work-specific implementation plan bound to #274. Do not hijack the label as G1 authorization. Explicit integration runtime writer lease, native qualification permissions, and Owner-only merge remain outstanding.

EXACT_NEXT_ACTION: execute Node22/24 targeted G1 tests in approved checkout; compare six CI failures to main and post exact-head evidence. Then obtain chosen v3.6 plan / writable lab directive, current source/master byte provenance and exclusive Owner/Coordinator permission to connect this contract inside actual Worker; preserve independent workers and native release HELD.


## G1 same-basis request fence / concrete verification — 2026-10-16

- Corrected frozen PreviewBasis SHA-drift test (copy-on-write of basis fields), hardened missing `closed` flags, denied supplemental `nativeCiiReleaseAuthorized`, `nativeQualificationAuthorized`, `reviewDecisionsAuthorized` claims, and added required `requestId` in both Worker lease challenge and returned trace receipt.
- New regression: a superseded Worker request with the SAME BasisRef, original JSON SHA, source and generation fails `LEASE_SUPERSEDED_OR_CLOSED`. Missing current request ID fails `CURRENT_REQUEST_ID_REQUIRED`.
- Verified authored G1 module/test Git blobs against local inputs at code commit `b0cb100616844cb441215957eede90dfce4cad61`. Local Node22.16.0 `node --test tests/xml229-evidence-audit.test.mjs tests/xml229-g1-live-basis-attestation.test.mjs` 24/24 PASS (8 G0, 16 G1), using **local copies of exercised GC-PW dependency methods**, NOT a full repository checkout; never claim exact-head hosted CI green from this local test. Hosted status at that code head: 13 success, 3 failure, 14 pending when checked; later results require re-read.
- New architectural fact: integrated draft #276 `xml229-original-blob-gcpw-worker.mjs` contains BOTH the synchronous Preview dry run and the GC-PW review session in a single Worker runtime. Its `live` buffers exist inside startup `start(req)`, not as a durable post-ready source port. Owner's independent worker separation is not proved by module names. Future G1 wiring requires separate runtime/transport ADR and Coordinator write lease; no silent addition to combined Worker/Run.
- Runtime/browser/native/Owner 385-row dataset: NOT_RUN. Source-only proof does not authorize Match-1, Final or CII. Work-specific v3.6 G1 plan/approved writable directive remains absent. OWNER_ONLY merge and governed Run HOLD unchanged.
- EXACT_NEXT_ACTION: get authorized G1/worker ownership plan and original O1 byte/GC-PW source identity oracle; test actual source Worker startup with same-source request supersession and real master mutation, then validate canonical readiness from that actual read-only receipt. Do not bind audit/lease to Release.
