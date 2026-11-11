QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: STATE_AUTHORITY_MIGRATION
CHAIN_ID: XMLCII-ISSUE-769
QUESTION_SET_ID: QS-XMLCII-769-MIGRATION-001
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-MIGRATION
QUESTION_SET_STATUS: CURRENT

# Q1 — Destructive vs derived state
Classify persisted state before migration. Imported masters, saved field mappings, support config, and legacy rigid-weight values are source/evidence state and must be preserved. Preview rows, Weight Match rows, rating snapshots, and their cache fingerprints are derived state and may be invalidated.

# Q2 — Legacy rigid-weight custody
Legacy `overrides.rigidWeight` must remain unchanged and identifiable as fallback evidence. Migration must not divide/multiply values, copy legacy values into `rigidWeightMatch1` or `rigidWeightFinal`, or infer whether an old number was already force-scaled.

# Q3 — Versioned invalidation
A single authority-schema marker must make first-load invalidation deterministic and idempotent. It must remove all known/future-version cache keys under the Preview/Weight Match/rating-snapshot prefixes plus the old line-authority marker, then set the current marker. A second call at the same schema must make no destructive change.

# Q4 — Shared authority
Preview and standalone Weight Match must activate the same migration owner. Effective rigid-weight precedence remains owned by `rigid-weight-authority.js`; migration must not duplicate precedence logic.

# Q5 — Negative controls
Preserve `xml-cii-master-*`, `xml-cii-master-source-*`, `xml-cii-saved-mappings-*`, `xml-cii-import-masters-v1`, regex/resolver configuration, and user support-config evidence. Fail if migration clears a master/mapping or performs any numeric rigid-weight correction.