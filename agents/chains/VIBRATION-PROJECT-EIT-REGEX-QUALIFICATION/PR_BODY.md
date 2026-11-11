## Mission

Close the demonstrated hosted lifecycle regression caused by a stale project-EIT assertion string.

## Change

Only `tests/vibration-project-eit.test.mjs` changes: the assertion now matches the current fail-closed runtime message (`does not accept current-result authority records`).

## Authority boundary

No production source, project schema, persistence behavior, calculation behavior, engineering authority, screening authority, design authority, workflow YAML, or numerical behavior changes.

## Validation target

Use the repository-native `Vibration Project V2 Lifecycle Regression` on the exact PR head. Do not promote the PR to release-qualified if other unrelated checks fail.

## Merge authority

OWNER_ONLY / NOT_GRANTED.
