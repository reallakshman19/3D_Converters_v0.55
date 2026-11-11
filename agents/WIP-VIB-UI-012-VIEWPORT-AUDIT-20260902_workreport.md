# Vibration Roadmap UI-012 — Viewport / Scroll / Visual Evidence Audit

STATE: COMPLETE_BROWSER_PASS
UI012_DISPOSITION: PASS_IN_HOSTED_CHROMIUM_NO_PRODUCTION_REMEDIATION_REQUIRED
BASELINE: PR #712 candidate `fe39c311cf1fa84ccb81fa1e75a53c30b33a14e1`
AUDIT_HEAD: `eadb00d9b7837b653f1176d55d243e3883fe4992`
BRANCH: `audit/vibration-ui-012-viewport-20260902`
AUTHORITY: PRESENTATION_ACCESSIBILITY_AUDIT_ONLY

## Mission

Close UI-012 using rendered Chromium evidence rather than source inference.

Audit targets:

- intermediate desktop viewport heights;
- sticky rail containment;
- nested internal-scroll wheel handoff;
- focus scrolling into the internal rail viewport;
- horizontal clipping/overflow;
- keyboard focus indicator visibility;
- rendered color contrast via axe-core;
- responsive transition screenshots around 1180 px and 900 px.

## Viewport matrix

```text
1440 x 900
1280 x 720
1280 x 550
1181 x 640
1179 x 640
 899 x 700
 768 x 640
```

## Final hosted evidence

Workflow: `Vibration Roadmap UI-012 Viewport Audit`

```text
run                         33618570575
runner                      Ubuntu 24.04 / Node 22 / Chromium 136
result                      PASS
horizontal overflow         NONE OBSERVED / all 7 viewports
focusable clipping          NONE OBSERVED / all 7 viewports
axe color-contrast issues   NONE OBSERVED / all 7 viewports
short-desktop sticky rail   CONTAINED
wheel handoff at bottom     PASS
wheel handoff at top        PASS
focus scroll into rail      PASS
responsive 1180 boundary    PASS
responsive 900 boundary     PASS
```

At the 1280 x 550 short-desktop case, the sticky rail remained contained in the viewport and the nested `.vibration-roadmap-scroll` handed wheel motion back to page scrolling at both its top and bottom boundaries. Focusing a control outside the currently visible internal-scroll range scrolled that control into view.

The rendered breakpoint behavior matched the intended source contract:

```text
>= 1181 px   three-column desktop rail; sticky
1179 px      two-column workspace; rail full-width below; static
<= 899 px    one-column workspace; rail full-width below; static
```

No document-level horizontal overflow or focusable-control clipping was observed at any tested viewport.

## Focus appearance review

A second browser pass retained focused-control screenshots for:

- resize separator;
- collapse control;
- Import EI action;
- Open case task action;
- assessment selector.

The resize separator uses an explicit solid focus ring; its measured adjacent-color contrast was approximately `4.54:1`.

Chromium reports `outline-style: auto` and a dark computed `outline-color` for several native/default focus indicators. That computed color is **not authoritative for the painted browser focus ring**. The screenshots show Chromium painting a bright, clearly perceptible ring around the collapse control, Import EI action, Open case task action and assessment selector. The audit therefore records those controls as `SCREENSHOT_VERIFIED_VISIBLE` rather than treating the misleading computed `outline:auto` color as a defect.

No production focus-style correction is warranted from the observed Chromium evidence.

## Evidence package

Artifact: `vibration-ui-012-browser-evidence`

```text
run        33618570575
artifact   9841971288
sha256     27fbb1b4cf10ed120119b4fd2f699b2d36d3a86fcb3237e4a2069dd24cd35c3b
files      15
```

It contains:

- seven viewport screenshots;
- one short-desktop scroll-handoff screenshot;
- five focused-control screenshots;
- `ui012-report.json`;
- `focus-appearance-report.json`.

## Authority boundary

This audit does not determine engineering applicability, assessment completeness, screening/design authority, project persistence authority, calculation execution eligibility, or numerical correctness. The right rail remains guidance/linking only.

No production UI change is included in this audit branch, and no production remediation is recommended from the observed Chromium results.

## Limitations / NOT_RUN

The following are deliberately **not** inferred from the Chromium result:

```text
Firefox rendering / interaction         NOT_RUN
WebKit rendering / interaction          NOT_RUN
OS/browser forced-colors modes          NOT_RUN
screen-reader execution                 NOT_RUN
full Product Design Work-mode audit     NOT_RUN_STANDARD_CHAT
```

These are portability/accessibility expansion opportunities, not blockers created by this UI-012 Chromium audit.

## Final disposition

```text
rendered Chromium viewport audit        PASS
screenshot visual inspection            PASS / NO OBSERVED DEFECT
rendered axe color contrast              PASS / ZERO VIOLATIONS
sticky + nested-scroll ergonomics        PASS IN TESTED CHROMIUM MATRIX
focus appearance                         PASS / SCREENSHOT VERIFIED
production remediation                   NOT_REQUIRED_FROM_OBSERVED_EVIDENCE
engineering authority impact             NONE
```

UI-012 is closed for the requested hosted-Chromium viewport/interaction evidence scope. Cross-browser and assistive-technology execution remain separately qualified as `NOT_RUN`.
