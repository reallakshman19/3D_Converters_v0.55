"""Held-out CII RIGID mass and immutable review chain challenge (synthetic only)."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

_PATH = Path(__file__).resolve().parents[1] / "scripts" / "gc-pw-v1-cii-mass-oracle.py"
_SPEC = importlib.util.spec_from_file_location("gc_pw_mass_oracle", _PATH)
O = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(O)

BASIS = "a" * 64
SOURCE_XML = b"<Model><Branch><Branchname>SAME</Branchname><Node><NodeNumber>-1</NodeNumber><ComponentRefNo>480</ComponentRefNo></Node><Node><NodeNumber>-1</NodeNumber></Node></Branch></Model>"


def cii(weights):
    controls = ["0 0 0 0 0 0", "0 " + str(len(weights)) + " 0 0 0 0", "0 0 0 0 0 0", "0"]
    return "#$ VERSION\n1\n#$ CONTROL\n" + "\n".join(controls) + "\n#$ RIGID\n" + "\n".join(f"{w:>15}{'0.000000':>13}" for w in weights) + "\n#$ UNITS\n  N.\n"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def make_case(base, *, split=True, action="accept-match1", weight=None):
    """Create source/snapshot data before the fake CII output."""
    path = Path(base)
    (path / "sample.xml").write_bytes(SOURCE_XML)
    w = weight or (["600", "607.34"] if split else ["1207.34"])
    output = cii(w)
    (path / "actual.cii").write_text(output, encoding="utf-8")
    group = {
        "sourceId": "SRC1", "componentOccurrenceId": "physical-480",
        "physicalComponentGroupId": "SRC1/physical-480",
        "branchOccurrenceIndex": 0, "nodeOrdinal": 0,
        "sourceWeightKg": "120.73401", "proposedWeightKg": "15",
        "acceptedKg": "120.73401", "finalAction": action,
        "childAllocations": [
            {"rigidRecordIndex": i, "allocatedKg": mass} for i, mass in
            enumerate(["60", "60.73401"] if split else ["120.73401"])
        ],
    }
    snap = {
        "preview": {"stage": "preview", "basisId": BASIS, "sourceRefs": ["SRC1"]},
        "RigidMatch1": {"stage": "RigidMatch1", "basisId": BASIS, "decisions": [
            {"sourceId": "SRC1", "componentOccurrenceId": "physical-480",
             "action": "accept", "acceptedKg": "120.73401"}]},
        "Rigidmatch2": {"stage": "Rigidmatch2", "basisId": BASIS, "decisions": [
            {"sourceId": "SRC1", "componentOccurrenceId": "physical-480",
             "action": "confirm-match1", "acceptedKg": "120.73401"}]},
    }
    refs = {}
    for stage, body in snap.items():
        raw = json.dumps(body, sort_keys=True).encode()
        (path / (stage + ".json")).write_bytes(raw)
        refs[stage] = {"filename": stage + ".json", "basisId": BASIS, "sha256": digest(raw)}
    ledger = {
        "schemaVersion": O.SCHEMA, "basisId": BASIS,
        "sources": {"SRC1": {"filename": "sample.xml", "sha256": digest(SOURCE_XML)}},
        "snapshots": refs,
        "output": {"ciiSha256": digest(output.encode()), "convention": "legacy-kgx10-N"},
        "groups": [group], "nonmassRigid": [],
    }
    return ledger


def check(ledger, base):
    data = (Path(base) / "actual.cii").read_bytes()
    ledger["output"]["ciiSha256"] = digest(data)
    return O.verify_ledger(ledger, data.decode(), source_dir=base, evidence_dir=base, cii_bytes=data)


def error(fn, code):
    try:
        fn()
    except O.MassOracleError as exc:
        if exc.code != code:
            raise AssertionError(f"expected {code}, got {exc.code}: {exc}") from exc
        return
    raise AssertionError("expected " + code)


class HeldOutMassTests(unittest.TestCase):
    def test_owner_weight_12073401_and_15_kg_proposal(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False)
            result = check(ledger, td)
            self.assertEqual(result["status"], "MASS_LEDGER_VERIFIED")
            self.assertEqual(result["rigidRecords"], 1)
            self.assertEqual(result["physicalGroups"], 1)
            self.assertEqual(result["sourceOccurrences"], 2)
            self.assertEqual(result["outputConvention"], "legacy-kgx10-N")

    def test_split_conserves_accepted_mass_despite_repeated_minus_one_nodes(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=True)
            self.assertEqual(check(ledger, td)["rigidRecords"], 2)
            ledger["groups"][0]["childAllocations"][1]["allocatedKg"] = "120.73401"
            error(lambda: check(ledger, td), "PHYSICAL_MASS_NONCONSERVATION")

    def test_x100_scale_and_wrong_child_output_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False, weight=["12073.4"])
            error(lambda: check(ledger, td), "CII_WEIGHT_MISMATCH")
            ledger["output"]["convention"] = "legacy-unscaled-N"
            error(lambda: check(ledger, td), "CII_WEIGHT_MISMATCH")

    def test_cii_units_declaration_must_be_force_even_if_numbers_match(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False)
            path = Path(td) / "actual.cii"
            path.write_text(path.read_text().replace("  N.\n", "  lbf.\n"), encoding="utf-8")
            error(lambda: check(ledger, td), "CII_FORCE_UNIT_UNVERIFIED")

    def test_proposal_is_not_accepted_and_match1_does_not_equal_final(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False, action="proposed")
            error(lambda: check(ledger, td), "PROPOSAL_NOT_AUTHORITY")
            ledger["groups"][0]["finalAction"] = "accept-match1"
            ledger["groups"][0]["acceptedKg"] = "15"
            error(lambda: check(ledger, td), "ACCEPTED_MASS_MISMATCH")

    def test_final_override_is_distinct_and_requires_immutable_match2(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False, action="final-override")
            error(lambda: check(ledger, td), "FINAL_REVIEW_MISMATCH")
            final = Path(td) / "Rigidmatch2.json"
            payload = json.loads(final.read_text())
            payload["decisions"][0]["action"] = "override"
            raw = json.dumps(payload, sort_keys=True).encode()
            final.write_bytes(raw)
            # Even the correct decision cannot pass with a stale frozen snapshot hash.
            error(lambda: check(ledger, td), "SNAPSHOT_CONTENT_DRIFT")
            ledger["snapshots"]["Rigidmatch2"]["sha256"] = digest(raw)
            self.assertEqual(check(ledger, td)["status"], "MASS_LEDGER_VERIFIED")

    def test_duplicate_missing_and_orphan_rigid_owners_fail(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=True)
            ledger["groups"][0]["childAllocations"].append(
                {"rigidRecordIndex": 0, "allocatedKg": "1"})
            error(lambda: check(ledger, td), "DUPLICATE_CII_RIGID_OWNER")
            ledger["groups"][0]["childAllocations"] = ledger["groups"][0]["childAllocations"][:1]
            error(lambda: check(ledger, td), "PHYSICAL_MASS_NONCONSERVATION")
            ledger["groups"][0]["childAllocations"][0]["allocatedKg"] = "120.73401"
            (Path(td) / "actual.cii").write_text(cii(["1207.34", "607.34"]), encoding="utf-8")
            error(lambda: check(ledger, td), "UNACCOUNTED_CII_RIGID")

    def test_invalid_source_or_unmatched_occurrence_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False)
            ledger["groups"][0]["nodeOrdinal"] = 22
            error(lambda: check(ledger, td), "UNKNOWN_SOURCE_OCCURRENCE")
            ledger["groups"][0]["nodeOrdinal"] = 0
            (Path(td) / "sample.xml").write_bytes(SOURCE_XML.replace(b"480", b"481"))
            error(lambda: check(ledger, td), "SOURCE_CONTENT_DRIFT")

    def test_control_count_and_unreviewed_nonmass_rigid_cannot_pass(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False)
            (Path(td) / "actual.cii").write_text(cii(["1207.34", "0"]), encoding="utf-8")
            error(lambda: check(ledger, td), "UNACCOUNTED_CII_RIGID")
            ledger["nonmassRigid"] = [{"rigidRecordIndex": 1, "reason": "nonweighted adjacency"}]
            self.assertEqual(check(ledger, td)["rigidRecords"], 2)
            (Path(td) / "actual.cii").write_text(
                cii(["1207.34", "0"]).replace("0 2 0 0 0 0", "0 1 0 0 0 0"), encoding="utf-8")
            error(lambda: check(ledger, td), "RIGID_COUNT_MISMATCH")

    def test_missing_stage_wrong_basis_and_unsafe_path_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False)
            ledger["snapshots"]["RigidMatch1"]["basisId"] = "b" * 64
            error(lambda: check(ledger, td), "SNAPSHOT_BASIS_MISMATCH")
            ledger["snapshots"]["RigidMatch1"]["basisId"] = BASIS
            del ledger["snapshots"]["preview"]
            error(lambda: check(ledger, td), "SNAPSHOT_STAGE_SET")
            ledger["snapshots"]["preview"] = {"filename": "../preview.json", "basisId": BASIS, "sha256": "a"*64}
            error(lambda: check(ledger, td), "UNSAFE_FILENAME")

    def test_extra_snapshot_acceptance_for_unlisted_component_cannot_disappear(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False)
            stage = Path(td) / "RigidMatch1.json"
            payload = json.loads(stage.read_text())
            payload["decisions"].append({
                "sourceId": "SRC1", "componentOccurrenceId": "unlisted-physical",
                "action": "accept", "acceptedKg": "45",
            })
            updated = json.dumps(payload, sort_keys=True).encode()
            stage.write_bytes(updated)
            ledger["snapshots"]["RigidMatch1"]["sha256"] = digest(updated)
            error(lambda: check(ledger, td), "UNACCOUNTED_REVIEW_DECISION")

    def test_cli_reports_fail_closed_not_fake_owner_success(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = make_case(td, split=False)
            Path(td, "ledger.json").write_text(json.dumps(ledger))
            self.assertEqual(O.run_files(Path(td,"ledger.json"), Path(td,"actual.cii"), td, td)["status"],
                             "MASS_LEDGER_VERIFIED")
            with self.assertRaises(O.MassOracleError):
                O.run_files(Path(td,"missing.json"), Path(td,"actual.cii"), td, td)


if __name__ == "__main__":
    unittest.main()
