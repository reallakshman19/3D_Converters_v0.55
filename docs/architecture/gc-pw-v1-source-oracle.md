# GC-PW I02 — independent source-occurrence oracle (J06 preparatory claim)

Owner source files are **not copied into Git**. This document contains only independently observed hashes and occurrence census for later source-to-Preview-to-Weight-to-CII acceptance.

Authority: #1008, #999 GC-PW/1.0, #927 J06, #980 Mode B source custody, #781/#769 original Owner requirements. V3.2 exact-head audit required. This is a direct XML parser census; it does not call the existing enrichment, Preview, Weight or CII engines.

## Retained owner source oracle

| Original file | SHA256 of bytes | Bytes | Branches | Direct Branch/Node occurrences | NodeNumber=-1 |
| --- | --- | ---: | ---: | ---: | ---: |
| PL-01_XML.xml | 6b21de78a0d5b92d6d9ca3d7d24e43ba89421efdc432527d759a42aeb1c537dd | 296828 | 9 | 452 | 141 |
| PL-06_XML.xml | 19633df910e0657fc15eb6a6f8f0b11791b04dc360615b4bb5edad573961cc65 | 265384 | 10 | 419 | 181 |
| Combined (original sources retained) | separate digests, NEVER a merged-identity hash | 562212 | 19 | 871 | 322 |

Per-branch Node census by original *file-local branch occurrence index* (0 based):

- PL-01: [325, 40, 6, 12, 5, 6, 40, 6, 12]
- PL-06: [262, 6, 40, 12, 5, 6, 40, 12, 5, 31]

Per-branch \`NodeNumber=-1\` occurrence census:

- PL-01: [59, 29, 3, 9, 0, 3, 29, 0, 9]
- PL-06: [79, 3, 29, 9, 0, 3, 29, 9, 0, 20]

These counts describe source **occurrences**, not unique \`NodeNumber\` values or accepted weight-owner groups. Two different original sources may have the same branch names and engineering node numbers without the same identity.

## CLI and test execution

Synthetic provider CI (does **not** imply owner acceptance):

    python3 tests/gc-pw-v1-source-custody.test.py

Owner local positive replay, with both previously provided original sources in one directory:

    python3 scripts/gc-pw-v1-source-custody.py --verify-owner /path/to/original/xmls

The latter refuses missing files, malformed XML, unexpected bytes/hash, different branch count, lost Node occurrences or altered \`NodeNumber=-1\` count. No fixture: failure, not skip. The CLI prints a compact attestation report, never entire proprietary XML contents.

Future consumer challenge: import \`scan_bytes\` and \`verify_projection\` and supply normalized downstream rows with **sourceId, branchOccurrenceIndex, nodeOrdinal**. Missing/extra/duplicate rows, Mode A cross-source leakage or Mode B lost original lineage must fail; engineering \`NodeNumber\` is explicitly not an internal identity key. The main programme integrator must compare final CII against **independent engineering property/mass oracles**, not claim that a node count proves conversion correctness.

## Tests and limits

Synthetic negative tests include repeated same-name branches and NodeNumber=-1, two identical-structure source files, missing projected occurrence, duplicated projected row, extra node, malformed XML, namespace, orphaned Node, tampered source of equal byte length, and missing/invalid owner fixtures.

This is an **independent source custody benchmark**, not the 356-error resolution, no CII node renumber equivalence and no branch/physical component mass conservation proof. Owner-scope CII may legitimately transform/split Node geometry; a downstream node mapping must preserve explicit original occurrence lineage or a separately verified conservation/allocation map. It must not simply require 871 final CII nodes if the conversion legitimately transforms geometry.

When the real owner replay is not present in hosted CI, the status must say SYNTHETIC TEST PASS / OWNER XML NOT VERIFIED IN HOSTED ENVIRONMENT. Do not convert that to product completion.
