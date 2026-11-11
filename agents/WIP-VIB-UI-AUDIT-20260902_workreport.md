# Vibration UI Audit — 2026-09-02

## Ground truth

```text
WORK_INTENT        AUDIT
CRITICALITY        ENGINEERING_CRITICAL_PRESENTATION
BASE               main@3224c5561d6f9cad4b5c9821520661c44f3dd44c
AUDIT_BRANCH       agent/vibration-ui-audit-20260902
OLD_PR615_BRANCH   agent/vibration-eit-roadmap-20260818@ecca1b517b827c827e1d3ed80f589b856740bb57
REBASE_DECISION    fresh successor branch from current main; do not replay squash-merged PR615 history
NUMERICAL_CHANGE   NONE
AUTHORITY_CHANGE   NONE
VISUAL_BROWSER_AUDIT NOT_RUN / standard-chat capture unavailable
```

PR #615 was squash-merged on 2026-08-18. Replaying its 98 pre-squash commits onto current main would duplicate already-landed changes and manufacture conflicts. The UI audit therefore starts from an exact fresh branch at current main. The old merged branch is preserved as historical evidence.

## Audit scope

Current vibration Engineering Calculations experience, with emphasis on:

- right-side `Vibration Assessment` roadmap rail;
- collapse / resize interaction;
- project + selected-line controls;
- selected assessment / scope routing;
- mechanism summary and next-attention cards;
- roadmap-to-calculation/workspace navigation;
- source-level accessibility and focus behavior;
- current automated interaction coverage.

This is a source/interaction-contract audit, not a screenshot-based visual audit. Contrast, actual rendered density, clipping, hover/focus appearance, scroll behavior under real viewport dimensions, and pointer ergonomics remain browser evidence requirements.

## Current strengths

1. **Authority boundary is explicit in the UI.** The rail states it has no applicability, completeness, screening, or design authority; later mechanism guidance also remains advisory/linking only.
2. **Collapse and resize are presentation-only.** Width is clamped to 260–520 px with a 320 px default; collapsed desktop width is 44 px; keyboard resizing is implemented.
3. **Responsive fallback exists.** Below 1180 px the rail leaves the third column and spans the layout; desktop resize is disabled. Below 900 px the console becomes one column.
4. **Selected line / selected assessment context is explicit.** The panel shows current project, line, exact assessment scope, workflow state, evidence state, and case next action without promoting them to engineering authority.
5. **Action-first structure is present.** `Next attention` precedes the workflow catalogue and reuses existing calculation/workspace seams rather than introducing a second calculation router.
6. **Status is text-backed, not color-only.** Labels such as Available, Data, Current, Stale, Attention, Action, and Not applicable are emitted as text.

## Findings

### UI-001 — P1 — roadmap state updates replace the entire rail and can drop scroll/focus

**Evidence**

`tabs/vibration-roadmap-controller.js` `render()` calls `cleanPanel(container)`, removes the existing rail, then inserts a complete new panel HTML string. `onRoadmapState()` calls `render(lastRender)` after roadmap-state changes.

**Risk**

A live state update can reset rail scroll position and destroy the focused descendant. Engineers working deep in a long mechanism list may be returned to the top; assistive-technology users can lose focus context.

**Recommended correction**

Either patch stable DOM subregions rather than replacing the whole `<aside>`, or preserve/restore:

```text
scrollTop
focused control semantic key
collapsed state
width
```

Focus restoration must be conditional and must not steal focus after user navigation.

### UI-002 — P1 — workspace/scope navigation can fail silently

**Evidence**

`workspaceTab(container, id)?.click()` and `assessmentRow(container, rowKey)?.click()` use optional chaining with no failure branch.

**Risk**

If the expected tab/row is not mounted, filtered, paginated, renamed, or temporarily absent, `Open case task` or assessment-scope selection can appear to do nothing. The select may visually change while the governed selected assessment does not.

