"""Audit actual UI downloads; does not invoke or substitute for a converter.
Exit 2 means reviewed weights remain without a CII element owner.
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

folder = Path(sys.argv[1] if len(sys.argv) > 1 else "agents/evidence/WIP-781-OUTPUT-CUSTODY-20261001")
root = ET.parse(folder / "ui-run.xml").getroot()
for element in root.iter():
    element.tag = element.tag.split("}")[-1]

records = []
branches = []
by_key = {}
for branch in root.iter("Branch"):
    name = branch.findtext("Branchname")
    nodes = []
    for node in branch.findall("Node"):
        number = int(node.findtext("NodeNumber"))
        descriptor = "|".join((node.findtext(tag) or "").strip() for tag in
                              ["ComponentRefNo", "Endpoint", "Position", "ComponentType"]
                              if (node.findtext(tag) or "").strip())
        record = {"branch": name, "number": number, "weight": float(node.findtext("Weight") or 0),
                  "rigid": int(node.findtext("Rigid") or 0), "type": node.findtext("ComponentType"),
                  "ref": node.findtext("ComponentRefNo") or "",
                  "point": tuple(float(v) for v in node.findtext("Position").split())}
        records.append(record)
        for identity in [str(number), descriptor]:
            by_key[name + "::" + identity] = record
        if number > 0:
            nodes.append(record)
    branches.append(nodes)

# Independent XML traversal of the existing physical-edge contract: positive
# route nodes, short-hop cleanup at 6mm, repeated same-coordinate junctions.
occurrences = defaultdict(list)
for index, nodes in enumerate(branches):
    for node in nodes:
        occurrences[node["number"]].append((index, node))
protected = {number for number, rows in occurrences.items()
             if len({index for index, _ in rows}) > 1
             and all(math.dist(rows[0][1]["point"], node["point"]) <= 6 for _, node in rows)}
cleaned = []
for nodes in branches:
    kept = nodes[:1]
    for node in nodes[1:]:
        if math.dist(kept[-1]["point"], node["point"]) <= 6:
            if node["number"] in protected and kept[-1]["number"] not in protected:
                kept[-1] = node
            continue
        kept.append(node)
    cleaned.append(kept)
owners = []
for nodes in cleaned:
    for left, right in zip(nodes, nodes[1:]):
        same_ref = bool(left["ref"].strip().lstrip("=")) and left["ref"].strip().lstrip("=") == right["ref"].strip().lstrip("=")
        if right["rigid"] == 2 or (left["rigid"] == 2 and right["type"] == "FLAN" and same_ref):
            owners.append(right)

cii = (folder / "ui-run.cii").read_text()
rigid_section = cii.split("#$ RIGID", 1)[1].split("#$", 1)[0]
values = [float(line.split()[0]) for line in rigid_section.splitlines() if line.strip()]
assert len(values) == len(owners), (len(values), len(owners))
for index, (value, node) in enumerate(zip(values, owners)):
    assert abs(value - node["weight"] * 10) <= 1e-6, (index, value, node)
accepted = json.loads((folder / "review-accepted.json").read_text())
unrepresented = []
for item in accepted:
    node = by_key[item["key"]]
    assert abs(node["weight"] - item["weight"]) <= 1e-9, item
    if not any(owner is node for owner in owners):
        unrepresented.append({**item, **node})
# Manual values chosen independently before execution, under the selected x10
# UI option; these must appear in the actual downloaded CII payload.
assert 572.5 in values and 135.0 in values
report = {"status": "FAIL" if unrepresented else "PASS", "observation": "ARTIFACT_INSPECTION",
          "oracle": "INDEPENDENT_REPRODUCTION", "weightToleranceKg": 1e-9,
          "ciiTolerance": 1e-6, "reviewedXmlWeights": len(accepted),
          "rigidRows": len(owners), "positiveCiiWeights": sum(value > 0 for value in values),
          "manualValues": {"57.25kg": 572.5, "13.5kg": 135.0},
          "unrepresented": unrepresented}
(folder / "cii-weight-export-audit.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({key: value for key, value in report.items() if key != "unrepresented"}, indent=2))
print("Unrepresented reviewed weights:", len(unrepresented))
sys.exit(2 if unrepresented else 0)
