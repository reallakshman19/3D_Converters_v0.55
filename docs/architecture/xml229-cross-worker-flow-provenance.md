# XML229 — cross-Worker causal flow and state provenance

Status: DRAFT. Read-only, engineering-critical observability. Owner reported identical red Output/Run state over ten cycles on 2026-10-17.

## Factual diagnosis

Screenshot: 41/41 selected branches, four masters loaded, 423 original physicals and 2,961 verified FactRecords. Weight Match has zero original Source mass, zero accepted Match-1, zero Final, and 423 unresolved. The red xml229-original-json-engineering-authority row is a deliberate native CII release HOLD, not evidence of a Worker crash: xml-cii-output-run-readiness.js sets it whenever governed original-JSON output is selected. The Run preflight enforces it separately. Even a perfect Preview and Weight session does not prove actual native emitted-CII Final-mass physical-slot consumption.

## Causal graph (read-only observers, not another data authority)

1. 4 Preview UI resolves original XML, indexed O1 Blob, 41 selected branch scope and four current masters into one InputBasis.
2. UI invokes independent original XML census Worker; result includes physical population.
3. UI launches source-bound GC-PW Worker. It verifies original JSON Blob SHA and full current Source/Master InputBasis.
4. GC-PW Worker invokes a separate engineering Preview child Worker; child returns actual-JSON dryrun; GC-PW opens one complete original physical FactRecord model.
5. GC-PW starts sole authoritative scorer, Match-1 and Final CAS decision review. Candidate != explicitly accepted Match-1 != separately accepted Final.
6. Weight Match UI reads the same live Worker; no localStorage review is silently authoritative.
7. Output/Run UI reads same verified G4 RunAdvisory and projects one canonical checklist and native release HOLD.
8. The independent emitted-CII physical-slot mass/unit/split consumer oracle is NOT IMPLEMENTED or VERIFIED. Native JSON-governed Run MUST stay HELD.

## Instrumentation contract

New contracts/xml229-flow-trace-v1/trace.mjs is a 256-event ephemeral bounded ring with a source-independent correlation trace ID, increasing event sequence, relative elapsedMs, RPC sequence, typed actor and transition, safe code, and whitelisted numeric counters. No source IDs, original JSON SHA, generation, physical IDs, proposed kg, freeform Worker message/error, raw XML, or master rows may enter the exported trace. Actor/type are strict enums, source+served twin modules must match byte-for-byte. Ring overflow is counted; no remote telemetry or localStorage persistence. All trace exports report nativeCiiReleaseAuthorized=false and independentSourceVerified=false.

Both UI-to-Worker facade and actual GC-PW Worker emit categorical transitions for census dispatch/return, Preview child dispatch/return, facts creation, Worker readiness, RPC send/result/error. 4 Preview starts a fresh per-stable-stateRef trace; 6 Weight Match provides an explicit private flow trace download; 10 Output/Run records live read/held gate separately. A native-gate HOLD is classified as NATIVE_RELEASE_HOLD_EXPECTED rather than an unhandled Worker fault. ENGINEERING_MASS_UNRESOLVED is separately classified.

## Acceptance and failure modes

Qualify with Node 22/24 contract tests (privacy, bounds, event order, 7x facts, error/hold distinction) and real original-Blob Chromium 4 Preview -> 6 Weight Match download; test every expected census/child/facts/RPC actor, then capture 10 Output/Run gate. If any actor or required event is missing, do not claim complete end-to-end trace. An exact Owner 41/423/2961 run and 100MiB/2m performance are NOT_RUN; native G5 physical-slot oracle and G7 acceptance are NOT_RUN. Owner must retain private source, masters and trace. Do not merge without explicit approval; do not relax native Run.

## Coordination

PR #273 remains a separate overlapping draft; coordinate before merging this diagnostic. Backups exist for every changed production file. Rollback removes trace modules/observer ports/button; the scorer, accepted kg and native output are unchanged.
## Independent first-divergence auditor

The trace collector is only an observer. The separate `contracts/xml229-flow-trace-v1/audit.mjs` independently parses the downloaded trace without trusting the collector's derived findings. It validates the event sequence, allowed actor/type/counter fields, bounded size, 7-to-1 physical facts, RPC request/response pairing, census dispatch/result, child Preview start/return, fact and review readiness, Output read and native hold. It returns a first missing or conflicting causal handoff as a generic issue code and sequence only, never source strings or engineering mass values.

Owner-local verification (Node.js checkout of this PR):

```sh
node scripts/xml229-audit-cross-worker-flow.mjs xml229-cross-worker-flow-trace.json
```

Exit 0 means structurally consistent or a correctly observed native hold, 2 means a contradictory/broken flow, 3 means invalid trace shape, 1 means unreadable/malformed/private file outside 128KiB cap. Structural consistency is NEVER native CII authorization.

Suggested evidence sequence: load original source and four correct masters; build 4 Preview; switch to 6 Weight Match; inspect/explicitly review only if authorized; open 10 Output/Run; return to 6 Weight Match and download the causal flow trace and separate G3/G4 aggregate. Keep both private. Expect a typed `RUN_GATE_HELD` edge even if physical/fact census is correct. A broken causal edge is a software integration fault; `ENGINEERING_MASS_UNRESOLVED` is a missing engineering decision; `NATIVE_RELEASE_HOLD_EXPECTED` is the required G5 safety control. A missing G5 physical-output oracle remains a separate implementation and acceptance workstream.

The trace begins with a new source-bound Preview build, not pre-indexing O1's internal worker lifetime. O1 is attested at Source input resolution and the current original staged receipt. This boundary is explicit; do not infer a complete O1 worker performance trace. When browser source/master/selection changes, restart the diagnostic and do not mix trace exports across epochs.