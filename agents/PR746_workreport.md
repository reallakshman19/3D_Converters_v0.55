# PR746 workreport — P8 controlled flange-face binding source register

## Mission

Define the controlled project-source custody contract required by EP-0034 before any automatic `FlangeFaceBinding.v1` producer can be admitted.

## Grounding

```text
main       78b361d1f649d41378f568ebe1a237c4bc140c73
base PR    #745
base head  6d92e7937a392fa6434b25ac093a3e99cdb61bf5
PR         #746
```

PR #745 remains open/draft/unmerged. This work does not change the earlier native validation states.

## Delivered

### Source-custody helper

Added `converters/engineering-calculations/flange/flange-face-binding-source-register.js`.

Named exports:

- `FLANGE_FACE_BINDING_SOURCE_REGISTER_SCHEMA`
- `FLANGE_FACE_BINDING_SOURCE_RECORD_SCHEMA`
- `FLANGE_FACE_BINDING_SOURCE_AUTHORITY`
- `FLANGE_FACE_BINDING_SOURCE_RECORD_STATES`
- `sealFlangeFaceBindingSourceRecord(source)`
- `createFlangeFaceBindingSourceRegister(input)`
- `validateFlangeFaceBindingSourceRegister(register)`

The helper is 230 physical lines.

### Required source semantics

Every source record must explicitly carry:

- project, record and revision identity;
- model ID, exact model revision and global frame;
- SI length unit `m`;
- exact `rvm-converter-stage/v1` source identity;
- explicit `PHYSICAL_FLANGE` role;
- joint/component identity;
- selected calculation face and port identity;
- mating-side identity;
- flange-face reference point in the global frame;
- positive local opening direction;
- pinned `Advanced_Analysis` repository and commit;
- interface-set, interface and frame semantic hashes;
- reporting sign convention;
- provenance IDs for each engineering semantic declaration;
- explicit ambiguity and position/orientation tolerance policy.

The register does not choose these values from geometry or topology.

### Ambiguity boundary

```text
identityPolicy             EXACT_IDENTIFIERS_ONLY
ambiguityDisposition      UNAMBIGUOUS_REQUIRED
candidateCount             1
positionToleranceM         explicit input >= 0
orientationToleranceRad   explicit input >= 0
toleranceSourceId          required
```

There are no hidden tolerance defaults.

### Semantic custody

Record semantic hashes use the strict canonical JSON / FNV-1a 64-bit helper already pinned for the `Advanced_Analysis` integration. A stale non-empty record hash is rejected. Duplicate record IDs are rejected by register validation.

## Authority boundary

```text
sourceAuthority          PROJECT_SOURCE_CUSTODY_ONLY
automaticBindingProducer false
codeCompliance           false
designAuthority          false
governingEligible        false
```

Record states describe project-source control only and do not constitute design authority.

## Validation

Exact GitHub blob custody:

```text
source  9254991c257b04bb26c15dc69d92cfcbf63660a5
test    342387a1489936eb366d11d508b465c1a4980cb1
```

Focused test coverage includes deterministic sealing, non-authorizing register creation, physical-flange/source-schema enforcement, pinned analysis revision, explicit face/port/mating identities, single-candidate ambiguity, explicit non-negative tolerances, stale hashes, duplicate IDs and absence of binding production.

Execution truth:

```text
source/test blob custody       PASS
focused test execution         NOT_RUN / ENVIRONMENT_BLOCKED
exact native PR-head checkout  NOT_RUN / ENVIRONMENT_BLOCKED
independent engineering review NOT_RUN
native backup command          NOT_RUN / CONNECTOR_ONLY_ENVIRONMENT
connector pre-edit backup      EVIDENCE_ONLY
```

Exact focused gate:

```bash
node --test tests/flange-face-binding-source-register.test.mjs
```

## Remaining hard stop

No real project `FlangeFaceBindingSourceRecord.v1` is included or admitted. Automatic binding production remains blocked until a real controlled record is supplied and independently reviewed. A later producer must verify the controlled record against the actual model and `Advanced_Analysis` objects before it may return a `FlangeFaceBinding.v1`.

No merge authority is assumed.
