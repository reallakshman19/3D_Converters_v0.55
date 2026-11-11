#!/usr/bin/env python3
"""Optional instrument modeling suggestions before Weight Match.

Inspect lists source-bound, nonbinding rigid-element candidates.
Apply permits zero, one or several explicitly selected suggestions without
mandatory engineering approval or evidence files. Unselected source elements
remain unchanged; this tool never approves kilograms or runs inside CII Run.
"""
import argparse
from datetime import datetime, timedelta
import hashlib
import json
import math
import os
from pathlib import Path
import re
import tempfile
import xml.etree.ElementTree as ET
from xml229_instrument_revision_io import (
    insert_selected_rigid_losslessly as _insert_lossless,
    write_outputs_exclusively,
)


SCHEMA = "XML229.InstrumentSourceClassificationApproval.v1"
RECEIPT_SCHEMA = "XML229.InstrumentSourceClassificationRevision.v1"
SHA = re.compile(r"^[0-9a-f]{64}$")
BAD_VALUE = {"", "pending", "unreviewed", "unknown", "n/a", "none",
             "todo", "test", "sample", "placeholder", "tbd"}


class ClassificationRefused(ValueError):
    pass


def require(condition, code):
    if not condition:
        raise ClassificationRefused(code)


def name(element):
    return element.tag.rsplit("}", 1)[-1]


def children(element, tag):
    return [c for c in element if name(c) == tag]


def get(element, tag):
    return (children(element, tag)[0].text or "").strip() if children(element, tag) else ""


def digest(data):
    return hashlib.sha256(data).hexdigest()


def position(text):
    try:
        points = tuple(float(x) for x in text.split())
    except ValueError:
        raise ClassificationRefused("INSTRUMENT_POSITION_INVALID") from None
    require(len(points) == 3 and all(math.isfinite(x) for x in points),
            "INSTRUMENT_POSITION_INVALID")
    return points


def audit(xml_bytes):
    root = ET.fromstring(xml_bytes)
    unresolved = []
    for bi, branch in enumerate(x for x in root.iter() if name(x) == "Branch"):
        nodes = children(branch, "Node")
        paired_ordinals = set()
        for ni in range(len(nodes) - 1):
            left, right = nodes[ni:ni + 2]
            ref = get(left, "ComponentRefNo")
            if not (ref and get(left, "ComponentType") == "INST" and
                    get(right, "ComponentType") == "INST" and
                    get(right, "ComponentRefNo") == ref and
                    get(left, "Endpoint") == "1" and get(right, "Endpoint") == "2"):
                continue
            paired_ordinals.update((ni, ni + 1))
            try:
                length = math.dist(position(get(left, "Position")),
                                   position(get(right, "Position")))
            except ClassificationRefused:
                continue
            end_rigid = get(right, "Rigid")
            # Missing or conflicting geometry cannot be a suggestion, but
            # does not stop any other component or the source workflow.
            if length <= 6 or get(left, "Rigid") or end_rigid:
                continue
            unresolved.append({
                "branchOccurrenceIndex": bi,
                "startSourceNodeOrdinal": ni,
                "endSourceNodeOrdinal": ni + 1,
                "componentRefNo": ref,
                "fromPosition": get(left, "Position"),
                "toPosition": get(right, "Position"),
                "spanMm": round(length, 8),
                "sourceWeightField": get(right, "Weight"),
                "sourceWallThicknessMm": get(right, "WallThickness"),
                "sourceOutsideDiameterMm": get(right, "OutsideDiameter"),
                "sourceEndRigid": end_rigid,
            })
        # Nonmatching instruments stay in the source unchanged: suggestions
        # are advisory and cannot hold up unrelated components.
    return root, unresolved


def inspect(xml):
    data = Path(xml).read_bytes()
    _, rows = audit(data)
    return {
        "schema": SCHEMA, "sourceXmlSha256": digest(data),
        "stage": "BEFORE_WEIGHT_MATCH",
        "mode": "OPTIONAL_SUGGESTIONS",
        "approvalRequired": False,
        "components": [{
            **row, "classification": "PENDING",
            "suggestedClassification": "RIGID_CANDIDATE",
            "automaticClassificationApplied": False,
            "approvedBy": "", "approvedAtUtc": "",
            "evidencePath": "", "evidenceSha256": "",
            "evidenceCitation": "",
        } for row in rows],
    }


def optional_choice(row, anchor, manifest_dir):
    """PENDING or omitted choices need no approval and do not change XML."""
    require(isinstance(row, dict) and
            all(row.get(key) == value for key, value in anchor.items()),
            "INSTRUMENT_SOURCE_ANCHOR_DRIFT")
    choice = row.get("classification", "PENDING")
    require(choice in ("PENDING", "KEEP_SOURCE", "FLEXIBLE", "RIGID"),
            "INSTRUMENT_CHOICE_INVALID")
    if choice != "RIGID":
        return None
    evidence_path = row.get("evidencePath") or ""
    evidence_sha = row.get("evidenceSha256") or ""
    if evidence_path or evidence_sha:
        require(bool(evidence_path) and isinstance(evidence_sha, str) and
                SHA.fullmatch(evidence_sha) is not None,
                "INSTRUMENT_OPTIONAL_EVIDENCE_INCOMPLETE")
        source = Path(evidence_path)
        if not source.is_absolute():
            source = manifest_dir / source
        require(source.is_file() and digest(source.read_bytes()) == evidence_sha,
                "INSTRUMENT_EVIDENCE_BYTES_MISMATCH")
    return {
        "branchOccurrenceIndex": anchor["branchOccurrenceIndex"],
        "endSourceNodeOrdinal": anchor["endSourceNodeOrdinal"],
        "componentRefNo": anchor["componentRefNo"],
        "classification": "RIGID",
        "engineeringApprovalVerified": False,
        "approvalRequired": False,
        "evidenceSha256": evidence_sha or None,
    }


