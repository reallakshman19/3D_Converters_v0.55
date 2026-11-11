# WIP-XMLCII-BORE-WALL-INDEX-20260818 — Preview Bore/Wall indexing

# CURRENT RECOVERY STATE — READ FIRST

## 1. Recovery Header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
EXECUTION_MODE: MANUAL
AUTO_STATE: NOT_ACTIVE
SCOPE_AUTHORITY: LOCKED_TO_APPROVED_MISSION
PHASE_PROGRESSION: MANUAL
MERGE_AUTHORITY: OWNER_ONLY

REPOSITORY: reallaksh19/3D_Converters
SOURCE_TASK: Owner-directed XML→CII (2019) Standalone source-level performance remediation.
PR_OR_WIP: WIP-XMLCII-BORE-WALL-INDEX-20260818
BRANCH: agent/xml-cii-bore-wall-index-20260818
PR_HEAD_OBSERVED: PENDING_PR_ALLOCATION
REPORT_BASIS_HEAD: bca7fc9390c018753d09161052b0bf2fd54e33ce
MAIN_HEAD_LAST_CHECKED: bca7fc9390c018753d09161052b0bf2fd54e33ce
MERGE_BASE: bca7fc9390c018753d09161052b0bf2fd54e33ce
REPORT_SYNC: CURRENT
APPENDIX_A_STATUS: NOT_REQUIRED_NEW_WORK_ITEM
GROUNDING_EPOCH: GE-002
CURRENT_TAKEOVER: NONE
CURRENT_STAGE: PR_PREP
LAST_COMPLETED_STAGE: VALIDATE
CURRENT_BLOCKER: NONE
HIGHEST_RISK: Repository-native test execution remains unobserved locally because direct checkout is environment-blocked; semantic lookup equivalence is otherwise qualified on exact branch bytes.
LAST_DURABLE_CHECKPOINT: Production/test blobs match locally executed reconstruction: wall-evidence 1de4824a50955bfdeaaca94532970c30055a6b90; bore-wall authority a7f666f5f4389fdf8fa0681296ebe603461fda57; test 739fccec5360e3626e4065838333230f60fad6d9.
EXACT_NEXT_ACTION: Open a draft PR, migrate WIP custody to PR-numbered records, then inspect exact PR head/checks/review state.
```

## 2. Handover in 60 Seconds

The confirmed P0 Bore/Wall hotspot is implemented. `applyPreviewBoreWallAuthority()` now builds a staged-wall evidence index and exact Piping-Class wall index once before iterating branches. Branch processing performs indexed lookups instead of reparsing/walking StagedJson and rescanning the Piping-Class master per branch.

Authority order is unchanged: direct DTXR wall remains first, exact class/DN wall remains fallback ahead of weaker DTXR schedule evidence, benchmark correction `96620|250` remains higher authority than the master, node bore correction remains active, and invalid staged JSON remains fail-soft.

The earlier junior claim about a legacy Weight Match global-top-five correctness defect was falsified on exact current-main bytes and closed without production changes. This WIP contains no Weight Match work.

## 3. Repository Ground Truth

Grounding `GE-002`, checked immediately before PR preparation:

- default branch: `main`;
- live main / merge base: `bca7fc9390c018753d09161052b0bf2fd54e33ce`;
- compare state: branch ahead, `behind_by: 0`;
- production diff: exactly the two claimed Bore/Wall modules;
- additional diff: one focused regression, two mandatory exact backups, WIP metadata;
- no likely existing Bore/Wall regression file was found under the expected names;
- #616 remains isolated to Preview-search and is not touched;
- no active PR was found claiming the Bore/Wall production files.

Pre-edit blobs preserved by repository backup flow:

- `xml-cii-adapted-preview-bore-wall-authority.js`: `8955e316b36c1769746759aeeb43e34926d47ecb`;
- `xml-cii-adapted-preview-wall-evidence.js`: `04ff82f24dfa9e7a112c17228d1fe24de0b32a55`.

## 4. Mission / Scope / Acceptance

Mission: change hidden Bore/Wall preparation from per-branch whole-master/whole-StagedJson work to once-per-Preview indexed preparation without changing engineering authority.

Implemented scope:

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-wall-evidence.js`;
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js`;
- `tests/xml-cii-preview-bore-wall-index.test.mjs`;
- exact pre-edit backups and recovery metadata.

Explicit non-goals remain unchanged: no #616 file; no Preview cache/orchestration change; no Material/Weight change; no writer/runtime/Python/support-GAP/topology/units/formulas/workers/workflows.

Acceptance status:

1. staged JSON parse/walk once per Bore/Wall application: **PASS**;
2. exact Piping Class wall index once, first-match semantics retained: **PASS**;
3. `96620|250` correction precedence retained: **PASS**;
4. canonical branch grouping/evidence order retained: **PASS**;
5. representative authority behavior equivalent: **PASS in focused reconstruction**;
6. invalid staged JSON fail-soft: **PASS**;
7. new JS size/syntax requirements: **PASS**.

## 5. Current Implementation State

| Work item | Implementation | Integration | Validation | Remaining |
|---|---|---|---|---|
| staged branch evidence index | COMPLETE | wall-evidence boundary | PASS focused | PR/native CI |
| exact class/DN wall index | COMPLETE | wall-evidence boundary | PASS focused | PR/native CI |
| Bore/Wall consumer | COMPLETE | existing Preview authority | PASS focused integration | PR/native CI |
| regression | COMPLETE | focused Node | PASS local exact-byte reconstruction | PR/native CI |
| PR/review/CI | NOT_STARTED | N/A | NOT_RUN | allocate draft PR |

## 6. Active Engineering Item Register

| ID | Type | Severity | Priority | Status | Summary |
|---|---|---|---|---|---|
| IMP-001 | performance | high | P0 | IMPLEMENTED | StagedJson parse/walk moved out of branch loop. |
| IMP-002 | performance | high | P0 | IMPLEMENTED | Exact Piping-Class wall scan moved out of branch loop. |
| RISK-001 | authority | high | P0 | QUALIFIED_FOCUSED | Evidence order, first-row behavior, correction precedence, direct-DTXR precedence covered by regression. |
| RISK-002 | validation | medium | P1 | OPEN | Full native repository execution unavailable locally; must rely on PR CI/check state for repository-native evidence. |
| DEC-001 | authority | high | P0 | ACTIVE | Only lookup preparation changed; resolver and publication precedence are unchanged. |

## 7. Technical Diagnosis and Implementation

Before:

```text
for each branch
  JSON.parse(stagedJsonText)
  walk complete staged tree
  filter evidence for branch
  scan complete Piping Class master for class/DN
  resolve authority
