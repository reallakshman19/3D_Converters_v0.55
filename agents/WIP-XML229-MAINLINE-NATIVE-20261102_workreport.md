# WIP-XML229-MAINLINE-NATIVE-20261102 — recovery-first task
## Mission and live RCA
User's second native output log: 139 accepted Final masses, 973 facts, 0 unresolved; native execution actually failed after 30,324ms at STAGED_POSITION_TRANSFER with XML229_STAGED_POSITION_AMBIGUOUS and 38 ambiguous claims (first 20 sample). Format identities are verified; .cii withheld as expected.
CRITICAL deployment gap: PR379 merged to main 2026-11-02T03:04:37Z; PR380 merged to *feature branch* fix/xml229-candidate-preview-native-hold-20261102 at 03:05:22Z, after PR379 was already in main. Live main lacks PR380 scope patch in converters/scripts/xml_to_cii2019_master_addon.py and xml_to_cii2019_patched.py, docs mirrors, and tests/test_xml229_staged_position_scope.py.
Source truth: PR380 source on merged feature branch already includes dtxrPosMandatoryAmbiguous and dtxrPosExcludedAmbiguous classification; main does not. Exact-file source blobs compared live.
## Scope of new mainline PR
Cherry-pick the known-reviewed PR380 native scoped-ambiguity code into new main-based branch fix/xml229-pr380-native-mainline-20261102 with two source files + two docs mirrors + source-specific Python regression test, no broad rewrite. Preserve backup copies before editing files. Add recovery/validation record.
### Protected engineering authority
- Never select ambiguous mandatory staged support positions by nearest source, tolerance widening, or position index.
- No source-only fallback from an attempted governed Final.
- Preserve exact source/Final basis, all required support and mass facts, native independent output verification.
- Do not enable .cii download without actual verified governed output.
## A1–A5 qualification
A1 Source: native _maybe_enrich_from_staged_json in main rejects any dtxrPosAmbiguous; addon classifies scope but no mandatory/excluded split.
A2 Reproduction: user's actual 38 ambiguous claims are source-position multiple candidates; exact source geometry/JSON not available. Synthetic regression in PR380 demonstrates safe exclusion of non-restraint ambiguity and refusal for mandatory support. Do not falsely claim 38 are excluded.
A3 Contract: new native error gate checks mandatory-only with legacy fallback, preserves failure for ambiguous mandatory support; missing mandatory position still fails; unchanged candidate selection algorithm.
A4 Evidence: PR380 five synthetic Python checks PASS, but checks not established against *this exact new main-based head*. Need new CI and root/docs parity.
A5 Minimal change: source addon + native patched Python + 2 docs mirrors + test. No UI modifications.
## Coordination
PR379 and PR380 marked MERGED but PR380 not in main because stacked to already-merged feature branch. Avoid changing either branch. Existing #377, #260, #253 overlapping engineering authority tracked; no exact-path PR write to their branches.
## State
Read-only classification complete; new branch created based on latest live main. Production edits PENDING.
## EXACT_NEXT_ACTION
Back up both main-native Python files to this WIP branch; copy exact PR380 scoped-ambiguity source from merged branch after verifying main-only diff; add Python regression test; run direct tests or record limits; draft PR against main, no merge or deployment.
