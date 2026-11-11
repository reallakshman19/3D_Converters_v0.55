# P7 explicit preload uncertainty envelope

## Purpose

This helper provides a narrow non-authorizing representation of preload uncertainty after the P7 source review established that the available Abid/Khan paper supports the importance of scatter and elastic interaction but does not justify a universal predictive scatter or sequence-interaction model.

The calculation therefore accepts explicit per-bolt lower, target and upper preload bounds supplied by the caller or project basis. It does not infer those bounds from torque-control method, bolt size, tightening sequence, friction, tool class, tensioning method or the study-specific numerical results in the paper.

## Method

Method ID:

`BOLT.PRELOAD.UNCERTAINTY.EXPLICIT_BOUNDS`

Required metadata:

- `assemblyMethodId`;
- `sequenceId`;
- `uncertaintyBasisId`.

Required for every bolt:

- unique `boltId`;
- `minimumPreloadN >= 0`;
- `targetPreloadN > 0`;
- `maximumPreloadN >= 0`;
- ordered bound `minimum <= target <= maximum`.

The helper retains the asymmetric per-bolt bounds and reports descriptive deviations and ratios. The joint clamp envelope is the arithmetic sum of the simultaneous explicit bolt extrema:

```text
minimumClamp = sum(minimumPreload_i)
targetClamp  = sum(targetPreload_i)
maximumClamp = sum(maximumPreload_i)
```

This is a deterministic bounding operation only. It is not an RSS combination, probability distribution, confidence interval, tolerance stack derived from independent random variables, or elastic-interaction prediction.

## Explicit non-modeling boundary

The helper does **not** predict:

- elastic interaction between bolts;
- tightening-sequence effects;
- tool scatter;
- friction or nut-factor scatter;
- gasket compression/relaxation effects;
- hydraulic tensioning transfer loss;
- residual installation torsion;
- operating-state preload loss.

Assembly-method, sequence and uncertainty-basis identifiers are provenance metadata only; they do not select hidden rules.

## Authority

```text
sourceAuthority          EXPLICIT_INPUT_BOUND_ONLY
probabilisticInterpretation false
codeCompliance           false
canUseForDesignAuthority false
governingEligible        false
```

The helper is intentionally not registered in the central scalar Engineering Calculations registry. It contains array-valued bolt data and remains a low-level reference utility until project-controlled assembly criteria and a product/API integration path are qualified.

## Validation

The exact GitHub source and focused test blobs were independently reconstructed and verified by Git-blob SHA before execution under Node `v22.16.0`:

```text
source blob  5d327e4f87513e0edb35cc37167656fff76f1684
 test blob   ee847c549287fc6353885cc2767ee4c51089618f
focused tests PASS 10/10
```

Classification: `PASS / SOURCE_RECONSTRUCTED_EXACT_GITHUB_BLOBS`.

Exact native PR-head execution remains a separate gate and must not be inferred from the reconstructed execution.
