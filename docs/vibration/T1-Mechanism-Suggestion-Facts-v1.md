# T1 Mechanism Suggestion Facts v1

Status: **PROJECT CONTEXT ASSISTANCE ONLY — NOT MECHANISM IDENTIFICATION AUTHORITY**

## Purpose

Vibration Integrity may highlight a small set of likely EI mechanism reviews when an exact facility scope contains an explicit, verified boolean enrichment fact. These suggestions reduce search effort but never establish mechanism applicability.

A suggestion does not become `VibrationMechanismIdentification.v1` evidence. An engineer/reviewer must explicitly author a disposition in the Mechanism Identification workspace.

## Exact enrichment facts

All trigger records use the existing `VibrationEnrichmentCsv.v1` contract and must have:

- exact `Canonical ID`, `Line`, and `Operating Case` matching the facility scope;
- `Value Type = BOOLEAN` and parsed value `true`;
- `Status = VERIFIED`;
- project provenance in `Source` and, when available, `Source Revision`, `Record ID`, and `Reviewer`.

Supported v1 property names are exact and case-sensitive:

| Property | Suggested mechanism | Suggested assessment unit |
|---|---|---|
| `T1_RECIP_PD_EQUIPMENT_PRESENT` | `reciprocatingPulsation` | `MAIN_LINE_SECTION` |
| `T1_ROTATING_EQUIPMENT_CONNECTION_PRESENT` | `mechanicalExcitation` | `MAIN_LINE_SECTION` |
| `T1_DEADLEG_PRESENT` | `deadlegPulsation` | `DEADLEG_BRANCH` |
| `T1_PRESSURE_REDUCING_GAS_SOURCE_PRESENT` | `aiv` | `AIV_SOURCE_ASSESSMENT_PAIR` |
| `T1_SMALL_BORE_CONNECTION_PRESENT` | `smallBoreConnections` | `SBC_CONNECTION` |
| `T1_THERMOWELL_OR_INTRUSIVE_ELEMENT_PRESENT` | `thermowells` | `INTRUSIVE_ELEMENT` |

The app does not infer these facts from tag text, line names, pressure magnitudes, equipment names, fluid phase, geometry, or other free text.

## Authority boundary

Suggestion records have:

```text
identificationAuthority       NONE
automaticApplicabilityRules   false
createsIdentificationEvidence false
countsTowardCompleteness      false
screeningAuthority            NOT_AUTHORIZED
designAuthority               false
```

The v1 UI is display-only. It shows the suggestion, trigger fact, source and suggested assessment unit beside the existing explicit authoring workspace. The engineer/reviewer must use `Add identification row` and author the identification evidence independently. There is no suggestion-apply mutation path, and no suggestion is passed to the identification producer.

## Out of scope

- automatic REQUIRED / NOT_APPLICABLE decisions;
- automatic creation or pre-filling of identification evidence;
- inference from process values or text labels;
- automated root-cause diagnosis;
- numerical screening calculations;
- source-method qualification;
- design authority.
