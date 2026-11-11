# PR #615 Stage 5 — Field Measurement Evidence Custody

## Scope

Stage 5 is a new-file-only, non-numerical measurement evidence contract. It does not implement signal processing, measurement acceptance criteria, screening substitution, RCA conclusions, or UI.

Current neighboring workspace claims remain open (#479 FIT, #506 AIV, #508 SBC, #571 mechanism coverage), so this slice deliberately avoids those paths.

## Source-grounded architecture

The repository deep-research report defines the intended hierarchy:

```text
MeasurementSession
  ├─ OperatingCaseSnapshot
  ├─ InstrumentConfiguration
  ├─ Channel
  │   ├─ Sensor
  │   ├─ Location / orientation
  │   ├─ Calibration
  │   └─ RawTimeSeries
  └─ SignalProduct
      ├─ Overall / RMS / Peak / PeakToPeak
      ├─ FFT / PSD / Order spectrum
      ├─ Phase / Coherence
      ├─ ODS
      └─ Modal result
```

The same source states that raw data should be immutable and that derived products must retain a `processingRecipeId` and version. It also explicitly separates measurements from screening calculation and RCA authority.

## Permanent invariants

```text
MEASUREMENT_EVIDENCE != SCREENING_RESULT
MEASUREMENT_EVIDENCE != ROOT_CAUSE_CONCLUSION
RAW_ACQUISITION_REFERENCE = IMMUTABLE + HASH_PINNED
DERIVED_PRODUCT -> EXACT SESSION + CHANNEL SET + RAW HASH SET + PROCESSING RECIPE/VERSION
```

## V1 contracts

New module:

```text
converters/vibration/measurement/contracts.js
```

Schemas:

```text
VibrationMeasurementSession.v1
VibrationSignalProduct.v1
VibrationMeasurementEvidencePackage.v1
```

### Measurement session

Requires:

- stable `sessionId`;
- exact line/case and operating-case snapshot identity/hash;
- acquisition start time and instrument configuration provenance;
- at least one channel;
- unique channel IDs;
- explicit measured quantity + unit;
- sensor identity;
- physical subject/location + orientation/reference frame;
- calibration identity/provenance and `validAtAcquisition=true`;
- positive sample rate and duration;
- immutable raw artifact reference with SHA-256;
- non-authorizing field-evidence authority metadata.

The contract does not prescribe a specific sensor manufacturer, coordinate convention, filter, sampling rate, or measurement acceptance criterion.

### Derived signal product

Requires:

- stable `productId`;
- exact `sessionId`;
- one or more unique channel IDs;
- controlled product type vocabulary;
- exact input raw-data hash set;
- `processingRecipeId` + version + provenance;
- hash-pinned derived artifact;
- non-authorizing derived-evidence authority metadata.

No FFT, PSD, integration, filtering, order tracking, coherence, ODS, or modal mathematics are implemented in this stage.

### Evidence package

The package validator performs referential integrity:

- unique session and product IDs;
- product session must exist;
- every product channel must exist in that session;
- product raw hash set must exactly match the raw hashes of its referenced channels;
- package authority cannot promote screening/design/root-cause authority.

## Primary falsifiers

1. measurement session missing operating-case snapshot hash -> reject;
2. calibration not valid at acquisition -> reject;
3. raw data marked mutable or without SHA-256 -> reject;
4. derived product missing processing recipe version -> reject;
5. product referencing unknown channel -> reject;
6. product raw hash set not equal to referenced channel raw hashes -> reject;
7. any measurement/product/package authority claiming screening/design/root-cause authority -> reject.

## Acceptance tests

The focused test will freeze:

```text
valid one-channel session
valid multi-channel package with FFT + coherence
missing scenario snapshot hash rejected
invalid calibration rejected
mutable raw evidence rejected
processing recipe identity required
unknown channel rejected
raw-hash mismatch rejected
authority promotion rejected
duplicate IDs rejected
```

## Authority boundary

```text
engineering calculation authority = NONE
screening authority              = NOT_AUTHORIZED
design authority                 = false
root-cause authority             = false
signal-processing qualification  = NOT_ESTABLISHED
```

Stage 5 adds evidence custody only.

## Delivery

- commit the focused test before production contract implementation;
- add only new files for the initial contract slice;
- keep files below the repository 300-line physical limit;
- keep PR615 draft/unmerged;
- repository-native/full/browser gates remain NOT_RUN if unavailable.
