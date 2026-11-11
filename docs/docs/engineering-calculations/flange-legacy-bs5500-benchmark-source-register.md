# Legacy BS5500 workbook benchmark — source register

Calculation source:
`docs/flange/flange design to BS5500.xls`

Formula recovery:
`docs/engineering-calculations/flange-bs5500-workbook-formula-map.md`

Implementation:
`converters/engineering-calculations/flange/legacy-bs5500-workbook.js`

Qualification state: `LEGACY_BENCHMARK_ONLY`

## Source custody

The implementation is derived from the 50 BIFF8 formula records recovered from the owner-supplied workbook. The recovery was independently replayed against the workbook's stored inputs/cached formula results: 50/50 matched within relative tolerance `1e-12`.

The kernel intentionally preserves the workbook's literal numerical constants and recovered branches, including `0.785`, `3.14`, `6.28`, the ring-joint `N/8` effective-width branch, the non-ring-joint `min(bo, 2.52*sqrt(bo))` branch, and the recovered shape-factor coefficient expressions.

## Units and dimensional interpretation

The public API accepts SI quantities. Internally, the calculation reproduces the workbook in its native basis:

- length: mm;
- area: mm²;
- pressure/stress: N/mm²;
- force: N;
- physical applied/calculated flange moment: N·mm.

A dimensional ambiguity found during implementation review is resolved explicitly: the workbook cells corresponding to its stress-calculation `M` are the physical flange moment multiplied by `Cf` and divided by `B`. They therefore have **force units (N)**, not moment units. The API exposes those values as `reducedMomentN`; it does not label them as N·m. This prevents a faithful numerical migration from becoming a dimensional-semantic error.

## Input authority

All geometry, gasket, bolt, allowable-stress and shape-factor values are caller supplied. The source fixture contains legacy material/gasket/bolt values, but those values are not imported as project master data.

No hidden defaults are used for:

- design pressure;
- flange/hub geometry;
- gasket geometry, `m`, or `y`;
- bolt count/diameter/root area;
- bolt operating or ambient allowable stress;
- shape constants `F`, `V`, or stress multiplier `f`;
- externally applied operating moment.

Zero design pressure is permitted because the recovered workbook still has a meaningful bolt-up branch in that state.

## Outputs

The benchmark exposes:

- recovered gasket width/reaction diameter;
- `K/T/U/Y/Z`, `ho`, `e`, and `d` shape quantities;
- pressure loads `H/Hd/Hg/Ht`;
- moment arms `hd/hg/ht`;
- required/actual bolt area and assembly bolt load;
- correction/stress factors;
- operating and bolt-up hub/radial/tangential/combined stresses;
- calculated and total physical operating moment.

It deliberately does **not** evaluate the workbook's final acceptance statement.

## Authority boundary

```text
sourceAuthority          LEGACY_BENCHMARK_ONLY
acceptanceEvaluated      false
codeCompliance           false
canUseForDesignAuthority false
governingEligible        false
```

This kernel is a faithful legacy regression/reference implementation. It is not evidence of current BS5500/PD5500 applicability, Code compliance, allowable-stress authority, or project design acceptance.

## Validation

The focused test suite covers the recovered workbook fixture, both gasket-width branches, physical applied-moment propagation, `Cf` floor and `Cf > 1` behavior, zero-pressure bolt-up behavior, singular `K=A/B` fail-closed handling, dimensional labeling of reduced moment, and non-authorizing flags.

Current executable evidence is source-reconstructed from exact GitHub source/test blob bytes. Exact native PR-head checkout execution remains a separate gate.