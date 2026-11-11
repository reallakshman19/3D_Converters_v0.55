# PR #343 — immutable source binding for fresh TopoFix Workers

## Recovery header

HANDOVER_READINESS: READY — recovery-ready, not release approval
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED — exact Owner-approved scope only
PR_HEAD_OBSERVED: 331abb23779e408d3d33796a2848884335db6d89 (published implementation commit)
REPORT_BASIS_HEAD: 331abb23779e408d3d33796a2848884335db6d89 — subsequent synchronization commit changes own recovery metadata only
MAIN_HEAD_LAST_CHECKED: 5a5eb118af161cf92450564e864f0ae408d4111a
MERGE_BASE: abf507f6866e444fb7ed73055494f5e12d67a721 (new branch parent)
REPORT_SYNC: CURRENT — source/test blobs match the tested implementation; the report synchronization commit is metadata only
APPENDIX_A_STATUS: NOT_REQUIRED for this exact fix under Owner-scoped exception; no score awarded
GROUNDING_EPOCH: GE-XML229-SOURCE-BINDING-20261026-01
CURRENT_STAGE: DRAFT_OPEN_CURRENT_HEAD_VALIDATION
CURRENT_BLOCKER: Direct post-publication browser evidence/CI observation pending; native Owner release remains outside scope
HIGHEST_RISK: Direct post-publication source-race browser execution is not yet observed; private Owner native release is unqualified
EXACT_NEXT_ACTION: Inspect current PR-head CI, record the actual direct production-browser result if executed, and preserve Draft/native HOLD. Any additional source change needs new scoped review; do not merge.

## Handover in 60 seconds

A mutable raw.sourceText could change while SHA attestation awaited, allowing the old source to be attested while a Worker opened against new inputs. The reviewed correction captures immutable fixedXmlText and rechecks current source after attestation, after input hydration, inside the deferred input callback and after Worker startup. A stale opened candidate is cancelled. Replacement UI objects with unchanged source bytes remain valid.

The published production delta is exactly the three files in the ledger. Both handoff modules equal reviewed candidate SHA-256 e18fb0749cd295c29fa7e69143df3cfd5c32988d80b70c40dc32e8600b36efb1. The full existing handoff suite plus five regressions passes 10/10 against the root module and the same 10 cases against docs/. The remote Chromium evidence ZIP is inspected and scoped PASS. No Owner Final mass, numerical rule, workflow or native release control changes.

Oracle standalone (chat ID UNKNOWN) authored this scoped patch under the Owner's coding authorization. Independent Reviewer routing label 6adef8f2 supplied the separate Node review. A local Antigravity executor supplied Chromium evidence. Authorship and artifact inspection do not authenticate either participant's identity or constitute Owner release acceptance.

## Mission, source and protected authority

Owner instructions: Oracle standalone; may choose to code; production first, cleanup later. Source task is the XML229 independent audit and the subsequent isolated source-binding review. Do not close the broader XML229 mission on this fix.

Protected invariants: exact original/fixed source custody; original occurrence identity; geometric aliases distinct from mass owners; TopoFix remains pre-Final; fresh O1 generation/Worker basis; manual Final acceptance survives panel recreation; emitted native ownership remains exact and fail closed. No prior Final or review backup migration; no automatic accepted kg; no merge or native CII release.

The initial inspected runtime snapshot is a partial source materialization, not a Git checkout. Every one of its 7,660 materialized baseline files used for the isolated rehearsal matched the original commit's Git blob. Production publication uses the complete remote base tree 167f1b745f782e76a5e5045bbd68dcf1684a66f6, not an incomplete reconstructed repository tree.

## Live grounding and coordination

On 26 October 2026, #342 is open Draft/unmerged at abf507f6866e444fb7ed73055494f5e12d67a721; base is feat/xml229-l2-topofix-prefinal-lineage-20261026 at 56e6f653dcaf84dedc304eeb940c8874007ecbe1. Main remains 5a5eb118af161cf92450564e864f0ae408d4111a. Parent check runs: 72 success / 15 failure, 87 total; no GitHub review submissions. External independent evidence is listed separately.

All 91 open PRs were inventoried. Changed-file lists for the other 90 show no exact overlap with this fix's three files. Broader XML/CII authority overlaps exist. All 32 relevant XML229/XMLCII claim/status records were read and parsed; none has an exact, prefix or glob path claim matching these three files. agents/MASTER_INDEX.md and PR340/341/342 work reports are absent from the inspected exact-basis tree; do not invent them or rewrite other workstream records.

Coordination classification: COORDINATION_REQUIRED for shared XML/CII authority, bounded by the Owner's approval of a separate stacked Draft. One writer owns only this new branch and the exact claimed paths. Preserve #340/#341/#342, existing claims and all control-cutover decisions. Refresh live state before a future source change or landing decision.

## Qualification and bounded exception

The protocol's CLI effort checker returns UNKNOWN / rollout_missing in this web session. Actual model/effort remains UNKNOWN. Formal Appendix A scoring was not completed and no score/PASS is fabricated.

After receiving the independent Node review, inspected Chromium logs and 20 passing root/docs rehearsal checks, the Owner was explicitly asked to accept those results as qualification for this exact fix and waive the unavailable CLI effort check for a separate Draft PR stacked on #342. The Owner replied: "approved, proceed" on 26 October 2026.

This is an OWNER_SCOPED_EXCEPTION, not a general qualification transfer. It permits only the identical three-file reviewed patch and recovery metadata. It does not authorize other code, workflow edits, mass acceptance, merging or native release. Re-enter normal requirements for any additional engineering-sensitive scope.

