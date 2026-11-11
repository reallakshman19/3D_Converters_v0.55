"""Synthetic native Python substage receipt tests: no private Owner model is used."""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from tempfile import TemporaryDirectory
import re
import shutil
import subprocess
import sys
import unittest
import json
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
SCRIPTS=ROOT/"converters"/"scripts"
sys.path.insert(0,str(SCRIPTS))

import xml_to_cii2019_runtime_custody as runtime
from xml229_native_final_mass_binding import NativeMassError


def fake_args(packet=True):
    return SimpleNamespace(
        input=Path("synthetic.xml"),
        output=Path("never-published.cii"),
        xml229_native_final_packet=Path("synthetic-packet.json") if packet else None,
        xml229_native_mass_proof=Path("not-published-proof.json") if packet else None,
        split_condensed_valve_flange=None,
        staged_json=None,
        support_config_json='{}',
        weight_scale=10,
        diagnostics_out=None,
    )


class NativeSubstageWitnessTests(unittest.TestCase):
    def tearDown(self):
        if hasattr(sys,"_xml229_native_failure_stage"):
            del sys._xml229_native_failure_stage

    def test_typed_native_lineage_exception_preserved_with_substage(self):
        with patch.object(runtime.patched,"_parse_args",return_value=fake_args()),\
             patch.object(runtime.patched,"_load_support_config",return_value={}),\
             patch("xml229_native_final_mass_binding.stage_native_original_lineage",
                   side_effect=NativeMassError("NATIVE_FINALIZED_GEOMETRY_REQUIRED")):
            with self.assertRaises(NativeMassError) as context:
                runtime.main()
        self.assertEqual(context.exception.code,"NATIVE_FINALIZED_GEOMETRY_REQUIRED")
        self.assertEqual(sys._xml229_native_failure_stage,"ORIGINAL_LINEAGE_STAGE")

    def test_unexpected_private_exception_retains_stage_without_suppressing_failure(self):
        private="SECRET_CUSTOMER_PATH /priv/model.xml"
        with patch.object(runtime.patched,"_parse_args",return_value=fake_args(False)),\
             patch.object(runtime.patched,"_load_support_config",return_value={}),\
             patch.object(runtime.patched,"_maybe_enrich_from_staged_json",
                 side_effect=ValueError(private)):
            with self.assertRaisesRegex(ValueError,"SECRET_CUSTOMER_PATH"):
                runtime.main()
        self.assertEqual(sys._xml229_native_failure_stage,"STAGED_ENRICHMENT")

    def test_native_worker_bundle_loads_prefinal_support_mapper(self):
        # Reproduce the fresh Worker import boundary without a full Owner
        # Final packet. This fails on the pre-fix engine.js script list.
        engine_path = ROOT / "converters/xml-cii-2019-standalone/engine.js"
        served_path = ROOT / "docs/converters/xml-cii-2019-standalone/engine.js"
        engine = engine_path.read_text(encoding="utf-8")
        self.assertEqual(engine, served_path.read_text(encoding="utf-8"))
        inventory = engine.split("const SCRIPT_FILE_NAMES = Object.freeze([", 1)[1].split("]);", 1)[0]
        bundled = set(re.findall(r"'([^']+[.]py)'", inventory))
        required = ("xml229_prefinal_restraints.py",
                    "xml229_prefinal_restraint_source.py",
                    "xml229_support_type_mapper.py")
        for filename in required:
            self.assertIn(filename, bundled)
            self.assertEqual((SCRIPTS / filename).read_bytes(),
                             (ROOT / "docs/converters/scripts" / filename).read_bytes())
        with TemporaryDirectory() as work:
            for filename in required[:-1]:
                shutil.copyfile(SCRIPTS / filename, Path(work) / filename)
            command = [sys.executable, "-I", "-c",
                       "import sys; sys.path.insert(0, sys.argv[1]); "
                       "import xml229_prefinal_restraints", work]
            missing = subprocess.run(command, capture_output=True, text=True, timeout=20)
            self.assertNotEqual(missing.returncode, 0)
            self.assertIn("No module named 'xml229_support_type_mapper'", missing.stderr)
            shutil.copyfile(SCRIPTS / required[-1], Path(work) / required[-1])
            resolved = subprocess.run(command, capture_output=True, text=True, timeout=20)
            self.assertEqual(resolved.returncode, 0, resolved.stderr)


    def test_bm2_node_3430_source_bound_dtxr_annotations(self):
        # This uses public authentic BM2 geometry, but SYNTHETIC JSON
        # descriptors/gap to isolate the spelling mismatch without claiming
        # actual Owner support values or native CII engineering approval.
        from xml_to_cii2019_master_addon import (
            _ps_tags_from_text, enrich_xml_addons,
        )
        from xml_to_cii2019_patched import _build_keyword_restraint_specs
        self.assertEqual(_ps_tags_from_text('PS00574.1'), {'PS-00574'})
        self.assertEqual(_ps_tags_from_text('/PS-00574.1'), {'PS-00574'})
        self.assertNotEqual(_ps_tags_from_text('PS00573.1'),
                            _ps_tags_from_text('PS00574.1'))
        xml_path = ROOT / 'Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml'
        staged = [{
            'type': 'BRANCH',
            'name': '/GLRD-1000-8"-B4110003-13451-01/B1',
            'children': [
                {'type': 'SUPPORT', 'name': '/PS-00574.1',
                 'attributes': {'NAME': '/PS-00574.1',
                    'DTXR': 'GUIDE (NAME=/PS-00574.1,CMPSUPGAP=0mm)'}},
                {'type': 'SUPPORT', 'name': '/PS00574.1',
                 'attributes': {'NAME': '/PS00574.1',
                    'DTXR': 'LINE STOP (NAME=/PS00574.1,CMPSUPGAP=15mm)'}},
            ],
        }]
        result = enrich_xml_addons(xml_path, None, None, json.dumps(staged),
                                   {'enabled': False})
        root = ET.fromstring(result['xmlText'])
        def text(node, name):
            return next((c.text or '' for c in node
                         if c.tag.rsplit('}', 1)[-1] == name), '')
        entries = {text(n, 'NodeNumber'): n for n in root.iter()
                   if n.tag.rsplit('}', 1)[-1] == 'Node'}
        self.assertEqual(text(entries['3430'], 'NodeName'), 'PS00574.1')
        self.assertEqual(text(entries['3420'], 'DTXR_PS'), '')
        annotations = text(entries['3430'], 'DTXR_PS')
        self.assertIn('GUIDE', annotations)
        self.assertIn('LINE STOP', annotations)
        self.assertIn('CMPSUPGAP=15mm', annotations)
        with TemporaryDirectory() as d:
            annotated_path = Path(d) / 'bm2-source-bound-annotated.xml'
            annotated_path.write_text(result['xmlText'], encoding='utf-8')
            specs, _ = _build_keyword_restraint_specs(annotated_path, {})
        self.assertIn(3430, specs)
        self.assertEqual({int(x.type_code) for x in specs[3430]}, {8, 9})
        self.assertEqual(next(x.gap for x in specs[3430]
                              if int(x.type_code) == 9), 15.0)
        # Real gaps and permission to publish CII require the Owner JSON,
        # finalized XML, and independent emitted-CII verification.

    def test_stage_resets_for_each_new_invocation(self):
        sys._xml229_native_failure_stage="EMITTED_MASS_VERIFY"
        with patch.object(runtime.patched,"_parse_args",side_effect=ValueError("BAD_ARGUMENT")):
            with self.assertRaisesRegex(ValueError,"BAD_ARGUMENT"):
                runtime.main()
        self.assertEqual(sys._xml229_native_failure_stage,"RUNTIME_OPTIONS")


if __name__=="__main__":
    unittest.main()
