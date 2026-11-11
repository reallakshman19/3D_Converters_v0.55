QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: ENGINEERING_UNITS_AUTHORITY
QUALIFICATION_PROFILE_VERSION: 1
CHAIN_ID: XMLCII-ISSUE-769
QUESTION_SET_ID: QS-XMLCII-769-WEIGHT-001
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-WEIGHT-EMPIRICAL
QUALIFICATION_BASIS_HEAD: 56712d666a15d61958a1c30738024b8f07f44227
OWNER_QUALIFICATION_BASELINE: QB-ISSUE-769-C
QUESTION_SET_STATUS: CURRENT
QUESTION_SET_ADMISSION_STATUS: PENDING_INDEPENDENT_ADMISSION_ON_TAKEOVER

# Q1 — Production Trace / Unit Custody
Repository anchors: `converters/xml-cii2019-core/weight-match-model.js`; standalone Weight Match UI; final standalone/consolidated rigid review state; `tabs/model-converters/converters/xmltocii2019_runner.js`; `converters/invocation-builder.js`; `converters/scripts/xml_to_cii2019.py`.
Production object/case: one rigid/component accepted at `12.5 kg` in UI/config and emitted to CII with kg→N compatibility scale enabled.
Required derivation: trace the value from source XML/master suggestion through Weight Match persistence, final-review persistence, enrichment into `<Weight>`, invocation construction, `_rigid_weight_for_edge`, and `_build_rigid_payload`.
Required numerical evidence: prove the normal contract is `12.5 kg -> 12.5 XML Weight -> 125 CII weight` when `--weight-scale 10` is supplied; identify every multiplication or unit conversion on the path.
First authority boundaries: accepted UI mass [kg] -> effective rigid-weight resolver [kg] -> enriched XML Weight [kg] -> Python writer -> CII force-like weight [N-compatible value].
Fail if: a suspected 100× symptom is used to change `weight-scale` without showing a second multiplication in the actual path.

# Q2 — Failure Isolation / Stale Override Lifecycle
Repository anchors: Weight Match `saveInput`; `xmlCiiRigidWeightOverrideForNode`; final `Rigid Weights Need Review — Consolidated` update application; standalone run workflow; preview/run parity and runner direct reads of `overrides.rigidWeight`.
Concrete payload: legacy persisted `rigidWeight[key]=125`, current Weight Match suggestion/acceptance `12.5`, final review intended `12.5`.
Required derivation: reconstruct which value each stage currently sees and show how a single shared legacy bucket makes old, Match-1, and final-reviewed values indistinguishable. Determine whether stale `125` kg can be re-injected and then multiplied by writer scale to `1250`, mimicking a double-conversion symptom without two writer multiplications.
Predicted intermediate values: stale legacy path may present `125 kg` as already mapped; correct current-stage accepted value remains `12.5 kg`; only final writer conversion creates `125` output from `12.5`.
First wrong boundary: persistence/authority selection before the writer, unless a second actual multiplication is found.
Falsifier: if the same 12.5 kg value is demonstrably multiplied twice after effective-weight resolution, re-scope to writer/invocation authority.
Fail if: the fix only changes display text or simply divides persisted values by 10.

# Q3 — Authority / Lifecycle Invariants
Required technical work: define separate lifecycle authorities and invalidation rules.
Required precedence: `rigidWeightFinal` > `rigidWeightMatch1` > legacy `rigidWeight` > positive source XML weight, with master candidates remaining suggestions only until accepted.
Required invalidation: writing/changing Match-1 for a key invalidates any Final value for that key; writing Final does not mutate Match-1 evidence; legacy values remain backward-compatibility evidence and never outrank current-stage buckets.
Required output invariant: all persisted lifecycle weights are kg; kg→CII conversion occurs only at the Python writer boundary. No JS UI, resolver, preview, or enrichment layer may pre-scale by 10.
Compatibility requirement: legacy-only configs continue to resolve, but once a current lifecycle bucket exists it outranks legacy deterministically.
Negative controls: stale legacy 125 vs current Match-1 12.5; Final 13.0 vs Match-1 12.5; duplicate node numbers across branches; generated child nodes sharing component ancestry.
Fail if: two independent components can collide on an unqualified node-number-only key without branch/fallback-key arbitration.

# Q4 — Independent Validation / Empirical Health
Repository anchors: `converters/empirical-weight/empirical-weight-validation.js`; `xml-cii-adapted-weight-validation-report.js`; old subset validator popup(s).
Required technical work: validate resolved accepted component weights read-only using A1/A2 and expose per-row health for every resolved row, not only abnormalities.
Concrete boundaries: estimated `100 kg` with observed `70 kg` and `130 kg` are exactly ±30% and therefore NOT abnormal; `69.9 kg` and `130.1 kg` are abnormal. Unavailable empirical estimates are explicitly `UNVALIDATED`, not green/all-good.
Required UI evidence: row-level health indicator attached to the Weight Match/review row with observed kg, A1/A2 estimates/deviations, effective source, and threshold in tooltip/details; report remains downloadable and read-only.
Independent oracle: direct arithmetic `((observed-estimate)/estimate)*100`, plus A1/A2 validator result; old catalog/subset validator must not be presented as the empirical ±30% authority.
Falsifier: if validator output mutates accepted weights or exact ±30% is flagged abnormal, the implementation fails.
Fail if: zero abnormalities is rendered as “all good” when all rows are skipped/unvalidated.

# Q5 — Minimal Legitimate Patch / Qualification
Safe patch boundary: introduce one shared rigid-weight authority resolver/writer helper; route Weight Match, final review, preview/run parity, enrichment/run application, and validation provenance through it; retire/de-authorize misleading old popup behavior; add row-level empirical health without changing accepted weights.
Expected before/after: before, multiple stages write/read `overrides.rigidWeight` with no lifecycle identity; after, Match-1 and Final are separate kg buckets with deterministic precedence/invalidation and the runner consumes the effective kg map exactly once before Python scale.
Protected unchanged domains: B31.3 calculations/material factors, line-list/regex/branch mappings, roadmap/source oracles, configured writer scale `10` unless Q1 falsifies the single-conversion trace.
Validation required: focused resolver lifecycle tests; `12.5 -> 125` writer arithmetic/invocation regression; stale-legacy negative; exact ±30% empirical boundary tests; old-popup non-authority/static wiring test; full standalone suite when executable.
Rollback/falsifier boundary: revert if current accepted weights no longer reach conversion, legacy-only configs become unreadable, final review can be silently overwritten by an earlier stage, empirical validation mutates authority, or output scale changes without an independently proven writer defect.
No-patch condition: if exact-source tracing reveals another owner is the first wrong boundary, stop and re-scope instead of layering a UI compatibility patch.
Fail if: the patch treats a provenance problem as a numeric correction.