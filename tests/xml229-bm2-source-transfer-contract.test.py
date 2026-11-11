#!/usr/bin/env python3
"""Source-bound BM2 transfer regressions; no private Owner authority is asserted."""
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile
import json
import subprocess
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "converters" / "scripts"
sys.path.insert(0, str(SCRIPTS))
import xml_to_cii2019_patched as patched

BM2 = ROOT / "Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml"
MASTER = ROOT / "docs/Masters/SpecwisePipingClass/93833.json"
STAGED_SOURCE = ROOT / "Benchmarks/STF_2026Sep16-0859_managed_stage.zip"


def field(node, name):
    return next((str(c.text or "").strip() for c in node
                 if c.tag.rsplit("}", 1)[-1] == name), "")


def node_by_number(root, number):
    return next(n for n in root.iter()
                if n.tag.rsplit("}", 1)[-1] == "Node"
                and field(n, "NodeNumber") == str(number))


def branch_sample(path, name):
    tree = ET.parse(BM2)
    root = tree.getroot()
    for pipe in list(root):
        for branch in list(pipe):
            if branch.tag.rsplit("}", 1)[-1] == "Branch" and field(branch, "Branchname") != name:
                pipe.remove(branch)
    tree.write(path, encoding="utf-8")


class SourceTransferRegression(unittest.TestCase):
    def test_class_93833_first_element_10_to_20_materializes_7112(self):
        rows = json.loads(MASTER.read_text(encoding="utf-8"))["rows"]
        branch = '/GLRD-1000-6"-P4110001-93833-01/B6'
        with TemporaryDirectory() as directory:
            source = Path(directory) / "first.xml"
            branch_sample(source, branch)
            before = ET.parse(source).getroot()
            self.assertEqual(field(node_by_number(before, 10), "WallThickness"), "0")
            out = patched._apply_process_data_to_xml(source, {
                "pipingClass": {"masterRows": rows}})
            updated = ET.parse(out).getroot()
            self.assertAlmostEqual(float(field(node_by_number(updated, 10), "WallThickness")), 7.112)
            self.assertAlmostEqual(float(field(node_by_number(updated, 20), "WallThickness")), 7.112)
            self.assertAlmostEqual(float(field(node_by_number(updated, 30), "WallThickness")), 7.112)
            self.assertEqual(field(node_by_number(updated, 20), "Weight"),
                             field(node_by_number(before, 20), "Weight"))
            self.assertEqual(field(node_by_number(updated, 20), "Position"),
                             field(node_by_number(before, 20), "Position"))

    def test_actual_native_cli_first_element_publishes_exact_master_wall(self):
        rows = json.loads(MASTER.read_text(encoding='utf-8'))['rows']
        branch = '/GLRD-1000-6"-P4110001-93833-01/B6'
        with TemporaryDirectory() as directory:
            source = Path(directory) / 'first.xml'
            output = Path(directory) / 'first.cii'
            branch_sample(source, branch)
            cmd = [sys.executable, str(SCRIPTS / 'xml_to_cii2019_runtime_custody.py'),
                   '--input', str(source), '--output', str(output),
                   '--support-config-json', json.dumps({'pipingClass': {'masterRows': rows}}),
                   '--weight-scale', '10']
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            text = output.read_text(encoding='utf-8')
            self.assertIn('#$ ELEMENTS', text)
            block = text.split('#$ ELEMENTS\n', 1)[1].splitlines()
            self.assertEqual([float(x) for x in block[0].split()[:2]], [10.0, 20.0])
            self.assertAlmostEqual(float(block[1].split()[0]), 7.112)
            self.assertNotEqual(float(block[1].split()[0]), 0.01)

    def test_conflicting_master_fails_closed(self):
        rows = [r for r in json.loads(MASTER.read_text())["rows"]
                if str(r.get("Size")) == "6"]
        conflicting = {**rows[0], "Wall thickness": "8.0"}
        with self.assertRaisesRegex(ValueError, "XML229_PIPING_CLASS_BORE_AMBIGUOUS"):
            patched._source_class_wall_index(
                {"pipingClass": {"masterRows": rows + [conflicting]}}, {"93833"})

    def test_source_class_bore_handles_raw_nps_and_normalized_dn(self):
        raw = {"Piping Class": "93833", "Size": "6", "Wall thickness": "7.112"}
        normalized = {"pipingClass": "93833", "convertedBore": 150,
                      "wallThicknessMm": "7.112"}
        self.assertEqual(patched._source_class_wall_index(
            {"pipingClass": {"masterRows": [raw]}}), {("93833", 150): 7.112})
        self.assertEqual(patched._source_class_wall_index(
            {"pipingClass": {"masterRows": [normalized]}}), {("93833", 150): 7.112})
        self.assertEqual(patched._source_class_wall_index(
            {"pipingClass": {"masterRows": [raw, normalized]}}),
            {("93833", 150): 7.112})
        with self.assertRaisesRegex(ValueError, "XML229_PIPING_CLASS_BORE_INVALID"):
            patched._source_class_wall_index(
                {"pipingClass": {"masterRows": [{
                    **raw, "convertedBore": 100}]}})

    def test_native_pipe_delimited_supports_keep_independent_slots(self):
        # | separates two source occurrences; a bare ANCHOR|LINESTOP
        # label represents one axial stop, never an additional fixed anchor.
        self.assertEqual(
            patched._kind_from_dtxr("GUIDE|LINESTOP", {}), ["GUIDE", "LINESTOP"])
        self.assertEqual(
            patched._kind_from_dtxr("ANCHOR|LINESTOP", {}), ["LINESTOP"])
        self.assertEqual(
            patched._kind_from_dtxr("LINESTOP|ANCHOR", {}), ["LINESTOP"])
        self.assertEqual([
            (spec.type_code, spec.gap)
            for spec in patched._specs_from_dtxr_text(
                "GUIDE(NAME=/PS1,CMPSUPGAP=4.5)|"
                "LINESTOP(NAME=/PS2,CMPSUPGAP=7.25)", {},
                {"GUIDE": 4.5, "LINESTOP": 7.25})
        ], [(8, 4.5), (9, 7.25)])
        self.assertEqual(
            [spec.type_code for spec in patched._specs_from_dtxr_text(
                "ANCHOR|LINESTOP", {})], [9])

    def test_verified_source_gate_and_real_93833_wall_synthetic_material_pin(self):
        # Actual public 93833/DN150=7.112mm; 741 is a TEST-ONLY mapping.
        public = json.loads(MASTER.read_text())["rows"]
        row = next(r for r in public if r.get("_sourceRowIndex") == 10558)
        self.assertEqual((row["convertedBore"], float(row["Wall thickness"])),
                         (150, 7.112))
        line = {"lineSeqNo": "4110001", "p1": "11000", "t1": "120",
                "t2": "40", "t3": "-50", "densityMixed": "109.85"}
        def config():
            return {
                "requireVerifiedMasterCompleteness": True,
                "pipingClass": {"masterRows": [row]},
                "linelist": {"masterRows": [dict(line)],
                             "fieldMap": {k:k for k in line}},
                "material": {"mapRows": [{"Material": "ASTM A790 UNS S31803",
                                          "Code": "741"}]},
            }
        branch = '/GLRD-1000-6"-P4110001-93833-01/B6'
        xml = ('<PipeStressExport><Pipe><Branch><Branchname>'+branch+'</Branchname>'
               '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
               '<OutsideDiameter>168.3</OutsideDiameter><WallThickness>0</WallThickness>'
               '<Position>0 0 0</Position></Node>'
               '<Node><NodeNumber>20</NodeNumber><ComponentType>PIPE</ComponentType>'
               '<OutsideDiameter>168.3</OutsideDiameter><WallThickness>0</WallThickness>'
               '<Position>100 0 0</Position></Node>'
               '</Branch></Pipe></PipeStressExport>')
        with TemporaryDirectory() as work:
            path=Path(work)/"source.xml"
            path.write_text(xml)
            good=config()
            out=patched._apply_process_data_to_xml(path,good)
            tree=ET.parse(out).getroot()
            n=node_by_number(tree,10)
            self.assertAlmostEqual(float(field(n,"WallThickness")),7.112)
            self.assertEqual(field(n,"MaterialCode"),"741")
            self.assertEqual(field(n,"PipingClassRating"),"900")
            self.assertEqual(field(next(tree.iter("Pressure")),"Pressure1"),"11000")
            self.assertEqual(field(next(tree.iter("Temperature")),"Temperature2"),"40")
            optional_rating=config()
            optional_rating["pipingClass"]["masterRows"][0].pop("Rating",None)
            optional_rating["pipingClass"]["masterRows"][0].pop("rating",None)
            result_without_rating=patched._apply_process_data_to_xml(path,optional_rating)
            self.assertEqual(field(node_by_number(ET.parse(result_without_rating).getroot(),10),
                                   "PipingClassRating"),"")
            # Exact real-mapped fields must be complete and consistent; no
            # fallback 0.01 or unapproved code may be promoted as VERIFIED.
            failures=[
                ("p1","", "XML229_VERIFIED_PRESSURE_MISSING"),
                ("t2","", "XML229_VERIFIED_T2_MISSING"),
                ("densityMixed","", "XML229_VERIFIED_DENSITY_MISSING"),
            ]
            for key,bad,error in failures:
                bad_config=config()
                bad_config["linelist"]["masterRows"][0][key]=bad
                with self.assertRaisesRegex(ValueError,error):
                    patched._apply_process_data_to_xml(path,bad_config)
            missing=config()
            missing["pipingClass"]["masterRows"]=[]
            with self.assertRaisesRegex(ValueError,"XML229_VERIFIED_CLASS_DN_WALL_MISSING"):
                patched._apply_process_data_to_xml(path,missing)
            rejected=config()
            rejected["material"]["mapRows"]=[]
            with self.assertRaisesRegex(ValueError,"XML229_VERIFIED_MATERIAL_CODE_UNAPPROVED"):
                patched._apply_process_data_to_xml(path,rejected)
            conflicting=config()
            conflicting["pipingClass"]["masterRows"].append({
                **row,"Wall thickness":"12.7"})
            with self.assertRaisesRegex(ValueError,"XML229_PIPING_CLASS_BORE_AMBIGUOUS"):
                patched._apply_process_data_to_xml(path,conflicting)
            zero=config()
            zero["linelist"]["masterRows"][0].update(p1="0",t2="0",densityMixed="0")
            zero_out=patched._apply_process_data_to_xml(path,zero)
            self.assertEqual(field(next(ET.parse(zero_out).getroot().iter("Pressure")),
                                   "Pressure1"),"0")
            diagnostic=config()
            diagnostic["requireVerifiedMasterCompleteness"]=False
            diagnostic["material"]["mapRows"]=[]
            patched._apply_process_data_to_xml(path,diagnostic)  # nonreleasing

    def test_partial_mandatory_positional_support_transfer_rejects(self):
        branch='/TEST-100-6"-P4110001-93833-01/B1'
        xml=('<PipeStressExport><Pipe><Branch><Branchname>'+branch+'</Branchname>'
             '<Node><NodeNumber>10</NodeNumber><ComponentType>ANCI</ComponentType>'
             '<Position>0 0 0</Position></Node>'
             '<Node><NodeNumber>20</NodeNumber><ComponentType>ANCI</ComponentType>'
             '<Position>100 0 0</Position></Node></Branch></Pipe></PipeStressExport>')
        def entry(kind,name,pos):
            return {"type":kind,"attributes":{
                "NAME":name,"DTXR":"GUIDE","POSI":pos,
                "CMPSUPGAP":"4.5","NODETYPE":"8"}}
        def staged(extra):
            return [{"type":"BRANCH","name":branch,"children":[
                entry("SUPPORT","/PS1","100 0 0"),extra]}]
        with TemporaryDirectory() as folder:
            path=Path(folder)/"source.xml"
            stage=Path(folder)/"stage.json"
            path.write_text(xml)
            cfg={"dtxrPositionOffset":{"enabled":True,"xOffset":0,
                                        "yOffset":0,"zOffset":0,
                                        "tolerance":0.5,"autoCalibrate":False}}
            stage.write_text(json.dumps(staged(entry("SUPPORT","/PS2","200 0 0"))))
            with self.assertRaisesRegex(ValueError,
                                        "XML229_STAGED_POSITION_PARTIAL_TRANSFER"):
                patched._maybe_enrich_from_staged_json(path,stage,dict(cfg))
            # An unrelated positional PIPE annotation is explicitly excluded;
            # it must not suppress the valid SUPPORT transfer.
            stage.write_text(json.dumps(staged(entry("PIPE","/PIPE1","200 0 0"))))
            out=patched._maybe_enrich_from_staged_json(path,stage,dict(cfg))
            self.assertIn("GUIDE",field(node_by_number(ET.parse(out).getroot(),20),"DTXR_POS"))

    def test_authoritative_xml_restraint_conflicts_and_stale_replacement(self):
        branch='/TEST-100-6"-P4110001-93833-01/B1'
        def make_node(rest_type, gap, source="original"):
            n=ET.Element("Node")
            ET.SubElement(n,"NodeNumber").text="20"
            ET.SubElement(n,"DTXR_POS").text="GUIDE"
            r=ET.SubElement(n,"Restraint")
            if source: r.set("source",source)
            ET.SubElement(r,"Type").text=rest_type
            ET.SubElement(r,"Gap").text=gap
            ET.SubElement(r,"Stiffness").text="12345"
            return n
        owner=(branch,"20")
        attrs={"DTXR":"GUIDE","NAME":"/PS1","CMPSUPGAP":"6mm",
               "NODETYPE":"8"}
        def cfg(stamped=False):
            return {"_stagedPositionMemberRows":{owner:[{
                "sourceType":"SUPPORT","sourceAttrs":attrs}]},
                "_originalDtxrStampedOwners":[owner] if stamped else []}
        conflicting_mapper=cfg()
        conflicting_mapper["supportTypeMapper"]={
            "rows":[{"kind":"REST","aliases":["GUIDE"]}]}
        with self.assertRaisesRegex(ValueError,
                                    "NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS"):
            patched._apply_staged_position_restraints(
                make_node("GUI","6",source="generated"),
                "",conflicting_mapper,branch)
        with self.assertRaisesRegex(ValueError,"XML229_SOURCE_XML_RESTRAINT_GAP_CONFLICT"):
            patched._apply_staged_position_restraints(
                make_node("GUI","3"),"",cfg(),branch)
        with self.assertRaisesRegex(ValueError,"XML229_SOURCE_XML_RESTRAINT_TYPE_CONFLICT"):
            patched._apply_staged_position_restraints(
                make_node("+Y","6"),"",cfg(),branch)
        retained=make_node("GUI","6")
        patched._apply_staged_position_restraints(retained,"",cfg(),branch)
        self.assertEqual(field(next(retained.iter("Restraint")),"Stiffness"),"12345")
        generated=make_node("+Y","0",source="generated")
        patched._apply_staged_position_restraints(generated,"",cfg(),branch)
        self.assertEqual(field(next(generated.iter("Restraint")),"Type"),"GUI")
        with self.assertRaisesRegex(ValueError,"XML229_XML_RESTRAINT_PROVENANCE_UNRESOLVED"):
            patched._apply_staged_position_restraints(
                make_node("+Y","0",source=""),"",cfg(),branch)
        unmarked_agrees=make_node("GUI","6",source="")
        patched._apply_staged_position_restraints(
            unmarked_agrees,"",cfg(),branch)
        self.assertEqual(field(next(unmarked_agrees.iter("Restraint")),"Stiffness"),"12345")
        stamped=make_node("+Y","0",source="")
        patched._apply_staged_position_restraints(stamped,"",cfg(True),branch)
        self.assertEqual(field(next(stamped.iter("Restraint")),"Type"),"GUI")

    def test_optional_masters_and_unmatched_saved_regex_do_not_block_xml(self):
        name='/ASIM-1836-4"-P8810049-31441C4-PP/B1'
        xml=('<PipeStressExport><Pipe><Branch><Branchname>'+name+'</Branchname>'
             '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
             '<OutsideDiameter>114.3</OutsideDiameter><WallThickness>6.02</WallThickness>'
             '<Position>0 0 0</Position></Node>'
             '<Node><NodeNumber>20</NodeNumber><ComponentType>PIPE</ComponentType>'
             '<OutsideDiameter>114.3</OutsideDiameter><WallThickness>6.02</WallThickness>'
             '<Position>100 0 0</Position></Node></Branch></Pipe></PipeStressExport>')
        def fmt(lk,pc,joiner=''):
            return {'tokenDelimiter':'-','lineKeyJoiner':joiner,
                    'lineKey':{'extractMode':'TOKEN','tokenPosition':lk},
                    'pipingClass':{'extractMode':'TOKEN','tokenPosition':pc},
                    'rating':{'extractMode':'TOKEN','tokenPosition':''}}
        with TemporaryDirectory() as folder:
            source=Path(folder)/'owner.xml'
            source.write_text(xml)
            for formats in ([],[fmt('',5)],[fmt('4',5),fmt('3',5)],
                            [fmt('4',5),fmt('4',4)]):
                cfg={'regexTester':{'formats':formats}}
                self.assertEqual(patched._line_key_from_branch(name,cfg),'')
                out=patched._apply_process_data_to_xml(source,cfg)
                tree=ET.parse(out).getroot()
                self.assertEqual(field(node_by_number(tree,10),'WallThickness'),'6.02')
            good={'regexTester':{'formats':[fmt('4',5)]}}
            self.assertEqual(patched._line_key_from_branch(name,good),'P8810049')
            split='/ASIM-1836-4"-P-8810049-31441C4-PP/B1'
            pair={'regexTester':{'formats':[fmt('4,5',6)]}}
            self.assertEqual(patched._line_key_from_branch(split,pair),'P8810049')
            pair['regexTester']['formats'][0]['lineKeyJoiner']='-'
            self.assertEqual(patched._line_key_from_branch(split,pair),'P-8810049')
            self.assertEqual(patched._line_key_from_branch(split,{
                'regexTester':{'formats':[fmt('4,5',6),fmt('4,5',6)]}}),
                'P8810049')

    def test_conflicting_optional_piping_class_master_does_not_block_xml(self):
        with TemporaryDirectory() as folder:
            source=Path(folder)/'owner.xml'
            branch_sample(source,'/GLRD-1000-6"-P4110001-93833-01/B6')
            rows=[{'Piping Class':'93833','convertedBore':150,
                   'Wall thickness':wall} for wall in ('7.112','8.0')]
            cfg={'pipingClass':{'masterRows':rows}}
            output=patched._apply_process_data_to_xml(source,cfg)
            self.assertEqual(field(node_by_number(ET.parse(output).getroot(),10),
                                   'WallThickness'),'0')
            cfg['requireVerifiedMasterCompleteness']=True
            with self.assertRaisesRegex(ValueError,'XML229_PIPING_CLASS_BORE_AMBIGUOUS'):
                patched._apply_process_data_to_xml(source,cfg)

    def test_legacy_without_master_keeps_zero_wall_for_existing_writer_fallback(self):
        with TemporaryDirectory() as directory:
            source = Path(directory) / "first.xml"
            branch_sample(source, '/GLRD-1000-6"-P4110001-93833-01/B6')
            out = patched._apply_process_data_to_xml(source, {})
            self.assertEqual(field(node_by_number(ET.parse(out).getroot(), 10), "WallThickness"), "0")

    def test_authentic_archived_ps00574_1_is_rest_not_invented_guide(self):
        # This is the real repository's staged member, not the illustrative
        # GUIDE/LINESTOP payload in the separate Z-offset transfer regression.
        branch = '/GLRD-1000-8"-B4110003-13451-01/B1'
        with ZipFile(STAGED_SOURCE) as archive:
            staged = json.loads(archive.read(
                "STF_2026Sep16-0859_managed_stage.json"))
        authentic = [
            {"type": "BRANCH", "name": row.get("name"), "children": [
                item for item in row.get("children", [])
                if item.get("type") == "SUPPORT" and
                (item.get("attributes") or {}).get("NAME") == "/PS00574.1"]}
            for row in staged if row.get("name") == branch]
        self.assertEqual(sum(len(row["children"]) for row in authentic), 1)
        source_member = authentic[0]["children"][0]["attributes"]
        self.assertEqual(source_member["DTXR"], "REST")
        self.assertEqual(source_member.get("SUPPORT_KIND"), "REST")
        self.assertAlmostEqual(source_member["POS"]["z"], 1330.728)
        with TemporaryDirectory() as directory:
            src = Path(directory) / "bm2-real-rest.xml"
            selected = Path(directory) / "real-staged.json"
            branch_sample(src, branch)
            selected.write_text(json.dumps(authentic), encoding="utf-8")
            cfg = {"dtxrPositionOffset": {
                "enabled": True, "xOffset": 0, "yOffset": 0,
                "zOffset": 100000, "tolerance": 0.5}}
            match = patched._maybe_enrich_from_staged_json(src, selected, cfg)
            final = patched._apply_process_data_to_xml(match, cfg)
            target = node_by_number(ET.parse(final).getroot(), 3430)
            actual = [field(r, "Type") for r in target
                      if r.tag.rsplit("}", 1)[-1] == "Restraint"]
            self.assertEqual(actual, ["+Y"])
            self.assertNotIn("GUI", actual)
            self.assertNotIn("LIM", actual)

    def test_3430_current_saved_mapper_regex_and_mutation_pass_to_native_xml(self):
        # The same position, exact branch and source tag are reused. The only
        # changes are user-authored Tab 7 / Tab 8 configuration and staged text.
        tree = ET.parse(BM2)
        root = tree.getroot()
        node = node_by_number(root, 3430)
        namespace = node.tag.rsplit("}", 1)[0] + "}" if "}" in node.tag else ""
        ET.SubElement(node, namespace + "DTXR_POS").text = "REST"
        with TemporaryDirectory() as directory:
            source = Path(directory) / "node3430.xml"
            stage = Path(directory) / "node3430-stage.json"
            tree.write(source, encoding="utf-8")
            branch = '/GLRD-1000-8"-B4110003-13451-01/B1'
            def run(dtxr, cfg, node_type):
                stage.write_text(json.dumps([{
                    "type": "BRANCH", "name": branch, "children": [{
                        "type": "SUPPORT", "attributes": {
                            "NAME": "/PS00574.1", "DTXR": dtxr,
                            "POSI": "123504.12 114999.98 1330.73",
                            "NODETYPE": node_type, "CMPSUPGAP": "6mm"},
                    }]}]), encoding="utf-8")
                cfg["dtxrPositionOffset"] = {
                    "enabled": True, "xOffset": 0, "yOffset": 0,
                    "zOffset": 100000, "tolerance": 0.5}
                staged_xml = patched._maybe_enrich_from_staged_json(source, stage, cfg)
                final_xml = patched._apply_process_data_to_xml(staged_xml, cfg)
                target = node_by_number(ET.parse(final_xml).getroot(), 3430)
                xml_rows = [(field(r, "Type"), field(r, "Gap")) for r in target
                            if r.tag.rsplit("}", 1)[-1] == "Restraint"]
                # The full authentic BM2 XML contains unrelated adjacent
                # multi-restraint edges not supported by bare xml_to_cii2019.py.
                # Isolate the *actual* owning 3420->3430 edge for independent
                # CII type/gap serialization; never change the numerical writer.
                native_root = ET.parse(final_xml).getroot()
                native_branch = next(b for b in native_root.iter()
                    if b.tag.rsplit("}", 1)[-1] == "Branch"
                    and field(b, "Branchname") == branch)
                minimal = ET.Element(native_root.tag, native_root.attrib)
                original_pipe = next(p for p in native_root.iter()
                    if p.tag.rsplit("}", 1)[-1] == "Pipe")
                isolated_pipe = ET.SubElement(minimal, original_pipe.tag)
                isolated_branch = ET.fromstring(ET.tostring(native_branch))
                for member in list(isolated_branch):
                    if member.tag.rsplit("}", 1)[-1] != "Node":
                        continue
                    if field(member, "NodeNumber") not in ("3420", "3430"):
                        isolated_branch.remove(member)
                    elif field(member, "NodeNumber") == "3420":
                        for child in list(member):
                            if child.tag.rsplit("}", 1)[-1] == "Restraint":
                                member.remove(child)
                isolated_pipe.append(isolated_branch)
                isolated_xml = Path(directory) / "node3430-isolated.xml"
                ET.ElementTree(minimal).write(isolated_xml, encoding="utf-8")
                cii_path = Path(directory) / "node3430-native.cii"
                cmd = [sys.executable, str(SCRIPTS / "xml_to_cii2019.py"),
                       "--input", str(isolated_xml), "--output", str(cii_path)]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
                self.assertEqual(result.returncode, 0, result.stderr)
                cii = cii_path.read_text(encoding="utf-8")
                self.assertIn("#$ RESTRANT", cii)
                lines = cii.split("#$ RESTRANT\n", 1)[1].split("#$", 1)[0].splitlines()
                native_rows = []
                for index in range(0, len(lines) - 3, 4):
                    values = lines[index].split()
                    if values and float(values[0]) == 3430:
                        native_rows.append((int(float(values[1])), float(values[3])))
                return xml_rows, native_rows
            before_tab7, cii_before_tab7 = run("CRADLE RETAINER STYLE-314", {}, "17")
            from_tab7, cii_after_tab7 = run("CRADLE RETAINER STYLE-314",
                            {"supportTypeMapper": {"rows": [
                                {"kind": "REST", "aliases": ["CRADLE RETAINER"]}]}},
                            "17")
            self.assertEqual(from_tab7, [("+Y", "6.0")])
            self.assertIn((14, 6.0), cii_after_tab7)
            self.assertNotEqual(cii_before_tab7, cii_after_tab7)
            self.assertNotEqual(before_tab7, from_tab7,
                                "same source XML + staged JSON must change when REST alias is saved")
            print("XML229_CONFIG_MUTATION_TAB7 " + json.dumps({
                "branch": branch, "node": 3430, "sourceText": "CRADLE RETAINER STYLE-314",
                "before": before_tab7, "after": from_tab7,
                "ciiBefore": cii_before_tab7, "ciiAfter": cii_after_tab7, "status": "PASS"}, sort_keys=True))
            before_tab8, cii_before_tab8 = run("ORBITAL GUARDRAIL QZ-443", {}, "21")
            from_tab8, cii_after_tab8 = run("ORBITAL GUARDRAIL QZ-443", {
                "supportMapping": {"version": 2, "rules": [
                    {"id": "user-orbital-guide", "enabled": True,
                     "priority": 1, "source": "staged-json",
                     "field": "DTXR", "pattern": r"ORBITAL\s+GUARDRAIL",
                     "match": "regex", "kind": "GUIDE"}]},
                "inputXmlRestraintTypeMutation": {"enabled": True,
                    "rows": [{"from": "21", "to": "8"}]},
            }, "21")
            self.assertEqual(from_tab8, [("GUI", "6.0")])
            self.assertIn((8, 6.0), cii_after_tab8)
            self.assertNotEqual(cii_before_tab8, cii_after_tab8)
            self.assertNotEqual(before_tab8, from_tab8,
                                "same source XML + staged JSON must change under saved regex and NODETYPE mutation")
            print("XML229_CONFIG_MUTATION_TAB8 " + json.dumps({
                "branch": branch, "node": 3430, "sourceText": "ORBITAL GUARDRAIL QZ-443",
                "before": before_tab8, "after": from_tab8,
                "ciiBefore": cii_before_tab8, "ciiAfter": cii_after_tab8, "status": "PASS"}, sort_keys=True))
            with self.assertRaisesRegex(ValueError, "NATIVE_PREFINAL_RESTRAINT_TYPE_KIND_CONFLICT"):
                run("ORBITAL GUARDRAIL QZ-443", {
                    "supportMapping": {"version": 2, "rules": [{
                        "id": "user-orbital-guide", "enabled": True,
                        "priority": 1, "source": "staged-json", "field": "DTXR",
                        "pattern": r"ORBITAL\s+GUARDRAIL", "match": "regex",
                        "kind": "GUIDE"}]},
                    "inputXmlRestraintTypeMutation": {"enabled": True,
                        "rows": [{"from": "21", "to": "9"}]},
                }, "21")

    def test_3430_z_datum_existing_rest_does_not_skip_json_enrichment(self):
        # Real XML source position, synthetic GUIDE/LINESTOP and gap only;
        # the Owner's real staged JSON/gap is NOT in the benchmark repository.
        tree = ET.parse(BM2)
        root = tree.getroot()
        node = node_by_number(root, 3430)
        namespace = node.tag.rsplit("}", 1)[0] + "}" if "}" in node.tag else ""
        ET.SubElement(node, namespace + "DTXR_POS").text = "REST"
        prior = ET.SubElement(node, namespace + "Restraint")
        ET.SubElement(prior, namespace + "Type").text = "+Y"
        ET.SubElement(prior, namespace + "Gap").text = "0"
        with TemporaryDirectory() as directory:
            source = Path(directory) / "prior-rest.xml"
            staged = Path(directory) / "staged.json"
            tree.write(source, encoding="utf-8")
            values = [
                {"type": "SUPPORT", "name": "GUIDE", "attributes": {
                    "DTXR": "GUIDE", "POSI": "123504.12 114999.98 1330.73",
                    "CMPSUPGAP": "0mm"}},
                {"type": "SUPPORT", "name": "STOP", "attributes": {
                    "DTXR": "LINE STOP", "POSI": "123504.12 114999.98 1330.73",
                    "CMPSUPGAP": "15mm"}},
            ]
            self.assertTrue(patched._xml_has_dtxr_annotations(source))
            staged.write_text(json.dumps([{
                "type": "BRANCH", "name": '/GLRD-1000-8"-B4110003-13451-01/B1',
                "children": values}]), encoding="utf-8")
            cfg = {"dtxrPositionOffset": {
                "enabled": True, "xOffset": 0, "yOffset": 0,
                "zOffset": 100000, "tolerance": 0.5, "autoCalibrate": False}}
            out = patched._maybe_enrich_from_staged_json(source, staged, cfg)
            enriched = node_by_number(ET.parse(out).getroot(), 3430)
            self.assertIn("GUIDE(CMPSUPGAP=0mm)", field(enriched, "DTXR_POS"))
            self.assertIn("LINE STOP(CMPSUPGAP=15mm)", field(enriched, "DTXR_POS"))
            self.assertTrue(cfg.get("_generatedDtxrEnrichment"))
            self.assertFalse(cfg.get("_inputAlreadyEnriched", False))
            final = patched._apply_process_data_to_xml(out, cfg)
            finished = node_by_number(ET.parse(final).getroot(), 3430)
            restraints = [n for n in finished if n.tag.rsplit("}", 1)[-1] == "Restraint"]
            codes = {field(r, "Type"): float(field(r, "Gap")) for r in restraints}
            self.assertEqual(set(codes), {"GUI", "LIM"})
            self.assertAlmostEqual(codes["LIM"], 15.0)
            self.assertNotIn("+Y", codes)



if __name__ == "__main__":
    unittest.main()
