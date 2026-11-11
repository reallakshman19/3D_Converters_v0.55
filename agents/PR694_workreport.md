# PR694 — HP Engineering Review Report Export — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #694
BRANCH: agent/hp-engineering-review-report
BASE: main
BASE_SHA_AFTER_REPLAY: 54a4f56e36c2025320ea464630fbffac9accc71d
PREDECESSOR_PR: 692 (MERGED)
PREDECESSOR_MERGE: 82cd3ddf5562f3fe990fe5f718d7d8e13e23357a
CURRENT_STAGE: READY_FOR_REVIEW_PENDING_NATIVE_VALIDATION
MERGE_AUTHORITY: NOT_GRANTED_FOR_PR694

## Mission

Add one reproducible engineer-facing HP Piping Class review dossier without creating a second numerical method.

```text
current canonical HpPipingClassProject/v2
  -> production-review validation
  -> existing canonical HP orchestrator
  -> existing hp-piping-class-result-export/v1
  -> existing result CSV/JSON round-trip gate
  -> hp-piping-class-engineering-review-report/v1
     -> standalone HTML
     -> machine-readable JSON
```

## Production outputs

```text
<class>-<revision>.hp-engineering-review.html
<class>-<revision>.hp-engineering-review.json
```

HTML is standalone and print-ready. It embeds the complete machine-readable report JSON in an `application/json` script payload.

## Report contents

- project ID / class ID / revision;
- B31.3 and VIII-3 edition identity;
- canonical units;
- design pressure and class allowances;
- exact canonical calculation IDs used by the orchestrator;
- product engineering-input basis: nominal size, basis mode, OD, allowable stress, nominal wall, minus tolerance and wall-state/brownfield inputs;
- governed basis package custody retained in machine JSON when applicable;
- spectrum, design life, operating states and governed cycles;
- deterministic class product review matrix;
- required nominal wall / pressure rating / margin / selected fatigue wall / cumulative U;
- cycle state pair, n, pressure range, CORE Salt, user Salt, external Seq/N and Ui;
- existing external KD `calculationBasis` custody including calculation reference and checker identity;
- canonical warnings/advisories;
- visible review-only authority limitations.

## Numerical ownership

`tabs/hp-piping-class-engineering-review-report.js` does not implement Chapter IX or KD equations.

It imports:

```text
buildHpPipingClassResultExport
sortHpPipingClassResultRows
verifyHpPipingClassResultRoundTrip
```

The UI enhancer re-runs the existing canonical orchestrator at export time. No report value is independently recomputed using pressure/thickness/fatigue formulae.

## Project custody

The active HP workbench can be opened from a route-context project before a persisted workspace copy exists. The report enhancer therefore follows the same custody order:

```text
stored current project
  -> if unavailable, route context hpPipingClassProject
```

Any project input edit or project-file change retires the context fallback so an old route snapshot cannot be exported after the engineer changes the working model.

## Fail-closed report transaction

Report creation blocks when:

```text
canonical result is incomplete / result.ok != true
project/result projectId mismatch
project/result classId mismatch
project/result revision mismatch
nativeCoreKd3Qualified != false
codeCompliance != false
canUseForDesignAuthority != false
calculationMode != USER_CALCULATED_KD3
existing result export round-trip != PASS
report schema/purpose/authority is tampered on JSON parse
```

Important distinction:

```text
STATIC_REFERENCE_FAIL     REPORTABLE ENGINEERING RESULT
FATIGUE U > 1             REPORTABLE ENGINEERING RESULT
CALCULATION_BLOCKED       REPORT TRANSACTION BLOCKED
IDENTITY/AUTHORITY DRIFT  REPORT TRANSACTION BLOCKED
```

A report does not turn an unfavorable engineering result into an application error.

## Authority boundary

```text
calculationMode = USER_CALCULATED_KD3
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
reportPurpose = ENGINEERING_REVIEW_ONLY
```

The HTML visibly states:

