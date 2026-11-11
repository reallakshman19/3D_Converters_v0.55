# PR700 — M15 Evidence-Linked RCA Authoring — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #700
BRANCH: agent/vib-m15-rca-authoring-20260821
BASE: main
BASE_SHA_AT_START: 7aabe404c6f58db1b78756de9412ab93e867b5fe
PREDECESSOR_PR: 699 (MERGED)
PREDECESSOR_MERGE: 7aabe404c6f58db1b78756de9412ab93e867b5fe
CURRENT_MAIN_LAST_RECONCILED: ca8d391ac5f829f53bebb3c37adf0547c34a67b4
REPORT_SOURCE_BASIS_HEAD: 47434cbfdd29b537bd1eaf29dc44ec1b9b797060
HOSTED_RECONCILIATION_BASIS_HEAD: 47434cbfdd29b537bd1eaf29dc44ec1b9b797060
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

`REPORT_SOURCE_BASIS_HEAD` is the source implementation/test basis before recovery-only synchronization. Later recovery commits may move the branch head without changing the source semantics below.

## Mission
Implement the first M15 root-cause-analysis product slice after merged M14 measurement/verification authoring. RCA consumes exact project/action/verification custody, captures explicit hypotheses with evidence FOR/AGAINST, and permits only explicit engineer-attested conclusions. The platform cannot autonomously infer or confirm root cause and RCA cannot alter screening, applicability, AssessmentCompleteness, action completion, design, code or safety authority.

During independent audit of M15 prerequisites, two M14/M15 custody defects were found and repaired because accepted M14 verification is a prerequisite for `CONFIRMED_ROOT_CAUSE`.

## Product flow

```text
current project + exact current action occurrence
  -> exact project-scoped M14 verification attachment V2
  -> semantically validated verification status/disposition
  -> evidence + verification-status fingerprints
  -> RCA hypothesis
  -> explicit evidence FOR / AGAINST
  -> optional explicit engineer conclusion
  -> append-only project-scoped hypothesis revisions
  -> Activity presentation + observational audit
```

## Authority contract

```text
engineeringAuthority                NONE
screeningAuthority                  NOT_AUTHORIZED
designAuthority                     false
numericalAuthority                  NONE
completionAuthority                 NONE
rootCauseAuthority                  EXPLICIT_ENGINEER_ATTESTATION_ONLY
platformRootCauseInference          false
autoConfirmAllowed                  false
determinesApplicability             false
determinesAssessmentCompleteness    false
determinesCompletion                false
determinesGoverningResult           false
codeCompliance                      false
safetyAuthority                     false
```

`CONFIRMED_ROOT_CAUSE` requires explicit engineer ID/reason plus at least one supporting M14 record whose semantically validated verification state is `VERIFICATION_EVIDENCE_ACCEPTED`. An open hypothesis may exist without a conclusion. RCA never completes an M13 action.

## M14 prerequisite integrity hardening

### Finding A — verification status/disposition not bound to attachment identity
Merged M14 V1 bound measurement hashes but did not bind the complete verification status/disposition semantics. M15 consumes accepted verification, so this was material.

Current contract is `VibrationActionVerificationAttachment.v2`. V2 adds `verificationStatusFingerprint`, validates status/disposition semantics independently, and binds both `evidenceFingerprint` and `verificationStatusFingerprint` into `attachmentId`.

`action-verification-integrity.js` enforces:

```text
status schema + requirement/mechanism/type + exact scenario scope
exact verification-status authority
status evidence summary == attachment evidence
canonical engineer disposition
exact disposition requirement/mechanism/scope
all disposition references belong to attachment evidence
accepted disposition has no missing required product type
accepted disposition references products covering each required type
status state == evidence/disposition-derived state
no unsupported/non-canonical status fields
```

### Finding B — raw/product hashes did not bind calibration/acquisition/provenance
V2 initially retained only raw-data and derived-product hashes in the compact attachment evidence snapshot. That allowed calibration certificate, acquisition configuration, sensor/source provenance, or processing provenance to change while raw/product hashes remained identical.

Repair at `REPORT_SOURCE_BASIS_HEAD`:

