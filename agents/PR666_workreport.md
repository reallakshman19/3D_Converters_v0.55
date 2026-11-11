# PR666 — KD320 Formal Q1 Exit / Q2 Admission Gate

## Recovery header

- PR: #666
- TITLE: `qual(hp): enforce formal KD320 Q1 exit before Q2 admission`
- BRANCH: `agent/hp-kd320-q1-formal-exit`
- BASE: `main@e67b5790a8c6f63ff1fc33edd848facfdc90537a`
- PREDECESSOR: PR663 merged at base SHA.
- CRITICALITY: ENGINEERING_CRITICAL
- PR_STATE: OPEN_DRAFT_HANDOVER_READY
- BACKUP: `backup/hp-kd320-q1-formal-exit-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR666
- PRODUCTION_KERNEL_CHANGED: NO
- UI_CHANGED: NO
- LICENSED_SOURCE_CONTENT_ADDED: NO

## Handover in 60 seconds

PR666 closes a real qualification-boundary bypass. Formal Q1 already requires verified source custody, all 14 independently checked semantics, E01-E08 PASS and G0/G1 PASS. Q2 previously reduced this to receipts + semantics only.

The new redacted Q1 exit attestation is required before Q2 can set `q1Complete=true` and is bound by SHA-256 references to the controlled evidence ledger/audit report plus the exact candidate receipt hashes and semantic source/locator/opaque-ref records.

```text
old: q1Complete = receiptsComplete && semanticsComplete
new: q1Complete = receiptsComplete && semanticsComplete && q1Exit.ready
```

Canonical binding is independently enforced:

```text
SEM001      -> Q1-SRC-B313-2024
SEM002-014  -> Q1-SRC-VIII3-2025
```

PR666 also repairs the stale post-PR663 candidate fixture and restores explicit missing-oracle blockers after formal Q1 completion. Malformed Q1 exit schema/record/authority/duplicate-set defects propagate as structural Q2 failures; incomplete evidence remains a normal pending state.

## Authority boundary

```text
production route             USER_CALCULATED_KD3
nativeCoreKd3Qualified       false
codeCompliance               false
canUseForDesignAuthority     false
productionKernelAllowed      false
automaticPromotionAllowed    false
```

No Code equation, fatigue-curve data, licensed source text, native arithmetic, product UI, workflow or release promotion is added.

## Final changed-file ledger — 16 intended paths

Qualification implementation/docs:

1. `engineering/hp-class-standardization/qualification/kd320-q1/formal-exit.js`
2. `engineering/hp-class-standardization/qualification/kd320-q1/formal-exit-attestation.template.json`
3. `engineering/hp-class-standardization/qualification/kd320-q1/README.md`
4. `engineering/hp-class-standardization/qualification/kd320-q2/intake.js`
5. `engineering/hp-class-standardization/qualification/kd320-q2/candidate.template.json`
6. `engineering/hp-class-standardization/qualification/kd320-q2/README.md`

Tests:

7. `tests/b313-chapter-ix-kd320-q1-formal-exit.test.mjs`
8. `tests/b313-chapter-ix-kd320-q2-blocker-enumeration.test.mjs`
9. `tests/b313-chapter-ix-kd320-q2-candidate.test.mjs`
10. `tests/b313-chapter-ix-kd320-q2-template-contract.test.mjs`

Recovery:

11. `agents/WIP-hp-kd320-q1-formal-exit_workreport.md`
12. `agents/status/WIP-hp-kd320-q1-formal-exit.yaml`
13. `agents/claims/WIP-hp-kd320-q1-formal-exit.yaml`
14. `agents/PR666_workreport.md`
15. `agents/status/PR666.yaml`
16. `agents/claims/PR666.yaml`

## Validation ledger

```text
base main                              e67b5790a8c6f63ff1fc33edd848facfdc90537a
head before final recovery sync        4bd1b0a20a82fe8ed0f8258d8b3f262f97037149
relation at final engineering check    ahead 20 / behind 0
changed files                          16 / 16 intended
GitHub mergeable                       true
formal-exit.js                         160 lines
q2/intake.js                           279 lines
formal-exit.js syntax                  PASS / LOCAL_EXECUTION
q2/intake.js syntax                    PASS / LOCAL_EXECUTION
focused exact-byte suite               PASS 27/27 / IMPLEMENTATION_COUPLED
receipt+semantic formal-Q1 bypass      PASS / blocked
E08 omission                           PASS / blocked
G1 omission                            PASS / blocked
receipt hash mismatch                  PASS / blocked
semantic locator/ref mismatch          PASS / blocked
canonical source mismatch              PASS / blocked
attestor/checker collision             PASS / blocked
attestation authority promotion        PASS / blocked
QF022/QF023 custody                    PASS
missing oracle after formal Q1         PASS / explicit blocker
same candidate through file verifier   PASS
commit status entries                  0 -> NOT_RUN, not PASS
PR-triggered workflow runs             0 -> NOT_RUN, not PASS
reviews / review threads               0 / 0
full repository-native suite           NOT_RUN / ENVIRONMENT_BLOCKED
served browser                         NOT_RUN / NO_UI_CHANGE
independent KD320 qualification        NOT_RUN / REAL_CONTROLLED_EVIDENCE_PENDING
```

Focused execution used exact committed module/test bytes; Git blob identities were compared between the executed local files and GitHub. The container still cannot resolve `github.com` for a native checkout. Final recovery-only commits after the engineering check do not alter the 16-file scope or engineering implementation.

## Real remaining engineering blocker

PR666 does not fill controlled evidence. Q1 still requires real independently checked evidence for:

```text
Q1-SRC-B313-2024
Q1-SRC-VIII3-2025
KD320-SEM-001...014
E01...E08 PASS
G0,G1 PASS
formal exit attestation + independent check
```

Only after formal Q1 exit may Q2 admit QF022/QF023. Native KD320 remains non-authoritative after Q2 until later software qualification/release.

## Appendix A — takeover questions

1. Can receipts + semantics ever produce `q1Complete=true` without a formal exit attestation? They must not.
2. Does the attestation bind both document hashes and all SEM001-014 source/locator/opaque refs?
3. Are E01-E08 and G0/G1 exact required sets?
4. Is SEM001 bound to B31.3 and SEM002-014 to VIII-3 independently of caller data?
5. Do malformed attestation schema/record/authority/duplicates become structural failure?
6. Are missing evidence items pending rather than silently defaulted?
7. Are missing QF022/QF023 slots explicit after Q1 completion?
8. Is `USER_CALCULATED_KD3` still the only production route?
9. Has any licensed text/equation/curve point entered the public repository? It must not.
10. Which checks are PASS versus NOT_RUN?

## EXACT_NEXT_ACTION

Leave PR666 draft and unmerged. Before any merge decision, re-ground live main/head, verify the same 16-file scope, refresh status/workflow/review truth, and obtain explicit owner authorization for PR666. After merge, the next engineering work is real controlled Q1 evidence population/review, not native KD320 arithmetic.
