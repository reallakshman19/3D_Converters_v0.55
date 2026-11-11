# PR981 — P0 Mode B combined XML parity node custody

## Identity and delivery
- Responsibility: #980 (Owner priority interrupt 2026-10-08), parent #921, related/PAUSED J04 #925 / PR #978.
- Classification: ENGINEERING_CRITICAL; code that gates verified XML passed to the CII conversion engine.
- Protocol: reallaksh19/Common@04fb0945b035090cec131dd3796a204237371d6b:skills/engineering-pr-delivery-v3.2.
- Branch: agent/issue-980-mode-b-node-custody-20261008; PR #981 DRAFT based on main a4e5e7a14f5a6662be7d4b418a0b31344ce6ce85; unmerged.
- Owner grants P0 Mode B diagnosis/code and tests. **MERGE AUTHORITY: OWNER ONLY, NOT GRANTED.**
- Code checkpoint before this metadata: 3018e0c7fede8e79f427533171959c60ac1dd34a. Actual final PR SHA must be read live.

## Owner problem and observed evidence
- User supplied Pasted markdown(20261008-013402).md, PL-01_XML.xml, PL-06_XML.xml in conversation.
- Mode B Combine XML -> Use Combined XML in Single -> Run produced `Standalone run parity blocked 356 authority mismatch(es). Engine input was not released.`
- Available 50 mismatches report `missing-propagated-authority` with `missing=node`, on real PL-06 branch /ASIM-1885-PL-10"-S8810105-HOT-01/B3, NodeNumber 200010 and repeated -1, for pipingClass/rating/boreMm/corrosion.
- Source PL-01 9 branches, 452 nodes; PL-06 10 branches, 419 nodes. PL-01 max positive NodeNumber 2980; PL-06 2250. The default 100000-step two-file combine would output PL-06 node 100010, **not** reported 200010; the exact combined artifact/source order/step is not supplied. Do not claim exact production run reproduction or assert that a source node is missing in reality.
- Falsifiable hypothesis: run-parity evidence locates by first Branchname match and recomputes weight-review node keys; repeated branch occurrences/offsets may make source nodes appear missing. Writer used name-keyed Preview class row + node-bore Map, losing occurrence identity in mixed combined files. If current-head tests still report missing nodes, inspect exact combined file and post-enrichment physical identities rather than bypassing parity.

## Implemented and scoped
- `xml-cii-run-parity-evidence.js` + docs: authorityKey includes branch and node ordinal when provided; branch occurrence exact match, node ordinal with immutable node signature of NodeNumber/ComponentRefNo/Endpoint/Position/ComponentType; if physical identity differs, fail with node-identity, never accept a guessed node. Legacy expected entries retain historic review-key lookup.
- `xml-cii-standalone-run-parity.js` + docs: record exact branch/node occurrence and signature for every written authority; ensure Preview branch count/order and node-bore row count/order/identity align with the XML before writing. Export the testable process writer with explicit optional previewBuilder injection; production uses the existing browser Preview unchanged. Existing accepted rigid weight and B31.3/material authority remain untouched.
- `tests/xml-cii-mode-b-parity-node-custody.test.mjs`: reduced facts from PL-01/PL-06 with observed offset 200010, duplicate -1 helpers, branch duplicates; negative altered rating and geometry; actual Preview writer + verifier integration, ordered bores and fail-closed bad order.
- CI registration `.github/workflows/issue-980-mode-b-parity.yml` on PR (Owner review required for inclusion; repo AGENTS prohibits unapproved workflow mutations).
- Source/docs mirror pairs edited identically; mandatory pre-edit copies registered in .backups/log.json IDs 1190–1199 (connector-preserved equivalent to local backup CLI); workreport follows this checkpoint.
- No material/master changes, no synthetic result default, no cross-source joins, no J04 writer mutations.

