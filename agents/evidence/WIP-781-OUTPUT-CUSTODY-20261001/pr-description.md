## Draft: full CII acceptance still fails for16 components

Stacked on PR811 (Rating prefix/manual/class fill), not ready for merge. Owner-expanded follow-on for #781 plus requested Mode B XML save. No merge authorization.

### Delivered

- Release manual/final and validated Match1 weights after canonical geometry preparation, including components without master candidates and replacement of previous positive XML values.
- Hydrate the uploaded weight master for run review; show saved/XML/proposed values and proposal method. Preserve unchanged stale-basis rejection.
- Invalidate old single/batch outputs on changed engineering inputs/options; dispose/refresh the existing canvas renderer.
- Add Sources Mode B combine/save XML with positive node offsets and an offset-map download. Preserve source geometry, engineering fields and same-source shared IDs. Source XML or current enriched outputs can be selected. Mark Mode A Draft. This bounded XML composition adds no cross-file joins and does not promote the unmerged PR788–792 composite runtime stack.
- Audit actual existing CII to-node weight owners before publication. Withhold an incomplete CII and retain enriched XML, without transferring mass or changing geometry, formulas, units, writer or runtime ownership.
- Refresh the actual source/docs import chain so repaired children are loaded.
- Follow-up: synchronize automatic regex mappings even when selections are unchanged, apply/lock text rule edits immediately, and protect saved/manual weights from exact/all bulk suggestions. Explicit per-row selection may replace a value; final review Apply accepts displayed inputs without clicking every suggestion. Current release20261001-weight-output-2.

### Actual acceptance evidence

| Check | Result | Evidence / oracle |
|---|---|---|
| Real41 UI saved57.25/13.5, uploaded1595-row master, review Apply Run | XML174/174 exact PASS | Native browser/Pyodide downloads; independent entered constants |
| Actual pre-guard CII export | **FAIL16 missing owners**;158 represented weights correct at selected scale10 | Independent XML/CII artifact audit, exits2;182 rigid payload rows |
| Active export guard on same workflow | PASS: identifies16, CII disabled, enriched XML174/174 retained | Actual docs UI and Python runtime, no mock |
| Retained owners and missing head/helper | PASS | Native actual CLI;17.75kg→177.5 and13.5kg→135 at selected scale10; missing owners publish no CII |
| Canvas current output, refresh, new source | PASS | Actual WebGL renderer:1165 output nodes→1654 new-source nodes |
| Mode B two real41 XML files | PASS82branches3308nodes | Actual save; every non-number node field unchanged; second offset100000 |
| Rating workflow responsiveness | PASS | Real41 UI, maximum frame gap150ms under unchanged250ms limit |
| Staged/10k/50k/100k worker paths | PASS | Existing browser benchmarks; fastpath538.6ms/33.2ms frame; largest ranking64.2ms |
| Focused Node regressions | PASS36/36 | Mixed independent behavioral and explicit static delegation/cache assertions |
| Follow-up regex propagation / saved-weight precedence | PASS | Native production panels:5/3 then edited6 propagate;57.25/13.5/sourceB91.25 survive bulk; blank30 fills; explicit replacement20 only. Full41 replay also preserves saved weights across phase6 and both review bulk buttons, without per-row clicks. |
| Explicit restraint fixture check | NOT_RUN | Sparse checkout lacks SYS-6-S8810011-01.xml; no product assertion reached |
| Remote deployment | NOT_RUN | Local docs served from this branch; no merge/deployment claimed |
| Remote stacked-base CI at933158b0 | PASS1 / FAIL3 preexisting | Browser timing passes; unchanged CAESAR/FBX old cache assertions and InputXML manifest failure also fail on PR811. Main-base XML gates not triggered here. |

### Unresolved / protected decision

Six weighted branch-start RIGID components have no incoming positive-node edge. Ten weighted FLAN helpers are collapsed by existing physical short-hop cleanup near junctions. Their weights remain in XML but have no CII owner. Full CII acceptance remains FAIL until component geometry/ownership is governed. The owner question is pending; no guessed mass transfer, topology rewrite or tolerance weakening was performed.

### Recovery

Current report: `agents/PR812_workreport.md`.
Evidence: `agents/evidence/WIP-781-OUTPUT-CUSTODY-20261001/`; `changed-files.json` explains paths, `cii-weight-export-audit.json` preserves full failure. Source/docs changed production mirrors have byte parity. Mandatory native backups recorded. No workflow changes.

Overlap: PR801 Weight/cache, PR794 LineList authority, PR788–792 Mode B topology stack. These remain separate; no stack merge or authority promotion. Base/main rechecked d6f19bdd; PR811 a6b67cc5.

### Reproduce

```powershell
node --test tests/xml-cii-weight-output-authority.test.mjs tests/xml-cii-output-result-invalidation.test.mjs
python tests/xml-cii-weight-owner-guard.test.py
python tests/xml-cii-real-weight-export-audit.py # expected exit2: preserves the unresolved full-acceptance failure
# Browser tests require Playwright, Chrome and XML_CII_41_BRANCH_FIXTURE; recorded paths/commands in report.
node tests/browser/xml-cii-weight-output-custody-e2e.mjs --expect-weight-owner-block
node tests/browser/xml-cii-mode-b-xml-export-e2e.mjs
```