**Recommended correction**

Resolve routing through an explicit navigation intent/API where possible. At minimum, detect missing targets and publish a visible non-authoritative UI error such as:

```text
Case task is not available in the current workspace view.
```

Do not silently no-op.

### UI-003 — P1 — typography is too small for a dense engineering rail

**Evidence**

`tabs/vibration-roadmap-panel.css` uses 8 px and 9 px text broadly across workflow metadata, source labels, mechanism rows, evidence summaries, phase state, and project metadata; project/action controls use 10 px.

**Risk**

The rail carries high-cognitive-load engineering state. 8–10 px text materially reduces readability, especially on high-DPI displays, remote desktop sessions, laptops, and for users with low vision. The current density is achieved partly by shrinking text rather than by hierarchy/spacing.

**Recommended correction**

Use approximately:

```text
primary row text      12–13 px minimum
secondary metadata    11–12 px
tertiary source text  10–11 px only where necessary
interactive controls  12 px+
```

Preserve density through tighter vertical spacing, disclosure, and grouping rather than sub-10 px core information.

### UI-004 — P2 — resize separator accessibility metadata is incomplete

**Evidence**

The resize handle has:

```html
role="separator"
aria-orientation="vertical"
aria-label="Resize vibration roadmap"
tabindex="0"
```