```

After:

```text
build staged evidence Map<canonicalBranch, evidence[]> once
build exact class/DN Map<class|DN, wallResult|null> once
for each branch
  indexed staged evidence lookup
  indexed class-wall lookup
  existing resolver/authority order
```

Important semantic detail: the class index deliberately records the first class/DN result even when it resolves to `null`, preventing a later duplicate valid wall from replacing an earlier invalid first row. That preserves the prior `.find()`-then-validate behavior exactly. Corrections are seeded before master rows, preserving benchmark precedence.

## 8. Authority and Invariants

Authority remains:

```text
staged/XML wall evidence
-> existing DTXR wall evidence ledger
-> DIRECT_WALL wins
-> exact Piping Class class/DN wall fallback
-> weaker DTXR schedule evidence
-> branch Preview publication
```

No engineering values, units, schedules, correction values, DTXR parsing rules, node-bore rules, material/weight semantics, support/GAP semantics, writer/runtime behavior, or Python behavior changed.

## 9. Current Validation

```text
ID: VAL-001
Status: PASS
Observation: LOCAL_EXECUTION
Oracle: REPOSITORY_POLICY
Basis: exact main pre-edit blobs
Evidence: reconstructed files hashed byte-identically to GitHub; `node utils/backup.js save` executed before existing-file edits; committed backups preserve exact source blobs 8955e3… and 04ff82…
Limitations: repository checkout unavailable

