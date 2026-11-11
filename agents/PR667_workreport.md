# PR667 — Vibration right-panel action-first workflow

## Recovery header

- PR: #667
- TITLE: `feat(vibration): make right roadmap action-first`
- BRANCH: `agent/vibration-roadmap-workflow-20260819`
- BASE_AT_ALLOCATION: `main@7f7ce459c8f059b503b045bbdebbe10d303b1044`
- PR_HEAD_AT_ALLOCATION: `092e42394f63e508f63d2bd1f19d44d7ee9cd296`
- REPORT_BASIS_HEAD: `fdaae41897d5252ae1da2deda84ceb3173e82e62`
- CRITICALITY: ENGINEERING_CRITICAL_PRESENTATION
- MERGE_AUTHORITY: `OWNER_GRANTED_FOR_PR667_2026-08-19`
- MERGE_AUTHORIZATION_SOURCE: owner message `fix #667 and merge`
- NUMERICAL_METHOD_CHANGED: NO
- ENGINEERING_AUTHORITY_CHANGED: NO
- PROJECT_PERSISTENCE_CHANGED: NO
- WORKFLOW_FILES_CHANGED: NO

## Handover in 60 seconds

PR667 converts the existing right-side `Vibration Roadmap` from catalogue-first to action-first presentation while consuming only existing `VibrationRoadmapProjection.v1` states.

The right rail now shows:

```text
Current project / current line
-> NEXT ATTENTION from existing ACTION | ATTENTION | STALE
-> numbered Identify / Screen / Verify / Diagnose / Mitigate / Confirm
-> all existing scope/mechanism roadmap nodes
```

It does not decide phase completion, applicability, completeness, screening authority or engineering disposition.

Owner explicitly authorized repair-and-merge of PR667 on 2026-08-19. Diff inspection found no product defect or review-requested change requiring a code patch; the stale delivery custody fields were the item requiring repair before merge.

## Coordination

- PR615 is live merged/closed. `agents/claims/PR615.yaml` on main still says ACTIVE for roadmap paths; classify as stale historical coordination metadata.
- PR658 is live open/draft and owns `VIBRATION_LINE_CASE_ASSESSMENT_STATUS_PROJECTION`; exact files do not overlap. PR667 must not absorb or duplicate that authority.
- PR665 is live open/draft Project-v2 persistence. PR667 has no Project-v2 dependency and edits no Project-v2 path.

Coordination state: `SAFE_WITH_STALE_CLAIM_RECONCILIATION`.

## Implemented capability

### `tabs/vibration-roadmap-workflow-view.js`

New pure `VibrationRoadmapWorkflowPresentation.v1` helper.

Phase presentation states:

```text
NEEDS_ATTENTION
HAS_CURRENT_RESULT
HAS_DATA
AVAILABLE
NOT_APPLICABLE_ONLY
```

Focus selection scans existing phases in order and selects the first node already carrying `ACTION`, `ATTENTION` or `STALE`.

Permanent helper authority:

```text
purpose                     RIGHT_RAIL_WORKFLOW_FOCUS_PRESENTATION_ONLY
determinesApplicability     false
determinesCompleteness      false
determinesPhaseCompletion   false
engineeringAuthority        NONE
screeningAuthority          NOT_AUTHORIZED
designAuthority             false
```

### `tabs/vibration-roadmap-panel.js`

- header changed to `Vibration Assessment`;
- current project and current line are foregrounded;
- `Next attention` card precedes the phase catalogue;
- existing calculation/workspace target attributes are reused for `Open task`;
- if no attention state exists, panel says `No roadmap attention flag` and explicitly states that this does not mean the assessment is complete;
- phase headers are numbered and show non-completion presentation state;
- every existing node remains visible beneath its existing phase/scope.

### `tabs/vibration-roadmap-panel.css`

Adds workflow focus and numbered-phase styling while preserving right-side width, collapse/resize and responsive behavior.

## Case-scope boundary

No case picker is added. Current `VibrationIntegrityProject.v1` has stable governed line subjects but no governed case subject collection. PR667 deliberately does not invent case identity from incidental UI or imported payload structure.

## Protected invariants

