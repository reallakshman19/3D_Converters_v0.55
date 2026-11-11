"""Source-bound staged position ownership regression. Synthetic data only.

Checks that non-restraint ambiguity cannot veto independently corroborated
support and that mandatory support ambiguity is still a native release hold.
"""
from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "converters" / "scripts"))
from xml_to_cii2019_master_addon import enrich_xml_addons
from xml_to_cii2019_patched import _maybe_enrich_from_staged_json

XML = (
    "<PipeStressExport><Pipe><Branch><Branchname>/TEST/B1</Branchname>"
    "<Node><NodeNumber>10</NodeNumber><NodeName>PS00001</NodeName>"
    "<Position>1 2 3</Position></Node>"
    "<Node><NodeNumber>20</NodeNumber><NodeName>PS00002</NodeName>"
    "<Position>1 2 3</Position></Node>"
    "</Branch></Pipe></PipeStressExport>"
)


def staged(kind="EQUIPMENT", additional=False):
    components = [
        {"type": kind, "name": "unrelated", "attributes": {
            "POSI": "1 2 3", "DTXR": "CONTEXT ONLY"}},
        {"type": "SUPPORT", "name": "/PS00001", "attributes": {
            "POSI": "1 2 3", "NAME": "/PS00001", "DTXR": "GUIDE"}},
    ]
    if additional:
        components.append({"type": "SUPPORT", "name": "unowned", "attributes": {
            "POSI": "1 2 3", "DTXR": "LINE STOP"}})
    return json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
                        "children": components}])


