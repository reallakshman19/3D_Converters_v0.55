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