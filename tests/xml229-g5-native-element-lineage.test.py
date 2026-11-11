"""Held-out G5 CII ELEMENTS/RIGID physical-child challenge: synthetic only."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
G5=load("g5_native_element_lineage",ROOT/"scripts/xml229-g5-native-element-lineage.py")
OLD=load("gc_pw_fixture",ROOT/"tests/gc-pw-v1-cii-mass-oracle.test.py")
sha=lambda b:hashlib.sha256(b).hexdigest()

def cii_with_elements(weights, pointers=None):
    count=len(weights)
    if pointers is None:pointers=list(range(1,count+1))
    body=OLD.cii(weights)
    header="0 0 0 0 0 0\n0 "+str(count)+" 0 0 0 0"
    assert header in body
    body=body.replace(header,str(count)+" 0 0 0 0 0\n0 "+str(count)+" 0 0 0 0")
    rows=[]
    for i,pointer in enumerate(pointers):
        block=["0 0 0 0 0 0"]*15
        block[0]=f"{100+10*i}.000 {110+10*i}.000 0 0 0 0"
        block[12]=f"0 {pointer} 0 0 0 0"
        block[14]="0 0 0"
        rows.extend(block)
    return body.replace("#$ RIGID\n",
                        "#$ ELEMENTS\n"+"\n".join(rows)+"\n#$ RIGID\n")

def fixture(td,split=True):
    ledger=OLD.make_case(td,split=split)
    weights=["600","607.34"] if split else ["1207.34"]
    data=cii_with_elements(weights).encode()
    (Path(td)/"actual.cii").write_bytes(data)
    ledger["output"]["ciiSha256"]=sha(data)
    lineage={"schemaVersion":G5.SCHEMA,"basisId":OLD.BASIS,
        "ciiSha256":sha(data),"nativeCiiReleaseAuthorized":False,
        "groups":[{"sourceId":"SRC1","componentOccurrenceId":"physical-480",
            "physicalComponentGroupId":"SRC1/physical-480",
            "branchOccurrenceIndex":0,"nodeOrdinal":0,
            "sourceNodeNumber":"-1","sourceComponentRefNo":"480",
            "sourceEndpoint":"","sourceBranchName":"SAME",
            "children":[{"rigidRecordIndex":i,"nativeElementIndex":i,
                "ciiFromNode":100+10*i,"ciiToNode":110+10*i}
                for i in range(len(weights))]}],
        "nonmassRigid":[]}
    return ledger,lineage

def must_fail(fn,code):
    try:fn()
    except (G5.LineageError,G5.MASS.MassOracleError) as exc:
        assert exc.code==code, f"Expected {code}, got {exc.code}"
        return
    raise AssertionError("Missing expected hold "+code)

class NativeElementLineageTests(unittest.TestCase):
    def verify(self,ledger,lineage,td):
        return G5.verify_lineage(ledger,lineage,
            (Path(td)/"actual.cii").read_bytes(),td,td)

    def test_split_child_real_cii_pointer_and_mass_lineage_challenged_only(self):
        with tempfile.TemporaryDirectory() as td:
            ledger,lineage=fixture(td)
            result=self.verify(ledger,lineage,td)
            self.assertEqual(result["ciiElements"],2)
            self.assertEqual(result["ciiRigidRecords"],2)
            self.assertEqual(result["status"],
                             "ELEMENT_POINTER_AND_CLAIMED_LINEAGE_CHALLENGED")
            self.assertFalse(result["nativeCiiReleaseAuthorized"])
            self.assertFalse(result["physicalMatch2ConsumptionVerified"])
            self.assertFalse(result["independentLineageAuthorVerified"])

    def test_changed_native_endpoint_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            ledger,lineage=fixture(td)
            lineage["groups"][0]["children"][0]["ciiToNode"]=999
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "LINEAGE_NATIVE_ENDPOINT_DRIFT")

    def test_swapped_pointer_rejected_even_when_rigid_masses_match(self):
        with tempfile.TemporaryDirectory() as td:
            ledger,lineage=fixture(td)
            data=cii_with_elements(["600","607.34"],[2,1]).encode()
            (Path(td)/"actual.cii").write_bytes(data)
            ledger["output"]["ciiSha256"]=sha(data)
            lineage["ciiSha256"]=sha(data)
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "LINEAGE_RIGID_ELEMENT_POINTER_DRIFT")

    def test_duplicate_or_orphan_pointer_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            ledger,lineage=fixture(td)
            for pointers,code in [([1,1],"DUPLICATE_CII_RIGID_POINTER"),
                                  ([1,0],"UNREFERENCED_CII_RIGID_RECORD")]:
                data=cii_with_elements(["600","607.34"],pointers).encode()
                (Path(td)/"actual.cii").write_bytes(data)
                ledger["output"]["ciiSha256"]=sha(data)
                lineage["ciiSha256"]=sha(data)
                must_fail(lambda:self.verify(ledger,lineage,td),code)

    def test_original_ordinal_and_reference_checked_from_original_source(self):
        with tempfile.TemporaryDirectory() as td:
            ledger,lineage=fixture(td)
            lineage["groups"][0]["nodeOrdinal"]=1
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "LINEAGE_ORIGINAL_PHYSICAL_DRIFT")
            lineage["groups"][0]["nodeOrdinal"]=0
            lineage["groups"][0]["sourceComponentRefNo"]="481"
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "LINEAGE_ORIGINAL_PHYSICAL_DRIFT")

    def test_forged_release_output_sha_and_missing_child_denied(self):
        with tempfile.TemporaryDirectory() as td:
            ledger,lineage=fixture(td)
            lineage["nativeCiiReleaseAuthorized"]=True
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "LINEAGE_CLAIMED_RELEASE_AUTHORITY")
            lineage["nativeCiiReleaseAuthorized"]=False
            lineage["ciiSha256"]="0"*64
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "LINEAGE_CII_SHA_DRIFT")
            lineage["ciiSha256"]=ledger["output"]["ciiSha256"]
            lineage["groups"][0]["children"]=lineage["groups"][0]["children"][:1]
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "LINEAGE_CHILD_ALLOCATIONS_DRIFT")

    def test_bad_element_count_and_wrong_accepted_mass_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            ledger,lineage=fixture(td)
            body=(Path(td)/"actual.cii").read_text().replace(
                "2 0 0 0 0 0\n0 2","1 0 0 0 0 0\n0 2")
            data=body.encode()
            (Path(td)/"actual.cii").write_bytes(data)
            ledger["output"]["ciiSha256"]=sha(data)
            lineage["ciiSha256"]=sha(data)
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "CII_ELEMENTS_COUNT_MISMATCH")
            ledger,lineage=fixture(td)
            ledger["groups"][0]["acceptedKg"]="15"
            must_fail(lambda:self.verify(ledger,lineage,td),
                      "ACCEPTED_MASS_MISMATCH")

    def test_file_cli_invocation_requires_same_actual_cii(self):
        with tempfile.TemporaryDirectory() as td:
            ledger,lineage=fixture(td,split=False)
            (Path(td)/"ledger.json").write_text(json.dumps(ledger))
            (Path(td)/"lineage.json").write_text(json.dumps(lineage))
            result=G5.run_files(Path(td)/"ledger.json",Path(td)/"actual.cii",
                                Path(td)/"lineage.json",td,td)
            self.assertEqual(result["physicalGroups"],1)
            self.assertFalse(result["nativeCiiReleaseAuthorized"])

    def test_actual_native_python_rigid_writer_consumer_with_independent_kg_oracle(self):
        """Production Python writer, synthetic positive kg witness, NOT Final release."""
        import sys
        scripts=ROOT/"converters"/"scripts"
        if str(scripts) not in sys.path:
            sys.path.insert(0,str(scripts))
        import xml_to_cii2019 as native
        import xml_to_cii2019_patched as patched
        from xml_cii_weight_output_custody import require_rigid_weight_owners

        def source(kg):
            return (
                "<PipeStressExport xmlns='http://aveva.com/pipeStress116.xsd'>"
                "<Pipe><Branch><Branchname>/PUBLIC-RIGID-OWNER/B1</Branchname>"
                "<Node><NodeNumber>10</NodeNumber><Position>0 0 0</Position>"
                "<Endpoint>1</Endpoint><ComponentType>BRAN</ComponentType>"
                "<ComponentRefNo>PUBLIC/1</ComponentRefNo><OutsideDiameter>610</OutsideDiameter>"
                "<Weight>0</Weight></Node>"
                "<Node><NodeNumber>20</NodeNumber><Position>200 0 0</Position>"
                "<Endpoint>2</Endpoint><ComponentType>RIGID</ComponentType>"
                "<ComponentRefNo>PUBLIC/2</ComponentRefNo><Rigid>2</Rigid>"
                f"<Weight>{kg}</Weight><OutsideDiameter>610</OutsideDiameter></Node>"
                "</Branch></Pipe></PipeStressExport>"
            )

        for entered_kg,expected_cii_weight in ((35,350),(19.5,195),(0,0)):
            with self.subTest(entered_kg=entered_kg):
                with tempfile.TemporaryDirectory() as td:
                    path=Path(td)/"original.xml"
                    path.write_text(source(entered_kg),encoding="utf-8")
                    document=native._parse_xml_document(
                        path,preserve_rigid_weight_owners=True)
                    model=patched._build_conversion_model(document,{},{},{})
                    # Native custody must prove one arrival-owned rigid slot.
                    require_rigid_weight_owners(path,model)
                    rows=native._build_rigid_payload(model,weight_scale=10)
                    self.assertEqual(len(rows),1,"one original physical owner")
                    emitted=float(rows[0].split()[0])
                    self.assertEqual(emitted,expected_cii_weight)
                    native_kg=native._build_rigid_payload(model,weight_scale=1)
                    self.assertEqual(float(native_kg[0].split()[0]),entered_kg)
                    self.assertFalse(any(float(line.split()[0])<0 for line in rows))
        # This test never fabricates an accepted Match-1/Final decision or
        # marks native CII release authorized. Independent G5 oracle is separate.

    def test_actual_runtime_cli_written_cii_rigid_pointer_and_mass(self):
        """Invoke the exact native standalone Python runtime CLI, never release."""
        import sys
        import subprocess

        native=ROOT/"converters"/"scripts"/"xml_to_cii2019_runtime_custody.py"
        def xml(kg):
            return (
                "<PipeStressExport xmlns='http://aveva.com/pipeStress116.xsd'>"
                "<Pipe><Branch><Branchname>/PUBLIC-RIGID-OWNER/B1</Branchname>"
                "<Node><NodeNumber>10</NodeNumber><Position>0 0 0</Position>"
                "<Endpoint>1</Endpoint><ComponentType>BRAN</ComponentType>"
                "<ComponentRefNo>PUBLIC/1</ComponentRefNo><OutsideDiameter>610</OutsideDiameter>"
                "<Weight>0</Weight></Node>"
                "<Node><NodeNumber>20</NodeNumber><Position>200 0 0</Position>"
                "<Endpoint>2</Endpoint><ComponentType>RIGID</ComponentType>"
                "<ComponentRefNo>PUBLIC/2</ComponentRefNo><Rigid>2</Rigid>"
                f"<Weight>{kg}</Weight><OutsideDiameter>610</OutsideDiameter></Node>"
                "</Branch></Pipe></PipeStressExport>"
            )
        for source_kg in (35,19.5,0):
            with self.subTest(source_kg=source_kg):
                with tempfile.TemporaryDirectory() as td:
                    orig=Path(td)/"source.xml"
                    out=Path(td)/"native.cii"
                    orig.write_text(xml(source_kg),encoding="utf-8")
                    run=subprocess.run([
                        sys.executable,str(native),"--input",str(orig),
                        "--output",str(out),"--weight-scale","10",
                    ],capture_output=True,text=True,timeout=30)
                    self.assertEqual(run.returncode,0,
                        "Production native CLI held: "+run.stderr[-1500:])
                    emitted=out.read_text(encoding="utf-8")
                    nodes,rigid_to_element=G5.parse_elements(emitted)
                    self.assertEqual(len(nodes),1)
                    self.assertEqual(rigid_to_element,{0:0},
                        "Exactly one native CII ELEMENT must point to rigid slot 1")
                    slots=G5.sections_from_output(emitted)["RIGID"]
                    self.assertEqual(len(slots),1)
                    cii_weight=float(slots[0].split()[0])
                    self.assertEqual(cii_weight,source_kg*10,
                        "Independent source kg x one configured scale = emitted CII weight")
                    self.assertEqual(len(slots[0].split()),2)
                    # Not an original owner Final review or release attestation;
                    # merely a differential executable native consumer witness.

if __name__=="__main__":
    unittest.main()