- `VibrationRoadmapProjection.v1` unchanged and still `VISUAL_NAVIGATION_GUIDANCE_ONLY`.
- no phase-completion claim.
- no applicability/completeness derivation.
- no numerical calculation/equation/coefficient/tolerance/unit/master changes.
- no governing-result changes.
- no screening/design/code/safety/root-cause authority.
- no project schema/serializer/currentness/controller persistence change.
- no PR658 status-projection mutation.
- no workflow files.
- no second router; existing CALCULATION/WORKSPACE target seams only.

## Backups

Exact pre-edit connector/Git copies:

- `.backups/connector-20260819-vib-roadmap-workflow/tabs/vibration-roadmap-panel.js`
- `.backups/connector-20260819-vib-roadmap-workflow/tabs/vibration-roadmap-panel.css`

Native `node utils/backup.js save ...`: `NOT_RUN / ENVIRONMENT_BLOCKED` because a native repository checkout is unavailable. Connector copies are rollback evidence, not native-backup PASS.

## Validation ledger

Exact authored bytes executed locally and compared to committed Git blob identities:

```text
node --check workflow helper                         PASS / LOCAL_EXECUTION
node --check edited panel                            PASS / LOCAL_EXECUTION
focused workflow-panel test                          PASS 4/4 / LOCAL_EXECUTION
workflow helper blob                                 e6f21bba96ca9eef5fb369f6a5fe0c35ccdf27e6
edited panel blob                                    19a97696dbdcf98d5f36c2910b2a4c573a461108
focused test blob                                    831f1d3d9a29bf240ac47fc003110077805a6d1d
physical lines                                       PASS: 77 / 118 / 82
existing roadmap resize/collapse contract            PASS / SOURCE_INSPECTION compatible
existing calculation click seam                      PASS / SOURCE_INSPECTION (`data-calc-id` reused)
independent numerical verification                   NOT_APPLICABLE / no numerical change
repository-native complete roadmap regressions       NOT_RUN / ENVIRONMENT_BLOCKED
served browser acceptance                            NOT_RUN / ENVIRONMENT_BLOCKED
```

Focused test proves:

1. earliest existing attention phase becomes workflow focus;
2. DATA/CURRENT presentation does not become phase-completion authority;
3. action-first rendering retains existing navigation target attributes;
4. no-attention state cannot imply assessment completion.

## Hosted reconciliation at REPORT_BASIS_HEAD

```text
main / merge base                 7f7ce459c8f059b503b045bbdebbe10d303b1044
ahead / behind                    18 / 0
changed files                     12 intended / 0 unexplained
PR state                          open draft, mergeable true
review comments/submissions       0
review threads                    0
commit status entries             0 -> NOT_RUN
PR-triggered workflow runs        0 -> NOT_RUN
```

Subsequent commits after `REPORT_BASIS_HEAD` are merge-custody/status synchronization only and do not modify the validated product/test blobs listed above.

## Changed-file ledger

1. `tabs/vibration-roadmap-workflow-view.js`
2. `tabs/vibration-roadmap-panel.js`
3. `tabs/vibration-roadmap-panel.css`
4. `tests/vibration-roadmap-workflow-panel.test.mjs`
5. `.backups/connector-20260819-vib-roadmap-workflow/tabs/vibration-roadmap-panel.js`
6. `.backups/connector-20260819-vib-roadmap-workflow/tabs/vibration-roadmap-panel.css`
7. `agents/WIP-VIB-ROADMAP-WORKFLOW-20260819_workreport.md`
8. `agents/status/WIP-VIB-ROADMAP-WORKFLOW-20260819.yaml`
9. `agents/claims/WIP-VIB-ROADMAP-WORKFLOW-20260819.yaml`
10. `agents/PR667_workreport.md`
11. `agents/status/PR667.yaml`
12. `agents/claims/PR667.yaml`

## Highest risk

The panel is visually workflow-like while the underlying roadmap remains guidance-only. Future slices must consume a governed line/case workflow source rather than extending this helper into hidden engineering state logic.

## EXACT_NEXT_ACTION

Mark PR667 ready for review, refresh current head/main/mergeability/checks, then squash-merge PR667 using the exact expected head SHA if still clean. After merge, verify PR state and main SHA.
