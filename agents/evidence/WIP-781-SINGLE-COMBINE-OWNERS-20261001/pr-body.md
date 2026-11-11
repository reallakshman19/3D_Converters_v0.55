## Mission

Follow-up to #781/#787 and the owner-merged #813. Implement the owner's clarified modes and repair CII weight-owner losses on the supplied source files.

## Delivered behavior

- **Single is the default.** Three visible toggles and the header identify Single, Mode A (Draft), and Mode B.
- **Mode A runs separate models.** Mode B combines XML with node offsets, downloads XML/map, then loads the result into **Single**; it has no separate conversion path.
- Typed Weight Match edits use the existing manual Final authority. Candidate selections retain Match-1 provenance validation. Bulk suggestion fill preserves existing entries; Single review keeps proposed values visible for Apply.
- The existing active Python runtime preserves weighted negative sentinels, their actual source start points and physical short hops. The guard matches original source identity and exact mass; it still blocks missing/zero-length/invalid/ambiguous owners.
- Source/docs and the reverse import cache chain are activated together. No runtime/writer/canvas ownership switch, engineering master/formula/unit change, or workflow edit.

## Independent acceptance

Native Chrome + locally served docs mirror + actual Pyodide, with XML and CII downloads:

| Workflow | Result |
| --- | --- |
| Owner's SYS-6-S8810010-01.xml + SYS-6-S8810011-01.xml + SYS-S8811956-01.xml | 7 branches, 452 source nodes; offsets 0/100000/200000; combined XML loads into Single; **42/42** physical weighted CII owners |
| Real EF-05-PRO.TEST.xml, Mode A | 41 branches; **174/174** physical weighted CII owners; entered 57.25/13.5 kg preserved |
| Mode B deep comparison | 82 branches/3308 nodes; all non-number fields retained; malformed/mixed-unit/overflow/zero-step inputs rejected |

The artifact auditor imports no converter. It compares each weighted component's actual immediate source predecessor, CII physical delta and mass; entered values are independent oracle inputs. Existing six-significant-digit CII serialization and selected x10 Run convention are unchanged. The first repair failed this independent audit by 3–3.2 mm; the failure witnesses are retained and the source starts were repaired without weakening expected geometry.

Focused gates: **28/28 main**, **25/25 dataset**, **38/38 mission**; native CLI physical fixtures and fail-closed guards PASS. Single and Mode A canvas latest-output refresh verified.

## Recovery / boundaries

ENGINEERING_CRITICAL; Appendix A 98/100, each challenge >=17/20, documented with production traces and failed evidence. Work report and per-path ledger are in `agents/` and `agents/evidence/WIP-781-SINGLE-COMBINE-OWNERS-20261001/`.

67 source modules participate in reverse import activation; 110 source/docs path changes contain query metadata only. The implementation consists of 17 bounded source files and their mirrors. Existing overlaps with #801/#794 and #788–792 are classified COORDINATION_REQUIRED; no unmerged topology stack is incorporated.

The supplied originals were replayed; the exact prior failing enriched XML/config was not supplied, so this does not claim the identical eight-owner run was reproduced. Remote deployment remains NOT_RUN. Initial CI completed9PASS7FAIL: typed Final browser expectation and RVM parent cache contract are corrected and locally validated; five inherited failures are documented with exact-base reproduction/predecessor logs. Fresh16fcb9ac CI: 11PASS/4FAIL/1PENDING. Mission browser/focused checks and scope-tree PASS; inherited failures remain explicitly documented. Local acceptance is not deployed acceptance.

**Draft for review. Owner-only merge.**
