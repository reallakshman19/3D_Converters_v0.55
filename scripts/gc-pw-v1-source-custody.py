#!/usr/bin/env python3
"""Independent GC-PW source occurrence oracle. No application/converter imports.

Owner XML data stays outside Git. Only its expected checksums/census are recorded.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

OWNER = {
    "PL-01_XML.xml": {
        "sha256": "6b21de78a0d5b92d6d9ca3d7d24e43ba89421efdc432527d759a42aeb1c537dd",
        "bytes": 296828, "branches": 9, "nodes": 452, "negativeOne": 141,
    },
    "PL-06_XML.xml": {
        "sha256": "19633df910e0657fc15eb6a6f8f0b11791b04dc360615b4bb5edad573961cc65",
        "bytes": 265384, "branches": 10, "nodes": 419, "negativeOne": 181,
    },
}
EXPECTED_TOTAL = {"sources": 2, "branches": 19, "nodes": 871, "negativeOne": 322}


class OracleError(ValueError):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.code = code


def local_name(tag):
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def child_text(element, field):
    for child in element:
        if local_name(child.tag) == field:
            return (child.text or "").strip()
    return ""


def scan_bytes(source_id, raw_bytes):
    """Derive source-local ordinal identities, independent of NodeNumber."""
    if not source_id or not isinstance(source_id, str):
        raise OracleError("SOURCE_ID_REQUIRED", "source_id must be a nonempty string")
    if not isinstance(raw_bytes, bytes):
        raise OracleError("BYTES_REQUIRED", "source XML must be bytes")
    try:
        root = ET.fromstring(raw_bytes)
    except ET.ParseError as error:
        raise OracleError("MALFORMED_XML", str(error)) from error
    branches = [element for element in root.iter() if local_name(element.tag) == "Branch"]
    all_nodes = [element for element in root.iter() if local_name(element.tag) == "Node"]
    records = []
    branch_node_counts = []
    for branch_index, branch in enumerate(branches):
        name = child_text(branch, "Branchname")
        nodes = [item for item in branch if local_name(item.tag) == "Node"]
        branch_node_counts.append(len(nodes))
        for node_index, node in enumerate(nodes):
            records.append({
                "sourceId": source_id,
                "branchOccurrenceIndex": branch_index,
                "nodeOrdinal": node_index,
                "branchName": name,
                "nodeNumber": child_text(node, "NodeNumber"),
                "componentRefNo": child_text(node, "ComponentRefNo"),
                "endpoint": child_text(node, "Endpoint"),
            })
    if len(records) != len(all_nodes):
        raise OracleError("ORPHAN_OR_NESTED_NODE",
                          f"{len(all_nodes)} all Node elements but only {len(records)} direct Branch/Node occurrences")
    if not branches:
        raise OracleError("NO_BRANCHES", "No Branch elements found")
    keys = [key_of(record) for record in records]
    if len(set(keys)) != len(keys):
        raise OracleError("DUPLICATE_SOURCE_OCCURRENCE", "Source-local ordinal keys collided")
    return {
        "sourceId": source_id,
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "bytes": len(raw_bytes),
        "branchCount": len(branches),
        "nodeCount": len(records),
        "negativeOneCount": sum(record["nodeNumber"] == "-1" for record in records),
        "branchNodeCounts": branch_node_counts,
        "occurrences": records,
    }


def key_of(record):
    for field in ("sourceId", "branchOccurrenceIndex", "nodeOrdinal"):
        if field not in record:
            raise OracleError("MISSING_OCCURRENCE_FIELD", field)
    if not isinstance(record["sourceId"], str) or not record["sourceId"]:
        raise OracleError("INVALID_SOURCE_ID", str(record["sourceId"]))
    for field in ("branchOccurrenceIndex", "nodeOrdinal"):
        value = record[field]
        if type(value) is not int or value < 0:
            raise OracleError("INVALID_OCCURRENCE_ORDINAL", field + "=" + str(value))
    return (record["sourceId"], record["branchOccurrenceIndex"], record["nodeOrdinal"])


def verify_projection(source_scans, projected_rows):
    """Challenge Preview/Weight/Run projections with original source occurrences.

    Raw engineering NodeNumber is intentionally NOT an identity key.
    """
    expected = set()
    for scan in source_scans:
        expected.update(key_of(record) for record in scan["occurrences"])
    actual = set()
    for record in projected_rows:
        key = key_of(record)
        if key in actual:
            raise OracleError("DUPLICATE_PROJECTED_OCCURRENCE", repr(key))
        actual.add(key)
    missing = expected - actual
    extra = actual - expected
    if missing:
        raise OracleError("MISSING_PROJECTED_OCCURRENCE", f"missing count {len(missing)}, first {sorted(missing)[0]!r}")
    if extra:
        raise OracleError("EXTRA_PROJECTED_OCCURRENCE", f"extra count {len(extra)}, first {sorted(extra)[0]!r}")
    return {"verified": True, "occurrences": len(expected)}


def verify_owner(directory):
    base = Path(directory)
    if not base.is_dir():
        raise OracleError("SOURCE_DIRECTORY_MISSING", str(base))
    scans = []
    for name, expected in OWNER.items():
        path = base / name
        if not path.is_file():
            raise OracleError("SOURCE_FILE_MISSING", name)
        scan = scan_bytes(name, path.read_bytes())
        for source_field, expected_field in (
            ("sha256", "sha256"), ("bytes", "bytes"), ("branchCount", "branches"),
            ("nodeCount", "nodes"), ("negativeOneCount", "negativeOne"),
        ):
            if scan[source_field] != expected[expected_field]:
                raise OracleError("OWNER_SOURCE_DRIFT",
                                  f"{name} {source_field}: expected {expected[expected_field]!r}, got {scan[source_field]!r}")
        scans.append(scan)
    totals = {
        "sources": len(scans),
        "branches": sum(scan["branchCount"] for scan in scans),
        "nodes": sum(scan["nodeCount"] for scan in scans),
        "negativeOne": sum(scan["negativeOneCount"] for scan in scans),
    }
    if totals != EXPECTED_TOTAL:
        raise OracleError("OWNER_TOTAL_DRIFT", repr(totals))
    projection = [record for scan in scans for record in scan["occurrences"]]
    verify_projection(scans, projection)
    return {
        "status": "OWNER_SOURCE_ATTESTED",
        "totals": totals,
        "files": [{
            "sourceId": scan["sourceId"],
            "sha256": scan["sha256"],
            "bytes": scan["bytes"],
            "branches": scan["branchCount"],
            "nodes": scan["nodeCount"],
            "negativeOne": scan["negativeOneCount"],
            "branchNodeCounts": scan["branchNodeCounts"],
        } for scan in scans],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="GC-PW independent XML source occurrence oracle")
    parser.add_argument("--verify-owner", metavar="DIRECTORY", required=True,
                        help="Explicit directory holding BOTH private original XMLs; never silently skip")
    args = parser.parse_args(argv)
    try:
        print(json.dumps(verify_owner(args.verify_owner), sort_keys=True))
    except (OracleError, OSError) as error:
        code = error.code if isinstance(error, OracleError) else "IO_ERROR"
        print(json.dumps({"status": "FAIL", "code": code, "detail": str(error)}),
              file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