```text
REVIEW ONLY · NO DESIGN AUTHORITY
Native CORE KD-3 / KD320 not qualified
Code compliance not established
```

## Audit corrections made before handoff

### 1. Context-project export custody

Initial enhancer read only localStorage. That could spuriously block report export when the HP route was legitimately rendered from `options.context.hpPipingClassProject` before persistence.

Correction: stored project is preferred, route context is a bounded fallback, and project edits retire that fallback.

### 2. Engineer-facing input-basis completeness

Initial dossier projected canonical outputs but did not give the reviewer the full product input basis.

Correction: report/HTML now include OD, allowable stress, nominal wall, minus tolerance, wall-state inputs and canonical calculation IDs. Machine JSON retains complete `calculationBasis` / wall-state custody.

## Authored focused tests

`tests/hp-piping-class-engineering-review-report.test.mjs` covers:

1. NPS4 direct input basis (OD 114.3 mm, S 138 MPa, nominal wall 13.49 mm, tolerance 12.5%);
2. canonical calculation-ID custody;
3. NPS4 reference numerical/custody projection;
4. existing result-export round-trip prerequisite;
5. report JSON round-trip;
6. standalone HTML input/output numerical and authority tokens;
7. embedded JSON equality;
8. static-reference FAIL remains reportable;
9. project/result identity mismatch blocks;
10. project/result authority promotion blocks;
11. report schema/authority tampering blocks.

`tests/hp-piping-class-engineering-review-report-ui.test.mjs` covers:

- active route composition/cleanup;
- canonical re-evaluation at export time;
- HTML/JSON buttons only on the result matrix;
- stored-project / route-context custody and context retirement on edits;
- existing result-export numerical custody;
- no `Math.exp`/`Math.log` duplicate pressure math;
- visible review-only and external-KD-custody language.

## Validation truth

```text
current-main replay                         PASS
branch ancestry                             PASS (behind 0 at last reconciliation)
changed implementation/test/CI paths        PASS (6 intended before recovery)
source-level numerical ownership audit      PASS
source-level authority audit                PASS
source-level context-custody audit           PASS
authored report contract suite              AUTHORED_NOT_EXECUTED
native report Node suite                    NOT_RUN
HP Real Workbench PR workflow               NOT_RUN (0 workflow runs returned for exact head)
FULL_APP report download                    NOT_RUN
full repository regression                  NOT_RUN
```

Do not promote authored tests to PASS without execution.

## Changed-file ledger

Engineering/test/CI:

```text
.github/workflows/hp-piping-class-real-workbench.yml
tabs/engineering-workspace-tab.js
tabs/hp-piping-class-engineering-review-report.js
tabs/hp-piping-class-engineering-review-report-enhancer.js
tests/hp-piping-class-engineering-review-report.test.mjs
tests/hp-piping-class-engineering-review-report-ui.test.mjs
```

Recovery:

```text
agents/PR694_workreport.md
agents/status/PR694.yaml
agents/claims/PR694.yaml
```

## Next action

1. Re-read exact PR694 head and current main.
2. Execute native report contract/UI tests if a checkout-capable runner becomes available.
3. Browser-check Review Envelope -> Export review HTML/JSON -> filenames/content/print layout.
4. Reconcile exact statuses/workflows/reviews.
5. Do not merge without explicit owner authorization for PR694.

## Appendix A — takeover qualification

1. Why is STATIC_REFERENCE_FAIL reportable while CALCULATION_BLOCKED is not?
2. Which existing contract owns numerical product/cycle values used in the report?
3. Why does report export re-run the canonical orchestrator instead of using HTML text already on screen?
4. Which authority fields must always remain false?
5. What external KD custody is retained in the report?
6. Why does the standalone HTML embed the full report JSON?
7. Why must input basis and calculation IDs appear in an engineer-facing report?
8. How does the route-context fallback avoid exporting a stale project after user edits?
9. Which validations remain NOT_RUN?
