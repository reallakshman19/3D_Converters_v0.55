from __future__ import annotations

from pathlib import Path
import unittest

import cii14_section_rules as rules14
import cii2019_section_rules as rules11
import cii_syntax_check_2019 as syntax11
import cii_v11_v14_validate as bridge_validate


class CiiFormatAuthorityConvergenceTests(unittest.TestCase):
    def test_legacy_syntax_checker_uses_corrected_v11_auxiliary_widths(self) -> None:
        self.assertEqual(syntax11.BLOCK_LINES_PER_SECTION, rules11.LINES_PER_AUX_BLOCK)
        self.assertEqual(syntax11.BLOCK_LINES_PER_SECTION["FORCMNT"], 20)
        self.assertEqual(syntax11.BLOCK_LINES_PER_SECTION["FLANGES"], 12)

    def test_legacy_checker_counts_blank_fixed_rows_as_physical_flange_rows(self) -> None:
        payload = [(index + 1, f"row-{index + 1}") for index in range(12)]
        payload[3] = (4, "")
        section = syntax11.Section(name="FLANGES", header_line=1, payload=payload)

        errors: list[dict[str, object]] = []
        syntax11._validate_blocked_section(section, "FLANGES", 1, errors)
        self.assertEqual(errors, [])

        stale = syntax11.Section(name="FLANGES", header_line=1, payload=payload[:11])
        stale_errors: list[dict[str, object]] = []
        syntax11._validate_blocked_section(stale, "FLANGES", 1, stale_errors)
        self.assertEqual(len(stale_errors), 1)
        self.assertEqual(stale_errors[0]["code"], "section_block_rows")

    def test_legacy_report_keeps_blank_fixed_rows_in_derived_block_counts(self) -> None:
        payload = [(index + 1, f"row-{index + 1}") for index in range(12)]
        payload[3] = (4, "")
        section = syntax11.Section(name="FLANGES", header_line=1, payload=payload)
        report = syntax11._build_report(
            Path("fixture.cii"), [section], {}, [], [], text=None
        )
        derived = report["derivedBlockCounts"]["FLANGES"]
        self.assertEqual(derived["rows"], 12)
        self.assertEqual(derived["derivedBlocks"], 1)
        self.assertEqual(derived["remainderRows"], 0)

    def test_v14_profile_matches_dedicated_bridge_validator_deltas(self) -> None:
        expected_deltas = {
            "ALLOWBLS": 28,
            "SIF&TEES": 14,
            "REDUCERS": 2,
        }
        for section, rows in expected_deltas.items():
            with self.subTest(section=section):
                self.assertEqual(rules14.LINES_PER_AUX_BLOCK[section], rows)
                self.assertEqual(bridge_validate.V14_AUX_ROWS[section], rows)

    def test_v14_allowables_accepts_28_rows_and_rejects_stale_26_rows(self) -> None:
        control = rules14.ControlCounts(
            numelt=0,
            numnoz=0,
            nohgrs=0,
            nonam=0,
            nored=0,
            numflg=0,
            bends=0,
            rigids=0,
            expjts=0,
            restraints=0,
            displmnt=0,
            forcmnt=0,
            uniform=0,
            wind=0,
            offsets=0,
            allowbls=1,
            sif_tees=0,
            izup=0,
            equipmnt=0,
        )

        correct = {"ALLOWBLS": [" " * 80 for _ in range(28)]}
        correct_report = rules14.validate_aux_block_rows(correct, control)
        self.assertTrue(correct_report.ok, correct_report.to_dict())

        stale = {"ALLOWBLS": [" " * 80 for _ in range(26)]}
        stale_report = rules14.validate_aux_block_rows(stale, control)
        self.assertFalse(stale_report.ok)
        allow_errors = [
            issue for issue in stale_report.issues
            if issue.section == "ALLOWBLS" and issue.severity == "error"
        ]
        self.assertEqual(len(allow_errors), 1)
        self.assertEqual(allow_errors[0].expected, 28)
        self.assertEqual(allow_errors[0].actual, 26)

    def test_control_nonam_and_restraint_counts_retain_distinct_i13_slots(self) -> None:
        control = rules11.ControlCounts(
            numelt=1,
            numnoz=2,
            nohgrs=3,
            nonam=7,
            nored=4,
            numflg=5,
            bends=6,
            rigids=8,
            expjts=9,
            restraints=11,
            displmnt=12,
            forcmnt=13,
            uniform=14,
            wind=15,
            offsets=16,
            allowbls=17,
            sif_tees=18,
            izup=19,
            equipmnt=20,
        )
        rows = rules11.format_control_rows(control)
        self.assertEqual(len(rows[0]), 80)
        self.assertEqual(len(rows[1]), 80)
        self.assertEqual(rows[0][2 + 3 * 13:2 + 4 * 13].strip(), "7")
        self.assertEqual(rows[1][2 + 3 * 13:2 + 4 * 13].strip(), "11")
        reparsed = rules11.parse_control_counts(rows)
        self.assertEqual(reparsed.nonam, 7)
        self.assertEqual(reparsed.restraints, 11)

    def test_writer_relevant_block_cardinalities_remain_version_explicit(self) -> None:
        self.assertEqual(rules11.LINES_PER_AUX_BLOCK["RESTRANT"], 24)
        self.assertEqual(rules14.LINES_PER_AUX_BLOCK["RESTRANT"], 24)
        self.assertEqual(rules11.LINES_PER_AUX_BLOCK["SIF&TEES"], 10)
        self.assertEqual(rules14.LINES_PER_AUX_BLOCK["SIF&TEES"], 14)
        self.assertEqual(rules11.LINES_PER_AUX_BLOCK["REDUCERS"], 1)
        self.assertEqual(rules14.LINES_PER_AUX_BLOCK["REDUCERS"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
