"""Optional instrument modeling suggestions; source and accepted mass remain separate."""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] /
                       "converters" / "scripts"))
from xml229_instrument_source_revision import (
    ClassificationRefused, approve, audit, inspect,
)
from xml229_native_final_mass_binding import NativeMassError, read_packet
from xml229_instrument_ef05_cases import fixture, Ef05InstrumentRevisionTests


class SourceInstrumentClassificationTests(unittest.TestCase):
    def test_real_ef05_inspection_is_pending_and_source_bound(self):
        benchmark = (Path(__file__).resolve().parents[1] /
                     "Benchmarks" / "EF-05-PRO.TEST.xml")
        review = inspect(benchmark)
        self.assertEqual(review["schema"],
                         "XML229.InstrumentSourceClassificationApproval.v1")
        self.assertEqual(len(review["components"]), 14)
        self.assertEqual(len(set(
            x["componentRefNo"] for x in review["components"])), 14)
        self.assertTrue(all(
            x["classification"] == "PENDING" and
            x["evidenceSha256"] == "" and x["approvedBy"] == "" and
            x["sourceWeightField"] == "0" and
            x["sourceWallThicknessMm"] == "0" and
            x["sourceEndRigid"] == "" and x["spanMm"] == 305.0
            for x in review["components"]))
        self.assertEqual(review["sourceXmlSha256"],
                         hashlib.sha256(benchmark.read_bytes()).hexdigest())

    def test_no_selection_preserves_source_without_approval(self):
        with TemporaryDirectory() as tmp:
            d = Path(tmp)
            source, approval = d / "source.xml", d / "review.json"
            output, receipt = d / "revised.xml", d / "receipt.json"
            xml = fixture()
            source.write_text(xml)
            approval.write_text(json.dumps(inspect(source)))
            outcome = approve(source, approval, output, receipt)
            self.assertEqual(outcome["selectedCount"], 0)
            self.assertEqual(outcome["remainingSuggestions"], 1)
            self.assertFalse(outcome["sourceChanged"])
            self.assertFalse(outcome["approvalRequired"])
            self.assertEqual(output.read_bytes(), source.read_bytes())
            self.assertEqual(source.read_text(), xml)
            self.assertEqual(outcome, json.loads(receipt.read_text()))

    def test_explicit_synthetic_choice_revises_source_not_accepted_kg(self):
        # Synthetic evidence tests gate mechanics; never real EF05 approval.
        with TemporaryDirectory() as tmp:
            d = Path(tmp)
            source, approval = d / "original.xml", d / "review.json"
            output, receipt = d / "new-original.xml", d / "new-source-proof.json"
            evidence = d / "synthetic-evidence.txt"
            source.write_text(fixture())
            evidence.write_text(
                "SYNTHETIC TEST ONLY: authorized reviewer mock in isolated unittest.")
            review = inspect(source)
            row = review["components"][0]
            row.update(
                classification="RIGID", approvedBy="Synthetic Engineer Fixture",
                approvedAtUtc="2026-10-20T12:00:00Z",
                evidencePath=evidence.name,
                evidenceSha256=hashlib.sha256(evidence.read_bytes()).hexdigest(),
                evidenceCitation="Synthetic fixture, rev 1, not EF05")
            approval.write_text(json.dumps(review))
            result = approve(source, approval, output, receipt)
            self.assertEqual(result["selectedCount"], 1)
            self.assertFalse(result["kilogramsAccepted"])
            self.assertFalse(result["approvalRequired"])
            self.assertFalse(result["engineeringApprovalVerified"])
            self.assertFalse(result["reusablePreviousWeightReview"])
            self.assertNotEqual(result["oldSourceXmlSha256"],
                                result["newSourceXmlSha256"])
            self.assertEqual(result, json.loads(receipt.read_text()))
            self.assertEqual(source.read_text(), fixture())
            # A prior accepted-weight packet cannot apply to a classified
            # source revision: the original source SHA changed.
            prior = d / "old-packet.json"
            prior.write_text(json.dumps({
                "schema": "XML229.NativeFinalPhysicalPacket.v1",
                "sourceXmlSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "basisId": "a" * 64, "finalIntentSha256": "b" * 64,
                "physicalCount": 1,
                "components": [{"occurrenceId": "old", "effectiveKg": 1}],
            }))
            with self.assertRaises(NativeMassError) as old_mass:
                read_packet(prior, output)
            self.assertEqual(old_mass.exception.code, "ORIGINAL_SOURCE_SHA_DRIFT")
            original, pending = audit(output.read_bytes())
            self.assertEqual(pending, [])
            branch = next(x for x in original.iter() if x.tag == "Branch")
            nodes = [x for x in branch if x.tag == "Node"]
            self.assertIsNone(nodes[1].find("Rigid"))
            self.assertEqual(nodes[2].find("Rigid").text, "2")
            self.assertEqual(nodes[2].find("Weight").text, "0")
            self.assertEqual(nodes[2].find("NodeNumber").text, "-1")
            with self.assertRaises(ClassificationRefused) as err:
                approve(source, approval, output, receipt)
            self.assertEqual(str(err.exception),
                             "INSTRUMENT_OUTPUT_MUST_BE_NEW_REVISION")

    def test_unpaired_instrument_is_not_suggested(self):
        with TemporaryDirectory() as tmp:
            d = Path(tmp)
            source = d / "invalid.xml"
            source.write_text(fixture().replace(
                '<ComponentRefNo>=INS-1</ComponentRefNo><Endpoint>2</Endpoint>',
                '<ComponentRefNo>=DIFFERENT</ComponentRefNo><Endpoint>2</Endpoint>'))
            result = inspect(source)
            self.assertEqual(result["components"], [])
            self.assertFalse(result["approvalRequired"])

    def test_stale_source_or_unverifiable_evidence_never_changes_source(self):
        with TemporaryDirectory() as tmp:
            d = Path(tmp)
            source, approval = d / "source.xml", d / "approval.json"
            output, receipt = d / "out.xml", d / "out.json"
            evidence = d / "document.txt"
            source.write_text(fixture())
            evidence.write_text("SYNTHETIC fixture evidence only.")
            review = inspect(source)
            row = review["components"][0]
            row.update(
                classification="RIGID", approvedBy="Synthetic Engineer Fixture",
                approvedAtUtc="2026-10-20T12:00:00+00:00",
                evidencePath=evidence.name,
                evidenceSha256="f" * 64,
                evidenceCitation="Synthetic fixture, ref ABC")
            approval.write_text(json.dumps(review))
            with self.assertRaises(ClassificationRefused) as err:
                approve(source, approval, output, receipt)
            self.assertEqual(str(err.exception),
                             "INSTRUMENT_EVIDENCE_BYTES_MISMATCH")
            row["evidenceSha256"] = hashlib.sha256(evidence.read_bytes()).hexdigest()
            review["sourceXmlSha256"] = "0" * 64
            approval.write_text(json.dumps(review))
            with self.assertRaises(ClassificationRefused) as err:
                approve(source, approval, output, receipt)
            self.assertEqual(str(err.exception),
                             "INSTRUMENT_APPROVAL_SOURCE_SHA_DRIFT")
            self.assertFalse(output.exists())
            self.assertFalse(receipt.exists())
            self.assertEqual(source.read_text(), fixture())

    def test_partial_selection_is_allowed(self):
        with TemporaryDirectory() as tmp:
            d = Path(tmp)
            source, approval = d / "source.xml", d / "approval.json"
            original = fixture()
            # Separate second branch to force two independently approved parts.
            source.write_text(original.replace(
                "</Pipe></PipeStressExport>",
                "<Branch><Branchname>SECOND</Branchname>" +
                original.split("<Branch>")[1].split("</Branch>")[0]
                .replace("INS-1", "INS-2") +
                "</Branch></Pipe></PipeStressExport>"))
            data = inspect(source)
            self.assertEqual(len(data["components"]), 2)
            data["components"][0]["classification"] = "RIGID"
            data["components"].pop()
            approval.write_text(json.dumps(data))
            result = approve(source, approval, d / "out.xml", d / "out.json")
            self.assertEqual(result["selectedCount"], 1)
            self.assertEqual(result["remainingSuggestions"], 1)
            self.assertFalse(result["approvalRequired"])
            tree, still_pending = audit((d / "out.xml").read_bytes())
            self.assertEqual(len(still_pending), 1)
            self.assertEqual(sum(1 for node in tree.iter()
                if node.tag == "Rigid" and node.text == "2"), 1)


    def test_racing_output_creation_never_overwrites_or_removes_foreign_files(self):
        """Competing output arrival after preflight must fail closed."""
        import os
        from unittest.mock import patch
        import xml229_instrument_source_revision as source_revision

        with TemporaryDirectory() as tmp:
            d = Path(tmp)
            source, manifest = d / "source.xml", d / "manifest.json"
            original = fixture().encode("utf-8")
            source.write_bytes(original)
            choices = inspect(source)
            choices["components"][0]["classification"] = "RIGID"
            manifest.write_text(json.dumps(choices))
            real_open = os.open
            for competing in ("revision", "receipt"):
                with self.subTest(competing=competing):
                    revised = d / (competing + "-revised.xml")
                    receipt = d / (competing + "-receipt.json")
                    target = revised if competing == "revision" else receipt
                    competitor_bytes = b"CREATED BY COMPETING WRITER"
                    injected = False

                    def inject_between_preflight_and_create(path, flags, mode=0o777):
                        nonlocal injected
                        if Path(path) == target and not injected:
                            injected = True
                            target.write_bytes(competitor_bytes)
                        return real_open(path, flags, mode)

                    with patch.object(source_revision.os, "open",
                                      side_effect=inject_between_preflight_and_create):
                        with self.assertRaises(FileExistsError):
                            approve(source, manifest, revised, receipt)
                    self.assertTrue(injected)
                    self.assertEqual(target.read_bytes(), competitor_bytes)
                    self.assertFalse((receipt if target == revised else revised).exists())
                    self.assertEqual(source.read_bytes(), original)



if __name__ == "__main__":
    unittest.main()
