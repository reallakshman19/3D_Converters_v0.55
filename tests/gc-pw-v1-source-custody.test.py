"""Independent GC-PW raw XML source custody negative oracle tests, no app imports."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

SRC = Path(__file__).resolve().parents[1] / "scripts" / "gc-pw-v1-source-custody.py"
SPEC = importlib.util.spec_from_file_location("gc_pw_source_custody", SRC)
ORACLE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ORACLE)


def fake_xml(node_numbers=("-1", "-1"), branch_names=("SAME", "SAME")):
    branches = []
    for name in branch_names:
        nodes = "".join(
            "<Node><NodeNumber>" + number + "</NodeNumber>"
            "<ComponentRefNo>R1</ComponentRefNo><Endpoint>1</Endpoint></Node>"
            for number in node_numbers
        )
        branches.append("<Branch><Branchname>" + name + "</Branchname>" + nodes + "</Branch>")
    return ("<Model>" + "".join(branches) + "</Model>").encode("utf-8")


def errcode(action, expected_code):
    with unittest.TestCase().assertRaises(ORACLE.OracleError) as cm:
        action()
    assert cm.exception.code == expected_code, (cm.exception.code, expected_code)


class OccurrenceOracleTests(unittest.TestCase):
    def test_repeated_branch_names_and_minus_one_are_distinct(self):
        raw = fake_xml()
        scanned = ORACLE.scan_bytes("source-1", raw)
        self.assertEqual(scanned["branchCount"], 2)
        self.assertEqual(scanned["nodeCount"], 4)
        self.assertEqual(scanned["negativeOneCount"], 4)
        self.assertEqual([r["branchName"] for r in scanned["occurrences"]], ["SAME"] * 4)
        self.assertEqual(len({ORACLE.key_of(x) for x in scanned["occurrences"]}), 4)
        self.assertEqual(
            ORACLE.verify_projection([scanned], scanned["occurrences"]),
            {"verified": True, "occurrences": 4},
        )

    def test_two_sources_must_not_alias_matching_branch_node_numbers(self):
        a = ORACLE.scan_bytes("PL-01", fake_xml())
        b = ORACLE.scan_bytes("PL-06", fake_xml())
        self.assertEqual(
            ORACLE.verify_projection([a, b], a["occurrences"] + b["occurrences"]),
            {"verified": True, "occurrences": 8},
        )
        errcode(lambda: ORACLE.verify_projection([a, b], a["occurrences"]), "MISSING_PROJECTED_OCCURRENCE")

    def test_missing_duplicate_extra_and_invalid_ordinal_fail(self):
        a = ORACLE.scan_bytes("x", fake_xml())
        base = a["occurrences"]
        errcode(lambda: ORACLE.verify_projection([a], base[:-1]), "MISSING_PROJECTED_OCCURRENCE")
        errcode(lambda: ORACLE.verify_projection([a], base + base[:1]), "DUPLICATE_PROJECTED_OCCURRENCE")
        extra = {**base[0], "nodeOrdinal": 99}
        errcode(lambda: ORACLE.verify_projection([a], base + [extra]), "EXTRA_PROJECTED_OCCURRENCE")
        errcode(lambda: ORACLE.key_of({**base[0], "nodeOrdinal": True}), "INVALID_OCCURRENCE_ORDINAL")
        errcode(lambda: ORACLE.key_of({"sourceId": "x", "nodeOrdinal": 0}), "MISSING_OCCURRENCE_FIELD")

    def test_malformed_or_orphan_node_fails_without_truncation(self):
        errcode(lambda: ORACLE.scan_bytes("x", b"<Model><Branch>"), "MALFORMED_XML")
        errcode(lambda: ORACLE.scan_bytes("x", b"<Model/>"), "NO_BRANCHES")
        orphan = b"<Model><Branch><Branchname>S</Branchname></Branch><Node><NodeNumber>5</NodeNumber></Node></Model>"
        errcode(lambda: ORACLE.scan_bytes("x", orphan), "ORPHAN_OR_NESTED_NODE")

    def test_namespace_preserved_and_direct_child_nodes_supported(self):
        xml = b'<Model xmlns="urn:owner"><Branch><Branchname>B</Branchname><Node><NodeNumber>-1</NodeNumber></Node></Branch></Model>'
        scan = ORACLE.scan_bytes("namespaced", xml)
        self.assertEqual(scan["branchCount"], 1)
        self.assertEqual(scan["nodeCount"], 1)
        self.assertEqual(scan["negativeOneCount"], 1)

    def test_owner_replay_requires_both_real_sources_and_actual_content_digest(self):
        with tempfile.TemporaryDirectory() as td:
            errcode(lambda: ORACLE.verify_owner(td), "SOURCE_FILE_MISSING")
            path = Path(td)
            (path / "PL-01_XML.xml").write_bytes(fake_xml())
            (path / "PL-06_XML.xml").write_bytes(fake_xml())
            # Synthetic shape cannot fake owner proof just by matching a declared count.
            errcode(lambda: ORACLE.verify_owner(td), "OWNER_SOURCE_DRIFT")
        errcode(lambda: ORACLE.verify_owner("/unavailable/gc-pw-owner-fixtures"),
                "SOURCE_DIRECTORY_MISSING")

    def test_byte_content_changes_even_when_length_and_node_count_match(self):
        one = fake_xml(node_numbers=("-1", "-1"))
        two = fake_xml(node_numbers=("-2", "-1"))
        self.assertEqual(len(one), len(two))
        a = ORACLE.scan_bytes("source", one)
        b = ORACLE.scan_bytes("source", two)
        self.assertEqual(a["branchCount"], b["branchCount"])
        self.assertEqual(a["nodeCount"], b["nodeCount"])
        self.assertNotEqual(a["sha256"], b["sha256"])
        self.assertNotEqual(a["negativeOneCount"], b["negativeOneCount"])


if __name__ == "__main__":
    unittest.main()
