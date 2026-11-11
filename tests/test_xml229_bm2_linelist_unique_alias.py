"""BM2 native process line-list matching: pinned workbook evidence and CII output.

The workbook line sequence is numeric (C9=4110001) while PSI branch token 4
is P4110001. A source-bound P-prefix fallback must be unique, not fuzzy.
"""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "converters" / "scripts"))
import xml_to_cii2019_patched as native

XML_PATH = ROOT / "Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml"
XLSX_PATH = ROOT / "Benchmarks/XML-CII-2019/revamped/LL_BM2.xlsx"
SHEET = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def workbook_cell(ref):
    with ZipFile(XLSX_PATH) as workbook:
        root = ET.fromstring(workbook.read("xl/worksheets/sheet3.xml"))
    cell = next(c for c in root.iter(SHEET + "c") if c.get("r") == ref)
    return cell.findtext(SHEET + "v")


def pinned_first_branch():
    root = ET.parse(XML_PATH).getroot()
    branch = next(node for node in root.iter() if node.tag.rsplit("}", 1)[-1] == "Branch")
    return next((node.text or "").strip() for node in branch if node.tag.rsplit("}", 1)[-1] == "Branchname")


def config(rows):
    return {"linelist": {"masterRows": rows, "fieldMap": {
        "lineSeqNo": "lineSeqNo", "p1": "p1", "t1": "t1", "t2": "t2",
        "t3": "t3", "densityMixed": "densityMixed", "hydroPressure": "hydroPressure",
    }}}


def row_from_workbook():
    return {"lineSeqNo": workbook_cell("C9"), "p1": workbook_cell("K9"),
            "t1": workbook_cell("Y9"), "t2": "40", "t3": workbook_cell("Z9"),
            "densityMixed": workbook_cell("M9")}


def synthetic_source(branch):
    def node(number, x):
        return (f"<Node><NodeNumber>{number}</NodeNumber><NodeName>PS{number}</NodeName>"
                f"<ComponentType>PIPE</ComponentType><Position>{x} 0 0</Position>"
                "<OutsideDiameter>114.3</OutsideDiameter><WallThickness>0</WallThickness></Node>")
    return ("<PipeStressExport><Pipe><Branch><Branchname>" + branch + "</Branchname>"
            "<Pressure><Pressure1>0</Pressure1></Pressure>"
            "<Temperature><Temperature1>-100000</Temperature1></Temperature>"
            "<MaterialNumber>0</MaterialNumber>" + node(10, 0) + node(20, 100)
            + "</Branch></Pipe></PipeStressExport>")


class Bm2UniqueLineKeyTest(unittest.TestCase):
    def test_pinned_workbook_line_and_native_branch_differ_without_qualified_alias(self):
        self.assertEqual(workbook_cell("C9"), "4110001")
        self.assertEqual(workbook_cell("V9"), "93833")
        self.assertEqual(workbook_cell("K9"), "11000")
        branch = pinned_first_branch()
        self.assertEqual(branch, '/GLRD-1000-6"-P4110001-93833-01/B6')
        key = native._line_key_from_branch(branch, config([]))
        self.assertEqual(key, "P4110001")
        self.assertEqual(native._matching_linelist_rows(key, config([row_from_workbook()])),
                         [row_from_workbook()])

    def test_exact_source_key_wins_and_unsafe_aliases_are_not_guessed(self):
        excel_row = row_from_workbook()
        matched = native._matching_linelist_rows
        self.assertEqual(matched("P4110001", config([
            excel_row, {"lineSeqNo": "P4110001", "p1": "5555"},
        ]))[0]["p1"], "5555")
        self.assertEqual(matched("P4110001", config([excel_row, dict(excel_row)])), [])
        self.assertEqual(matched("P4110002", config([excel_row])), [])
        self.assertEqual(matched("B4110001", config([excel_row])), [])
        self.assertEqual(matched("XP4110001", config([excel_row])), [])
        self.assertEqual(matched("P4110001", config([{"lineSeqNo": "41100010"}])), [])

    def test_native_enriched_xml_and_emitted_cii_carry_pinned_process_values(self):
        branch = pinned_first_branch()
        row = row_from_workbook()
        with tempfile.TemporaryDirectory(prefix="bm2-linelist-") as temp:
            folder = Path(temp)
            source = folder / "bm2_process_alias_original.xml"
            output = folder / "output.cii"
            source.write_text(synthetic_source(branch), encoding="utf-8")
            enriched = native._apply_process_data_to_xml(source, config([row]))
            try:
                root = ET.parse(enriched).getroot()
                branch_node = next(root.iter("Branch"))
                self.assertEqual(branch_node.findtext("Pressure/Pressure1"), "11000")
                self.assertEqual(branch_node.findtext("Temperature/Temperature1"), "120")
                self.assertEqual(branch_node.findtext("Temperature/Temperature3"), "-50")
                self.assertEqual(branch_node.findtext("MaterialNumber"), "0")
                self.assertEqual(next(root.iter("Node")).findtext("WallThickness"), "0")
                cmd = [sys.executable, str(ROOT / "converters/scripts/xml_to_cii2019.py"),
                       "--input", str(enriched), "--output", str(output)]
                run = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                self.assertEqual(run.returncode, 0, run.stderr)
                cii = output.read_text(encoding="utf-8")
                section = cii.split("#$ ELEMENTS\n", 1)[1].split("#$", 1)[0]
                lines = section.splitlines()
                self.assertEqual(float(lines[1].split()[3]), 120.0)
                self.assertEqual(float(lines[3].split()[0]), 11000.0)
                self.assertAlmostEqual(float(lines[5].split()[1]), 109.85, places=3)
            finally:
                if enriched != source:
                    enriched.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
