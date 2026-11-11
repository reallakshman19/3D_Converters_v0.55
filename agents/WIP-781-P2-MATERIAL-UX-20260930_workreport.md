# WIP-781-P2-MATERIAL-UX-20260930 — Issue #781 material suggestion presentation

## Basis

```text
ISSUE = #781
STEP = STEP-781-05
PLAN = IMPLEMENTATION_PLAN rev 1 / issuecomment-5893573324
BASE_MAIN = 7057e3d031663fbe92c22f4a3b8c98cc32d06e7b
BRANCH = agent/issue-781-p2-material-ux-20260930
PR = #786
CRITICALITY = ENGINEERING_CRITICAL
PROTOCOL = V3.1 / Common@1ced68258afeaf50df113b1d38a4ceb9193587e3 / TPG-2P-2026-09-28-R3
MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED
```

## RCA

`xml-cii-adapted-preview-material-authority.js` already separates authoritative Material Code from review evidence. When process/Line List material exists but the fuzzy resolver does not meet the strong authority threshold, it deliberately returns:

- `materialCode: ''`;
- `materialCodeNeedsReview: true`;
- ranked `materialCodeCandidates`;
- matched material, confidence, reasons and resolution method.

The editable Preview table previously rendered only the blank authoritative `materialCode` through the generic match-badge renderer. Existing candidate evidence was therefore invisible. The defect was presentation, not material authority resolution.

## Implemented correction

`xml-cii-adapted-editable-preview-table.js` now reads the strongest existing `materialCodeCandidates` entry only when:

1. authoritative `materialCode` is blank;
2. `materialCodeNeedsReview === true`;
3. candidate evidence exists.

The Preview cell renders review-only evidence such as:

```text
—
Suggested: 106 / A106-B
review required · <confidence>
```

The authoritative `.mc-preview-editable-val` deliberately remains `—`. The candidate is rendered in a separate display-only element, so edit/fill interactions continue to see a blank authoritative value. No candidate is copied into `row.materialCode`, config overrides, or B31.3 inputs.

No `materialCodeSuggested` field or parallel suggestion state was introduced.

## Changed material surfaces

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-editable-preview-table.js`
- matching `docs/` mirror
- `tests/xml-cii-issue-781-material-suggestion-presentation.test.mjs`
- `.github/workflows/issue-781-material-suggestion-validation.yml`

Exact pre-edit backup:
- `.backups/issue-781/p2-material-ux/001_xml-cii-adapted-editable-preview-table.js.bak`

## Authority invariants preserved

- material resolver thresholds/ranking are unchanged;
- authoritative `materialCode` remains blank when evidence is insufficient;
- manual override semantics are unchanged;
- piping-class fallback preconditions are unchanged;
- B31.3 material authority remains fail-closed;
- no parallel suggestion field/state exists.

## Validation

Validated implementation head: `46fd79d8882f63d673acad2311597b25f97f48b3`.

### Issue 781 Material Suggestion Authority Validation — run 36639335513

- review-only candidate presentation regression: PASS
- existing material fuzzy authority regression: PASS
- existing process-material authority regression: PASS
- existing Preview material authority index regression: PASS
- B31.3 blocker/provenance fail-closed regression: PASS

### Issue 776 XML-CII Authority Validation — run 36639334481

- Issue 776 focused authority regressions: PASS
- PR780 master-dataset regressions: PASS
- adjacent head/base classification: PASS
- applicable-regression enforcement: PASS
- exact-head WSW browser conversion: PASS
- 10k / 50k / 100k master-dataset browser scale: PASS

## Acceptance results

- AC-781-24: PASS — unresolved material can display ranked candidate evidence while authoritative code remains blank.
- AC-781-25: PASS — resolver authority remains unchanged and focused regression asserts blank `materialCode` with candidate `106` evidence.
- AC-781-26: PASS — existing B31.3 blocker/provenance regression remains green.
- AC-781-27: PASS — no `materialCodeSuggested` or redundant parallel suggestion state is introduced.

## Handoff

PR #786 is ready for Owner review after report-only final-head CI confirmation. Merge authority remains Owner-only and is not exercised by this worker.
