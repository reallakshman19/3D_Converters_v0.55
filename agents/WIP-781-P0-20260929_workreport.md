# WIP-781-P0-20260929 — Issue #781 P0 B31.3 live-row custody + explicit REST preservation

## Recovery state

```text
ISSUE = #781
PLAN = IMPLEMENTATION_PLAN rev 1 / issuecomment-5893573324
BASE_MAIN = 7057e3d031663fbe92c22f4a3b8c98cc32d06e7b
BRANCH = agent/issue-781-p0-b313-rest-20260929
PR = #782
CRITICALITY = ENGINEERING_CRITICAL
EXECUTION_SCOPE = STEP-781-01 only
HANDOVER_READINESS = READY
PR_RECOVERY_STATE = HEALTHY
MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED
```

## Protocol basis — refreshed at PR-ready boundary

```text
V3.1
Common@1ced68258afeaf50df113b1d38a4ceb9193587e3
TPG-2P-2026-09-28-R3
```

The live Common basis is unchanged from the implementation-plan basis.

## Owned outcome

STEP-781-01 is implemented and qualified on the validated material head `d369d59318919f644f08383828ab3079258b85aa`.

### B31.3 Preview action custody

The defect was an API/custody break, not a calculation defect:

```text
live Preview branchRows
  -> rendered successfully
  -> discarded at renderer boundary
  -> B31.3 controller re-read legacy localStorage
  -> empty legacy cache suppressed action creation
```

Correction:

```text
live Preview rows
  -> explicit Preview result
  -> V7 result preservation
  -> B31.3 install rows
  -> precedence: live Preview -> supplied snapshot -> legacy cache fallback
```

Preserved invariants:
- B31.3 remains explicit-action-only.
- No S/E/W/Y, pressure, OD, corrosion, material-factor, or wall-selection equation was changed.
- Legacy cache remains compatibility fallback only.
- #780 worker/IndexedDB master-data architecture is unchanged.

### Explicit REST custody RCA

The cited benchmark nodes already contain explicit `+Y` restraints:
- `PS-14292.1` in `SYS-6-S8810011-01.xml`;
- `PS-14259.4` in `SYS-6-S8810010-01.xml`.

The first observed identity change is the existing short-element cleanup. Each cited ATTA support is coincident with a preceding retained OLET node and is collapsed by the <=6 mm cleanup rule. The cleanup merges the incoming restraint specs into the retained node, so numerical restraint authority survives while the original support-node identity no longer exists as a standalone engineering node.

For `PS-14292.1`, the trace also exposed a multi-support stack at the same retained node: source nodes 110/120/130/140 carry different support identities but collapse onto retained Node 100. Therefore overwriting the retained OLET with one source `NodeName` would be incorrect.

Correction is deliberately non-destructive:
- no new REST fallback was added;
- no `+Y -> REST` reverse inference was introduced (`+Y` can also represent SHOE authority);
- no retained component/ref/geometry authority is replaced;
- runtime custody records each explicit source support identity -> retained engineering node relationship using branch, position tolerance, and restraint-type evidence;
- ambiguous/unresolved custody remains diagnostic rather than guessed.

Focused acceptance proves for both reported identities:

```text
source explicit +Y
-> runtime custody transfer evidence
-> retained OLET restraint_specs contains CII type 14
-> conversion model assignment contains type 14
-> RESTRANT writer input contains retained node + type 14
-> final CII RESTRANT section contains retained node + type 14
```

## Material changed surfaces

Production/runtime:
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer-v7.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-update.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-audit-controller.js`
- `converters/scripts/xml_to_cii2019_runtime_custody.py`

Mirrors:
- corresponding `docs/` runtime mirrors.

Qualification:
- `tests/xml-cii-issue-781-b313-live-row-custody.test.js`
- `tests/xml-cii-issue-781-explicit-restraint-custody.test.py`
- `.github/workflows/issue-781-p0-validation.yml`

Recovery/coordination:
- `.backups/issue-781/p0/*`
- `agents/claims/WIP-781-P0-20260929.yaml`
- `agents/status/WIP-781-P0-20260929.yaml`
- this report.

## Validation evidence

Validated material head: `d369d59318919f644f08383828ab3079258b85aa`.

| Evidence | Result |
|---|---|
| Issue 781 P0 XML-CII Validation, run `36606373500` | PASS |
| B31.3 live Preview row custody | PASS |
| Explicit REST source -> final CII custody for `PS-14292.1` and `PS-14259.4` | PASS |
| Adjacent B31.3/restraint tests and baseline classification | PASS |
| Issue 776 XML-CII Authority Validation, run `36606373345` | PASS |
| Issue 776 focused authority regressions | PASS |
| PR780 master dataset regressions | PASS |
| Exact-head WSW browser conversion + dataset browser scale | PASS |
| XML CII Browser Semantic Core Timing, run `36606373338` | PASS |

The final relay/report-only commits after the material head do not alter production or test behavior; GitHub automatically re-runs the same workflows on the final PR head.

## Backup truth

Repository policy requested the native `node utils/backup.js save ...` mechanism. The connector-only execution environment could not truthfully execute that native command.

```text
native backup utility = NOT_RUN / ENVIRONMENT_BLOCKED
connector exact pre-edit Git blob backups = COMPLETE
```

Exact recovery copies are under `.backups/issue-781/p0/` and this limitation is not represented as a native backup execution.

## Falsifiers / do-not-reopen guidance

Reopen STEP-781-01 only if one of these is observed on a current head:
- live Preview has rows but the B31.3 action is absent solely because the legacy cache is empty;
- B31.3 evaluates legacy/cache rows instead of the current Preview result when live rows exist;
- either cited explicit `+Y` benchmark loses type 14 before final CII;
- custody audit changes retained component/ref/geometry authority;
- a new inferred REST fallback is required by evidence not covered by the explicit-source cases.

Do **not** reinterpret disappearance of the standalone ATTA node number/name after the <=6 mm collapse as proof that the numerical restraint vanished; inspect retained-node restraint custody and final CII first.

## Remaining #781 work — not owned by this P0 PR

The following remain separate plan slices:
1. semantic line-list worksheet selection and current-head manual-refresh reproduction;
2. post-#780 Regex/Token Builder master-evidence plumbing and semantic result taxonomy;
3. Weight Match presentation clarification only;
4. material candidate/suggestion presentation using existing evidence;
5. Mode B semantic multi-XML topology compositor as a separate substantial workstream.

## Handoff contract

PR #782 is the review surface for STEP-781-01 only. It must not be expanded to the lower-priority slices above. Merge authority remains with the Owner.

## EXACT_NEXT_ACTION

Publish `TASK_RESULT` on #781 for STEP-781-01, refresh PR #782 description with the resolved RCA/evidence, mark PR #782 ready for Owner review, and begin the next approved #781 slice on a separate bounded delivery surface rather than widening this PR.
