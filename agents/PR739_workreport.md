# PR739 workreport — P7 assembly source qualification

## Assignment

Qualify the owner-supplied Abid/Khan bolted-flange paper for issue #721 P7 without converting study-specific observations into universal engineering defaults.

## Grounding

- base PR: #738, head `a9c4a23b08f4f0dd8eaa286793304b7034b5457f`;
- current main basis remains `78b361d1f649d41378f568ebe1a237c4bc140c73`;
- P6 exact native focused execution remains `NOT_RUN / ENVIRONMENT_BLOCKED`;
- P5 remains `BLOCKED_UNCHECKED_SOURCE_AND_EQUATIONS`;
- earlier P2/P3/P4 native validation obligations remain unresolved.

## Source reviewed

`bolt Paper-65.pdf` — Muhammad Abid and Yasir Mehmood Khan, *The effect of bolt tightening methods and sequence on the performance of gasketed bolted flange joint assembly*, Structural Engineering and Mechanics 46(6), 2013.

The paper is an 8-inch Class 900 nonlinear-FEA study comparing sequential torque control with SC100, SC50 and SC33 stretch-control strategies.

## Engineering findings

The source supports qualitative/model-boundary statements about preload scatter, elastic interaction, bolt bending, gasket contact-stress variation, friction sensitivity, tightening sequence, and torque-vs-stretch control. It also supports retaining target clamp/preload as the primary assembled joint state.

The source does not support universal scatter percentages, generic elastic-interaction coefficients, universal pass/sequence rules, universal tensioning loss factors, reusable gasket criteria, residual-torsion policy, or current project PCC-1 authority.

## Validation labels

```text
source identity review                  PASS
qualitative assembly-behavior mapping   PASS
study-specific benchmark admission      PASS
universal numerical scatter model       FAIL / SOURCE_NOT_SUFFICIENT
sequence-interaction prediction         FAIL / SOURCE_NOT_SUFFICIENT
project assembly authority              FAIL / CONTROLLED_PROCEDURE_MISSING
calculation implementation              NOT_RUN / NOT_ADMITTED
browser validation                      NOT_APPLICABLE
```

Observation and oracle remain separate: study-specific numerical values are retained only as benchmark observations and are not used as project acceptance or solver defaults.

## Repository changes

Material change:

- `docs/engineering-calculations/bolted-joints-p7-assembly-sequence-qualification.md`

Governance/relay changes:

- `agents/agentchain/ENGCALC-BOLTED-JOINTS/EP-0028.md`
- `agents/status/PR739.yaml`
- `agents/claims/PR739.yaml`
- `agents/PR739_workreport.md`
- connector-side pre-edit backup for `agents/agentchain.md`
- mutable chain index advancement to EP-0028.

No production calculator, registry, UI, workflow, test expected value, master data or authority flag is changed.

## Backup truth

The repository-required native backup command could not be executed in the connector-only environment. An exact connector-side pre-edit copy is stored at `.backups/connector-20260905-p7/agents_agentchain_before_ep0028.md.bak`; classify this as evidence only, not policy-equivalent native backup PASS.

## Hard stop

A predictive P7 assembly sequence/elastic-interaction solver is not admitted until a controlled project assembly procedure, applicable PCC-1 revision, target preload range, tool/friction/tensioning uncertainty data, gasket criteria where applicable, residual-torsion policy, approved uncertainty method and independent engineering review are available.

A separate non-authorizing explicit-input uncertainty envelope may be considered because it can require every bound/distribution from the caller/project and introduce no method-specific defaults.

MERGE_AUTHORITY: OWNER_ONLY / NOT_GRANTED.
