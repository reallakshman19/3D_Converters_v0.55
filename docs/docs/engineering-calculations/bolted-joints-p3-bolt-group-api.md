# Bolted Joints / Flanges — P3 Bolt-Group Reference API

Status: `REFERENCE_KERNEL_ONLY / FIRST_PRINCIPLES_PRODUCTIZATION`

Tracking issue: `#721`

## Why this leg is first-principles

The committed owner source package does not contain a six-DOF arbitrary bolt-group solver. The pipe-support workbook is a 2D clamp/friction-grip sizing calculation, not a bolt-group equilibrium model. P3 therefore does not claim workbook migration or source-derived design authority.

The existing low-level kernel `bolts/group-loads.js` is retained as the numerical distribution primitive. P3 adds an explicit product-facing geometry/load contract around that already-tested reference kernel.

## Coordinate contract

Supported convention:

`RIGHT_HANDED_XY_BOLT_PLANE_Z_NORMAL`

Requirements:

- every bolt has explicit `id`, `xM`, `yM`, `zM`;
- all bolt coordinates lie in one z plane;
- bolt ids are unique;
- the caller supplies a non-empty `frameId`;
- bolt coordinates and all load-resultant quantities are expressed in that same local Cartesian frame;
- no global-to-local rotation is performed by this P3 API.

The wrapper accepts asymmetric non-collinear bolt patterns. Collinear or near-collinear groups fail closed through the existing kernel conditioning check.

## Six-DOF load/resultant contract

Every load case requires explicit:

```text
forceN.x
forceN.y
forceN.z
momentNm.x
momentNm.y
momentNm.z
referencePointM.x
referencePointM.y
referencePointM.z
```

Omitted components are invalid rather than silently assumed zero.

The moment is transported from the declared load reference point to the bolt-group centroid using rigid-body statics:

`M_centroid = M_reference + (r_reference - r_centroid) x F`

The transported resultant is then supplied to the existing linear rigid-plate/equal-bolt-stiffness kernel.

## Per-bolt outputs

For each case the wrapper reports:

- original bolt point in the declared frame;
- bolt coordinate relative to group centroid;
- signed external axial force;
- x/y shear force;
- shear resultant;
- geometry conditioning terms;
- applied/recovered six-DOF resultant and equilibrium residuals at the bolt-group centroid.

The multi-case API additionally returns per-bolt envelopes for:

- maximum signed external axial force;
- minimum signed external axial force;
- maximum absolute external axial force;
- maximum shear resultant;
- governing case id for each envelope quantity.

## Preload / external-load boundary

P3 deliberately does **not** calculate final bolt tension by adding external axial force directly to assembly preload.

The API returns:

```text
preloadCombination.state = NOT_MODELED
preloadCombination.preloadCombinationPermitted = false
preloadCombination.directExternalAxialIncrementPermitted = false
```

A qualified bolt/joint stiffness model, contact/separation treatment and preload-loss model are required before preload and external loading can be combined physically. This prevents the reference rigid-plate distribution from being misused as a joint-stiffness calculation.

## Model assumptions retained from the kernel

- rigid plate;
- equal bolt axial/shear stiffness;
- signed external axial force is not clipped for separation/contact;
- no joint-friction load sharing;
- no slip model;
- no prying;
- no plate flexibility;
- no nonlinear contact.

## Authority boundary

```text
method authority           REFERENCE_KERNEL_ONLY
codeCompliance             false
designAuthority            false
governingEligible          false
preload combination        NOT_MODELED
real master-data authority not required by this geometry-only leg
```

P3 does not register this array/geometry method through the current scalar Engineering Calculations registry. A future registry extension should expose an explicit geometry/array contract rather than encoding bolt coordinates or load-case arrays into scalar fields.

## Validation target

Focused execution:

```bash
node --test \
  tests/bolt-group-loads.test.mjs \
  tests/bolt-group-assessment.test.mjs
```

The new assessment suite covers centroid equivalence, reference-point transport in-plane and out-of-plane, asymmetric six-DOF equilibrium, load-case envelopes, the preload-combination boundary, planarity, degeneracy, duplicate case identity and incomplete six-DOF inputs.
