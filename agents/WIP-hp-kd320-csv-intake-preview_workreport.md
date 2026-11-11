# WIP — KD320 CSV Evidence Intake Preview

## Handover in 60 Seconds

- Repository: `reallaksh19/3D_Converters`
- Branch: `agent/hp-kd320-csv-intake-preview`
- Base: PR625 head `1c0f6268bcdc1098754bbc0627d9631b5bf6cdfb`
- Work intent: IMPLEMENT
- Criticality: ENGINEERING_CRITICAL
- Mutation authority: WRITE_ALLOWED
- Merge authority: OWNER_GRANTED_ON_COMPLETION (2026-08-19)
- Stack: PR622 -> PR623 -> PR625 -> this successor
- Mission: CSV upload/template/preview for KD320 project and published evidence without changing numerical mechanics or authority.
- Implementation state: COMPLETE_PENDING_PR_AND_MERGE_RECONCILIATION.
- Authority invariant: native CORE KD320=false; Code compliance=false; design authority=false; production kernel=false; automatic promotion=false.

## Live Ground Truth

Grounding epoch: 2026-08-19.

Normalized qualification stack before this branch:

- PR622 head `1661b316a4e081a4ead47db9ca8bda7a9669eb04`, 13 files, one commit.
- PR623 head `dd789f69399e1f5cf485a67526d6bbbae9697f72`, 10 files, one commit, base PR622 branch.
- PR625 head `1c0f6268bcdc1098754bbc0627d9631b5bf6cdfb`, 11 files, one commit, base PR623 branch.
- Those normalized heads had zero commit-status entries when checked.
- Backup refs exist for all pre-normalization heads.
- This branch has remote backup `backup/hp-kd320-csv-intake-preview-pre-ui-20260819` before the existing Engineering workspace registry was edited.

Repository instructions loaded from root `AGENTS.md`, `.agents/AGENTS.md`, and `Common/skills/engineering-pr-delivery/SKILL.md`.

## Delivered Capability

1. `PROJECT_CHECKED_CALCULATION` CSV contract:
   - exact downloadable template;
   - target B31.3 2024 / VIII-3 2025 enforcement;
   - `Salt -> associated mean stress -> correction parameters -> Seq -> N` chain custody;
   - required `KD320-SEM-002..011` and both Q1 receipt refs;
   - distinct calculator/checker identities and ISO-UTC timestamps;
   - row-level preflight before the existing Q2 evaluator.
2. `PUBLISHED_NUMERICAL_ORACLE` CSV contract:
   - exact downloadable template;
   - source SHA-256, bibliography/locator and independent extraction/admission custody;
   - direct target-2025 Q2 preview;
   - source-edition 2023 route restricted to `PVP2025-154710` and evaluated through the existing PR625 2023->2025 reconciliation gate.
3. Native `Engineering > KD320 Evidence Intake` subtab:
   - mode selector;
   - template download;
   - CSV upload;
   - row preflight state;
   - Q2/edition gate state and blocker display;
   - explicit authority-false presentation;
   - browser-memory-only preview; no write to project/master/oracle/production paths.
4. Fail-closed parser details:
   - unknown/missing headers blocked;
   - malformed/unclosed CSV quoting blocked;
   - UTF-8 BOM tolerated;
   - blank numeric cells are not silently converted to zero;
   - correction-parameter semantic refs validated.

## Technical Diagnosis

The existing Q2 evaluator intentionally validates project/published oracles only after Q1 is complete. Directly wiring CSV into Q2 would therefore hide malformed oracle-row defects behind `Q1_CONTROLLED_EVIDENCE_PENDING`. The new preflight isolates row validity first, then calls the existing gate without changing it.

A defect found during implementation was corrected before publication: JavaScript `Number('') === 0` could have converted a blank associated-mean-stress cell into physical zero. The parser now treats blank as missing and has a regression case.

## Authority / Negative Assurance

The implementation does not:

- calculate `Seq` or `N`;
- add KD320 formulas;
- infer missing Code semantics;
- add fatigue-curve data;
- change Q1/Q2/edition evaluator semantics;
- store licensed Code text;
- relabel a 2023 source as target-2025 authority;
- auto-admit evidence;
- set native CORE KD320, Code compliance, design authority, production-kernel permission, or automatic promotion true;
- modify workflow files.

