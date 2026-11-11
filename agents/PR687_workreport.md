# PR687 — HP Operating-State / Governed-Cycle Bulk Intake — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #687
BRANCH: agent/hp-transient-bulk-intake
BASE: main
BASE_SHA_AT_START: cd02030d7d28438ddda8e11ac92acb319cd06cd9
IMPLEMENTATION_HEAD_AT_PR_OPEN: d609de41c0501034d4ba17c0cc3fa409e0944a7d
HOSTED_RECONCILIATION_HEAD_BEFORE_RECORD_SYNC: e56b4ce88e227ecd7c016559627474366c7d5fcb
PREDECESSOR_PR: 685 (MERGED)
PREDECESSOR_MERGE: cd02030d7d28438ddda8e11ac92acb319cd06cd9
CURRENT_STAGE: DRAFT_READY_FOR_NATIVE_BROWSER_QUALIFICATION
MERGE_AUTHORITY: NOT_GRANTED_FOR_PR687

## Mission

Complete the productive table-authoring chain for HP Piping Class:

```text
product matrix
-> operating states / governed cycles
-> external Seq / N
-> canonical review calculation
-> class-wide result matrix / export
```

No native KD320, Code-authority, or source/evidence qualification is introduced.

## Bulk contracts

States:

```text
state_id,pressure_mpa,material_temperature_c,structural_temperature_c
```

Cycles:

```text
cycle_id,from_state_id,to_state_id,total_cycles,cycles_per_year,category,provenance_id
```

The existing `transient.spectrum.spectrumId` remains class authority and is stamped onto imported state/cycle rows. Design pressure and external KD quantities are not owned by this intake.

Limits: 200 states / 1000 cycles.

## Fail-closed validation

- spectrum ID required before admission
- exact headers required
- required identities/numerics cannot be blank
- state/cycle identities unique case-insensitively
- case-only identity renames blocked
- pressure >= 0
- total_cycles >= 0
- cycles_per_year blank or >= 0
- state references exact and present in the imported state table
- case-mismatched state references blocked
- CSV and TSV supported

## KD custody rule

External Seq/N rows are retained only when all stress-basis custody is unchanged:

1. cycle ID
2. from-state ID
3. to-state ID
4. from/to pressure
5. from/to material temperature
6. from/to structural temperature

Stale rows are removed, never silently rewritten:

```text
CYCLE_REMOVED
STATE_PAIR_CHANGED
STATE_VALUE_CHANGED
```

If a previously populated KD package becomes empty, the empty package is removed and must be re-added in KD Review when replacement external results are available. New governed cycles are reported as missing from retained KD packages.

Changing only `total_cycles`, `cycles_per_year`, `category`, or `provenanceId` does not invalidate the stress basis. The canonical transient resolver consumes the new lifetime `n` for damage bookkeeping.

## Production path retained

The active HP route composes the existing product/KD workbench with an additive transient enhancer:

```text
hp-piping-class-product-bulk-workbench-tab.js
+ hp-piping-class-transient-bulk-enhancer.js
```

Apply uses:

```text
serializeHpPipingClassWorkspaceProject
-> hidden data-hpwb-file JSON import
-> existing workspace controller/storage
-> existing data-hpwb-action="calculate"
```

No parallel transient state store or engineering solver is added.

## Canonical integration check

Bulk-applied data was fed directly into existing `resolveChapterIxTransientSpectrum()`.

```text
LOW:  P=2 MPa,  Tm=40 C, Ts=45 C
HIGH: P=20 MPa, Tm=80 C, Ts=75 C
C1: LOW -> HIGH, n=500, cycles/year=25
```

Canonical outputs:

```text
pressureRangeMpa              = 18
meanPressureMpa               = 11
materialTemperatureRangeC     = 40
structuralTemperatureRangeC   = 30
totalDeclaredCycles           = 500
cyclesPerYear                 = 25
canUseForDesignAuthority      = false
```

A second case changes lifetime cycles to 750 and cycles/year to 37.5; pressure range/mean remain 18/11 while the new lifetime values are consumed.

## Exact-byte validation

Exact Git blob reconstruction was used for authored files and the existing canonical resolver.

```text
helper syntax                                      PASS
enhancer syntax                                    PASS
route syntax                                       PASS
parser / custody / normal cases                    PASS 7/7
fail-closed cases                                  PASS 7/7
route / UI ownership cases                         PASS 6/6
canonical transient resolver integration           PASS 2/2
focused total                                      PASS 22/22
```

Important falsifier:

```text
cycle = C1 unchanged
pair  = LOW -> HIGH unchanged
HIGH P:  20 -> 21 MPa
HIGH Tm: 80 -> 81 C
=> prior external Seq/N removed as STATE_VALUE_CHANGED
=> stale fatigue package not retained
```

PR681 base-browser source inventory compatibility remains satisfied by a truthful KD-bulk composition marker in the active route. PR685 product-matrix source gate still sees the actual product-bulk wrapper import.

## Hosted reconciliation

At `e56b4ce88e227ecd7c016559627474366c7d5fcb` before this record-only sync:

```text
branch ancestry             ahead 15 / behind 0
changed files               10 = 7 implementation/test + 3 recovery
PR mergeable                true
PR draft                    true
status checks               0 -> NOT_RUN
PR-triggered workflows      0 -> NOT_RUN
reviews                     0
review threads              0
```

The record-sync commit changes only recovery metadata; re-read the PR head after this update for the final exact head.

## NOT_RUN

```text
routed FULL_APP browser journey for transient editor          NOT_RUN
combined native-checkout npm run verify:hp-production-browser NOT_RUN
full repository regression                                    NOT_RUN
```

Do not promote source/UI tests or exact-byte Node execution to routed FULL_APP browser PASS.

## Authority boundary

```text
calculationMode = USER_CALCULATED_KD3
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
```

## Changed-file ledger

Engineering/test:

```text
tabs/engineering-workspace-tab.js
tabs/hp-piping-class-transient-bulk-input.js
tabs/hp-piping-class-transient-bulk-enhancer.js
tests/hp-piping-class-transient-bulk-input.test.mjs
tests/hp-piping-class-transient-bulk-failclosed.test.mjs
tests/hp-piping-class-transient-bulk-ui.test.mjs
tests/hp-piping-class-transient-bulk-canonical.test.mjs
```

Recovery:

```text
agents/PR687_workreport.md
agents/status/PR687.yaml
agents/claims/PR687.yaml
```

## Next action

1. Keep PR687 draft until owner decides whether native FULL_APP qualification is required before merge.
2. If a native checkout is available, exercise Pressure Cycles -> bulk states/cycles -> apply -> KD refresh -> result/export.
3. Reconcile exact head and hosted state before any authorized merge.
4. Do not merge without explicit owner merge authorization.

## Appendix A — takeover qualification

1. Why is Spectrum ID excluded from both bulk tables?
2. Which six custody dimensions must remain unchanged before external Seq/N may be retained?
3. Why does changing only `total_cycles` not invalidate Seq/N stress basis?
4. What happens if referenced pressure changes while cycle ID and pair remain unchanged?
5. Why are case-only state/cycle renames blocked?
6. Why does apply use the existing hidden JSON import/controller instead of direct localStorage mutation?
7. Which canonical transient values were verified?
8. Which validation claims remain NOT_RUN?
