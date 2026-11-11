"""Independent unit negatives for strict original-Final -> actual CII mass writer."""
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import hashlib
import json
import sys
import subprocess
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"converters"/"scripts"))
from xml229_native_final_mass_binding import (
    NativeMassError, bind_native_final_xml, stage_native_original_lineage,
    assert_preaccepted_geometry_unchanged, assert_native_model_geometry_unchanged,
    verify_emitted_native_masses, audit_finalized_physical_endpoints,
    emitted_sections, _cii_elements,
)
from xml_to_cii2019 import _row, _format_auto_float

def input_xml(weight="0"):
    return ("""<PipeStressExport><Pipe><Branch><Branchname>BR-1</Branchname>
<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>
<Position>0 0 0</Position><Weight>0</Weight></Node>
<Node><NodeNumber>20</NodeNumber><NodeName>WGT</NodeName>
<ComponentType>RIGID</ComponentType><ComponentRefNo>REF-1</ComponentRefNo>
<Endpoint>2</Endpoint><Position>5 0 0</Position><Rigid>2</Rigid>
<Weight>"""+weight+"""</Weight></Node>
</Branch></Pipe></PipeStressExport>""")

def packet(xml,kg=12.5,signature=None):
    sig=signature or ["RIGID","REF-1","2","WGT"]
    source="SOURCE"
    return {"schema":"XML229.NativeFinalPhysicalPacket.v1",
            "basisId":"a"*64,"finalIntentSha256":"b"*64,
            "sourceId":source,"sourceXmlSha256":hashlib.sha256(xml.encode()).hexdigest(),
            "physicalCount":1,
            "components":[{"occurrenceId":json.dumps([source,0,1,json.dumps(sig,separators=(",",":"))],
                                                   separators=(",",":")),
                           "effectiveKg":kg}]}

def cii(force="125",pointer="1"):
    rows=["10 20 0 0 0 0"]
    rows+=["0 0 0 0 0 0"]*11
    rows+=["0 "+pointer+" 0 0 0 0"]
    rows+=["0 0 0 0 0 0","0 0 0"]
    return ("#$ CONTROL\n1 0 0 0 0 0\n0 1 0 0 0 0\n0 0 0 0 0 0\n0\n"
            "#$ ELEMENTS\n"+"\n".join(rows)+"\n"
            "#$ RIGID\n"+force+" 0\n#$ UNITS\nN.\n")

def model(kg):
    node=SimpleNamespace(source_node_number=None,node_number=20,
                         component_type="RIGID",component_ref_no="REF-1",endpoint=2,
                         position=(5.,0.,0.),weight=kg)
    start=SimpleNamespace(node_number=10)
    edge=SimpleNamespace(branch_name="BR-1",from_node=start,to_node=node)
    return SimpleNamespace(rigid_edges=[edge],edges=[edge])

