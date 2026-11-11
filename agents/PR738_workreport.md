# PR738 Workreport — P6 GRE Equivalent-Pressure Screening Reference

## Mission

Implement the formula-qualified `FLANGE LEAKAGE CHECK GRE.xls` chain as a bounded, non-authorizing equivalent-pressure screening reference.

## Grounding

- main: `78b361d1f649d41378f568ebe1a237c4bc140c73`
- stacked source qualification: PR #737
- P4 benchmark: PR #734, exact native execution `NOT_RUN`
- P5: `BLOCKED_UNCHECKED_SOURCE_AND_EQUATIONS`
- latest relay: EP-0027

## Delivered

`converters/engineering-calculations/flange/legacy-gre-equivalent-pressure.js` implements explicit-SI bending and axial equivalent-pressure terms, total equivalent pressure, factored qualified-pressure comparison, utilization/margin, and a multi-case governing envelope.

No source factors are hidden as defaults: qualified-pressure multiplier and part-factor decomposition require explicit caller input.

## Validation

Exact GitHub source/test/fixture blobs were reconstructed locally and executed under Node `v22.16.0`:

```bash
node --test \
  tests/flange-legacy-gre-equivalent-pressure.test.mjs \
  tests/flange-legacy-gre-equivalent-pressure-workbook-rows.test.mjs
```

Observed:

```text
tests 23
pass  23
fail   0
```

Classification: `PASS / SOURCE_RECONSTRUCTED_EXACT_GITHUB_BLOBS`.

GitHub Actions returned zero pull-request-triggered runs for material head `208fa7b194b326c2ab6769ace87aefb24cd4f552`, so exact native PR-head execution is `NOT_RUN / ENVIRONMENT_BLOCKED`.

## Authority and model boundary

```text
sourceAuthority               SCREENING_REFERENCE_ONLY
physicalLeakRateEvaluated     false
gasketContactStressEvaluated  false
flangeSeparationEvaluated     false
codeCompliance                false
canUseForDesignAuthority      false
governingEligible             false
controlledMemoBasis           UNRESOLVED
```

The workbook's referenced memo `KRO/604201v0` remains absent from the controlled package. No manufacturer/project applicability is inferred.

## Backup truth

Before changing the mutable chain index, an exact connector-side copy was stored at:

`.backups/connector-20260904-p6/agents_agentchain_before_ep0027.md.bak`

The required native `node utils/backup.js save ...` command cannot be executed in the connector-only environment and remains `NOT_RUN`; the connector copy is evidence only.

## Next gate

Exact PR-head execution of the two focused P6 suites is required before central registration or product exposure. Further gasket contact/separation calculations additionally require controlled gasket/project criteria not currently qualified.
