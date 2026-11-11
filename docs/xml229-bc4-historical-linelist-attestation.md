# XML229 BC4 historical Line List attestation

This is a read-only hash comparator, **not** a way to approve weights or
generate governed native CII.

The original Owner-private GC-PW backup contains the historical normalized
Line List rows SHA-256, applied fieldMap SHA-256, dataset identity/revision,
and effective Preview configuration hash. It does **not** include the actual
applied fieldMap or normalized master rows.

The version-pinned public BC4 JSON fixture has 385 parsed rows, matching
the historical count but **not** either of the two historical SHA-256 values.

## Owner-local replay

Run from the repository root, without committing or uploading the backup:

```bash
node scripts/xml229-bc4-historical-attestation.mjs \
  --fixture tests/fixtures/xml229/BC4.LineList.json \
  --backup /private/path/xml229-source-bound-gcpw-review.json
```

If the original **applied** Line List fieldMap can be recovered from the
historical browser/IndexedDB or a confidential custody download:

```bash
node scripts/xml229-bc4-historical-attestation.mjs \
  --fixture tests/fixtures/xml229/BC4.LineList.json \
  --backup /private/path/xml229-source-bound-gcpw-review.json \
  --applied-field-map /private/path/lineList-fieldMap.json
```

Exit code **2 = HOLD** (including exact matching Line List content, because
the complete four-master InputBasis and independent mass engineering approval
remain out of scope); **1 = corrupt/invalid evidence**.

No source rows, original private review commands, user-private master
datasets or mapping candidates are sent to GitHub or CI. The public tests
assert that fake backups, same-count tampering and wrong mappings cannot
complete the historical InputBasis or approve any Final/native CII stage.

A manual search of the 20-key current automatic field map against all
one- and two-key column-value changes (plus field deletions), **336,000
candidates**, found **zero** matches to the saved original mapping digest.
This search is only a bounded negative result; it does not prove the original
mapping or workbook differs. Reconstruct rather than guess the original
applied mapping, and compare *both* normalized row and fieldMap digests.

Production release readiness is tracked in Issue #301.