class ScopedAmbiguityTests(unittest.TestCase):
    def execute(self, payload, xml_text=XML):
        with tempfile.TemporaryDirectory() as directory:
            original = Path(directory) / "test.xml"
            source_json = Path(directory) / "test.json"
            original.write_text(xml_text, encoding="utf8")
            source_json.write_text(payload, encoding="utf8")
            model = enrich_xml_addons(original, None, None, payload, {"enabled": False})
            log = io.StringIO()
            output = None
            error = None
            try:
                with contextlib.redirect_stdout(log):
                    path = _maybe_enrich_from_staged_json(
                        original, source_json, {"dtxrPositionOffset": {"enabled": False}})
                output = path.read_text(encoding="utf8")
            except ValueError as exc:
                error = str(exc)
            return model, log.getvalue(), output, error

    def test_public_bm2_distinct_component_positions_are_not_owners_by_proximity(self):
        """Real BM2 node pairs, synthetic member at one real position.

        The 200 mm search envelope deliberately admits two distinct physical
        components; only a uniquely precision-qualified source position can
        claim an owner. The original source is not a stand-in for the Owner's
        private finalized XML, and these gaps are synthetic.
        """
        from copy import deepcopy
        source = ROOT / "Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml"
        tree = ET.parse(source)
        nodes = []
        for branch in tree.getroot().iter():
            if branch.tag.rsplit("}", 1)[-1] != "Branch":
                continue
            name = next((c.text or "" for c in branch
                         if c.tag.rsplit("}", 1)[-1] == "Branchname"), "")
            for node in branch:
                if node.tag.rsplit("}", 1)[-1] == "Node":
                    nodes.append((name, node))
        self.assertEqual(len(nodes), 1196)
        distinct_pairs = ((699, 700), (786, 787), (110, 111),
                          (324, 325), (537, 538), (219, 220))
        def val(node, key):
            return next((c.text or "" for c in node
                         if c.tag.rsplit("}", 1)[-1] == key), "")
        for first, second in distinct_pairs:
            with self.subTest(pair=(first, second)):
                branch_name, first_node = nodes[first]
                second_branch, second_node = nodes[second]
                self.assertEqual(branch_name, second_branch)
                self.assertNotEqual(val(first_node, "Position"),
                                    val(second_node, "Position"))
                root = ET.Element("PipeStressExport")
                pipe = ET.SubElement(root, "Pipe")
                branch = ET.SubElement(pipe, "Branch")
                ET.SubElement(branch, "Branchname").text = branch_name
                branch.append(deepcopy(first_node))
                branch.append(deepcopy(second_node))
                xml = ET.tostring(root, encoding="unicode")
                payload = json.dumps([{"type": "BRANCH", "name": branch_name,
                    "children": [{"type": "SUPPORT", "name": "source-position-only",
                        "attributes": {"POSI": val(first_node, "Position"),
                                       "DTXR": "GUIDE",
                                       "CMPSUPGAP": "0mm"}}]}])
                with tempfile.TemporaryDirectory() as tmp:
                    original = Path(tmp) / "test.xml"
                    original.write_text(xml, encoding="utf-8")
                    model = enrich_xml_addons(original, None, None, payload,
                                               {"enabled": False, "tolerance": 200})
                self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 0)
                target = ET.fromstring(model["xmlText"])
                original_nodes = [n for n in target.iter()
                                  if n.tag.rsplit("}", 1)[-1] == "Node"]
                self.assertEqual(val(original_nodes[0], "DTXR_POS"),
                                 "GUIDE(CMPSUPGAP=0mm)")
                self.assertEqual(val(original_nodes[1], "DTXR_POS"), "")

    def test_broad_tolerance_does_not_choose_nearly_coincident_component(self):
        # Two nodes inside the native 0.5 mm precision guard must remain
        # ambiguous even when one is numerically closer.
        xml = XML.replace("<Position>1 2 3</Position></Node>",
                          "<Position>1 2 3</Position></Node>", 1)
        xml = xml.replace("<NodeNumber>20</NodeNumber><NodeName>PS00002</NodeName>"
                          "<Position>1 2 3</Position>",
                          "<NodeNumber>20</NodeNumber><NodeName>PS00002</NodeName>"
                          "<Position>1.8 2 3</Position>")
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "no-PS",
                "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE"}}]}])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "test.xml"
            path.write_text(xml, encoding="utf-8")
            model = enrich_xml_addons(path, None, None, payload,
                                       {"enabled": False, "tolerance": 2})
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)
        self.assertEqual(model["stats"]["dtxrPos"], 0)

    def test_two_distinct_members_one_pos_owner_survive_pipe_and_native_specs(self):
        from xml_to_cii2019_patched import _build_keyword_restraint_specs
        # No staged component reference or PS tie-break: precise position
        # must distinguish the owner from a separate nearby component,
        # and both authored restraints must remain on that one owner.
        xml = XML.replace("<NodeName>PS00002</NodeName><Position>1 2 3</Position>",
                          "<NodeName>PS00002</NodeName><Position>1 2 6</Position>")
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [
                {"type": "SUPPORT", "name": "one-REST",
                 "attributes": {"POSI": "1 2 3", "DTXR": "REST",
                                "CMPSUPGAP": "0mm"}},
                {"type": "SUPPORT", "name": "one-GUIDE",
                 "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                                "CMPSUPGAP": "5mm"}}]}])
        cfg = {"dtxrPositionOffset": {"enabled": False, "tolerance": 6}}
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.xml"
            staged_path = Path(tmp) / "source.json"
            source.write_text(xml, encoding="utf-8")
            staged_path.write_text(payload, encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                enriched = _maybe_enrich_from_staged_json(source, staged_path, cfg)
            root = ET.parse(enriched).getroot()
            nodes = [n for n in root.iter() if n.tag.endswith("Node")]
            text = lambda n, key: next((c.text or "" for c in n
                                         if c.tag.endswith(key)), "")
            self.assertEqual(text(nodes[0], "DTXR_POS"),
                             "REST(CMPSUPGAP=0mm)|GUIDE(CMPSUPGAP=5mm)")
            self.assertEqual(text(nodes[1], "DTXR_POS"), "")
            self.assertEqual(len(cfg["_stagedPositionMemberRows"][("/TEST/B1", "10")]), 2)
            specs, _ = _build_keyword_restraint_specs(enriched, {})
            self.assertEqual({int(x.type_code) for x in specs[10]}, {14, 8})
            self.assertEqual({int(x.type_code): x.gap for x in specs[10]},
                             {14: 0, 8: 5})

    def test_original_authored_restraint_uniquely_corrobates_coincident_owner(self):
        # Original-authored GUI at node 20, not a prefinal-generated
        # proximity assignment or a synthetic coincident-node preference.
        xml = XML.replace("<Position>1 2 3</Position></Node>",
                          "<Position>1 2 3</Position></Node>", 1)
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "no-PS",
                "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                               "CMPSUPGAP": "5mm"}}]}])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "original.xml"
            path.write_text(xml, encoding="utf-8")
            proof = {(0, 0): (), (0, 1): (("GUI", "5"),)}
            model = enrich_xml_addons(path, None, None, payload,
                {"enabled": False}, original_authored_restraints=proof)
            self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 0)
            output = ET.fromstring(model["xmlText"])
            nodes = [n for n in output.iter() if n.tag.endswith("Node")]
            values = [[v.text for v in n if v.tag.endswith("DTXR_POS")]
                      for n in nodes]
            self.assertEqual(values, [[], ["GUIDE(CMPSUPGAP=5mm)"]])
            # Existing transformed/pre-Final data without an original
            # authoring proof cannot break the same positional tie.
            no_proof = enrich_xml_addons(path, None, None, payload,
                                         {"enabled": False})
            self.assertEqual(no_proof["stats"]["dtxrPosMandatoryAmbiguous"], 1)
            for attestation in (
                {(0, 0): (("GUI", "5"),), (0, 1): (("GUI", "5"),)},
                {(0, 0): (), (0, 1): (("GUI", "7"),)},
                {(0, 0): (), (0, 1): (("+Y", "5"),)},
            ):
                with self.subTest(attestation=attestation):
                    conflict = enrich_xml_addons(path, None, None, payload,
                        {"enabled": False},
                        original_authored_restraints=attestation)
                    self.assertEqual(conflict["stats"]["dtxrPosMandatoryAmbiguous"], 1)

    def test_original_authored_restraint_can_preserve_two_independent_members(self):
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [
                {"type": "SUPPORT", "name": "REST member",
                 "attributes": {"POSI": "1 2 3", "DTXR": "REST",
                                "CMPSUPGAP": "0mm"}},
                {"type": "SUPPORT", "name": "GUIDE member",
                 "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                                "CMPSUPGAP": "5mm"}}]}])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "original.xml"
            path.write_text(XML, encoding="utf-8")
            proof = {(0, 0): (), (0, 1): (("+Y", "0"), ("GUI", "5"))}
            out = enrich_xml_addons(path, None, None, payload,
                     {"enabled": False}, original_authored_restraints=proof)
        self.assertEqual(out["stats"]["dtxrPosMandatoryAmbiguous"], 0)
        nodes = [n for n in ET.fromstring(out["xmlText"]).iter()
                 if n.tag.endswith("Node")]
        self.assertEqual([v.text for v in nodes[1]
                          if v.tag.endswith("DTXR_POS")],
                         ["REST(CMPSUPGAP=0mm)|GUIDE(CMPSUPGAP=5mm)"])
        self.assertFalse(any(v.tag.endswith("DTXR_POS") for v in nodes[0]))

    def test_original_xml_authored_proof_comes_from_custodied_original_only(self):
        import hashlib
        from xml229_native_final_mass_binding import stage_native_original_lineage
        xml = ('<PipeStressExport><Pipe><Branch><Branchname>BR-1</Branchname>'
               '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
               '<Position>0 0 0</Position></Node>'
               '<Node><NodeNumber>20</NodeNumber><NodeName>WGT</NodeName>'
               '<ComponentType>RIGID</ComponentType>'
               '<ComponentRefNo>REF-1</ComponentRefNo><Endpoint>2</Endpoint>'
               '<Rigid>2</Rigid><Position>5 0 0</Position>'
               '<Restraint><Type>GUI</Type><Gap>5</Gap></Restraint></Node>'
               '</Branch></Pipe></PipeStressExport>')
        oid = json.dumps(["SOURCE", 0, 1,
                          json.dumps(["RIGID", "REF-1", "2", "WGT"],
                                     separators=(",", ":"))],
                         separators=(",", ":"))
        packet = {"schema": "XML229.NativeFinalPhysicalPacket.v1",
                  "sourceId": "SOURCE", "basisId": "a" * 64,
                  "finalIntentSha256": "b" * 64,
                  "sourceXmlSha256": hashlib.sha256(xml.encode()).hexdigest(),
                  "physicalCount": 1,
                  "components": [{"occurrenceId": oid, "effectiveKg": 12.5}]}
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.xml"
            packet_file = Path(tmp) / "packet.json"
            source.write_text(xml, encoding="utf-8")
            packet_file.write_text(json.dumps(packet), encoding="utf-8")
            original_proof = {}
            stage_native_original_lineage(source, packet_file,
                authored_restraints_out=original_proof)
        self.assertEqual(original_proof, {(0, 0): (),
                                          (0, 1): (("GUI", "5"),)})

    def test_explicit_source_carrier_ref_resolves_exactly_one_xml_component(self):
        # A source support REF is not its carrier. COMPRE must reference one
        # independently present route component in the same staged branch.
        xml = (XML.replace("<NodeNumber>10</NodeNumber>",
                           "<NodeNumber>10</NodeNumber><ComponentRefNo>=42/100</ComponentRefNo>")
                  .replace("<NodeNumber>20</NodeNumber>",
                           "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>"))
        carrier = {"type": "ELBO", "name": "the genuine carrier",
                   "attributes": {"REF": "=42/200"}}
        support = {"type": "SUPPORT", "name": "independent authored support",
                   "attributes": {"REF": "=99/999", "POSI": "1 2 3",
                                  "COMPRE": "=42/200", "DTXR": "GUIDE",
                                  "CMPSUPGAP": "5mm"}}
        def staged(*components):
            return json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
                                "children": list(components)}])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "source.xml"
            path.write_text(xml, encoding="utf-8")
            def evaluate(data):
                return enrich_xml_addons(path, None, None, data,
                                          {"enabled": False})
            success = evaluate(staged(carrier, support))
            self.assertEqual(success["stats"]["dtxrPosMandatoryAmbiguous"], 0)
            nodes = [n for n in ET.fromstring(success["xmlText"]).iter()
                     if n.tag.endswith("Node")]
            def annotations(n):
                return [c.text for c in n if c.tag.endswith("DTXR_POS")]
            self.assertEqual([annotations(n) for n in nodes],
                             [[], ["GUIDE(CMPSUPGAP=5mm)"]])
            # An independently SHA-custodied original-authored restraint on
            # a different node contradicts the carrier evidence: HOLD.
            contrary = enrich_xml_addons(path, None, None,
                staged(carrier, support), {"enabled": False},
                original_authored_restraints={
                    (0, 0): (("GUI", "5"),), (0, 1): ()})
            self.assertEqual(
                contrary["stats"]["dtxrPosMandatoryAmbiguous"], 1)
            # The same explicit carrier reference works for two different
            # independently authored restraint members: many-to-one, pipe
            # delimiter retained and zero never replaced by a default.
            rest = {"type": "SUPPORT", "name": "REST member",
                    "attributes": {"POSI": "1 2 3", "COMPRE": "=42/200",
                                   "DTXR": "REST", "CMPSUPGAP": "0mm"}}
            multi = evaluate(staged(carrier, rest, support))
            self.assertEqual(multi["stats"]["dtxrPosMandatoryAmbiguous"], 0)
            owners = [n for n in ET.fromstring(multi["xmlText"]).iter()
                      if n.tag.endswith("Node")]
            self.assertEqual(annotations(owners[1]),
                ["REST(CMPSUPGAP=0mm)|GUIDE(CMPSUPGAP=5mm)"])
            self.assertEqual(annotations(owners[0]), [])
            variants = (
                # Missing source route inventory: a dangling COMPRE is not
                # authority to attach to a nearby XML component.
                staged(support),
                # Duplicated source carrier REF in one branch is ambiguous.
                staged(carrier, carrier, support),
                # Conflicting declared attachment aliases never choose one.
                staged(carrier, {**support, "attributes": {
                    **support["attributes"], "ATTACHED_COMPONENT_REF": "=42/100"}}),
                # A self support REF alone is not its carrier.
                staged(carrier, {**support, "attributes": {
                    "REF": "=42/200", "POSI": "1 2 3",
                    "DTXR": "GUIDE", "CMPSUPGAP": "5mm"}}),
                # Declared COMPRE for missing carrier fails closed.
                staged(carrier, {**support, "attributes": {
                    **support["attributes"], "COMPRE": "=42/999"}}),
                # Explicit original XML identity disagreeing with producer
                # carrier identity is not silently overridden.
                staged(carrier, {**support, "attributes": {
                    **support["attributes"], "XML_COMPONENT_REF_NO": "=42/100"}}),
                # Unsupported arbitrary generic REF must never be authority.
                staged(carrier, {**support, "attributes": {
                    "REF": "=42/200", "POSI": "1 2 3", "DTXR": "GUIDE"}}),
            )
            for index, variant in enumerate(variants):
                with self.subTest(variant=index):
                    refused = evaluate(variant)
                    self.assertEqual(refused["stats"]["dtxrPosMandatoryAmbiguous"], 1)

    def test_authentic_managed_stage_compre_points_to_independent_route_ref(self):
        # Real saved managed-stage hierarchy: PS00369.1's COMPRE points
        # to a producer-owned ELBO component, not to the support's REF.
        from xml_to_cii2019_master_addon import build_dtxr_pos_entries
        source = (ROOT / "Benchmarks/Managejson to Input XML/B7410250/"
                  "Auto_supportsplit_managed_stage.json")
        entries = build_dtxr_pos_entries(source.read_text(encoding="utf-8"),
                                         {"enabled": False})
        owners = [e for e in entries
                  if e.get("sourceCarrierRefNo") == "=67133182/8396"
                  and e.get("sourceAttrs", {}).get("NAME") == "/PS00369.1"]
        self.assertEqual(len(owners), 1)
        owner = owners[0]
        self.assertTrue(owner["sourceCarrierRefDeclared"])
        self.assertTrue(owner["sourceCarrierRouteUnique"])
        self.assertEqual(owner["branchName"],
            '/ZGPS-1A1AA-30"-B7410250-11445-01/B2')
        self.assertEqual(owner["sourceComponentRefNo"], "")

    def test_carrier_route_edge_without_xml_node_ref_keeps_unique_ps_owner(self):
        # Reproduces V4 audit: carrierRefDeclared/RouteVerified true,
        # carrierCandidateCount 0, PS corroboration exactly one, two
        # coincident XML position candidates. V4 incorrectly vetoed PS.
        xml = (XML.replace("<NodeNumber>10</NodeNumber>",
                           "<NodeNumber>10</NodeNumber><ComponentRefNo>=42/100</ComponentRefNo>")
                  .replace("<NodeNumber>20</NodeNumber>",
                           "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>"))
        route = {"type":"PIPE","name":"remote producer carrier",
                 "attributes":{"REF":"=42/900"}}
        def support(name="/PS00002", **extras):
            return {"type":"SUPPORT","name":name,
                    "attributes":{"POSI":"1 2 3","NAME":name,"DTXR":"GUIDE",
                                  "CMPSUPGAP":"5mm","COMPRE":"=42/900",**extras}}
        def payload(*members):
            return json.dumps([{"type":"BRANCH","name":"/TEST/B1",
                                "children":list(members)}])
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "source.xml"
            file.write_text(xml,encoding="utf-8")
            def model(*members, original_proof=None):
                return enrich_xml_addons(
                    file,None,None,payload(*members),{"enabled":False},
                    original_authored_restraints=original_proof)
            result = model(route,support())
            self.assertEqual(result["stats"]["dtxrPosMandatoryAmbiguous"],0)
            nodes = [x for x in ET.fromstring(result["xmlText"]).iter()
                     if x.tag.endswith("Node")]
            texts = [[c.text for c in n if c.tag.endswith("DTXR_POS")] for n in nodes]
            self.assertEqual(texts,[[],["GUIDE(CMPSUPGAP=5mm)"]])
            # Independently attested ORIGINAL source type+gap can select
            # a node even when carrier ref names only a remote route edge.
            no_ps = model(route,support(name="no-PS"),
                          original_proof={(0,0):(),(0,1):(("GUI","5"),)})
            self.assertEqual(no_ps["stats"]["dtxrPosMandatoryAmbiguous"],0)
            # Contradictory independent unique PS and original XML author
            # must not select either XML owner.
            conflict = model(route,support(),
                             original_proof={(0,0):(("GUI","5"),),(0,1):()})
            self.assertEqual(conflict["stats"]["dtxrPosMandatoryAmbiguous"],1)
            # No PS / original source corroboration: still HELD.
            unknown = model(route,support(name="no-PS"))
            self.assertEqual(unknown["stats"]["dtxrPosMandatoryAmbiguous"],1)
            # An explicit carrier declaration with NO route identity stays
            # untrusted even if one XML PS tag matches.
            missing_route = model(support())
            self.assertEqual(missing_route["stats"]["dtxrPosMandatoryAmbiguous"],1)
            # A duplicate producer route REF likewise remains a HOLD.
            duplicate_route = model(route,route,support())
            self.assertEqual(duplicate_route["stats"]["dtxrPosMandatoryAmbiguous"],1)

    def test_carrier_route_edge_preserves_two_members_on_one_verified_ps_node(self):
        carrier = {"type":"ELBO","name":"route","attributes":{"REF":"=42/900"}}
        supports = [
            {"type":"SUPPORT","name":"/PS00002","attributes":{
                "POSI":"1 2 3","NAME":"/PS00002","COMPRE":"=42/900",
                "DTXR":kind,"CMPSUPGAP":gap}}
            for kind,gap in (("REST","0mm"),("GUIDE","5mm"))]
        payload = json.dumps([{"type":"BRANCH","name":"/TEST/B1",
                               "children":[carrier,*supports]}])
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"original.xml"
            path.write_text(XML,encoding="utf-8")
            result=enrich_xml_addons(path,None,None,payload,{"enabled":False})
        self.assertEqual(result["stats"]["dtxrPosMandatoryAmbiguous"],0)
        nodes=[n for n in ET.fromstring(result["xmlText"]).iter()
               if n.tag.endswith("Node")]
        self.assertEqual([c.text for c in nodes[1]
                          if c.tag.endswith("DTXR_POS")],
                         ["REST(CMPSUPGAP=0mm)|GUIDE(CMPSUPGAP=5mm)"])

    def test_unique_route_ref_but_duplicate_xml_component_nodes_is_hold(self):
        xml = (XML.replace("<NodeNumber>10</NodeNumber>",
                           "<NodeNumber>10</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>")
                  .replace("<NodeNumber>20</NodeNumber>",
                           "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>"))
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [
                {"type": "PIPE", "name": "route", "attributes": {"REF": "=42/200"}},
                {"type": "SUPPORT", "name": "support",
                 "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                                "COMPRE": "=42/200", "CMPSUPGAP": "5mm"}}
            ]}])
        model, log, output, error = self.execute(payload, xml)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)
        self.assertIsNone(output)

    def test_authentic_bm2_coincident_source_nodes_require_exact_reference(self):
        # Public BM2 first branch has two coincident, distinct source nodes:
        # 10 (BRAN) and 40 (ATTA). JSON member is synthetic and deliberately
        # PS-untagged; no claim of Owner staged source or Final approval.
        from xml_to_cii2019_master_addon import enrich_xml_addons
        source = ROOT / "Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml"
        payload = json.dumps([{"type": "BRANCH",
            "name": '/GLRD-1000-6"-P4110001-93833-01/B6',
            "children": [{"type": "SUPPORT", "name": "untagged",
                "attributes": {"POSI": "111348.12 107974.90 100916.75",
                               "DTXR": "GUIDE", "COMPONENTREFNO": "=134234934/30502"}}]}])
        model = enrich_xml_addons(source, None, None, payload, {"enabled": False})
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 0)
        root = ET.fromstring(model["xmlText"])
        branch = next(b for b in root.iter() if b.tag.endswith("Branch"))
        nodes = {next((c.text for c in n if c.tag.endswith("NodeNumber")), ""): n
                 for n in branch if n.tag.endswith("Node")}
        def positioned(node):
            return [c.text for c in node if c.tag.endswith("DTXR_POS")]
        self.assertEqual(positioned(nodes["10"]), [])
        self.assertEqual(positioned(nodes["40"]), ["GUIDE"])

    def test_exact_xml_component_ref_resolves_coincident_untagged_support(self):
        from xml_to_cii2019_master_addon import enrich_xml_addons
        xml = (XML.replace("<NodeNumber>10</NodeNumber>",
                           "<NodeNumber>10</NodeNumber><ComponentRefNo>=42/100</ComponentRefNo>")
                  .replace("<NodeNumber>20</NodeNumber>",
                           "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>"))
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "untagged GUIDE",
                "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                               "COMPONENTREFNO": "=42/200"}}]}])
        model, logs, output, error = self.execute(payload, xml)
        self.assertIsNone(error)
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 0)
        root = ET.fromstring(output)
        nodes = [n for n in root.iter() if n.tag.endswith("Node")]
        values = [[c.text for c in n if c.tag.endswith("DTXR_POS")] for n in nodes]
        self.assertEqual(values, [[], ["GUIDE"]])

    def test_xml_ref_mismatch_fails_closed_without_positional_fallback(self):
        xml = (XML.replace("<NodeNumber>10</NodeNumber>",
                           "<NodeNumber>10</NodeNumber><ComponentRefNo>=42/100</ComponentRefNo>")
                  .replace("<NodeNumber>20</NodeNumber>",
                           "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>"))
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "untagged GUIDE",
                "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                               "XML_COMPONENT_REF_NO": "=42/999"}}]}])
        model, logs, output, error = self.execute(payload, xml)
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)

    def test_repeated_component_ref_not_assumed_unique(self):
        xml = XML.replace("<NodeNumber>10</NodeNumber>",
                          "<NodeNumber>10</NodeNumber><ComponentRefNo>=42/100</ComponentRefNo>")
        xml = xml.replace("<NodeNumber>20</NodeNumber>",
                          "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/100</ComponentRefNo>")
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "untagged GUIDE",
                "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                               "COMPONENTREFNO": "=42/100"}}]}])
        model, logs, output, error = self.execute(payload, xml)
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)

    def test_disagreeing_ref_and_unique_ps_tag_fail_closed(self):
        xml = (XML.replace("<NodeNumber>10</NodeNumber>",
                           "<NodeNumber>10</NodeNumber><ComponentRefNo>=42/100</ComponentRefNo>")
                  .replace("<NodeNumber>20</NodeNumber>",
                           "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>"))
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "/PS00001",
                "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                               "COMPONENTREFNO": "=42/200"}}]}])
        model, logs, output, error = self.execute(payload, xml)
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)

    def test_generic_ref_is_not_xml_component_identity(self):
        xml = (XML.replace("<NodeNumber>10</NodeNumber>",
                           "<NodeNumber>10</NodeNumber><ComponentRefNo>=42/100</ComponentRefNo>")
                  .replace("<NodeNumber>20</NodeNumber>",
                           "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>"))
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "untagged GUIDE",
                "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                               "REF": "=42/200"}}]}])
        model, logs, output, error = self.execute(payload, xml)
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)

    def test_native_ambiguity_proof_distinguishes_geometry_and_records_revision(self):
        xml = XML.replace("<NodeNumber>20</NodeNumber><NodeName>PS00002</NodeName>"
                          "<Position>1 2 3</Position>",
                          "<NodeNumber>20</NodeNumber><NodeName>PS00002</NodeName>"
                          "<Position>3 2 3</Position>")
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "source-midpoint",
                "attributes": {"POSI": "2 2 3", "DTXR": "GUIDE"}}]}])
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "test.xml"
            staged_path = Path(tmp) / "test.json"
            source.write_text(xml, encoding="utf-8")
            staged_path.write_text(payload, encoding="utf-8")
            log = io.StringIO()
            with contextlib.redirect_stdout(log):
                with self.assertRaisesRegex(ValueError, "XML229_STAGED_POSITION_AMBIGUOUS"):
                    _maybe_enrich_from_staged_json(
                        source, staged_path,
                        {"dtxrPositionOffset": {"enabled": False, "tolerance": 3}})
        line = next(line for line in log.getvalue().splitlines()
                    if line.startswith("XML229_STAGED_POSITION_AMBIGUITY "))
        card = json.loads(line.split(" ", 1)[1])
        self.assertEqual(card["matcherRevision"], "XML229_POSITION_CARRIER_PROVENANCE_V6")
        self.assertEqual(card["matchToleranceMm"], 3.0)
        self.assertEqual(card["count"], 1)
        witness = card["sample"][0]
        self.assertEqual(witness["scope"], "MANDATORY")
        self.assertEqual(witness["candidateGeometry"], "DISTINCT")
        self.assertEqual(witness["preciseCandidateCount"], 0)
        self.assertEqual(witness["guardBandCandidateCount"], 2)
        self.assertEqual(witness["matchedTransformCount"], 2)
        self.assertEqual(witness["psCorroboratedCandidateCount"], 0)
        self.assertEqual(witness["explicitXmlRefPresent"], False)
        self.assertEqual(witness["originalSourceProofPresent"], False)
        self.assertEqual(witness["originalSourceRestraintCandidates"], 0)
        self.assertEqual(witness["originalMatchingRestraintCandidates"], 0)
        self.assertFalse(witness["carrierRefDeclared"])
        self.assertFalse(witness["carrierRouteVerified"])
        self.assertEqual(witness["carrierRouteStatus"], "NOT_DECLARED")
        self.assertEqual(witness["carrierCandidateCount"], 0)
        self.assertNotIn("rawPosition", witness)
        self.assertNotIn("sourceBranch", witness)

    def test_native_ambiguity_proof_reports_true_coincidence_without_owner_guess(self):
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "no-ref",
                "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE"}}]}])
        model, log, output, error = self.execute(payload)
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        line = next(line for line in log.splitlines()
                    if line.startswith("XML229_STAGED_POSITION_AMBIGUITY "))
        witness = json.loads(line.split(" ", 1)[1])["sample"][0]
        self.assertEqual(witness["candidateGeometry"], "COINCIDENT")
        self.assertEqual(witness["preciseCandidateCount"], 2)
        self.assertEqual(witness["guardBandCandidateCount"], 2)

    def test_unrelated_nonrestraint_collision_does_not_block_unique_support(self):
        model, logs, output, error = self.execute(staged())
        self.assertIsNone(error)
        self.assertEqual(model["stats"]["dtxrPosAmbiguous"], 1)
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 0)
        self.assertEqual(model["stats"]["dtxrPosExcludedAmbiguous"], 1)
        self.assertEqual(model["stats"]["dtxrPosMandatoryUnmatched"], 0)
        self.assertEqual(model["stats"]["dtxrPos"], 1)
        root = ET.fromstring(output)
        nodes = [n for n in root.iter() if n.tag.endswith("Node")]
        dtxr = lambda n: [c.text for c in n if c.tag.endswith("DTXR_POS")]
        self.assertEqual(dtxr(nodes[0]), ["GUIDE"])
        self.assertEqual(dtxr(nodes[1]), [])
        self.assertIn("XML229_STAGED_SCOPE_EXCLUSIONS", logs)

    def test_ambiguous_in_scope_support_still_fails_closed(self):
        model, logs, output, error = self.execute(staged("SUPPORT"))
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)
        self.assertEqual(model["stats"]["dtxrPosExcludedAmbiguous"], 0)
        marker = next(s for s in logs.splitlines()
                      if s.startswith("XML229_STAGED_POSITION_AMBIGUITY "))
        sample = json.loads(marker.split(" ", 1)[1])
        self.assertEqual(sample["count"], 1)
        self.assertEqual(sample["sample"][0]["scope"], "MANDATORY")
        self.assertEqual(sample["sample"][0]["sourceClaimIndex"], 0)
        self.assertEqual(sample["sample"][0]["candidateCount"], 2)

    def test_mixed_ambiguity_receipt_reports_only_mandatory_claim(self):
        model, logs, output, error = self.execute(staged(additional=True))
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        self.assertEqual(model["stats"]["dtxrPosAmbiguous"], 2)
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)
        self.assertEqual(model["stats"]["dtxrPosExcludedAmbiguous"], 1)
        marker = next(s for s in logs.splitlines()
                      if s.startswith("XML229_STAGED_POSITION_AMBIGUITY "))
        sample = json.loads(marker.split(" ", 1)[1])
        self.assertEqual([s["sourceClaimIndex"] for s in sample["sample"]], [2])

    def test_bounded_witness_keeps_mandatory_after_21_exclusions(self):
        payload = json.loads(staged())
        original = payload[0]["children"]
        payload[0]["children"] = [original[0] for _ in range(21)] + [
            {"type": "SUPPORT", "name": "unowned", "attributes": {
                "POSI": "1 2 3", "DTXR": "LINE STOP"}}, original[1]]
        model, logs, output, error = self.execute(json.dumps(payload))
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
        self.assertEqual(model["stats"]["dtxrPosAmbiguous"], 22)
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 1)
        marker = next(s for s in logs.splitlines()
                      if s.startswith("XML229_STAGED_POSITION_AMBIGUITY "))
        witness = json.loads(marker.split(" ", 1)[1])
        self.assertEqual(witness["count"], 1)
        self.assertEqual([s["sourceClaimIndex"] for s in witness["sample"]], [21])

    def test_unmatched_mandatory_support_still_fails_partial_transfer(self):
        source = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [{"type": "SUPPORT", "name": "unmatched",
                "attributes": {"POSI": "999 998 997", "DTXR": "GUIDE"}}]}])
        model, logs, output, error = self.execute(source)
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_PARTIAL_TRANSFER")
        self.assertEqual(model["stats"]["dtxrPosMandatoryUnmatched"], 1)


    def test_nested_nonbranch_route_owner_keeps_actual_branch_scope(self):
        # Regression: a named grouping component with children is not BRANCH.
        # Before V6, both nested route and support inherited an invented
        # grouping branch and could not prove their XML /TEST/B1 custody.
        from xml_to_cii2019_master_addon import build_dtxr_pos_entries
        xml = XML.replace(
            "<NodeNumber>20</NodeNumber>",
            "<NodeNumber>20</NodeNumber><ComponentRefNo>=42/200</ComponentRefNo>")
        nested = {"type": "ASSEMBLY", "name": "not a branch",
                  "children": [
                      {"type": "ELBO", "name": "producer route",
                       "attributes": {"REF": "=42/200"}},
                      {"type": "SUPPORT", "name": "unlabelled support",
                       "attributes": {"POSI": "1 2 3",
                                      "DTXR": "GUIDE", "CMPSUPGAP": "5mm",
                                      "COMPRE": "=42/200"}}
                  ]}
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
                               "children": [nested]}])
        entries = build_dtxr_pos_entries(payload, {"enabled": False})
        owner = next(e for e in entries if e["sourceType"] == "SUPPORT")
        self.assertEqual(owner["branchName"], "/TEST/B1")
        self.assertEqual(owner["sourceCarrierRouteStatus"], "VERIFIED")
        self.assertTrue(owner["sourceCarrierRouteUnique"])
        model, logs, output, error = self.execute(payload, xml)
        self.assertIsNone(error)
        self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 0)
        nodes = [n for n in ET.fromstring(output).iter()
                 if n.tag.endswith("Node")]
        values = [[c.text for c in n if c.tag.endswith("DTXR_POS")]
                  for n in nodes]
        self.assertEqual(values, [[], ["GUIDE(CMPSUPGAP=5mm)"]])

    def test_carrier_route_statuses_refuse_unverified_declarations(self):
        # V6 diagnostics differentiate evidence defects without making any
        # of them positive owner authority. Even unique PS does not override
        # an explicit invalid source carrier.
        from xml_to_cii2019_master_addon import build_dtxr_pos_entries
        route = {"type": "ELBO", "name": "route",
                 "attributes": {"REF": "=42/900"}}
        support_attrs = {"POSI": "1 2 3", "DTXR": "GUIDE",
                         "CMPSUPGAP": "5mm", "COMPRE": "=42/900"}
        def stage(attrs, b1_routes=(), b2_routes=()):
            return json.dumps([
                {"type": "BRANCH", "name": "/TEST/B1",
                 "children": [*b1_routes, {"type": "SUPPORT",
                                           "name": "/PS00002",
                                           "attributes": attrs}]},
                {"type": "BRANCH", "name": "/TEST/B2",
                 "children": list(b2_routes)}])
        cases = (
            ("VERIFIED", stage(support_attrs, [route]), False),
            ("ROUTE_REF_NOT_FOUND", stage(support_attrs), True),
            ("ROUTE_REF_DUPLICATED", stage(support_attrs, [route, route]), True),
            ("ROUTE_REF_OTHER_BRANCH", stage(support_attrs, (), [route]), True),
            ("MALFORMED_REFERENCE", stage({**support_attrs,
                                          "COMPRE": "BROKEN"}, [route]), True),
            ("CONFLICTING_DECLARATIONS", stage({
                **support_attrs, "ATTACHED_COMPONENT_REF": "=42/901"},
                [route]), True),
            ("NOT_DECLARED", stage({k: v for k, v in support_attrs.items()
                                    if k != "COMPRE"}, [route]), False),
        )
        for status, payload, blocked in cases:
            with self.subTest(status=status):
                entries = build_dtxr_pos_entries(payload, {"enabled": False})
                support = next(e for e in entries if e["sourceType"] == "SUPPORT")
                self.assertEqual(support["sourceCarrierRouteStatus"], status)
                self.assertEqual(support["sourceCarrierRouteUnique"],
                                 status == "VERIFIED")
                model, logs, output, error = self.execute(payload)
                if blocked:
                    self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")
                    self.assertIsNone(output)
                    line = next(l for l in logs.splitlines() if l.startswith(
                        "XML229_STAGED_POSITION_AMBIGUITY "))
                    receipt = json.loads(line.split(" ", 1)[1])
                    self.assertEqual(receipt["matcherRevision"],
                                     "XML229_POSITION_CARRIER_PROVENANCE_V6")
                    self.assertEqual(receipt["sample"][0]["carrierRouteStatus"],
                                     status)
                else:
                    self.assertIsNone(error)
                    self.assertEqual(model["stats"]["dtxrPosMandatoryAmbiguous"], 0)

    def test_typed_nested_branch_resets_carrier_route_scope(self):
        # Actual nested BRANCH changes source custody; the same route REF
        # in a child branch may not qualify a parent branch's support.
        from xml_to_cii2019_master_addon import build_dtxr_pos_entries
        payload = json.dumps([{"type": "BRANCH", "name": "/TEST/B1",
            "children": [
                {"type": "BRANCH", "name": "/TEST/B2",
                 "children": [{"type": "ELBO", "name": "other branch route",
                               "attributes": {"REF": "=42/900"}}]},
                {"type": "SUPPORT", "name": "/PS00002",
                 "attributes": {"POSI": "1 2 3", "DTXR": "GUIDE",
                                "CMPSUPGAP": "5mm", "COMPRE": "=42/900"}}
            ]}])
        source = next(e for e in build_dtxr_pos_entries(
            payload, {"enabled": False}) if e["sourceType"] == "SUPPORT")
        self.assertEqual(source["branchName"], "/TEST/B1")
        self.assertEqual(source["sourceCarrierRouteStatus"],
                         "ROUTE_REF_OTHER_BRANCH")
        model, logs, output, error = self.execute(payload)
        self.assertIsNone(output)
        self.assertEqual(error, "XML229_STAGED_POSITION_AMBIGUOUS")



if __name__ == "__main__":
    unittest.main()
