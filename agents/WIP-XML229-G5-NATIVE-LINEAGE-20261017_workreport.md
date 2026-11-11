# XML229 G5 non-releasing native lineage challenger — WIP work report

Baseline main: 9aac1629f1cbd5c3792943d6f475c088b001e3e4. Branch: validation/xml229-g5-native-element-lineage-20261017. Parent issue #274. Separate from open/draft PR287 causal tracer and held draft PR273.

Owner instruction "ok proceed" following verified causal trace PR287. Work focuses the missing G5 capability rather than patching the deliberately blocking Output/Run native release row. 
A1: Source-to-CII has existing I03 mass ledger oracle with original SHA, frozen Preview, RigidMatch1 and Rigidmatch2 snapshots, explicit scale and actual CII RIGID rows. New held-out challenger verifies native ELEMENTS 15-line block count, RIGID pointer uniqueness and 1-based-to-0-based correspondence, native edge endpoint claims, original source branch/node ordinals and source field identity. The challenger first runs I03; never trusts output-derived masses as decision input.
A2: The 423/2961 screenshot confirms physical FactRecords but zero Source kg, 0 Match1/Final and 423 unresolved. An independent output oracle cannot fabricate missing accepted masses; Owner original and four masters NOT_RUN.
A3: No production engine/UI/Worker write, scorer, auto-acceptance, native release predicate or claimed physical Match-2 consumption changed. Result always false release. Independent child geometry/lineage author authenticity remains unverified.
A4: Synthetic tests and dedicated GitHub workflow authored, exact head run PENDING until observed. No 100MiB/2m acceptance, no actual Owner emitted native CII.
A5: Rejection tests: wrong CONTROL/element row count, swapped or duplicate pointers, orphan/unaccounted RIGID, wrong source ordinal/reference, wrong endpoint, invalid output SHA, accepted mass drift, forged native release flag. A positive synthetic test means only declared bytes and mappings are structurally consistent, NOT production release readiness.

Exact next: create draft PR, wait for hosted G5 test and repair any observed defects without relaxing assertions. Separate Owner-controlled current source and actual CII lineage challenge remains required. Do not merge without explicit Owner authorization.