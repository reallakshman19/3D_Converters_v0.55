# Bolted Joints / Flanges — P2 Master-Data Custody Contract

Status: `SCHEMA_CUSTODY_ONLY / NO REAL STANDARD VALUES ACTIVATED`

Issue: `#721`

Chain: `ENGCALC-BOLTED-JOINTS`

## Purpose

P2 hardens the existing flange and bolt master-store schemas so that a record cannot be labelled `TRANSCRIBED`, `INDEPENDENTLY_CHECKED`, or `QUALIFIED` without traceable source custody and method-specific engineering identity.

This change does not populate ASME rating tables, moment factors, gasket reaction diameters, material strengths, thread dimensions, friction coefficients, or nut factors.

## Authority ceiling

Both v1 stores retain:

```text
authorityCeiling         ENGINEERING_SANDBOX
interpolationPolicy      EXACT_MATCH_ONLY
canUseForDesignAuthority false
```

`DESIGN_AUTHORITY` remains rejected. A `QUALIFIED` record therefore means its record/source custody is complete enough for later controlled review; it does not make the value design-authorizing through this store.

## State-sensitive provenance

Records below `TRANSCRIBED` retain the existing sandbox workflow. Starting at `TRANSCRIBED`, a source record must identify:

```text
standard
edition
sourceDocument
sourceRevision
sourceSectionOrTable
```

Starting at `INDEPENDENTLY_CHECKED`, both the source and every reviewed dependent master record must also identify:

```text
reviewedBy
reviewDate
```

A dependent record cannot outrank its source:

```text
TRANSCRIBED             <= source TRANSCRIBED
INDEPENDENTLY_CHECKED   <= source INDEPENDENTLY_CHECKED
QUALIFIED               <= source QUALIFIED
```

## Flange custody fields

### Pressure-rating record

At governed custody states the record requires:

```text
standard
standardEdition
nominalSize
pressureClass
series
flangeType
materialGroup
temperatureC
pressureRatingPa
```

`series` must be explicit even where it is not applicable; use an explicit value such as `NOT_APPLICABLE` rather than omitting the engineering distinction.

### Moment-factor record

```text
methodId
methodRevision
flangeType
applicability
momentFactor
```

The factor must be finite and non-negative.

### Gasket-geometry record

```text
gasketGeometryId
gasketType
gasketReactionDiameterBasis
gasketReactionDiameterM
```

The reaction diameter basis is mandatory. The legacy workbook mean-contact-diameter convention therefore cannot become governed `G` merely because a numeric diameter is available.

## Bolt custody fields

### Thread record

```text
threadStandard
standardEdition
nominalDesignation
nominalDiameterM
pitchM
leadM
pitchDiameterM
tensileStressAreaM2
stressSectionDiameterM
```

All geometry/area values must be positive finite numbers.

### Material record

```text
materialSpec
temperatureC
referenceStressBasis
referenceStressPa
```

The store deliberately does not decide whether `referenceStressPa` means yield, proof, allowable, assembly target, or another criterion. That meaning must be explicit in `referenceStressBasis` and separately qualified by the selected assembly/design method.

### Friction-condition record

Identity/provenance fields:

```text
conditionId
finish
coating
lubricant
reuseCondition
temperatureC
frictionBasis
```

A governed friction record must then provide either:

```text
nutFactorMin
nutFactor
nutFactorMax
```

or explicit ordered thread and bearing friction ranges:

```text
threadFrictionCoefficientMin
threadFrictionCoefficient
threadFrictionCoefficientMax
bearingFrictionCoefficientMin
bearingFrictionCoefficient
bearingFrictionCoefficientMax
```

Ranges must satisfy `min <= nominal <= max`; nut factors must be positive and friction coefficients non-negative.

## Fail-closed behavior

The master stores reject:

- missing advanced-state provenance;
- missing independent-review identity on `INDEPENDENTLY_CHECKED` / `QUALIFIED` sources or records;
- advanced records whose source is less mature;
- missing governed engineering identity fields;
- invalid positive/non-negative engineering values;
- incomplete or unordered friction ranges;
- duplicate IDs;
- missing source references;
- any attempt to set `DESIGN_AUTHORITY`;
- any interpolation policy other than `EXACT_MATCH_ONLY`.

The existing resolvers continue to return `canUseForDesignAuthority: false`. Even a fully `QUALIFIED` synthetic/control fixture resolves as `RESOLVED_NOT_AUTHORIZED`.

## Explicitly not included

P2 does not yet provide:

- controlled B16.5/B16.47 pressure-temperature values;
- controlled UG-44 `FM` values;
- a governed Code derivation for gasket reaction diameter `G`;
- real thread-standard dimensions;
- real bolt/nut material strength values;
- project-qualified K/friction ranges;
- project preload fraction or assembly procedure;
- interpolation/extrapolation rules beyond exact-match-only;
- production/design authority.

Those remain gated by the controlled-source package defined in P1.