## Validation ledger

| Check | Result and observation | Limits |
| --- | --- | --- |
| Original source-binding negative controls | Original 6 PASS / 4 FAIL; author/local and separately reproduced reviewer harness | Node fixtures; reviewer parser/attestation dependencies mocked |
| Reviewed candidate Node behavior | 10 PASS / 0 FAIL; independent Node report and Oracle reproduction | Independent review is scoped to the isolated correction |
| Root applied module | 10 PASS / 0 FAIL / 0 skipped, Node v24.22.1, local isolated rehearsal | Exact production path, fixture-based Worker opener |
| Docs applied module | Same 10-case suite passes 10/10, only handoff import redirected to docs/, local execution | Verification-only test copy is not published |
| Chromium original source race | Exit 1, seed true, Worker opened, expected stale-source HOLD absent | Remote Windows executor; original defect reproduced |
| Chromium candidate source race | Exit 0, seed true, Worker not opened, stale-source HOLD present | Synthetic XML/O1/master inputs; explicit candidate HTTP override |
| Chromium candidate panel recreation | Exit 0, same live Worker/basis, 35 kg draft, Final 0 to 0, native release false | Production UI/Worker; injected stable resolver |
| Candidate/harness identity | ZIP SHA and reconstructed executed-harness SHA match; diagnostics only, all assertions retained | Artifact inspection; no new local Oracle Chromium run |
| Root/docs parity and patch closure | Applied modules identical to the reviewed e18fb074... candidate; only three basis files changed | Original snapshot and main remain unchanged |
| Direct browser checks after publication | NOT_RUN at report preparation | Current-head CI/runner results must be recorded before claiming them |
| Private PL-01 and nine Firstpass native owners | NOT_RUN / unresolved outside this patch | Overall release remains INCOMPLETE — HOLD |

Relevant commands:
`node --test tests/xml229-topofix-fresh-worker-handoff.test.mjs`
`git apply --check production-source-binding.patch`

Direct docs verification reuses the same test suite with its handoff import redirected to the docs module. It does not add another production or published test file. Backups were saved with node utils/backup.js before isolated-copy edits.

## Current issues and decisions

- ISS-SB-01: source mutation across async handoff — resolved by the exact published fix within tested scope.
- RISK-SB-01: direct post-publication browser route and the wider asynchronous master/source matrix remain separate evidence boundaries.
- DEC-SB-01: publish a new stacked Draft; do not overwrite another active branch.
- DEBT-CI-01: 13 pinned merge-base and two changed-file scope failures on the parent remain deferred; no test bypass or workflow change.
- ISS-NATIVE-09: nine public Firstpass unresolved owners remain outside scope. Do not move mass to neighboring geometry or weaken guards.
- RISK-OWNER-01: private PL-01 controlled inputs/Final/output evidence remain missing; Node 2810 meaning cannot be inferred from public fixtures.

## Changed-file ledger

| Path | Purpose |
| --- | --- |
| tabs/xml-cii-2019-standalone/integration/xml229-topofix-fresh-worker-handoff.mjs | Capture immutable fixed XML and guard asynchronous freshness |
| docs/tabs/xml-cii-2019-standalone/integration/xml229-topofix-fresh-worker-handoff.mjs | Byte-identical served docs mirror |
| tests/xml229-topofix-fresh-worker-handoff.test.mjs | Five source-race/replacement-state regressions |
| agents/PR343_workreport.md | Own recovery report, synchronized after PR allocation |
| agents/claims/PR343.yaml | Own exact-path/branch claim, synchronized after PR allocation |
| agents/status/PR343.yaml | Own state and qualification-exception receipt, synchronized after PR allocation |

No masters, geometry, kilograms, native writer/verifier, workflow, Final ledger or release-control file changes.

## Evidence artifacts

- [Independent Node review ZIP](https://drive.google.com/file/d/1s9fKJgAHSlFdQYy7h8BHgn7B4h_eJXCR/view)
- [Inspected Chromium execution ZIP](https://drive.google.com/file/d/1rcrVYOo6v87zZ0LrSDu1hu50ZlvsyUGz/view), SHA-256 4eb210bf7e62ae9d37d8a8c976b07e6ccbf615114211b0c1ddcca5a272a6fb3e
- [Root/docs integration rehearsal](https://drive.google.com/file/d/1bGqUvAn3vo0d5uDAvOyq_sNnfLPKHQ8q/view), SHA-256 1083abc6e87f9cdde844d06950f2bc8850fa42ff3a752386a0fbffe26fad0956
- [Original three-file reviewed patch](https://drive.google.com/file/d/1EHI6BfReyF2vHQac-UopGEatgfzeK_AH/view)
- [Core concepts and project checkpoint](https://drive.google.com/file/d/1JVh5-0Efal42c2PeTnrR2mHOkiyMtxkg/view)

Publication, recipient retrieval, technical verification and Owner release acceptance remain distinct.

## Publication receipt

PR #343: https://github.com/reallakshman19/3D_Converters/pull/343
Branch: fix/xml229-topofix-source-binding-20261026
Base: #342 / feat/xml229-l3-topofix-fresh-gcpw-worker-20261026
Implementation commit: 331abb23779e408d3d33796a2848884335db6d89
Remote implementation blobs were fetched and matched to the locally tested source. A following commit only renames/synchronizes these three recovery records; it changes no source/test blob. No original branch or main was updated. Future incoming agents start with their applicable grounding/authority; this bounded exception is not general qualification transfer.
