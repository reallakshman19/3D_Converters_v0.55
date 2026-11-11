# PR741 workreport — P8 3D joint integration contract

## Assignment

Advance issue #721 P8 by qualifying existing 3D/model and analysis-result seams and defining a fail-closed canonical joint-context contract. Do not implement automatic solver/UI integration while the required frame/load/dependency sources remain unresolved.

## Grounding

- main remains `78b361d1f649d41378f568ebe1a237c4bc140c73`;
- PR #740 was owner-authorized and squash-merged into its stacked base PR #739 as `7943f5a4eab762d34de94264652da4a88742faca`;
- this branch is based on updated PR #739;
- P3 mechanics remain separately open in PR #732 and are not in this ancestry;
- earlier exact-native validation obligations remain open.

## Repository evidence inspected

1. `converters/xml-cii2019-core/custom-input-seljson-source.js`
   - accepts 3DV `rvm-converter-stage/v1` / selection wrapper;
   - retains identity/path/units and explicit matrix/local-world geometry data;
   - recognizes flange-like native kinds;
   - may infer an axis from bounding-box dimensions when explicit local axis is absent.
2. `contracts/inputxml/v1/catalogs/inputxml-component-contract-catalog.json`
   - `FLANGE` is `UNSUPPORTED_BLOCKING` in the projection contract;
   - `FORCESMOMENTS` is `UNSUPPORTED_BLOCKING` pending field-contract verification.
3. `contracts/inputxml/v1/inventory/inputxml-field-occurrence.csv`
   - current CII-authority route records `FORCESMOMENTS` and `FLANGES` among active sections that are `NOT_PARSED` and must block rather than silently disappear.
4. `parser/accdb-mdb.js`
   - carries force/moment unit metadata and load-case identity for some output surfaces;
   - inspected restraint-summary projection retains scalar `RESULTANTF` and `RESULTANTM`, not signed `Fx/Fy/Fz/Mx/My/Mz` components.

## Engineering decision

P8 must not couple calculations directly to viewer routing geometry. The canonical resolver boundary requires explicit:

- stable model/component identity and provenance;
- flange-face point;
- verified orthonormal right-handed local basis;
- explicit opening-axis direction/mating side;
- signed six-DOF load case with source frame, source point, units and case provenance;
- exact governed master bindings.

Required mechanics:

```text
M_face_global = M_source_global + (r_source - r_face) x F_global
F_local       = R^T F_global
M_face_local  = R^T M_face_global
```

The moment transport must be reused from common P3 mechanics once that dependency is reconciled; it must not be duplicated in P8.

## Validation

```text
source-level 3DV seam inspection          PASS
InputXML component/field blocker review   PASS
ACCDB result-interface review             PASS
canonical contract review                 PASS
production code execution                 NOT_APPLICABLE / no production code changed
browser                                    NOT_APPLICABLE
independent engineering review            NOT_RUN
native backup command                      NOT_RUN / CONNECTOR_ONLY_ENVIRONMENT
connector pre-edit backup                  EVIDENCE_ONLY
```

## Next action

Reconcile the P3 resultant-transport dependency into the P8 ancestry and identify/qualify an explicit flange-face frame source plus a signed six-component analysis-result source. Only then add a pure resolver/transform module with focused transformation/provenance tests. Do not integrate masters/solvers/UI in that first production slice.

Owner merge authority remains required.