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

if __name__=="__main__":
    unittest.main()
