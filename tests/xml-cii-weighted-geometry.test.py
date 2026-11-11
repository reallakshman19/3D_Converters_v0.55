"""Independent physical endpoints and weights through the active CLI and guard."""
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "converters/scripts"))
import xml_to_cii2019 as base
import xml_to_cii2019_runtime_custody as runtime
import xml_to_cii2019_patched as patched
from xml_cii_weight_output_custody import require_rigid_weight_owners


def node(number, x, weight=0, component="PIPE", ref=None):
    return (f"<Node><NodeNumber>{number}</NodeNumber><Position>{x} 0 0</Position>"
            f"<Endpoint>2</Endpoint><ComponentType>{component}</ComponentType>"
            f"<ComponentRefNo>{ref or 'REF'+str(number)}</ComponentRefNo>"
            f"<Rigid>{2 if weight else 0}</Rigid><Weight>{weight}</Weight></Node>")


def branch(name, nodes):
    return f"<Pipe><Branch><Branchname>{name}</Branchname>{nodes}</Branch></Pipe>"


with tempfile.TemporaryDirectory() as directory:
    folder = Path(directory)
    source = folder / "source.xml"
    source.write_text("<PipeStressExport xmlns='http://aveva.com/pipeStress116.xsd'>"
        + branch("/HEAD", node(-1, 0) + node(20, 89, 59, "RIGID") + node(30, 200))
        + branch("/SHORT", node(100, 0) + node(110, 1, 13.5, "FLAN") + node(120, 100))
        + branch("/SENTINEL", node(200, 0) + node(-1, 100, 378, "VALV", "V1")
                 + node(-1, 200, 303.967, "FLAN", "F1") + node(210, 300))
        + branch("/JUNCTION", node(300, 0) + node(309, 86, 17.75, "FLAN") + node(310, 89) + node(320, 200))
        + branch("/PEER", node(310, 89) + node(400, 300))
        + branch("/START", node(500, 0) + node(510, 3.2) + node(-1, 613.2, 365, "VALV", "VS"))
        + "</PipeStressExport>", encoding="utf-8")
    document = base._parse_xml_document(source)
    model = patched._build_conversion_model(document, {}, {}, {})
    require_rigid_weight_owners(source, model)
    expected = [("/HEAD", 0, 89, 59), ("/SHORT", 0, 1, 13.5),
                ("/SENTINEL", 0, 100, 378), ("/SENTINEL", 100, 200, 303.967),
                ("/JUNCTION", 0, 86, 17.75), ("/START", 3.2, 613.2, 365)]
    observed = [(edge.branch_name, edge.from_node.position[0], edge.to_node.position[0], edge.to_node.weight)
                for edge in model.rigid_edges if edge.to_node.weight > 0]
    assert observed == expected, observed
    assert model.degrees[310] == 3, "Shared source junction must remain connected"
    assert any(edge.from_node.node_number == 309 and edge.to_node.node_number == 310
               and edge.to_node.position[0] - edge.from_node.position[0] == 3 for edge in model.edges)
    sentinels = [n for b in document.branches for n in b.nodes if n.source_node_number == -1]
    assert len(sentinels) == 4 and len({n.node_number for n in sentinels}) == 4
    assert min(n.node_number for n in sentinels) > 510
    output = folder / "result.cii"
    subprocess.run([sys.executable, str(ROOT / "converters/scripts/xml_to_cii2019_runtime_custody.py"),
                    "--input", str(source), "--output", str(output), "--weight-scale", "10"],
                   check=True, capture_output=True, text=True)
    payload = output.read_text().split("#$ RIGID", 1)[1].split("#$", 1)[0]
    weights = [float(row.split()[0]) for row in payload.splitlines() if row.strip()]
    assert weights == [590, 135, 3780, 3039.67, 177.5, 3650], weights
    # The optional preservation policy cannot alter other parser entry points.
    legacy = runtime._ORIGINAL_PARSE_XML_DOCUMENT(source)
    assert all(n.node_number > 0 and n.source_node_number is None for b in legacy.branches for n in b.nodes)
    assert len(legacy.branches[0].nodes) == 2

print("PASS: actual negative predecessors, distinct sentinel owners, 1mm weighted component, 3mm junction hop, CLI masses")
