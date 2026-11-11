"""Synthetic strict native ownership tests. No private engineering source is loaded."""
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import hashlib
import json
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"converters"/"scripts"))
from xml229_native_final_mass_binding import (
    NativeMassError,verify_emitted_native_masses,emitted_sections,
)


def owner(endpoint="2", reference="REF-1", staged=False):
    return dict(occurrenceId="synthetic-physical-owner", branchName="BR-1",
                nodeNumber="20", componentType="RIGID", componentRefNo=reference,
                endpoint=endpoint, position="5 0 0", kg=12.5,
                stagedLineage=staged,branchOccurrenceIndex=0,engineNodeOrdinal=1)


def edge(endpoint=2,oid="synthetic-physical-owner"):
    a=SimpleNamespace(node_number=10)
    b=SimpleNamespace(source_node_number=None,node_number=20,
        component_type="RIGID",component_ref_no="REF-1",endpoint=endpoint,
        position=(5.0,0.0,0.0),weight=12.5,xml229_original_physical_id=oid)
    return SimpleNamespace(branch_name="BR-1",from_node=a,to_node=b)


def cii(count=1, pointer=None):
    rows=[]
    for i in range(count):
        line=["10 20 0 0 0 0"]+["0 0 0 0 0 0"]*11
        line+=["0 "+str(pointer if pointer is not None else i+1)+" 0 0 0 0",
               "0 0 0 0 0 0","0 0 0"]
        rows.extend(line)
    return ("#$ CONTROL\n"+str(count)+" 0 0 0 0 0\n0 "+str(count)+
        " 0 0 0 0\n0 0 0 0 0 0\n0\n#$ ELEMENTS\n" +
        "\n".join(rows)+"\n#$ RIGID\n"+"125 0\n"*count+"#$ UNITS\nN.\n")


class NativeOwnerCardinalityTests(unittest.TestCase):
    def test_endpoint_zero_is_not_missing(self):
        native=SimpleNamespace(rigid_edges=[edge(0)],edges=[edge(0)])
        proof=verify_emitted_native_masses(cii(),[owner("0")],native)
        self.assertTrue(proof["massesConsumedInNativeRigid"])
        self.assertFalse(proof["nativeCiiReleaseAuthorized"])
        self.assertEqual(proof["claims"][0]["emittedForceN"],125)
        for endpoint in (None,2):
            wrong=SimpleNamespace(rigid_edges=[edge(endpoint)],edges=[edge(endpoint)])
            with self.assertRaises(NativeMassError) as cm:
                verify_emitted_native_masses(cii(),[owner("0")],wrong)
            self.assertEqual(cm.exception.code,"CII_NATIVE_PHYSICAL_OWNER_MISSING")

    def test_zero_vs_multiple_match_without_mass_fallback(self):
        singleton=SimpleNamespace(rigid_edges=[edge()],edges=[edge()])
        with self.assertRaises(NativeMassError) as cm:
            verify_emitted_native_masses(cii(),[owner(reference="OTHER")],singleton)
        self.assertEqual(cm.exception.code,"CII_NATIVE_PHYSICAL_OWNER_MISSING")
        duplicated=SimpleNamespace(rigid_edges=[edge(),edge()],edges=[edge(),edge()])
        slots,weights=emitted_sections(cii(2))
        self.assertEqual((len(slots),len(weights)),(2,2))
        with self.assertRaises(NativeMassError) as cm:
            verify_emitted_native_masses(cii(2),[owner()],duplicated)
        self.assertEqual(cm.exception.code,"CII_NATIVE_PHYSICAL_OWNER_MULTIPLE")
        with self.assertRaises(NativeMassError) as cm:
            verify_emitted_native_masses(cii(pointer=0),[owner()],singleton)
        self.assertEqual(cm.exception.code,"CII_RIGID_ORPHANED")

    def test_actual_native_cli_endpoint_zero_is_bound_and_verified(self):
        source=(
          '<PipeStressExport><Pipe><Branch><Branchname>BR-1</Branchname>'
          '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
          '<Position>0 0 0</Position><Weight>0</Weight></Node>'
          '<Node><NodeNumber>20</NodeNumber><NodeName>WGT</NodeName>'
          '<ComponentType>RIGID</ComponentType><ComponentRefNo>REF-1</ComponentRefNo>'
          '<Endpoint>0</Endpoint><Position>5 0 0</Position><Rigid>2</Rigid>'
          '<Weight>0</Weight></Node></Branch></Pipe></PipeStressExport>')
        oid=json.dumps(["SOURCE",0,1,
            json.dumps(["RIGID","REF-1","0","WGT"],separators=(",",":"))],
            separators=(",",":"))
        packet={"schema":"XML229.NativeFinalPhysicalPacket.v1",
                "sourceId":"SOURCE","basisId":"a"*64,"finalIntentSha256":"b"*64,
                "sourceXmlSha256":hashlib.sha256(source.encode()).hexdigest(),
                "physicalCount":1,"components":[{"occurrenceId":oid,"effectiveKg":12.5}]}
        with TemporaryDirectory() as td:
            directory=Path(td)
            src=directory/"source.xml";src.write_text(source)
            pkt=directory/"packet.json";pkt.write_text(json.dumps(packet))
            dest=directory/"native.cii";proof=directory/"native-proof.json"
            proc=subprocess.run([sys.executable,str(ROOT/"converters"/"scripts"/
                "xml_to_cii2019_runtime_custody.py"),"--input",str(src),
                "--output",str(dest),"--weight-scale","10",
                "--xml229-native-final-packet",str(pkt),
                "--xml229-native-mass-proof",str(proof)],capture_output=True,text=True)
            self.assertEqual(proc.returncode,0,proc.stderr)
            self.assertTrue(dest.is_file())
            claim=json.loads(proof.read_text())
            self.assertTrue(claim["massesConsumedInNativeRigid"])
            self.assertEqual(claim["claims"][0]["massKg"],12.5)
            self.assertEqual(claim["claims"][0]["emittedForceN"],125)
            self.assertFalse(claim["nativeCiiReleaseAuthorized"])


if __name__=="__main__":
    unittest.main()
