#!/usr/bin/env python3
"""Held-out G5 CII ELEMENTS->RIGID lineage challenge. Never native release.

Runs existing separate I03 mass+frozen-review oracle first; then independently
parses actual emitted CII ELEMENTS rows and checks its 1-based RIGID pointers,
endpoint geometry declarations, original source ordinals and full slot coverage.
Claims in the external lineage manifest require independent Owner review;
mathematical agreement alone cannot attest who authored those claims.
"""
from __future__ import annotations

import argparse
from decimal import Decimal, InvalidOperation
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location(
    "held_out_gc_pw_mass_oracle", HERE / "gc-pw-v1-cii-mass-oracle.py"
)
MASS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MASS)

SCHEMA = "xml229-g5-native-element-lineage/v1"

class LineageError(ValueError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code

def require(condition, code):
    if not condition:
        raise LineageError(code)

def identifier(value):
    return isinstance(value, str) and len(value.strip()) > 0 and len(value) < 1024

def natural(value):
    return type(value) is int and value >= 0

def decimal_integer(value):
    try:
        d = Decimal(value)
    except (InvalidOperation, TypeError):
        raise LineageError("CII_ELEMENT_NODE_INVALID") from None
    require(d.is_finite() and d == d.to_integral_value(),
            "CII_ELEMENT_NODE_INVALID")
    return int(d)

def sections_from_output(cii_text):
    sections, name = {}, None
    for line in cii_text.splitlines():
        if line.startswith("#$ "):
            name = line[3:].strip()
            require(name and name not in sections, "CII_SECTION_INVALID")
            sections[name] = []
        elif name is not None and line.strip():
            sections[name].append(line)
    require(all(k in sections for k in ("CONTROL", "ELEMENTS", "RIGID")),
            "CII_ELEMENTS_OR_RIGID_MISSING")
    return sections

def parse_elements(cii_text):
    sections = sections_from_output(cii_text)
    control = sections["CONTROL"]
    require(len(control) == 4, "CII_CONTROL_INVALID")
    fields = control[0].split()
    require(fields, "CII_CONTROL_INVALID")
    try:
        elements_expected = int(fields[0])
    except ValueError:
        raise LineageError("CII_CONTROL_INVALID") from None
    require(elements_expected >= 0, "CII_CONTROL_INVALID")
    block = sections["ELEMENTS"]
    require(len(block) == 15 * elements_expected,
            "CII_ELEMENTS_COUNT_MISMATCH")
    rigid_count = len(sections["RIGID"])
    nodes, rigid_to_element = [], {}
    for i in range(elements_expected):
        rows = block[i*15:(i+1)*15]
        first = rows[0].split()
        pointer_row = rows[12].split()
        require(len(first) == 6 and len(pointer_row) == 6,
                "CII_ELEMENT_ROW_INVALID")
        start, end = decimal_integer(first[0]), decimal_integer(first[1])
        try:
            pointer = int(pointer_row[1])
        except ValueError:
            raise LineageError("CII_RIGID_POINTER_INVALID") from None
        require(pointer >= 0 and pointer <= rigid_count,
                "CII_RIGID_POINTER_INVALID")
        index = pointer - 1 if pointer else None
        if index is not None:
            require(index not in rigid_to_element,
                    "DUPLICATE_CII_RIGID_POINTER")
            rigid_to_element[index] = i
        nodes.append((start, end, index))
    require(len(rigid_to_element) == rigid_count,
            "UNREFERENCED_CII_RIGID_RECORD")
    return nodes, rigid_to_element

def check_source_witness(lineage, ledger, source_dir):
    actual = {}
    for source_id, ref in ledger["sources"].items():
        # Hash+all original ordinals already verified by the held-out MASS oracle.
        data = (Path(source_dir) / ref["filename"]).read_bytes()
        scan = MASS._SOURCE.scan_bytes(source_id, data)
        for o in scan["occurrences"]:
            actual[(source_id,o["branchOccurrenceIndex"],o["nodeOrdinal"])] = o
    return actual

def verify_lineage(ledger, lineage, cii_bytes, source_dir, evidence_dir):
    require(isinstance(lineage, dict) and lineage.get("schemaVersion") == SCHEMA,
            "LINEAGE_SCHEMA_REQUIRED")
    require(lineage.get("nativeCiiReleaseAuthorized") is False,
            "LINEAGE_CLAIMED_RELEASE_AUTHORITY")
    require(lineage.get("basisId") == ledger.get("basisId"),
            "LINEAGE_BASIS_DRIFT")
    expected_sha = hashlib.sha256(cii_bytes).hexdigest()
    require(lineage.get("ciiSha256") == expected_sha ==
            ledger.get("output",{}).get("ciiSha256"), "LINEAGE_CII_SHA_DRIFT")
    try:
        cii_text = cii_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise LineageError("CII_ENCODING_INVALID") from None

    # Independent review/immutable snapshot and allocation conservation first.
    mass = MASS.verify_ledger(ledger, cii_text, source_dir=source_dir,
                              evidence_dir=evidence_dir, cii_bytes=cii_bytes)
    require(mass.get("status") == "MASS_LEDGER_VERIFIED",
            "INDEPENDENT_MASS_LEDGER_UNVERIFIED")
    native_edges, by_rigid = parse_elements(cii_text)
    source = check_source_witness(lineage, ledger, source_dir)
    declared = lineage.get("groups")
    require(isinstance(declared,list) and isinstance(ledger.get("groups"),list),
            "LINEAGE_GROUPS_REQUIRED")
    indexed = {}
    for item in declared:
        require(isinstance(item,dict), "LINEAGE_GROUP_INVALID")
        key = (item.get("sourceId"),item.get("componentOccurrenceId"),
               item.get("physicalComponentGroupId"))
        require(all(identifier(x) for x in key) and key not in indexed,
                "LINEAGE_DUPLICATE_GROUP")
        indexed[key] = item
    expected_groups = {(g["sourceId"],g["componentOccurrenceId"],
                        g["physicalComponentGroupId"]) for g in ledger["groups"]}
    require(set(indexed) == expected_groups, "LINEAGE_GROUP_POPULATION_DRIFT")
    taken = set()
    for group in ledger["groups"]:
        key = (group["sourceId"],group["componentOccurrenceId"],
               group["physicalComponentGroupId"])
        item=indexed[key]
        loc=(group["sourceId"],group["branchOccurrenceIndex"],
             group["nodeOrdinal"])
        original=source.get(loc)
        require(original is not None, "LINEAGE_ORIGINAL_NOT_FOUND")
        require(item.get("branchOccurrenceIndex") == group["branchOccurrenceIndex"] and
                item.get("nodeOrdinal") == group["nodeOrdinal"] and
                item.get("sourceNodeNumber") == original["nodeNumber"] and
                item.get("sourceComponentRefNo") == original["componentRefNo"] and
                item.get("sourceEndpoint") == original["endpoint"] and
                item.get("sourceBranchName") == original["branchName"],
                "LINEAGE_ORIGINAL_PHYSICAL_DRIFT")
        child=item.get("children")
        require(isinstance(child,list), "LINEAGE_CHILDREN_REQUIRED")
        allocations={a["rigidRecordIndex"] for a in group["childAllocations"]}
        require({x.get("rigidRecordIndex") for x in child if isinstance(x,dict)}
                == allocations and len(child)==len(allocations),
                "LINEAGE_CHILD_ALLOCATIONS_DRIFT")
        for ch in child:
            require(isinstance(ch,dict), "LINEAGE_CHILD_INVALID")
            ridx,eidx=ch.get("rigidRecordIndex"),ch.get("nativeElementIndex")
            require(natural(ridx) and natural(eidx) and
                    eidx<len(native_edges) and (ridx,eidx) not in taken,
                    "LINEAGE_CHILD_INDEX_INVALID")
            taken.add((ridx,eidx))
            require(by_rigid.get(ridx)==eidx,"LINEAGE_RIGID_ELEMENT_POINTER_DRIFT")
            begin,end,_=native_edges[eidx]
            require(type(ch.get("ciiFromNode")) is int and
                    type(ch.get("ciiToNode")) is int and
                    begin==ch["ciiFromNode"] and end==ch["ciiToNode"],
                    "LINEAGE_NATIVE_ENDPOINT_DRIFT")

    declared_zero=lineage.get("nonmassRigid")
    require(isinstance(declared_zero,list) and
            isinstance(ledger.get("nonmassRigid"),list),
            "LINEAGE_NONMASS_REQUIRED")
    expected_zero={i["rigidRecordIndex"] for i in ledger["nonmassRigid"]}
    require(len(declared_zero)==len(expected_zero) and
            {i.get("rigidRecordIndex") for i in declared_zero
             if isinstance(i,dict)}==expected_zero,
            "LINEAGE_NONMASS_POPULATION_DRIFT")
    for ch in declared_zero:
        ridx,eidx=ch["rigidRecordIndex"],ch.get("nativeElementIndex")
        require(natural(ridx) and natural(eidx) and eidx<len(native_edges) and
                (ridx,eidx) not in taken,
                "LINEAGE_NONMASS_INDEX_INVALID")
        taken.add((ridx,eidx))
        require(by_rigid.get(ridx)==eidx, "LINEAGE_NONMASS_POINTER_DRIFT")
        begin,end,_=native_edges[eidx]
        require(type(ch.get("ciiFromNode")) is int and
                type(ch.get("ciiToNode")) is int and
                (begin,end)==(ch["ciiFromNode"],ch["ciiToNode"]),
                "LINEAGE_NONMASS_ENDPOINT_DRIFT")
    require({r for r,_ in taken}==set(by_rigid),
            "LINEAGE_UNACCOUNTED_NATIVE_RIGID")
    require(len(taken)==len(by_rigid), "LINEAGE_DUPLICATE_NATIVE_ELEMENT")
    return {"schema":SCHEMA,"status":"ELEMENT_POINTER_AND_CLAIMED_LINEAGE_CHALLENGED",
            "physicalGroups":len(declared),"ciiElements":len(native_edges),
            "ciiRigidRecords":len(by_rigid),
            "massLedgerVerified":True,
            "independentLineageAuthorVerified":False,
            "nativeCiiReleaseAuthorized":False,
            "physicalMatch2ConsumptionVerified":False}

def run_files(ledger_path,cii_path,lineage_path,source_dir,evidence_dir):
    ledger=MASS.read_json(ledger_path)
    lineage=MASS.read_json(lineage_path)
    return verify_lineage(ledger,lineage,Path(cii_path).read_bytes(),
                          source_dir,evidence_dir)

def main(argv=None):
    parser=argparse.ArgumentParser(description="G5 held-out CII physical ELEMENT pointer/lineage challenge (non-releasing)")
    for arg in ("ledger","cii","lineage","sources","evidence"):
        parser.add_argument("--"+arg,required=True,type=Path)
    args=parser.parse_args(argv)
    try:
        result=run_files(args.ledger,args.cii,args.lineage,args.sources,args.evidence)
        print(json.dumps(result,sort_keys=True))
        return 0
    except (LineageError,MASS.MassOracleError,OSError,ValueError,KeyError,TypeError) as e:
        code=e.code if hasattr(e,"code") else "G5_INPUT_INVALID"
        print(json.dumps({"status":"HOLD","code":code,
                          "nativeCiiReleaseAuthorized":False}),file=sys.stderr)
        return 2

if __name__=="__main__":
    raise SystemExit(main())
