## Why multiple XML upload showed no change

PR812 was merged into the PR811 feature branch after PR811 had already merged into main. Main/Pages therefore received Rating improvements, but none of PR812's Mode B controls, XML downloads, weight custody, regex propagation or canvas fixes.

This follow-up targets **main directly**, based on e6e3458f. It salvages the exact qualified PR812 production tree at f30552b8; source/docs mirrors are identical. Current-main timing records and workflows are untouched. Prior evidence and full CII limitations are preserved.

## Visible result

In Sources, choose **Mode B — Combine XML (node offsets)**, select Source XML or current enriched outputs, then **Combine XML**. The UI lists per-file node offsets and enables **Save Combined XML** and **Save Node Offset Map**. Mode A is labeled Draft. This combines XML without automatic cross-file joins; composite CII Run is outside this bounded capability.

## Evidence

- Official Pages, two distinct real41 XML uploads: **FAIL**, zero Mode B controls, no browser errors. `live-baseline.json` and screenshot preserve this actual remote witness.
- Main-integrated native browser: **PASS**, visible Mode B, both actual downloads,82branches/3308nodes, offsets0/+100000.
- Full Mode B acceptance: **PASS**, every non-number node field unchanged; repeated IDs/negative helpers preserved; malformed/mixed units/overflow rejected.
- Focused regressions: **36/36 PASS**.
- Actual main focused gate: **28/28 local PASS**. Initial main CI exposed two obsolete structural assertions in three gates. The tests now trace canonical review authority and accepted-only weight release, and execute existing independent stale57.25kg fixtures; numerical expectations/tolerances and production remain unchanged. Initial failure logs are retained.
- Native CII publication guard: **PASS**, retained-owner positive scaling and missing/invalid owner block.
- Production tree parity with qualified PR812, source/docs parity and production whitespace: **PASS**.

Fresh evidence: `agents/evidence/WIP-781-MAIN-INTEGRATION-20261001/`. Historical PR812 evidence remains attributable to its tested head; repaired remote deployment is **NOT_RUN pending owner merge**.

## Remaining engineering limitation

**Full CII acceptance remains FAIL16**: six branch-start RIGID and ten collapsed FLAN components have no CII weight owner. Existing guard retains enriched XML and withholds incomplete CII. This integration does not alter geometry, transfer mass, change units/formulas/master data or bypass the guard. The prior explicit geometry/ownership decision remains pending. Draft status preserves that incomplete scope.

No merge authority is granted to this agent. Open PR801/794 and Mode B788–792 overlap are recorded as COORDINATION_REQUIRED; no unmerged topology stack or workflow changes imported.

Recovery report: `agents/PR813_workreport.md`. The committed net README, benchmark, workflow and main timing-record diffs are empty; a transient Windows index/cache-tree issue was repaired through an isolated temporary index and explicit committed-tree checks.
