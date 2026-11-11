"""Audit downloaded XML/CII using source physical deltas, independent of parser cleanup.

No converter imports. Each positive Rigid=2 weight requires its actual preceding
source endpoint. CII element/rigid records must reproduce the resulting multiset.
The selected UI x10 convention and CII X,Z,-Y axes are explicit oracle inputs.
"""
from collections import Counter
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

folder = Path(sys.argv[1])
scale = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
root = ET.parse(folder / "ui-run.xml").getroot()
for element in root.iter():
    element.tag = element.tag.split("}")[-1]
expected = []
by_key = {}
for branch in root.iter("Branch"):
    name = branch.findtext("Branchname").strip()
    nodes = branch.findall("Node")
    for index, node in enumerate(nodes):
        number = int(node.findtext("NodeNumber"))
        point = tuple(map(float, node.findtext("Position").split()))
        weight = float(node.findtext("Weight") or 0)
        descriptor = "|".join((node.findtext(tag) or "").strip() for tag in
                              ["ComponentRefNo", "Endpoint", "Position", "ComponentType"]
                              if (node.findtext(tag) or "").strip())
        by_key[name + "::" + (str(number) if number > 0 else descriptor)] = weight
        by_key[name + "::" + descriptor] = weight
        if node.findtext("Rigid") != "2" or weight <= 0:
            continue
        assert index > 0, f"Missing source predecessor {name}::{number}"
        before = tuple(map(float, nodes[index - 1].findtext("Position").split()))
        delta = tuple(right - left for left, right in zip(before, point))
        assert math.dist(before, point) > 0, f"Zero-length weighted component {name}::{number}"
        expected.append((name, delta[0], delta[2], -delta[1], weight * scale))

cii = (folder / "ui-run.cii").read_text()
def section(name):
    return [line for line in cii.split("#$ " + name + "\n", 1)[1].split("#$", 1)[0].splitlines() if line.strip()]

rigid = [float(line.split()[0]) for line in section("RIGID")]
elements = section("ELEMENTS")
assert len(elements) % 15 == 0
observed = []
for index in range(0, len(elements), 15):
    block = elements[index:index + 15]
    numbers = [float(block[0][start:end]) for start, end in [(0, 15), (15, 28), (28, 41), (41, 54), (54, 67), (67, 80)]]
    rigid_index = int(block[12].split()[1])
    if rigid_index <= 0 or rigid[rigid_index - 1] <= 0:
        continue
    branch = block[10].strip().split(" ", 1)[1].strip()
    observed.append((branch, *numbers[2:5], rigid[rigid_index - 1]))

# CII stores six significant digits. Compare each independent expected value
# after that defined serialization rounding, without relaxing engineering units.
def serialized(row):
    return (row[0], *(float(f"{value:.6g}") for value in row[1:]))

differences = {
    "missing": list((Counter(map(serialized, expected)) - Counter(map(serialized, observed))).elements()),
    "extra": list((Counter(map(serialized, observed)) - Counter(map(serialized, expected))).elements())}
if differences['missing'] or differences['extra']:
    (folder / "physical-weight-audit-failure.json").write_text(json.dumps({"status": "FAIL",
        "observation": "DOWNLOADED_ARTIFACT_INSPECTION", "oracle": "INDEPENDENT_SOURCE_PHYSICAL_ENDPOINTS_AND_ENTERED_MASSES",
        **differences}, indent=2) + "\n")
    raise AssertionError(differences)
accepted_path = folder / "review-accepted.json"
accepted = json.loads(accepted_path.read_text()) if accepted_path.exists() else []
for item in accepted:
    assert abs(by_key[item["key"]] - item["weight"]) <= 1e-9, item
report = {"status": "PASS", "observation": "DOWNLOADED_ARTIFACT_INSPECTION",
          "oracle": "INDEPENDENT_SOURCE_PHYSICAL_ENDPOINTS_AND_ENTERED_MASSES",
          "weightedSourceComponents": len(expected), "positiveCiiOwners": len(observed),
          "reviewedWeights": len(accepted), "scale": scale,
          "sourceGeometry": "actual immediate predecessor, including negative IDs",
          "serialization": "CII six significant digits", "converterImported": False}
(folder / "physical-weight-audit.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
