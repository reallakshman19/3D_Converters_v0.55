# PR646 Work Report — governed SBC Type 1–4 connection workspace

## Identity

```text
PR                    #646
branch                agent/sbc-full-vertical-ui-20260819
base                  main@0a16ce60d515f38151911e673860c24d341c035e
implementation head   e41c98398371395bc7e519afb041374ce9880c1d
report basis head     e41c98398371395bc7e519afb041374ce9880c1d
criticality           ENGINEERING_CRITICAL
state                 OPEN / DRAFT
merge authority       OWNER_ONLY / NOT_GRANTED
```

Issue ownership: #563. Family gate: #429. Type-3 source/freeze neighbor: #514 / draft #546. Master/source programme: #450.

## Mission

Create one connection-centric SBC workspace that truthfully presents the governed Type 1–4 vertical while preserving every current qualification and engineering-authority boundary.

The live defect was presentation drift: current `main` exposed a mature Type-3 candidate panel inside generic User Engineering Data even though the merged machine contract defines one four-branch SBC capability with lifecycle `RESERVED` and `executionAllowed=false` for every type.

## Appendix A qualification

Completed before production mutation in the WIP record:

```text
A1 production trace              19/20
A2 engineering/source boundary   19/20
A3 authority invariants          20/20
A4 validation/falsification      18/20
A5 minimal patch                 18/20
TOTAL                            94/100
DISPOSITION                      QUALIFIED_FOR_BOUNDED_SBC_FULL_VERTICAL_UI_SLICE
```

This qualification authorizes only the bounded UI/contract-projection slice. It does not authorize any SBC numerical method, master publication, curve activation, screening promotion or design authority.

## Implemented product behavior

### Dedicated SBC workspace

Added:

```text
tabs/vibration-integrity-sbc-workspace-model.js
tabs/vibration-integrity-sbc-workspace-view.js
```

The model derives all Type 1–4 status from the existing governed contracts:

- `VIB.SBC.SMALL_BORE`;
- `SBC_CONNECTION`;
- `SBC_VERTICAL_LIFECYCLE`;
- Type implementation slots;
- type input contracts;
- type classification contracts;
- main-line input requirement.

No numerical SBC formula, table value, curve point or default is copied into UI code.

The workspace visibly exposes:

- exact connection/facility scope;
- explicit Type 1 / 2 / 3 / 4 selection;
- automatic type classification = OFF;
- lifecycle and execution status;
- published B1 example identity;
- independent B2 requirement;
- structural required fields;
- current qualification blockers;
- next governed implementation seam;
- main-line dependency `QUALIFIED_EI_MAIN_LINE_ASSESSMENT`;
- `FIT-only accepted = NO`;
- assessment completeness requirement.

### Type-3 boundary

The existing Type-3 candidate path is retained unchanged. It appears only after explicit Type-3 selection. The workspace keeps the source conflict visible:

```text
SBC_T3_CURVES_BLOCKED_SOURCE_DATA_CONFLICT
```

D7 remains an oracle, not calibration input. No Type-3 numerical/currentness module was changed.

### Navigation / UI hierarchy

- adds `SBC connections` to the Vibration Integrity workspace tabs;
- removes the Type-3 candidate panel from generic User Engineering Data;
- facility-register SBC actions now open the dedicated SBC workspace;
- the existing facility SBC action preselects Type 3 because the current legacy candidate path is Type-3-specific;
- manually opening the SBC workspace requires explicit type confirmation.

## Cache custody

New UI release identity:

```text
20260819-sbc-full-workspace-1
```

Propagated through:

```text
index.html
→ main-rhbg-fitguard.js
→ core/app.js
→ core/engineering-tabs-extension.js
→ tabs/engineering-workspace-tab.js
→ tabs/engineering-calculations-tab.js
→ tabs/vibration-integrity-tab.js
→ tabs/vibration-integrity-user-data-shell.js
→ SBC workspace model/view + UI contract
```

Unchanged Type-3 numerical/currentness descendants deliberately remain on:

```text
20260815-sbc-pf05-cache-1
```

This prevents the UI release from being represented as Type-3 requalification.

## Permanent regressions added/updated

```text
tests/vibration-sbc-full-workspace.test.mjs
tests/vibration-sbc-full-workspace-cache-chain.test.mjs
tests/vibration-sbc-type3-runtime-cache-chain.test.mjs
```

The source contracts pin:

- Type 1–4 governed order;
- RESERVED/non-executable state;
- explicit type selection;
- no automatic classification;
- B1/B2 visibility;
- FIT-only main-line rejection;
- Type-3 curve quarantine;
- no Type-3 candidate UI before explicit Type-3 selection;
- facility routing into the SBC workspace;
- full startup cache chain;
- preserved PF-05 identity for unchanged Type-3 descendants;
- preserved current AIV cache identity.

