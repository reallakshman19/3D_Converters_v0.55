# WIP-XMLCII-C5M-20260818 — Material-only incremental Preview engine

## State

```text
BASE_MAIN = 1d9340248b11569f7c7c4f02ac429c7d8c66ff81
BRANCH = agent/xml-cii-c5-material-incremental-engine-20260818
WORK_TYPE = NEW_PR / ENGINE_ONLY
INTEGRATION = BLOCKED_BY_PR613
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
WORKERS = NOT_ADMITTED
```

## Mission

Implement the dependency decision/recompute engine for the next C5 slice without touching the active C6b Preview-custody files owned by PR #613.

The production trace proves `applyPreviewMaterialCodeAuthority()` rewrites `branchRows` and preserves `nodeRows` by identity. Therefore Material-master-only recomputation can be admitted only when every other authority input is unchanged.

## Production scope

Exactly one existing production file:

```text
tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-incremental.js
```

No #613-owned file is modified. In particular this branch does not touch:

```text
xml-cii-adapted-preview-dryrun.js
xml-cii-adapted-preview-dryrun-core.js
xml-cii-adapted-preview-bore-wall-authority.js
xml-cii-adapted-preview-rating-authority.js
```

## Admission rule

Material-only mode requires:

```text
source XML                         identical
StagedJson                         identical
Weight config                      identical
all config except weight and
  material.mapRows                 identical
material.mapRows                   changed
reapplyMaterial callback           available
callback result                    cacheable
callback nodeRows identity         identical to previous nodeRows
```

Any violation falls through to the existing full Preview path.

This means changes to Material fuzzy policy, Material field mapping, overrides, Line List, Piping Class, support/general config, source XML, StagedJson, or Weight are not admitted as Material-only changes.

## Implementation

New signatures:

- `previewMaterialMapRowsSignature(config)` — only `material.mapRows`;
- `previewMaterialInvariantConfigSignature(config)` — entire config except separately versioned `weight` and `material.mapRows`.

Existing Weight-only basis remains unchanged through `previewNonWeightConfigSignature()` and `previewWeightConfigSignature()`.

`buildIncrementalPreview()` gains optional `reapplyMaterial(previousResult, config)`:

- if only Material map rows changed, invoke it;
- require valid `{branchRows,nodeRows}`;
- require `result.nodeRows === previous.result.nodeRows`;
- record Material-only counts;
- otherwise fail closed to `fullBuild()`.

Legacy snapshot shape is preserved until Material-only metrics are non-zero, so the landed C5a exact first-build assertion remains compatible.

## Backup custody

Pre-edit current-main production blob:

```text
50ee2eb511a4f18f72d47ec1cf3b257e8775980c
```

Exact retained backup:

```text
.backups/C5M_tabs_xml_cii_2019_standalone_ui_adapted_xml_cii_adapted_preview_incremental_js.bak
```

The connector session cannot truthfully claim native execution of `node utils/backup.js`; the backup was materialized before the production edit and is intended to be verified by Git blob identity.

## Qualification

Committed real-authority regression:

```text
tests/xml-cii-standalone-preview-incremental-material.test.mjs
```

It covers 7 Material-specific gates:

1. only `material.mapRows` excluded from invariant signature;
2. Material-only result deep-equals a fresh full Material-authority result;
3. `nodeRows` preserved by identity;
4. Material fuzzy-policy change => full;
5. simultaneous Weight + Material change => full;
6. XML/StagedJson change => full;
7. callback failure or node-row replacement => full.

Repository-native execution of that real-authority test: `NOT_RUN / ENVIRONMENT_BLOCKED`.

Reconstructed Node evidence using the exact modified incremental engine:

```text
node --check engine                         PASS
landed C5a Weight-only contract             5/5 PASS
Material engine admission/fail-close        4/4 PASS
combined reconstructed execution            9/9 PASS
```

Evidence class: `LOCAL_RECONSTRUCTED / IMPLEMENTATION_COUPLED`. No reconstructed execution is represented as repository-native qualification.

Static production evidence from current main:

`applyPreviewMaterialCodeAuthority()` maps `branchRows` and spreads the existing result, so `nodeRows` remains the same reference. The committed real-authority test additionally pins this invariant.

## Integration after #613

PR #613 changes source-DOM custody but retains the same incremental boundary in `xmlCiiDryRunPreview()`. After #613 is landed, the clean integration delta is intended to be only:

```js
reapplyMaterial: (result, nextConfig) =>
  applyPreviewMaterialCodeAuthority({ config: nextConfig, result })
```

That wiring must be implemented from then-current `main`, backed up, and qualified against fresh full Preview output. It is deliberately not stacked on #613 here.

## Coordination

- #611: no production overlap.
- #613: integration owner; no file overlap in this engine-only PR.
- #616: no production overlap.
- #614: validation-only; it exercises the incremental engine and should be re-run/re-ground after this engine lands.
- Workers remain NOT_ADMITTED pending real browser/main-thread evidence.

## Next gate

Open as DRAFT. Do not merge without explicit owner authorization. Land/re-ground #613 before creating the tiny Material integration PR from current main.
