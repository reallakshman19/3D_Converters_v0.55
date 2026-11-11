# PR367 — XML229 Native Lineage Failure-Code Coverage — 2026-11-01

STATUS: DRAFT_PR_OPEN / ENGINEERING_CRITICAL / REVIEW_REQUIRED
REPO: reallakshman19/3D_Converters
BASE_MAIN_SHA: 3d1da02c00c51d2c9b4548c62ce97e4fd875be73
BRANCH: fix/xml229-native-lineage-codes-20261101
PR: https://github.com/reallakshman19/3D_Converters/pull/367
IMPLEMENTATION_HEAD: 1ab1cd2abf48718b74a2ae04906930d9d904adc8
REVIEW: NOT_RUN; CI: IN_PROGRESS (initial workflow snapshot)
TAKEOVER_AUTHORITY: READ_ONLY (not a takeover of PR362; new limited fix)
SOURCE_REPORT: Owner-supplied native Run debug JSON, elapsed 19627 ms,
ORIGINAL_LINEAGE_STAGE, UNCLASSIFIED_EXCEPTION, no authorized CII.

## Isolation
Current Python native lineage and pre-Final restraint validators can raise 12
typed NATIVE_* guard codes which the JS native failure classifier omits. The
engine already conveys a bounded Python code; the UI converts these omitted
codes to UNCLASSIFIED_EXCEPTION. This is a VERIFIED code-coverage defect,
but the Owner's exact underlying exception cannot be determined from the
sanitized receipt; do NOT claim the Owner's CII conversion now succeeds.

## Patch boundary and invariants
Add precisely the 12 missing typed guard codes to the production diagnostic
allowlist in source and served docs, with a test enumerating current Python
native guard literals and demanding full coverage. Unknown codes, arbitrary
stderr, file paths, and exception messages remain undisclosed; no changes
to Final/geometry/lineage checks, numerical writer, mass scale, Worker,
download authority, or independent native CII reconciliation.
Pre-edit bytes preserved in two .backups files in the same commit.

## Validation and limits
STATUS=PASS (static review): source/docs original bytes matched; all
12 missing codes isolated by comparing Python guard literals and JS allowlist.
STATUS=NOT_RUN (runtime): Node test and actual Owner browser/Pyodide/native
conversion not executed in the GitHub-only environment; CI needed.
ORACLE: production Python guard literals, static comparison; not independent
engineering acceptance.
BENCHMARK: Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml
is present on main (31 Branch elements / 1196 Node elements).
Owner's active Worker source/master basis and accepted Final packet
were not supplied and cannot be reconstructed from this public XML.
Source-attested mass census readiness is not emitted-output verification.

HIGHEST_RISK: This patch improves typed failure diagnosis but cannot
guarantee a successful conversion. A retry may report a genuine
NATIVE_PHYSICAL_LINEAGE_* or NATIVE_PREFINAL_RESTRAINT_* hold; do not
force release. Many XML229 PRs remain open and overlap adjacent authority.
EXACT_NEXT_ACTION: Run focused Node test and CI on this branch, then retry
the exact Owner source/master/Final workflow in a refreshed browser and
inspect the newly classified native failure code. If it still reports
UNCLASSIFIED_EXCEPTION, reproduce from the trusted local Python traceback
without publishing paths or source data, then fix that isolated cause.
No merge or deployment authorized.

## Publication checkpoint
DRAFT PR367 opened against main 3d1da02c; one implementation commit,
source/docs parity verified by fresh GitHub file read, static Python-code to
JS-allowlist coverage complete. At publication initial workflows were queued
or in progress, no green claim. This records only code diagnostic coverage,
not confirmation that the exact Owner failure was a typed-code omission.
No merge, production deployment, or CII release authorized.

## BM2 served Python parity follow-up — 1 November 2026
The live native-python-source-transfer CI job failed before execution because
root xml_to_cii2019_patched.py already contained a BM2 `P4110001` to unique
`4110001` linelist fallback but docs' deployed Python copy did not. The
only root/docs difference is that exact six-line fallback; root was NOT edited.
This PR now copies the root version to docs, with pre-edit served bytes backed
up and a Python regression for unique, exact, ambiguous and unrelated keys.
This does not bypass the current Worker or establish lineage/Final mass success.
STATUS: source/docs parity PASS by full-text comparison; Python test NOT_RUN
outside CI. CI previously observed unrelated legacy test failures, not waived.
EXACT_NEXT_ACTION: review resulting native Python parity CI and new unit,
then reproduce exact BM2 Final/Run in browser after integration, and inspect
classified native stage. Retain CII HOLD absent independent reconciliation.