## Changed-file reconciliation at implementation head

```text
relation to main       ahead 19 / behind 0
changed files          15
unexplained files      0
new JS module sizes    81 / 86 physical lines (<300)
workflow files         0
SBC numerical kernels  0
SBC master/curve data  0
```

Implementation/product/test paths:

```text
core/app.js
core/engineering-tabs-extension.js
index.html
main-rhbg-fitguard.js
tabs/engineering-calculations-tab.js
tabs/engineering-workspace-tab.js
tabs/vibration-integrity-sbc-workspace-model.js
tabs/vibration-integrity-sbc-workspace-view.js
tabs/vibration-integrity-tab.js
tabs/vibration-integrity-ui-contract.js
tabs/vibration-integrity-user-data-shell.js
tests/vibration-sbc-full-workspace-cache-chain.test.mjs
tests/vibration-sbc-full-workspace.test.mjs
tests/vibration-sbc-type3-runtime-cache-chain.test.mjs
```

Recovery metadata is additional to the implementation-head count.

## Existing-file rollback custody

Native `node utils/backup.js save ...` is unavailable in this connector runtime and remains `NOT_RUN / ENVIRONMENT_BLOCKED`.

Exact pre-edit blobs:

```text
tabs/vibration-integrity-user-data-shell.js       2c922cbb7c884b2ef5d8bdb14f7b3abf22263f39
tabs/vibration-integrity-ui-contract.js           71cbe0f6610b566c187f9a3de3af373b898eb44e
index.html                                        f1b6733994ef6d98f6e69dfaadde0f32fcf64a5e
main-rhbg-fitguard.js                             71090c997318e5c1b6b3ac0b4d08cf115bba0877
core/app.js                                       8aa9d4ce05b8b06869a343600e3b29660db23004
core/engineering-tabs-extension.js                e9e029a7e5331c9721c5f6e927071b2aa4006b2f
tabs/engineering-workspace-tab.js                 ff2f5751802560e73c8b4a27299c99d89f63c14e
tabs/engineering-calculations-tab.js              6780a254ceb60e64c211b8d46d0db6ef7691c4b8
tabs/vibration-integrity-tab.js                    a91bc037a39cac6ddcee88c15a91f5c6508ae4f1
tests/vibration-sbc-type3-runtime-cache-chain.test.mjs f4557c1a853dca5cb76f66beda867f8b4dc8eb83
```

Immutable blobs are rollback evidence only, not native backup PASS.

## Coordination

- #512 is merged; its shared product/UI contract is part of current main.
- #615 is merged; its integrated project work is part of current main.
- #546 remains open/draft and has no exact production-file overlap with this slice. It remains authoritative for Type-3 source/freeze evidence.
- #508/#520/#521/#522/#524/#527/#529 are historical salvage/evidence only.

## Protected engineering boundary

```text
full SBC lifecycle             RESERVED
Type 1 execution               FORBIDDEN
Type 2 execution               FORBIDDEN
Type 4 execution               FORBIDDEN
Type 3                         EXISTING CANDIDATE ONLY
T3 curves                       BLOCKED_SOURCE_DATA_CONFLICT
engineering authority           NONE for full vertical
screening authority             NOT_AUTHORIZED for full vertical
design authority                false
FIT-only main-line authority    NOT ACCEPTED
automatic type classification   false
```

## Validation truth

Hosted validation was inspected on recovery head:

```text
7f574c9140d6d6c963b93dc1b4383c8905df193f
```

```text
live main/source grounding             PASS / GITHUB_SOURCE
branch relation / file reconciliation  PASS / GITHUB_COMPARE
numerical/master/curve isolation       PASS / DIFF_INSPECTION
workflow isolation                     PASS / DIFF_INSPECTION
new-module line limits                 PASS / GITHUB_DIFF_STATS
GitHub mergeable                       true
commit statuses                        0 returned -> NOT_RUN
PR workflow runs                       0 returned -> NOT_RUN
review submissions                     0
review threads                         0
native backup CLI                      NOT_RUN / ENVIRONMENT_BLOCKED
repository-native focused Node tests   NOT_RUN / ENVIRONMENT_BLOCKED
full repository vibration suites       NOT_RUN / ENVIRONMENT_BLOCKED
served browser SBC journey             NOT_RUN / ENVIRONMENT_BLOCKED
independent engineering review         NOT_RUN
```

No source inspection, empty hosted execution or historical test evidence is converted into runtime/browser PASS.

## Exact next action

Review PR646 and execute the focused Node/cache-chain tests plus the served Vibration Integrity → SBC connections → Type 1/2/3/4 interaction journey in an executable checkout/browser environment. Do not promote SBC authority or merge without explicit Owner authorization.
