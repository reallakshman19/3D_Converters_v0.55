# WIP-XML229-BM2-PS-20261101 — proof-first BM2 PS-tag enrichment repair

STATE: ENGINEERING_CRITICAL / DRAFT_PR_PENDING / CI_NOT_RUN
BASE_MAIN_SHA: c231cd383f7aa3d3ea8b5eae7d06a1f2b1a13986
BRANCH: fix/xml229-bm2-ps-dtxr-bridge-20261101
PR: PENDING
OWNER_REQUEST: prove missing Guide / LINE STOP / gap at BM2 node 3430 PS00574.1;
diagnose blank node 20→30 data and alleged 5950→5960 weight loss before draft PR.
CURRENT_SCOPE: exactly missing no-hyphen PS tag matching in native staged-json enrichment,
plus proof regression, source/docs parity and recovery evidence.

## A1 Production/source trace and independently inspectable evidence
BM2 XML from Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml
has 31 Branches, 1196 Nodes and 70 PS-named nodes. All 70 names use PS<digits>.<suffix>
without a dash (e.g. PS00574.1). Node 3430 occurs exactly once, in branch occurrence
index 28 (/GLRD-1000-8"-B4110003-13451-01/B1) at ordinal 8, Position
123504.12 114999.98 101330.73, type ANCI, no XML Restraint/Gap.
In converters/scripts/xml_to_cii2019_master_addon.py both _ps_tags_from_text and
_normalize_ps_tag previously required a literal PS-<digits> marker, so none of the
70 BM2 XML NodeName values could join the original JSON PS-tag index.
The native runtime calls patched._maybe_enrich_from_staged_json -> addon.enrich_xml_addons
to annotate DTXR_PS/DTXR_POS. Missing DTXR annotation means no downstream text-based
GUIDE/LINESTOP/GAP propagation from that path. This is a VERIFIED deterministic
source-matcher defect; it does not prove the exact private Owner JSON entries/gap.

## A2 Minimal corrective change and falsifier
Allow optional '-' in PS-tag extraction and normalize BOTH styles to the existing
PS-<digits> key. Preserve the earlier suffix truncation, staged JSON row order and
existing PS-with-hyphen behavior. Do NOT merge different numeric tags or inject
source-independent support classifications. A negative control based on unmodified
source yields no PS tag for PS00574.1; a successful changed source matches both
PS00574.1 and /PS-00574.1 with the same canonical key.
Regression in CI-invoked tests/xml229-native-substage-diagnostic.test.py:
uses the REAL BM2 XML node3430 and nearby node3420, plus deliberately SYNTHETIC
two-entry staged JSON with GUIDE, LINE STOP and an explicitly marked synthetic
15mm gap to challenge addon DTXR_PS -> converter _build_keyword_restraint_specs.
Expected: only node3430 receives those annotations, CII restraint spec codes {8,9}
and synthetic LINE STOP gap 15mm at spec stage.
This synthetic value is NOT an Owner gap value or engineering authority.
Run test/CI and note actual results; no tests are claimed PASS until executed.

## A3 Authority/invariants
No changes to source XML, original JSON, Owner masters, Preview's accepted data,
Final mass ownership, weight value/zero policy, finalized geometry/physical lineage,
CII writer, torque/directions, mass-to-force scale, independent actual CII release,
download authorization or static source/document formatting.
Do not auto-populate a gap from unmatched/ambiguous JSON or guess values.
Existing verify/hold controls remain authoritative. Safety: no automatic changes to
PRE-FINAL support assumptions, only previously verified source-tag joining.

## Distinct unresolved Owner concerns and evidence boundary
- Node 3430 original XML contains NO Guide/Line Stop/Gap. The Owner's real
  staged JSON with DTXR and CMPSUPGAP has not been provided in this conversation.
  The addon currently does not embed a separate raw JSON CMPSUPGAP attribute in
  DTXR text; actual gap ownership needs source-row and approved Final snapshot.
- First branch /GLRD-1000-6"-P4110001-93833-01/B6 original nodes 20 and 30
  are co-located exactly (zero mm). Node 20 has no explicit restraint; node 30
  carries +Y, Gap=0. Source branch P1=0, T1..T9=-100000, wall=0. Current Python
  native _apply_process_data_to_xml maps matched linelist P1/T1/T2/T3/fluid density
  but does NOT itself materialize Preview-derived 7.112mm wall, class/material/
  rating. Native writer substitutes 0.01 for nonpositive wall, which is not
  authorization to claim 7.112mm was emitted. Need actual output and
  source-bound Preview/master values before implementing a semantic handoff.
- Neither public XML NodeNumber=5950 nor 5960 is present in this benchmark.
  Alleged CII 5950→5960 lost mass cannot be independently checked without
  actual downloaded CII + Final packet and identity/pointer mapping.
- '4 Preview has data' is a UI observation; Preview row pasted by Owner shows
  P1, hydro, T1/T2/T3 and density blank, while class/wall are derived. Native
  authorizations and emitted numeric data require separate comparison.

## A4 Validation ledger
PASS_STATIC: source/docs original addon bytes were identical; both changed in
lockstep, pre-edit bytes backed up; 70/70 BM2 PS names miss original regex.
NOT_RUN: actual Python negative/positive test until CI.
NOT_RUN: Owner exact full native browser input / downloaded CII / independent
support/gap and mass/element reconciliation.
NOT_APPLICABLE: unrelated topology/synthetic data for actual Owner acceptance.

## A5 Recovery/coordination
Changed:
- converters/scripts/xml_to_cii2019_master_addon.py
- docs/converters/scripts/xml_to_cii2019_master_addon.py
- tests/xml229-native-substage-diagnostic.test.py
- 3 scoped backup files
- this report
Nearby open XML229 PRs #329/#312 modify native engine authority but not these
specific addon files in their current recorded change lists. Recheck before
integration, no merging without explicit Owner authorization.
EXACT_NEXT_ACTION: open draft PR, run CI native Python substage test; inspect
its result. If PASS, ask Owner to provide source-bound JSON/Final/produced CII
for remaining gap, wall/process and weight mismatches; do not release unverified
engineering values or change source/Final to make tests green.

## A6 08:26 Owner correction — position-first scope extension (PR370)
User correction: raw XML node3430 position (123504.12 114999.98 101330.73)
and nodes20/30 must bind DTXR by actual JSON POSI coordinates, not only PS labels.
Old reference inspected: refs/heads/REF-STATE-agent/xml-cii-node140-gap-benchmark-rca,
commit 57710dd744669a9dc1d4dbdd103d78f9f2928bce. Its JS resolver
calibrated source offsets from multiple PS-indexed position pairs and annotated
each DTXR description with its independently read CMPSUPGAP. We adopted the
design principle only; current Python implementation is independently written.

Core positional fix: new _position_bound_dtxr() walks exact source branch/node
positions into spatial cells; attempts matching raw position and explicitly
configured position and, when justified by 2 distinct unique PS anchors,
a dominant multi-anchor inferred translation. Candidate owner must be
unique within a compatible branch. Collocated nodes20/30 require PS tie-break;
an unowned coordinate-only record is suppressed, not duplicated.
A staged source record carrying a position must not fall back to PS-name
joining when its position cannot be validated. PS-only fallback is now for
records without usable coordinates, with a unique PS node owner.
Standalone CMPSUPGAP is appended to that source member's DTXR annotation;
no gap is made up or transferred from a different member.
Dynamic offset inference is not used for output authorization; the existing
native pre-Final source replay and geometry/mass proof remain unchanged.

New regression in existing CI-invoked substage test:
- real BM2 node3430 and two SYNTHETIC DTXR JSON support members with absolute
  POSI (without PS names) emit GUIDE+LINE STOP, per-member synthetic gap 15mm;
  third record has conflicting PS match but wrong XYZ and must NOT transfer
- real source colocation nodes20/30: correctly named support binds 30 only,
  unlabelled second member is ambiguous and not duplicated on either
- 2 independent PS anchors at 3420 and 3430 permit calibrated translation
- legacy PS-only fallback test and native guards stay unchanged.

Native mass witness, real Owner Original JSON, actual 17/24 Final kg and
actual CII pointer still unavailable. Owner supplied generated XML:
Node5940 -> source FLAN ordinal17/20; Node5960 -> VALV ordinal17/24.
Original public BM2 source confirms both at branch17. If the XML snippet is
the exact current native post-Final artifact (as opposed to pre-Final preview),
Weight=0 at 5960 implies its Final applied kg was zero or an input-basis
mismatch; emitted validator compares actual RIGID force to packet kg*10.
Cannot prove claimed weight loss without matching packet and emitted CII
pointer, and the alleged segment is not source NodeNumber 5950→5960.
Native independent proof MUST remain fail-closed.

CI at corrected head: PENDING GitHub Actions.

## A7 Revised PR370 GitHub CI — post-correction
PR: https://github.com/reallakshman19/3D_Converters/pull/370
LAST_CHECKED_HEAD: d6f161a5f10e7d338a5797919830505103a33a2a
CI_WORKFLOW: https://github.com/reallakshman19/3D_Converters/actions/runs/41289381011
PASS: native-python-source-transfer GitHub Actions job 124797246372.
tests/xml229-native-substage-diagnostic.test.py ran 8 tests in 0.676s:
PASS including real BM2 node3430 XYZ-only matched synthetic GUIDE/LINESTOP;
different-position same-PS negative; 20/30 coincident support disambiguation;
2 independent positional calibration anchors; prior source/Worker guards.
PASS: native mass-consumption suite 24 tests; Python compile/served mirrors.
FAIL: JS CII mass checks (22/24) were still non-green, separate source-string
assertion failures. Do NOT claim all CI green.
PASS_STATIC: patched root/docs addon byte identical.
STATUS: DRAFT_PR_OPEN / PYTHON_NATIVE_CI_PASS / JS_CII_CI_NON_GREEN.
AUTHORITY: Not merged, no actual Owner Final packet, actual CII or real JSON
support member available for full source->output reconciliation.