class NativeFinalMassTests(unittest.TestCase):

    def test_l1_independent_typed_branch_connection_proof(self):
        # Two physically distinct rigid mass owners share one junction port.
        xml=('''<PipeStressExport><Pipe>
<Branch><Branchname>HEADER</Branchname>
<Node><NodeNumber>100</NodeNumber><ComponentType>PIPE</ComponentType><Position>0 0 0</Position></Node>
<Node><NodeNumber>110</NodeNumber><ComponentType>RIGID</ComponentType><ComponentRefNo>A</ComponentRefNo><Endpoint>2</Endpoint><Rigid>2</Rigid><Position>1000 0 0</Position></Node>
</Branch><Branch><Branchname>CHILD</Branchname>
<Node><NodeNumber>110</NodeNumber><ComponentType>RIGID</ComponentType><ComponentRefNo>B</ComponentRefNo><Endpoint>1</Endpoint><Rigid>2</Rigid><Position>1000 0 0</Position></Node>
<Node><NodeNumber>120</NodeNumber><ComponentType>RIGID</ComponentType><ComponentRefNo>C</ComponentRefNo><Endpoint>2</Endpoint><Rigid>2</Rigid><Position>1000 500 0</Position></Node>
</Branch></Pipe></PipeStressExport>''')
        def oid(bi, ordinal, ref, endpoint):
            sig=json.dumps(['RIGID',ref,endpoint,''],separators=(',',':'))
            return json.dumps(['SOURCE',bi,ordinal,sig],separators=(',',':'))
        owner_a=oid(0,1,'A','2')
        inlet=oid(1,0,'B','1')
        owner_c=oid(1,1,'C','2')
        with TemporaryDirectory() as td:
            source=Path(td)/'source.xml'
            manifest=Path(td)/'packet.json'
            source.write_text(xml, encoding="utf-8", newline="")
            current=packet(xml)
            current['sourceGenerationId']='frozen-l1-original'
            current['physicalCount']=2
            current['components']=[
                {'occurrenceId':owner_a,'effectiveKg':10},
                {'occurrenceId':owner_c,'effectiveKg':20}]
            lineage={
                'schema':'XML229.SourcePhysicalLineage.v1',
                'sourceId':'SOURCE','basisId':current['basisId'],
                'sourceXmlSha256':current['sourceXmlSha256'],
                'sourceOriginalNodeOccurrences':4,'retainedNodeOccurrences':4,
                'physicalOwnerOccurrenceIds':[owner_a,owner_c],
                'componentEndpointPairs':[],
                'suppressedComponentEndpointPairs':[],
                'branchConnectionAliases':[{
                    'aliasBranchOccurrenceIndex':1,'aliasSourceNodeOrdinal':0,
                    'aliasOccurrenceId':inlet,
                    'terminalBranchOccurrenceIndex':0,'terminalSourceNodeOrdinal':1,
                    'terminalOccurrenceId':owner_a}],
                'counts':{'physicalOwners':2,'componentEndpointWitnesses':0,
                          'suppressedEndpointWitnesses':0,'branchConnectionAliases':1,
                          'sourcePhysicalCandidateOccurrences':3},
                'weightsAccepted':False,'nativeCiiReleaseAuthorized':False,
            }
            current['finalizedGeometry']={
                'schema':'XML229.FinalizedWeightGeometry.v1',
                'basisId':current['basisId'],
                'sourceXmlSha256':current['sourceXmlSha256'],
                'xmlText':xml,'sha256':hashlib.sha256(xml.encode()).hexdigest(),
                'originalNodeCount':4,
                'retainedSourceOrdinalsByBranch':[[0,1],[0,1]],
                'physicalOwnerCardinality':{
                    'schema':'XML229.PreAcceptancePhysicalPartCardinality.v2',
                    'sourcePhysicalNodeOccurrences':2,
                    'reviewedPhysicalNodeOccurrences':2,
                    'pairedEndpointPhysicalParts':0,
                    'distinctPhysicalPartCandidates':2,
                    'weightsAccepted':False,'endpointPairs':[]},
                'physicalLineage':lineage,
            }
            def check(record, failure=None):
                manifest.write_text(json.dumps(record))
                if failure is None:
                    staged=stage_native_original_lineage(source,manifest)
                    self.assertTrue(staged.exists())
                    self.assertEqual(staged.read_text().count('<XML229OriginalPhysicalId>'),2)
                else:
                    with self.assertRaises(NativeMassError) as observed:
                        stage_native_original_lineage(source,manifest)
                    self.assertEqual(observed.exception.code,failure)
            check(current)
            tampered=json.loads(json.dumps(current))
            del tampered['finalizedGeometry']['physicalLineage']
            check(tampered,'NATIVE_PHYSICAL_LINEAGE_REQUIRED')
            tampered=json.loads(json.dumps(current))
            tampered['finalizedGeometry']['physicalLineage']['branchConnectionAliases']=[]
            check(tampered,'NATIVE_PHYSICAL_LINEAGE_ALIAS_DRIFT')
            tampered=json.loads(json.dumps(current))
            tampered['finalizedGeometry']['physicalLineage']['branchConnectionAliases'][0]['terminalOccurrenceId']=owner_c
            check(tampered,'NATIVE_PHYSICAL_LINEAGE_ALIAS_DRIFT')
            tampered=json.loads(json.dumps(current))
            tampered['finalizedGeometry']['physicalLineage']['suppressedComponentEndpointPairs']=[{
                'branchOccurrenceIndex':1,'componentType':'RIGID',
                'componentRefNo':'B','firstSourceNodeOrdinal':0,
                'secondSourceNodeOrdinal':1}]
            check(tampered,'NATIVE_PHYSICAL_LINEAGE_SUPPRESSED_PAIR_DRIFT')
            tampered=json.loads(json.dumps(current))
            tampered['finalizedGeometry']['physicalLineage']['counts']['branchConnectionAliases']=0
            check(tampered,'NATIVE_PHYSICAL_LINEAGE_COUNT_DRIFT')
            tampered=json.loads(json.dumps(current))
            tampered['finalizedGeometry']['physicalLineage']['physicalOwnerOccurrenceIds']=[owner_a,inlet]
            check(tampered,'NATIVE_PHYSICAL_LINEAGE_OWNER_DRIFT')

    def test_exact_original_owner_becomes_weighted_native_xml_and_is_reconciled(self):
        with TemporaryDirectory() as td:
            original=Path(td)/"source.xml"
            transformed=Path(td)/"engine.xml"
            manifest=Path(td)/"packet.json"
            xml=input_xml()
            original.write_text(xml, encoding="utf-8", newline="")
            transformed.write_text(xml, encoding="utf-8", newline="")
            manifest.write_text(json.dumps(packet(xml)))
            output,owners=bind_native_final_xml(original,transformed,manifest)
            self.assertIn("<Weight>12.5</Weight>",output.read_text())
            self.assertEqual(len(owners),1)
            evidence=verify_emitted_native_masses(cii(),owners,model(12.5))
            self.assertTrue(evidence["massesConsumedInNativeRigid"])
            self.assertFalse(evidence["nativeCiiReleaseAuthorized"])
            self.assertEqual(evidence["claims"][0]["nativeElementIndex"],0)
            for altered,code in [("126","CII_NATIVE_APPLIED_MASS_MISMATCH")]:
                with self.assertRaises(NativeMassError) as e:
                    verify_emitted_native_masses(cii(force=altered),owners,model(12.5))
                self.assertEqual(e.exception.code,code)
            with self.assertRaises(NativeMassError) as e:
                verify_emitted_native_masses(cii(pointer="0"),owners,model(12.5))
            self.assertEqual(e.exception.code,"CII_RIGID_ORPHANED")

    def test_actual_python_runtime_writes_and_reconciles_emitted_cii(self):
        with TemporaryDirectory() as td:
            directory=Path(td)
            original=directory/"source.xml"
            packet_path=directory/"packet.json"
            output=directory/"native.cii"
            proof=directory/"proof.json"
            xml=input_xml()
            original.write_text(xml, encoding="utf-8", newline="")
            packet_path.write_text(json.dumps(packet(xml)))
            runner=Path(__file__).resolve().parents[1]/"converters"/"scripts"/"xml_to_cii2019_runtime_custody.py"
            process=subprocess.run([
                sys.executable,str(runner),"--input",str(original),
                "--output",str(output),"--weight-scale","10",
                "--xml229-native-final-packet",str(packet_path),
                "--xml229-native-mass-proof",str(proof),
            ],capture_output=True,text=True)
            self.assertEqual(process.returncode,0,process.stderr)
            self.assertTrue(output.exists(),"Real native converter must publish .cii")
            native=output.read_text()
            result=json.loads(proof.read_text())
            self.assertEqual(result["actualCiiSha256"],
                hashlib.sha256(native.encode("utf-8")).hexdigest())
            self.assertTrue(result["massesConsumedInNativeRigid"])
            self.assertFalse(result["nativeCiiReleaseAuthorized"])
            self.assertIn("125",native.split("#$ RIGID",1)[1].split("#$",1)[0])
            # Confirmed zero has a real native owner, CII pointer and 0 force.
            packet_path.write_text(json.dumps(packet(xml,kg=0)))
            output.unlink()
            proof.unlink()
            process=subprocess.run([
                sys.executable,str(runner),"--input",str(original),
                "--output",str(output),"--weight-scale","10",
                "--xml229-native-final-packet",str(packet_path),
                "--xml229-native-mass-proof",str(proof),
            ],capture_output=True,text=True)
            self.assertEqual(process.returncode,0,process.stderr)
            self.assertTrue(output.exists())
            self.assertEqual(json.loads(proof.read_text())["claims"][0]["massKg"],0)
            self.assertIn("0",output.read_text().split("#$ RIGID",1)[1].split("#$",1)[0])

    def test_worker_finalized_geometry_is_the_exact_native_input(self):
        # The review Worker dropped a gasket BEFORE any accepted mass.
        # Governed Run consumes that same XML, not the original + a different
        # native distance-based cleanup after mass acceptance.
        with TemporaryDirectory() as td:
            directory=Path(td)
            source=directory/"original.xml"
            manifest=directory/"packet.json"
            output=directory/"result.cii"
            proof=directory/"proof.json"
            final_xml=input_xml()
            gasket=("<Node><NodeNumber>30</NodeNumber>"
                    "<ComponentType>GASK</ComponentType>"
                    "<Position>5.2 0 0</Position>"
                    "<ElementLengthMm>2</ElementLengthMm></Node>")
            original_xml=final_xml.replace(
                "\n</Branch>", "\n"+gasket+"\n</Branch>")
            self.assertNotEqual(original_xml,final_xml)
            source.write_text(original_xml, encoding="utf-8", newline="")
            current=packet(original_xml)
            current["sourceGenerationId"]="generation-1"
            current["finalizedGeometry"]={
                "schema":"XML229.FinalizedWeightGeometry.v1",
                "basisId":current["basisId"],
                "sourceXmlSha256":current["sourceXmlSha256"],
                "xmlText":final_xml,
                "sha256":hashlib.sha256(final_xml.encode()).hexdigest(),
                "originalNodeCount":3,
                "retainedSourceOrdinalsByBranch":[[0,1]],
            }
            manifest.write_text(json.dumps(current))
            staged=stage_native_original_lineage(source,manifest)
            self.assertNotIn("<ComponentType>GASK</ComponentType>",staged.read_text())
            self.assertIn("XML229OriginalPhysicalId",staged.read_text())
            runner=Path(__file__).resolve().parents[1]/"converters"/"scripts"/"xml_to_cii2019_runtime_custody.py"
            def run():
                return subprocess.run([sys.executable,str(runner),
                    "--input",str(source),"--output",str(output),
                    "--weight-scale","10","--xml229-native-final-packet",
                    str(manifest),"--xml229-native-mass-proof",str(proof)],
                    capture_output=True,text=True)
            result=run()
            self.assertEqual(result.returncode,0,result.stderr)
            native=json.loads(proof.read_text())
            self.assertEqual(native["finalizedGeometrySha256"],
                             current["finalizedGeometry"]["sha256"])
            self.assertEqual(native["sourcePhysicalCount"],1)
            self.assertEqual(native["claims"][0]["massKg"],12.5)
            output.unlink()
            proof.unlink()
            # Same declared digest but mutated XML is never usable.
            current["finalizedGeometry"]["xmlText"]=final_xml.replace(
                "<Position>5 0 0</Position>","<Position>5 1 0</Position>")
            manifest.write_text(json.dumps(current))
            bad=run()
            self.assertNotEqual(bad.returncode,0)
            self.assertIn("NATIVE_FINALIZED_GEOMETRY_SHA_DRIFT",bad.stderr)
            self.assertFalse(output.exists())
            current["finalizedGeometry"]["sha256"]=hashlib.sha256(
                current["finalizedGeometry"]["xmlText"].encode()).hexdigest()
            manifest.write_text(json.dumps(current))
            wrong_source=run()
            self.assertNotEqual(wrong_source.returncode,0)
            self.assertIn("NATIVE_FINALIZED_GEOMETRY_SOURCE_DRIFT",
                          wrong_source.stderr)

    def test_real_native_cii_consumes_witnessed_valve_pair_mass(self):
        import xml.etree.ElementTree as ET
        xml=(
            '<PipeStressExport><Pipe><Branch><Branchname>PAIR</Branchname>'
            '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
            '<Position>0 0 0</Position></Node>'
            '<Node><NodeNumber>-1</NodeNumber><ComponentType>VALV</ComponentType>'
            '<ComponentRefNo>V-1</ComponentRefNo><Endpoint>1</Endpoint>'
            '<Position>10 0 0</Position></Node>'
            '<Node><NodeNumber>-1</NodeNumber><ComponentType>VALV</ComponentType>'
            '<ComponentRefNo>V-1</ComponentRefNo><Endpoint>2</Endpoint>'
            '<Position>300 0 0</Position></Node>'
            '</Branch></Pipe></PipeStressExport>')
        def oid(ordinal, endpoint):
            sig=json.dumps(['VALV','V-1',endpoint,''],separators=(',',':'))
            return json.dumps(['SOURCE',0,ordinal,sig],separators=(',',':'))
        with TemporaryDirectory() as td:
            directory=Path(td)
            source=directory/'original.xml'
            manifest=directory/'packet.json'
            output=directory/'output.cii'
            proof=directory/'proof.json'
            source.write_text(xml, encoding="utf-8", newline="")
            p=packet(xml,kg=35.5,signature=['VALV','V-1','2',''])
            p['components'][0]['occurrenceId']=oid(2,'2')
            p['sourceGenerationId']='preweight-physical-part-1'
            root=ET.fromstring(xml)
            branch=next(n for n in root.iter() if n.tag=='Branch')
            ns=[n for n in branch if n.tag=='Node']
            ns[1].find('NodeNumber').text='20'
            ns[2].find('NodeNumber').text='30'
            ET.SubElement(ns[2],'Rigid').text='2'
            cleaned=ET.tostring(root,encoding='unicode')
            card={
                'schema':'XML229.PreAcceptancePhysicalPartCardinality.v1',
                'sourcePhysicalNodeOccurrences':2,
                'reviewedPhysicalNodeOccurrences':1,
                'pairedEndpointPhysicalParts':1,
                'distinctPhysicalPartCandidates':1,
                'weightsAccepted':False,
                'endpointPairs':[{
                    'branchOccurrenceIndex':0,'componentType':'VALV',
                    'componentRefNo':'V-1','firstOccurrenceId':oid(1,'1'),
                    'secondOccurrenceId':oid(2,'2'),
                    'firstIsWeightOwner':False,'secondIsWeightOwner':True,
                }],
            }
            p['finalizedGeometry']={
                'schema':'XML229.FinalizedWeightGeometry.v1',
                'basisId':p['basisId'],
                'sourceXmlSha256':p['sourceXmlSha256'],
                'xmlText':cleaned,
                'sha256':hashlib.sha256(cleaned.encode()).hexdigest(),
                'originalNodeCount':3,
                'retainedSourceOrdinalsByBranch':[[0,1,2]],
                'assignedNodeNumbers':[
                    {'branchOccurrenceIndex':0,'sourceNodeOrdinal':1,
                     'sourceNodeNumber':'-1','finalNodeNumber':20},
                    {'branchOccurrenceIndex':0,'sourceNodeOrdinal':2,
                     'sourceNodeNumber':'-1','finalNodeNumber':30},
                ],
                'rigidEdgePromotions':[{
                    'branchOccurrenceIndex':0,
                    'firstSourceNodeOrdinal':1,
                    'secondSourceNodeOrdinal':2,
                    'componentType':'VALV','componentRefNo':'V-1',
                    'distanceMm':290,
                }],
                'physicalOwnerCardinality':card,
            }
            manifest.write_text(json.dumps(p))
            runner=(Path(__file__).resolve().parents[1]/
                    'converters'/'scripts'/'xml_to_cii2019_runtime_custody.py')
            cmd=[sys.executable,str(runner),'--input',str(source),
                '--output',str(output),'--weight-scale','10',
                '--xml229-native-final-packet',str(manifest),
                '--xml229-native-mass-proof',str(proof)]
            result=subprocess.run(cmd,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            native=json.loads(proof.read_text())
            self.assertEqual(native['sourcePhysicalCount'],1)
            self.assertEqual(native['claims'][0]['massKg'],35.5)
            self.assertEqual(native['claims'][0]['emittedForceN'],355)
            self.assertEqual(float(native['claims'][0]['ciiFromNode']),20.0)
            self.assertEqual(float(native['claims'][0]['ciiToNode']),30.0)
            output.unlink();proof.unlink()
            p['finalizedGeometry']['rigidEdgePromotions'][0]['distanceMm']=300
            manifest.write_text(json.dumps(p))
            invalid=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(invalid.returncode,0)
            self.assertIn('NATIVE_PREACCEPTANCE_RIGID_EDGE_DRIFT',
                          invalid.stderr)
            self.assertFalse(output.exists())
            p['finalizedGeometry']['rigidEdgePromotions'][0]['distanceMm']=290
            p['components'][0]['occurrenceId']=oid(1,'1')
            manifest.write_text(json.dumps(p))
            wrong_endpoint=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(wrong_endpoint.returncode,0)
            self.assertIn('NATIVE_NONCANONICAL_ENDPOINT_OWNER',
                          wrong_endpoint.stderr)
            self.assertFalse(output.exists())

    def test_negative_source_nodes_are_normalized_before_final_mass(self):
        # NodeNumber=-1 is not a usable shared native connected-node identity.
        # The verified preacceptance snapshot can allocate its number, but the
        # independent source-ordinal checker must reject every alternate map.
        for negative_owner in (False, True):
            with self.subTest(negative_owner=negative_owner):
                with TemporaryDirectory() as td:
                    d=Path(td)
                    original=d/'source.xml'
                    packet_file=d/'packet.json'
                    cii=d/'result.cii'
                    proof=d/'proof.json'
                    source=input_xml()
                    previous='20' if negative_owner else '10'
                    source=source.replace(f'<NodeNumber>{previous}</NodeNumber>',
                                          '<NodeNumber>-1</NodeNumber>')
                    original.write_text(source, encoding="utf-8", newline="")
                    current=packet(source)
                    current['sourceGenerationId']='preaccept-node-id-normalized'
                    # Original max positive is 10 or 20, respectively.
                    assigned=20 if negative_owner else 30
                    final_xml=source.replace('<NodeNumber>-1</NodeNumber>',
                                            f'<NodeNumber>{assigned}</NodeNumber>')
                    current['finalizedGeometry']={
                        'schema':'XML229.FinalizedWeightGeometry.v1',
                        'basisId':current['basisId'],
                        'sourceXmlSha256':current['sourceXmlSha256'],
                        'xmlText':final_xml,
                        'sha256':hashlib.sha256(final_xml.encode()).hexdigest(),
                        'originalNodeCount':2,
                        'retainedSourceOrdinalsByBranch':[[0,1]],
                        'assignedNodeNumbers':[{
                            'branchOccurrenceIndex':0,
                            'sourceNodeOrdinal':1 if negative_owner else 0,
                            'sourceNodeNumber':'-1',
                            'finalNodeNumber':assigned,
                        }],
                    }
                    packet_file.write_text(json.dumps(current))
                    runner=(Path(__file__).resolve().parents[1]/
                            'converters'/'scripts'/
                            'xml_to_cii2019_runtime_custody.py')
                    command=[sys.executable,str(runner),'--input',str(original),
                             '--output',str(cii),'--weight-scale','10',
                             '--xml229-native-final-packet',str(packet_file),
                             '--xml229-native-mass-proof',str(proof)]
                    result=subprocess.run(command,capture_output=True,text=True)
                    self.assertEqual(result.returncode,0,result.stderr)
                    attested=json.loads(proof.read_text())
                    self.assertEqual(attested['sourcePhysicalCount'],1)
                    self.assertEqual(attested['claims'][0]['massKg'],12.5)
                    self.assertEqual(attested['finalizedGeometrySha256'],
                        current['finalizedGeometry']['sha256'])
                    cii.unlink()
                    proof.unlink()
                    # An internally consistent forged mapping still fails
                    # independent deterministic preaccepted ID allocation.
                    current['finalizedGeometry']['assignedNodeNumbers'][0][
                        'finalNodeNumber']=assigned+10
                    current['finalizedGeometry']['xmlText']=final_xml.replace(
                        f'<NodeNumber>{assigned}</NodeNumber>',
                        f'<NodeNumber>{assigned+10}</NodeNumber>')
                    current['finalizedGeometry']['sha256']=hashlib.sha256(
                        current['finalizedGeometry']['xmlText'].encode()).hexdigest()
                    packet_file.write_text(json.dumps(current))
                    refused=subprocess.run(command,capture_output=True,text=True)
                    self.assertNotEqual(refused.returncode,0)
                    self.assertIn('NATIVE_FINALIZED_NODE_ID_MAP_DRIFT',
                                  refused.stderr)
                    self.assertFalse(cii.exists())

    def test_two_accepted_endpoint_weights_must_not_double_count_one_part(self):
        # The same VALV physical component is described by the two adjacent
        # Endpoints. The source review must be normalized BEFORE Final:
        # an accepted mass on both witnesses is NOT two physical weights.
        xml=(
            '<PipeStressExport><Pipe><Branch><Branchname>B</Branchname>'
            '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
            '<Position>0 0 0</Position></Node>'
            '<Node><NodeNumber>20</NodeNumber><ComponentType>VALV</ComponentType>'
            '<ComponentRefNo>=PART-1</ComponentRefNo><Endpoint>1</Endpoint>'
            '<Position>10 0 0</Position></Node>'
            '<Node><NodeNumber>30</NodeNumber><ComponentType>VALV</ComponentType>'
            '<ComponentRefNo>=PART-1</ComponentRefNo><Endpoint>2</Endpoint>'
            '<Position>200 0 0</Position></Node>'
            '</Branch></Pipe></PipeStressExport>')
        with TemporaryDirectory() as td:
            source=Path(td)/'source.xml'
            packet_file=Path(td)/'accepted.json'
            source.write_text(xml, encoding="utf-8", newline="")
            p=packet(xml)
            p['physicalCount']=2
            p['components']=[]
            for ordinal,endpoint in ((1,'1'),(2,'2')):
                sig=json.dumps(['VALV','=PART-1',endpoint,''],
                               separators=(',',':'))
                oid=json.dumps(['SOURCE',0,ordinal,sig],separators=(',',':'))
                p['components'].append({'occurrenceId':oid,'effectiveKg':0})
            packet_file.write_text(json.dumps(p))
            with self.assertRaises(NativeMassError) as error:
                stage_native_original_lineage(source,packet_file)
            self.assertEqual(error.exception.code,
                'NATIVE_DOUBLE_ENDPOINT_MASS_OWNER')
            self.assertFalse((Path(td)/'source_xml229_lineaged.xml').exists())

    def test_instrument_requires_source_or_verified_prefinal_rigid_end(self):
        # INST follows the Owner's rigid-family policy BEFORE Final. Verify
        # the original source or the independently recomputed promotion;
        # an old Final packet with no promotion is stale, even for zero kg.
        def make_xml(classified):
            rigid='<Rigid>2</Rigid>' if classified else ''
            return (
                '<PipeStressExport><Pipe><Branch><Branchname>INSTRUMENT</Branchname>'
                '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
                '<Position>0 0 0</Position></Node>'
                '<Node><NodeNumber>20</NodeNumber><ComponentType>INST</ComponentType>'
                '<ComponentRefNo>=INST-1</ComponentRefNo><Endpoint>1</Endpoint>'
                '<Position>20 0 0</Position></Node>'
                '<Node><NodeNumber>30</NodeNumber><ComponentType>INST</ComponentType>'
                '<ComponentRefNo>=INST-1</ComponentRefNo><Endpoint>2</Endpoint>'
                '<Position>325 0 0</Position>'
                +rigid+'<Weight>0</Weight></Node></Branch></Pipe></PipeStressExport>')
        sig=json.dumps(['INST','=INST-1','2',''],separators=(',',':'))
        first=json.dumps(['SOURCE',0,1,json.dumps(
            ['INST','=INST-1','1',''],separators=(',',':'))],separators=(',',':'))
        second=json.dumps(['SOURCE',0,2,sig],separators=(',',':'))
        runner=Path(__file__).resolve().parents[1]/'converters'/'scripts'/'xml_to_cii2019_runtime_custody.py'
        for mode,kg in (("SOURCE",18.25),("PREFINAL",18.25),
                        ("PREFINAL",0),("MISSING",18.25),("MISSING",0),
                        ("TAMPERED",18.25)):
            classified = mode == "SOURCE"
            promoted = mode in ("PREFINAL", "TAMPERED")
            with self.subTest(classification=mode,kg=kg):
                with TemporaryDirectory() as td:
                    directory=Path(td)
                    xml=make_xml(classified)
                    final_xml=xml
                    if promoted:
                        final_root=ET.fromstring(xml)
                        final_nodes=list(final_root.iter('Node'))
                        ET.SubElement(final_nodes[2],'Rigid').text='2'
                        final_xml=ET.tostring(final_root,encoding='unicode')
                    source=directory/'original.xml'
                    manifest=directory/'packet.json'
                    output=directory/'result.cii'
                    proof=directory/'proof.json'
                    source.write_text(xml, encoding="utf-8", newline="")
                    p=packet(xml,kg=kg)
                    p['sourceGenerationId']='explicit-source-instrument-case'
                    p['components'][0]['occurrenceId']=second
                    p['finalizedGeometry']={
                        'schema':'XML229.FinalizedWeightGeometry.v1',
                        'basisId':p['basisId'],
                        'sourceXmlSha256':p['sourceXmlSha256'],
                        'xmlText':final_xml,
                        'sha256':hashlib.sha256(final_xml.encode()).hexdigest(),
                        'originalNodeCount':3,
                        'retainedSourceOrdinalsByBranch':[[0,1,2]],
                        'assignedNodeNumbers':[],
                        'rigidEdgePromotions':[{
                            'branchOccurrenceIndex':0,
                            'firstSourceNodeOrdinal':1,
                            'secondSourceNodeOrdinal':2,
                            'componentType':'INST','componentRefNo':'INST-1',
                            'distanceMm':300 if mode == "TAMPERED" else 305,
                        }] if promoted else [],
                        'physicalOwnerCardinality':{
                            'schema':'XML229.PreAcceptancePhysicalPartCardinality.v1',
                            'sourcePhysicalNodeOccurrences':2,
                            'reviewedPhysicalNodeOccurrences':1,
                            'pairedEndpointPhysicalParts':1,
                            'distinctPhysicalPartCandidates':1,
                            'weightsAccepted':False,
                            'endpointPairs':[{
                                'componentType':'INST',
                                'componentRefNo':'INST-1',
                                'branchOccurrenceIndex':0,
                                'firstOccurrenceId':first,
                                'secondOccurrenceId':second,
                                'firstIsWeightOwner':False,
                                'secondIsWeightOwner':True,
                            }],
                        },
                    }
                    manifest.write_text(json.dumps(p))
                    result=subprocess.run([
                        sys.executable,str(runner),'--input',str(source),
                        '--output',str(output),'--weight-scale','10',
                        '--xml229-native-final-packet',str(manifest),
                        '--xml229-native-mass-proof',str(proof),
                    ],capture_output=True,text=True)
                    if classified or mode == "PREFINAL":
                        self.assertEqual(result.returncode,0,result.stderr)
                        evidence=json.loads(proof.read_text())
                        self.assertEqual(evidence['sourcePhysicalCount'],1)
                        self.assertEqual(evidence['claims'][0]['massKg'],kg)
                        self.assertEqual(evidence['claims'][0]['emittedForceN'],kg*10)
                        self.assertEqual(float(evidence['claims'][0]['ciiFromNode']),20)
                        self.assertEqual(float(evidence['claims'][0]['ciiToNode']),30)
                        self.assertTrue(output.exists())
                        self.assertEqual(evidence['claimedNativeRigidCount'],1)
                        self.assertFalse(evidence['claims'][0].get('zeroNonRigidInstrument',False))
                    else:
                        self.assertNotEqual(result.returncode,0)
                        self.assertIn('NATIVE_PREACCEPTANCE_RIGID_EDGE_DRIFT',
                                      result.stderr)
                        self.assertFalse(output.exists())
                        self.assertFalse(proof.exists())

    def test_existing_flange_start_and_native_rigid_end_are_one_owner(self):
        # EF-05 presents FLAN End=1 -> RIGID End=2 with the SAME source
        # physical reference. The approved mass belongs to the existing
        # rigid end, never the separately displayed flange witness.
        xml=(
            '<PipeStressExport><Pipe><Branch><Branchname>PAIR</Branchname>'
            '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
            '<Position>0 0 0</Position></Node>'
            '<Node><NodeNumber>20</NodeNumber><ComponentType>FLAN</ComponentType>'
            '<ComponentRefNo>=F-1</ComponentRefNo><Endpoint>1</Endpoint>'
            '<Rigid>1</Rigid><Position>10 0 0</Position></Node>'
            '<Node><NodeNumber>30</NodeNumber><ComponentType>RIGID</ComponentType>'
            '<ComponentRefNo>=F-1</ComponentRefNo><Endpoint>2</Endpoint>'
            '<Rigid>2</Rigid><Position>122 0 0</Position><Weight>0</Weight></Node>'
            '</Branch></Pipe></PipeStressExport>')
        def oid(ordinal,kind,endpoint):
            signature=json.dumps([kind,'=F-1',endpoint,''],separators=(',',':'))
            return json.dumps(['SOURCE',0,ordinal,signature],separators=(',',':'))
        with TemporaryDirectory() as td:
            folder=Path(td);original=folder/'source.xml'
            manifest=folder/'approved.json';output=folder/'actual.cii'
            proof=folder/'proof.json'
            original.write_text(xml, encoding="utf-8", newline="")
            approved=packet(xml,kg=27.5)
            approved['sourceGenerationId']='cross-family-original-part'
            approved['components'][0]['occurrenceId']=oid(2,'RIGID','2')
            part={
                'branchOccurrenceIndex':0,
                'componentType':'FLAN',
                'componentRefNo':'F-1',
                'firstOccurrenceId':oid(1,'FLAN','1'),
                'secondOccurrenceId':oid(2,'RIGID','2'),
                'firstIsWeightOwner':False,'secondIsWeightOwner':True,
            }
            approved['finalizedGeometry']={
                'schema':'XML229.FinalizedWeightGeometry.v1',
                'basisId':approved['basisId'],
                'sourceXmlSha256':approved['sourceXmlSha256'],
                'xmlText':xml,'sha256':hashlib.sha256(xml.encode()).hexdigest(),
                'originalNodeCount':3,'retainedSourceOrdinalsByBranch':[[0,1,2]],
                'assignedNodeNumbers':[],'rigidEdgePromotions':[],
                'physicalOwnerCardinality':{
                    'schema':'XML229.PreAcceptancePhysicalPartCardinality.v1',
                    'sourcePhysicalNodeOccurrences':2,
                    'reviewedPhysicalNodeOccurrences':1,
                    'pairedEndpointPhysicalParts':1,
                    'distinctPhysicalPartCandidates':1,
                    'weightsAccepted':False,'endpointPairs':[part],
                },
            }
            manifest.write_text(json.dumps(approved))
            runner=(Path(__file__).resolve().parents[1]/
                    'converters'/'scripts'/'xml_to_cii2019_runtime_custody.py')
            cmd=[sys.executable,str(runner),'--input',str(original),
                 '--output',str(output),'--weight-scale','10',
                 '--xml229-native-final-packet',str(manifest),
                 '--xml229-native-mass-proof',str(proof)]
            result=subprocess.run(cmd,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            diag=json.loads(proof.read_text())
            self.assertEqual(diag['sourcePhysicalCount'],1)
            self.assertEqual(diag['claims'][0]['massKg'],27.5)
            self.assertEqual(diag['claims'][0]['emittedForceN'],275)
            self.assertEqual(float(diag['claims'][0]['ciiFromNode']),20)
            self.assertEqual(float(diag['claims'][0]['ciiToNode']),30)
            output.unlink();proof.unlink()
            approved['physicalCount']=2
            approved['components'].append({
                'occurrenceId':oid(1,'FLAN','1'),'effectiveKg':27.5})
            manifest.write_text(json.dumps(approved))
            rejected=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(rejected.returncode,0)
            self.assertIn('NATIVE_DOUBLE_ENDPOINT_MASS_OWNER',rejected.stderr)
            self.assertFalse(output.exists())

    def test_real_ef05_endpoint_aliases_are_not_423_independent_parts(self):
        # Real source geometry, no fabricated acceptance decisions or CII.
        import xml.etree.ElementTree as ET
        source=Path(__file__).resolve().parents[1]/'Benchmarks'/'EF-05-PRO.TEST.xml'
        root=ET.parse(source).getroot()
        for branch in root.iter():
            if branch.tag.split('}')[-1]!='Branch':
                continue
            for node in list(branch):
                if node.tag.split('}')[-1]!='Node':
                    continue
                def val(key):
                    return next(((c.text or '').strip() for c in node
                                 if c.tag.split('}')[-1]==key),'')
                length=val('ElementLengthMm')
                if val('ComponentType')=='GASK' or (
                        length and float(length)<=6):
                    branch.remove(node)
        audited=audit_finalized_physical_endpoints(root)
        self.assertEqual(audited['twoEndpointPhysicalParts'],174)
        from collections import Counter
        self.assertEqual(dict(Counter(
            row['componentType'] for row in audited['aliasPairs'])),
            {'VALV':34,'FLAN':126,'INST':14})
        occurrences=sum(
            sum(1 for node in branch if node.tag.split('}')[-1]=='Node'
                and next(((c.text or '') for c in node
                          if c.tag.split('}')[-1]=='ComponentType'),'')
                in ('RIGID','FLAN','VALV','INST'))
            for branch in root.iter()
            if branch.tag.split('}')[-1]=='Branch')
        self.assertEqual(occurrences,423)
        self.assertEqual(occurrences-audited['twoEndpointPhysicalParts'],249)

    def test_real_ef05_423_original_physical_owner_census(self):
        # Public EF05 audit only: do not label synthetic 423 accepted masses
        # as actual engineering decisions. This detects unsupported native
        # families before anyone mistakes a capacity pass for release proof.
        import xml.etree.ElementTree as ET
        source=(Path(__file__).resolve().parents[1]/
                'Benchmarks'/'EF-05-PRO.TEST.xml')
        root=ET.parse(source).getroot()
        counts={}
        native_existing={}
        for branch in root.iter():
            if branch.tag.split('}')[-1]!='Branch':
                continue
            def field(node,key):
                return next((c.text or '' for c in node
                             if c.tag.split('}')[-1]==key),'').strip()
            source_nodes=[n for n in branch
                          if n.tag.split('}')[-1]=='Node']
            cleaned=[]
            for node in source_nodes:
                typ=field(node,'ComponentType').upper()
                try:
                    length=float(field(node,'ElementLengthMm'))
                except ValueError:
                    length=None
                if typ=='GASK' or length is not None and length<=6:
                    continue
                cleaned.append(node)
            for i,node in enumerate(cleaned):
                typ=field(node,'ComponentType').upper()
                if typ not in ('RIGID','FLAN','VALV','INST'):
                    continue
                counts[typ]=counts.get(typ,0)+1
                prev=cleaned[i-1] if i else None
                ref=field(node,'ComponentRefNo').lstrip('=')
                old=field(prev,'ComponentRefNo').lstrip('=') if prev is not None else ''
                edge_supported=field(node,'Rigid')=='2' or (
                    typ=='FLAN' and prev is not None and
                    field(prev,'Rigid')=='2' and bool(ref) and ref==old)
                if edge_supported:
                    native_existing[typ]=native_existing.get(typ,0)+1
        self.assertEqual(counts,{'RIGID':198,'FLAN':138,'VALV':59,'INST':28})
        self.assertEqual(sum(counts.values()),423)
        self.assertEqual(native_existing,{'RIGID':198})
        self.assertEqual(sum(counts.values())-sum(native_existing.values()),225)

    def test_423_synthetic_accepted_owners_reconcile_actual_native_cii(self):
        # Capacity/lineage regression, NOT a claim that the Owner's 423 EF05
        # physicals have accepted engineering masses or valid native RIGIDs.
        count=423
        nodes=['<Node><NodeNumber>10</NodeNumber>'
               '<ComponentType>PIPE</ComponentType>'
               '<Position>0 0 0</Position><Weight>0</Weight></Node>']
        components=[]
        for i in range(1,count+1):
            name=f'W{i:04d}'
            ref=f'REF-{i:04d}'
            nodes.append(f'<Node><NodeNumber>{10*(i+1)}</NodeNumber>'
                         f'<ComponentType>RIGID</ComponentType>'
                         f'<ComponentRefNo>{ref}</ComponentRefNo>'
                         f'<NodeName>{name}</NodeName><Endpoint>2</Endpoint>'
                         f'<Position>{i*100} 0 0</Position>'
                         '<Rigid>2</Rigid><Weight>0</Weight></Node>')
            signature=json.dumps(["RIGID",ref,"2",name],separators=(",",":"))
            oid=json.dumps(["SYNTHETIC-423",0,i,signature],separators=(",",":"))
            kg=0 if i%7==0 else i
            components.append({"occurrenceId":oid,"effectiveKg":kg})
        xml=('<PipeStressExport><Pipe><Branch><Branchname>BR-1</Branchname>'
             +''.join(nodes)+'</Branch></Pipe></PipeStressExport>')
        with TemporaryDirectory() as td:
            directory=Path(td)
            source=directory/'source.xml'
            manifest=directory/'packet.json'
            output=directory/'output.cii'
            proof=directory/'proof.json'
            source.write_text(xml, encoding="utf-8", newline="")
            p={"schema":"XML229.NativeFinalPhysicalPacket.v1",
               "basisId":"a"*64,"finalIntentSha256":"b"*64,
               "sourceId":"SYNTHETIC-423",
               "sourceGenerationId":"synthetic-only-capacity-test",
               "sourceXmlSha256":hashlib.sha256(xml.encode()).hexdigest(),
               "physicalCount":count,"components":components}
            p["finalizedGeometry"]={
                "schema":"XML229.FinalizedWeightGeometry.v1",
                "basisId":p["basisId"],
                "sourceXmlSha256":p["sourceXmlSha256"],
                "xmlText":xml,"sha256":p["sourceXmlSha256"],
                "originalNodeCount":count+1,
                "retainedSourceOrdinalsByBranch":[list(range(count+1))]}
            manifest.write_text(json.dumps(p))
            runner=Path(__file__).resolve().parents[1]/'converters'/'scripts'/'xml_to_cii2019_runtime_custody.py'
            result=subprocess.run([
                sys.executable,str(runner),'--input',str(source),
                '--output',str(output),'--weight-scale','10',
                '--xml229-native-final-packet',str(manifest),
                '--xml229-native-mass-proof',str(proof),
            ],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr[-5000:])
            report=json.loads(proof.read_text())
            self.assertEqual(report["sourcePhysicalCount"],count)
            self.assertEqual(report["claimedNativeRigidCount"],count)
            self.assertEqual(len(report["claims"]),count)
            # Claims follow canonical occurrence-ID ordering, not numeric
            # component order. Require every exact source identity once.
            actual_by_id={row["occurrenceId"]:row["massKg"]
                          for row in report["claims"]}
            expected_by_id={item["occurrenceId"]:item["effectiveKg"]
                            for item in components}
            self.assertEqual(len(actual_by_id),count)
            self.assertEqual(actual_by_id,expected_by_id)
            self.assertEqual(report["finalizedGeometrySha256"],
                             p["finalizedGeometry"]["sha256"])
            self.assertTrue(report["massesConsumedInNativeRigid"])
            self.assertFalse(report["nativeCiiReleaseAuthorized"])
            self.assertEqual(report["actualCiiSha256"],
                             hashlib.sha256(output.read_bytes()).hexdigest())

    def test_existing_rigid_to_flange_edge_consumes_flange_weight(self):
        with TemporaryDirectory() as td:
            directory=Path(td)
            original=directory/"original.xml"
            output=directory/"native.cii"
            proof=directory/"proof.json"
            manifest=directory/"packet.json"
            xml=input_xml()
            xml=xml.replace(
                "<ComponentType>PIPE</ComponentType>",
                "<ComponentType>RIGID</ComponentType>"
                "<ComponentRefNo>REF-1</ComponentRefNo><Rigid>2</Rigid>")
            xml=xml.replace(
                "<NodeName>WGT</NodeName>\n<ComponentType>RIGID</ComponentType>",
                "<NodeName>WGT</NodeName>\n<ComponentType>FLAN</ComponentType>")
            xml=xml.replace(
                "<Position>5 0 0</Position><Rigid>2</Rigid>",
                "<Position>5 0 0</Position>")
            self.assertIn("<ComponentType>FLAN</ComponentType>",xml)
            original.write_text(xml, encoding="utf-8", newline="")
            p=packet(xml,signature=["FLAN","REF-1","2","WGT"])
            p["sourceGenerationId"]="generation-flange"
            p["finalizedGeometry"]={
                "schema":"XML229.FinalizedWeightGeometry.v1",
                "basisId":p["basisId"],"sourceXmlSha256":p["sourceXmlSha256"],
                "xmlText":xml,"sha256":hashlib.sha256(xml.encode()).hexdigest(),
                "originalNodeCount":2,
                "retainedSourceOrdinalsByBranch":[[0,1]],
            }
            manifest.write_text(json.dumps(p))
            runner=Path(__file__).resolve().parents[1]/"converters"/"scripts"/"xml_to_cii2019_runtime_custody.py"
            result=subprocess.run([
                sys.executable,str(runner),"--input",str(original),
                "--output",str(output),"--weight-scale","10",
                "--xml229-native-final-packet",str(manifest),
                "--xml229-native-mass-proof",str(proof),
            ],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            mass=json.loads(proof.read_text())
            self.assertEqual(mass["sourcePhysicalCount"],1)
            self.assertEqual(mass["claims"][0]["massKg"],12.5)
            self.assertIn("125",output.read_text().split("#$ RIGID",1)[1].split("#$",1)[0])
            # Changing the existing predecessor reference means the actual
            # native edge is not a RIGID owner; never synthesize a marker.
            invalid=xml.replace(
                "<NodeNumber>10</NodeNumber><ComponentType>RIGID</ComponentType>"
                "<ComponentRefNo>REF-1</ComponentRefNo>",
                "<NodeNumber>10</NodeNumber><ComponentType>RIGID</ComponentType>"
                "<ComponentRefNo>OTHER</ComponentRefNo>")
            original.write_text(invalid, encoding="utf-8", newline="")
            p["sourceXmlSha256"]=hashlib.sha256(invalid.encode()).hexdigest()
            p["finalizedGeometry"]["sourceXmlSha256"]=p["sourceXmlSha256"]
            p["finalizedGeometry"]["xmlText"]=invalid
            p["finalizedGeometry"]["sha256"]=p["sourceXmlSha256"]
            manifest.write_text(json.dumps(p))
            output.unlink();proof.unlink()
            rejected=subprocess.run([
                sys.executable,str(runner),"--input",str(original),
                "--output",str(output),"--weight-scale","10",
                "--xml229-native-final-packet",str(manifest),
                "--xml229-native-mass-proof",str(proof),
            ],capture_output=True,text=True)
            self.assertNotEqual(rejected.returncode,0)
            self.assertIn("NATIVE_RIGID_OWNER_UNSUPPORTED",rejected.stderr)
            self.assertFalse(output.exists())

    def test_accepted_owner_cannot_be_removed_from_finalized_geometry(self):
        with TemporaryDirectory() as td:
            directory=Path(td)
            original=directory/"source.xml"
            manifest=directory/"packet.json"
            xml=input_xml()
            original.write_text(xml, encoding="utf-8", newline="")
            # Deliberately drop the accepted RIGID; no mass distribution or
            # remapping to the remaining ordinary PIPE is permissible.
            cleaned=xml.replace(
                '<Node><NodeNumber>20</NodeNumber><NodeName>WGT</NodeName>\n'
                '<ComponentType>RIGID</ComponentType><ComponentRefNo>REF-1</ComponentRefNo>\n'
                '<Endpoint>2</Endpoint><Position>5 0 0</Position><Rigid>2</Rigid>\n'
                '<Weight>0</Weight></Node>', '')
            self.assertNotEqual(cleaned,xml)
            p=packet(xml)
            p["sourceGenerationId"]="generation-2"
            p["finalizedGeometry"]={
                "schema":"XML229.FinalizedWeightGeometry.v1",
                "basisId":p["basisId"],"sourceXmlSha256":p["sourceXmlSha256"],
                "xmlText":cleaned,
                "sha256":hashlib.sha256(cleaned.encode()).hexdigest(),
                "originalNodeCount":2,
                "retainedSourceOrdinalsByBranch":[[0]],
            }
            manifest.write_text(json.dumps(p))
            with self.assertRaises(NativeMassError) as ctx:
                stage_native_original_lineage(original,manifest)
            self.assertEqual(ctx.exception.code,
                             "NATIVE_ACCEPTED_PHYSICAL_NOT_IN_FINAL_GEOMETRY")

    def test_altered_source_or_duplicate_owner_never_applies_mass(self):
        with TemporaryDirectory() as td:
            original=Path(td)/"source.xml"
            transformed=Path(td)/"engine.xml"
            manifest=Path(td)/"packet.json"
            xml=input_xml()
            original.write_text(xml, encoding="utf-8", newline="")
            transformed.write_text(xml, encoding="utf-8", newline="")
            doc=packet(xml)
            manifest.write_text(json.dumps(doc))
            original.write_text(xml.replace("REF-1","DIFFERENT"), encoding="utf-8", newline="")
            with self.assertRaises(NativeMassError) as e:
                bind_native_final_xml(original,transformed,manifest)
            self.assertEqual(e.exception.code,"ORIGINAL_SOURCE_SHA_DRIFT")
            original.write_text(xml, encoding="utf-8", newline="")
            transformed.write_text(xml.replace("<Rigid>2</Rigid>","<Rigid>0</Rigid>"), encoding="utf-8", newline="")
            with self.assertRaises(NativeMassError) as e:
                bind_native_final_xml(original,transformed,manifest)
            self.assertEqual(e.exception.code,"NATIVE_RIGID_OWNER_UNSUPPORTED")
            transformed.write_text(xml.replace("<NodeNumber>20</NodeNumber>",
                "<NodeNumber>21</NodeNumber>"), encoding="utf-8", newline="")
            with self.assertRaises(NativeMassError) as e:
                bind_native_final_xml(original,transformed,manifest)
            self.assertEqual(e.exception.code,"NATIVE_OWNER_LINEAGE_AMBIGUOUS")
            transformed.write_text(xml, encoding="utf-8", newline="")
            doc["components"][0]["effectiveKg"]=0
            manifest.write_text(json.dumps(doc))
            output,owners=bind_native_final_xml(original,transformed,manifest)
            self.assertEqual(owners[0]["kg"],0)
            self.assertIn("<Weight>0</Weight>",output.read_text())
            with self.assertRaises(NativeMassError) as e:
                verify_emitted_native_masses(cii(force="1"),owners,model(0))
            self.assertEqual(e.exception.code,"CII_NATIVE_APPLIED_MASS_MISMATCH")


    def test_unclaimed_native_rigid_must_be_exact_zero(self):
        # A 5e-7 native force must not pass as an unclaimed zero by tolerance.
        original_text=input_xml()
        with TemporaryDirectory() as td:
            d=Path(td)
            original=d/"original.xml"
            enriched=d/"engine.xml"
            manifest=d/"packet.json"
            original.write_text(original_text, encoding="utf-8", newline="")
            enriched.write_text(original_text, encoding="utf-8", newline="")
            manifest.write_text(json.dumps(packet(original_text)))
            _,owners=bind_native_final_xml(original,enriched,manifest)
            graph=model(12.5)
            extra=SimpleNamespace(
                branch_name="UNCLAIMED",
                from_node=SimpleNamespace(node_number=30),
                to_node=SimpleNamespace(
                    source_node_number=None,node_number=40,
                    component_type="RIGID",component_ref_no="UNCLAIMED",
                    endpoint=2,position=(40.,0.,0.),weight=0),
            )
            graph.edges.append(extra)
            graph.rigid_edges.append(extra)
            second=["30 40 0 0 0 0"]+["0 0 0 0 0 0"]*11+[
                "0 2 0 0 0 0","0 0 0 0 0 0","0 0 0"]
            def extra_cii(force):
                text=cii()
                text=text.replace("#$ CONTROL\n1 0","#$ CONTROL\n2 0",1)
                text=text.replace("\n0 1 0 0 0 0\n",
                                  "\n0 2 0 0 0 0\n",1)
                text=text.replace("#$ RIGID\n",
                                  "\n".join(second)+"\n#$ RIGID\n",1)
                return text.replace("#$ RIGID\n125 0\n",
                                    "#$ RIGID\n125 0\n"+force+" 0\n",1)
            for force in ("5.000000E-07","5.000000E-03","1","-5.000000E-07"):
                with self.subTest(force=force):
                    with self.assertRaises(NativeMassError) as failure:
                        verify_emitted_native_masses(extra_cii(force),owners,graph)
                    expected=("CII_RIGID_VALUE_INVALID" if force.startswith("-")
                              else "CII_NATIVE_UNCLAIMED_POSITIVE_RIGID")
                    self.assertEqual(failure.exception.code,expected)
            proof=verify_emitted_native_masses(extra_cii("0"),owners,graph)
            self.assertEqual(proof["claimedNativeRigidCount"],1)

    def test_emitted_scientific_format_matches_actual_formatter(self):
        # Native formatter uses seven significant digits in E-notation, not
        # six; an unrelated tiny output deviation must still fail closed.
        xml=input_xml()
        with TemporaryDirectory() as td:
            original=Path(td)/"original.xml"
            enriched=Path(td)/"engine.xml"
            manifest=Path(td)/"packet.json"
            original.write_text(xml, encoding="utf-8", newline="")
            enriched.write_text(xml, encoding="utf-8", newline="")
            tiny=0.00000001234567
            manifest.write_text(json.dumps(packet(xml,kg=tiny)))
            _,owners=bind_native_final_xml(original,enriched,manifest)
            proof=verify_emitted_native_masses(
                cii(force="1.234567E-07"),owners,model(tiny))
            self.assertEqual(proof["claims"][0]["massKg"],tiny)
            with self.assertRaises(NativeMassError) as e:
                verify_emitted_native_masses(
                    cii(force="1.234568E-07"),owners,model(tiny))
            self.assertEqual(e.exception.code,"CII_NATIVE_APPLIED_MASS_MISMATCH")
            huge=123456780.0
            manifest.write_text(json.dumps(packet(xml,kg=huge)))
            _,owners=bind_native_final_xml(original,enriched,manifest)
            verify_emitted_native_masses(
                cii(force="1.234568E+09"),owners,model(huge))


    def test_geometry_must_be_final_before_weight_acceptance(self):
        from xml.etree import ElementTree as ET
        with TemporaryDirectory() as td:
            original=Path(td)/"source.xml"
            engine=Path(td)/"engine.xml"
            original.write_text(input_xml(), encoding="utf-8", newline="")
            engine.write_text(input_xml(), encoding="utf-8", newline="")
            self.assertTrue(assert_preaccepted_geometry_unchanged(original,engine))
            for mutated in (
                input_xml().replace("<NodeNumber>20</NodeNumber>",
                                    "<NodeNumber>120</NodeNumber>"),
            ):
                engine.write_text(mutated, encoding="utf-8", newline="")
                self.assertTrue(assert_preaccepted_geometry_unchanged(original,engine),
                    "Renumbering alone must not change finalized physical ownership")
            changed=[
                # A collision of node IDs changes the topology even if
                # neither the node count nor any coordinates were altered.
                input_xml().replace("<NodeNumber>20</NodeNumber>",
                                    "<NodeNumber>10</NodeNumber>"),
                input_xml().replace("<Position>5 0 0</Position>",
                                    "<Position>5 1 0</Position>"),
                input_xml().replace("<ComponentType>RIGID</ComponentType>",
                                    "<ComponentType>VALV</ComponentType>"),
                input_xml().replace("</Node>\n</Branch>",
                    "</Node><Node><NodeNumber>30</NodeNumber>"
                    "<ComponentType>PIPE</ComponentType>"
                    "<Position>8 0 0</Position></Node></Branch>"),
            ]
            for mutated in changed:
                engine.write_text(mutated, encoding="utf-8", newline="")
                with self.subTest(mutated=mutated[-80:]):
                    with self.assertRaises(NativeMassError) as exc:
                        assert_preaccepted_geometry_unchanged(original,engine)
                    self.assertEqual(exc.exception.code,
                        "NATIVE_GEOMETRY_CHANGED_AFTER_WEIGHT_ACCEPTANCE")

    def test_native_run_blocks_post_acceptance_short_element_cleanup(self):
        # Actual native parser drops short unweighted helpers. In a governed
        # source their topology must be finalized upstream, not after Final.
        with TemporaryDirectory() as td:
            directory=Path(td)
            original=directory/"source.xml"
            packet_path=directory/"packet.json"
            output=directory/"native.cii"
            proof=directory/"proof.json"
            xml=input_xml().replace(
                "</Node>\n</Branch>",
                "</Node><Node><NodeNumber>30</NodeNumber>"
                "<ComponentType>PIPE</ComponentType>"
                "<Position>5.1 0 0</Position></Node></Branch>")
            original.write_text(xml, encoding="utf-8", newline="")
            packet_path.write_text(json.dumps(packet(xml)))
            runner=Path(__file__).resolve().parents[1]/"converters"/"scripts"/"xml_to_cii2019_runtime_custody.py"
            process=subprocess.run([
                sys.executable,str(runner),"--input",str(original),
                "--output",str(output),"--weight-scale","10",
                "--xml229-native-final-packet",str(packet_path),
                "--xml229-native-mass-proof",str(proof),
            ],capture_output=True,text=True)
            self.assertNotEqual(process.returncode,0)
            self.assertIn("NATIVE_GEOMETRY_CHANGED_AFTER_WEIGHT_ACCEPTANCE",
                          process.stderr)
            self.assertFalse(output.exists())
            self.assertFalse(proof.exists())

    def test_staged_original_occurrence_survives_native_renumbering(self):
        with TemporaryDirectory() as td:
            original=Path(td)/"source.xml"
            transformed=Path(td)/"enriched.xml"
            packet_path=Path(td)/"packet.json"
            xml=input_xml()
            original.write_text(xml, encoding="utf-8", newline="")
            packet_path.write_text(json.dumps(packet(xml)))
            staged=stage_native_original_lineage(original,packet_path)
            self.assertIn("XML229OriginalPhysicalId",staged.read_text())
            transformed.write_text(
                staged.read_text().replace(
                    "<NodeNumber>20</NodeNumber>","<NodeNumber>120</NodeNumber>"), encoding="utf-8", newline="")
            bound,owners=bind_native_final_xml(
                original,transformed,packet_path,require_staged_lineage=True)
            self.assertEqual(owners[0]["nodeNumber"],"120")
            self.assertEqual(owners[0]["kg"],12.5)
            self.assertTrue(owners[0]["stagedLineage"])
            self.assertIn("<Weight>12.5</Weight>",bound.read_text())

    def test_staged_lineage_fail_closed_on_split_lost_and_spoofed_markers(self):
        with TemporaryDirectory() as td:
            original=Path(td)/"source.xml"
            transformed=Path(td)/"enriched.xml"
            packet_path=Path(td)/"packet.json"
            xml=input_xml()
            original.write_text(xml, encoding="utf-8", newline="")
            packet_path.write_text(json.dumps(packet(xml)))
            staged=stage_native_original_lineage(original,packet_path)
            import xml.etree.ElementTree as ET
            tree=ET.parse(staged)
            branch=next(el for el in tree.getroot().iter()
                        if el.tag=="Branch")
            owner=next(node for node in branch if node.tag=="Node"
                       and node.find("XML229OriginalPhysicalId") is not None)
            import copy
            branch.append(copy.deepcopy(owner))
            tree.write(transformed,encoding="utf-8")
            with self.assertRaises(NativeMassError) as e:
                bind_native_final_xml(
                    original,transformed,packet_path,require_staged_lineage=True)
            self.assertEqual(e.exception.code,"NATIVE_CHILD_LINEAGE_MISSING_OR_SPLIT")
            transformed.write_text(xml, encoding="utf-8", newline="")
            with self.assertRaises(NativeMassError) as e:
                bind_native_final_xml(
                    original,transformed,packet_path,require_staged_lineage=True)
            self.assertEqual(e.exception.code,"NATIVE_LINEAGE_STAGE_LOST")
            spoof=xml.replace("<Rigid>2</Rigid>",
                "<XML229OriginalPhysicalId>forged</XML229OriginalPhysicalId><Rigid>2</Rigid>")
            original.write_text(spoof, encoding="utf-8", newline="")
            packet_path.write_text(json.dumps(packet(spoof)))
            with self.assertRaises(NativeMassError) as e:
                stage_native_original_lineage(original,packet_path)
            self.assertEqual(e.exception.code,"NATIVE_UNTRUSTED_LINEAGE_TAG")

class FixedWidthCiiTests(unittest.TestCase):
    def test_actual_writer_signed_scientific_coordinates(self):
        for value in (-0.01, -1e-7, -1e12):
            for axis in range(3):
                with self.subTest(value=value, axis=axis):
                    values = [10, 20, 0, 0, 0, 26.7]
                    values[2 + axis] = value
                    first = _row([_format_auto_float(x) for x in values])
                    self.assertEqual(len(first), 80)
                    self.assertLess(len(first.split()), 6)
                    text = cii().replace('10 20 0 0 0 0', first, 1)
                    self.assertEqual(emitted_sections(text), ({0: (0, '10.0000', '20.0000')}, [125.0]))
                    self.assertEqual(_cii_elements(text), [('10.0000', '20.0000', 1)])

    def test_malformed_fixed_columns_remain_rejected(self):
        valid = _row(['10', '20', '-1.000000E-02', '0', '0', '26.7'])
        cases = [valid + '7', valid.replace('-1.000000E-02', '-1.000000E+XX'),
                 _row(['10', '20', _format_auto_float(-1e100), '0', '0', '26.7']),
                 valid[:28] + ' ' * 13 + valid[41:],
                 valid[:28] + ' 1 2'.rjust(13) + valid[41:],
                 valid[:28] + 'NaN'.rjust(13) + valid[41:]]
        for first in cases:
            with self.subTest(first=first):
                for parser in (emitted_sections, _cii_elements):
                    with self.assertRaises(NativeMassError):
                        parser(cii().replace('10 20 0 0 0 0', first, 1))

    def test_whitespace_fixture_contract_is_preserved(self):
        self.assertEqual(emitted_sections(cii().replace('10 20 0 0 0 0', '10 20 0 0 0 26.7', 1)),
                         ({0: (0, '10', '20')}, [125.0]))



if __name__=="__main__":
    unittest.main()

