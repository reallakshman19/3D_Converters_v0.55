# WIP XML229 causal trace — recovery first

Owner mission: stop ten-cycle speculative checklist patches by tracing real source/Worker/UI/module transitions. Issue #274, 2026-10-17.
Base: main 9aac1629f1cbd5c3792943d6f475c088b001e3e4. Branch: diagnostics/xml229-cross-worker-provenance-trace-20261017.
Criticality: ENGINEERING_CRITICAL, diagnostic-only; no numeric/review/native authority change.

A1 production trace: 4 Preview original XML+O1 staged JSON+four-master source lease -> independent census Worker -> GC-PW Worker -> independent Preview child -> 7 Facts per physical -> same source-bound Weight CAS -> 10 Output canonical checklist/native HOLD.
A2 isolation: Screenshot proves 423/2961 facts but zero source kg, zero accepted Match-1/Final and 423 unresolved. Governed original JSON native release guard in xml-cii-output-run-readiness.js is intentionally blocking, irrespective of Preview success. No stack/Worker failure is supported by screenshot.
A3 invariants: source/served byte-identical, in-memory bounded 256 typed events, per-session random non-source flow ID, no raw data or free-form message/errors/individual proposed kg, no changes to scorer/Final/native writer/Run gate, report native authorization always false.
A4 validation: code authored, hosted tests NOT_RUN at this checkpoint. Browser assertions must prove real child Preview/fact and RPC event flow; exact Owner 41/423/2961 source private NOT_RUN; G2 100MiB/2m and G5 actual emitted CII oracle NOT_RUN.
A5 falsifier: if Chromium trace lacks census-verified, child Preview completed, facts opened, RPC sent/result, or contains a secret source/master string, quarantine; no green claim. Reject stale data and trace different session individually.

Changed: new contract+served module, per-UI-ref registry+served module, GC-PW client/Worker and served twins, verified Weight UI and Output UI and twins, Chromium browser test, Node suite/isolated contract tests, ADR. Backups under .backups/20261017-xml229-flow-trace. No native writer/workflow changes.
EXACT_NEXT_ACTION: open draft PR, run actual P4 Chromium and Node22/24 from exact head, repair any trace-only defect without weakening native hold, record real results in #274. Owner review and any merge separately.
## Independent first-causal-gap auditor — 2026-10-17

Added contracts/xml229-flow-trace-v1/audit.mjs and served mirror, offline scripts/xml229-audit-cross-worker-flow.mjs and five tests imported into Node22/24 fact suite. It independently checks semantic stage ordering, orphaned RPC replies, missing child Preview request, 7x original facts, unknown properties and protected native hold. A first Node run failed three negative *test fixtures* that mutated Object.freeze snapshots; those fixtures now use structuredClone and focused Node CI PASS on head 55aa863. The real original-Blob Chromium was PASS on the prior head, and has an expanded latest-head canonical Output/Run guard assertion still awaiting CI. No weakening of test expected values or native gate.

Full Owner source and masters remain NOT_RUN. No G5 native emitted-output proof. DRAFT PR287 is the one trace work package; no new production merge.
## PR287 formal handover and exact code-head qualification

GitHub PR: https://github.com/reallakshman19/3D_Converters/pull/287 (OPEN/DRAFT). Base main 9aac1629f1cbd5c3792943d6f475c088b001e3e4. Head at workreport commit creation: 91ac22a53f2081753f502e13b9eb2cecc818d2d9.

Latest tested implementation prior to this doc-only workreport commit: 91ac22a53f2081753f502e13b9eb2cecc818d2d9.
XML229 P4 source-bound GC-PW integration run 39010950904 PASS: Node22 job 117333174682 = 85/85 tests PASS; Node24 job 117333174673 PASS; genuine original-Blob Chromium job 117333174487 PASS, covering Output/Run canonical hold and same-source trace graph.
Existing Preview Weight Integration Correction run 39010950825 PASS. Canonical verified Output readiness workflow 39010950740 still in progress at checkpoint. Repo-wide 50 workflows on tested head: 42 PASS / 7 FAIL / 1 PENDING. Red LFJ and C05 child scope workflows NOT WAIVED.

Code defect isolated: the first independent-audit tests attempted to mutate Object.freeze trace snapshots, resulting in 3 fixture TypeErrors; corrected by structuredClone before introducing adversarial data. No production behavior or oracle tolerance changed. Repeat exact-head CI verified Node22 85/85, Node24 and real browser.

Flow graph: UI 4 Preview -> census worker -> GC-PW Worker -> child Preview Worker -> source FactRecords -> Weight Match G3/G4 -> canonical 10 Output/Run -> native release policy. New independent auditor reports first broken edge, but purposely does not approve Final/output.

Privacy: no raw source XML/JSON, masters, individual physical occurrence IDs, selected source ID/SHA, freeform errors, candidate kg; no remote telemetry. 256 events max in memory, source-independent UUID; always nativeCiiReleaseAuthorized=false.

Remaining hard stops: actual Owner 41/423/2961 original source and four masters NOT_RUN; 100MiB/2m and full browser/Worker peak memory NOT_RUN; G5 emitted CII independent physical kg/unit/split oracle MISSING. PR273 separate overlapping draft; requires Owner/Coordinator coordination. Explicit Owner merge authority NOT_GIVEN for PR287.

EXACT_NEXT_ACTION: recheck final canonical workflow on PR287 latest *code* head; if green, have owner review independent causal trace on approved original source, inspect first-divergence report, and start G5 oracle as a separate engineering-critical workpack. Maintain native CII HOLD. PR287 remains draft pending coordination/authorization.