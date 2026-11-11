# R02 — original occurrence-local Site/Zone ownership (U01–U04 native facts qualified; adopter integration pending)

Governing child [#1064](https://github.com/reallaksh19/3D_Converters/issues/1064), parent [#1042](https://github.com/reallaksh19/3D_Converters/issues/1042), frozen GC-PW/1.0 boundaries [#999](https://github.com/reallaksh19/3D_Converters/issues/999). R02 owns `C1_OWNER=7` of unchanged 130 programme points and writes **only** `lfj/adapters/ownership/`. R01 [#1052](https://github.com/reallaksh19/3D_Converters/issues/1052) is the provider prerequisite. R04 tokenizer [#1062](https://github.com/reallaksh19/3D_Converters/issues/1062) is separately leased, with R05 occurrence index awaiting both.

## Actual downstream-source defect

Current `main` source [xml-cii-json-hierarchy-scope.js](https://github.com/reallaksh19/3D_Converters/blob/main/tabs/xml-cii-2019-standalone/xml-cii-json-hierarchy-scope.js), Git blob `a29ed52cb907d91a6009c158d718c9800a0c8f44`, has `itemMetadata` applying regex `fieldString(slice, 'OWNER_ZONE')` to a **whole serialized branch object**, including `children`. An independent execution with top-level `{type:'BRANCH',name:'/B1',attributes:{OWNER:'/STRUCTURE'},children:[{type:'VALVE',attributes:{OWNER_ZONE:'/Z-CHILD'}}]}` returns **legacy parent scope '/Z-CHILD'** even though the branch has no local Site/Zone. Expected true parent scope: unresolved. This is the precommitted falsifier for R02 U01; it must not become an instruction to patch active Resolver or Preview/Weight code.

## New API (structural facts only)

`resolveSourceOwners(originalOccurrences)` consumes already-discovered, explicitly related original occurrence facts:

```js
[
  {sourceId:'P1',occurrenceId:'P1:$[0]',parentOccurrenceId:null,
   type:'BRANCH',name:'/B1',attributes:{OWNER:'/STRUCTURE'}},
  {sourceId:'P1',occurrenceId:'P1:$[0].children[0]',parentOccurrenceId:'P1:$[0]',
   type:'VALVE',name:'/V1',attributes:{OWNER_ZONE:'/Z-CHILD'}}
]
```

Returned immutable rows preserve source ID, occurrence ID, parent occurrence ID, type/name and explicit `ownerSite`, `ownerZone`, `branchOwner` plus `ownerSiteSource`, `ownerZoneSource` and `branchOwnerSource` original occurrence IDs. `engineeringReady:false` and `rightsBasis:'ORIGINAL_OWN_ATTRIBUTE_OR_EXPLICIT_ANCESTOR_ONLY'` do **not** grant engineering use. R03 byte custody, R04 JSON validation and R05 exact index mapping must attest those input facts independently before use.

**Conservative precedence:** only own `attributes.OWNER_SITE/OWNER_ZONE`, or a typed `SITE/ZONE` container's own name, set the current node's Site/Zone identity. Otherwise inherit nearest explicit ancestor, never search descendants. Plain `OWNER` is separate branch-context metadata and cannot be read as Site/Zone. Different source occurrences with identical names are not aliased. Unknown/duplicate occurrence IDs, missing/cross-source parent and cycles fail closed.

**RED-first independent evidence:** `source-ownership.test.mjs` committed `56c9157b23c2dad60bdf1dd0736f4960efb89c4c` before the first source code `cc35c421248b95abb704fc4039e97549d3c64492`. It checks parent scope unaffected by child owner, branch OWNER distinguished, equal-name siblings and typed ZONE parent preserved. A narrow source self-correction `61e386aa71e67e77a3db833ac77798cbe3af1141` fixed the own-attribute reader's function signature after direct V8 inspection. Dedicated hosted Node22/24 acceptance required.

## Further test-first semantic units and direct hosted qualification

- **U02 inheritance**: separate `source-ownership-inheritance.test.mjs`, precommitted before any U03/U04 changes, validates out-of-order original facts in exact source parent chain SITE→ZONE→BRANCH→VALVE, only nearest declared owner inheritance, explicit child override without changing siblings, no fabricated Site/Zone when missing and independent source scope.
- **U03 conflicting own rights**: `source-ownership-conflicts.test.mjs` precommitted at `d3a89125cb899226a04e27cf0b5736d8a4a093f9`; independent actual pre-fix source probe showed `OWNER_ZONE=/Z1` vs `ZONE_ID=/Z2` was silently accepted and `ZONE_ID` alone ignored. Fixed at `74c47454212699f3f36bccfce23711fd35805f26`: compatible aliases allowed, contradictory same-node OWN site/zone/typed container names reject `OWNER_CONFLICT` and invalid local rights reject `INVALID_OWNER_VALUE`; legitimate child override of an ancestor still permitted.
- **U04 original identity**: `source-ownership-identity.test.mjs` precommitted at `2ef051b8d7095ec3d10f9431e2b87c52071099b3`; R02 initially indexed only `occurrenceId`, which wrongly aliases `$[0]` from SRC-A and SRC-B. Fixed at `b9ce5ae60419ccc41b3b9d52a6f55d26e60c37b1`: canonical map now keys `[sourceId,occurrenceId]`. Unknown/cross-source parent, cycles, duplicates *within the same source* and repeated named sibling nodes receive typed guards.
- **Exact source+stack hosted Node22/24** [R02 PR workflow #37789649830](https://github.com/reallaksh19/3D_Converters/actions/runs/37789649830): PASSED at code head `b9ce5ae60419ccc41b3b9d52a6f55d26e60c37b1`, with **13/13 tests green, zero fail**, including source-root identity negatives. A separate push workflow [#37789642546](https://github.com/reallaksh19/3D_Converters/actions/runs/37789642546) also PASSED. This is a pure contract correctness result, **not** independent raw-source occurrence mapping or downstream engineering acceptance.

**Not yet accepted:** R05 original byte-range/parent record authentication, actual three-repository source-to-owner population goldens, R12/R13 live Resolver adoption and parity, production 30/90MB browser responsiveness or any XML/CII writer output. No application producer has been rewired. R02 is a standalone qualified read model that must never replace GC-PW `sourceId`, `basisId`, original Mode B lineage, physicalOccurrenceId, two Weight stages or mass outputs. All existing Preview/Weight files remain untouched by this PR.
