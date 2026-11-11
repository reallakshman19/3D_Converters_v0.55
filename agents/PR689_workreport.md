# PR689 — HP Single-File Class Intake Package — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #689
BRANCH: agent/hp-class-intake-package
BASE: main
BASE_SHA_AT_NORMALIZATION: 1d0e9245f9a6333ce43fb8085602ec112241a411
PREDECESSOR_PR: 687 (MERGED)
PREDECESSOR_MERGE: 2fc9f593bd235a92df6589919f7f21e02b366311
CURRENT_STAGE: DRAFT_NATIVE_CI_PENDING
MERGE_AUTHORITY: NOT_GRANTED_FOR_PR689

## Mission

Remove the final multi-step onboarding burden from the HP Piping Class production workspace by accepting one replacement package that composes the existing product, transient and per-product KD bulk contracts.

```text
hp-piping-class-intake-package/v1
  -> class identity / method identity / design pressure / spectrum identity
  -> existing product bulk contract
  -> existing state + governed-cycle bulk contract
  -> existing per-product KD bulk contract(s)
  -> existing HP project validation
  -> existing canonical HP orchestrator preflight
  -> existing JSON import/workspace controller
  -> existing review calculation
```

This is a productivity/orchestration increment. It does not introduce a new engineering formula path.

## Replacement semantics

The package is a full replacement import. It is not a merge or patch of the current workspace project. The UI states this before Apply.

## Package ownership

Package-owned scalar identity:
- metadata.projectId
- metadata.classId
- metadata.revision
- method.b313Edition
- method.viii3Edition when KD data exists
- classBasis.designPressureMpa
- spectrum.spectrumId and optional design-life/custody metadata

Delegated table ownership:
- products -> existing `hp-piping-class-product-bulk-input.js`
- operating states / governed cycles -> existing `hp-piping-class-transient-bulk-input.js`
- Seq/N -> existing `hp-piping-class-kd-bulk-input.js`, one exact productId at a time

## Authority boundary

The package recursively rejects any occurrence of:

```text
calculationMode
nativeCoreKd3Qualified
codeCompliance
canUseForDesignAuthority
engineeringAuthority
```

CORE constructs the project with:

```text
calculationMode = USER_CALCULATED_KD3
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
```

No intake payload can promote these flags.

## Canonical preflight

After the existing table validators assemble a candidate project, PR689 calls the existing `evaluateHpPipingClassProject()` before workspace mutation.

Admission rules:
- malformed/inconsistent package -> BLOCK
- existing product/transient/KD validator failure -> BLOCK
- canonical calculation inconsistency -> BLOCK
- supplied user Salt inconsistent with CORE Salt -> BLOCK
- canonical preflight exception -> BLOCK
- legitimate engineering result such as `STATIC_REFERENCE_FAIL` -> ADMIT and display as result

This distinction prevents both unsafe admission and over-blocking useful engineering results.

## Numerical reference encoded in tests

NPS4-S160:
- D = 114.3 mm
- S = 138 MPa
- nominal wall = 13.49 mm
- tolerance = 12.5%
- internal allowance = 3 mm
- design pressure = 20 MPa
- LOW/HIGH pressure = 2/20 MPa
- n = 500
- Seq = 70 MPa
- N = 10000

Expected existing canonical outputs:

```text
required nominal thickness = 12.240449712388969 mm
pressure rating            = 23.086120852009273 MPa
EOL effective wall         = 8.80375 mm
CORE Salt                  = 63.29949581051363 MPa
cumulative usage           = 0.05
```

NPS6-XXS static pressure rating is checked at approximately 23.114229 MPa.

## Key falsifiers

1. authority-like key anywhere in package -> `INTAKE_PACKAGE_AUTHORITY_FIELD_FORBIDDEN`
2. schema/header drift -> blocked
3. unknown transient state -> existing `CYCLE_BULK_STATE_UNKNOWN`
4. KD product case mismatch / duplicate -> blocked
5. KD without VIII-3 edition identity -> blocked
6. new governed cycle missing from per-product KD table -> existing `KD_BULK_CYCLE_MISSING`
7. supplied user Salt = 10 MPa for NPS4 2->20 cycle -> canonical `USER_SALT_MISMATCH`, no workspace mutation
8. static wall reference fail -> admissible engineering result, not package parser failure

## UI

The package enhancer is additive to the existing product/transient/KD workbench. It reuses:

```text
serializeHpPipingClassWorkspaceProject
-> hidden data-hpwb-file import
-> existing workspace controller/storage
-> existing data-hpwb-action="calculate"
```

No second workspace state store is introduced.

## Example

`docs/hp-piping-class-intake-package-v1.example.json`

The example is implementation input guidance only and does not establish Code/design authority.

## Validation state

Authored tests:
- `tests/hp-piping-class-intake-package.test.mjs`
- `tests/hp-piping-class-intake-package-failclosed.test.mjs`
- `tests/hp-piping-class-intake-package-ui.test.mjs`

Native-checkout CI has been wired into the existing `HP Piping Class Real Workbench` workflow. The existing HP I1-I3 PR gate also matches the new HP test paths.

Current truth at workreport creation:

```text
branch normalized to current main                 PASS
ahead/behind before recovery files                9 / 0
implementation/test paths                          9 intended
native package Node suite                          NOT_RUN (CI pending)
existing HP real-workbench native gate             NOT_RUN (CI pending)
HP I1-I3 native gate                               NOT_RUN (CI pending)
FULL_APP browser package interaction               NOT_RUN
full repository regression                         NOT_RUN
```

Do not convert authored tests into PASS until a native execution result is observed.

## Changed-file ledger

Implementation/test/docs/CI:

```text
.github/workflows/hp-piping-class-real-workbench.yml
docs/hp-piping-class-intake-package-v1.example.json
tabs/engineering-workspace-tab.js
tabs/hp-piping-class-intake-package.js
tabs/hp-piping-class-intake-package-review.js
tabs/hp-piping-class-intake-package-enhancer.js
tests/hp-piping-class-intake-package.test.mjs
tests/hp-piping-class-intake-package-failclosed.test.mjs
tests/hp-piping-class-intake-package-ui.test.mjs
```

Recovery:

```text
agents/PR689_workreport.md
agents/status/PR689.yaml
agents/claims/PR689.yaml
```

## Next action

1. Trigger/observe native PR workflows.
2. Fix any exact-head failures; do not waive them.
3. Reconcile exact branch head against current main.
4. Keep FULL_APP browser status separate from Node/native-checkout validation.
5. Do not merge PR689 without separate owner authorization.

## Appendix A — takeover qualification

1. Why is this package an orchestrator of existing validators rather than a new engineering parser?
2. Why is `tables.kd` an array keyed by productId instead of one flattened class KD table?
3. Which authority keys are forbidden and why?
4. Why does user-Salt mismatch block admission while `STATIC_REFERENCE_FAIL` does not?
5. What are the replacement-import semantics?
6. Which existing workspace path performs the actual project mutation?
7. Which native workflows are expected to qualify this PR?
8. Which claims remain NOT_RUN until hosted execution is observed?