but no `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, or `aria-controls`. Width changes update the CSS variable and panel `data-roadmap-width`, not separator ARIA state.

**Risk**

Keyboard users can resize it, but assistive technology cannot determine the current size/range or controlled region.

**Recommended correction**

Expose and update:

```text
aria-valuemin=260
aria-valuemax=520
aria-valuenow=<current width>
aria-controls=<panel id>
```

### UI-005 — P2 — resize hit target is only 8 px wide

**Evidence**

`.vibration-roadmap-resize { width: 8px; }`.

**Risk**

The drag affordance is difficult to acquire with a mouse/trackpad and especially hard with motor impairment. Keyboard support helps but does not remove pointer usability debt.

**Recommended correction**

Use a visually thin separator with an invisible 20–24 px hit area, e.g. wider handle + centered pseudo-element.

### UI-006 — P2 — collapse control does not expose expanded state/controlled region

**Evidence**

The collapse button changes its `aria-label`, but has no `aria-expanded` or `aria-controls`; the `<aside>` also has no explicit accessible name/labelled-by relationship.

**Risk**

Assistive technology gets an action label but not the current expanded/collapsed state or controlled region relationship.

**Recommended correction**

Give the rail a stable ID/heading and add:

```text
aria-expanded
aria-controls
aside aria-labelledby or aria-label
```

### UI-007 — P2 — informational roadmap nodes remain focusable no-op buttons

**Evidence**

Nodes without a target are rendered as `<button aria-disabled="true">`, not `disabled`, and remain in the tab sequence.

**Risk**

Keyboard users traverse controls that cannot perform an action. `aria-disabled` communicates disabled state but does not remove focusability or prevent activation behavior by itself.

**Recommended correction**

Use non-button markup for non-action rows, or use actual `disabled` controls if button semantics are required. Keep actionable and informational rows visually distinct.

### UI-008 — P2 — project import/open feedback is not announced as live status

**Evidence**

`.vibration-roadmap-message` is inserted after asynchronous import/open/save operations but has no `role="status"`, `role="alert"`, or `aria-live`.

**Risk**

Screen-reader users may not hear successful project load, export feedback, or load errors.

**Recommended correction**

Use polite live status for normal messages and assertive/alert semantics for errors, without duplicating announcements.

### UI-009 — P2 — fail-closed selected-assessment validation can become an invisible UX failure

**Evidence**

`governedSelectedAssessment()` returns `null` when the selected-assessment/status authority envelope does not exactly validate. `renderSelectedAssessment()` and the mechanism summary then render nothing.

**Risk**

The engineering boundary is correctly fail-closed, but the user sees disappearance rather than a clear projection/contract error. This can look like missing data or a broken rail.

**Recommended correction**

Keep the authority failure fail-closed, but render an explicit non-authoritative diagnostic card such as `Selected assessment context unavailable` with a machine-readable reason code.

### UI-010 — P2 — no vibration browser interaction regression exists

**Evidence**

At current main, `tests/browser/` contains only `xml-cii-semantic-core-timing.html`. Vibration rail tests are Node/source-contract tests. Existing historical work reports repeatedly record served-browser acceptance as `NOT_RUN`.

**Risk**

The codebase has no automated protection for actual focus retention, pointer drag, keyboard resize announcement, collapsed placement, viewport behavior, scroll restoration, or routing under rendered DOM conditions.

**Recommended correction**

Add one narrow browser acceptance harness covering:

1. open Vibration family;
2. rail visible on right at desktop viewport;
3. drag width 320 -> ~420 and verify clamp;
4. keyboard resize + ARIA value;
5. collapse/expand and state retention;
6. scroll deep into rail, dispatch roadmap-state update, verify scroll/focus policy;
7. route `Open case task` success and missing-target error;
8. switch assessment scope and verify governed context changes;
9. responsive breakpoint at 1180 / 900;
10. project open/error live announcement.

### UI-011 — P3 — width/collapse preference is session-local only

**Evidence**

Width/collapsed state is held only in the controller instance. It survives ordinary controller renders but not tab destruction/page reload.

**Risk**

Users repeatedly adjusting a dense engineering workspace must redo the same presentation setup.

**Recommended correction**

Persist presentation-only preference by product/user profile or local storage. Never persist it in `.vibproj` engineering state.

### UI-012 — P3 — nested sticky/internal scrolling needs real viewport verification

**Evidence**

Desktop rail is sticky with a viewport-derived `max-height`; inner `.vibration-roadmap-scroll` is separately scrollable. Responsive rail uses a 420 px inner max-height.

**Risk**

Potential scroll trapping, clipped action cards, awkward wheel/trackpad transfer, and focus scrolling at intermediate viewport heights.

**Disposition**

`BROWSER_EVIDENCE_REQUIRED`; do not claim defect from source alone.

## Priority fix stack

Recommended implementation order:

```text
1. UI-001 preserve rail scroll/focus across state updates
2. UI-002 eliminate silent routing no-ops
3. UI-003 raise typography / target readability
4. UI-004 + UI-005 complete resize semantics and hit target
5. UI-006 + UI-008 landmark/toggle/live-region accessibility
6. UI-007 informational-node semantics
7. UI-009 visible fail-closed projection diagnostic
8. UI-010 browser interaction regression
9. UI-011 presentation preference persistence
10. UI-012 viewport/scroll tuning after browser evidence
```

## Negative assurance

This audit does not recommend or authorize changes to:

```text
engineering equations
mechanism applicability
assessment completeness authority
screening authority
source/method authority
project persistence authority
LOF/result aggregation
measurement engineering authority
case identity semantics
```

All proposed fixes are presentation/navigation/accessibility changes. Missing upstream engineering authority must remain visible and fail-closed.

## Validation classification

```text
Current-main source inspection       PASS / SOURCE_INSPECTION
Current-main branch grounding        PASS / GitHub branch exact SHA
Open right-rail PR overlap           PASS / none found
Browser screenshot audit             NOT_RUN / tooling mode blocked
Rendered contrast/spacing            NOT_RUN
Pointer ergonomics                   NOT_RUN
Screen-reader execution              NOT_RUN
Numerical verification               NOT_APPLICABLE
```

## Next action

If implementation is authorized, use this branch and take UI-001 + UI-002 as the first bounded PR slice, then run a browser audit/acceptance in Work mode or another environment with a controllable browser before merging visual/accessibility changes.
