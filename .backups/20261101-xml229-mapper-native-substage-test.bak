"""Synthetic native Python substage receipt tests: no private Owner model is used."""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import sys
import unittest

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

    def test_stage_resets_for_each_new_invocation(self):
        sys._xml229_native_failure_stage="EMITTED_MASS_VERIFY"
        with patch.object(runtime.patched,"_parse_args",side_effect=ValueError("BAD_ARGUMENT")):
            with self.assertRaisesRegex(ValueError,"BAD_ARGUMENT"):
                runtime.main()
        self.assertEqual(sys._xml229_native_failure_stage,"RUNTIME_OPTIONS")


if __name__=="__main__":
    unittest.main()