```text
evidence.sessions[].measurementRecordFingerprint
  = SHA256(full governed VibrationMeasurementSession.v1)

evidence.products[].measurementRecordFingerprint
  = SHA256(full governed VibrationSignalProduct.v1)
```

The outer `evidenceFingerprint` therefore changes when calibration/acquisition/provenance changes, and `attachmentId` changes with it, while the compact raw/artifact hashes remain available for direct trace.

The new regression proves `CERT-1 -> CERT-2` changes session record fingerprint, evidence fingerprint and attachment identity while raw and artifact hashes remain unchanged.

### Integrity boundary
These SHA-256 values provide deterministic self-consistency/tamper-evidence custody only.

```text
reviewerIdentityAuthentication = NOT_AVAILABLE_USER_DECLARED
engineerIdentityAuthentication = NOT_AVAILABLE_USER_DECLARED
digitalSignature               = false
signerAuthenticity              = NOT_AVAILABLE
```

They are not PKI signatures, authenticated identity, trusted timestamps, screening authority, design authority or root-cause inference.

## M15 RCA custody
- M15 sees verification records only for exact `projectId + occurrenceId`.
- Current records are parsed through the V2 M14 assertion path.
- RCA evidence snapshots retain attachment ID, requirement ID, verification state, evidence fingerprint and verification-status fingerprint.
- Same record cannot be both FOR and AGAINST.
- RCA editor is pinned to `occurrenceId + actionId + runId + projectId + verification revision key`.
- Verification/project/run drift after editor open fails closed as stale.
- Hypothesis fingerprint commits project, occurrence, hypothesis ID, mechanism, statement, evidence and engineer conclusion.

## Append-only RCA evolution and attestation hardening
RCA history uses immutable revisions:

```text
hypothesisRevision = 1, 2, 3, ...
```

Global sequence and per-hypothesis revisions are contiguous. Identical no-change revision is rejected.

### Finding C — concluded hypothesis could be anonymously downgraded
The initial ledger allowed a revision after `CONFIRMED_ROOT_CAUSE` or another explicit conclusion to contain `conclusion=null`. That retained history but allowed the effective latest state to become `HYPOTHESIS_OPEN` without engineer attestation.

Repair:

```text
if prior revision has engineer conclusion
and next revision has conclusion == null
=> VIBRATION_RCA_LEDGER_CONCLUSION_ATTESTATION_REQUIRED
```

A concluded hypothesis may be revised/de-escalated only with another explicit engineer conclusion, e.g. `INCONCLUSIVE` or `NOT_SUPPORTED` with engineer ID/reason. The platform cannot anonymously erase/deactivate an engineer conclusion.

## Inherited M14 Activity defect fixed
PR699 audit success path read nonexistent `attachment.evidenceSnapshot`. Current code uses:

```text
attachment.evidence.sessions.length
attachment.evidence.products.length
```

and the regression forbids the obsolete field.

## Activity workspace

```text
Measurement / verification evidence
Root-cause investigation
Explicit required-action completion
Activity journal
```

Ordering expresses dependency only; it grants no engineering authority.

## Effective production/test source

```text
converters/vibration/facility/action-verification-integrity.js    159
converters/vibration/facility/action-verification.js              <300
converters/vibration/rca/contracts.js                              258
converters/vibration/rca/ledger.js                                 135
tabs/vibration-integrity-rca-audit.js                               15
tabs/vibration-integrity-rca-controller.js                         239
tabs/vibration-integrity-rca-view.js                                82
tests/vibration-integrity-rca-authoring.test.mjs                   287
```

Shared UI deltas remain narrow. `tests/vibration-facility-action-verification.test.mjs` is now also in the PR because the provenance falsifier extends the merged M14 regression.

Exact pre-edit backups are retained under:

```text
.backups/connector-20260821-vib-m15-rca-authoring/
.backups/connector-20260822-vib-m15-verification-provenance/
```

