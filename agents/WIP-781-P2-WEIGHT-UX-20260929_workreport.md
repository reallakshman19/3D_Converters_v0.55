# WIP-781-P2-WEIGHT-UX-20260929 — Issue #781 Weight Match authority-state UX

## Basis

```text
ISSUE = #781
STEP = STEP-781-04
PLAN = IMPLEMENTATION_PLAN rev 1 / issuecomment-5893573324
BASE_MAIN = 7057e3d031663fbe92c22f4a3b8c98cc32d06e7b
BRANCH = agent/issue-781-p2-weight-ux-20260929
PR = #785
CRITICALITY = ENGINEERING_CRITICAL
PROTOCOL = V3.1 / Common@1ced68258afeaf50df113b1d38a4ceb9193587e3 / TPG-2P-2026-09-28-R3
MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED
```

## Current-head RCA

The numerical lifecycle is already governed by `rigid-weight-authority.js`; this slice does not change it.

The shared Weight Match renderer pre-populates the weight field from the best candidate and labels the row `Proposed · Suggested`. That value is technically non-authoritative until an explicit candidate click or field edit/confirm triggers persistence, but the presentation does not make the distinction sufficiently obvious. The same shared renderer is loaded by the XML→CII 2019 Standalone adapter.

Existing transition:

```text
candidate displayed / field prefilled
  -> Proposed · Suggested
explicit candidate click OR edit/confirm
  -> Accepted · Match-1
```

The issue is therefore presentation/interaction semantics, not weight calculation or authority resolution.

## Implemented correction

The Standalone adapter now installs a presentation-only decorator after binding the existing shared Weight Match renderer. The decorator does not own or mutate engineering authority.

Non-authoritative candidate state is rendered as:

```text
Candidate matched ✓
Suggested weight: <value> kg
Engineering status: NOT ACCEPTED
[Accept as Match-1 · <existing candidate label>]
```

After the existing explicit candidate/edit acceptance path writes Match-1, the presentation becomes:

```text
Accepted Match-1 ✓
Engineering authority: Match-1
```

Other already-resolved authority sources are deliberately preserved as resolved-source labels and are not falsely relabelled Match-1.

The existing acceptance implementation remains `withXmlCiiRigidWeightMatch1()` plus existing Match-1 provenance metadata. Candidate ranking, numerical values, resolution precedence and staleness behavior are unchanged.

## Changed material surfaces

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-authority-ui.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js`
- matching `docs/` mirrors
- `tests/xml-cii-issue-781-weight-match-authority-presentation.test.mjs`
- `.github/workflows/issue-781-weight-match-ux-validation.yml`

Exact pre-edit adapter backup:

- `.backups/issue-781/p2-weight-ux/001_xml-cii-adapted-weight-match-v2.js.bak`

## Authority invariants preserved

- Final > Match-1 > legacy > source-XML resolution precedence unchanged.
- Match-1 provenance/fingerprint/staleness semantics unchanged.
- Preferred/exact candidate display does not auto-accept.
- `Suggested` remains presentation evidence, not numerical authority.
- No material-code or Mode B behavior is included.

## Validation

Validated implementation head: `5d9b70b1509ab77ef91bbe86ebd9fb80c0867f65`.

### Issue 781 Weight Match Authority UX Validation — run 36638336460

- focused suggestion vs Match-1 presentation regression: PASS
- non-Match-1 resolved authority not mislabeled Match-1: PASS
- runtime/docs helper parity: PASS
- existing rigid-weight lifecycle authority regression: PASS

### Issue 776 XML-CII Authority Validation — run 36638336512

- Issue 776 focused authority regressions: PASS
- PR780 master-dataset regressions: PASS
- adjacent head/base regression classification: PASS
- applicable-regression enforcement: PASS
- exact-head WSW browser conversion: PASS
- 10k / 50k / 100k master-dataset browser scale: PASS

## Acceptance results

- AC-781-20: PASS — suggestion is visibly distinct from accepted Match-1 authority.
- AC-781-21: PASS — weight resolution precedence remains governed by unchanged authority module.
- AC-781-22: PASS — Match-1 provenance/fingerprint/staleness implementation is unchanged; lifecycle regression passes.
- AC-781-23: PASS — presentation regression requires candidate state to remain `NOT ACCEPTED` until existing explicit acceptance occurs.

## Handoff

PR #785 is ready for Owner review after final-head CI confirmation. Merge authority remains Owner-only and is not exercised by this worker.
