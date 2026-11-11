# WIP-781-P1-REGEX-20260929 — Issue #781 Token Builder evidence transport

## Basis

```text
ISSUE = #781
PLAN = IMPLEMENTATION_PLAN rev 1 / issuecomment-5893573324
BASE_MAIN = 7057e3d031663fbe92c22f4a3b8c98cc32d06e7b
BRANCH = agent/issue-781-p1-regex-evidence-20260929
PR = #784
CRITICALITY = ENGINEERING_CRITICAL
PROTOCOL = V3.1 / Common@1ced68258afeaf50df113b1d38a4ceb9193587e3 / TPG-2P-2026-09-28-R3
MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED
```

## Resolved RCA

The Regex/Token Builder already had the required smart inference engine. Its scorer clusters full token-class signatures, validates line-key candidates against Line List evidence, validates Piping Class candidates and known class bores, and separates trusted master/source authority from heuristics.

PR #780 intentionally moved large masters behind worker/IndexedDB dataset references and cleared resident full arrays from persistent UI state. The Smart UI still passed `masterContext.lineRows` and `masterContext.pipingClassRows` directly to `buildRegexSuggestionPreflight()`, so the existing scorer lost authoritative evidence even though the datasets were loaded.

Preflight cache identity also did not distinguish empty resident evidence from transiently hydrated evidence. A heuristic receipt could therefore share a cache basis with a later master-backed evaluation when row counts/revisions were unchanged.

## Implemented correction

1. Added operation-scoped evidence transport for **Line List + Piping Class only**, using the existing PR #780 dataset materializer.
2. Hydrated rows remain local to the Smart operation; they are never written back to persistent `state.masterContext`.
3. Reused the existing `buildRegexSuggestionPreflight()` scorer and existing thresholds/authority classes.
4. Extended preflight cache/fingerprint identity with evidence mode, dataset identity and hydrated counts so heuristic and master-backed receipts cannot alias.
5. Added semantic extraction statuses while preserving existing `matchedRows` / `rejectedRows` collections:
   - `EXTRACTED`
   - `MASTER_VALIDATED`
   - `REVIEW_REQUIRED`
   - `REJECTED`
6. Dataset-backed Smart UI now fails closed until authoritative evidence is explicitly analyzed; heuristic-only suggestions are not auto-applied when dataset refs exist.
7. Full dataset materialization happens only on explicit Smart Analyze / Preview / Apply actions, never on each render.
8. Apply/token actions re-resolve evidence and reject stale sample/config/master bases.
9. Runtime/docs deployment mirrors were updated byte-identically, including the new evidence helper.
10. Updated the existing #776 deployment-parity contract to the Issue #781 release identity; no #776 workflow gate was weakened.

## Reported branch qualification

Fixture:

```text
/SDMI-1000-TI-16"-P0310080-61440-01/B3
```

Transient authority fixture:

```text
Line List:     P0310080
Piping Class:  61440
Class bore:    DN 400
```

Qualified existing-scorer result:

```text
Token 5  P0310080 -> lineKey      -> AUTHORIZED_MASTER -> SAFE
Token 6  61440    -> pipingClass  -> AUTHORIZED_MASTER -> SAFE
Token 4  16"      -> bore         -> EXPLICIT_SOURCE   -> class-bore corroboration = 100%
semantic row status              -> MASTER_VALIDATED
```

Persistent `masterContext.lineRows` and `masterContext.pipingClassRows` remain empty before and after the operation.

## Validation

Validated exact material/test head: `d21753e821daed57ce0bd48e132e9d77ff28a9aa`.

### Issue 781 Regex Master Evidence Validation

Run `36614503076` — **PASS**

- Issue #781 reported-branch transient evidence regression: PASS
- existing Smart UI preflight regression: PASS
- regex confidence buckets: PASS
- #776 regex index/cache regression: PASS
- PR #780 dataset coordinator regression: PASS

### Issue 776 XML-CII Authority Validation

Run `36614502811` — **PASS**

- Issue #776 focused regressions: PASS
- PR #780 master dataset regressions: PASS
- adjacent authority head/base classification: PASS; unrelated failures remain baseline-only
- enforcement gate: PASS
- exact-head WSW browser conversion: PASS
- 10k / 50k / 100k master dataset browser scale: PASS

The first #776 run correctly caught a stale deployment-parity cache-bust assertion. That test was updated to require the Issue #781 release identity and the new evidence-helper parity; production behavior was not weakened to satisfy the gate.

## Architecture / authority invariants

- no new Regex inference algorithm;
- no persistent full master arrays on the main UI thread;
- no unrelated master materialization;
- existing smart scorer remains the authority;
- heuristic evidence cannot masquerade as master-backed evidence;
- PR #780 worker + IndexedDB dataset ownership remains intact;
- manual Token Builder configuration/locks remain supported;
- merge remains Owner-only.

## Recovery

Exact pre-edit Git blob backups are under `.backups/issue-781/p1-regex/`, including the later deployment-parity test edit. Native `node utils/backup.js` could not be executed in the connector-only environment and is **NOT_RUN / not claimed**.

## Handoff

`STEP-781-03` is implementation-complete and validation-clean. PR #784 may be marked ready for Owner review. Remaining #781 slices are separate delivery surfaces: Weight Match presentation, material candidate/106 suggestion presentation, and Mode B topology composition.
