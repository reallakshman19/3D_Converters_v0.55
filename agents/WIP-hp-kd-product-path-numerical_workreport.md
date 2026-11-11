# WIP hp-kd-product-path-numerical — Work Report

## Recovery header

- WORK_INTENT: QUALIFY_SOFTWARE_PRODUCT_PATH
- CRITICALITY: ENGINEERING_CRITICAL
- BRANCH: `agent/hp-kd-product-path-numerical`
- BASE: `main@93a682a378f0326365daa69712c22d8259b95196`
- PREDECESSOR: PR659 merged by squash at the base SHA.
- BACKUP: `backup/hp-kd-product-path-numerical-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_SUCCESSOR
- PRODUCTION_CODE_CHANGED: NO

## Mission

Add an independent numerical regression around the existing HP Piping Class `USER_CALCULATED_KD3` product path without adding UI, changing numerical kernels, altering the project schema, or promoting native KD320 authority.

The committed path is:

```text
NPS4 reference project
  -> add second governed pressure cycle
  -> create missing governed KD row
  -> copy existing checked external calculation basis
  -> bulk CSV Seq/N application
  -> HP workspace controller calculate()
  -> central HP orchestrator
  -> selected fatigue wall
  -> CORE pressure-cycle Salt
  -> external Seq/N
  -> CORE n/N + ΣU
  -> JSON serialize/parse
  -> repeated calculation
```

## Independent hand oracle

```text
D                 = 114.3 mm
t_nom             = 13.49 mm
minus tolerance   = 12.5%
internal allowance= 3.0 mm
P_low / P_high    = 2 / 20 MPa

t_min             = 13.49*(1-0.125) = 11.80375 mm
t_fatigue         = 11.80375-3       = 8.80375 mm
D_i               = 114.3-2*8.80375  = 96.6925 mm
Y                 = 1.1820978876334773
Sp(2)             = 14.066554624558583 MPa
Sp(20)            = 140.66554624558586 MPa
Delta Sp          = 126.59899162102727 MPa
Salt              = 63.29949581051363 MPa
```

Miner fixture:

```text
C1: n=500,  N=10000 -> U1=0.05
C2: n=1200, N=30000 -> U2=0.04
ΣU = 0.09
```

Seq values 70 MPa and 85 MPa are deliberately synthetic external inputs. This work qualifies ingestion/bookkeeping only and does not claim those values were produced by ASME VIII-3 KD320.

Wall-custody sensitivity:

```text
correct EOL wall Salt        = 63.29949581051363 MPa
wrong nominal-wall Salt      = 43.23041554660033 MPa
wrong nominal-wall error     = -31.704960690350337%
wrong min-as-mfg-wall Salt   = 48.59336739500539 MPa
wrong min-as-mfg-wall error  = -23.232615405864976%
```

## Authority boundary

Must remain:

```text
calculationMode           USER_CALCULATED_KD3
nativeCoreKd3Qualified    false
codeCompliance            false
canUseForDesignAuthority  false
```

This is software product-path numerical qualification only. Native KD320 mean-stress correction, fatigue-curve selection/interpolation, and Code design authority remain outside this qualification.

## Changed-file ledger

Product/qualification files:

- `tests/hp-piping-class-kd-product-path-numerical.test.mjs`
- `engineering/hp-class-standardization/qualification/user-calculated-kd3-product-path-numerical.md`

Recovery files are this WIP workreport/status/claim and later PR-numbered counterparts.

No UI, project schema, calculation kernel, master-data, workflow, or KD320 evidence-intake file is changed.

## Validation ledger

| Check | Status | Observation |
|---|---|---|
| New test syntax (`node --check`) | PASS | LOCAL_EXECUTION |
| Independent numerical hand arithmetic | PASS | LOCAL_EXECUTION; `Salt=63.29949581051362`, `ΣU=0.09` |
| Wall-basis sensitivity arithmetic | PASS | LOCAL_EXECUTION; nominal-wall error `-31.704960690350337%` |
| GitHub branch relation | PASS | started exactly from post-PR659 main |
| Production-code diff | PASS | none at current branch state |
| Committed full product-path test | NOT_RUN / ENVIRONMENT_BLOCKED | local `github.com` DNS unavailable; no repository checkout |
| Full repository-native suite | NOT_RUN / ENVIRONMENT_BLOCKED | same environment blocker |
| Served browser acceptance | NOT_RUN | no UI change in this PR |
| Independent KD320 engineering qualification | NOT_RUN / OUT_OF_SCOPE | controlled Q1/Q2 source work remains separate |

No unexecuted test is represented as PASS.

## EXACT_NEXT_ACTION

Re-ground live main and coordination PR649, inspect final branch diff, create a draft PR, add PR-numbered recovery artifacts, refresh GitHub status/workflow/review truth, and leave unmerged until explicit owner authorization for the new PR.
