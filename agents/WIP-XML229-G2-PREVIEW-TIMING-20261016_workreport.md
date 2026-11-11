# WIP-XML229-G2-PREVIEW-TIMING-20261016

Parent #274, Owner instructed merge and proceed next. Context: PR #281 merged into main at 6e7f4b98e286d19598fc6cb27f007c12811fbc4d (read-only); PR #282 merged into held #280 at 93e23d03b67f52c75f69e77eda6b1b838346088b; PR #283 into same held #280 at c68800019220a329a674454c52398e04e1ae6fe6. #280 remains OPEN/DRAFT based on #276; **production main still has none of the runtime changes**.

Mission: G2 cold Preview stage timing in actual served Chromium via an existing P4 integration harness, without fake release evidence or private source data. Input is a public synthetic original Blob, 3 physical occurrences, 21 FactRecords. Adds monotonic elapsed timestamps for existing Worker status events, plus child-only sha256 progress and required ordering; no runtime code, CI workflow, Worker's data contract, UI or native converter changed.

A1: existing source-bound Worker now delegates actual dryrun to a distinct child module Worker; current P4 browser test already tests complete source/Final/mass and Input transfer HOLD. A2: no measured Owner private cold Preview duration/peak RAM. A3: final approval always distinct; absent child-only stage is a test failure, not UI fallback. A4: hosted exact-head CI NOT_RUN before PR creation, no Owner data. A5: benchmark stdout synthetic fixture only, no claim on 385/10699/383/1595/41/423/2961. No extra scoring authority.

Risk: child nested progress may be observed before Ready but userland performance is not CPU/RSS; assert only internal monotonically increasing elapsed times. Native G5 correspondence still UNVERIFIED and governed Run HELD. Full v3.6 plan/writable Owner directive remains unconfirmed. Owner-only merge/deploy.

EXACT_NEXT_ACTION: open draft PR targeting held #280, run P4 Worker original-blob Chromium and Node22/24 focused workflows; extract stage timings from successful job log, then request Owner private cold benchmark with same basis hashes and full physical/master census, before updating integration readiness.
