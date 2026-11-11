#!/usr/bin/env python3
"""Held-out CII RIGID mass, source occurrence, review-snapshot oracle.

Does not import the converter, Preview or Weight scoring code. Strictly read-only.
"""
import argparse
from decimal import Decimal, InvalidOperation
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

_ORACLE_PATH = Path(__file__).with_name("gc-pw-v1-source-custody.py")
_SPEC = importlib.util.spec_from_file_location("gc_pw_source_oracle", _ORACLE_PATH)
_SOURCE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_SOURCE)

SNAPSHOTS = ("preview", "RigidMatch1", "Rigidmatch2")
SCHEMA = "gc-pw-cii-mass-oracle/v1"


class MassOracleError(ValueError):
    def __init__(self, code, detail):
        super().__init__(str(detail))
        self.code = code


def fail(code, detail):
    raise MassOracleError(code, detail)


def obj(value, path):
    if not isinstance(value, dict):
        fail("OBJECT_REQUIRED", path)
    return value


def text(value, path):
    if not isinstance(value, str) or not value.strip():
        fail("STRING_REQUIRED", path)
    return value


def sha(value, path):
    import re
    if not isinstance(value, str) or re.fullmatch(r"[0-9a-fA-F]{64}", value) is None:
        fail("SHA256_REQUIRED", path)
    return value.lower()


def amount(value, path, *, positive=True):
    if not isinstance(value, str):
        fail("EXPLICIT_DECIMAL_REQUIRED", path)
    try:
        number = Decimal(value)
    except InvalidOperation:
        fail("INVALID_DECIMAL", path)
    if not number.is_finite() or (number <= 0 if positive else number < 0):
        fail("INVALID_MASS", path)
    return number


def unsigned_index(value, path):
    if type(value) is not int or value < 0:
        fail("INVALID_RECORD_INDEX", path)
    return value


def read_json(path):
    try:
        return obj(json.loads(Path(path).read_text(encoding="utf-8")), str(path))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail("EVIDENCE_IO_OR_PARSE_ERROR", f"{path}: {error}")


def file_hash(path):
    try:
        raw = Path(path).read_bytes()
    except OSError as error:
        fail("MISSING_OR_UNREADABLE_ARTIFACT", str(error))
    return hashlib.sha256(raw).hexdigest(), raw


def checked_file(base, name, path):
    text(name, path)
    if Path(name).name != name or name in {".", ".."}:
        fail("UNSAFE_FILENAME", f"{path}={name}")
    return Path(base) / name


def parse_cii_rigid(cii_text):
    """Parse actual CII #$ CONTROL / #$ RIGID sections without engine imports."""
    sections = {}
    active = None
    for line in cii_text.splitlines():
        if line.startswith("#$ "):
            active = line[3:].strip()
            if not active or active in sections:
                fail("INVALID_CII_SECTIONS", active)
            sections[active] = []
        elif active is not None:
            if line.strip():
                sections[active].append(line)
        elif line.strip():
            fail("CII_PREAMBLE", line[:80])
    if "CONTROL" not in sections or "RIGID" not in sections:
        fail("CII_SECTION_MISSING", "CONTROL or RIGID")
    if "UNITS" not in sections or not any(row.strip() == "N." for row in sections["UNITS"]):
        fail("CII_FORCE_UNIT_UNVERIFIED", "UNITS N. declaration missing")
    controls = sections["CONTROL"]
    if len(controls) != 4:
        fail("BAD_CII_CONTROL", f"expected 4 lines, got {len(controls)}")
    try:
        counts = controls[1].split()
        if len(counts) < 2 or "." in counts[1]:
            raise ValueError("bad CONTROL row 2 count")
        count = int(counts[1])
    except (ValueError, IndexError):
        fail("BAD_CII_CONTROL", controls[1])
    if count < 0 or len(sections["RIGID"]) != count:
        fail("RIGID_COUNT_MISMATCH", f"CONTROL says {count}, RIGID rows={len(sections['RIGID'])}")
    weights = []
    for i, line in enumerate(sections["RIGID"]):
        values = line.split()
        if len(values) != 2:
            fail("MALFORMED_RIGID_ROW", f"RIGID index {i}: {line!r}")
        weights.append(amount(values[0], f"RIGID[{i}].weight", positive=False))
        amount(values[1], f"RIGID[{i}].second", positive=False)
    return weights


def close_as_cii(expected, observed):
    """CII writer uses 6 significant digits (#.6G); accept only format rounding."""
    if expected == 0:
        return abs(observed) <= Decimal("0.0000005")
    half_ulp = Decimal("0.500001") * (Decimal(10) ** (expected.adjusted() - 5))
    return abs(expected - observed) <= half_ulp


