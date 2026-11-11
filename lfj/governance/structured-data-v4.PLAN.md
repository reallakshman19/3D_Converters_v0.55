# LFJ/1.0 → structured-data execution programme, V4

**Governance:** [parent 3D_Converters#1042](https://github.com/reallaksh19/3D_Converters/issues/1042) · [approved Pass-1 architecture](https://github.com/reallaksh19/3D_Converters/issues/1042#issuecomment-6057297345) · [Owner-approved scope addendum](https://github.com/reallaksh19/3D_Converters/issues/1042#issuecomment-6057797282) · [claim-first V3.2 protocol](https://github.com/reallaksh19/Common/tree/c8eb92a9d530869a8d48bf56616e908eff2ecebb/skills/engineering-pr-delivery-v3.2).

**Downstream-first engineering compatibility:** [current exact-source consumer map and stepwise workpack](./downstream-consumer-reconciliation-v4.md) pins Weight #1061 (merged), 4 Preview #1046/#1047/#1051 (merged), Preview #1060 (ongoing), source identity/physical mass invariants and independent nonregression gates. This is a source-reconciliation dependency, not new materialized semantic points or permission to change GC-PW files.

**Execution source:** [structured-data-v4.execution-graph.json](./structured-data-v4.execution-graph.json). That file, not this prose, is the **pre-materialization, machine-checkable** leaf/claim allocation. The companion workflow runs an exact blob-verified, pinned V3.2 `decompose-check` snapshot against it; the source Git blob is `c3666c16c4d0d0b113a05a6a1467b09d6cdc1858` from `Common@c8eb92a9d530869a8d48bf56616e908eff2ecebb`. This validator snapshot is governance-only, never an LFJ runtime dependency. This plan is not product implementation.

**Owner intent retained, 2026-10-08:** Reuse large-file parsing, cancellation, queries and source identity across 3D_Converters, XML_Compare_Utilities Draft Edit, and 3DMarkupTool managed JSON viewer despite mild source/envelope variants. Where practical, support FBX/GLB (and structurally similar formats) without forcing unlike geometry into StagedJSON. The owner explicitly requested a V3.2-governed upgrade to the existing programme.

## 1. Governing choice and explicit non-goals

Build **one format-neutral source-custody, job and bounded-query engine**; JSON is the first fully qualified payload codec. Native binary formats have **separate container and semantic adapters**, not a universal JSON parser.

```text
immutable SourceSnapshot(exact bytes, SHA-256, source revision)
 ├─ format/capability registry (explicit producer, dialect, version, use rights)
 ├─ JSON tokenizer / supported staged profiles
 ├─ GLB binary header/chunk scanner → embedded glTF JSON payload → binary buffer refs
 └─ existing ufbx FBX parser result → governed FbxSourceGraph.v2 adapter
                    |
          distinct source occurrence identity + typed reference/graph edges
                    |
       bounded worker jobs, cancellation, revision fencing, pagination
                    |
     Resolver | Enrichment | XML Compare Draft | 3DMarkup viewer | asset viewer
                    |
    original source custody + external source-to-output engineering oracle
```

**Non-goals within V4:** full lossless arbitrary FBX/GLB editing or reserialization, new FBX decoder, geometry recompilation, forced equality of StagedJSON Zone/Site and GLB/FBX node/instance/connection semantics, arbitrary external glTF URI fetching, main-thread full-file fallback, rewriting existing Preview/Weight/CII authority, auto-promoting generated output as golden, deployment of a production API before independent security approval.

A reader can have `READ/INDEX/VIEW` capability without `ENGINEERING_EDIT/EXPORT` capability. A profile must explicitly authorize the latter, especially for 3DMarkupTool RVM/ATT and XML Draft full-source exports.

## 2. Source-level truth and frozen initial evidence basis

| Consumer | Actual code and distinct source behavior | Must prove |
| --- | --- | --- |
| 3D_Converters Resolver | [hierarchy scope](https://github.com/reallaksh19/3D_Converters/blob/8ffe6a12c99825c60a8a9dc9471b8626d4627158/tabs/xml-cii-2019-standalone/xml-cii-json-hierarchy-scope.js) current J01 hierarchy/index and descendant owner risks | Parent own-fields; source-stale checks; trace/CII fact parity |
| 3D_Converters Enrichment | [StagedJSON contract](https://github.com/reallaksh19/3D_Converters/blob/8ffe6a12c99825c60a8a9dc9471b8626d4627158/contracts/stagedjson-contract.js), [enrichment parser](https://github.com/reallaksh19/3D_Converters/blob/8ffe6a12c99825c60a8a9dc9471b8626d4627158/tabs/stagedjson-to-enrichxml/sj-parser.js) accept different root families in practice | Actual root envelope, duplicate occurrence, XML/audit parity |
| XML_Compare_Utilities Draft | [staged source](https://github.com/reallaksh19/XML_Compare_Utilities/blob/2e588a5469f463b177990d7f8683deb56ce48a0e/workbench3d/core/staged-json-core.js), [worker](https://github.com/reallaksh19/XML_Compare_Utilities/blob/2e588a5469f463b177990d7f8683deb56ce48a0e/workbench3d/workers/staged-json-worker.js) accept array/hierarchy/branches/objects but worker performs whole-text JSON.parse | No silent `branches=[]`; original full-source records survive scoped edits |
| 3DMarkupTool viewer | [source detector](https://github.com/reallaksh19/3DMarkupTool/blob/2b2dd60d61f4eb039de7de7d82d58ca3cffca0da/src/source-parser.js), [profile parser](https://github.com/reallaksh19/3DMarkupTool/blob/2b2dd60d61f4eb039de7de7d82d58ca3cffca0da/src/managed-stage-profile-parser.js), [rich-topology intake](https://github.com/reallaksh19/3DMarkupTool/blob/2b2dd60d61f4eb039de7de7d82d58ca3cffca0da/src/managed-stage-rich-topology-intake.js) require exact schema/profile/converter/units for RVM | RVM/ATT/source units, coordinate/primitive and converter authority unchanged |
| 3D_Converters FBX | [ufbx provenance](https://github.com/reallaksh19/3D_Converters/blob/8ffe6a12c99825c60a8a9dc9471b8626d4627158/tabs/model-converters/converters/fbx/ufbx-provenance.js), [FbxSourceGraph.v2](https://github.com/reallaksh19/3D_Converters/blob/8ffe6a12c99825c60a8a9dc9471b8626d4627158/contracts/fbx/fbx-source-graph.v2.schema.json) | Parser authority, occurrence/connection edges and transform provenance |
| GLB/glTF | Independent glTF 2.0 spec and validation inputs; [existing GLB wrapper](https://github.com/reallaksh19/XML_Compare_Utilities/blob/2e588a5469f463b177990d7f8683deb56ce48a0e/interchange/source/glb/GlbImportAdapter.js) alone is not proven byte-validation | Header/chunks and refs validated, original BIN and extensions retained |

Baseline SHA heads observed before planning: 3D `8ffe6a12c99825c60a8a9dc9471b8626d4627158`; XCU `2e588a5469f463b177990d7f8683deb56ce48a0e`; Markup `2b2dd60d61f4eb039de7de7d82d58ca3cffca0da`; Common V3.2 `c8eb92a9d530869a8d48bf56616e908eff2ecebb`. **Every execution must re-reconcile heads, source and reserved writer leases.**

## 3. Phase milestones and independent releases

| Phase | Leaf ids | Exit condition |
| --- | --- | --- |
| P0 Governance admission | none (not semantic progress) | Exact-source snapshot, independent oracle register, official V3.2 RELEASEABLE + digest; then one child at a time |
| P1 JSON truth | R01–R05 | Supported actual roots/profiles/permissions, owner facts, original bytes, token boundaries and all occurrences agree with independent oracles |
| P2 Bounded interaction | R06–R09 | Worker-only large operations, bounded pressure, cancel and stale revisions, exhaustive scoped paging |
| P3 Portability | R10–R11 | Browser/Node equal facts; remote API contract with auth/tenant/TTL/quota negative proofs (not deployed until separate approval) |
| P4 Three-repo JSON adoption | R12–R17, R19 | Resolver, Enrichment, XML Draft and 3DMarkupTool viewer all preserve original engineering source and independently verified outputs |
| P5 JSON independent gate | R18 | Independent real populated 30MB/90MB sources, output goldens and actual browser/device performance across three repos; JSON milestone may qualify without binary milestone |
| P6 Structured-asset extension | R20–R23 | GLB chunk semantics, glTF metadata/reference rights, existing FBX source-graph adapter, bounded asset selection without geometry re-authoring |
| P7 Binary independent gate | R24 | Separate real binary asset custody, spec/graph goldens, correct negative behavior and measured resource performance |

**Versioned scope conservation:** original C1–C6/G1 = **100** original points, unchanged; owner-approved new C7/C8/C9/C10/G2 = **30** new points; total **130**. The denominator increase is a legitimate plan scope expansion, **not completed work**. Two gates R18 (JSON) and R24 (binary) remain independently veto-capable. Completion of R18 does not assert R24.

## 4. Claim-first responsibility graph, one ownable outcome each

| ID | Phase | Independently yes/no outcome | Parent allocations | Depends on | Exclusive owner repository |
| --- | --- | --- | --- | --- | --- |
| R01 | P1 | Cross-repo root/profile acceptance | C1_ROOT=9 | — | 3D_Converters |
| R02 | P1 | Ancestor owner truth | C1_OWNER=7 | R01 | 3D_Converters |
| R03 | P1 | Exact source bytes | C2_CUSTODY=6 | R01 | 3D_Converters |
| R04 | P1 | Incremental JSON tokens | C2_TOKENS=5 | R03 | 3D_Converters |
| R05 | P1 | Occurrence index | C2_INDEX=5 | R02, R04 | 3D_Converters |
| R06 | P2 | Worker isolation | C3_ISOLATION=5 | R05 | 3D_Converters |
| R07 | P2 | Cancellation and revision fencing | C3_LIFECYCLE=5 | R06 | 3D_Converters |
| R08 | P2 | Scope selection | C3_SELECT=4 | R05, R07 | 3D_Converters |
| R09 | P2 | Bounded pages | C3_PAGE=4 | R08 | 3D_Converters |
| R10 | P3 | Browser/Node consistency | C5_PORTS=5 | R06, R09 | 3D_Converters |
| R11 | P3 | Authenticated API job contract | C5_REMOTE=5 | R10 | 3D_Converters |
| R12 | P4 | Resolver scope adoption | C4_RES_SCOPE=3, C6_RES_SCOPE=2 | R09, R10 | 3D_Converters |
| R13 | P4 | Resolver trace parity | C4_RES_TRACE=3, C6_RES_TRACE=2 | R12 | 3D_Converters |
| R14 | P4 | Enrichment source intake | C4_ENR_INTAKE=3, C6_ENR_INTAKE=2 | R09, R10 | 3D_Converters |
| R15 | P4 | Enrichment output | C4_ENR_OUTPUT=3, C6_ENR_OUTPUT=2 | R14 | 3D_Converters |
| R16 | P4 | XML Compare Draft intake | C4_XCU_INTAKE=3, C6_XCU_INTAKE=2 | R09, R10 | XML_Compare_Utilities |
| R17 | P4 | XML Compare Draft export | C4_XCU_OUTPUT=3, C6_XCU_OUTPUT=2 | R16 | XML_Compare_Utilities |
| R18 | P5 | Independent JSON-family release | G1_RELEASE=10 | R11, R13, R15, R17, R19 | 3D_Converters |
| R19 | P4 | 3DMarkup managed viewer | C7_MARKUP=8 | R01, R09, R10 | 3DMarkupTool |
| R20 | P6 | GLB binary chunk reader | C8_GLB=4 | R03, R04, R06 | 3D_Converters |
| R21 | P6 | glTF metadata and references | C8_GLTF=5 | R20, R05, R09 | 3D_Converters |
| R22 | P6 | FBX graph bridge | C9_FBX=5 | R03, R06, R09 | 3D_Converters |
| R23 | P6 | Binary scene paging | C10_ASSET_QUERY=5 | R07, R09, R21, R22 | 3D_Converters |
| R24 | P7 | Independent binary structural acceptance | G2_ASSET_ACCEPTANCE=3 | R20, R21, R22, R23 | 3D_Converters |

**Budget:** 4 × 25-point verifiable semantic units for each leaf; target 350 reviewable LOC, hard 900, bounded 15–20 minute checkpoint units. Each unit has explicit independent `verify` in JSON. No leaf earns progress for writing comments, checking CI, opening a PR or simply running tooling. Resize and reassign bounded responsibilities *before* coding if an implementation exceeds the hard budget. Distinct write surfaces and leasing are contractual; two repositories may have identical relative path names without sharing writable files.

### R01 — first admitted source truth (four units)
- U01: inspect real roots for 3D JSON, XCU and 3DMarkup; array/hierarchy/objects/branches/single form distinctions; fail unknown.
- U02: explicit producer/profile/converterSchema/units and capability `read/index/view/edit/export` decision tables; refusal of unsupported engineering conversion.
- U03: preserve exact outer envelope/unknown fields; conflict/duplicate-key diagnostics; no implicit first-match coercion.
- U04: independent three-repo matrix and negative permission cases. **Do not** label 30MB UI performance qualified or modify existing app code in R01.

### New structured-data responsibilities, independent boundaries

| Leaf | Claim focus | Oracle | Non-goal / protected authority |
| --- | --- | --- | --- |
| R19 | 3DMarkupTool viewer | Strict accepted profile, converter and units; independent managed-source RVM/ATT goldens | Do not reinterpret as generic staged export |
| R20 | GLB container | Validate magic, version, declared chunk sizes, offsets, alignment and raw source identity | Do not parse BIN chunk as JSON; preserve unknown chunks |
| R21 | glTF metadata | Retain node/scene/accessor/buffer/bufferView/extras/extensions references and bounds | Do not claim geometry or unknown extension semantics |
| R22 | FBX bridge | Adapt already-governed ufbx source graph occurrences, connections, transforms and unresolved records | No generic FBX JSON tokenizer or inferred support for ASCII |
| R23 | Binary bounded selection | Select/paginate scene occurrences, lazy opaque geometry refs, source fencing and cancel | No eager vertex decoding or reauthoring geometry |
| R24 | Independent binary gate | Attested original bytes, independent scene-graph oracles, realistic hardware/memory/error metrics | No fake golden or full FBX/GLB round-trip claim |

## 5. Anti-draft RED, golden and failure policy

- Every production responsibility must publish a **precommitted failing real-source/oracle case** (or independently authored negative) before GREEN, with source path+sha, failure text, intended difference and reproducible command.
- **SOURCE_REAL vs SYNTHETIC vs GENERATED:** Existing checked-in 10.54MB and 1.11MB managed-staging input bytes are useful; generated 1885 outputs have custody hashes, not independently signed semantics. Owner-real populated >=30MB and 90MB-class fixtures: **NOT YET ACQUIRED / NO_SOURCE**. Generic padding with `X.repeat(30*1024*1024)` cannot pass.
- The golden manifest names original source SHA256, structural counts (root, all nested, selected, exported), expected output SHA256, oracle custodian independent of converter, comparator tolerances for numerics, and explicit unknown unsupported fields.
- **Negative JSON:** dual envelope, duplicate JSON keys, repeated names, parent owner bleed, same-length interior edits, malformed UTF-8/token/depth, unknown schema/profiles, worker unavailable/crash, cancellation and stale paging.
- **Negative GLB/glTF:** invalid magic/version/length, duplicate or missing JSON chunk, chunk misalignment, out-of-range bufferView/accessor, unsupported required extension, unknown chunks preserved, external resource/path/SSRF denied absent governed permission.
- **Negative FBX:** unsupported ASCII in a binary-only declared adapter, duplicate object IDs, source connection/instance distinction, missing transform lineage, parser provenance mismatch, unknown geometry entity must be retained as unsupported rather than silently disappeared.
- Bench browser/main-thread p95 interaction latency, long-task distribution, worker active/retained heap, cancellation acknowledgement, source/item/output count, 30MB/90MB actual populated throughput; budgets are **PROPOSED_UNMEASURED** until actual machine/browser baseline and Owner accepted limits. Do not invent numbers.
- API capability-based auth, tenant isolation, idempotence, expiry/delete, upload quotas and capped server side background jobs remain a **contract/security gate**; hosted API deployment needs explicit further approval.

## 6. Acceptance and protected lineages

No semantic authority is transported by renaming a field. The shared execution protocol can convey typed, revision-bound source occurrences/edges and opaque binary resources. Adapters own specialized interpretations such as Site/Zone, RVM/ATT geometry, FBX matrices, glTF scene node indices, XML-CII DTXR/POS/PS, material/temperature and topology. Original source can always be preserved even if a specialized export is not yet supportable.

**Writer leases:**
- R01–R11/R20–R24: new `3D_Converters/lfj/` namespaced production and qualification surfaces unless specifically listed otherwise in graph.
- R12–R15: exclusive existing 3D Resolver or Enrichment files, with docs mirrors and current active Preview/Weight PR conflicts checked before each PR.
- R16–R17: actual XCU paths, not 3D sources; no work until on-repo owner lease and pinned engine package version.
- R19: actual 3DMarkupTool `src/source-parser.js`, managed-stage JSON controller/profile reader and dedicated golden suite, **not** a fake adapter claim in the 3D main repository.
- Package home/versioned distribution D1, API auth D5, browser reference budgets D4, FactSnapshot bridge D6, independent owner real golden D3/D7 are still binding unresolved pre-adoption/pre-release decisions.

## 7. V3.2 mechanical gate and next task

Run on the exact pinned Common V3.2 source, snapshotted read-only at `lfj/governance/pinned-v32/delp_projection_v32.py` because the 3D_Converters workflow token cannot checkout private Common. The workflow verifies its original Git blob SHA before invoking it, so the result is from the unmodified checker—not a recreated approximation:
```bash
python3 lfj/governance/pinned-v32/delp_projection_v32.py \
  validate-graph --graph lfj/governance/structured-data-v4.execution-graph.json
python3 lfj/governance/pinned-v32/delp_projection_v32.py \
  decompose-check --graph lfj/governance/structured-data-v4.execution-graph.json --mode ENFORCED --json > decompose-report.json
```
Pass condition `report.mode == 'ENFORCED'` and `release_state == 'RELEASEABLE'` and `summary.not_releasable == 0`. Record its **real** `proposal_digest`, then bind exact immutable `released_proposal_digest` and only thereafter create R01 provider child.

**CURRENT EXECUTABLE FRONTIER — source-verified 2026-10-08, before next intake:** [R01 #1052](https://github.com/reallaksh19/3D_Converters/issues/1052) draft [#1053](https://github.com/reallaksh19/3D_Converters/pull/1053) implements the AST-free `lfj-token-root-facts/v1` shallow inspector and preserves structural-only rights; [Node hosted run #37783100032](https://github.com/reallaksh19/3D_Converters/actions/runs/37783100032) GREEN. [R03 #1057](https://github.com/reallaksh19/3D_Converters/issues/1057) draft [#1058](https://github.com/reallaksh19/3D_Converters/pull/1058) implements bounded original-byte SourceSnapshot with large Blob backing, terminal abort, O(log segments) indexed read; [Node22/24 original 10.54MB source test #37783551081](https://github.com/reallaksh19/3D_Converters/actions/runs/37783551081) GREEN. No consumer adoption has happened.

**CURRENT PROVIDER DECOMPOSITION:** [R02 C1_OWNER child #1064](https://github.com/reallaksh19/3D_Converters/issues/1064) is now materialized in the released V3.2 graph, with exact dependence on R01 issue #1052, 7 points allocated and remaining ROOT reserve **103/130**. The [canonical V3.2 ENFORCED workflow #37788777949](https://github.com/reallaksh19/3D_Converters/actions/runs/37788777949) passed, preserving the same release digest `sha256:a52f221e3ba736fe2f76c203ce5608b8b8fb612daa067f9d84958ceab8e11c9d`. R02 [draft PR #1066](https://github.com/reallaksh19/3D_Converters/pull/1066) is stacked on the **independent R01 branch**, not main. Its Node22/24 test suite proved **13/13** native U01–U04 source-local owner facts [PR merge-tree #37789649830](https://github.com/reallaksh19/3D_Converters/actions/runs/37789649830) and final documentation head [#37789844880](https://github.com/reallaksh19/3D_Converters/actions/runs/37789844880). **Critical source-level reproduction:** current Resolver `xml-cii-json-hierarchy-scope.js` mistakenly assigns a VALVE descendant `OWNER_ZONE` to an unscoped BRANCH ancestor because regex scans full parent serialized JSON; R02 prevents this in an **unadopted provider**. [R02 evidence #6061680289](https://github.com/reallaksh19/3D_Converters/issues/1064#issuecomment-6061680289).

**PARALLEL ACTIVE R04:** [R04 #1062](https://github.com/reallaksh19/3D_Converters/issues/1062), [draft PR #1063](https://github.com/reallaksh19/3D_Converters/pull/1063) stacked on R03, is **owned by another active agent**. U01/U02 escaped and Unicode string tests were independently RED→GREEN on Node22/24; later agent supplied U03 whole-document grammar and U04 depth/total-byte/token/cancel/real 10.54MB original-file checks. Current [PR exact-head #37788834152](https://github.com/reallaksh19/3D_Converters/actions/runs/37788834152) passed. However independent [U04 source review #6061485148](https://github.com/reallaksh19/3D_Converters/issues/1062#issuecomment-6061485148) identified numeric lexeme storage without `maxTokenBytes` and per-object key breadth budget as direct issues to reconcile against the latest source **before a whole-R04 acceptance claim**. LFJ does not modify the other agent's `lfj/tokenizer/**` writer lease.

**NEXT dependency gate:** R05 is not admissible for engineering acceptance until **both R02 and R04** are independently qualified on their exact source heads, including complete original JSON occurrence census, token-derived RootFacts and a separately accepted independent real-source index oracle. A green parser test ≠ real engineering source facts. Preserve R01 source-profile authority; R03 byte custody is the raw upstream reader. Preserve 4 Preview [#1000](https://github.com/reallaksh19/3D_Converters/issues/1000), whose [#1060](https://github.com/reallaksh19/3D_Converters/pull/1060) is now merged, and Rigid Weight [#1001](https://github.com/reallaksh19/3D_Converters/issues/1001) / merged [#1061](https://github.com/reallaksh19/3D_Converters/pull/1061): do NOT edit their source/contract/worker/writer or claim their actual CII output accepted via LFJ. Browser populated 30/90MB latency/heap, multi-repo source-to-output real goldens and R18/R24 remain independent vetoes. Fix unrelated minor cleanup only after core integration acceptance and exact-head self-review.

**State of this prose file:** planning text only. Canonical validation is the companion GitHub Actions result—not declared here.
