# PR740 workreport — P7 explicit preload uncertainty envelope

## Assignment

Implement the narrow P7 follow-on admitted by PR #739: an explicit-input preload uncertainty envelope that does not create method-specific scatter defaults or predictive sequence-interaction physics.

## Grounding

- main remains `78b361d1f649d41378f568ebe1a237c4bc140c73`;
- base PR #739 head is `9ba02156839442d70c84bb6ccdc4ba6bfe1967eb`;
- material source/test head is `7cf121c66347b3b99d2b69516ac6fd8af9142aa9`;
- P6/P4/P3/P2 exact native validation obligations remain unresolved;
- P5 remains blocked by unchecked/unqualified source equations.

## Material change

New production file:

`converters/engineering-calculations/bolts/preload-uncertainty.js`

Method:

`BOLT.PRELOAD.UNCERTAINTY.EXPLICIT_BOUNDS`

The helper requires explicit assembly-method, sequence and uncertainty-basis identifiers plus explicit per-bolt minimum/target/maximum preload bounds. It validates ordered nonnegative bounds, preserves asymmetric per-bolt ranges, and sums simultaneous extrema to the joint clamp envelope.

It deliberately does not infer probability, RSS combination, elastic interaction, sequence effects, tool/friction scatter, gasket relaxation, tensioning loss or residual torsion.

## Focused regression

New test:

`tests/bolt-preload-uncertainty-envelope.test.mjs`

Coverage includes deterministic clamp sums, asymmetric bounds, descriptive bound widths, required provenance metadata, no hidden bound defaults, invalid/negative bounds, duplicate bolt IDs, explicit non-modeling flags and non-authorizing authority flags.

## Validation

Exact GitHub blobs were reconstructed locally and checked against their Git blob SHA values before execution under Node `v22.16.0`:

```text
source blob  5d327e4f87513e0edb35cc37167656fff76f1684
 test blob   ee847c549287fc6353885cc2767ee4c51089618f
focused tests 10
pass          10
fail           0
classification PASS / SOURCE_RECONSTRUCTED_EXACT_GITHUB_BLOBS
```

Physical lines:

```text
preload-uncertainty.js                   123
bolt-preload-uncertainty-envelope.test    98
```

Exact native PR-head checkout: `NOT_RUN / ENVIRONMENT_BLOCKED`.

GitHub PR-head workflow runs at the pre-relay documentation head: `0`.

Native backup command: `NOT_RUN / CONNECTOR_ONLY_ENVIRONMENT`.
Connector pre-edit relay copy: `EVIDENCE_ONLY` at `.backups/connector-20260905-p7-envelope/agents_agentchain_before_ep0029.md.bak`.

## Authority boundary

```text
sourceAuthority          EXPLICIT_INPUT_BOUND_ONLY
probabilisticInterpretation false
predictsElasticInteraction false
predictsSequenceEffects  false
codeCompliance           false
canUseForDesignAuthority false
governingEligible        false
centralRegistry          NOT_REGISTERED
```

## Disposition

Draft PR #740. No merge authority is assumed. EP-0029 is the controlling relay checkpoint for this leg.