def snapshot_decisions(snapshot, stage):
    if stage == "preview":
        return {}
    decisions = snapshot.get("decisions")
    if not isinstance(decisions, list):
        fail("MISSING_REVIEW_DECISIONS", stage)
    mapping = {}
    for decision in decisions:
        obj(decision, stage + ".decisions")
        source_id = text(decision.get("sourceId"), stage + ".sourceId")
        occurrence = text(decision.get("componentOccurrenceId"), stage + ".componentOccurrenceId")
        action = text(decision.get("action"), stage + ".action")
        key = (source_id, occurrence)
        if key in mapping:
            fail("DUPLICATE_REVIEW_DECISION", str(key))
        if action not in ({"accept"} if stage == "RigidMatch1" else {"keep-source", "confirm-match1", "override"}):
            fail("INVALID_REVIEW_ACTION", action)
        mass = None if action == "keep-source" else amount(decision.get("acceptedKg"), stage + ".acceptedKg")
        mapping[key] = {"action": action, "acceptedKg": mass}
    return mapping


def verify_ledger(ledger, cii_text, *, source_dir, evidence_dir, cii_bytes=None):
    ledger = obj(ledger, "ledger")
    if ledger.get("schemaVersion") != SCHEMA:
        fail("UNSUPPORTED_LEDGER_SCHEMA", ledger.get("schemaVersion"))
    basis_id = sha(ledger.get("basisId"), "basisId")
    source_entries = obj(ledger.get("sources"), "sources")
    if not source_entries:
        fail("NO_SOURCE_AUTHORITY", "sources")
    source_occurrences = {}
    for source_id, source in source_entries.items():
        text(source_id, "sourceId")
        obj(source, f"sources.{source_id}")
        path = checked_file(source_dir, source.get("filename"), "sources.filename")
        expected_sha = sha(source.get("sha256"), "sources.sha256")
        actual_sha, raw = file_hash(path)
        if actual_sha != expected_sha:
            fail("SOURCE_CONTENT_DRIFT", str(path))
        try:
            scan = _SOURCE.scan_bytes(source_id, raw)
        except _SOURCE.OracleError as error:
            fail("SOURCE_XML_INVALID", error.code + ": " + str(error))
        for item in scan["occurrences"]:
            source_occurrences[(source_id, item["branchOccurrenceIndex"], item["nodeOrdinal"])] = item
    refs = obj(ledger.get("snapshots"), "snapshots")
    if set(refs) != set(SNAPSHOTS):
        fail("SNAPSHOT_STAGE_SET", repr(sorted(refs)))
    review_maps = {}
    snapshot_hashes = set()
    for stage in SNAPSHOTS:
        ref = obj(refs[stage], f"snapshots.{stage}")
        if sha(ref.get("basisId"), f"{stage}.basisId") != basis_id:
            fail("SNAPSHOT_BASIS_MISMATCH", stage)
        expected_sha = sha(ref.get("sha256"), f"{stage}.sha256")
        path = checked_file(evidence_dir, ref.get("filename"), stage + ".filename")
        found_sha, raw = file_hash(path)
        if expected_sha != found_sha:
            fail("SNAPSHOT_CONTENT_DRIFT", stage)
        if found_sha in snapshot_hashes:
            fail("SNAPSHOT_ALIAS", stage)
        snapshot_hashes.add(found_sha)
        try:
            body = obj(json.loads(raw), stage)
        except (UnicodeError, json.JSONDecodeError):
            fail("SNAPSHOT_PARSE_ERROR", stage)
        if body.get("basisId") != basis_id or body.get("stage") != stage:
            fail("SNAPSHOT_BODY_MISMATCH", stage)
        review_maps[stage] = snapshot_decisions(body, stage)
    cii_info = obj(ledger.get("output"), "output")
    expected_cii_sha = sha(cii_info.get("ciiSha256"), "output.ciiSha256")
    if cii_bytes is None:
        cii_bytes = cii_text.encode("utf-8")
    if hashlib.sha256(cii_bytes).hexdigest() != expected_cii_sha:
        fail("CII_CONTENT_DRIFT", "output.ciiSha256")
    convention = text(cii_info.get("convention"), "output.convention")
    if convention == "legacy-kgx10-N":
        scale = Decimal(10)
    elif convention == "legacy-unscaled-N":
        scale = Decimal(1)
    else:
        fail("UNSUPPORTED_OUTPUT_CONVENTION", convention)
    weights = parse_cii_rigid(cii_text)
    groups = ledger.get("groups")
    if not isinstance(groups, list):
        fail("GROUPS_REQUIRED", "groups")
    used = {}  # Only CII RIGID indexes may be keys here.
    group_ids = set()  # Physical group identity is a different key domain.
    accounted = set()
    for g in groups:
        obj(g, "groups[]")
        source_id = text(g.get("sourceId"), "groups.sourceId")
        component = text(g.get("componentOccurrenceId"), "groups.componentOccurrenceId")
        group_id = text(g.get("physicalComponentGroupId"), "groups.physicalComponentGroupId")
        loc = (source_id, unsigned_index(g.get("branchOccurrenceIndex"), "branchOccurrenceIndex"),
               unsigned_index(g.get("nodeOrdinal"), "nodeOrdinal"))
        if loc not in source_occurrences:
            fail("UNKNOWN_SOURCE_OCCURRENCE", repr(loc))
        if (source_id, component) in accounted:
            fail("DUPLICATE_PHYSICAL_COMPONENT", component)
        accounted.add((source_id, component))
        if group_id in group_ids:
            fail("DUPLICATE_PHYSICAL_GROUP", group_id)
        group_ids.add(group_id)
        action = text(g.get("finalAction"), "finalAction")
        key = (source_id, component)
        match1 = review_maps["RigidMatch1"].get(key)
        match2 = review_maps["Rigidmatch2"].get(key)
        if match2 is None:
            fail("FINAL_DECISION_MISSING", str(key))
        if action == "preserve-source":
            if match2["action"] != "keep-source":
                fail("FINAL_REVIEW_MISMATCH", key)
            expected_mass = amount(g.get("sourceWeightKg"), "sourceWeightKg")
        elif action == "accept-match1":
            if match1 is None or match1["action"] != "accept" or match2["action"] != "confirm-match1":
                fail("MATCH1_NOT_ACCEPTED", key)
            expected_mass = match1["acceptedKg"]
            if expected_mass != match2["acceptedKg"]:
                fail("MATCH1_FINAL_DRIFT", key)
        elif action == "final-override":
            if match2["action"] != "override":
                fail("FINAL_REVIEW_MISMATCH", key)
            expected_mass = match2["acceptedKg"]
        else:
            fail("PROPOSAL_NOT_AUTHORITY", action)
        accepted_mass = amount(g.get("acceptedKg"), "groups.acceptedKg")
        if accepted_mass != expected_mass:
            fail("ACCEPTED_MASS_MISMATCH", group_id)
        allocations = g.get("childAllocations")
        if not isinstance(allocations, list) or not allocations:
            fail("EMPTY_CHILD_ALLOCATIONS", group_id)
        total = Decimal(0)
        validated_child_allocations = []
        for allocation in allocations:
            obj(allocation, "childAllocations[]")
            idx = unsigned_index(allocation.get("rigidRecordIndex"), "rigidRecordIndex")
            if idx >= len(weights):
                fail("CII_RIGID_INDEX_OUT_OF_RANGE", idx)
            if idx in used:
                fail("DUPLICATE_CII_RIGID_OWNER", idx)
            used[idx] = group_id
            amount_kg = amount(allocation.get("allocatedKg"), "allocatedKg")
            total += amount_kg
            validated_child_allocations.append((idx, amount_kg))
        # Challenge accepted physical-component conservation *before* output-scale parity.
        # A duplicated full mass on a split sibling is a custody violation, not just
        # an arbitrary per-row mismatch when the emitted CII has the old weights.
        if abs(total - expected_mass) > Decimal("0.000001"):
            fail("PHYSICAL_MASS_NONCONSERVATION", f"{group_id}: allocated {total}, accepted {expected_mass}")
        for idx, amount_kg in validated_child_allocations:
            expected_weight = amount_kg * scale
            if not close_as_cii(expected_weight, weights[idx]):
                fail("CII_WEIGHT_MISMATCH", f"RIGID[{idx}] {weights[idx]} != {expected_weight} ({convention})")
    for stage in ("RigidMatch1", "Rigidmatch2"):
        unclaimed = set(review_maps[stage]) - accounted
        if unclaimed:
            fail("UNACCOUNTED_REVIEW_DECISION", f"{stage}: {sorted(unclaimed)!r}")
    zero = ledger.get("nonmassRigid")
    if not isinstance(zero, list):
        fail("NONMASS_DECLARATIONS_REQUIRED", "nonmassRigid")
    for row in zero:
        obj(row, "nonmassRigid[]")
        idx = unsigned_index(row.get("rigidRecordIndex"), "nonmassRigid.index")
        text(row.get("reason"), "nonmassRigid.reason")
        if idx >= len(weights):
            fail("CII_RIGID_INDEX_OUT_OF_RANGE", idx)
        if idx in used:
            fail("DUPLICATE_CII_RIGID_OWNER", idx)
        used[idx] = "explicit-zero"
        if not close_as_cii(Decimal(0), weights[idx]):
            fail("UNDECLARED_CII_MASS", idx)
    if len(used) != len(weights):
        fail("UNACCOUNTED_CII_RIGID", sorted(set(range(len(weights))) - set(used)))
    return {
        "status": "MASS_LEDGER_VERIFIED", "basisId": basis_id,
        "sourceOccurrences": len(source_occurrences), "physicalGroups": len(groups),
        "rigidRecords": len(weights), "outputConvention": convention,
        "ciiSha256": expected_cii_sha,
    }


def run_files(ledger_path, cii_path, source_dir, evidence_dir):
    ledger = read_json(ledger_path)
    cii_sha, cii_bytes = file_hash(cii_path)
    try:
        text = cii_bytes.decode("utf-8")
    except UnicodeError:
        fail("CII_DECODE_ERROR", str(cii_path))
    return verify_ledger(ledger, text, source_dir=source_dir,
                         evidence_dir=evidence_dir, cii_bytes=cii_bytes)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Independent physical mass to CII RIGID oracle")
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--cii", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        print(json.dumps(run_files(args.ledger, args.cii, args.sources, args.evidence), sort_keys=True))
    except MassOracleError as error:
        print(json.dumps({"status": "FAIL", "code": error.code, "detail": str(error)}), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
