# XML229 G1 candidate: GC-PW live InputBasis and Worker lease

Status: CONTRACT PROPOSAL / DRAFT CODE. Not integrated, not an approved Owner engineering receipt and not a native Run/release authorization. Parent #274, independent-worker aim #226, draft PR #281.

## Existing trusted interfaces reused
- contracts/gc-pw-v1/contract.mjs: assertBasisDigest validates full canonical BasisRef SHA-256.
- contracts/gc-pw-v1/occurrence-bridge.mjs: attestLiveBasis re-hashes actual source text, staged JSON, all master rows and mappings, scope, config and overrides.
- tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js: existing Preview createPreviewBasis producer, exercised in the new tests.
- XML229.OriginalStagedSourceReceipt.v1, sessionReceipt and XML229.P4.RunAdvisory.v1 must bind the same single-source InputBasis.

G1 proof is source/fact custody only: no positive mass, qualified proposal, accepted Match-1/Final, native engine input, CII physical slot or actual CII approval is inferred.

## Boundary and lifecycle
attestXml229G1LiveLease({basis,sourceReceipt,sessionReceipt,completion,live,readCurrentLease}) must run inside the independent source-custody Worker holding original source/master bytes. UI must not copy the private staged JSON or master rows to verify this.

readCurrentLease is a required synchronous source Worker port returning {basisId,sourceId,sourceGenerationId,closed}; checked before and after asynchronous SHA-256. Real coordinator integration must also fence request generation and mutable Final decisions. This candidate is not the entire lifecycle service.

Exact indexed original JSON SHA must equal basis.stagedSourceSha256. This is a source encoding hypothesis to verify with the real O1 producer. If source normalization changes bytes, fail closed and introduce a versioned, explicitly approved source encoding policy; do not relax receipt equality to make tests pass.

## Versioned output and trust limit
The XML229.G1.LiveEvidenceLease.v1 result contains only basis/source/generation, verified physical and FactRecord counts, the four mass status counts, byteCustodyAttested:true, reviewDecisionsAuthorized:false, nativeQualificationAuthorized:false and nativeCiiReleaseAuthorized:false.

Full-byte consistency against a caller-provided BasisRef cannot authenticate a malicious caller that supplies an internally consistent fake source. Worker origin, real original receipt and independent native CII correspondence need their own separate trust boundaries. G1 cannot become an Output/Run release switch.

## Qualification, limitations and next gate
Run: node --test tests/xml229-g1-live-basis-attestation.test.mjs

Negative cases: same-size source change, same-count changed master content, changed master mapping, staged JSON byte drift, wrong source generation/basis, incomplete facts, false release claim, closed Worker after async hashing, absent current Worker ownership, forged canonical basis, changed selection/config, wrong original JSON receipt.

NOT_RUN / NOT_QUALIFIED on this PR: actual 385/10,699/383/1595 Owner source/master workload, actual Worker runtime, native converter, output slot correspondence, served browser and targeted hosted test. The existing GC-PW import code is reused directly; not duplicated.

Next: Owner/Coordinator review of the G1 contract, explicit work-specific v3.6 label-bound plan and permitted shared-runtime write leases. Then integrate in a separate scoped Worker/Output PR with real Worker and browser E2E, preserving separate LFJ, Preview and GC-PW responsibility and native CII HOLD. No production modification or deployment in this PR.


## G1 request supersession and actual Worker integration finding (2026-10-16)

The lease MUST include a nonblank `requestId` in both the invocation and `readCurrentLease()` output. A *different* request on the same original XML, staged JSON, masters, source generation and BasisRef is still a different Worker's active computation. A stale worker callback with unchanged hashes must not become current. `closed` must be **exactly** `false`, not missing/undefined. Both checks happen before and after asynchronous full byte custody attestation; missing request ID or a changed one fails closed. `requestId` is returned as a traceable non-release field; it is not a hash, a Final decision, or engine authority.

**Confirmed source observation on integrated draft #276:** `tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs` invokes synchronous `xmlCiiDryRunPreview()` and then `openGcPwPreviewWeightSession()` in the SAME worker process. In that implementation the original JSON Blob is authenticated, the `basis` and `live` byte custody objects are constructed within `start(req)`, while `active` tracks request ID and `cancelled` tracks supersession; `live` is local to startup. The G1 port cannot truthfully be attached by a UI-only adapter or to a post-ready RPC without a reviewed Worker retention model. The implementation must first decide how to meet Owner's independent LFJ/Preview/GC-PW runtime boundaries: module separation within one Worker is **not** independently hosted standalone workers.

**Integration decision required:** either run G1 within a reviewed Worker startup boundary using its `basis`, authenticated original O1 Blob and ephemeral `live` buffers before publishing readiness, or introduce independent, explicit read-only receipt transport between separately owned workers. Do not create a second scoring service, copy large JSON to the UI, or extend the currently combined Worker architecture without a separate approved ADR/ownership lease. Keep the existing native CII HOLD.

**Local validation:** G0 8 + G1 16 = 24 tests **PASS** under Node v22.16.0 using the exact GitHub blob bytes for both authored G1 module and test (SHA-1 git blobs `e22ee9b688526a9ada5c48f7f0b93b4f440e0ed1`, `dbcaceb9ac6b43802786e9ef5f376b14b10f732e`) plus a small local harness **reconstructing the exercised methods** of three GC-PW dependency files from current `main`. This local test is *not equivalent to a complete GitHub checkout* or an exact-head hosted run. Owner private data, browser E2E and actual native CII still **NOT_RUN**. Results are diagnostic only.
