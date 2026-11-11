# GC-PW A3-U1 — canonical original-source occurrence bridge (independent contract)

Authority: #999 → #1025; programme #921 / J06 #927. This is a **new-only pure read-model seam**, not the live master worker, Preview renderer, Weight scorer or CII writer. It does not alter either independent implementation agent's PR.

## Proven integration discrepancy

At Preview Agent-P PR #1018 head \`a028b357...\`, \`previewOccurrenceId\` encodes \`JSON.stringify([sourceId, branchOrdinal, nodeOrdinal, componentSignature])\`. At Weight Agent-W PR #1009 pre-handoff head \`36be404...\`, \`legacyXmlCiiWeightFacts\` generates \`sourceId + '/branch:' + branch + '/physical:' + ordinal\`, falling back to row index if source ordinals are absent. These are different identities and cannot be equated via string rewriting. Repeated \`NodeNumber=-1\`, repeated branch names and multi-source data forbid guessing.

This bridge defines **one canonical physical occurrence** with a mandatory source ID, original branch occurrence index, original node ordinal, and explicit physical component signature. \`physicalOccurrenceId\` yields the same JSON array shape as the existing Preview export. It rejects missing original node ordinal, empty signature, row-count identity and slash-style Weight legacy aliases. Its \`verifyPhysicalFactPages\` output can be passed to an explicit Weight ledger \`openBasis\` consumer, but **no accepted decision is created by this operation**.

## Four independently governed boundaries

1. **Full-content InputBasis attestation.** \`attestLiveBasis\` requires actual source UTF-8 text, source set, every master revision, rows and mapping, selection scope, staged content, configuration and overrides. It verifies the full BasisRef digest and each actual content digest using \`contracts/gc-pw-v1/contract.mjs\`. A same-length changed XML, same-count changed master, changed mapping or stale revision fails. No filename/size/first-80-byte cache keys.
2. **Independently enumerated original population.** The caller supplies \`originalOccurrences\` with explicit \`expectedOriginalCount\`, independently obtained from source XML or another domain's primary record system before computing fact outputs. This list includes non-physical original nodes. Every selected physical occurrence must be a real member. The bridge cannot prove the *accuracy* of the external enumerator by itself; #1008 original-XML oracle and J06 independent source challenge are required for XML-CII.
3. **Canonical read-only FactRecord projection.** The caller supplies \`physicalOccurrences\`, \`requiredFieldIds\`, \`expectedSubjectType\`, and all paginated \`Page<FactRecord>\` entries. Every fact must reference one canonical identity with matching source ID, domain, basis, authority and source provenance. Every expected field for every independently selected physical occurrence must be present once. Counts, page continuation and content mismatch fail closed. Other domains may use a different \`expectedSubjectType\`; no XML import in the bridge.
4. **Downstream consumers and frozen stages.** \`toWeightFacts\` returns a deeply frozen *fact-only* array; proposal ranking, Match-1 and Final Match-2 CAS decision commands, snapshot digests, worker progress/cancellation and writer acceptance remain independent explicit responsibilities. The bridge does not infer or accept physical mass from an option or first proposal.

## Intended integration sequence

Agent-P's immutable basis and true source-ordinal producer → Worker read-model's paginated facts → this common bridge verifies actual basis bytes and independently selected population → Agent-W's ledger receives canonical FactRecords unchanged → explicit user decisions and genuine immutable snapshots → engine request and actual CII → #1021 held-out final mass oracle + material/B31.3 / source→CII engineering checks.

The current two offloaded agent branches are **draft**. Their public draft symbols are not imported from this merged-common-only bridge; consumer wiring requires coordinated explicit adoption. Passing this headless seam is not evidence that the production Preview click is responsive, the owner master 385 / 10,699 / 383 / 1,595 is green, or original PL01/PL06 CII is accepted.

## Verify

\`node --test tests/gc-pw-v1-occurrence-bridge.test.mjs\`.

Negative suite includes repeated -1 across sources, missing source ordinal, ambiguous legacy key, same-length source, same-row-count master, stale revision/mapping/config/override, scope drift, truncated/reused or duplicated pages, extra/missing fields, unlisted source, cross-basis facts and provenance. A non-XML device-domain projection demonstrates the portable interface.

### Next integration acceptance

Real worker-produced source facts with independently enumerated 19 branches/871 original PL01+PL06 nodes must be read by both consumers with identical canonical occurrence IDs. The schema is only a **boundary conformance gate**; do not count an in-memory synthetic fixture as a product integration cycle.
