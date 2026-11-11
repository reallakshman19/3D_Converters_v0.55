# PR356 — TEE routing through the source junction

Governing WBS: Progress Page CIIFR R4 WBS 6.5 / M29, BM2 TEE port routing and source slope; Page draft PR84, prototype head f7388938af7741c6f98af9f8923d956f0e04507c, audited events0507–0510. This extends OLET6.4 within WBS6. Native task/RCA: issue351 comments6528178717 and6527486782. Continuing builder6ae1bed6, direct Owner “fix them”; no takeover or Oracle activation. Page publication NOT_PERFORMED.

## Recovery / live truth

WORK_INTENT=IMPLEMENT; REPOSITORY_STATE=EXISTING_PR; MUTATION_AUTHORITY=WRITE_ALLOWED for bounded TEE repair; CRITICALITY=ENGINEERING_CRITICAL. PR356 open/draft; branch fix/xml229-tee-port-route-6ae1bed6. Base/main690400a012d2bbc8f53a4e192ce80addacfa1439, treecf65f13dd523f7577c31208d9bcc7d4311b32f6b. REPORT_BASIS_HEAD=bcecd2d1a61af683863a22752f0e059f76de7291, the tested production implementation. Following commit adds one PL-BM1 source test and canonical recovery; production unchanged. Current-head CI reconciliation is returned in PR356 conversation, avoiding a self-referential report SHA. Merge authority OWNER_ONLY, NOT_GRANTED.

Observable result: fresh BM2 Preview/Worker/Final/Run removes31 false TEE detours, native816→785 elements;139 physical owners and69 restraint slots unchanged. Junction2690 run DY0; junction3120 retains source DY−0.32mm. Generated helper IDs shift; compare original references/coordinates. Frozen sessions require fresh Preview/Weight/Final, never silent mutation.

## First wrong boundary / source oracle

Original BM2: Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml, Git blob2008bbcc344ef48dde95addd6a72dc9e08aee56c,629889bytes verified against live main.31 TEE groups serialize1,3,0,2. Shared cleanup retained anonymous branch-port3; finalization assigned it a positive route ID; native serial edges followed1→3→0→2. Correct serial route is1→0→2. Coordinate arithmetic itself is correct: XMLXYZ→CII(X,Z,−Y).

Ref28025: source inlet(102094,108661.53,101215), centre2690(102158,108661.53,101215), port3(102158,108661.53,101275). Old6880→6890 DX64/DY60 becomes actual6680→2690 DX64/DY0. Ref18024: inlet(102082.09,108862.03,101475.45), centre3120(102146.09,108862.03,101475.13), port3(102146.41,108862.03,101539.13). Old7450→7460 DX64.32/DY63.68 becomes actual7210→3120 DX64/DY−0.32. Do not globally zero DY.

Hypothesis/falsifier: exclude only qualified anonymous non-authoritative3 before Final. Reject if a detour survives, a real branch disappears, source slope/fields move, supports/owners drift or late guards weaken. Independent audit rejects both the unmodified baseline and deliberately restored DY60.

## Implementation / authority

New named export xml229TeeBranchPortWitnesses qualifies complete contiguous same-ref TEE1,3,0,2, a positive integer centre, finite distinct port/centre coordinates and anonymous−1 port3. Only3 leaves the serial route. Positive branch ports and incomplete/mixed/degenerate groups remain unchanged. Named, restraint, rigid, nonzero/invalid mass or SIF authority on removable3 throws TEE_BRANCH_PORT_AUTHORITY_CONFLICT. Original occurrence/drop reason TEE_BRANCH_PORT_WITNESS stays in the ledger. Root/docs integration is shared by actual Preview and canonical Worker before assignSourceNodeNumbers and Final.

