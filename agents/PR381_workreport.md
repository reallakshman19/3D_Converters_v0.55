# PR381 — recoverable mainline native fix

## Essential source truth
Draft PR https://github.com/reallakshman19/3D_Converters/pull/381 against main, not merged. Original 139-Final owner run actually attempted native and failed at STAGED_POSITION_TRANSFER, 38 ambiguous claims, 20 sampled. User's Run HOLD audit already identifies correct failure, not format conflict. Claimed support ambiguity may be required or excluded; summary has neither scope nor source content.
**Crucial new RCA**: PR379 merged into main at 03:04:37Z, PR380 merged into PR379's feature branch at 03:05:22Z. GitHub marked PR380 "merged" while its code was absent from live main. Direct blob verification established gap. This PR reintroduces precisely PR380's scope fix with a main base.

## Scope and protection
Changed only native addon/engine two Python sources and docs mirrors, plus focused five-case synthetic regression test. Existing production sources archived in `.backups/20261102-xml229-pr380-mainline/`. No runtime/writer switch, source-owner auto choice, tolerance widening, engineering mass mutation or CII release change.
Source and target blob SHA values, inherited test status and exact limitations in `ValidationRecords/xml229-pr381-mainline-native-scope-recovery.json`.

## Status ledger
PASS (GitHub source evidence): confirmed PR380 had never landed on main, native Python source exact copy on branch, two docs/source identical source copies, regression test exact blob from PR380.
PASS (INHERITED, not new execution): PR380 5/5 synthetic native source-collision tests including mandatory support ambiguity still fatal, non-restraint excluded, 21 excluded before mandatory sampled, mandatory unmatched still fatal.
NOT RUN (exact head): new PR381 Python regression on actual PR head and real Chromium/native governed run.
NOT RUN (Owner): original source XML and selected staged JSON/offset/accepted Final 139 mass packet not present; cannot decide 38 ambiguous claim scopes and cannot authorize a .cii download.
CI newly queued after PR creation; no global green assertion.

## Independent validation and recovery
Rerun new exact tests and current CI, address any true regression. With owner's exact finalized XML+staged JSON and source-bound Final packet, rerun native stage to split 38 ambiguous claims by mandatory/excluded. If mandatory remain, resolve with independent exact source evidence only. Then native output must pass one-to-one mass and physical owner reconciliation before downloadable CII. Branch feature PR379/PR380 are merged in GitHub metadata but PR380 was NOT in main prior to this PR. Keep PR381 draft and do not merge without user authorization.
EXACT_NEXT_ACTION: verify PR381 exact-head CI and use owner's real 139-mass native basis to validate all required staged positions and final CII reconciliation.
