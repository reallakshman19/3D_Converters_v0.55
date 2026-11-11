# LFJ R09 — bounded complete source-selection pages

**Claim:** existing [R09/C3_PAGE #1085](https://github.com/reallaksh19/3D_Converters/issues/1085), admitted under V3.2 by merged [governance #1086](https://github.com/reallaksh19/3D_Converters/pull/1086). First source predecessor [R08 #1082](https://github.com/reallaksh19/3D_Converters/issues/1082), complete source-only selector, after actual R03/R05/R06/R07. One app-neutral owner `lfj/query/pages/**`. No Resolver/XML/CII interpretation here.

## Required injected indexed store

`createCommittedSelectionPager({store,sourceBasis,selectionDigest,jobEpoch,getCurrentBasis})` creates a **session-scoped**, source-revision-bound page reader. An external indexed store MUST implement:

| Method | Binding contract |
| --- | --- |
| `async stagePage(readonlyRows)` | Append bounded provisional R08 selected `OPEN` rows in supplied original source order; no externally accepted reads before commit; bounded backpressure |
| `async commit(manifest)` | Atomically publish only after R08 has returned its complete selection manifest and R09 count/basis check has passed; durably visible indexed rows remain source-only |
| `async abort()` | Idempotently discard any uncommitted or post-abort late staging/commit; repeated cleanup after a pending callback settles is **mandatory** |
| `async readRange(offset,maxRows,maxBytes)` | Indexed seek in **selected-record ordinal position**, NOT source reparse, whole-selection iteration or entire-result clone; return at most these row and UTF-8 byte caps in deterministic source order |

A store must preserve the immutable exact R05 source occurrence records and committed output membership; **a forged JS object claiming completion is not a cryptographic custody proof**. The store provider, storage transaction visibility and record-index provenance must be independently qualified when wiring the actual Worker/browser. R09 verifies injected record order, source basis and response bounds; it cannot recover a lost row from an untrusted backend or guarantee an external provider's crash durability.

Call `pager.stageSelectedPage(page)` as the `onSelectedPage` sink of **one** R08 `selectCommittedOccurrences(view,query,...)` operation. Then call `await pager.commitSelection(summary)` with that operation's complete `LFJ.OccurrenceSelectionSummary.v1`. Any failure/cancel/supersession calls `await pager.abort()`; failures before commit must never become public complete pages. A late stage/commit must be aborted **again after awaiting that external operation**.

Thereafter call `pager.readPage({cursor,maxRows,maxBytes,sourceBasis,selectionDigest,jobEpoch})`. The first `cursor` is `null`; each nonterminal page returns an **opaque session-local unpredictable capability token**, never a caller-provided offset. The token is single-next-page, consumed by a successful sequential read; old tokens, guesses, replay, wrong selection/job/source are refused. The caller must hold the returned token; the pager is intentionally not a persisted cross-process cursor in R09. `getCurrentBasis()` is checked again after awaiting external storage reads, and aborted/superseded reads fail closed. A complete page has `cursor:null` and cannot be restarted by passing `null` again.

Limits: requested rows 1–4096, requested **entire serialized page envelope** UTF-8 bytes 256–1,048,576, including source/selection/epoch/cursor/count metadata; `stageSelectedPage` enforces its own 4096-row/1MiB provisional ceiling. A complete page is checked against the byte cap **before** the cursor advances; requests too small for the envelope are explicitly refused, not silently truncated. A larger row cannot be silently clipped; the caller must choose a sufficient allowed page-byte cap, or see a typed error. A one-row page **does not** imply bounded total indexing or source-processing cost. `SOURCE_FACTS_ONLY`, `engineeringReady:false` everywhere; never grant editing, XML/CII export or Weight/Preview authority.

## Evidence and explicitly unfulfilled dependencies

Focused native tests build immutable R03 original staged bytes, exact R05 source occurrence census, R06 verified native Worker consumed-byte receipt, R07 accepted source-index commit and R08 actual branch/All/None selected events. They compare independently written source pointer goldens, page=1/full union, varying page sizes, repeat branch labels, cursor replacement/forgery, byte+row backend violation, incomplete upstream manifest, and cancel/late-stage/late-commit/read races.

**The test-only indexed store is a small in-memory oracle adapter, not shipped production IndexedDB, OPFS, persistence, disk spill or browser Worker backend.** The direct source-path code supplies the verifiable read/commit/abort *contract* and bounded pager, not the actual full 10.54MB/30MB/90MB browser data store. Future port/runtime R10 and Resolver-specific R12/R13 need authorized deployment/source ownership, independently approved engineering XML/DTXR/POS/PS/CII output goldens, and measured named-device browser performance. Those remain `NOT_QUALIFIED`. No R11 network auth service or other adopter is implied.

Reproduction: `node --test lfj/query/pages/*.test.mjs` on Node22 and Node24, plus retained LFJ + GC-PW/Preview/Weight + real Chromium on accepted exact product head. V3.2 `TASK_EVIDENCE` distinguishes initial missing-module RED from later semantic race RED before corresponding source fixes.
