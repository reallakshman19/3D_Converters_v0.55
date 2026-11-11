# PR732 Work Report — P3 bolt-group reference API

## Mission

Productize the existing arbitrary bolt-group reference kernel into an explicit geometry/load-case API with six-DOF resultant transport, asymmetric bolt patterns, equilibrium evidence, fail-closed geometry handling and an explicit preload-combination boundary.

## Baseline

```text
repository  reallaksh19/3D_Converters
base        main@78b361d1f649d41378f568ebe1a237c4bc140c73
branch      feat/engcalc-p3-bolt-group-api-20260904
PR          #732
mode        AUTO
```

## Sequencing

The owner explicitly directed this P3 fix after the P2 hard stop. PR731 remains separately draft with exact P2 validation `NOT_RUN`. This work does not use P2 master data and does not represent P2 as PASS.

## Source finding

The committed owner source package contains no six-DOF arbitrary bolt-group model. The pipe-support workbook is a 2D clamp/friction-grip sizing method. P3 is therefore `FIRST_PRINCIPLES_PRODUCTIZATION` of the existing reference kernel rather than workbook migration.

## Delivered

### `mechanics/load-resultant.js`

Rigid-body resultant transport between two explicit points in a common frame:

`M_target = M_source + (r_source - r_target) x F`

No rotation or coordinate-frame inference is performed.

### `bolts/group-assessment.js`

- mandatory common local frame id;
- fixed right-handed XY bolt-plane/Z-normal convention;
- explicit x/y/z bolt coordinates with planarity enforcement;
- explicit six force/moment components and reference point per load case;
- transport to computed bolt-group centroid;
- reuse of existing `distributeLinearBoltGroupLoads` kernel;
- asymmetric/non-collinear group support;
- structured non-planar/degenerate/duplicate-case failures;
- per-case applied/recovered equilibrium residuals;
- multi-case per-bolt axial/shear envelopes;
- no hidden preload/external-load combination.

### Preload boundary

The API explicitly returns `NOT_MODELED` for preload combination and does not expose a misleading `combinedAxialN`. Physical combination remains gated on a qualified joint/bolt stiffness, contact/separation and preload-loss model.

### Registry boundary

The current Engineering Calculations registry is scalar-input oriented. P3 deliberately does not encode bolt arrays or load-case arrays into scalar fields and does not modify the central registry or UI.

## Authority

```text
method authority       REFERENCE_KERNEL_ONLY
codeCompliance         false
designAuthority        false
governingEligible      false
preload combination    NOT_MODELED
```

## Validation truth

Supporting source-reconstructed Node execution used the exact current-main low-level kernel bytes and the new P3 source/test content:

```text
new P3 assessment tests     PASS 10/10
existing bolt-group tests   PASS 8/8
combined                    PASS 18/18
classification              SOURCE_RECONSTRUCTED
```

Exact native PR-head checkout execution:

`NOT_RUN / ENVIRONMENT_BLOCKED`

Exact gate:

```bash
node --test \
  tests/bolt-group-loads.test.mjs \
  tests/bolt-group-assessment.test.mjs
```

No expected values, workflow files or authority states were weakened.

## Backup truth

P3 production changes are new-file-only; no existing production file was edited. The shared `agents/agentchain.md` index is intentionally not edited because neighbouring open work owns that shared coordination surface.

## Next action

Run the two focused suites against the exact PR732 head in a native checkout. If PASS, re-ground main/head/overlap and determine the smallest next integration boundary. If FAIL, repair only the first incorrect transport/geometry/envelope boundary.

## Merge

Draft. `MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED`.