ID: VAL-002
Status: PASS
Observation: LOCAL_EXECUTION
Oracle: LANGUAGE_RUNTIME
Basis: exact branch production/test bytes
Commands:
  node --check tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-wall-evidence.js
  node --check tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js
  node --check tests/xml-cii-preview-bore-wall-index.test.mjs
Actual: all syntax checks passed

ID: VAL-003
Status: PASS
Observation: LOCAL_EXECUTION
Oracle: INDEPENDENT_REFERENCE_MODEL
Basis: exact branch production/test bytes
Command: node tests/xml-cii-preview-bore-wall-index.test.mjs
Actual: `XML CII Preview Bore/Wall indexed preparation checks passed.`
Coverage:
  - one JSON parse followed by 100 indexed branch lookups;
  - zero Piping-Class master row reads after index construction across 100 lookups;
  - independent legacy staged traversal/evidence order equivalence;
  - invalid JSON fail-soft;
  - duplicate first-row semantics, including first-invalid/later-valid duplicate;
  - benchmark correction precedence;
  - NPS-to-DN mapping and misses;
  - direct staged wall over exact class fallback;
  - node bore correction remains active.
Limitations: local reconstruction uses minimal stubs only for the imported DTXR resolver/ledger boundaries so target modules can execute without a repository checkout. The independent staged/class lookup equivalence checks do not depend on those stubs. Repository-native real-core execution remains pending PR checks.

ID: VAL-004
Status: NOT_RUN
Observation: NOT_OBSERVED
Oracle: REPOSITORY_NATIVE
Command: native checkout / repository test suite
Actual: NOT_RUN; direct clone failed `Could not resolve host: github.com`
Classification: ENVIRONMENT_BLOCKED
```

## 10. Changed-File Ledger

Production:

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-wall-evidence.js` — adds reusable staged/class indexes and compatibility wrappers;
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js` — builds indexes once and consumes them in the branch loop.

Qualification/custody:

- `tests/xml-cii-preview-bore-wall-index.test.mjs`;
- `.backups/1_tabs_xml_cii_2019_standalone_ui_adapted_xml_cii_adapted_preview_bore_wall_authority_js.bak`;
- `.backups/2_tabs_xml_cii_2019_standalone_ui_adapted_xml_cii_adapted_preview_wall_evidence_js.bak`;
- this WIP report/status/claim.

No workflow files are changed.

## 11. Review / CI State

No PR allocated yet. Exact PR checks/reviews are NOT_RUN until allocation.

## 12. Repository Coordination / Overlap

```text
MASTER_INDEX_CHECKED: absent on main
STATUS_RECORD: agents/status/WIP-XMLCII-BORE-WALL-INDEX-20260818.yaml
CLAIM_RECORD: agents/claims/WIP-XMLCII-BORE-WALL-INDEX-20260818.yaml
LAST_OVERLAP_CHECK: GE-002 / 2026-08-18
FILE_OVERLAP: none observed
AUTHORITY_OVERLAP: no active production owner for claimed Bore/Wall files
DEPENDENCY_OVERLAP: independent of #616; #614 may later consume performance evidence
COORDINATION_STATE: SAFE
```

## 13. Continuation State

```text
Start here: draft PR allocation
Do not redo: staged/class indexing implementation or focused local qualification
Do not change: authority order, engineering values, DTXR resolver, correction table
Validation still required: exact PR-head repository-native CI/check state and review reconciliation
Highest-risk remaining item: native real-core execution has not run locally
Exact next action: open draft PR and migrate WIP custody to PR-numbered records
```

# APPENDIX A — IMPLEMENTATION TAKEOVER QUALIFICATION

`NOT_REQUIRED_NEW_WORK_ITEM`: Owner explicitly requested this new implementation. A later takeover must complete repository-specific Appendix A before production mutation.
