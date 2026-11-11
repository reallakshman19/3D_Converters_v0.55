# PR690 — HP Class Package Round-Trip / Replacement Impact — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #690
BRANCH: agent/hp-class-package-roundtrip
BASE: main
BASE_SHA_AFTER_REPLAY: d8f109b2a1587d1d79dbe40b8787b7115e6fd5f0
PREDECESSOR_PR: 689 (MERGED)
PREDECESSOR_MERGE: ef09184a00e28078cca3fa2b7939725c213a2bbb
CURRENT_STAGE: DRAFT_READY_FOR_NATIVE_VALIDATION
MERGE_AUTHORITY: NOT_GRANTED_FOR_PR690

## Mission

Close the editable HP class package loop without introducing another engineering schema:

```text
import hp-piping-class-intake-package/v1
-> edit canonical HP workspace
-> export same v1 package
-> re-import through existing package + canonical preflight
-> compare incoming replacement against current workspace
-> require revalidation before full replacement Apply
```

No native KD320 implementation or authority promotion is in scope.

## Export contract

`buildHpPipingClassIntakePackageExport(project)` emits the existing `hp-piping-class-intake-package/v1` only when the current project is losslessly representable by v1.

The generated package delegates its tables back to the existing product, transient and per-product KD bulk contracts. It is re-imported through the existing package/canonical preflight before export success is returned.

Authority fields are not serialized.

### Fail-closed representability

Editable export blocks rather than silently drops information when any of the following is present:

```text
INTAKE_PACKAGE_EXPORT_GOVERNED_PRODUCT_UNSUPPORTED
INTAKE_PACKAGE_EXPORT_EMPTY_KD_PACKAGE_UNSUPPORTED
INTAKE_PACKAGE_EXPORT_KD_BASIS_UNSUPPORTED
INTAKE_PACKAGE_EXPORT_FIELD_UNSUPPORTED
INTAKE_PACKAGE_EXPORT_KD_STATE_BINDING_MISMATCH
INTAKE_PACKAGE_EXPORT_REIMPORT_BLOCKED
INTAKE_PACKAGE_EXPORT_ROUNDTRIP_MISMATCH
```

Important boundary: a legacy/reference project carrying external `calculationBasis` custody is intentionally not claimed to be v1-round-trippable. v1 editable export is for the v1-representable direct-engineering-input surface.

## Replacement impact ledger

`compareHpPipingClassIntakeReplacement(current, candidate)` reports deterministic changes in these classes:

```text
IDENTITY
STRUCTURE
METHOD_BASIS
STRESS_BASIS
DAMAGE_BASIS
FATIGUE_BASIS
CUSTODY
```

Coverage:

- project/class/revision identity
- B31.3 and VIII-3 edition identity
- design pressure and class allowances
- spectrum identity, design life, prepared/checked/approved/status custody
- product mode, OD, S, nominal wall, tolerance, wall basis, measured/future wall loss
- state pressure/material/structural temperature
- governed-cycle state pair, lifetime cycles, cycles/year, category/provenance
- KD row state-pair binding, location, user Salt, Seq and N
- added/removed product/state/cycle/KD rows

High-impact is true when structure, method basis, stress basis or fatigue basis changes.

## Stale-validation protection

The UI stores:

```text
validatedText
validatedCurrentSignature
```

`Apply + calculate` blocks with `INTAKE_PACKAGE_REVALIDATION_REQUIRED` unless:

1. the exact package text was validated, and
2. the current workspace package-owned engineering signature is unchanged since validation.

Actual engineering edits invalidate the comparison. Calculation and project export do not erase a still-current comparison receipt.

## Defects found and corrected during audit

### 1. Method/spectrum omission

Initial replacement preview did not show B31.3/VIII-3 edition changes or spectrum design-life/custody changes.

Corrected mapping:

```text
b313Edition / viii3Edition -> METHOD_BASIS
designLifeYears           -> DAMAGE_BASIS
prepared/checked/approved/status -> CUSTODY
```

### 2. KD derived state-pair custody

v1 KD rows do not contain `fromStateId/toStateId`; they are derived from the governed transition on import. A stale existing external result could therefore have been silently rebound during export/re-import.

