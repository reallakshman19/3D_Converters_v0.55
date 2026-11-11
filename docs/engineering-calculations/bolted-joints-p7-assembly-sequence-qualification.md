# P7 assembly sequence, scatter, and uncertainty source qualification

Tracking: issue #721 / `ENGCALC-BOLTED-JOINTS`.

## Purpose

Qualify what the owner-supplied `bolt Paper-65.pdf` actually supports for P7 before any assembly-sequence, preload-scatter, or uncertainty solver is introduced.

This document is a source/admission record only. It does not define a project bolting procedure, preload target, acceptance band, sequence, friction distribution, tensioning loss factor, or design-authorizing uncertainty model.

## Source identity and role

Owner-supplied paper:

- Muhammad Abid and Yasir Mehmood Khan;
- *The effect of bolt tightening methods and sequence on the performance of gasketed bolted flange joint assembly*;
- Structural Engineering and Mechanics, Vol. 46 No. 6 (2013), pp. 843-852;
- DOI 10.12989/sem.2013.46.6.843.

Current authority classification:

```text
sourceRole          ASSEMBLY_BEHAVIOR_REFERENCE
methodAuthority     QUALITATIVE_AND_STUDY_SPECIFIC_BENCHMARK_ONLY
codeCompliance      false
designAuthority     false
governingEligible   false
```

The paper studies an ANSI 8-inch Class 900 gasketed flange using nonlinear finite-element analysis. Its numerical results are therefore study-specific and are not admitted as universal scatter limits or assembly acceptance criteria.

## What the paper supports

The paper directly supports the following engineering statements.

1. Clamp/preload is the primary assembled joint state; torque is an assembly-control method rather than the fundamental joint state.
2. Torque-control tightening one bolt at a time is sensitive to thread/bearing friction and elastic interaction between previously tightened and subsequently tightened bolts.
3. The studied torque-control process exhibited greater bolt-preload scatter than the studied stretch-control strategies.
4. Stretching more bolts simultaneously reduced elastic-interaction-driven preload scatter in the studied model; SC100 eliminated scatter in the reported case, while SC50 and SC33 retained small residual variation.
5. Assembly method and sequence affected bolt bending and gasket contact-stress variation.
6. Torque control introduces bolt torsion during tightening; stretch/tension control is primarily axial in the idealized assembly description used by the paper.
7. Gasket nonlinear compression/unloading behavior contributes to joint relaxation and elastic interaction.
8. Gasket contact limits must come from the applicable gasket/project source rather than from a universal number inferred from this paper.

These statements are admissible as design-of-model guidance and test/benchmark context.

## Study-specific observations retained only as benchmark context

The paper reports, for its modeled 8-inch Class 900 joint, examples including:

- a four-pass torque-control sequence;
- stretch-control cases with 100%, 50%, and 33% of bolts tensioned at a time;
- torque-control final bolt stresses spanning approximately 165 to 208 MPa with an average around 190 MPa;
- SC100 around 202 MPa with essentially zero reported scatter in the model;
- SC50 and SC33 with only small reported stress variation;
- different gasket-stress distributions between tightening strategies.

None of those values is promoted to a default, allowable, uncertainty factor, preload fraction, sequence rule, or project acceptance criterion.

## What the source does not qualify

The paper does **not** provide sufficient controlled authority for any of the following repository behavior:

- a universal torque-control preload scatter percentage;
- a universal hydraulic-tensioner scatter percentage;
- a deterministic elastic-interaction coefficient matrix applicable to arbitrary joints;
- a universal tensioning loss/overpull factor;
- a universal number of tightening passes;
- a universal bolt sequence;
- current PCC-1 project procedure requirements;
- reusable gasket seating/crush limits for arbitrary gasket products;
- operating-state residual installation torsion policy;
- tool calibration uncertainty;
- friction-coefficient probability distributions;
- statistical confidence or reliability targets for project acceptance.

Those inputs require a controlled project assembly procedure, qualified tool/friction data, gasket criteria, and an approved uncertainty policy.

## P7 model boundary selected

The repository may safely proceed with an **explicit-input uncertainty representation**, but not with a predictive sequence-interaction solver derived from this paper alone.

Permitted future P7 behavior:

```text
canonical state       target clamp/preload
uncertainty inputs    explicit caller/project supplied bounds or distributions
assembly method       explicit identity
sequence identity     explicit metadata
friction/K inputs     explicit qualified data only
result authority      non-authorizing until controlled project basis exists
```

Blocked behavior:

```text
infer scatter from assembly method name          BLOCKED
infer sequence loss from the Abid/Khan study     BLOCKED
use SC100/SC50/SC33 study values as defaults      BLOCKED
invent PCC-1 sequence/pass values                 BLOCKED
combine preload with operating external load      BLOCKED pending qualified joint-stiffness/contact model
promote tensioning or torque control to authority  BLOCKED pending project procedure
```

## Minimum controlled package required for a real P7 solver

Before a sequence/interaction or design-authorizing uncertainty model is implemented, obtain and review:

1. project-approved bolted-joint assembly procedure and applicable controlled PCC-1 edition/revision;
2. selected tightening/tensioning method and exact pass/sequence instructions;
3. target preload/clamp definition and acceptable achieved range;
4. tool calibration/tolerance data;
5. qualified K or thread/bearing friction condition data and uncertainty treatment;
6. hydraulic tensioning pressure-to-bolt-load calibration and load-transfer/relaxation policy where applicable;
7. gasket seating/maximum-compression criteria if gasket response participates in acceptance;
8. residual installation torsion policy for operating assessment;
9. approved deterministic/probabilistic uncertainty method and acceptance confidence level;
10. independent engineering review.

## Current P7 disposition

```text
source review                         PASS
qualitative model guidance            PASS
study-specific benchmark admission    PASS
universal numerical scatter model     FAIL / SOURCE_NOT_SUFFICIENT
sequence-interaction prediction       FAIL / SOURCE_NOT_SUFFICIENT
project assembly authority            FAIL / CONTROLLED_PROCEDURE_MISSING
calculation implementation            NOT_RUN / NOT_ADMITTED
browser validation                    NOT_APPLICABLE
```

The FAIL labels above are deliberate source-admission failures, not numerical solver failures.

## Exact next action

Do not create a deterministic sequence-interaction solver from `bolt Paper-65.pdf`. The next safe implementation, if desired before controlled project procedure custody is available, is limited to a separately named non-authorizing **explicit preload/torque uncertainty envelope** that accepts all uncertainty bounds as caller-supplied inputs and introduces no method-specific default scatter values.

P8 3D integration may consume P3 external bolt-group loads and existing reference methods only after its own explicit authority/provenance boundaries are defined; this P7 source note does not close the earlier native validation gates.
