"""Exercise the actual parser/model/writer using independently entered weights."""
from pathlib import Path
import sys
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "converters" / "scripts"))
import xml_to_cii2019 as base
import xml_to_cii2019_runtime_custody  # installs the active parser, unchanged
import xml_to_cii2019_patched as patched
from xml_cii_weight_output_custody import audit_rigid_weight_owners, require_rigid_weight_owners


def node(number, point, weight=0, rigid=0, component="PIPE"):
    return (f"<Node><NodeNumber>{number}</NodeNumber><Position>{point} 0 0</Position>"
            f"<Endpoint>2</Endpoint><ComponentType>{component}</ComponentType>"
            f"<ComponentRefNo>REF{number}</ComponentRefNo><Rigid>{rigid}</Rigid>"
            f"<Weight>{weight}</Weight></Node>")


def prepare(folder, nodes):
    source = folder / "source.xml"
    source.write_text("<PipeStressExport xmlns='http://aveva.com/pipeStress116.xsd'>"
                      "<Pipe><Branch><Branchname>/B1</Branchname>" + nodes
                      + "</Branch></Pipe></PipeStressExport>", encoding="utf-8")
    doc = base._parse_xml_document(source)
    return source, patched._build_conversion_model(doc, {}, {}, {})


with tempfile.TemporaryDirectory() as directory:
    folder = Path(directory)
    source, model = prepare(folder, node(10, 0) + node(20, 100, 17.75, 2, "VALV")
                            + node(30, 200, 13.5, 2, "FLAN"))
    require_rigid_weight_owners(source, model)
    assert [float(row.split()[0]) for row in base._build_rigid_payload(model, 10)] == [177.5, 135]
    command = [sys.executable, str(ROOT / 'converters/scripts/xml_to_cii2019_runtime_custody.py'),
               '--input', str(source), '--output', str(folder / 'result.cii'), '--weight-scale', '10']
    subprocess.run(command, check=True, capture_output=True, text=True)
    payload = (folder / 'result.cii').read_text().split('#$ RIGID', 1)[1].split('#$', 1)[0]
    assert [float(line.split()[0]) for line in payload.splitlines() if line.strip()] == [177.5, 135]

    cases = [node(10, 0, 17.75, 2, "RIGID") + node(20, 100),
             node(10, 0) + node(20, 0, 13.5, 2, "FLAN") + node(30, 100),
             node(-1, 100, 57.25, 2, "VALV") + node(30, 200)]
    for nodes in cases:
        source, model = prepare(folder, nodes)
        assert len(audit_rigid_weight_owners(source, model)) == 1
        try:
            require_rigid_weight_owners(source, model)
        except ValueError as error:
            assert "CII_WEIGHT_OWNER_UNRESOLVED: 1" in str(error)
        else:
            raise AssertionError("Missing CII owner must block publication")
        (folder / 'result.cii').unlink(missing_ok=True)
        rejected = subprocess.run(command, capture_output=True, text=True)
        assert rejected.returncode != 0 and 'CII_WEIGHT_OWNER_UNRESOLVED: 1' in rejected.stderr
        assert not (folder / 'result.cii').exists(), 'Failed custody must not publish a CII file'

    source, model = prepare(folder, node(10, 0) + node(20, 100, 17.75, 2, "VALV"))
    source.write_text(source.read_text().replace("17.75", "57.25"))
    assert audit_rigid_weight_owners(source, model)[0]["ownerCount"] == 1
    source.write_text(source.read_text().replace("57.25", "nan"))
    try:
        require_rigid_weight_owners(source, model)
    except ValueError as error:
        assert "CII_WEIGHT_INVALID" in str(error)
    else:
        raise AssertionError("Non-finite component weight must block publication")

    source, model = prepare(folder, node(10, 0) + node(20, 100, 17.75, 2, "VALV")
                            + node(20, 100, 17.75, 2, "VALV") + node(30, 200))
    try:
        require_rigid_weight_owners(source, model)
    except ValueError as error:
        assert "CII_WEIGHT_OWNER_AMBIGUOUS" in str(error)
    else:
        raise AssertionError("Duplicated source identity must not share one weight owner")
    (folder / 'result.cii').unlink(missing_ok=True)
    rejected = subprocess.run(command, capture_output=True, text=True)
    assert rejected.returncode != 0 and 'CII_WEIGHT_OWNER_AMBIGUOUS' in rejected.stderr
    assert not (folder / 'result.cii').exists()

print("PASS: retained CII owners/scaling; absent predecessors, zero-length, changed and invalid weights blocked")
