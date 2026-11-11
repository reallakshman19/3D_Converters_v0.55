# XML229 Output/Run — provenance of the persistent native-release HOLD

Status: diagnostic-only, non-authorizing. Parent: #229; implementation: draft PR #312.

## Source-first reconstruction (19 Oct 2026)

1. `tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js`
   `originalJsonAuthorityRows()` produces the blocking checklist ID
   `xml229-original-json-engineering-authority` whenever a selected original
   JSON/O1 index receipt participates in **governed** native output.
   `INDEX_COMMITTED` only means indexed source, not completed engineering.
   The **HOLD is deliberately unconditional** and unrelated to the number of
   filled mass cells.
2. `integration/xml229-verified-output-readiness.mjs`
   `projectXml229RunChecklist()` verifies the live Worker receipt, source
   generation, basis ID, 7 FactRecords per physical, and the complete
   Source / Match-1 / Final / unresolved mass census. It replaces only
   Preview and Weight checklist rows; it does not authorize native output.
3. `ui-adapted/xml-cii-adapted-output-run.js`
   `projectOriginalReviewIntoRunChecklist()` asynchronously requests the
   current Worker `readCompletion()`; it can refuse a replaced/stale session
   and reproject the report. Previously the status row offered no
   per-boundary diagnosis; missing session and verified Final were displayed
   under the same unchanging native-release message.
4. `ui-adapted/xml229-flow-trace-registry.mjs` and
   `contracts/xml229-flow-trace-v1/{trace,audit}.mjs`
   maintain ephemeral chronology across Preview/Weight/Output; they are
   non-authorizing and reject malformed event chronology.
5. `integration/xml229-nonreleasing-native-candidate.mjs` (PR #312)
   exercises actual GC-PW Worker → parity → R2 mass-written engine XML →
   native Pyodide CII. Successful candidate evidence is still explicitly
   **nonreleasing** and cannot satisfy independent G5/I03 ownership or
   engineering approvals. There is no supported code path that turns
   such a candidate into a governed native CII release credential.

Therefore it is incorrect to interpret this one checklist error as
"Weight is not filled". A fixed native policy HOLD is conflated with the
actual first unsupported/missing upstream evidence.

## How to obtain a useful audit

Open **5 Run** on the current source and expand
**Why is native Run HELD? — source/Worker audit trail**.

You will see a bounded `diagnosisCode`, a `firstUnverifiedBoundary`,
and seven stage rows. Click **Download fresh Run HOLD audit trail JSON**.

The download performs an independent *fresh* current-Worker `readCompletion()`
and `readNativeFinalIntent()`, then challenges source SHA/generation,
Worker basis/source ID, exact counts and the current lease. It records
RUN_AUDIT_REQUESTED / COMPLETED / FAILED and RUN_GATE_DIAGNOSED in
the session-only chronological log, then invokes the separate chronology
auditor to detect lost, reordered or unpaired operations.

Interpret `diagnosisCode` by stage:

| Cause | Meaning / next source to inspect |
| --- | --- |
| `LIVE_WORKER_SESSION_MISSING` | No current GC-PW session is bound to this UI stateRef. Inspect Preview bridge, registry, source changes, rerenders. |
| `WORKER_SESSION_CLOSED` / `WORKER_READ_FAILED` | Worker disposed or RPC failed. Inspect failure code and immediately preceding trace events. |
| `SOURCE_RECEIPT_DRIFT` / `SOURCE_GENERATION_DRIFT` / `WORKER_SCOPE_OR_BASIS_DRIFT` | Loaded source/branch/receipt changed after the Worker was started. Rebuild on exact current source, never adopt an old proof. |
| `WORKER_FACT_CENSUS_DRIFT` / `WORKER_MASS_CENSUS_DRIFT` | Physical, FactRecord or mass-category population is incomplete or inconsistent. |
| `UNRESOLVED_PHYSICAL_MASS` | At least one physical lacks an accepted positive source/Final mass. |
| `MATCH1_NOT_FINAL` | Some original physicals have Match-1 only. |
| `FINAL_INTENT_NOT_OBSERVED` | Source/Final coverage appears complete, but the Final-intent read has not yet been made for this snapshot. Downloading fresh audit queries it. |
| `NATIVE_CANDIDATE_FAILED` / `NATIVE_CANDIDATE_NONRELEASING` | The attempted real converter diagnostic failed or completed, but independent release is still not established. |
| `INDEPENDENT_NATIVE_RELEASE_AUTHORITY_ABSENT` | Complete source/Final eligibility exists, but an accepted independent native-output release authority is not wired or approved. |
| `MULTISOURCE_RELEASE_UNSUPPORTED` | More than one enabled source cannot borrow a single-source proof. |

No diagnostic branch changes the final Run gate or enables a download.
The export contains aggregate counts, typed codes, stage statuses and a
bounded event chronology. It contains **no original XML, JSON, master
data, original physical IDs, private hashes, Worker payloads, or CII bytes**.
All evidence is ephemeral; it is exported only when the Owner clicks.

## Acceptance / adversarial controls

- Pure deterministic stage audit, including missing session, stale source,
  census drift, unresolved vs Match-1 vs complete Final, and nonreleasing
  candidate success/failure.
- Independent chronological audit rejects invalid/reordered/missing events
  and reports dropped ring-buffer history, never invents prior events.
- Real Chromium root/docs Run panel offers audit export while ordinary
  governed Run and candidate without a Worker are disabled.
- Root `tabs/` and public `docs/tabs/` files remain byte-for-byte mirrored.
- Release authority remains false in all reports and cannot be modified by
  any audit, report, or stale cached result.

## Current-Worker Final intent observation — review branch (28 Oct 2026)

The ordinary Run-panel Worker projection now requests a **read-only native Final
intent** when its current Worker completion census is complete (no unresolved
or Match-1 physicals). Previously this request was conditional on already
having a native output, so the display could continue reporting
`FINAL_INTENT_NOT_OBSERVED` despite accepted Weight/Final mass completion.

The Final intent is challenged against exact Worker/source generation, basis,
physical and seven-Fact census, accepted Source/Final counts and a valid intent
SHA. This is an **observation only**: neither accepting a Weight draft nor
creating a release credential. If the intent cannot be read, the current
verified Weight census remains visible; the audit reports
`FINAL_INTENT_READ_FAILED` and a sanitized `worker.finalIntentReadFailureCode`.
Stale/contradictory intents fail with a distinct `FINAL_INTENT_*_DRIFT` or
`FINAL_INTENT_INVALID` finding, never `VERIFIED`.

Downloading a fresh Run HOLD audit now updates the visible diagnosis and stage
table as well as exporting the evidence. Source replacement or Worker closure
fences in-flight reads. The governed native CII release gate is unchanged:
actual converter output, current Worker Final intent and independent emitted
mass reconciliation are still mandatory. A complete Weight Match is **not**
equivalent to native output acceptance; an unresolved Final draft still requires
the user's explicit review. This change does not grant CII download authority.
