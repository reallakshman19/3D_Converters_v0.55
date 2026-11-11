# XML229 EF-05: pre-Weight Match canonical physical ownership (2026-10-20)

## Scope

This audit uses the original source `Benchmarks/EF-05-PRO.TEST.xml` and the Preview's documented gasket/short-element cleanup. Source facts, geometry, component-reference signatures, branch occurrences, and original ordinals remain immutable. **The geometry census does not approve a mass.** The real EF-05 has no independently confirmed, fully accepted 249-component Final review.

## Corrected physical ownership

The raw source contains **423 weight-eligible XML node occurrences**, but they are not 423 independent physical parts:

| Source relation | Left-end witnesses excluded from mass-owner population | Canonical right-end physical owners |
| --- | ---: | ---: |
| VALV Endpoint 1 → VALV Endpoint 2 (same reference) | 25 | 25 |
| FLAN Endpoint 1 → FLAN Endpoint 2 (same reference) | 12 | 12 |
| INST Endpoint 1 → INST Endpoint 2 (same reference) | 14 | 14 |
| FLAN Endpoint 1 → existing RIGID Endpoint 2 (same reference, `Rigid=2`) | 114 | 114 existing RIGID owners |
| VALV Endpoint 1 → existing RIGID Endpoint 2 (same reference, `Rigid=2`) | 9 | 9 existing RIGID owners |
| Remaining standalone source RIGID endpoints | 0 | 75 |
| **Total** | **174** | **249 distinct candidate physical parts** |

The corrected source-bound Weight Match population is therefore **249 canonical physical owners × 7 facts = 1,743 fact records**. The independent original-source census checks the same selected original ordinals. Both end nodes remain in the finalized geometry. The first endpoint remains original geometry evidence and cannot receive another Final mass. An old 423-node or 372-node accepted-weight review is NOT silently migrated; review export/import is bound to the finalized geometry SHA.

The native Python mass binder independently recomputes the same 174 pairs from the exact finalized XML. It rejects duplicate accepted endpoints, a noncanonical first-end owner, forged ordinal mappings, unexpected mass owners, or any changed emitted CII rigid pointer/mass.

## Native geometry and mass support

* **198** source RIGID nodes already have explicit `Rigid=2`, including the 123 cross-type FLAN/VALV → RIGID continuations above.
* **37** same-family 1→2 physical spans (25 VALV, 12 FLAN) have finite positive lengths of 86–419 mm. The source-bound Worker records a pre-acceptance `Rigid=2` classification on their EXISTING second endpoint, with the original reference/positions/ordinal and measured span, and the Python binder independently recomputes its proof.
* Thus **235/249** candidate parts can be mapped to actual native RIGID auxiliary records, subject to a genuine, explicit Final weight for *each* part and independently reconciled emitted-CII bytes. No new geometry edges are created, no mass is duplicated or redistributed, and explicit approved 0 kg remains zero.
* The remaining **14 candidate instrument parts** appear as same-reference INST 1→2 pairs. Their original XML does not independently establish a rigid stiffness classification. The verified Worker now shows **optional, read-only modeling suggestions** without inserting a `Rigid=2` value or accepting a kilogram.

Instrument suggestions do **not** require an engineer's approval, an evidence upload, or completion of all 14. Users can ignore all suggestions and continue Weight Match or the existing XML-only route. They may also select individual suggested classifications using the optional source-revision tool, which changes only their selected original XML end nodes before any new weight basis is accepted. For any CII report claiming *fully reconciled native mass*, the existing emitted-CII mass evidence must still account for every claimed owner; suggestions alone cannot count as consumed mass.

## Validation boundary

Tests include a genuine accepted Worker Final → native Python CII → independent emitted mass path, synthetic 423-owner capacity, source-based 423/174/249 cardinality, negative ID remapping, actual rigid valve/flange edge consumption, tampered-geometry refusal, and no duplicate endpoint acceptance. CI must pass on the final exact PR head, including real EF-05 master variants. Even those focused tests do not constitute an engineer-approved 249-part mass dataset. The PR remains draft and nonreleasing until real accepted Final, CII element ownership and independent emitted-byte mass reconciliation cover all 249 canonical physical parts.
