"""Source-authoritative native hydration regression transferred into PR372 from dropped PR371.

Actual BM2 public master/line-list facts are used. Numeric material 741 is a
controlled illustrative mapping, NOT an Owner-approved production material ID.
These checks do not alter the CII numerical writer or accepted Final mass.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import subprocess
import sys
import unittest
from zipfile import ZipFile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "converters" / "scripts"
sys.path.insert(0, str(SCRIPTS))


class NativeHydrationContract(unittest.TestCase):
    def test_approved_line_list_mapping_not_overridden_by_heuristic(self):
        import xml_to_cii2019_patched as native
        config={'linelist':{'masterRows':[{
            'lineSeqNo':'4110001','ownerApprovedT1':'120','Temp Max':'777'
        }],'fieldMap':{'lineSeqNo':'lineSeqNo','t1':'ownerApprovedT1'}}}
        native._normalize_process_field_map(config)
        self.assertEqual(config['linelist']['fieldMap']['t1'],'ownerApprovedT1')
        self.assertEqual(native._mapped_process_value('P4110001',config,'t1',
                                                    ['T1','Temp Max']),'120')

    def test_saved_smart_regex_line_identity_reaches_native_and_rejects_stale_token(self):
        import xml_to_cii2019_patched as native
        branch='/GLRD-1000-6"-P4110001-93833-01/B6'
        fmt={'enabled': True, 'tokenDelimiter': '-',
             'lineKey': {'extractMode': 'TOKEN', 'tokenPosition': 4},
             'pipingClass': {'extractMode': 'TOKEN', 'tokenPosition': 5},
             'rating': {}, 'bore': {'extractMode': 'TOKEN','tokenPosition': 3}}
        cfg={'linelist':{'lineKeyTokenPositions':'4'},
             'regexTester':{'formats':[fmt], 'ratingSequence':[]}}
        self.assertEqual(native._line_key_from_branch(branch,cfg),'P4110001')
        # Change the saved FORMAT only. A failing regex must not permit the
        # legacy token-position field to keep matching an old master row.
        fmt['lineKey']={'extractMode':'REGEX',
                        'regex':r'-(P9999999)-', 'group':1,
                        'tokenPosition':4}
        self.assertEqual(native._line_key_from_branch(branch,cfg),'',
            'unmatched optional Regex leaves Line List unassigned')
        fmt['lineKey']['regex']=r'-(P4110001)-'
        self.assertEqual(native._line_key_from_branch(branch,cfg),'P4110001')
        # Conflicting enabled format claims are never first-row-wins.
        conflict={'enabled':True,'tokenDelimiter':'-',
                  'lineKey':{'extractMode':'TOKEN','tokenPosition':5},
                  'pipingClass':{'extractMode':'TOKEN','tokenPosition':5},
                  'rating':{},'bore':{}}
        cfg['regexTester']['formats'].append(conflict)
        self.assertEqual(native._line_key_from_branch(branch,cfg),'',
            'two conflicting saved formats leave master enrichment unassigned')
        cfg['requireVerifiedMasterCompleteness']=True
        with self.assertRaisesRegex(ValueError,'XML229_BRANCH_FORMAT_AMBIGUOUS'):
            native._line_key_from_branch(branch,cfg)
        cfg['requireVerifiedMasterCompleteness']=False
        conflict['enabled']=False
        self.assertEqual(native._line_key_from_branch(branch,cfg),'P4110001')
        cfg['regexTester']['formats']=[]
        self.assertEqual(native._line_key_from_branch(branch,cfg),'',
            'unmatched optional Regex leaves Line List unassigned')

    def test_material_scoped_pin_conflicts_fail_closed(self):
        import xml_to_cii2019_patched as native
        name='ASTM A790 UNS S31803'
        source={'material':{'mapRows':[{'Material Name':name,'Material Code':'738'}]}}
        self.assertEqual(native._material_ids_from_config(source,{name}),{name:738})
        self.assertEqual(native._material_ids_from_config({
            'overrides':{'materialCode':{'PC:93833':'738','P4110001':'738',
                                         'MAT:A790-S32803':'338'}}},{name}),{})
        conflict={**source,'overrides':{'materialCode':{name:'741'}}}
        with self.assertRaisesRegex(ValueError,'XML229_MATERIAL_PIN_MAP_CONFLICT'):
            native._material_ids_from_config(conflict,{name})
        with self.assertRaisesRegex(ValueError,'XML229_MATERIAL_PIN_INVALID'):
            native._material_ids_from_config({
                'overrides':{'materialCode':{name:'A790-S31803'}}},{name})
        with self.assertRaisesRegex(ValueError,'XML229_MATERIAL_PIN_CONFLICT'):
            native._material_ids_from_config({'overrides':{'materialCode':{
                name:'741','MAT:A790-S31803':'742'}}},{name})

    def test_unresolved_nonblank_process_material_blocks_class_guess(self):
        import xml_to_cii2019_patched as native
        name='ASTM A790 UNS S31803'
        cls={'pipingClass':{'masterRows':[{'Piping Class':'93833',
            'convertedBore':150,'Material_Name':name,'Rating':'900'}]},
             'material':{'mapRows':[{'Material':name,'Code':'741'}]}}
        process={**cls,'linelist':{'masterRows':[
            {'lineSeqNo':'4110001','Material':'ASTM A106-B'}]}}
        branch=ET.Element('Branch')
        ET.SubElement(branch,'Branchname').text='/GLRD-1000-6"-P4110001-93833-01/B6'
        node=ET.SubElement(branch,'Node')
        ET.SubElement(node,'ComponentType').text='PIPE'
        ET.SubElement(node,'OutsideDiameter').text='168.3'
        self.assertEqual(native._process_material_for_line('P4110001',process),
                         'ASTM A106-B')
        ids=native._material_ids_from_config(process,{name,'ASTM A106-B'})
        self.assertEqual(ids,{name:741})
        self.assertTrue(native._apply_source_material_rating(
            branch,'',native._source_class_meta_index(process),ids,'ASTM A106-B'))
        # The higher-authority but unmapped process material cannot acquire 741.
        self.assertEqual(node.findtext('MaterialName'),'ASTM A106-B')
        self.assertEqual(node.findtext('PipingClassRating'),'900')
        self.assertIsNone(node.find('MaterialCode'))
        with self.assertRaisesRegex(ValueError,'XML229_LINE_MATERIAL_AMBIGUOUS'):
            native._process_material_for_line('P4110001',{**process,
             'linelist':{'masterRows':[{'lineSeqNo':'4110001','Material':'ASTM A106-B'},
                                      {'lineSeqNo':'4110001','Material':name}]}})

    def test_process_material_higher_authority_than_class_and_native_cii(self):
        import xml_to_cii2019_patched as native
        cfg={'pipingClass':{'masterRows':[{'Piping Class':'93833',
            'convertedBore':150,'Material_Name':'ASTM A790 UNS S31803',
            'Wall thickness':'7.112','Rating':'900'}]},
            'material':{'mapRows':[{'Material Name':'ASTM A106-B','Material Code':'106'},
                                   {'Material Name':'ASTM A790 UNS S31803',
                                    'Material Code':'741'}]},
            'linelist':{'masterRows':[{'lineSeqNo':'4110001','MOC':'ASTM A106-B'}],
                        'fieldMap':{'lineSeqNo':'lineSeqNo','material':'MOC'}}}
        with TemporaryDirectory() as folder:
            path=Path(folder)/'process.xml'; cii=Path(folder)/'process.cii'
            path.write_text('<PipeStressExport><Pipe><Branch>'
                '<Branchname>/GLRD-1000-6"-P4110001-93833-01/B6</Branchname>'
                '<Node><NodeNumber>10</NodeNumber><ComponentType>BRAN</ComponentType>'
                '<OutsideDiameter>168.3</OutsideDiameter><WallThickness>0</WallThickness>'
                '<Position>0 0 0</Position></Node>'
                '<Node><NodeNumber>20</NodeNumber><ComponentType>PIPE</ComponentType>'
                '<OutsideDiameter>168.3</OutsideDiameter><WallThickness>0</WallThickness>'
                '<Position>100 0 0</Position></Node>'
                '</Branch></Pipe></PipeStressExport>',encoding='utf-8')
            enriched=native._apply_process_data_to_xml(path,cfg)
            try:
                root=ET.parse(enriched).getroot()
                pipe=next(root.iter('Node'))
                self.assertEqual(pipe.findtext('MaterialName'),'ASTM A106-B')
                self.assertEqual(pipe.findtext('MaterialCode'),'106')
                self.assertEqual(pipe.findtext('PipingClassRating'),'900')
                run=subprocess.run([sys.executable,str(SCRIPTS/'xml_to_cii2019.py'),
                                    '--input',str(enriched),'--output',str(cii)],
                                   capture_output=True,text=True,timeout=30)
                self.assertEqual(run.returncode,0,run.stderr)
                misc=cii.read_text().split('#'+'$ MISCEL_1',1)[1].split('#'+'$ ',1)[0]
                self.assertEqual(float(misc.splitlines()[1].split()[0]),106)
            finally:
                if enriched!=path:enriched.unlink(missing_ok=True)

    def test_material_rating_93833_and_exact_configured_code_to_cii(self):
        """Real class source + expressly configured map -> CII material slot."""
        import xml_to_cii2019_patched as native
        spec=json.loads((ROOT/'docs/Masters/SpecwisePipingClass/93833.json').read_text())
        source=ROOT/'Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml'
        cfg={'pipingClass':{'masterRows':spec['rows']},
             'material':{'mapRows':[{'Material':'ASTM A790 UNS S31803','Code':'741'}]}}
        enriched=native._apply_process_data_to_xml(source,cfg)
        try:
            root=ET.parse(enriched).getroot()
            branches=[v for v in root.iter() if v.tag.rsplit('}',1)[-1]=='Branch']
            nodes=[v for v in branches[0] if v.tag.rsplit('}',1)[-1]=='Node']
            def field(n,key):
                return next((x.text or '' for x in n if x.tag.rsplit('}',1)[-1]==key),'')
            self.assertEqual(field(nodes[0],'ComponentType'),'BRAN')
            self.assertEqual(field(nodes[0],'PipingClass'),'93833')
            self.assertEqual(field(nodes[0],'PipingClassRating'),'900')
            self.assertEqual(field(nodes[0],'MaterialName'),'ASTM A790 UNS S31803')
            self.assertEqual(field(nodes[0],'MaterialCode'),'741')
            self.assertEqual(field(nodes[1],'MaterialCode'),'')  # ANCI is not a pipe
        finally:
            if enriched!=source: enriched.unlink(missing_ok=True)
        self.assertEqual(native._material_ids_from_config({
            'material':{'mapRows':[{'Material':'A790-S32803','Code':'338'}]}}),
            {'A790-S32803':338})
        # The bundled S32803 spelling is NOT silently accepted for S31803.
        with TemporaryDirectory() as d:
            original=Path(d)/'one-pipe.xml'; out=Path(d)/'one-pipe.cii'
            original.write_text(
                '<PipeStressExport><Pipe><Branch>'
                '<Branchname>/GLRD-1000-6"-P4110001-93833-01/B6</Branchname>'
                '<Temperature><Temperature1>120</Temperature1></Temperature>'
                '<Pressure><Pressure1>11000</Pressure1></Pressure>'
                '<MaterialNumber>0</MaterialNumber>'
                '<Node><NodeNumber>10</NodeNumber><Endpoint>1</Endpoint>'
                '<ComponentType>BRAN</ComponentType><OutsideDiameter>168.3</OutsideDiameter>'
                '<WallThickness>0</WallThickness><Position>0 0 0</Position></Node>'
                '<Node><NodeNumber>20</NodeNumber><Endpoint>2</Endpoint>'
                '<ComponentType>PIPE</ComponentType><OutsideDiameter>168.3</OutsideDiameter>'
                '<WallThickness>0</WallThickness><Position>100 0 0</Position></Node>'
                '</Branch></Pipe></PipeStressExport>',encoding='utf-8')
            enriched=native._apply_process_data_to_xml(original,cfg)
            command=[sys.executable,str(SCRIPTS/'xml_to_cii2019.py'),
                     '--input',str(enriched),'--output',str(out)]
            result=subprocess.run(command,capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stderr)
            data=out.read_text(encoding='utf-8')
            misc=data.split('#'+'$ MISCEL_1',1)[1].split('#'+'$ ',1)[0]
            self.assertEqual(float(misc.splitlines()[1].split()[0]),741)
            if enriched!=original: enriched.unlink(missing_ok=True)

    def test_real_bm2_combined_line_class_material_to_native_cii(self):
        """Real BM2 field facts serialized through isolated native 10->20; synthetic ID 741."""
        import xml_to_cii2019_patched as native
        from zipfile import ZipFile
        xml=ROOT/'Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml'
        book=ROOT/'Benchmarks/XML-CII-2019/revamped/LL_BM2.xlsx'
        sheet_ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        with ZipFile(book) as workbook:
            sheet=ET.fromstring(workbook.read('xl/worksheets/sheet3.xml'))
        def cell(ref):
            target=next(n for n in sheet.iter(sheet_ns+'c') if n.get('r')==ref)
            return target.findtext(sheet_ns+'v')
        self.assertEqual((cell('C9'),cell('V9'),cell('K9'),cell('Y9'),cell('Z9')),
                         ('4110001','93833','11000','120','-50'))
        row={'lineSeqNo':cell('C9'),'p1':cell('K9'),'t1':cell('Y9'),
             't2':'40','t3':cell('Z9'),'densityMixed':cell('M9')}
        spec=json.loads((ROOT/'docs/Masters/SpecwisePipingClass/93833.json').read_text())
        cfg={'linelist':{'masterRows':[row], 'fieldMap':{
                'lineSeqNo':'lineSeqNo','p1':'p1','t1':'t1','t2':'t2',
                't3':'t3','densityMixed':'densityMixed'}},
             'pipingClass':{'masterRows':spec['rows']},
             'material':{'mapRows':[{'Material':'ASTM A790 UNS S31803',
                                     'Code':'741'}]}}
        enriched=native._apply_process_data_to_xml(xml,cfg)
        try:
            root=ET.parse(enriched).getroot()
            first=next(n for n in root.iter() if n.tag.rsplit('}',1)[-1]=='Branch')
            nodes=[n for n in first if n.tag.rsplit('}',1)[-1]=='Node']
            def field(n,key):
                return next((x.text or '' for x in n if x.tag.rsplit('}',1)[-1]==key),'')
            self.assertAlmostEqual(float(field(nodes[0],'WallThickness')),7.112,places=6)
            self.assertEqual(field(nodes[0],'PipingClassRating'),'900')
            self.assertEqual(field(nodes[0],'MaterialCode'),'741')
            with TemporaryDirectory() as folder:
                cii=Path(folder)/'bm2-first-element-fields.cii'
                isolated=Path(folder)/'bm2-first-element-fields.xml'
                # Full real BM2 contains multi-restraint nodes which raw
                # xml_to_cii2019.py rejects. This is intentionally ONLY a
                # native field-serialization witness for actual source nodes
                # 10->20; it is NOT a successful full-BM2 production Run.
                projected=ET.Element(root.tag,root.attrib)
                original_pipe=next(n for n in root if n.tag.rsplit('}',1)[-1]=='Pipe')
                pipe=ET.SubElement(projected,original_pipe.tag)
                first_copy=ET.fromstring(ET.tostring(first,encoding='utf-8'))
                seen=0
                for child in list(first_copy):
                    if child.tag.rsplit('}',1)[-1]!='Node':
                        continue
                    seen+=1
                    if seen>2:
                        first_copy.remove(child)
                    else:
                        for annotation in list(child):
                            if annotation.tag.rsplit('}',1)[-1]=='Restraint':
                                child.remove(annotation)
                self.assertEqual(seen,len(nodes))
                pipe.append(first_copy)
                ET.ElementTree(projected).write(isolated,encoding='utf-8',xml_declaration=True)
                # Invoke the production patched elements writer, not the
                # legacy bare converter which intentionally emits only T1.
                run=subprocess.run([sys.executable,str(SCRIPTS/'xml_to_cii2019_patched.py'),
                                    '--input',str(isolated),'--output',str(cii)],
                                   capture_output=True,text=True,timeout=60)
                self.assertEqual(run.returncode,0,run.stderr)
                data=cii.read_text(encoding='utf-8')
                elements=data.split('#'+'$ ELEMENTS\n',1)[1].split('#'+'$ ',1)[0].splitlines()
                self.assertEqual(len(elements)%15,0)
                target=next((i for i in range(len(elements)//15)
                             if '/GLRD-1000-6"-P4110001-93833-01/B6' in elements[i*15+10]
                             and tuple(int(float(x)) for x in elements[i*15].split()[:2])==(10,20)),None)
                self.assertIsNotNone(target,'actual BM2 native 10->20 element absent')
                block=elements[target*15:(target+1)*15]
                self.assertAlmostEqual(float(block[1].split()[0]),7.112,places=5)
                self.assertEqual(float(block[1].split()[3]),120)
                self.assertEqual(float(block[1].split()[5]),-50)
                self.assertEqual(float(block[3].split()[0]),11000)
                # Patched CII default explicitly converts the supplied
                # kg/m3 to kg/cm3; bare legacy converter writes raw density.
                self.assertAlmostEqual(float(block[5].split()[1]),
                                       float(cell('M9')) * 1e-6,places=10)
                material=data.split('#'+'$ MISCEL_1\n',1)[1].split('#'+'$ ',1)[0].splitlines()
                selected=float(material[target//6].split()[target%6])
                self.assertEqual(selected,741)  # synthetic approved pin only
        finally:
            if enriched!=xml:enriched.unlink(missing_ok=True)


if __name__ == '__main__':
    unittest.main()
