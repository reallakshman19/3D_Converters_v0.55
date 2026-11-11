# R01/1.0 — Structured JSON root profiles (claim C1_ROOT)

**Governing child:** [#1052](https://github.com/reallaksh19/3D_Converters/issues/1052). **Programme:** [#1042](https://github.com/reallaksh19/3D_Converters/issues/1042). **V3.2 released proposal:** `sha256:a52f221e3ba736fe2f76c203ce5608b8b8fb612daa067f9d84958ceab8e11c9d`. **Scope:** this is an additive source-classification/capability contract; no adopter is rewired here.

## API and exact behavior

`inspectStructuredJsonRoot(root)` inspects a **root descriptor**. It does not read files, parse complete text, allocate a full DOM, traverse children, normalize the input, reinterpret unit geometry, or mutate original source. R03 owns raw bytes, R04 token boundaries / duplicate-key detection, R05 full occurrence index and R06 worker isolation.

**Returned structural facts:** immutable `{schema:'lfj-root-profile/v1', profileId, rootKind, rootKey, rootPath, capabilities, rightsBasis:'STRUCTURAL_INSPECTION_ONLY'}`.

| Source root | Root kind | Source path | Eligible profile |
| --- | --- | --- | --- |
| `[ {type:'BRANCH',children:[...]}, ... ]` | array | `$` | staged-generic/v1 |
| `{hierarchy:[...], ...unknownFields}` | hierarchy | `$.hierarchy` | staged-generic/v1 unless rich-markup declared |
| `{objects:[...]}` | objects | `$.objects` | staged-generic/v1 |
| `{branches:[...]}` | branches | `$.branches` | staged-generic/v1 |
| `{type:'BRANCH',children:[...]}` | typed-single | `$` | staged-generic/v1 |
| `{schema:'inputxml-managed-stage/v1',profile:'AVEVA_JSON_FOR_3D_RVM_VIEWER',converter:'INPUTXML->STAGEDJSON',converterSchema:'inputxml-direct-managed-stage/v2-rich-topology',units:{length:'mm'},hierarchy:[...]}` | hierarchy | `$.hierarchy` | managed-stage-markup-rich/v2 |

**Important non-equivalence:** a shape-compatible JSON object is not automatically a 3DMarkupTool engineering source. Its specialized `profile/converterSchema/units` are independent rights. Even an identified strict markup input returns `read/index/view=true;edit/export=false`. R19 owns independent RVM/ATT output acceptance; R16–R17 own XCU Draft Edit/export. This R01 metadata is NOT authority to initiate editing, compilation, remote API execution, geometry conversion or full-file export.

Typed rejection codes: `UNSUPPORTED_ROOT`, `AMBIGUOUS_ROOT`, `UNSUPPORTED_SCHEMA`, `UNSUPPORTED_PROFILE`, `CONVERTER_MISMATCH`, `UNITS_MISMATCH`, `INCOMPATIBLE_PROFILE`, `EMPTY_RICH_HIERARCHY`. Do not catch and replace errors with empty collections. Root `hierarchy/objects/branches` only match own source properties, not inherited keys.

## Source custody and independent baseline table

| Source / exact revision | Evidence observed | Qualification boundary |
| --- | --- | --- |
| [3D_Converters contract](https://github.com/reallaksh19/3D_Converters/blob/8ffe6a12c99825c60a8a9dc9471b8626d4627158/contracts/stagedjson-contract.js), blob `0ea59572ec932f1d3d54caa5b4a85b9b6f94da3e` | Exact fetched legacy implementation executed on array/branches/dual/unsupported schema/mismatched markup units; [RED evidence](https://github.com/reallaksh19/3D_Converters/issues/1052#issuecomment-6058348442) | The old normalizer's failures are RED **against new R01 requirements**, not blanket defects under its original limited contract |
| [XML_Compare_Utilities staged core](https://github.com/reallaksh19/XML_Compare_Utilities/blob/2e588a5469f463b177990d7f8683deb56ce48a0e/workbench3d/core/staged-json-core.js) | Source-level accepts `hierarchy`, `branches`, `objects`; unsupported root may yield zero branches | **Entire 1,108,586-character owner-repository source replayed**, original bare-array root with 23 entries, `staged-generic/v1`, exact first/last object identity preserved; inspection rights only; **no XCU engineering-output golden accepted** on current checkpoint |
| [3DMarkupTool actual BM_CII JSON](https://github.com/reallaksh19/3DMarkupTool/blob/2b2dd60d61f4eb039de7de7d82d58ca3cffca0da/src/BM_CII_INPUT_managed_stage.json), Git blob `0f622b688940bc4e4b677a3a94701123bd3829ce` | **Actual 269756-character source** parsed and passed through exact fetched R01 source in V8: `11` original top fields; `hierarchy` length `1`; recognized strict markup rich profile; source root JSON string unchanged; no edit/export capability granted | This is **real checked-in source**, not an independently signed RVM/ATT output golden; it is not 30 MB responsiveness evidence |
| [3D_Converters ATTRIBUTE staged input](https://github.com/reallaksh19/3D_Converters/blob/main/Benchmarks/Managejson%20to%20Input%20XML/ATTRIBUTE_managed_stage.json), blob `4183d5853fde74787dc180bda49f55d5b3479d57` | **Entire 10,539,386-character owner-repository source replayed**, original bare-array root with 270 top-level entries, `staged-generic/v1`, first/last object identities preserved; inspection rights only; **not an LFJ streaming, responsiveness or export golden** | Complete current source fetched by exact Git blob SHA and replayed through the pure R01 classifier; no independent engineering-output golden claimed |
| [XCU 1885 staged benchmark](https://github.com/reallaksh19/XML_Compare_Utilities/blob/main/Benchmark/ATTRIBUTE_managed_stage_1885_Steam.json), blob `9e192a074614f40597b164321aabd94be49c70cf` | File source identity observed | Full current bytes unavailable in connector replay; no current independent parser golden claimed |

## Reproduce RED/GREEN on exact source head

```bash
# The same authored assertions intentionally fail against the existing legacy normalizer.
LFJ_R01_LEGACY_RED=1 node --test lfj/contracts/profiles/root-profile.test.mjs

# A passing result is possible only against the newly introduced root-profile module.
node --test lfj/contracts/profiles/root-profile.test.mjs
```

The test harness falls back to the legacy contract **only when** `root-profile.mjs` does not exist, to preserve test-first RED history. A syntax/import error in an existing candidate is NOT silently suppressed. Once this module exists, unqualified default import fallback cannot hide defects; the legacy behavior is separately reproducible via the explicit `LFJ_R01_LEGACY_RED=1` flag.

Source cases include all five root variants; strict marked profile; source envelope/unknown field preservation; unknown/future profile and converter rejection; mm units; ambiguous root; invalid scalar; inherited fake envelope; deny edit and export. The original source-control revisions and intentional synthetic fixture labels are above.

## Unresolved before full child acceptance

- **All three owner-repository checked-in JSON roots have now been replayed from their exact full Git blobs.** This confirms root-profile classification only, not recursive occurrence census or independent source-to-output engineering goldens. The real 10.54 MB parse occurred OUTSIDE LFJ via native `JSON.parse` solely for R01 source inspection and cannot count as streaming/worker qualification.
- Node hosted exact-head output must be recorded as test evidence; code-level direct V8 checks are only one dimension of validation.
- R01 recognizes object root **descriptors**; it is **not yet a large-file tokenizer**. Duplicate raw textual keys, UTF-8 boundaries, whole-file source custody, structural paging, cancellation and memory limits are the sole responsibilities of R03–R09.
- R19 independent RVM/ATT, R16–R17 XML Draft full-source export, and R18 actual populated 30/90 MB reference-hardware gates remain open.

**Next:** finish current hosted Node/self-review and source/doc parity; on qualification publish exact-head TASK_EVIDENCE. Do not merge until authorized.

## Token-derived AST-free RootFacts seam (subsequent R01 unit)

`inspectStructuredJsonRootFacts(facts)` accepts the **shallow** descriptor consumed by the future R04 byte tokenizer. This is an alternative source-facts input to the original `inspectStructuredJsonRoot(parsed)`, not a new authority. Both call the **same** root-profile metadata classifier and return the unchanged `lfj-root-profile/v1` structural classification / `STRUCTURAL_INSPECTION_ONLY` rights. [Token facts source and independent parity/negative tests](./root-facts.test.mjs).

```js
{
  schemaVersion: 'lfj-token-root-facts/v1',
  rootType: 'object',
  complete: true, duplicateRootKeys: false,
  fields: {
    schema: { type: 'string', value: 'inputxml-managed-stage/v1' },
    profile: { type: 'string', value: 'AVEVA_JSON_FOR_3D_RVM_VIEWER' },
    converter: { type: 'string', value: 'INPUTXML->STAGEDJSON' },
    converterSchema: { type: 'string', value: 'inputxml-direct-managed-stage/v2-rich-topology' },
    units: { type: 'object', fields: { length: { type: 'string', value: 'mm' } } },
    hierarchy: { type: 'array', count: 2 }
  }
}
```

A bare array uses `{rootType:'array',rootCount:N,complete:true,duplicateRootKeys:false}`, not a fabricated `Array(N)`. A typed singleton uses `fields.type:{type:'string',value:'BRANCH'}` and `fields.children:{type:'array',count:N}`. The R04 lexer is responsible for deriving these counts and literal scalar values from **exact R03 bytes**, reporting unknown/invalid UTF-8, malformed JSON and duplicate raw keys, and setting `complete:true` **only after complete document closure**. R01 itself cannot authenticate a caller's assertion of `complete` and is therefore never an engineering acceptance token.

**Fail closed:** declared but non-array `hierarchy`, `branches` or `objects` root envelopes reject `INVALID_ROOT_ENVELOPE` in both parsed-root and shallow-token paths, even when another valid envelope is present; simultaneous valid envelopes reject `AMBIGUOUS_ROOT`. Malformed field descriptors, missing completeness declaration or scalar types reject `INVALID_ROOT_FACTS`, `complete:false` rejects `INCOMPLETE_ROOT_FACTS`, `duplicateRootKeys:true` rejects `DUPLICATE_ROOT_KEY`; known strict managed-stage incompatible schema/converter/units or empty rich hierarchy retain their legacy typed refusals.

**Acceptance scope:** independent `root-facts.test.mjs` tests cover parity for array/hierarchy/objects/branches/typed singleton and strict RVM profile, negative root/descriptor states and rights refusal. Exact-head Node hosted qualification is required. R04 and R05 do NOT yet exist; real-token-generated descriptors, source-coordinate spans, complete occurrence counts, source-to-output goldens and populated 30MB performance remain entirely unqualified.
