# PR730 Work Report — Bolted-joint P1 controlled source qualification

## Mission

Advance issue #721 P1 by recording controlled-source identity/scope evidence and explicit unresolved authority gates for UG-44 rated-flange and bolt assembly methods.

## Baseline

```text
repository  reallaksh19/3D_Converters
base        main@78b361d1f649d41378f568ebe1a237c4bc140c73
branch      docs/engcalc-p1-source-qualification-20260904
PR          #730
mode        AUTO
```

## Grounding

Open engineering-neighbour PRs are #722 and #723. PR730 intentionally avoids their source-archive and UG-44 source-register paths and adds a separate P1 qualification document plus relay metadata only.

Compare `541d92b480756c031a30c4e9101b4ec29df1e08d -> 78b361d1f649d41378f568ebe1a237c4bc140c73` shows current main is 40 commits ahead with vibration/source-custody/agent changes, but no changes to the bolted-joint/flange numerical kernels, their focused tests, or the Engineering Calculation core files exercised by the recorded 64/64 numerical suite.

## Evidence reviewed

Repository sources:

- `docs/flange/*` committed owner source package;
- existing UG-44, short-form torque, detailed-friction and installation-strength source registers;
- issue #721 source-reading correction and P0 validation evidence.

Current official public metadata:

- ASME BPVC VIII-1 — 2025 edition identity;
- ASME B16.5 — 2025 edition/scope identity;
- ASME B16.47 — 2025 edition/scope identity;
- ASME PCC-1 — 2022 edition/scope identity;
- ASME Section VIII Code Cases product metadata and historical Case 2901 index evidence.

Public metadata is treated as edition/scope identity only, not licensed clause/table authority.

## Delivered

1. `docs/engineering-calculations/bolted-joints-p1-controlled-source-qualification.md`
   - source authority matrix;
   - UG-44 established/unresolved boundary;
   - bolt assembly established/unresolved boundary;
   - minimum controlled-source package to close P1;
   - P2 admission restricted to schema/custody mode.
2. `agents/agentchain/ENGCALC-BOLTED-JOINTS/EP-0020.md`
3. `agents/agentchain.md` updated to EP-0020.
4. Connector-side exact pre-edit backup:
   - `.backups/connector-20260904-engcalc-p1/agents_agentchain.md.bak`

## Validation truth

```text
source/authority consistency review         PASS / SOURCE_INSPECTION
current official edition/scope metadata     PASS / WEB_SOURCE_IDENTITY
P0 exact numerical suite                    PASS 64/64 at 541d92b / Node v22.22.2
P0 numerical-byte drift check               PASS / no relevant paths changed through current main
P0 Engineering Console                      FAIL 18/20 / PRE_EXISTING_VIB_PRESENTATION_SCOPE
PR730 numerical regression                  NOT_APPLICABLE / documentation+relay only
PR730 browser validation                    NOT_APPLICABLE / no product behavior change
independent engineering review              NOT_RUN
native required backup command              NOT_RUN / ENVIRONMENT_BLOCKED
connector pre-edit byte backup              PASS / EVIDENCE_ONLY_NOT_POLICY_EQUIVALENT
```

No `NOT_RUN` item is represented as PASS.

## Authority after PR730

```text
UG44                     BENCHMARK_ONLY
bolt scalar methods      REFERENCE_KERNEL_ONLY
codeCompliance           false
designAuthority          false
governingEligible        false
real master-data authority NOT_ESTABLISHED
```

## Next action

Proceed to P2 only in `SCHEMA_CUSTODY_ONLY` mode. Re-ground existing flange/bolt master stores and harden exact-match/provenance contracts without introducing real standard values or promoting authority.

## Merge

Draft. `MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED`.
