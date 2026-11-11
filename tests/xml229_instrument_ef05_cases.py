"""Real EF-05 byte-preserving regression cases, imported by original suite."""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import unittest

from xml229_instrument_source_revision import approve, inspect


def fixture():
    return ("""<PipeStressExport><Pipe><Branch><Branchname>TEST</Branchname>
<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>
<Position>0 0 0</Position></Node>
<Node><NodeNumber>-1</NodeNumber><ComponentType>INST</ComponentType>
<ComponentRefNo>=INS-1</ComponentRefNo><Endpoint>1</Endpoint>
<Position>20 0 0</Position><Weight>0</Weight></Node>
<Node><NodeNumber>-1</NodeNumber><ComponentType>INST</ComponentType>
<ComponentRefNo>=INS-1</ComponentRefNo><Endpoint>2</Endpoint>
<Position>325 0 0</Position><Weight>0</Weight></Node>
</Branch></Pipe></PipeStressExport>""")


class Ef05InstrumentRevisionTests(unittest.TestCase):
    @staticmethod
    def expected_ef05_revision(original, selected):
        """Independent raw-byte oracle; deliberately not Expat production logic."""
        import re
        nodes = list(re.finditer(rb"<Node>(.*?)</Node>", original, re.DOTALL))
        positions = []
        for row in selected:
            ref = ("<ComponentRefNo>" + row["componentRefNo"] +
                   "</ComponentRefNo>").encode("utf-8")
            matching = [m for m in nodes if ref in m.group(0) and
                        b"<Endpoint>2</Endpoint>" in m.group(0)]
            if len(matching) != 1:
                raise AssertionError("Expected unique Endpoint 2: " + row["componentRefNo"])
            positions.append(matching[0].end() - len(b"</Node>"))
        if len(set(positions)) != len(positions):
            raise AssertionError("Duplicate target insertion")
        for pos in sorted(positions, reverse=True):
            original = original[:pos] + b"<Rigid>2</Rigid>" + original[pos:]
        return original

    def test_real_ef05_zero_one_multiple_all_selected_byte_fidelity(self):
        source = (Path(__file__).resolve().parents[1] /
                  "Benchmarks" / "EF-05-PRO.TEST.xml")
        original = source.read_bytes()
        self.assertTrue(original.startswith(b"\xef\xbb\xbf"))
        self.assertIn(b"<!-- Configuration information -->", original)
        self.assertIn(b'xmlns="http://aveva.com/pipeStress116.xsd"', original)
        rows = inspect(source)["components"]
        self.assertEqual(len(rows), 14)
        with TemporaryDirectory() as tmp:
            for n in (0, 1, 3, 14):
                with self.subTest(selected=n):
                    draft = inspect(source)
                    for row in draft["components"][:n]:
                        row["classification"] = "RIGID"
                    manifest = Path(tmp) / f"review-{n}.json"
                    output = Path(tmp) / f"revised-{n}.xml"
                    receipt = Path(tmp) / f"receipt-{n}.json"
                    manifest.write_text(json.dumps(draft))
                    result = approve(source, manifest, output, receipt)
                    expected = self.expected_ef05_revision(original, rows[:n])
                    self.assertEqual(output.read_bytes(), expected,
                                     "Only selected Endpoint 2 Rigid insertions permitted")
                    self.assertEqual(source.read_bytes(), original)
                    self.assertEqual(result["selectedCount"], n)
                    self.assertEqual(result["remainingSuggestions"], 14 - n)
                    self.assertEqual(result["sourceChanged"], bool(n))
                    self.assertFalse(result["approvalRequired"])
                    self.assertFalse(result["kilogramsAccepted"])
                    self.assertEqual(result["oldSourceXmlSha256"],
                                     hashlib.sha256(original).hexdigest())
                    self.assertEqual(result["newSourceXmlSha256"],
                                     hashlib.sha256(expected).hexdigest())
                    self.assertEqual(result, json.loads(receipt.read_text()))
                    self.assertTrue(output.read_bytes().startswith(b"\xef\xbb\xbf"))
                    self.assertIn(b"<!-- Configuration information -->", output.read_bytes())
                    self.assertIn(b'xmlns="http://aveva.com/pipeStress116.xsd"',
                                  output.read_bytes())
                    if n:
                        # An intentionally dropped comment must fail the oracle.
                        corrupted = expected.replace(b"<!-- Configuration information -->",
                                                     b"", 1)
                        with self.assertRaises(AssertionError):
                            self.assertEqual(corrupted, expected)

    def test_lossless_prefixed_source_and_first_endpoint_rigid_exclusion(self):
        import re
        prefixed = re.sub(
            rb"<(/?)([A-Za-z][A-Za-z0-9]*)",
            lambda m: b"<" + m.group(1) + b"p:" + m.group(2),
            fixture().encode("utf-8"))
        prefixed = prefixed.replace(
            b"<p:PipeStressExport>", b'<p:PipeStressExport xmlns:p="urn:pipe">')
        original = (b'\xef\xbb\xbf<?xml version="1.0" encoding="utf-8"?>\r\n'
                    b"<!-- preserved -->\r\n" + prefixed)
        with TemporaryDirectory() as tmp:
            d = Path(tmp)
            source = d / "source.xml"
            source.write_bytes(original)
            draft = inspect(source)
            self.assertEqual(len(draft["components"]), 1)
            draft["components"][0]["classification"] = "RIGID"
            manifest = d / "review.json"
            manifest.write_text(json.dumps(draft))
            output = d / "revised.xml"
            approve(source, manifest, output, d / "receipt.json")
            offset = original.rfind(b"</p:Node>")
            self.assertEqual(output.read_bytes(),
                             original[:offset] + b"<p:Rigid>2</p:Rigid>" + original[offset:])
            self.assertIn(b"<!-- preserved -->", output.read_bytes())
            # The Python companion rejects a pre-rigid first endpoint.
            source.write_text(fixture().replace(
                "<Endpoint>1</Endpoint>",
                "<Endpoint>1</Endpoint><Rigid>2</Rigid>"))
            self.assertEqual(inspect(source)["components"], [])