def insert_selected_rigid_losslessly(original, checked):
    return _insert_lossless(original, checked, require)


def approve(xml, manifest, revised, receipt):
    source = Path(xml)
    original = source.read_bytes()
    root, anchors = audit(original)
    approval_bytes = Path(manifest).read_bytes()
    try:
        approved = json.loads(approval_bytes)
    except (ValueError, UnicodeDecodeError):
        raise ClassificationRefused("INSTRUMENT_APPROVAL_JSON_INVALID") from None
    require(isinstance(approved, dict) and approved.get("schema") == SCHEMA and
            approved.get("stage") == "BEFORE_WEIGHT_MATCH" and
            approved.get("sourceXmlSha256") == digest(original),
            "INSTRUMENT_APPROVAL_SOURCE_SHA_DRIFT")
    rows = approved.get("components", [])
    require(isinstance(rows, list), "INSTRUMENT_SUGGESTIONS_INVALID")
    by_identity = {
        (r["branchOccurrenceIndex"], r["endSourceNodeOrdinal"],
         r["componentRefNo"]): r for r in anchors
    }
    checked = []
    seen = set()
    for row in rows:
        require(isinstance(row, dict), "INSTRUMENT_SUGGESTIONS_INVALID")
        identity = (row.get("branchOccurrenceIndex"),
                    row.get("endSourceNodeOrdinal"), row.get("componentRefNo"))
        require(identity in by_identity and identity not in seen,
                "INSTRUMENT_SUGGESTION_SOURCE_MISMATCH")
        seen.add(identity)
        selected = optional_choice(row, by_identity[identity],
                                   Path(manifest).parent)
        if selected is not None:
            checked.append(selected)
    # No choice is byte-for-byte unchanged; a selection adds only the chosen
    # Rigid tags, retaining BOM, comments, namespace prefixes and line endings.
    revised_bytes = (insert_selected_rigid_losslessly(original, checked)
                     if checked else original)
    for file in (revised, receipt):
        file = Path(file)
        require(file.resolve() not in {source.resolve(), Path(manifest).resolve()} and
                not file.exists(), "INSTRUMENT_OUTPUT_MUST_BE_NEW_REVISION")
    require(Path(revised).resolve() != Path(receipt).resolve(),
            "INSTRUMENT_OUTPUT_PATH_COLLISION")
    record = {
        "schema": RECEIPT_SCHEMA,
        "stage": "OPTIONAL_SOURCE_MODELING",
        "oldSourceXmlSha256": digest(original),
        "newSourceXmlSha256": digest(revised_bytes),
        "suggestionManifestSha256": digest(approval_bytes),
        "suggestionCount": len(anchors),
        "selectedCount": len(checked),
        "remainingSuggestions": len(anchors) - len(checked),
        "classificationSelections": checked,
        "approvalRequired": False,
        "engineeringApprovalVerified": False,
        "sourceChanged": bool(checked),
        "kilogramsAccepted": False,
        "reusablePreviousWeightReview": not bool(checked),
        "actualCiiMassReconciled": False,
    }
    # The preflight checks are advisory only: another process can create an
    # output between exists() and write. Exclusively create both files, then
    # remove only inodes created by this invocation if either write fails.
    outputs = ((Path(revised), revised_bytes),
               (Path(receipt), (json.dumps(record, indent=2) + "\n").encode("utf-8")))
    write_outputs_exclusively(outputs)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    plan = sub.add_parser("inspect", help="List optional instrument modeling suggestions")
    plan.add_argument("--source", required=True)
    plan.add_argument("--manifest", required=True)
    apply = sub.add_parser("apply", help="Apply only explicitly selected RIGID suggestions")
    apply.add_argument("--source", required=True)
    apply.add_argument("--manifest", required=True)
    apply.add_argument("--revised-source", required=True)
    apply.add_argument("--receipt", required=True)
    args = parser.parse_args()
    try:
        if args.cmd == "inspect":
            target = Path(args.manifest)
            require(not target.exists() and
                    target.resolve() != Path(args.source).resolve(),
                    "INSTRUMENT_OUTPUT_MUST_BE_NEW_REVISION")
            result = inspect(args.source)
            target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
            print(f"SUGGESTIONS {len(result['components'])} optional; no approval or kg required")
        else:
            result = approve(args.source, args.manifest,
                             args.revised_source, args.receipt)
            print(f"SELECTED {result['selectedCount']} optional RIGID models; unchanged={not result['sourceChanged']}")
    except (ClassificationRefused, ET.ParseError, OSError) as exc:
        parser.exit(2, f"INSTRUMENT_CLASSIFICATION_REFUSED: {exc}\n")


if __name__ == "__main__":
    main()
