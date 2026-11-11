"""Source-only BM2 support witness census for the old-state authority comparison.

No interpreted type/axis is asserted here: NODETYPE and abbreviated GT/ST
must be reconciled against semantic evidence before an automatic repair.
"""
from pathlib import Path
from zipfile import ZipFile
import json
import unittest
import sys
import math

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'converters/scripts'))
from xml229_prefinal_restraint_source import source_entries, calibrated_groups, resolve, tolerance, point
from xml229_prefinal_restraints import kinds, source_gap, local, children, field, node_type_mutation, append_profile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
STAGED = ROOT / "Benchmarks/STF_2026Sep16-0859_managed_stage.zip"
MEMBER = "STF_2026Sep16-0859_managed_stage.json"


class Bm2SupportSourceWitness(unittest.TestCase):
    def test_original_gt_st_and_gap_provenance(self):
        with ZipFile(STAGED) as archive:
            source = json.loads(archive.read(MEMBER))
        supports = [(branch.get("name"), child)
                    for branch in source if isinstance(branch, dict)
                    for child in branch.get("children", [])
                    if child.get("type") == "SUPPORT"]
        self.assertEqual(len(supports), 87)
        code_rows = {}
        for branch, component in supports:
            attrs = component.get("attributes") or {}
            code = attrs.get("MDSSUPPTYPE")
            if code in ("GT571", "ST572"):
                self.assertNotIn(code, code_rows, "duplicate unique witness")
                code_rows[code] = {
                    "branch": branch,
                    "name": component.get("name"),
                    "DTXR": attrs.get("DTXR"),
                    "SPRE": attrs.get("SPRE"),
                    "SUPPORT_KIND": attrs.get("SUPPORT_KIND"),
                    "SUPPORT_MAPPER_KIND": attrs.get("SUPPORT_MAPPER_KIND"),
                    "SUPPORT_TYPE": attrs.get("SUPPORT_TYPE"),
                    "MDSSUPPFUNC": attrs.get("MDSSUPPFUNC"),
                    "NODETYPE": attrs.get("NODETYPE"),
                    "NODEGAP": attrs.get("NODEGAP"),
                    "CMPSUPGAP": attrs.get("CMPSUPGAP"),
                }
        self.assertEqual(set(code_rows), {"GT571", "ST572"})
        for row in code_rows.values():
            self.assertEqual(str(row["NODEGAP"]), "0")
            self.assertEqual(str(row["NODETYPE"]), "14")
            self.assertIsNone(row["CMPSUPGAP"])
        print("BM2_GTST_SOURCE_WITNESS " + json.dumps(code_rows, sort_keys=True))


    def test_native_replay_prefers_pinned_rest_over_gt_st_abbreviations(self):
        with ZipFile(STAGED) as archive:
            source = json.loads(archive.read(MEMBER))
        entries = [e for e in source_entries(source, {}, "", None)
                   if e["attrs"].get("MDSSUPPTYPE") in {"GT571", "ST572"}]
        self.assertEqual(len(entries), 2)
        def require(ok, code):
            if not ok:
                raise AssertionError(code)
        resolved = kinds(entries, require)
        self.assertEqual(set(resolved), {"REST"}, resolved)
        self.assertEqual(source_gap(resolved["REST"]), "0")

    def test_native_semantic_line_stop_outranks_low_gt_code(self):
        def require(ok, code):
            if not ok:
                raise AssertionError(code)
        entries = [{"attrs": {"MDSSUPPTYPE": "GT575", "DTXR": "LINE STOP ON BARE PIPE WITH WEAR PAD",
                               "CMPSUPGAP": "10"}, "desc": "LINE STOP ON BARE PIPE WITH WEAR PAD",
                    "type": "SUPPORT"}]
        result = kinds(entries, require)
        self.assertEqual(set(result), {"LINESTOP"}, result)
        self.assertEqual(source_gap(result["LINESTOP"]), "10")

    def test_native_NODEGAP_explicit_zero_and_conflict(self):
        def require(ok, code):
            if not ok:
                raise ValueError(code)
        entry = {"attrs": {"MDSSUPPTYPE": "GT600", "NODEGAP": "0"},
                 "desc": "SUPPORT", "type": "SUPPORT"}
        result = kinds([entry], require)
        self.assertEqual(source_gap(result["GUIDE"]), "0")
        entry["attrs"]["CMPSUPGAP"] = "5"
        # Authored CMPSUPGAP outranks same-member legacy NODEGAP=0 only.
        result = kinds([entry], require)
        self.assertEqual(source_gap(result["GUIDE"]), "5")
        entry["attrs"]["NODEGAP"] = "2"
        with self.assertRaisesRegex(ValueError, "NATIVE_PREFINAL_RESTRAINT_GAP_AMBIGUOUS"):
            kinds([entry], require)


    def test_actual_1885_rest_datum_outranks_colocated_at01_shoe_gap(self):
        """Only the PIPE-REST datum owns REST, even when shoe says 10mm."""
        def require(ok, code):
            if not ok:
                raise ValueError(code)
        datum = {"attrs": {"DTXR": "Pipe Rest XRT01",
                            "MDSSUPPTYPE": "PIPE-REST", "NODEGAP": "0",
                            "NAME": "/PS-12171/DATUM", "NODETYPE": "4"},
                 "desc": "Pipe Rest XRT01", "type": "SUPPORT"}
        shoe = {"attrs": {"DTXR": "PIPE SHOE FOR HORIZ LINES",
                           "MDSSUPPTYPE": "AT01", "NODETYPE": "4",
                           "NAME": "/PS-12171.3",
                           "CMPSUPGAP": "10mm GAP", "NODEGAP": "0"},
                "desc": "PIPE SHOE FOR HORIZ LINES", "type": "SUPPORT"}
        for entries in ([datum, shoe], [shoe, datum]):
            selected = kinds(entries, require)
            self.assertEqual(source_gap(selected["REST"]), "0")
            self.assertEqual(selected["REST"]["NAME"], "/PS-12171/DATUM")
        distinct = [{**datum, "attrs": {**datum["attrs"], "NAME": "/PS-12171/OTHER",
                                         "NODEGAP": "7"}}]
        with self.assertRaisesRegex(ValueError, "NATIVE_PREFINAL_RESTRAINT_GAP_AMBIGUOUS"):
            kinds([datum] + distinct, require)

    def test_tab7_added_alias_is_replayed_by_native_source_owner(self):
        def require(ok, code):
            if not ok:
                raise ValueError(code)
        datum = {"type": "SUPPORT", "desc": "Cradle Retainer Style-314",
                 "attrs": {"DTXR": "Cradle Retainer Style-314",
                           "NODETYPE": "17", "NAME": "/PS-EDITED"}}
        self.assertNotIn("REST", kinds([datum], require, {}))
        cfg = {"supportTypeMapper": {"rows": [
            {"kind": "REST", "aliases": ["Cradle Retainer"]},
            {"kind": "GUIDE", "aliases": ["Guide"]}]}}
        self.assertIn("REST", kinds([datum], require, cfg))

    def test_tab8_custom_regex_and_mutation_replay_from_current_config(self):
        def require(ok, code):
            if not ok:
                raise ValueError(code)
        datum = {"type": "SUPPORT", "desc": "ORBITAL GUARDRAIL QZ-443",
                 "attrs": {"DTXR": "ORBITAL GUARDRAIL QZ-443",
                           "CMPSUPGAP": "5.5", "NODETYPE": "21",
                           "NAME": "/PS-EDITED"}}
        rules = [{"id": "user-orbital-guide", "enabled": True,
                  "priority": 2, "source": "staged-json", "field": "DTXR",
                  "pattern": r"ORBITAL\s+GUARDRAIL\s+QZ-443",
                  "match": "regex", "kind": "GUIDE"}]
        cfg = {"supportMapping": {"version": 2, "rules": rules},
               "inputXmlRestraintTypeMutation": {"enabled": True,
                   "rows": [{"label": "GUI custom", "from": "21", "to": "8"}]}}
        self.assertEqual(set(kinds([datum], require, cfg)), {"GUIDE"})
        self.assertEqual(node_type_mutation(datum["attrs"], cfg), "GUI")
        node = ET.Element("Node")
        ET.SubElement(node, "NodeNumber").text = "40"
        append_profile(node, "GUIDE", datum["attrs"], cfg)
        self.assertEqual(node.findtext("Restraint/Type"), "GUI")
        self.assertEqual(float(node.findtext("Restraint/Gap")), 5.5)
        bad = dict(cfg, inputXmlRestraintTypeMutation={"enabled": True,
                   "rows": [{"from": "21", "to": "9"}]})
        with self.assertRaisesRegex(ValueError, "NATIVE_PREFINAL_RESTRAINT_TYPE_KIND_CONFLICT"):
            append_profile(ET.Element("Node"), "GUIDE", datum["attrs"], bad)

    def test_cross_tab_edited_alias_and_regex_must_agree(self):
        def require(ok, code):
            if not ok:
                raise ValueError(code)
        datum = {"type": "SUPPORT", "desc": "ORBITAL GUARDRAIL",
                 "attrs": {"DTXR": "ORBITAL GUARDRAIL", "NAME": "/PS-EDITED"}}
        cfg = {"supportTypeMapper": {"rows": [
                {"kind": "REST", "aliases": ["ORBITAL GUARDRAIL"]}]},
               "supportMapping": {"rules": [
                {"id": "user-guide", "enabled": True, "priority": 2,
                 "source": "staged-json", "field": "DTXR",
                 "pattern": "ORBITAL GUARDRAIL", "match": "equals",
                 "kind": "GUIDE"}]}}
        with self.assertRaisesRegex(ValueError, "NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS"):
            kinds([datum], require, cfg)

    def test_configured_rule_conflicts_and_invalid_regex_reject(self):
        def require(ok, code):
            if not ok:
                raise ValueError(code)
        datum = {"type": "SUPPORT", "desc": "GUIDE",
                 "attrs": {"DTXR": "GUIDE", "NAME": "/PS-EDITED"}}
        rule = {"id": "user-conflicting-rest", "enabled": True,
                "priority": 1, "field": "DTXR", "pattern": "GUIDE",
                "match": "equals", "kind": "REST"}
        cfg = {"supportMapping": {"version": 2, "rules": [rule]}}
        with self.assertRaisesRegex(ValueError, "NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS"):
            kinds([datum], require, cfg)
        conflict = {"id": "user-guide", "enabled": True, "priority": 1,
                    "field": "DTXR", "pattern": "GUIDE", "match": "equals",
                    "kind": "GUIDE"}
        with self.assertRaisesRegex(ValueError, "NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS"):
            kinds([datum], require, {"supportMapping": {"rules": [rule, conflict]}})
        rule["match"], rule["pattern"] = "regex", "["
        with self.assertRaisesRegex(ValueError, "NATIVE_PREFINAL_RESTRAINT_CONFIG_INVALID"):
            kinds([datum], require, cfg)

    def test_original_bm2_source_gtst_owner_matching_receipt(self):
        """Read-only native resolver receipt; absence/ambiguity is not invented PASS."""
        xml = ROOT / "Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml"
        with ZipFile(STAGED) as archive:
            staged = json.loads(archive.read(MEMBER))
        root = ET.parse(xml).getroot()
        source_nodes = [(field(b, "Branchname"), n) for b in root.iter()
                        if local(b) == "Branch" for n in children(b, "Node")]
        config = {}
        groups = calibrated_groups(source_nodes, source_entries(staged, config), config, field)
        hits = {"GT571": [], "ST572": []}
        errors = []
        def require(ok, code):
            if not ok:
                raise ValueError(code)
        for branch, node in source_nodes:
            if field(node, "ComponentType").upper() not in ("ATTA", "ANCI"):
                continue
            try:
                resolved = resolve(node, branch, groups, tolerance(config), field, require)
            except ValueError as error:
                errors.append({"branch": branch, "number": field(node, "NodeNumber"),
                               "code": str(error)})
                continue
            for entry in resolved:
                code = entry["attrs"].get("MDSSUPPTYPE")
                if code in hits:
                    hits[code].append({
                        "xmlBranch": branch, "node": field(node, "NodeNumber"),
                        "nodeName": field(node, "NodeName"),
                        "type": field(node, "ComponentType"),
                        "position": field(node, "Position"),
                    })
        print("BM2_GTST_NATIVE_OWNER_RECON " + json.dumps({
            "nodes": len(source_nodes), "groups": len(groups),
            "matchCounts": {k: len(v) for k, v in hits.items()},
            "matches": hits,
            "matchErrors": errors[:12], "matchErrorCount": len(errors),
        }, sort_keys=True))
        self.assertEqual(len(source_nodes), 1196)


    def test_original_bm2_gtst_nearest_geometry_is_diagnostic_only(self):
        """Old 25 mm snap method is measured, not automatically applied."""
        xml = ROOT / "Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml"
        with ZipFile(STAGED) as archive:
            staged = json.loads(archive.read(MEMBER))
        root = ET.parse(xml).getroot()
        by_branch = {
            field(b, "Branchname"): [(n, point(field(n, "Position")))
                                     for n in children(b, "Node")]
            for b in root.iter() if local(b) == "Branch"
        }
        report = {}
        for entry in source_entries(staged, {}):
            attrs = entry["attrs"]
            code = attrs.get("MDSSUPPTYPE")
            if code not in ("GT571", "ST572"):
                continue
            p = entry["point"]
            nodes = [(n, q) for n, q in by_branch.get(entry["branch"], [])
                     if q is not None]
            nearest = sorted(((math.dist(p, q), n) for n, q in nodes), key=lambda x: x[0])
            carriers = sorted(((math.dist(p, q), n) for n, q in nodes
                               if field(n, "ComponentType").upper() in ("ANCI", "ATTA")),
                              key=lambda x: x[0])
            segments = []
            for (n1, q1), (n2, q2) in zip(nodes, nodes[1:]):
                direction = tuple(b - a for a, b in zip(q1, q2))
                norm = sum(v * v for v in direction)
                if norm <= 1e-12:
                    continue
                t = sum((p[i]-q1[i]) * direction[i] for i in range(3)) / norm
                if not 0 < t < 1:
                    continue
                projected = tuple(q1[i] + t * direction[i] for i in range(3))
                segments.append((math.dist(p, projected), t, n1, n2))
            segments.sort(key=lambda row: row[0])
            label = lambda pair: {
                "distanceMm": round(pair[0], 3),
                "number": field(pair[1], "NodeNumber"),
                "type": field(pair[1], "ComponentType"),
                "nodeName": field(pair[1], "NodeName"),
            }
            report[code] = {
                "stageBranch": entry["branch"], "stagePoint": list(p),
                "stageOwner": attrs.get("OWNER"),
                "sameBranchXmlNodes": len(nodes),
                "nearestXmlNode": label(nearest[0]) if nearest else None,
                "nearestCarrierNode": label(carriers[0]) if carriers else None,
                "closestConsecutiveSpan": ({
                    "distanceMm": round(segments[0][0], 3),
                    "fraction": round(segments[0][1], 6),
                    "from": field(segments[0][2], "NodeNumber"),
                    "to": field(segments[0][3], "NodeNumber"),
                    "fromType": field(segments[0][2], "ComponentType"),
                    "toType": field(segments[0][3], "ComponentType"),
                } if segments else None),
            }
        self.assertEqual(set(report), {"GT571", "ST572"})
        print("BM2_GTST_READONLY_NEAREST_GEOMETRY " + json.dumps(report, sort_keys=True))


    def test_BM2_configured_datum_and_tolerance_matrix_readonly(self):
        """Report actual owner receipts; user-configured broad tolerance is not proof."""
        xml = ROOT / "Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml"
        with ZipFile(STAGED) as archive:
            staged = json.loads(archive.read(MEMBER))
        root = ET.parse(xml).getroot()
        nodes = [(field(b, "Branchname"), n) for b in root.iter()
                 if local(b) == "Branch" for n in children(b, "Node")]
        results = {}
        for tol in (6, 25, 470, 500):
            cfg = {"dtxrPositionOffset": {
                       "enabled": True, "xOffset": 0, "yOffset": 0, "zOffset": 100000},
                   "jsonTrace": {"coordinateTolerance": tol}}
            groups = calibrated_groups(nodes, source_entries(staged, cfg), cfg, field)
            hits, blocked = {"GT571": [], "ST572": []}, []
            def require(ok, code):
                if not ok: raise ValueError(code)
            for branch, node in nodes:
                if field(node, "ComponentType").upper() not in ("ATTA", "ANCI"):
                    continue
                try:
                    resolved = resolve(node, branch, groups, tolerance(cfg), field, require)
                except ValueError as error:
                    blocked.append([branch, field(node, "NodeNumber"), str(error)])
                    continue
                for entry in resolved:
                    code = entry["attrs"].get("MDSSUPPTYPE")
                    if code in hits:
                        hits[code].append({
                            "xmlBranch": branch,
                            "node": field(node, "NodeNumber"),
                            "nodeName": field(node, "NodeName"),
                            "owner": entry["attrs"].get("OWNER"),
                            "position": field(node, "Position"),
                        })
            results[str(tol)] = {"hits": hits, "blocked": blocked[:6],
                                 "blockedCount": len(blocked)}
        print("BM2_DATUM_OFFSET_TOLERANCE_MATRIX " + json.dumps(results, sort_keys=True))
        self.assertEqual(len(results), 4)


if __name__ == "__main__":
    unittest.main()
