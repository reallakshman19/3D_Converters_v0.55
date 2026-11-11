# XML229 G3/G4 read-only candidate/readiness reconciliation

**Status:** DRAFT / non-authorizing. Source: issue #274, latest G3 implementation PR #286.

## Secure, Owner-controlled use
1. Load exactly the Owner-selected original XML, indexed JSON and four correct master datasets/mappings into the real source-bound original-Blob review Worker. Never infer accepted kg from FactRecord completeness.
2. From the **same verified live request** acquire G3 via the existing client method readCandidateCoverage() and G4 via readCompletion(), which emits schema XML229.P4.RunAdvisory.v1. Acquire the two again after any explicit accepted Match-1/Final review or restored review state. Do not confuse this G4 Worker RunAdvisory with a different-shaped UI JSON download.
3. Save ONLY these two small aggregate JSON receipts locally in the approved private diagnostic workspace. No raw XML, JSON, master rows, rejected candidate data or private physical IDs should be sent to public CI or added to an issue.
4. Execute locally: node scripts/xml229-reconcile-candidate-coverage.mjs coverage.json run-advisory.json
5. Interpret 0=structurally consistent, 2=contradictory, 3=incomplete/unknown envelope, 1=read/parse error. The command exposes whitelisted numeric counts and issue codes only. **A consistent result does not authorize CII native Output or Run**.

## Engineering invariants
The comparator requires identical basis SHA, source ID, original indexed JSON SHA, generation, physical/fact totals (7 FactRecords per physical), consistent zero/one/multi and qualified/unqualified proposal coverage, valid source mass population and correct separate Match-1/Final revisions. It forbids claimed native release or review authority and whitelists emitted fields.

Critically, G3 accepted Match-1 / accepted Final / positive source kg *overlap* while G4 source/match1/final are mutually exclusive **effective precedence counts**. Never compare these numbers for direct equality except G3 accepted Final to G4 effective Final; use supported upper-bound relations for the remainder. A physical component can have proposals but no source mass and no accepted decision.

No independent source-byte, mapping/DTXR, complete 385/10,699/383/1,595 master, 41/423/2,961 Owner run, peak Worker+browser RAM, nor native physical CII slot proof is provided by this aggregate check. The actual private corpus and two same-request receipts remain **NOT_RUN** here; native CII release remains HELD.

## Tests and rollback
P4 Worker Node 22/24 suite imports tests/xml229-g3-candidate-readiness-reconciliation.test.mjs: basis/hash/selection/revision, mass/proposal arithmetic, missing/null receipts, forged authority, privacy and unresolved with qualified candidates. These standalone contract and CLI files add no scorer, no Final writer and no native release switch. If validation fails, keep draft and revert the focused comparator code, not production scorer behavior.

## One-Worker-turn consistent pair (preferred after G3 Worker integration)

The Worker now provides `session.readCandidateReadinessPair()`, which computes `coverage` and `readiness` synchronously in one Worker message event with no asynchronous gap, checks the same current live InputBasis/source/generation and review stage revisions through the read-only comparator, and **rejects** an inconsistent pair. Review restoration in progress fails closed. The response schema is `XML229.G3G4.SourceBoundAggregatePair.v1`, containing only those existing two aggregate receipts, the structural reconciliation and explicit false native/review authority flags.

For future Owner-controlled collection prefer the single call:
`const pair = await currentVerifiedSourceReview.readCandidateReadinessPair();`
Save `pair.coverage` as `coverage.json` and `pair.readiness` as `run-advisory.json` **locally**, then run the existing CLI. This prevents an explicit review edit or source generation change from occurring between two separate RPCs; it is still neither an independent source-byte oracle nor per-physical CII output proof.

The legacy `readCandidateCoverage()` and `readCompletion()` remain available and unchanged for established UI consumers. If using legacy separate calls, revisions and source identity must match and stale pairs must be discarded. Never allow `CONSISTENT` to unlock Run. Public Chromium tests assert a consistent before-and-after pair with explicit, separate Match-1/Final decisions and unchanged CII release denial. No Owner private data has been processed.

## Verified Weight-panel private download (preferred Owner workflow)

On the exact Owner source in the live application, complete **4 Preview** and switch to **6 Weight Match**. In the **verified original physical facts** panel, select **Download candidate coverage + readiness (private)**. This is a read-only operation: it asks the current source-bound Worker for one atomic G3/G4 aggregate pair, checks the live receipt again after the response, and downloads `xml229-g3-g4-source-bound-aggregate.json` to your computer. It includes only source-binding digests and aggregate numeric counts; there are **no individual candidates, master rows, original XML/JSON contents or accepted kg values**. The digests and source ID still belong to your private project; keep the downloaded JSON in your private engineering workspace, not in a public issue.

Run the verifier directly on this **single downloaded file** (Node.js required):

```sh
node scripts/xml229-reconcile-candidate-coverage.mjs xml229-g3-g4-source-bound-aggregate.json
```

Legacy two-file mode remains supported for existing controlled workflows. The tool refuses non-small files (larger than 64 KiB), malformed local envelope metadata, forged native release, contradictory InputBasis/generation/counts/revisions and inconsistent review status. Exit **0** means structural agreement ONLY, **2** discrepancy, **3** incomplete envelope, **1** bad input/file. The command never enables native CII. Capture the report **before accepting Match-1**, and again **after explicit Match-1 and separate Final** if an engineer independently approves them. The Owner's 41/423/2961 observation is not a substitute for a report from the current verified source.