Correction:

- export explicitly verifies every external result's from/to state IDs against the governed transition;
- mismatch blocks with `INTAKE_PACKAGE_EXPORT_KD_STATE_BINDING_MISMATCH`;
- round-trip equality includes derived KD from/to custody;
- replacement diff surfaces KD from/to changes as `FATIGUE_BASIS`.

### 3. Post-Apply calculation receipt invalidation

Initial UI invalidated the comparison on every base workbench action, including the programmatic calculation immediately after Apply.

Correction: only state-mutating base actions invalidate; `calculate` and `export-project` do not.

## Authored focused tests

`tests/hp-piping-class-intake-package-roundtrip.test.mjs` covers:

1. v1 import -> export -> canonical re-import -> zero package-owned diff;
2. authority fields absent from serialized editable package;
3. stress/fatigue/damage impact classification;
4. B31.3/VIII-3 method basis + design-life + spectrum custody visibility;
5. stale KD state-pair export block and diff visibility;
6. added/removed row structural impacts;
7. governed product lossy-export block;
8. external KD calculation-basis and empty package export blocks;
9. UI export/compare/revalidation wiring.

These tests are AUTHORED but have not been reported PASS without execution.

## Validation truth

```text
current-main grounding / replay             PASS
branch ancestry                             PASS (behind 0 at last reconciliation)
changed implementation/test paths           PASS (4 intended before recovery files)
source-level ownership audit                PASS
native package roundtrip Node suite         NOT_RUN
HP Real Workbench PR workflow               NOT_RUN (0 workflow runs returned)
HP I1-I3 PR workflow                        NOT_RUN
FULL_APP export/compare/apply journey        NOT_RUN
full repository regression                  NOT_RUN
```

Do not promote authored tests or source review to native runtime PASS.

## Authority boundary

```text
calculationMode = USER_CALCULATED_KD3
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
```

No calculation equation, fatigue curve authority, Code compliance or design release authority is added.

## Changed-file ledger

Engineering/test/CI:

```text
.github/workflows/hp-piping-class-real-workbench.yml
tabs/hp-piping-class-intake-package-enhancer.js
tabs/hp-piping-class-intake-package-roundtrip.js
tests/hp-piping-class-intake-package-roundtrip.test.mjs
```

Recovery:

```text
agents/PR690_workreport.md
agents/status/PR690.yaml
agents/claims/PR690.yaml
```

## Hosted reconciliation

At PR head `4bbdc44cc2234918483434b5a08c8000dbb4a239` before this recovery-only sync:

```text
base main                       d8f109b2a1587d1d79dbe40b8787b7115e6fd5f0
branch ancestry                 ahead 12 / behind 0
changed files                   7 = 4 engineering/test/CI + 3 recovery
PR mergeable                    true
PR draft                        true
commit status checks            0 -> NOT_RUN
PR-triggered workflow runs      0 -> NOT_RUN
reviews                         0
review threads                  0
```

The present commit changes recovery metadata only. Re-read the PR after this sync for the exact final head.

## Next action

1. Re-read exact PR690 head and current main.
2. Execute native package/workbench tests if a checkout-capable runner becomes available.
3. Exercise browser path: export editable package -> modify package -> Validate + compare -> mutate current project -> prove Apply requires revalidation -> revalidate -> Apply -> calculate.
4. Reconcile hosted statuses/workflows/reviews.
5. Do not merge without explicit owner authorization for PR690.

## Appendix A — takeover qualification

1. Why must governed basis packages fail editable v1 export?
2. Why does external KD `calculationBasis` block v1 export?
3. Why are KD from/to state IDs checked even though they are not v1 table columns?
4. Which replacement changes are `METHOD_BASIS` versus `STRESS_BASIS`?
5. Why is design-life change `DAMAGE_BASIS` but state pressure change `STRESS_BASIS`?
6. What exact condition causes `INTAKE_PACKAGE_REVALIDATION_REQUIRED`?
7. Why may calculation preserve a valid comparison receipt while an engineering edit may not?
8. Which validation claims remain `NOT_RUN`?
