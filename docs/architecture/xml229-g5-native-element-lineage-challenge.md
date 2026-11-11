# XML229 G5 — independent native ELEMENTS→RIGID lineage challenge

**Status: DRAFT, NON-RELEASING.** Owner issue #274. This extends the independent [I03 mass oracle](gc-pw-v1-cii-mass-oracle.md); it does not modify the CII converter, GC-PW scorer, Final acceptance, Output/Run checklist or native release gate.

## Gap and exact scope

The recurrent `xml229-original-json-engineering-authority` blocking row is a deliberate governed-JSON native release hold. Preview 423/2961 facts and G3/G4 internal consistency cannot prove actual physical CII output consumed accepted Final masses.

The preexisting `scripts/gc-pw-v1-cii-mass-oracle.py` independently verifies original XML SHA/source ordinal, all three frozen stage reviews, accepted mass, split conservation and actual CII `#$ RIGID` numeric rows under an explicitly chosen scale. It does not independently tie the declared RIGID record to a native `#$ ELEMENTS` edge.

The new `scripts/xml229-g5-native-element-lineage.py` **calls that independent oracle first**, then separately reads the byte-identified actual CII. It validates:
1. CII CONTROL first record's element count and exactly 15 physical lines per `ELEMENTS` record.
2. Every `ELEMENTS` row 13 second field (1-based RIGID pointer), no duplicates, orphaned/out-of-range targets or unclaimed auxiliary mass slot.
3. For each reviewed allocation, a separate lineage challenge's exact `nativeElementIndex`, `rigidRecordIndex`, `ciiFromNode` and `ciiToNode` match the actual emitted CII.
4. Every I03 physical group is accounted for exactly once. The group must contain the original `sourceId`, branch occurrence index, node ordinal, original source NodeNumber, ComponentRefNo, Endpoint and branch label **verified by rereading the independently SHA-bound original source XML**, not by copying a UI table.
5. Every declared nonmass RIGID index has a distinct referenced CII ELEMENTS row. Existing I03 source/Final/split mass constraints continue to apply and cannot be weakened.

## Private challenge schema

The external file must contain `schemaVersion: "xml229-g5-native-element-lineage/v1"`, the exact `basisId`, `ciiSha256`, and `nativeCiiReleaseAuthorized:false`. Each `groups[]` member contains `sourceId`, `componentOccurrenceId`, `physicalComponentGroupId`, `branchOccurrenceIndex`, `nodeOrdinal`, `sourceNodeNumber`, `sourceComponentRefNo`, `sourceEndpoint`, `sourceBranchName` and a nonempty `children[]` declaring `rigidRecordIndex`, `nativeElementIndex`, `ciiFromNode`, `ciiToNode`. `nonmassRigid[]` must explicitly enumerate the independent ledger's corresponding zero-mass rows using the same native record/endpoint fields.

Keep original files, frozen review snapshots, author-controlled I03 ledger and the separate child-lineage challenge in the Owner's secure workspace. The lineage challenge **must not be synthesized from actual CII output** and represented as independent provenance.

```sh
python3 scripts/xml229-g5-native-element-lineage.py \
  --ledger /private/independent-review-ledger.json \
  --lineage /private/independent-child-lineage.json \
  --cii /private/actual-output.cii \
  --sources /private/original-source-xml-dir \
  --evidence /private/frozen-source-bound-review-snapshots
```

A structurally passing run says `ELEMENT_POINTER_AND_CLAIMED_LINEAGE_CHALLENGED` and **always** returns `independentLineageAuthorVerified:false`, `physicalMatch2ConsumptionVerified:false`, `nativeCiiReleaseAuthorized:false`. It cannot prove arbitrary cleaned/split child geometry claims are independent or correctly authored, despite byte-level CII parity. That further evidence, full 423 physical Owner case, actual accepted Final decisions and G7 approval are still necessary.

The synthetic Python tests exercise split edges, identical source NodeNumber collision, changed endpoint, swapped/duplicated/missing pointers, wrong original physical ordinal or ComponentRefNo, changed CII SHA, malformed CONTROL, wrong accepted mass and forged native-release flags. Dedicated CI reruns the I03 oracle plus these challenges. The exact Owner private source/masters and 100MiB/2m full browser/Worker peak memory are NOT_RUN.

**Next:** qualify exact-head CI, then Owner/Coordinator review. Instrument independent geometry/presplit-to-native-child witness and actual native converter output on an approved private test basis. Do not merge or enable governed JSON native CII unless explicitly authorized and all G5/G7 acceptance gates are fulfilled.