## Coordination

PR622, PR623 and PR625 are the active predecessor stack. This branch is stacked on PR625 and only consumes their evaluator APIs. No predecessor evaluator file was edited. Coordination classification: `SAFE_STACKED_DEPENDENCY`.

## Validation Ledger

### Focused executable suite

Command:

`node --test tests/b313-chapter-ix-kd320-csv-intake.test.mjs tests/hp-kd320-evidence-intake-ui.test.mjs`

Result: `16 / 16 PASS`.

Coverage includes:

- templates contain no fabricated engineering numeric defaults;
- valid checked project row;
- calculator/checker identity collision;
- edition drift;
- valid direct 2025 published row;
- PVP2025-154710 2023 reconciliation routing;
- complete edition reconciliation reaches only `EDITION_RECONCILIATION_READY_FOR_Q2_ADMISSION` while `targetQf022Ready=false` and `q2OracleAdmissionReady=false`;
- unsupported 2023 reference;
- unknown header;
- blank mean-stress vs physical zero distinction;
- BOM and malformed quoting;
- invalid correction semantic;
- UI registration and old HP workbench preservation;
- no duplicated engineering arithmetic in UI;
- reuse of Q2/edition evaluators with authority false.

Evidence class: LOCAL_EXECUTION. Oracle class: implementation-coupled tests against retained existing gate contracts; not independent Code qualification.

### Remote blob custody

Validated local/remote production blob identity:

- `csv-intake.js`: `a900e372dd3fad44d9b8135aa5d1c1b8ac751b34`
- `hp-kd320-evidence-intake-tab.js`: `cfdd62cd865cc427972e22708a4e3ed1780dceea`
- `engineering-workspace-tab.js`: `88036cd97b5469627ca88821262732a6001f087c`
- UI authority test blob: `ec14190342fdbbfd2d76d9063414e6000d0a4b39`

### Browser

`NOT_RUN / ENVIRONMENT_BLOCKED`.

Chromium exists in the runtime but hangs even on a trivial `data:` document and must be killed by timeout; therefore no browser PASS is claimed.

### Hosted CI

`NOT_RUN / NOT_OBSERVED` before PR creation. Refresh after PR allocation.

## Changed-File Ledger

- `agents/WIP-hp-kd320-csv-intake-preview_workreport.md` — recovery state.
- `agents/status/WIP-hp-kd320-csv-intake-preview.yaml` — machine-readable state.
- `agents/claims/WIP-hp-kd320-csv-intake-preview.yaml` — path/authority claim.
- `engineering/hp-class-standardization/qualification/kd320-q2/csv-intake.js` — CSV parser, preflight and Q2/edition preview adapters.
- `tabs/hp-kd320-evidence-intake-tab.js` — native preview UI.
- `tabs/engineering-workspace-tab.js` — one new Engineering subtab registration; all existing subtabs retained.
- `tests/b313-chapter-ix-kd320-csv-intake.test.mjs` — 12 parser/gate regressions.
- `tests/hp-kd320-evidence-intake-ui.test.mjs` — 4 UI/authority regressions.

## Active Risks

- `RISK-001` false confidence from a green CSV preflight: mitigated by separately displaying Q2/edition state and persistent authority-false badges.
- `RISK-002` edition laundering: mitigated by restricting the existing 2023 reconciliation adapter to `PVP2025-154710`; all other non-2025 published routes fail closed.
- `RISK-003` local backup command unavailable for connector-only remote edit: exact pre-edit branch state is preserved remotely; this is recorded as an environment substitution, not falsely reported as execution of `node utils/backup.js`.
- `RISK-004` browser test unavailable: explicitly retained as `NOT_RUN / ENVIRONMENT_BLOCKED`.

## Exact Next Action

Open a draft successor PR with base `agent/hp-kd320-edition-reconciliation`, convert WIP recovery artifacts to PR-numbered custody, reconcile the live diff/checks/reviews, then execute the owner-authorized stacked merge only if every layer remains clean and mergeable. Because the PRs are stacked on feature branches, merge top-down into each base, finishing with PR622 into `main`, so no successor changes are stranded outside `main`.