## Dependency and coordination
- PR #978 (paused) and PR #981 overlap on `standalone-run-parity.js` and docs. **COORDINATION_REQUIRED** for future integration, now serialized by Owner priority. No dual writer or merging #981 into #978 by automation. J04 current live head must be re-read at resumption.
- Source `main` has no P0 fix; Owner merge and deployed validation required.
- J01–J03 reported responsibility-complete, J04 unqualified, J05/J06 blocked (parent #921).

## Appendix A grounded takeover qualification
- A1 Production trace: Mode B `xml-node-offset-combine.js` -> Single source loader -> workflow service -> run-parity process writer -> evidence checker -> converter input release.
- A2 Isolation: 50 observed `missing=node` mismatch examples; original XML has matching physical nodes but exact combined artifact differs in offset from naive two-source default.
- A3 Invariants: exact branch/node occurrence; physical identity signature; correct engineering values; B31.3/material gates; no guessed matching; no merge without Owner.
- A4 Independent expected values: owner PL-06 original NodeNumber 10, componentRef =1006649755/1750, endpoint 1, Position 803427 -1140678 98762.35 and negative helper =1006657947/24 endpoints 1 and 2; tests hardcode expected ratings 900, bore 300/250 per owner logs (they are *reported Preview expectations*, not independently approved master engineering values). Host CI **NOT_RUN/QUEUED**; no positive test certification.
- A5 Minimal patch: two mirrored production file pairs, focused test, isolated validation workflow; no converter Python or material master changes.

## Validation and risk
- Exact code-head unit tests: **NOT_RUN** until hosted workflow executes.
- Focused Issue #980, protected #781 P0, #776: **QUEUED** at initial PR head(s); inspect latest metadata head anew, never reuse earlier-head greens.
- Mirrored source/docs: prior production-head blob SHA pairs identical; recheck after metadata.
- Production Mode B combined and final CII downloads: **NOT_RUN**, exact Owner combined artifact not provided.
- Highest risk: producer output may structurally change between process write and reparse; signature must then fail closed rather than silently emit incorrect engineering data. Secondary risk: PR #978 overlap upon J04 resumption.

## EXACT_NEXT_ACTION
1. Re-read PR #981 exact head, fetch Issue #980 focused and P0/#776 CI job results; repair any failing tests without relaxing validation.
2. Verify combined original source order/offset/duplicate occurrence behavior against the actual generated Mode-B XML and final CII; require a real end-to-end replay before claiming the user's 356-error resolution.
3. Reconcile updated branch diff, source/docs SHA parity, restore ledger and Owner approval for any workflow addition; publish scoped TASK_EVIDENCE and leave PR DRAFT.
4. Do **not merge** or resume J04 until Owner directs the integration boundary.

## 2026-10-08 Owner P0 continuation — source-backed falsifier and missing-zero fix
- Owner-source independent replay created a **conditional exact observed failure** at default 100000 offset by combining [PL-01, PL-06, PL-06]: 29 Branches, 1290 Nodes, 503 negative helpers, ten duplicate Branchname strings, B3 occurrences at indices 9 and 19. First PL-06 B3 contains 100010, second contains 200010. Original first-Branchname lookup returns missing:node for 200010; the new branch occurrence locator finds it. An alternate two-input step200000 also produces 200010, so the Owner's actual source order is still unknown. User-visible local XML/JSON repro artifacts created; *not* a hosted pipeline qualification.
- Actual `xml-cii-standalone-run-parity.js` previously converted missing Preview numeric authority into zero via `Number('')`. Scoped fix: `numeric()` now returns null when input is absent, preserving original Temperature1, Pressure1 and CorrosionAllowance, and avoiding 0 BoreMm/WallThickness creation. Existing explicit numeric zero still qualifies. Regression covers independent input values.
- New 3-source reduced test proves historic key-only logic's `missing=node` and fixed occurrence-based `found=true`, in addition to direct writer+verifier tests. Removed an initial source fixture bore so absence regression correctly distinguishes unconfigured field from source field.
- Native backups #1200–1204 added; `.backups/log.json` maintained. No material/default/B31.3 or converter Python changes.
- Validation at current code head: GitHub exact-head Issue980/P0/#776 **QUEUED**, tests **NOT RUN** in GitHub. Never assert the user's 356 original failures have cleared. The code writer/validation branch is DRAFT, owner-only merge.
- Immediate exact-next action: read the current exact-head results; fix any test failures without lowering authority checks, then replay real combined UI→Standalone→.cii using exact input/config before release certification.

## 2026-10-08 P0 delivery continuation: executable verifier proof and UI runtime chain
- Current branch repaired the actual UI click→Run workflow→API→service→process writer→parity verifier chain by advancing each P0-bearing import query to `20261008-p0-mode-b-parity-1`. Three added source/docs pairs mirror one another; together six production/source-document pairs are changed in PR981. This prevents the repaired service being unreachable through an older cached import identity on the normal Single workflow path. No unrelated functional ownership changes.
- The production writer previously sanitized arbitrary Preview numeric strings and allowed `Number('') === 0` even after an initially nonempty `N/A` label. Now absent, wholly non-numeric and nonfinite values cannot fabricate an engineering zero; explicit source zero and valid Preview zero remain preserved. Added focused negative regression.
- Direct JavaScript runtime execution of the **current GitHub production writer/verifier function bodies** with an explicit minimal XML DOM adapter: 2 occurrences of the same B3, positive IDs 100010/200010, a negative -1 at a separate bore, 15 expected source fields. Result: 15/15 parity comparisons `PASS`, bores [300,300,250], deliberate altered `Rating=901` generates `propagated-authority-mismatch`, and the old legacy branch-name locator reproduces `missing:node`. This is a **bounded runtime proof** with stripped static imports and explicit test DOM—not production browser, not CII, and not confirmation that the Owner's actual 356 mismatches cleared.
- The separate full-source lxml reproducer in the current conversation preserved all 1290 source nodes and their source field identities for [PL-01,PL-06,PL-06] at 100000 offsets. It independently demonstrates a scenario matching node 200010 and an old first-occurrence lookup miss.
- `tests/xml-cii-mode-b-parity-node-custody.test.mjs` now has **11 authored tests**, including duplicate branch/name, missing/invalid numeric, source preservation, negative wrong geometry/value, and static UI→verifier cache import chain. Exact-head GitHub CI is still **QUEUED/NOT_RUN**, so do not claim those 11 have passed.
- Latest P0 code/backup ledger checkpoint prior to this report: `fe0207e79407ff4078813cccf3175c6106d1f950`; .backups/log.json lastId 1221. Parent issue #921 and P0 #980 must be updated with the new exact head after this document commit.
- **EXACT_NEXT_ACTION**: Fetch final PR981 exact-head Issue980/Issue781 P0/#776 results, remediate red tests if any, and qualify the actual deployed browser Mode B combined XML → Single → Python CII with independent accepted master values. No merge or J04 restart until protected checks and Owner instruction.
