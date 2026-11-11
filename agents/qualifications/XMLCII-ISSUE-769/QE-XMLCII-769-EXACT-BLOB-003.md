QUALIFICATION_EVIDENCE_VERSION: 1
CHAIN_ID: XMLCII-ISSUE-769
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-RELEASE
QUESTION_SET_ID: QS-XMLCII-769-RELEASE-001
EVIDENCE_ID: QE-XMLCII-769-EXACT-BLOB-003
BRANCH_BASIS: c27dafa057a88cc575e6d1a397f853bfc6ce5ad5
NODE_VERSION: v22.16.0
EVIDENCE_CLASS: CONNECTOR_MATERIALIZED_EXACT_BLOB_EXECUTION_AND_WRITER_SOURCE_CONFIRMATION
RECORDED_AT: 2026-09-16T20:16:00Z

# Weight lifecycle / one-scale bounded qualification

No production code changed during this qualification progression.

## BM-003 — rigid-weight lifecycle

Exact production blob:
- `converters/xml-cii2019-core/rigid-weight-authority.js` — `639b776f4adbba1d4b9b8dd4cb669c352d4c02f8`

The branch blob was materialized locally and `git hash-object` matched the GitHub blob SHA exactly before execution under Node v22.16.0.

Executed production behaviors:
- legacy `rigidWeight` 125 kg resolves as `legacy-override`;
- Match-1 12.5 kg supersedes legacy without deleting the legacy evidence;
- Final 13 kg supersedes Match-1;
- revising Match-1 to 11.75 kg invalidates same-key stale Final authority;
- the effective compatibility projection resolves to Final while persisted legacy remains 125;
- source XML weight remains the last fallback when no override bucket resolves.

RESULT: BM-003 PASS.

## BM-002 — one kg→CII scale path

Exact production blob:
- `converters/invocation-builder.js` — `aae681ec8e134d3ec92754e5bc6cb97bd21b6018`

The branch blob was materialized locally and `git hash-object` matched the GitHub blob SHA exactly before execution under Node v22.16.0.

Executed invocation behaviors:
- default XML→CII invocation emits exactly one `--weight-scale 10`;
- explicit `kgToNewton: true` emits exactly one `--weight-scale 10`;
- explicit `kgToNewton: false` emits no `--weight-scale`;
- the bounded numerical oracle gives `12.5 * 10 = 125`.

Writer-side source confirmation:
- `converters/scripts/xml_to_cii2019.py` branch blob is `1ccb23d90c3531316664f87191d6c5d8cc5df2b6`, identical to `main` at the current base;
- the writer's `_build_rigid_payload` computes `weight = _rigid_weight_for_edge(edge) * weight_scale`;
- repository code search found no `weight_scale * weight_scale` path in `xml_to_cii2019.py`.

A full XML→CII fixture was not executed through the complete Python CLI in this environment. Therefore this evidence does not claim end-to-end writer qualification.

RESULT: BM-002 PARTIAL_PASS_SCALE_PATH.

## BM-004

The committed empirical boundary regression still imports the full empirical estimator/model/master closure. That closure was not stubbed or weakened. BM-004 therefore remains `NOT_RUN_ENVIRONMENT_BLOCKED`.

## Release impact

- BM-003 is promoted to PASS.
- BM-002 advances from NOT_RUN to PARTIAL_PASS_SCALE_PATH, not full PASS.
- BM-004 and BM-009 remain blocked.
- PR #770 remains draft and unmerged; merge authority remains OWNER_ONLY / FALSE.
