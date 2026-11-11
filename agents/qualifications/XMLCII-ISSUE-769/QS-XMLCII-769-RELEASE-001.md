QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: RELEASE_INTEGRATION_VALIDATION
CHAIN_ID: XMLCII-ISSUE-769
QUESTION_SET_ID: QS-XMLCII-769-RELEASE-001
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-RELEASE
QUESTION_SET_STATUS: CURRENT
OWNER_PROGRESSION_COMMAND: proceed next
QUESTION_PACK_ACTION: REFRESHED
QUESTION_DISPLAY: SHOW

# Q1 — Production Trace
Trace TASK-001..TASK-008 from Owner-reported symptom through the active authority owner, changed production consumer, and focused regression. Confirm there is no alternate active path that can overwrite or bypass the intended authority.

Concrete payload includes semantic line-list mapping, large-master persistence/error boundary, Regex confidence/sample clustering, Branch→Line family ambiguity, rigid-weight Match-1/Final lifecycle, empirical ±30% validation, B31.3 strict factor authority, and authority-schema cache migration.

# Q2 — Current Unresolved Problem / Failure Isolation
For any qualification failure, identify the first wrong boundary and falsify neighboring hypotheses before patching. Candidate boundaries are mapping ownership, parse-vs-persist error classification, regex confidence-vs-coverage semantics, branch family ambiguity, rigid-weight lifecycle/provenance, B31.3 governed-factor eligibility, and derived-cache migration.

No broad patch is authorized from a downstream symptom alone.

# Q3 — Authority / Invariant
Qualification must preserve all of these invariants:
- exactly one final kg→CII writer conversion under configured scale 10;
- rigid-weight authority `Final > Match-1 > legacy > source XML` with Match-1 invalidating stale same-key Final;
- empirical A1/A2 validation is read-only and exactly ±30% is within threshold;
- Branch→Line exact authority first, family inference only for one unique loaded-key survivor, ambiguity/designator mutation fail-closed;
- B31.3 numeric S/E/W/Y automatic eligibility remains strict VERIFIED/PROJECT_APPROVED or complete controlled manual fallback;
- migration invalidates derived caches only and never numerically rewrites source/evidence state.

# Q4 — Independent Validation
Repository-native validation must attempt both focused Issue #769 regressions and the established XML→CII regression guards. Independent controls include:
- `12.5 kg × 10 = 125 CII` and stale legacy `125 kg` lifecycle reconstruction;
- empirical 100 kg estimate with 70/130 inside threshold and 69.9/130.1 abnormal;
- A106 benchmark required nominal wall 12.553618958106954 mm selecting 12.7 mm / Sch 60-XS only under explicitly qualified benchmark inputs while strict Preview rejects BENCHMARK_ONLY;
- P4110010 family resolution unique-vs-ambiguous negative control and B→P prohibition;
- 11,000-row storage-quota fault preserving active-session authority;
- first-run authority-cache invalidation followed by idempotent no-op while evidence keys survive unchanged.

# Q5 — Next Contribution / Minimal Patch
If qualification passes, NO PATCH: do not alter production behavior further. If a test fails, patch only the demonstrated first wrong boundary, preserve all unrelated authority contracts, re-run the focused suite plus the affected established regression suite, and keep PR #770 draft until repository-native evidence is green. Merge remains OWNER_ONLY and MERGE_AUTHORIZED FALSE.
