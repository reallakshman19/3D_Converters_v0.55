QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
CHAIN_ID: XMLCII-ISSUE-769
QUESTION_SET_ID: QS-XMLCII-769-REGEX-BRANCH-001
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-REGEX-BRANCH
QUALIFICATION_BASIS_HEAD: 26dac1995564575d0325c299efb4ca150f463048
OWNER_QUALIFICATION_BASELINE: QB-ISSUE-769-B
QUESTION_SET_STATUS: CURRENT
QUESTION_SET_ADMISSION_STATUS: PENDING_INDEPENDENT_ADMISSION_ON_TAKEOVER

# Q1 — Production Trace
Repository anchors: `tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js`, `tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js`, `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js`, and the adapted Regex Tester token builder.
Production object/case: branch `/GLRD-1000-6"-P4110010-93833-01/B1` presented in the Regex Tester with a Line Key suggestion score shown as a percentage.
Concrete payload: delimiter `-`; candidate Line Key token `P4110010`; loaded Line List evidence containing only a subset of structurally matching keys; current line-key confidence formula `0.72*exact + 0.16*uniqueness + 0.18*lineShape - widthPenalty`.
Required derivation: trace a branch sample from XML parsing through sample bucketing/tokenization, candidate scoring, exact-master coverage, suggestion receipt, token badge, and evidence panel. Compute one case where exact master coverage is 50% but composite confidence is 70% and explain why those two percentages are not interchangeable.
Required numerical/technical evidence: for four equally unique/line-shaped candidate values with two exact master matches, derive `0.72*0.50 + 0.16*1.00 + 0.18*1.00 = 0.70`; identify the separate 50% exact-master coverage.
First authority/ownership boundaries: source branch samples -> structural evidence -> loaded-master evidence -> suggestion score -> presentation. Suggestion confidence is advisory, not mapping authority.
Fail if: the answer calls confidence “match percentage”, hides exact-master coverage, or treats UI `HIGH`/percent labels as authority.

# Q2 — Current Unresolved Problem / Failure Isolation
Repository anchors: `xml-cii-adapted-branch-line-map-panel.js`, `xml-cii-adapted-branch-line-pattern-detect.js`, Mode-A smart-map consumers, loaded Line List keys.
Calculation/reconstruction: resolve `/GLRD-1000-6"-P4110010-93833-01/B1` against loaded key sets using exact boundary matching first, then progressively generalized family masks.
Concrete payload: source token `P4110010`; case A loaded keys `[P4110001]`; case B `[P4110001, P4110003]`; negative source token `B4110004` against P-family keys.
Required derivation: show the progression `P411001X` -> `P41100XX` and stop at the first specificity level with authoritative candidates. Case A may resolve only if exactly one loaded key survives. Case B must be ambiguous. `B4110004` must not become a P-family key without an explicit governed designator transformation.
Required numerical/technical evidence: candidate counts at each specificity level and the exact point at which unique/ambiguous status is decided.
First wrong boundary: resolver authority stops at exact embedded/boundary keys, so structurally obvious but non-exact families currently return none.
Falsifier: if an exact boundary-safe loaded key already exists in the branch, family inference must never override it.
Fail if: the solution chooses the lexicographically first family member or silently rewrites B -> P.

# Q3 — Authority / Invariant
Repository anchors: branch Auto-Suggest, Auto Detect Pattern, Apply Pattern, loaded Line List master.
Required technical work: state the authority ordering and mutation invariants for exact branch matches, progressive family inference, regex proposals, replacement capture groups, and final mapping writes.
Concrete payload: `$1` replacement semantics, loaded Line List exact-key set, unique/ambiguous family masks.
Required derivation: prove that Apply Pattern may transform branch text but may write only a result that is exactly present in the loaded Line List. Auto-Suggest may assign a family result only when the most-specific family mask yields one authoritative key. Ambiguous candidates remain unmapped.
Protected invariant: loaded Line List membership is final mapping authority; regex/family structure is discovery evidence only; no fuzzy/generated key becomes authoritative by score alone.
First wrong boundary: discovery/resolver layer, not later Preview or CII generation.
Invalid shortcut: hard-code `P4110001` or a specific GLRD branch layout.
Fail if: a regex replacement or family mask can create a persisted key absent from the loaded master.

# Q4 — Independent Validation
Repository anchors: pure suggestion/detection helpers plus focused Node tests.
Required technical work: define independent fixtures for confidence/coverage separation, representative sample bucketing, exact/family branch resolution, ambiguity, and Apply Pattern authority.
Concrete payload: 4 Regex samples with 2 exact master line-key matches; branch-family fixtures `P4110010` with one vs two loaded P-family keys; B/P designator negative; pattern coverage cases 6/10, 7/10, and 19/20 exact loaded-key outputs.
Calculation/reconstruction: independently compute Regex composite confidence = 70% while exact coverage = 50%; verify branch pattern confidence labels remain LOW at 6/10, MEDIUM at 7/10 (with >=2 exact), and HIGH only at >=95% with >=2 exact and >=2 distinct keys.
Independent oracle: explicit arithmetic plus literal loaded-key sets; no UI status label is an oracle.
Required numerical/technical evidence: representative bucket counts sum to total unique samples; one representative per structural signature; unique family candidate count 1 maps; candidate count >1 blocks; pattern coverage thresholds 0.70/0.95 are exercised exactly.
Falsifier: if bucketing changes extraction results or drops a structural signature, the UI-only sampling change is invalid.
Fail if: a green UI or source inspection is promoted to benchmark PASS without executing tests.

# Q5 — Next Contribution / Minimal Patch
Repository anchors: Regex suggestion receipt/UI, Regex Tester sample selector, branch mapping resolver/actions/pattern UI, focused tests.
Required technical work: bound the smallest legitimate production-owner changes for TASK-005/TASK-006.
Safe patch boundary: add explicit evidence metrics to Regex suggestions; display confidence and exact/standard coverage separately; bucket sample selector by structural signature with representative/count; extract branch actions/resolver into a pure helper; add progressive family inference with unique-authority guard; explain `$1/$2` capture replacement inline; retain exact-key validation on Apply Pattern.
Protected unchanged domains: line-list import changes from LEG-001, weight authority and kg->CII scale, empirical validation, B31.3 factors, Owner roadmap/source/oracle.
Expected before/after evidence: before, every branch appears in sample selector and composite confidence can look like a match rate; family-only unmapped branches return none. After, representative buckets preserve every signature, score vs coverage is explicit, and family mapping occurs only for exactly one loaded key.
Negative tests: exact match remains highest authority; ambiguous family remains unmapped; B->P is blocked; regex output not in Line List is rejected; manual mappings remain untouched.
Rollback/falsifier boundary: revert if Mode-A exact mapping behavior regresses, representative bucketing changes extraction inputs rather than presentation only, or any non-loaded key becomes persistable.
No-patch condition: if exact-current source shows the reported behavior belongs to a different authority owner, stop and re-scope rather than adding a second resolver.
Fail if: the contribution is a display-only relabel that leaves ambiguous authority unchanged, or a broad refactor unrelated to TASK-005/TASK-006.