Protected: original XML bytes/coordinates/positive identities, physical-owner predicates, bore authority, Final kg and confirmed zero, defaults, axes, native writer/runtime choice, late geometry/mass guards, independent reconciliation, release gates and workflows. Separate flange weight/bore RCA and PR354 enriched-download remain unchanged.

## Coordination

Root AGENTS and .agents read/hash-verified; no deeper applicable AGENTS; agents/MASTER_INDEX.md absent404.265 initially materialized files matched live main; additional read-only test dependencies fetched at exact main. Publish only explicit paths. Mandatory backups made; generated outputs/backups excluded.

PR355 OLET merged996b17e7, despite historical main report/claim saying review-ready. Shared ledger is a predecessor, not competing implementation. PR354 production paths disjoint; avoid its native-cli test file by importing through existing OLET test. PR335 short simplification, PR346 canvas and PR329/312 orchestration remain untouched. Historical BORE/topology claims disclosed, not silently rewritten. SAFE for this bounded continuing Owner assignment, not broad runtime authority.

## Validation ledger

- PASS LOCAL_EXECUTION / ORIGINAL_SOURCE: ElementTree independently parses31 BM2 groups and both marked vectors; every removed witness has−1 ID, zero Weight/SIF and no Rigid/name/restraint authority.
- PASS LOCAL_EXECUTION / IMPLEMENTATION_COUPLED: TEE/OLET12/12; native CLI and independent mass suites27/27. Positive ports, mixed/missing refs, incomplete/degenerate geometry and authority conflicts covered. Explicit node test doubles are disclosed; genuine DOM tested separately.
- PASS LOCAL_EXECUTION / ORIGINAL_PRODUCTION_REPRODUCTION: genuine xmldom0.9.8, parsed shipped config plus1595 embedded default weight rows, actual xmlCiiDryRunPreview, createPreviewBasis/projectXmlCiiOccurrences and openXml229EngineeringFactModel. BM2 has31 branches/1196 source occurrences/139 owners; retained847→816. Fresh unmodified current-main baseline generated separately.
- PASS LOCAL_EXECUTION / INDEPENDENT_REPRODUCTION: actual runtime-custody native CLI, all late/finalized guards unchanged;816→785 elements/69 restraints. Independent JavaScript emitted-CII reconciliation verifies139/139 owners. Controlled test Final0kg inputs are not Owner session decisions or mass approval.
- PASS LOCAL_EXECUTION / INDEPENDENT_REPRODUCTION: scripts/audit-xml229-bm2-tee-output.py independently parses source, packet custody and actual fixed-column CII.62 run vectors match source; graph differs by exactly31 parent detour replacements. All other source fields/edges,139 owners,69 restraint slots and complete RIGID/BEND/SIF&TEES/REDUCERS payloads unchanged. Real B4110009 branch at3120 remains exactly once, junction degree3. Four real branch edges share tee-port coordinates; auditor disambiguates by authored branch label. Initial auditor coordinate-only ambiguity was corrected without production/tolerance changes.
- PASS LOCAL_EXECUTION / INDEPENDENT_NEGATIVE: corrected-output audit rejects original baseline and a tampered DY60. No source/oracle substitution or tolerance weakening.
- PASS LOCAL_EXECUTION / ORIGINAL_SOURCE + INDEPENDENT_REPRODUCTION: full PL-BM1 has8 TEE templates,3 spatial and5 wholly coincident. Only3 spatial witnesses excluded; coincident groups unchanged. Actual Worker/native1492→1489 elements;98 owners/309 restraint slots, all other fields/edges and BEND/RIGID/SIF/REDUCERS payloads unchanged. Independent mass reconciliation98/98 PASS. Existing DN250/branchDN300 and connected DN50 regressions PASS.
- PASS REMOTE_EXECUTION at bcecd2d1: native Python3+3+24+9; independent JS Node22/24 each84/84; actual Preview, existing-stages Chromium and EF05 native XML-only E2E. The extra PL-BM1 test follows in the validation/recovery commit; final-head checks are recorded in PR conversation. No native CAESAR import inferred.
- CI overall FAIL at bcecd2d1:68 PASS/15 failed preflights, every failure log inspected.13 require historical merge-base4f14beb37bc0b719453c52a116c1c5d7183d2fd0;835/884 qualification-only allowlists reject production changes before tests. Origin PREEXISTING_WORKFLOW_SCOPE_CONFIGURATION; workflows unchanged. These remain reviewable CI blockers.
- Local broad P4 producer suite incomplete due missing historical Firstpass/staged/EF05 fixtures, served mirrors and CLI dependencies in this sparse checkout. These environment failures are not product PASS. Real BM2/PL production executions and remote Preview/browser/native checks are separately recorded above.
- NOT_RUN: Owner fresh session trial, screenshot816 CII byte identity, native CAESAR import, Page browser visual QA, non-author engineering review. Review threads empty when inspected; no approval inferred.

