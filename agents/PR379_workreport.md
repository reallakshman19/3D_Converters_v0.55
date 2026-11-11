# PR379 — Recovery-first work report

## Handover in 60 seconds
PR: https://github.com/reallakshman19/3D_Converters/pull/379 (DRAFT, NO MERGE).
Issue: https://github.com/reallakshman19/3D_Converters/issues/376.
Branch: fix/xml229-candidate-preview-native-hold-20261102; baseline main `2477a6fdee1002d5063bc51e94777ba940e6fa82`.
Original user evidence: native `FAILED`, `XML229_STAGED_POSITION_AMBIGUOUS` after 27015ms, accepted Weight Final 249/249 with 1743 facts; audit misleadingly prioritized `BRANCH_FORMAT_IDENTITY_UNRESOLVED`.

## Current technical status
- Implemented display-only candidate F1/F2 Line Keys in editable 4 Preview rows, joined by source branch occurrence index (and name cross-check); no authority/persisted field mutation. Conflict table now displays entire source branch population with bounded-height scroller.
- Implemented Run HOLD `NATIVE_CANDIDATE_FAILED` precedence and actual failure explanation while preserving separate format warning and no-download hold.
- Implemented bounded Python 20-entry conflict sampler with claim index, position-owner row indices and counts; native code prints source-safe summary before stable `XML229_STAGED_POSITION_AMBIGUOUS` refusal. Does not resolve positional ambiguity.
- Edited 6 production source files and 6 docs byte-identical mirrors; existing files preserved under `.backups/20261102-xml229-candidate-hold/`.
- Added `tests/xml229-preview-line-key-candidate-propagation.test.mjs`; extended two native audit/Python tests.

## Evidence and validation
[Validation record](../ValidationRecords/xml229-pr379-focused-validation.json).
- PASS, LOCAL_EXECUTION: equivalent patches in PR378 browser site runtime: 41/41 EF05 rows display both F1/F2 source-extracted Line Keys, independent authoritative `lineKey` blanks.
- PASS, LOCAL_EXECUTION: native failure primary diagnosis and `ciiDownloadAuthorized=false`.
- PASS, LOCAL_EXECUTION: Node JS syntax on four edited modules; Python compile and synthetic coincident-position source ambiguity. Exact repo source browser integration remains NOT_RUN.
- PASS, REMOTE_EXECUTION: [Run HOLD audit CI](https://github.com/reallakshman19/3D_Converters/actions/runs/41377561376) Node22 63/63; Node24 63/63. [Real 4 Preview CI](https://github.com/reallakshman19/3D_Converters/actions/runs/41377561030) 10/10.
- Crucial falsifier: public EF05 original XML + public original staged JSON yield `dtxrPosAmbiguous=0`, `dtxrPosMandatoryUnmatched=320`, so public original inputs do **NOT** reproduce owner's actual post-Final staged position ambiguity. No claim of Final fix.
- NOT_RUN: Owner's finalized 249-mass native output, private staged ownership diagnosis, governed CII download and independent source/Final mass reconciliation.
- Some unrelated CI workflows remain running; full CI green is NOT claimed.

## Issue and risk register
ISS-1: User cannot download governed .cii: real staged JSON positional ownership ambiguity remains unresolved; no source-specific details in uploaded stage summary. Correct to refuse output.
IMP-1: Main 4 Preview previously concealed Line Keys due legitimate multi-format authority clearing; now read-only candidate presentation restored.
IMP-2: Audit diagnosed format conflict before an observed failed native run; now failed candidate is primary and format remains secondary.
RISK-1: Full unmodified public source and selected staged JSON are not the accepted Final geometry or exact owner config. Must not infer valid assignment from public fixture; no nearest-owner hack.
RISK-2: PR377 overlaps native explanation semantics (different exact file), PR378 conversion flow, PR260 original Worker/physical authority, PR253 preview Worker. No merge until coordinated.
DEC-1: Leave native output release gates untouched; no unverified .cii.
DEBT-1: New focused test is not explicitly in current CI workflow; execute on exact PR head before approval.

## EXACT_NEXT_ACTION
Use the bounded ambiguity diagnostic from a real governed Final execution to identify failing claim indices and candidate source position rows, recover exact finalized source geometry and staged JSON offsets, resolve ownership with independent evidence (not heuristics), rerun native CII, verify all Final masses and physical owners independently, and only then authorize .cii download. Meanwhile run new focused JS and Python test on exact PR head and real Chromium. No merge/deployment authority.


## Addendum — Safe native failure evidence is now downloadable
Production now exposes only validated, allowlisted `XML229.NativeStagedPositionAmbiguity.v1` samples from native stdout. These appear in the existing `Download execution debug JSON` and `Download safe native failure diagnostic JSON` artifacts on failed native runs; original raw logs, JSON, coordinates and model names remain withheld. Production adds `xml229-native-converter-failure-diagnostic.mjs`, `xml229-native-run-debug.mjs` and their mirrors; current production-file parity covers eight root/docs pairs.
New test: `tests/xml229-staged-ambiguity-export.test.mjs`, validates typed Python failure receipt, bounded sample, privacy and no release authority. Local test of equivalent implementation PASS; exact PR-head test not yet observed in CI.
Public original EF05 + public original JSON is not the accepted Final basis; actual ambiguous claim indices remain unknown. Governed CII remains HELD. Continue with exact finalized source geometry and confirmed bounded sample.