## Falsifiers encoded
1. M15 cannot create engineering/screening/design/completion/inferred-root-cause authority.
2. RCA unavailable without exact project-scoped M14 verification evidence.
3. M15 source record is V2 with canonical status fingerprint custody.
4. Accepted-state flip is rejected as status/disposition inconsistency.
5. Coherent disposition/state rewrite with old status fingerprint is rejected.
6. Calibration/provenance-only change alters M14 full-record/evidence/attachment identity.
7. Open evidence-linked hypothesis does not claim root cause.
8. Confirmed root cause fails without accepted supporting verification.
9. Explicit engineer confirmation does not complete M13 action.
10. Open hypothesis may later receive engineer-conclusion revision.
11. Concluded hypothesis cannot be anonymously revised back to open.
12. Same verification record cannot be FOR and AGAINST.
13. Verification revision change stales RCA editor.
14. Project identity prevents cross-project leakage.
15. Hypothesis fingerprint rejects custody drift.
16. RCA evidence requires canonical verification-status fingerprints.
17. Activity order is Verification -> RCA -> Completion.
18. M14 audit uses `attachment.evidence`, not `evidenceSnapshot`.

Authored tests are not runtime PASS until executed in a native checkout.

## Coordination
- PR699: merged M14 foundation.
- PR698 (`da5dade3...`): merged HP-only main drift; no vibration overlap.
- PR701 (`ca8d391a...`): merged HP-only main drift; no vibration overlap.
- PR665: related Project-v2 persistence; zero exact PR700 path overlap, not absorbed.
- No second open M15 RCA implementation PR was found.

Current relation at source reconciliation:

```text
PR700 ahead 45 / behind 2
behind commits = PR698 + PR701, both HP-only
mergeability = true
```

Do not manufacture a connector-side merge tree to make behind=0. Rebase/replay in a native Git-capable environment if behind-zero ancestry is required before release.

## Validation truth at source basis `47434cbf...`

```text
PASS     predecessor PR699 merged                          HOSTED SOURCE
PASS     M15 authority/custody audit                       SOURCE INSPECTION
PASS     M14 status-integrity repair                       SOURCE INSPECTION
PASS     M14 full provenance fingerprint repair            SOURCE INSPECTION
PASS     RCA conclusion revision attestation repair        SOURCE INSPECTION
PASS     exact pre-edit backups                            CONNECTOR GIT/BLOB OR EXACT COPY
PASS     physical line policy                              all production/test files <300
PASS     open-PR/main coordination                         HP-only behind commits; #665 zero overlap
PASS     GitHub mergeability                               true
PASS     reviews / threads / comments                      0 / 0 / 0
NOT_RUN  hosted status contexts                            0 returned
NOT_RUN  PR-triggered workflow runs                        0 returned
NOT_RUN  repository-native focused Node tests              ENVIRONMENT_BLOCKED: DNS cannot resolve github.com
NOT_RUN  repository-native vibration regressions           ENVIRONMENT_BLOCKED
NOT_RUN  served-browser RCA journey                        ENVIRONMENT_BLOCKED
N/A      independent numerical verification                no equation/value change
```

A direct raw GitHub transport attempt also failed with `Could not resolve host: raw.githubusercontent.com`; no syntax/runtime PASS is inferred.

## Appendix A — takeover questions
1. Why can the platform never synthesize `CONFIRMED_ROOT_CAUSE`?
2. What exact project/action/M14 identity is admissible as RCA evidence?
3. Why did M15 require strengthening M14 verification-status custody?
4. What do `evidenceFingerprint` and `verificationStatusFingerprint` bind, and what do they not authenticate?
5. Why do full measurement-session/product fingerprints matter when raw/artifact hashes are unchanged?
6. Why is `VibrationActionVerificationAttachment.v2` used instead of redefining v1 silently?
7. Why are FOR and AGAINST separate evidence directions?
8. Why does confirmed root cause require accepted supporting verification while an open hypothesis does not?
9. Why must a revision after an engineer conclusion carry another explicit engineer conclusion?
10. Which identities/revisions stale an open RCA editor?
11. Why are same-ID hypothesis updates append-only revisions rather than mutation?
12. Why can RCA not complete an M13 required action?
13. What inherited M14 Activity audit defect was fixed?
14. Which executable validations remain NOT_RUN and why?

## Exact next action
Keep PR700 draft and unmerged. Before any merge decision: reconcile final recovery-only head against live main, execute native focused/vibration tests when a checkout becomes available, run the served-browser RCA journey, and obtain new explicit owner merge authorization for PR700.
