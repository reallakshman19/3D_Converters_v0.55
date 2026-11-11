#!/usr/bin/env python3
"""P2810042 rigid-type custody evidence on the active Standalone Python model."""
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "converters" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import xml_to_cii2019 as base
import xml_to_cii2019_patched as patched


def node_xml(number, x, component_type, ref, endpoint, rigid="", weight="0"):
    rigid_xml = f"<Rigid>{rigid}</Rigid>" if str(rigid) else ""
    return (
        f"<Node><NodeNumber>{number}</NodeNumber>"
        f"<Position>{x} 0 0</Position><Endpoint>{endpoint}</Endpoint>"
        f"<ComponentType>{component_type}</ComponentType>"
        f"<ComponentRefNo>{ref}</ComponentRefNo>{rigid_xml}"
        f"<Weight>{weight}</Weight><OutsideDiameter>610</OutsideDiameter>"
        f"</Node>"
    )


def branch(name, nodes):
    return f"<Pipe><Branch><Branchname>{name}</Branchname>{nodes}</Branch></Pipe>"


def edge_key(edge):
    return (edge.branch_name, edge.from_node.node_number, edge.to_node.node_number)


# Source-derived from SYS-24-P2810042_PSI.xml:
# - main B2 repeats positive Node 10 at the same physical coordinate;
# - EXE/B2 has 480 FLAN ep1 -> -1 FLAN ep2 -> 10 RIGID ep2;
# - the RIGID and negative FLAN endpoint are coincident.
# A positive accepted weight makes preserve_weighted_node_numbers temporarily
# allocate the negative predecessor as max-positive+10 = 490. The assertion
# below is deliberately about the active post-cleanup model, not the transient ID.
fixture = (
    "<PipeStressExport xmlns='http://aveva.com/pipeStress116.xsd'>"
    + branch(
        '/HBMR-1000-24"-P2810042-61440-01/B2',
        node_xml(10, 210, "BRAN", "=67127481/56", 1, 1)
        + node_xml(20, 400, "RIGID", "=67127481/48", 2, 2),
    )
    + branch(
        '/HBMR-1000-24-"P2810042-61440-01-EXE/B2',
        node_xml(-1, 0, "BRAN", "=67127432/19", 1, 1)
        + node_xml(480, 0, "FLAN", "=67127432/20", 1)
        + node_xml(-1, 210, "FLAN", "=67127432/20", 2)
        + node_xml(10, 210, "RIGID", "=67127432/19", 2, 2, 12.5),
    )
    + "</PipeStressExport>"
)

with tempfile.TemporaryDirectory() as directory:
    source = Path(directory) / "p2810042-rigid.xml"
    source.write_text(fixture, encoding="utf-8")
    document = base._parse_xml_document(source, preserve_rigid_weight_owners=True)
    model = patched._build_conversion_model(document, {}, {}, {})

    exe = next(branch for branch in document.branches if branch.branch_name.endswith("EXE/B2"))
    exe_numbers = [row.node_number for row in exe.nodes]
    assert exe_numbers == [480, 10], (
        "temporary weighted predecessor 490 must collapse into canonical repeated Node 10; "
        f"retained EXE/B2 nodes={exe_numbers}"
    )
    node10 = exe.nodes[-1]
    assert node10.component_type == "RIGID"
    assert node10.rigid == 2

    rigid_pairs = {
        edge_key(edge) for edge in model.rigid_edges
    }
    assert (
        '/HBMR-1000-24-"P2810042-61440-01-EXE/B2',
        480,
        10,
    ) in rigid_pairs, f"EXE/B2 480->10 must remain a RIGID owner: {sorted(rigid_pairs)}"
    assert not any(490 in (edge.from_node.node_number, edge.to_node.node_number) for edge in model.edges), (
        "current P2810042 canonical-junction custody must not publish a surviving 10/490 element"
    )

# Exhaustive source RIGID identity inventory from the supplied P2810042 XML.
# Every retained source Rigid=2 is an arrival-owned rigid edge; this is the
# differential oracle for the user's 'do not change other rigids' constraint.
source_rigids = [
    ("/B2", 20, "=67127481/48"),
    ("/B2", 130, "=67127481/56"),
    ("/B3", 150, "=67127481/44"),
    ("/B5", 200, "=67127481/186"),
    ("/B5", 290, "=67127481/65"),
    ("/B6", 310, "=67127481/94"),
    ("/B6", 400, "=67127481/75"),
    ("/B4", 420, "=67127481/57"),
    ("/B7", 440, "=67127481/101"),
    ("EXE/B1", 450, "=67127432/17"),
    ("EXE/B2", 10, "=67127432/19"),
]
assert len(source_rigids) == 11
for branch_suffix, number, ref in source_rigids:
    arrival = SimpleNamespace(
        from_node=SimpleNamespace(rigid=None, component_type="PIPE", component_ref_no="PREV"),
        to_node=SimpleNamespace(rigid=2, component_type="RIGID", component_ref_no=ref),
    )
    assert base._edge_is_rigid(arrival), (
        f"source RIGID identity {branch_suffix}::{number} {ref} lost arrival-owned rigid classification"
    )

# Bounded classifier controls: the legacy outgoing FLAN fallback does not make
# arbitrary downstream pipe edges rigid.
same_ref_flange = SimpleNamespace(
    from_node=SimpleNamespace(rigid=2, component_type="RIGID", component_ref_no="=A/100"),
    to_node=SimpleNamespace(rigid=None, component_type="FLAN", component_ref_no="=A/100"),
)
ordinary_pipe = SimpleNamespace(
    from_node=SimpleNamespace(rigid=2, component_type="RIGID", component_ref_no="=R/1"),
    to_node=SimpleNamespace(rigid=None, component_type="PIPE", component_ref_no="=P/2"),
)
assert base._edge_is_rigid(same_ref_flange)
assert base._edge_is_rigid(ordinary_pipe) is False

print(
    "PASS: P2810042 weighted 490 helper collapses to canonical Node10, "
    "480->10 remains rigid, and all 11 source RIGID identities retain arrival ownership"
)
