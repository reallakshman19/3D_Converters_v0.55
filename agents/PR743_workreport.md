# PR743 workreport — P8 Advanced_Analysis interface adapter

## Assignment

Implement one bounded P8 source-adapter slice on top of PR #742: consume a qualified signed six-DOF interface recovery contract from `reallaksh19/Advanced_Analysis`, preserve explicit frame/reference-point/sign/unit provenance, feed the existing `JointModelContext.v1` resolver, and remain non-authorizing. Do not add automatic 3D extraction, master resolution, solvers, registry wiring or UI.

## Grounding

```text
3D_Converters main     78b361d1f649d41378f568ebe1a237c4bc140c73
base PR                #742
base head              554cb6ff8a9e86974c84dbf8c43a6d374eb46638
PR                     #743
branch                 feat/engcalc-p8-advanced-analysis-interface-adapter-20260905
Advanced_Analysis main eabb93cd44c59ce182d73284cb707653917e07c8
mode                   AUTO
```

PR #742 remains draft and its exact native focused gate remains `NOT_RUN / ENVIRONMENT_BLOCKED`. Proceeding into this source adapter does not convert that state to PASS.

## Source inspection

At the pinned `Advanced_Analysis` revision, the linear-piping interface subsystem provides controlled interface definition and recovery contracts with:

- orthonormal right-handed basis qualification;
- explicit analysis node/source-entity identity;
- global reference point and local reference-to-node lever consistency;
- signed global/local force and moment components;
- load-case identity and physical-load-case hash;
- explicit reporting sign convention;
- SI unit declarations;
- semantic/evidence hashes for the interface set and recovery results.

The public recovery API exposes `m`, `N`, `N*m`. Source recovery transports moment from node to reference point with the same rigid-resultant relationship used by the P3/P8 mechanics.

The source interface kinds are `SUPPORT`, `ANCHOR`, `NOZZLE`, and `EQUIPMENT`; there is no `FLANGE` interface kind. This is a material remaining boundary and is not papered over by the adapter.

## Delivered

### Semantic-hash custody helper

`converters/engineering-calculations/flange/advanced-analysis-semantic-hash.js`

- reduced exact canonical JSON/FNV-1a 64-bit primitive pinned to the source revision;
- no source-network call or dynamic dependency;
- validates source semantic/evidence hashes independently;
- known empty-string FNV vector retained in tests.

### Interface adapter

`converters/engineering-calculations/flange/advanced-analysis-interface-adapter.js`

The adapter:

1. pins exact source repository and commit;
2. requires exact source contract shapes;
3. recomputes interface definition, interface-set, recovery-result, recovery and evidence hashes;
4. admits only `NOZZLE` and `EQUIPMENT`;
5. requires explicit `referencePointRole = FLANGE_FACE` with provenance ID;
6. requires explicit positive opening direction with provenance ID;
7. requires exact source reporting sign convention; no implicit reversal;
8. requires exact source units `m`, `N`, `N*m`;
9. records `N*m -> N.m` as identity notation normalization only;
10. uses interface basis origin as source point and interface reference point as face point;
11. delegates reference-point transport and frame rotation to the existing PR #742 `JointModelContext.v1` path;
12. cross-checks local force and face moment against upstream recovery evidence using an explicit caller-supplied non-negative tolerance;
13. retains source semantic/evidence hashes and physical/analysis load-case provenance;
14. leaves master binding identities unresolved and invokes no engineering solver.

New production JavaScript lengths:

```text
advanced-analysis-semantic-hash.js      67 lines
advanced-analysis-interface-adapter.js 249 lines
```

Both are below the repository 300-line new-JS limit.

## Authority boundary

```text
sourceAuthority             QUALIFIED_CROSS_REPOSITORY_INTERFACE_CONTRACT_NON_AUTHORIZING
automatic3dExtraction       false
masterBindingsResolved      false
solverInvoked               false
codeCompliance              false
canUseForDesignAuthority    false
governingEligible           false
```

No interface identity, reference point, basis axis, sign convention or tolerance is silently inferred where it changes engineering meaning.

## Validation

Exact new-file Git blob reconciliation:

```text
semantic hash helper  7c443237aa573b79322f24733733955d7b64d878
adapter               825e3c63b99c8860caee83ca50c1e41ecffa3f6c
focused test          ce17171c654747e5529c2fdfe4abd1560d483acf
```

Supporting execution under Node `v22.16.0`:

```text
focused suite  PASS 15/15
```

The supporting run used source-reconstructed files whose three new-file Git blob identities exactly match GitHub. P8/P3 dependency behavior had been separately qualified/reconciled in PR #742/#732. This evidence is not an exact native PR #743 checkout execution.

Exact native gate remains:

```bash
node --test tests/flange-advanced-analysis-interface-adapter.test.mjs
```

Classification:

```text
new GitHub blob identity          PASS
supporting focused execution      PASS 15/15 / SOURCE_RECONSTRUCTED
exact native PR-head execution    NOT_RUN / ENVIRONMENT_BLOCKED
independent engineering review    NOT_RUN
```

No workflow or expected-value gate was weakened.

## Backup truth

Before updating `agents/agentchain.md`, its exact connector-visible content was stored at:

`.backups/connector-20260905-p8-aa-adapter/agents_agentchain_before_ep0032.md.bak`

Repository-native `node utils/backup.js save ...` remains `NOT_RUN / CONNECTOR_ONLY_ENVIRONMENT`. The connector copy is custody evidence only, not policy-equivalent backup PASS.

## Remaining blockers

This PR closes a source-contract path for explicit signed six-DOF interface resultants and a qualified source basis/reference point. It does **not** close the semantic jump from generic `NOZZLE`/`EQUIPMENT` interface to a physical flange face/opening direction. Those are still explicit caller/project declarations.

Before automatic flange calculation integration:

- bind interface/reference geometry to a specific controlled flange-face entity;
- bind the physical positive-opening direction without caller interpretation;
- run the exact PR #743 focused test in a native checkout;
- qualify governed flange/bolt/gasket master resolution separately;
- independently review the cross-repository handoff.

## Merge

Draft. `MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED`.
