#!/usr/bin/env python3
"""Issue #781 regression: explicit +Y restraint custody must survive collapse to final CII."""

from __future__ import annotations

from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "converters" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import xml_to_cii2019 as converter
import xml_to_cii2019_runtime_custody as runtime

runtime.install_runtime_custody_patch()

CASES = (
    (ROOT / "Benchmarks" / "XML-CII-2019" / "SYS-6-S8810011-01.xml", "PS-14292.1"),
    (ROOT / "Benchmarks" / "XML-CII-2019" / "SYS-6-S8810010-01.xml", "PS-14259.4"),
)


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1]


def child_text(parent: ET.Element, name: str) -> str:
    for child in list(parent):
        if local_name(child.tag) == name:
            return (child.text or "").strip()
    return ""


def source_node(path: Path, node_name: str) -> ET.Element:
    root = ET.parse(path).getroot()
    for node in root.iter():
        if local_name(node.tag) != "Node":
            continue
        if child_text(node, "NodeName") == node_name:
            return node
    raise AssertionError(f"{node_name}: source Node not found in {path.name}")


def source_restraint_types(node: ET.Element) -> list[str]:
    return [
        child_text(child, "Type")
        for child in list(node)
        if local_name(child.tag) == "Restraint"
    ]


def source_position(node: ET.Element) -> tuple[float, float, float]:
    values = tuple(float(value) for value in child_text(node, "Position").split())
    assert len(values) == 3
    return values


def restraint_section_lines(cii_text: str) -> list[str]:
    lines = cii_text.splitlines()
    start = lines.index("#$ RESTRANT") + 1
    rows: list[str] = []
    for line in lines[start:]:
        if line.startswith("#$ "):
            break
        if line.strip():
            rows.append(line)
    return rows


def numeric_restraint_pairs(lines: list[str]) -> list[tuple[int, int]]:
    pairs: list[tuple[int, int]] = []
    for line in lines:
        tokens = line.split()
        if len(tokens) < 2:
            continue
        try:
            node_number = int(round(float(tokens[0])))
            type_code = int(round(float(tokens[1])))
        except ValueError:
            continue
        pairs.append((node_number, type_code))
    return pairs


def assert_case(path: Path, node_name: str) -> None:
    raw_node = source_node(path, node_name)
    raw_node_number = int(child_text(raw_node, "NodeNumber"))
    raw_position = source_position(raw_node)
    assert "+Y" in source_restraint_types(raw_node), (
        f"{node_name}: benchmark source must contain explicit +Y restraint"
    )

    document = converter._parse_xml_document(path)
    event = next(
        (
            row for row in runtime.EXPLICIT_RESTRAINT_CUSTODY_EVENTS
            if row.get("sourceNodeName") == node_name
            and row.get("sourceNodeNumber") == raw_node_number
        ),
        None,
    )
    assert event is not None, f"{node_name}: runtime custody event missing"
    assert event.get("status") == "transferred", (
        f"{node_name}: expected coincident short-node transfer, got {event.get('status')}"
    )
    assert tuple(event.get("typeCodes") or ()) == (14,), (
        f"{node_name}: custody event lost +Y -> CII type 14 identity"
    )

    retained_node_number = int(event["retainedNodeNumber"])
    branch_name = event["branchName"]
    branch = next((row for row in document.branches if row.branch_name == branch_name), None)
    assert branch is not None, f"{node_name}: retained branch disappeared"
    retained = next((node for node in branch.nodes if node.node_number == retained_node_number), None)
    assert retained is not None, f"{node_name}: retained engineering node {retained_node_number} missing"
    assert retained_node_number != raw_node_number, (
        f"{node_name}: benchmark no longer exercises collapsed-node custody"
    )
    assert runtime._distance(retained.position, raw_position) <= runtime.EXPLICIT_RESTRAINT_IDENTITY_TOLERANCE_MM, (
        f"{node_name}: transferred restraint moved away from source position"
    )
    assert retained.component_type == "OLET", (
        f"{node_name}: custody audit must not replace retained component authority"
    )
    assert any(spec.type_code == 14 for spec in retained.restraint_specs), (
        f"{node_name}: retained node lost +Y -> CII type 14 restraint authority"
    )

    model = converter._build_conversion_model(document)
    assigned = next(
        (
            row for row in model.restraints
            if row.node_number == retained_node_number
            and any(spec.type_code == 14 for spec in row.specs)
        ),
        None,
    )
    assert assigned is not None, (
        f"{node_name}: explicit +Y restraint was not assigned into conversion model"
    )

    expected_pair = (retained_node_number, 14)
    payload = converter._build_restraint_payload(model, {})
    writer_pairs = numeric_restraint_pairs(payload)
    assert expected_pair in writer_pairs, (
        f"{node_name}: RESTRANT writer input lacks node {retained_node_number} type 14 row"
    )

    cii_text = converter._build_cii_text(
        model,
        "none",
        converter.DEFAULT_VERSION_LINE,
        1.0,
        {},
    )
    final_pairs = numeric_restraint_pairs(restraint_section_lines(cii_text))
    assert expected_pair in final_pairs, (
        f"{node_name}: final CII RESTRANT section lacks node {retained_node_number} type 14"
    )

    assert converter._direction_cosines_for_restraint_type(14, False) == (0.0, 1.0, 0.0), (
        f"{node_name}: +Y writer direction cosine mapping drifted"
    )


for benchmark, identity in CASES:
    assert_case(benchmark, identity)

print("PASS issue #781 explicit +Y source -> custody transfer -> retained node -> model -> final CII")
