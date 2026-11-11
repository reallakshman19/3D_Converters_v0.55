# EF-05 instrument modeling suggestions — optional review

The original EF-05 XML contains **14** consecutive same-reference INST Endpoint 1→2 spans, each 305 mm long. Their source `Rigid` property is blank, so the source does not establish that these are rigid elements. The original `Weight=0` does **not** mean 0 kg was accepted.

## Nonblocking workflow

The 14 instrument entries are **recommendations only**. No approval, documentary evidence, complete instrument classification, or extra Run-stage screen is required to view them, leave them pending, or continue ordinary Weight Match work. The read-only verified Worker returns `XML229.OptionalInstrumentModelSuggestions.v1`; it never sets `Rigid`, approves mass, or changes the basis.

The [optional source-bound manifest](./xml229-ef05-14-instrument-pending-approvals.json) lists each instrument's original branch/node ordinals, component reference, endpoints, dimensions and pending choice. It can be used with `converters/scripts/xml229_instrument_source_revision.py`:

```bash
python3 converters/scripts/xml229_instrument_source_revision.py inspect \
  --source Benchmarks/EF-05-PRO.TEST.xml \
  --manifest instrument-suggestions.json

# Optional: edit classification on any subset to RIGID, KEEP_SOURCE
# or leave PENDING; no approver name or evidence file is required.
python3 converters/scripts/xml229_instrument_source_revision.py apply \
  --source Benchmarks/EF-05-PRO.TEST.xml \
  --manifest instrument-suggestions.json \
  --revised-source selected-source.xml \
  --receipt selection-receipt.json
```

**No selection** preserves the exact original source bytes. Choosing a subset changes `Rigid=2` only on the selected existing instrument's Endpoint 2 and creates a separately hashed source revision; unselected components are untouched. The receipt records which choices were made and explicitly states that engineering approval is **not** verified and kilograms are **not** accepted. Evidence paths and hashes are optional; when supplied, their contents are checked.

A source revision selected by the user gets a new weight basis because its geometry classification actually changed, not because of a new approval gate. The previous source's accepted kilograms are not silently applied to changed source geometry. The existing XML-only conversion route remains available without instrument approvals.

## Native CII truthfulness

Recommendations and engineering weight acceptance are separate. A recommendation is not an actual physical mass. When a native CII conversion claims **fully verified mass fidelity**, existing source-to-final owner, applied kg, and independently read emitted CII mass checks still apply. Unmodeled instruments cannot be reported as having a reconciled RIGID mass merely because a suggestion exists; use the XML-only/non-governed route when appropriate. No automatic stiffness assumption, kilogram fabrication, or unreported loss of mass is authorized.

This document is operational guidance, not a mandatory engineering sign-off checklist. The 14 pending entries are not release credentials.
