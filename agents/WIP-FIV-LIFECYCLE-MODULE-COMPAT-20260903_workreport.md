# FIV lifecycle module compatibility work report

## Symptom

Flow-Induced Vibration Screening failed before rendering with:

`The requested module '../converters/vibration/project/schema.js' does not provide an export named 'vibrationProjectLifecycleLedgers'`

## Root cause

Current main does provide the post-PR720 lifecycle exports. The failure class is browser module-version skew: a cached pre-PR720 unversioned `schema.js` can be linked by newer lifecycle consumers. Named ESM imports then abort the module graph before application-level fail-closed handling can run.

## Repair

- Cache-bust the lifecycle project schema import at the compatibility boundary.
- Use a namespace import so missing newer exports do not cause ESM link-time failure.
- Resolve lifecycle APIs at invocation.
- If a stale schema truly lacks a required lifecycle API, fail closed with `VIBRATION_PROJECT_SCHEMA_LIFECYCLE_API_UNAVAILABLE` rather than synthesizing lifecycle data.

## Authority

This is module-loading/persistence compatibility only. No FIT equations, thresholds, method revisions, screening authority, design authority, lifecycle ledger semantics, or project schema shape changes.

## Validation truth

Changed-file reconciliation: PASS.
Exact-source Node, Chromium, and hosted regression are pending at this checkpoint and must not be represented as PASS until executed.
