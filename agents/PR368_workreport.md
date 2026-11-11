# WIP-XML229-PYODIDE-MAPPER-20261101 — Native ORIGINAL_LINEAGE_STAGE module-bundle repair

STATUS: DRAFT_PR_OPEN / ENGINEERING_CRITICAL / SUBSTAGE_CI_PASS / FULL_CI_PARTIAL_FAILURE
TAKEOVER_AUTHORITY: NOT_A_TAKEOVER_NEW_SCOPED_WORK
BASE_SHA: d8ce6ce7bbb5dc3108360201a3312da02210fe27
BRANCH: fix/xml229-pyodide-prefinal-mapper-20261101
PR: https://github.com/reallakshman19/3D_Converters/pull/368
HEAD_AT_CI: be14015c5b47c5fe3ca02e5eb48033171bddbd4d
SOURCE: Owner's fresh BM2 Run report, 31 Branch / 1196 Node XML, accepted Final census,
  native failure ORIGINAL_LINEAGE_STAGE / UNCLASSIFIED_EXCEPTION.
FIRST_HELD_BOUNDARY: worker-r2-and-native-candidate
REVIEW: NOT_RUN
CI: PARTIAL_PASS / NON-GREEN (see below)
EXACT_NEXT_ACTION: Independent reviewer assesses PR368 and overlapping engine edits
  from #329/#312; after Owner-approved merge/deployment hard-refresh browser to restart
  Worker, retry exact BM2 source/master/accepted-Final Run, and independently reconcile
  emitted CII before release.

## A1 Production trace
The standalone Engine's SCRIPT_FILE_NAMES array copies only enumerated Python files into
Pyodide /scripts. converters/scripts/xml_to_cii2019_runtime_custody.py marks
ORIGINAL_LINEAGE_STAGE and calls stage_native_original_lineage.
xml229_native_final_mass_binding.py:_validate_finalized_geometry imports
xml229_prefinal_restraints.py:replay_prefinal_restraints, whose top-level import requires
xml229_support_type_mapper: mapped_support_kind. The mapper exists at root/docs scripts
but was OMITTED from both root/docs engine.js lists. Fresh Worker import therefore raises
ModuleNotFoundError before any native mass/CII output. Engine catches unexpected Python
exceptions as UNCLASSIFIED_EXCEPTION; current manifest cannot include output artifacts.

## A2 Isolation and falsifier
A deterministic, file-inventory packaging omission is verified from live current main.
The new isolated subprocess test copies exactly the 3-file import dependency into
a fresh temp directory, first without mapper (expected ModuleNotFoundError), then
with mapper (import succeeds); also enforces deployed/root parity and exact inclusion
in the Worker list. This is source/path fault reproduction, not the actual private
Owner Final execution. If post-fix Owner Run still fails at this stage, capture the
next typed diagnostic and local trusted Python exception; do not presume other causes fixed.

## A3 Authority and invariants
Fix is restricted to bundling an existing Python module. No transformation, data master,
source XML/JSON, SIF/topology semantics, Final weights, lineage decisions, runtime/writer
selection, Pyodide version, CII serialization, independent reconciliation or download
authority changes. Continue to fail closed if further guards fail. No hidden mocks, no
source data or tracebacks published in UI.

## A4 Validation and independent oracle
Static live-GitHub source inspection: PASS — referenced module exists, is pure stdlib,
both engine inventories omitted it before patch, root/docs copies were byte-identical.
Isolated Python subprocess regression: NOT_RUN until CI; tests against a negative missing-
module control and positive physical file copy. End-to-end Owner BM2 with Final receipt:
NOT_RUN; private packet/config/working master basis unavailable. Separate non-author CII
engineering acceptance: NOT_RUN. CI state must be checked at current PR head.

## A5 Minimal patch and coordination
Only add 'xml229_support_type_mapper.py' to the Python Worker script list in
converters/xml-cii-2019-standalone/engine.js and its docs mirror. Add the
isolated import regression into existing native-python CI-invoked test file
tests/xml229-native-substage-diagnostic.test.py.
Backups:
- .backups/20261101-xml229-mapper-root-engine.bak
- .backups/20261101-xml229-mapper-docs-engine.bak
- .backups/20261101-xml229-mapper-native-substage-test.bak

PR #329 and PR #312 both modify engine.js: COORDINATION_REQUIRED before rebasing
or integration. Other XML229 Final/Weight/Preview/topology WIPs remain independent
review boundaries. No branch merge or deployment authorized by this work item.

HIGHEST_RISK: The Owner packet might expose another independent native validation failure
once Python imports succeed. Do not issue a CII download until the actual emitted artifact
passes the independent full-source/Final lineage and mass reconciliation.
UI summary mentions 19.2s while supplied debug JSON records 5.053s; these may
represent different attempts and are not treated as a single timing measurement.


## Post-publication CI checkpoint — current PR head be14015c5b47c5fe3ca02e5eb48033171bddbd4d
PASS: native-python-source-transfer GitHub job 124784444618. Native stage test
tests/xml229-native-substage-diagnostic.test.py ran 4 tests in 0.060s, all passed.
This includes the isolated import negative/positive test: without packaged
xml229_support_type_mapper.py, the fresh interpreter cannot import the
pre-Final validator; with the exact module copied into the worker subset,
import succeeds. Source/docs Python compile and mirror stages also passed.
PASS: 24 Python native mass-consumption tests in the same job.
FAIL: independent-js-cii-mass-check (22/24) jobs 124784444412/124784444557
report 102 passed / 3 failed, same source-string expectation names as PR367
(Run Worker O1 default restraints, shared interpreter reset, UI failure phase).
These tests were not edited in PR368. Their continued failure is not waived.
The exact Owner BM2 Final packet/masters and real browser CII emission remain
NOT_RUN; a successful module import is not independent engineering CII
release authority. Root/docs engine source parity after edit: PASS.
No merge or deployment was performed.