BM2 actual CII SHA25619e97f058c4633553002363d9784267b98c9fb7c81984bc72399e2a26e34b5a8. Native diagnostic release flag false; a controlled-test mass reconciliation does not authorize an Owner output.

## Changed-file ledger / reproduction

Production4: root/docs integration/xml229-tee-port-route.mjs and ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js. Validation3: tests/xml229-tee-port-route.test.mjs, existing tests/xml229-olet-helper-route.test.mjs (new import only), scripts/audit-xml229-bm2-tee-output.py (uses prior independent read-only CII reader, no production imports). Recovery6: canonical PR356 report/status/claim and3 WIP pointers. Total13 intended paths; no source benchmarks, workflows, dependencies, writer, masters or generated packets.

Focused: TMPDIR=<existing-temp> node --test tests/xml229-native-cii-real-cli-e2e.test.mjs tests/xml229-native-cii-independent-reconciliation.test.mjs. Original repo benchmarks parsed with ElementTree.

Production reproduction: genuine DOM; parsed DEFAULT_XML_CII_2019_SUPPORT_CONFIG plus DEFAULT_WEIGHT_MASTER_ROWS; actual Preview/projectXmlCiiOccurrences and source-bound createPreviewBasis/digestUtf8/openXml229EngineeringFactModel; retain finalizedGeometry and physicalOccurrences. Harness supplies explicit controlled Final0kg, never Owner acceptance. Native: python3 converters/scripts/xml_to_cii2019_runtime_custody.py --input SOURCE.xml --output OUTPUT.cii --weight-scale 10 --xml229-native-final-packet PACKET.json --xml229-native-mass-proof PROOF.json.

Independent: python3 scripts/audit-xml229-bm2-tee-output.py --source ORIGINAL_BM2.xml --packet FIXED_PACKET.json --cii FIXED.cii --baseline-packet MAIN_PACKET.json --baseline-cii MAIN.cii. Scratch tee-fix contains source/config/packet/CII/proof and audit receipts; source expectations and commands are preserved here.

## Risks / exact continuation / Appendix A

RISK1: broad port deletion or DY zeroing would lose real authority/slopes; source qualification and conflict guards bound this repair. RISK2: generated IDs shift, use original refs/ordinals. RISK3: frozen sessions require regeneration. DEC1: fix upstream roles, leave native writer and late guards intact. DEC2: keep separate flange/default findings unchanged.

EXACT_NEXT_ACTION: reviewer/Owner inspect PR356 bounded diff, source-vector/branch/support evidence and historical CI blockers; after separately authorized merge/deployment, reload and run fresh BM2 Preview/Weight/Final/Run, checking2690 DY0 and3120 DY−0.32. Native CAESAR import and engineering acceptance pending. No further production mutation required for this return.

Appendix A NOT_REQUIRED_FOR_TAKEOVER: same continuing direct-Owner builder/new bounded assignment. No incoming PR takeover, self-exam score, independent approval or merge authorization claimed.
