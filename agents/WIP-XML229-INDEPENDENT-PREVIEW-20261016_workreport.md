# WIP-XML229-INDEPENDENT-PREVIEW-20261016 — recovery and authority

Owner instruction: "do it", focused on Worker separation and actual-json responsiveness after G0/G1. Parent #274, G2. Engineering-critical. Base is perf PR #282 code+docs head f0ebc8d1753ceda1301e2a230fe0794ef81897a9, itself based on open draft #280 -> draft #276. No main merge or prod deployment.

## Source-level diagnosis and protected invariants
The main original-blob-gcpw Worker originally did all of the original JSON Blob SHA, Preview dryrun, full physical fact model, GC-PW review, and Final CAS in one Worker JS thread. A phase deadline in #280 detects stall but does not isolate long CPU from the review Worker. The new Preview-only Worker performs the actual xmlCiiDryRunPreview on the authentic original JSON Blob in its separate Worker; it independently re-hashes the Blob and returns the same Preview result for the existing fact producer. Original GC-PW review, explicit Match-1/Final decisions, original XML independent census, full-content InputBasis custody, and native CII hold are unchanged.

The GC-PW Worker uses runXml229IndependentEngineeringPreview through a new client port with requestId, basisId, original JSON SHA, sourceId and generation; it validates all on every message, refuses duplicate late reply, uses bounded deadline, and terminates the child after completion/error/abort. Child never writes Weight proposals/Final decisions or native CII, and never exposes raw JSON to UI. Current original source work Blob is cloned between nested Workers; this is **not** a proven zero-copy or memory-bounded solution on 100MiB data.

## Source changes
- Modified tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs; exact docs/tabs served mirror. Replaced inline synchronous dryrun with await of independent Preview Worker, AbortController cancellation and cleanup; retained same downstream FactRecord and GC-PW flow.
- Added tabs/.../integration/xml229-independent-engineering-preview-worker.mjs and xml229-independent-engineering-preview-client.mjs, mirrored under docs/tabs.
- Added tests/xml-cii-229-independent-preview-worker.test.mjs with nine transport/negative/mirror tests.
- Backed up exact original main worker in .backups/20261016-xml229-independent-preview/.
- No native writer, XML-only authority selector, scoring algorithm, mass acceptance, Owner master data, or workflow files changed.

## Hypothesis, falsifier and validation
Hypothesis: Preview and GC-PW now use distinct Worker event loops, so cancellation of an in-flight Preview and source-bound late reply fencing can be maintained without putting parsing in the GC-PW Worker; source/masters and output engineering semantics remain the same. Falsifier: actual Chromium disallows nested Workers or Preview rows/FactRecords/native CII weights differ, or browser memory makes 100MiB threshold unsafe. In that case HOLD/revert this proposal rather than silently falling back to combined CPU or awarding Final.

Local unit and hosted exact-head CI are **NOT_RUN** at initial code creation. Synthetic FakeWorker tests cannot establish native/browser execution. Required acceptance: Node22/24 tests, browser 41-branch EF05 actual staged JSON, before/after complete physical and 7-fact census, same source/master SHA and source/Final kg, strict line/DTXR/parity, startup Cancel and late results, Owner scale 385/10699/383/1595 masters (Valve master autoload), 100MiB/2m ceiling and over-limit safe handling. Also compare CPU/peak memory and pre-release CII native HOLD, and exact tabs/docs parity.

Live LFJ/O1 original source stage is already separate; standalone child Preview now CPU-isolated from GC-PW. This does not independently prove complete three-worker deployment ownership across LFJ, Preview, GC-PW: need full Chromium evidence. No extra scorer or copy from Worker to UI.

Execution protocol: Common 3DC-XML-CII 2.2.0 label is Owner-approved but O1 LFJ target and no writable lab/label-bound G2 plan found; do not fabricate v3.6 evidence. All integration/merge/release decisions remain Owner-only and G5 CII held.
EXACT_NEXT_ACTION: open draft PR on top of #282, run exact-head CI and real served Chromium tests of nested module Worker, profile Owner dataset, fix true failing tests within approved worker ownership only; if test cannot run or performance not proven, keep draft HELD, no merge.
