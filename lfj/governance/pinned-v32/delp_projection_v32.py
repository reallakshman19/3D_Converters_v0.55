#!/usr/bin/env python3
"""Durable Execution Lineage and Projection (DELP) for Engineering Relay V3.2.

Agents publish engineering FACTS about their own leaf responsibility: which
declared units they report complete, the verification result, the durable
evidence refs, the candidate those refs cover, and the next unit.

Everything an Owner reads as progress or status is recomputed here from those
facts plus observed material truth: the leaf P/E, the delivery D/E of every
ancestor, the lineage path, the frontier count and the issue title. Nothing in
this module trusts a percentage, a title, a frontier count, an activity epoch,
a weight or a parent/programme number supplied by an agent; a facts record that
contains one is rejected and reported, and cannot move any number.

The module is deterministic and has no wall-clock, network or random inputs. A
projection is a pure function of: execution graph (the Coordinator's plan),
accepted facts ledger, and observations (live PR head / liveness).

Authority: DERIVED_PROJECTION_ONLY. A projection is never engineering
permission, acceptance evidence or programme authority.

Standard-library only, except that the CLI/parser load YAML when PyYAML exists.
"""

from __future__ import annotations

import argparse
import copy
import importlib.util
import hashlib
import json
import re
import subprocess
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

PROTOCOL_LINE = "V3.2"
SCHEMA_PREFIX = "relay-v3.2-delp"
AUTHORITY = "DERIVED_PROJECTION_ONLY"
FACTS_SCHEMA = f"{SCHEMA_PREFIX}-checkpoint-facts"
GRAPH_SCHEMA = f"{SCHEMA_PREFIX}-execution-graph"
PROJECTION_SCHEMA = f"{SCHEMA_PREFIX}-projection"
STATUS_SCHEMA = f"{SCHEMA_PREFIX}-live-status"
DECOMPOSITION_SCHEMA = f"{SCHEMA_PREFIX}-decomposition-report"
DIFF_SCHEMA = f"{SCHEMA_PREFIX}-graph-diff"
FACTS_KEY = "CHECKPOINT_FACTS_V1"

STATUS_START = "<!-- relay-delp:live-status:start -->"
STATUS_END = "<!-- relay-delp:live-status:end -->"
_STATUS_MARKER = re.compile(
    r"<!-- relay-delp:version=(?P<version>\d+) digest=(?P<digest>sha256:[0-9a-f]{64}) -->"
)

# Who may publish facts that the projector will believe. Anyone can comment on a public issue, so a facts
# block from an unrecognised author is rejected, never counted. `programme.fact_authors` (explicit logins)
# overrides the default of repository OWNER / MEMBER / COLLABORATOR.
TRUSTED_ASSOCIATIONS = frozenset({"OWNER", "MEMBER", "COLLABORATOR"})

TITLE_LIMIT = 250  # GitHub rejects titles over 256; keep a margin for UTF-16 emoji.

NODE_KINDS = {"ROOT", "INTERMEDIATE", "LEAF"}
UNIT_STATES = {"COMPLETE", "IN_PROGRESS", "NOT_STARTED"}
UNIT_RESULTS = {"VERIFIED", "PARTIAL", "FAILED", "NOT_RUN", "PENDING"}
GATE_RESULTS = {"PASSED", "FAILED", "NOT_RUN"}
ACTIVITY_FACTS = {
    "ACTIVE",
    "WAITING_CI",
    "WAITING_TOOL",
    "WAITING_EXTERNAL",
    "WAITING_PROVIDER_VISIBILITY",
    "RECOVERING",
    "PAUSED",
}
# A dead executor cannot declare itself QUIET/STALE; only an observer can.
OBSERVED_LIVENESS = {"ACTIVE", "QUIET", "STALE"}
RESULT_SCOPES = {"STEP", "PRODUCT", "RESPONSIBILITY"}
COMPLETE_VALUES = {"YES", "NO", "UNKNOWN"}
HANDOVER_EVENTS = {"OFFERED", "ACCEPTED"}
HANDOVER_MODES = {"CONTINUITY", "INDEPENDENT_RECONSTRUCTION"}
HANDOVER_RESULTS = {"RECONCILED", "DRIFT_FOUND", "INSUFFICIENT_GROUNDING", "OWNER_DECISION_REQUIRED"}
HANDOVER_AUTHORITY_CLASSES = {
    "PRODUCTION",
    "CANDIDATE_GENERATION",
    "REVIEW_ONLY",
    "VALIDATION_BENCHMARK",
    "HISTORICAL",
}
ENTRY_EVENTS = {"PREPARED", "EXECUTION_END"}
ENTRY_MODES = {"TAKEOVER_RECONCILE"}

# Decomposition gate. A graph without `programme.decomposition_policy` behaves exactly as before
# (mode OFF). `decompose-check` always evaluates; the mode decides whether projection/admission act on it.
POLICY_MODES = ("OFF", "ADVISORY", "ENFORCED")
WORK_CLASSES = ("PRODUCT", "MECHANICAL", "GATE")
CLAIM_KINDS = ("SEMANTIC", "DELIVERY_GATE")
PLAN_UPDATE_KINDS = ("SCOPE_EXPANSION", "SCOPE_REDUCTION", "UNIT_REWEIGHT", "UNIT_DROPPED", "POLICY_CHANGE")
# Display scale for "unit points". Percentages never use it: every share is an exact Fraction of the programme.
DEFAULT_TOTAL_WEIGHT = 10000
# NOT_RELEASEABLE only replaces these leaf states; every other state is more urgent or already means "not being worked".
_PLAN_OVERLAID_STATES = frozenset({"NOT_STARTED", "ACTIVE"})
# Provider-observed pull request states that prove work exists for a leaf. With no accepted facts such a leaf is
# UNMATERIALIZED (unknown), never NOT_STARTED (zero): the ledger is missing, the work may well be finished.
_PR_ACTIVITY_STATES = frozenset({"OPEN", "MERGED", "CLOSED"})
# Defaults follow the programme's written budgets (PROGRAMME_DECOMPOSITION_PROGRESS.md) and sit at the
# Young/Daly optimum for the interruption rate observed on the Common executors (see the contract doc).
DEFAULT_POLICY: dict[str, Any] = {
    "mode": "OFF",
    "units": {"min": 3, "max": 8, "max_share_percent": 40},
    "leaf_budget": {"target_loc": 700, "hard_loc": 1500, "target_minutes": 15, "hard_minutes": 20},
    "min_leaf_target_loc": 50,
    "require": {"outcome": True, "verify": True, "write_surface": True, "size_budget": True},
    # Backward compatible for historical graphs. New programme decompositions MUST opt in with ENFORCED.
    "claim_first": {"mode": "OFF", "require_independence_basis": True},
}
_BUDGET_KEYS = ("target_loc", "hard_loc", "target_minutes", "hard_minutes")

# Agent health: delivery-continuity telemetry, advisory only. It is observed or derived, never declared; it never moves a
# percentage, a state or a title and never blocks work. Repository telemetry may locate evidence and constrain delivery;
# it never measures value, quality or capability. Defaults are the programme's own written rules (checkpoint triggers at
# 250 / 400 and the hard ceiling at 500 / 700 reviewable lines; the third stream loss in one executor lifecycle plans a
# handover); elapsed time alone is deliberately not a rule.
HEALTH_MODES = ("OFF", "ADVISORY")
HEALTH_RANK = {"OK": 0, "UNOBSERVED": 1, "WATCH": 2, "AT_RISK": 3}  # UNOBSERVED is never healthy, and never worse than a known concern
HEALTH_VERDICT = {"OK": "HEALTHY", "UNOBSERVED": "UNOBSERVED", "WATCH": "WATCH", "AT_RISK": "AT_RISK"}
DEFAULT_HEALTH_POLICY: dict[str, Any] = {
    "mode": "OFF",
    "checkpoint": {"watch_added_loc": 250, "at_risk_added_loc": 500, "watch_changed_loc": 400, "at_risk_changed_loc": 700},
    "drift": {"watch_behind": 1, "at_risk_behind": 20},
    "interruptions": {"watch": 1, "at_risk": 3},
}

# Keys an agent must never author. They are projections, plan authority or
# derived bookkeeping. Matching is case-insensitive on exact key names and is
# applied recursively to every mapping in a facts record.
FORBIDDEN_FACT_KEYS = frozenset(
    {
        "progress",
        "percent",
        "percentage",
        "p",
        "e",
        "d",
        "pe",
        "ped",
        "title",
        "issue_title",
        "new_title",
        "parent_progress",
        "programme_progress",
        "program_progress",
        "phase_progress",
        "root_progress",
        "frontier",
        "frontier_count",
        "activity_epoch",
        "epoch",
        "evidence_health",
        "projection",
        "live_status",
        "state_light",
        "light",
        "denominator",
        "weight",
        "weights",
        "total_weight",
        "reserve",
        "reserve_weight",
        "evidenced",
        "r_p",
        "r_e",
    }
)
_ALLOWED_FACT_TOP = frozenset(
    {
        "schema",
        "responsibility",
        "material",
        "units",
        "gates",
        "activity",
        "next",
        "blocker",
        "owner_action",
        "entry",
        "handover",
        "result",
    }
)
# Projection notation an agent must not paste into a facts record.
_NOTATION = re.compile(
    r"R:P\d+\s*/\s*E\d+|[ΦΠ]:D\d+\s*/\s*E\d+|\{P\d+%\s*·\s*E\d+%",
)

_SHA = re.compile(r"^[0-9a-f]{40}$")
_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
_REF = re.compile(
    r"^(?:(?P<repo>[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?)#)?(?P<number>[1-9][0-9]*)$"
)
_UNIT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
# `<leaf ref>:<unit id>` or `<leaf ref>:gate:<gate id>` — how a plan update names the work it changes.
_ITEM_KEY = re.compile(r"^(?P<ref>[^:\s]+):(?P<item>(?:gate:)?[A-Za-z0-9][A-Za-z0-9._-]{0,63})$")
_SURFACE_GLOB = re.compile(r"[*?\[\]\\]")

LIGHT_ACTIVE = "🟢"
LIGHT_ATTENTION = "🟡"
LIGHT_WAITING = "🔵"
LIGHT_STALE = "🔴"
LIGHT_COMPLETE = "✅"
LIGHT_IDLE = "⚪"
_LIGHTS = LIGHT_ACTIVE + LIGHT_ATTENTION + LIGHT_WAITING + LIGHT_STALE + LIGHT_COMPLETE + LIGHT_IDLE

STATE_LIGHT = {
    "ACTIVE": LIGHT_ACTIVE,
    "HANDOFF": LIGHT_ATTENTION,
    "RECONSTRUCTING": LIGHT_ATTENTION,
    "WAITING_CI": LIGHT_WAITING,
    "WAITING_TOOL": LIGHT_WAITING,
    "WAITING_EXTERNAL": LIGHT_WAITING,
    "WAITING_PROVIDER_VISIBILITY": LIGHT_WAITING,
    "WAITING_DEPENDENCY": LIGHT_WAITING,
    "WAITING": LIGHT_WAITING,
    "RECOVERING": LIGHT_ATTENTION,
    "QUIET": LIGHT_ATTENTION,
    "EVIDENCE_GAP": LIGHT_ATTENTION,
    "EVIDENCE_STALE": LIGHT_ATTENTION,
    "NOT_RELEASEABLE": LIGHT_ATTENTION,  # leaf whose plan fails the decomposition gate (ENFORCED mode)
    "PLAN_GAP": LIGHT_ATTENTION,  # ancestor with at least one non-releasable leaf
    "UNMATERIALIZED": LIGHT_ATTENTION,  # the provider shows work but the facts ledger is empty: unknown, not zero
    "STALE": LIGHT_STALE,
    "COMPLETE": LIGHT_COMPLETE,
    "SUPERSEDED": LIGHT_IDLE,
    "NOT_STARTED": LIGHT_IDLE,
    "PAUSED": LIGHT_IDLE,
    "IDLE": LIGHT_IDLE,
}
HEALTH_LIGHT = {"HEALTHY": LIGHT_ACTIVE, "UNOBSERVED": LIGHT_IDLE, "WATCH": LIGHT_ATTENTION, "AT_RISK": LIGHT_STALE}

CONTINUATION_COMMANDS = re.compile(
    r"^\s*(?:continue|proceed|next|resume|reconcile|take\s+over|keep\s+going|carry\s+on)"
    r"(?:\s+(?:please|now|next))?\s*[?!.,]*\s*$",
    re.IGNORECASE,
)

_FRONTIER_LIFECYCLE = {"ACTIVE", "RECOVERING"}
_TERMINAL = {"COMPLETE", "SUPERSEDED"}


class DelpError(ValueError):
    """Base class for DELP contract violations."""


class GraphError(DelpError):
    """The execution graph (plan) is structurally invalid."""


class ForbiddenProjectionField(DelpError):
    """A facts record tried to author a projection, weight or title."""


class ProjectionConflict(DelpError):
    """A projection write lost a compare-and-swap race."""


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


_AGENT_HEALTH_AUTHORITY = "DERIVED_AGENT_HEALTH_READ_MODEL_ONLY"
_AGENT_MODULES: dict[str, Any] = {}


def _agent_module(filename: str, module_name: str) -> Any:
    """Load an exact sibling Agent Metrics implementation without changing DELP control authority."""
    if module_name not in _AGENT_MODULES:
        path = Path(__file__).with_name(filename)
        spec = importlib.util.spec_from_file_location(module_name, path)
        if spec is None or spec.loader is None:
            raise DelpError(f"cannot load Agent Metrics source {filename}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _AGENT_MODULES[module_name] = module
    return _AGENT_MODULES[module_name]


def _dimension_unavailable(reason: str) -> dict[str, Any]:
    return {"status": "UNAVAILABLE", "reason": reason}


def _dimension_invalid(reason: str) -> dict[str, Any]:
    return {"status": "INVALID", "reason": reason}


def _agent_health_read_model(
    operational_health: Mapping[str, Any] | None,
    agent_quality: Any,
) -> dict[str, Any]:
    """Compose leaf-scoped operational + quality dimensions without feeding any value back into DELP control."""
    if operational_health:
        operational = {
            "status": "AVAILABLE",
            "source": "LIVE_STATUS.node.health",
            "source_authority": AUTHORITY,
            "source_digest": canonical_digest(operational_health),
            "verdict": operational_health.get("verdict"),
            "light": operational_health.get("light"),
        }
    else:
        operational = _dimension_unavailable("OPERATIONAL_HEALTH_NOT_PROJECTED")

    quality = _dimension_unavailable("QUALITY_RESULT_NOT_OBSERVED")
    trajectory = _dimension_unavailable("TRAJECTORY_RESULT_NOT_OBSERVED")
    intervention = _dimension_unavailable("INTERVENTION_RESULT_NOT_OBSERVED")

    if agent_quality is not None:
        if not isinstance(agent_quality, Mapping):
            quality = trajectory = intervention = _dimension_invalid("AGENT_QUALITY_INPUT_NOT_MAPPING")
        else:
            allowed = {"quality_result", "trajectory_result", "intervention_result"}
            extra = sorted(set(map(str, agent_quality)) - allowed)
            if extra:
                quality = trajectory = intervention = _dimension_invalid(
                    "AGENT_QUALITY_INPUT_UNKNOWN_FIELDS:" + ",".join(extra)
                )
            else:
                m2 = _agent_module("agent_quality_trajectory_v32.py", "_relay_v32_agent_quality_trajectory")
                m3 = _agent_module("agent_intervention_v32.py", "_relay_v32_agent_intervention")
                normalized_quality = None
                normalized_trajectory = None

                raw_quality = agent_quality.get("quality_result")
                if raw_quality is not None:
                    try:
                        normalized_quality = m2._normalize_m1(raw_quality, "agent_quality.quality_result")
                        quality = {
                            "status": "AVAILABLE",
                            "source_schema": normalized_quality["schema"],
                            "source_authority": normalized_quality["authority"],
                            "window_id": normalized_quality["window_id"],
                            "input_digest": normalized_quality["input_digest"],
                            "evidence_digest": normalized_quality["evidence_digest"],
                            "result_digest": canonical_digest(normalized_quality),
                            "evidence_refs": normalized_quality["evidence_refs"],
                        }
                    except Exception as exc:
                        quality = _dimension_invalid("QUALITY_RESULT_INVALID:" + str(exc))

                raw_trajectory = agent_quality.get("trajectory_result")
                if raw_trajectory is not None:
                    if normalized_quality is None:
                        trajectory = _dimension_invalid("QUALITY_RESULT_REQUIRED_FOR_TRAJECTORY_PROVENANCE")
                    else:
                        try:
                            normalized_trajectory = m3._normalize_m2(raw_trajectory)
                            latest = normalized_trajectory["windows"][-1]
                            basis_ref = normalized_trajectory["comparison_basis"]["ref"]
                            quality_digest = canonical_digest(normalized_quality)
                            if (
                                latest["window_id"] != normalized_quality["window_id"]
                                or latest["result_digest"] != quality_digest
                                or basis_ref not in normalized_quality["evidence_refs"]
                            ):
                                raise ValueError("latest quality result does not match trajectory provenance")
                            trajectory = {
                                "status": "AVAILABLE",
                                "source_schema": normalized_trajectory["schema"],
                                "source_authority": normalized_trajectory["authority"],
                                "trajectory_id": normalized_trajectory["trajectory_id"],
                                "input_digest": normalized_trajectory["input_digest"],
                                "trajectory_digest": normalized_trajectory["trajectory_digest"],
                                "comparison_basis": normalized_trajectory["comparison_basis"],
                                "trajectory": normalized_trajectory["trajectory"],
                                "reason": normalized_trajectory["reason"],
                                "latest_window_id": latest["window_id"],
                                "latest_result_digest": latest["result_digest"],
                            }
                        except Exception as exc:
                            normalized_trajectory = None
                            trajectory = _dimension_invalid("TRAJECTORY_RESULT_INVALID:" + str(exc))

                raw_intervention = agent_quality.get("intervention_result")
                if raw_intervention is not None:
                    if normalized_trajectory is None:
                        intervention = _dimension_invalid("VALID_TRAJECTORY_REQUIRED_FOR_INTERVENTION")
                    else:
                        try:
                            expected = m3.evaluate({"schema": m3.INPUT_SCHEMA, "trajectory": normalized_trajectory})
                            if not isinstance(raw_intervention, Mapping) or dict(raw_intervention) != expected:
                                raise ValueError("intervention result does not equal exact recomputation from trajectory")
                            intervention = {
                                "status": "AVAILABLE",
                                "source_schema": expected["schema"],
                                "source_authority": expected["authority"],
                                "policy_version": expected["policy_version"],
                                "source_trajectory_id": expected["source_trajectory_id"],
                                "source_trajectory_digest": expected["source_trajectory_digest"],
                                "comparison_basis": expected["comparison_basis"],
                                "recommendation": expected["recommendation"],
                                "reason": expected["reason"],
                                "recommendation_digest": expected["recommendation_digest"],
                            }
                        except Exception as exc:
                            intervention = _dimension_invalid("INTERVENTION_RESULT_INVALID:" + str(exc))

    dimensions = {
        "operational": operational,
        "quality": quality,
        "trajectory": trajectory,
        "intervention": intervention,
    }
    return {
        "authority": _AGENT_HEALTH_AUTHORITY,
        "advisory": True,
        **dimensions,
        "read_model_digest": canonical_digest(dimensions),
    }


def percent(value: Fraction) -> int:
    """Display percent: half-up, never 100 unless exactly full, never 0 unless exactly empty."""
    if value <= 0:
        return 0
    if value >= 1:
        return 100
    rounded = int((value * 100 + Fraction(1, 2)) // 1)
    return min(99, max(1, rounded))


def ratio_text(value: Fraction) -> str:
    return f"{value.numerator}/{value.denominator}"


def parse_ref(value: Any) -> tuple[str | None, int]:
    match = _REF.fullmatch(str(value or "").strip())
    if not match:
        raise DelpError(f"invalid issue/PR reference: {value!r}")
    return match.group("repo"), int(match.group("number"))


def ref_number(value: Any) -> int:
    return parse_ref(value)[1]


def same_ref(left: Any, right: Any) -> bool:
    lrepo, lnum = parse_ref(left)
    rrepo, rnum = parse_ref(right)
    if lnum != rnum:
        return False
    if lrepo and rrepo:
        return lrepo.lower().split("/")[-1] == rrepo.lower().split("/")[-1] and (
            "/" not in lrepo or "/" not in rrepo or lrepo.lower() == rrepo.lower()
        )
    return True


def _one_line(value: Any, limit: int = 200) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


# --------------------------------------------------------------------------
# facts: the only thing an agent publishes
# --------------------------------------------------------------------------


def _walk_keys(value: Any, path: str = "") -> Iterable[tuple[str, str]]:
    if isinstance(value, Mapping):
        for key, item in value.items():
            where = f"{path}.{key}" if path else str(key)
            yield where, str(key)
            yield from _walk_keys(item, where)
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            yield from _walk_keys(item, f"{path}[{index}]")


def _walk_strings(value: Any, path: str = "") -> Iterable[tuple[str, str]]:
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, Mapping):
        for key, item in value.items():
            yield from _walk_strings(item, f"{path}.{key}" if path else str(key))
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            yield from _walk_strings(item, f"{path}[{index}]")


def forbidden_fields(facts: Any) -> list[str]:
    """Paths of every agent-authored projection/plan field in a facts record."""
    found = [
        f"{where}: agents publish facts only; '{key}' is derived or plan authority"
        for where, key in _walk_keys(facts)
        if key.lower() in FORBIDDEN_FACT_KEYS
    ]
    found += [
        f"{where}: contains projection notation; titles and P/E/D are derived"
        for where, text in _walk_strings(facts)
        if _NOTATION.search(text)
    ]
    return found


def _check_refs(values: Any, label: str, errors: list[str]) -> None:
    if values is None:
        return
    if not isinstance(values, list) or not all(isinstance(v, str) and v.strip() for v in values):
        errors.append(f"{label}: must be a list of non-empty strings")


def validate_facts(facts: Any) -> list[str]:
    """Return contract violations for one facts record (empty list = acceptable)."""
    if not isinstance(facts, Mapping):
        return ["facts record must be a mapping"]
    errors = forbidden_fields(facts)
    unknown = sorted(set(map(str, facts)) - _ALLOWED_FACT_TOP)
    errors += [
        f"{key}: unknown field (facts carry only {', '.join(sorted(_ALLOWED_FACT_TOP - {'schema'}))})"
        for key in unknown
        if key.lower() not in FORBIDDEN_FACT_KEYS
    ]
    if facts.get("schema") not in (None, FACTS_SCHEMA):
        errors.append(f"schema: must be {FACTS_SCHEMA}")

    responsibility = facts.get("responsibility")
    if not isinstance(responsibility, Mapping) or not responsibility.get("issue"):
        errors.append("responsibility.issue: required")
    else:
        try:
            parse_ref(responsibility["issue"])
        except DelpError as exc:
            errors.append(f"responsibility.issue: {exc}")
        extra = set(map(str, responsibility)) - {"issue", "id"}
        if extra:
            errors.append(f"responsibility: unknown fields {sorted(extra)}")

    material = facts.get("material")
    if not isinstance(material, Mapping) or not _SHA.fullmatch(str(material.get("candidate_sha") or "")):
        errors.append("material.candidate_sha: required 40-hex lowercase candidate commit")
    else:
        if material.get("pr") is not None:
            try:
                parse_ref(material["pr"])
            except DelpError as exc:
                errors.append(f"material.pr: {exc}")
        extra = set(map(str, material)) - {"pr", "candidate_sha", "base_sha"}
        if extra:
            errors.append(f"material: unknown fields {sorted(extra)}")
        if material.get("base_sha") is not None and not _SHA.fullmatch(str(material["base_sha"])):
            errors.append("material.base_sha: must be 40-hex lowercase")

    seen: set[str] = set()
    for index, unit in enumerate(facts.get("units") or []):
        label = f"units[{index}]"
        if not isinstance(unit, Mapping) or not _UNIT_ID.fullmatch(str(unit.get("id") or "")):
            errors.append(f"{label}.id: required unit id")
            continue
        uid = str(unit["id"])
        if uid in seen:
            errors.append(f"{label}.id: duplicate unit {uid} in one record")
        seen.add(uid)
        if unit.get("state") not in UNIT_STATES:
            errors.append(f"{label}.state: one of {sorted(UNIT_STATES)}")
        if unit.get("result") is not None and unit["result"] not in UNIT_RESULTS:
            errors.append(f"{label}.result: one of {sorted(UNIT_RESULTS)}")
        _check_refs(unit.get("evidence_refs"), f"{label}.evidence_refs", errors)
        if unit.get("candidate_sha") is not None and not _SHA.fullmatch(str(unit["candidate_sha"])):
            errors.append(f"{label}.candidate_sha: must be 40-hex lowercase")
        if unit.get("contract_digest") is not None and not _DIGEST.fullmatch(str(unit["contract_digest"])):
            errors.append(f"{label}.contract_digest: must be sha256:<64 hex>")
        extra = set(map(str, unit)) - {"id", "state", "result", "evidence_refs", "candidate_sha", "contract_digest"}
        extra = {key for key in extra if key.lower() not in FORBIDDEN_FACT_KEYS}
        if extra:
            errors.append(f"{label}: unknown fields {sorted(extra)}")

    gate_seen: set[str] = set()
    for index, gate in enumerate(facts.get("gates") or []):
        label = f"gates[{index}]"
        if not isinstance(gate, Mapping) or not _UNIT_ID.fullmatch(str(gate.get("id") or "")):
            errors.append(f"{label}.id: required gate id")
            continue
        gid = str(gate["id"])
        if gid in gate_seen:
            errors.append(f"{label}.id: duplicate gate {gid} in one record")
        gate_seen.add(gid)
        if gate.get("result") not in GATE_RESULTS:
            errors.append(f"{label}.result: one of {sorted(GATE_RESULTS)}")
        _check_refs(gate.get("evidence_refs"), f"{label}.evidence_refs", errors)
        if gate.get("candidate_sha") is not None and not _SHA.fullmatch(str(gate["candidate_sha"])):
            errors.append(f"{label}.candidate_sha: must be 40-hex lowercase")
        extra = set(map(str, gate)) - {"id", "result", "evidence_refs", "candidate_sha"}
        extra = {key for key in extra if key.lower() not in FORBIDDEN_FACT_KEYS}
        if extra:
            errors.append(f"{label}: unknown fields {sorted(extra)}")

    if facts.get("activity") is not None and facts["activity"] not in ACTIVITY_FACTS:
        errors.append(f"activity: one of {sorted(ACTIVITY_FACTS)} (QUIET/STALE are observed, never declared)")

    entry_fact = facts.get("entry")
    if entry_fact is not None:
        if not isinstance(entry_fact, Mapping):
            errors.append("entry: must be a mapping")
        else:
            allowed = {
                "event", "mode", "session_digest", "plan_digest", "child_ref", "child_contract_digest",
                "sequence", "phase_plan_ref", "reconciliation_ref", "previous_leaf_ref",
                "previous_evidence_ref", "evidence_refs",
            }
            extra = set(map(str, entry_fact)) - allowed
            if extra:
                errors.append(f"entry: unknown fields {sorted(extra)}")
            event = entry_fact.get("event")
            if event not in ENTRY_EVENTS:
                errors.append(f"entry.event: one of {sorted(ENTRY_EVENTS)}")
            if entry_fact.get("mode") not in ENTRY_MODES:
                errors.append(f"entry.mode: one of {sorted(ENTRY_MODES)}")
            for key in ("session_digest", "plan_digest"):
                if not _DIGEST.fullmatch(str(entry_fact.get(key) or "")):
                    errors.append(f"entry.{key}: required sha256:<64 hex>")
            contract = entry_fact.get("child_contract_digest")
            if contract is not None and not _DIGEST.fullmatch(str(contract)):
                errors.append("entry.child_contract_digest: sha256:<64 hex> when present")
            for key in ("child_ref", "previous_leaf_ref"):
                value = entry_fact.get(key)
                if value is not None:
                    try:
                        parse_ref(value)
                    except DelpError as exc:
                        errors.append(f"entry.{key}: {exc}")
            if entry_fact.get("child_ref") is None:
                errors.append("entry.child_ref: required")
            sequence = entry_fact.get("sequence")
            if isinstance(sequence, bool) or not isinstance(sequence, int) or sequence < 1:
                errors.append("entry.sequence: positive integer required")
                sequence = None
            _check_refs(entry_fact.get("evidence_refs"), "entry.evidence_refs", errors)
            if not entry_fact.get("evidence_refs"):
                errors.append("entry.evidence_refs: at least one durable evidence ref required")
            if event == "PREPARED":
                for key in ("phase_plan_ref", "reconciliation_ref"):
                    value = entry_fact.get(key)
                    if not isinstance(value, str) or not value.strip():
                        errors.append(f"entry.{key}: non-empty string required for PREPARED")
            for key in ("phase_plan_ref", "reconciliation_ref", "previous_evidence_ref"):
                value = entry_fact.get(key)
                if value is not None and (not isinstance(value, str) or not value.strip()):
                    errors.append(f"entry.{key}: non-empty string when present")
            previous_leaf = entry_fact.get("previous_leaf_ref")
            previous_evidence = entry_fact.get("previous_evidence_ref")
            if sequence is not None and sequence > 1 and (not previous_leaf or not previous_evidence):
                errors.append("entry: sequence >1 requires previous_leaf_ref and previous_evidence_ref")
            if sequence == 1 and (previous_leaf is not None or previous_evidence is not None):
                errors.append("entry: sequence 1 cannot carry previous entry linkage")

    nxt = facts.get("next")
    if nxt is not None:
        if not isinstance(nxt, Mapping) or set(map(str, nxt)) - {"unit", "action"}:
            errors.append("next: mapping with only 'unit' and 'action'")
        else:
            if nxt.get("unit") is not None and not _UNIT_ID.fullmatch(str(nxt["unit"])):
                errors.append("next.unit: invalid unit id")
            if nxt.get("action") is not None and (
                not isinstance(nxt["action"], str) or len(nxt["action"]) > 200 or "\n" in nxt["action"]
            ):
                errors.append("next.action: single line, at most 200 characters")
    for key in ("blocker", "owner_action"):
        value = facts.get(key)
        if value is not None and (not isinstance(value, str) or len(value) > 200 or "\n" in value):
            errors.append(f"{key}: single line, at most 200 characters")

    handover = facts.get("handover")
    if handover is not None:
        if not isinstance(handover, Mapping):
            errors.append("handover: must be a mapping")
        else:
            extra = set(map(str, handover)) - {
                "event", "mode", "predecessor_ref", "frontier_digest", "decision_at_risk", "result",
                "challenge_digest", "question_ids", "answer_evidence", "root_classification",
            }
            if extra:
                errors.append(f"handover: unknown fields {sorted(extra)}")
            event = handover.get("event")
            mode = handover.get("mode")
            if event not in HANDOVER_EVENTS:
                errors.append(f"handover.event: one of {sorted(HANDOVER_EVENTS)}")
            if mode not in HANDOVER_MODES:
                errors.append(f"handover.mode: one of {sorted(HANDOVER_MODES)}")
            digest = handover.get("frontier_digest")
            if not _DIGEST.fullmatch(str(digest or "")):
                errors.append("handover.frontier_digest: required sha256:<64 hex>")
            decision = handover.get("decision_at_risk")
            if not isinstance(decision, str) or not decision.strip() or len(decision) > 200 or "\n" in decision:
                errors.append("handover.decision_at_risk: single non-empty line, at most 200 characters")
            predecessor = handover.get("predecessor_ref")
            if predecessor is not None and (not isinstance(predecessor, str) or not predecessor.strip()):
                errors.append("handover.predecessor_ref: non-empty string when present")
            hresult = handover.get("result")
            if hresult is not None and hresult not in HANDOVER_RESULTS:
                errors.append(f"handover.result: one of {sorted(HANDOVER_RESULTS)}")

            challenge_digest = handover.get("challenge_digest")
            if challenge_digest is not None and not _DIGEST.fullmatch(str(challenge_digest)):
                errors.append("handover.challenge_digest: sha256:<64 hex> when present")
            question_ids = handover.get("question_ids")
            if question_ids is not None:
                if (
                    not isinstance(question_ids, list)
                    or not question_ids
                    or not all(isinstance(q, str) and re.fullmatch(r"Q[1-9][0-9]*", q) for q in question_ids)
                    or len(question_ids) != len(set(question_ids))
                ):
                    errors.append("handover.question_ids: non-empty unique Q<n> list when present")

            answer_evidence = handover.get("answer_evidence")
            answer_ids: list[str] = []
            if answer_evidence is not None:
                if not isinstance(answer_evidence, list) or not answer_evidence:
                    errors.append("handover.answer_evidence: non-empty array when present")
                else:
                    for index, answer in enumerate(answer_evidence):
                        label = f"handover.answer_evidence[{index}]"
                        if not isinstance(answer, Mapping):
                            errors.append(f"{label}: must be a mapping")
                            continue
                        extra_answer = set(map(str, answer)) - {
                            "question_id", "evidence_refs", "live_refs", "evidence_summary", "authority_classifications"
                        }
                        if extra_answer:
                            errors.append(f"{label}: unknown fields {sorted(extra_answer)}")
                        qid = answer.get("question_id")
                        if not isinstance(qid, str) or not re.fullmatch(r"Q[1-9][0-9]*", qid):
                            errors.append(f"{label}.question_id: required Q<n>")
                        else:
                            answer_ids.append(qid)
                        _check_refs(answer.get("evidence_refs"), f"{label}.evidence_refs", errors)
                        if not answer.get("evidence_refs"):
                            errors.append(f"{label}.evidence_refs: at least one durable evidence ref required")
                        live_refs = answer.get("live_refs")
                        if not isinstance(live_refs, list) or not live_refs:
                            errors.append(f"{label}.live_refs: at least one live repository/provider ref required")
                        else:
                            for live_index, live in enumerate(live_refs):
                                live_label = f"{label}.live_refs[{live_index}]"
                                if not isinstance(live, Mapping) or set(map(str, live)) - {"kind", "ref"}:
                                    errors.append(f"{live_label}: mapping with only kind/ref")
                                    continue
                                kind, ref = live.get("kind"), live.get("ref")
                                if kind not in {"REPOSITORY", "PROVIDER"}:
                                    errors.append(f"{live_label}.kind: REPOSITORY or PROVIDER")
                                if not isinstance(ref, str) or not ref.strip():
                                    errors.append(f"{live_label}.ref: non-empty string required")
                                elif kind == "REPOSITORY" and not re.match(r"^(?:path|function|commit|blob|tree):\S+", ref):
                                    errors.append(f"{live_label}.ref: repository live ref must start path:/function:/commit:/blob:/tree:")
                                elif kind == "PROVIDER" and not re.match(r"^(?:provider|pr|branch|commit):\S+", ref):
                                    errors.append(f"{live_label}.ref: provider live ref must start provider:/pr:/branch:/commit:")
                        summary = answer.get("evidence_summary")
                        if not isinstance(summary, str) or len(summary.strip()) < 20 or len(summary) > 1000:
                            errors.append(f"{label}.evidence_summary: 20..1000 characters required")
                        classes = answer.get("authority_classifications")
                        if classes is not None and (
                            not isinstance(classes, list)
                            or not classes
                            or len(classes) != len(set(classes))
                            or any(value not in HANDOVER_AUTHORITY_CLASSES for value in classes)
                        ):
                            errors.append(f"{label}.authority_classifications: unique values from {sorted(HANDOVER_AUTHORITY_CLASSES)}")
                    if len(answer_ids) != len(set(answer_ids)):
                        errors.append("handover.answer_evidence: duplicate question_id")

            root = handover.get("root_classification")
            if root is not None:
                if not isinstance(root, Mapping):
                    errors.append("handover.root_classification: must be a mapping")
                else:
                    allowed_root = {
                        "classification", "owning_layer", "upstream_boundary",
                        "downstream_boundary", "proof_required", "evidence_refs",
                    }
                    extra_root = set(map(str, root)) - allowed_root
                    if extra_root:
                        errors.append(f"handover.root_classification: unknown fields {sorted(extra_root)}")
                    for key in ("classification", "owning_layer", "upstream_boundary", "downstream_boundary", "proof_required"):
                        value = root.get(key)
                        if not isinstance(value, str) or not value.strip() or len(value) > 500:
                            errors.append(f"handover.root_classification.{key}: non-empty string up to 500 characters")
                    _check_refs(root.get("evidence_refs"), "handover.root_classification.evidence_refs", errors)
                    if not root.get("evidence_refs"):
                        errors.append("handover.root_classification.evidence_refs: at least one durable evidence ref required")

            if event == "OFFERED":
                if hresult is not None:
                    errors.append("handover.result: OFFERED cannot carry a successor result")
                if answer_evidence is not None or root is not None:
                    errors.append("handover: OFFERED cannot carry successor answer evidence/root classification")
                if challenge_digest is not None and not question_ids:
                    errors.append("handover.question_ids: required when OFFERED carries challenge_digest")
                if question_ids is not None and challenge_digest is None:
                    errors.append("handover.challenge_digest: required when OFFERED carries question_ids")
            if event == "ACCEPTED":
                if not predecessor:
                    errors.append("handover.predecessor_ref: required for ACCEPTED")
                if question_ids is not None:
                    errors.append("handover.question_ids: ACCEPTED must use the predecessor OFFERED question set")
                if (answer_evidence is not None or root is not None) and challenge_digest is None:
                    errors.append("handover.challenge_digest: required when ACCEPTED carries challenge evidence")
                if hresult == "RECONCILED" and challenge_digest is not None:
                    if not answer_evidence:
                        errors.append("handover.answer_evidence: required for challenged RECONCILED acceptance")
                    if root is None:
                        errors.append("handover.root_classification: required for challenged RECONCILED acceptance")

    result = facts.get("result")
    if result is not None:
        if not isinstance(result, Mapping) or result.get("scope") not in RESULT_SCOPES:
            errors.append(f"result.scope: one of {sorted(RESULT_SCOPES)}")
        else:
            complete = result.get("responsibility_complete", "UNKNOWN")
            if complete not in COMPLETE_VALUES:
                errors.append(f"result.responsibility_complete: one of {sorted(COMPLETE_VALUES)}")
            if complete == "YES" and result["scope"] != "RESPONSIBILITY":
                errors.append("result: complete YES requires RESPONSIBILITY scope")
            if result.get("superseded_by") is not None:
                try:
                    parse_ref(result["superseded_by"])
                except DelpError as exc:
                    errors.append(f"result.superseded_by: {exc}")
            extra = set(map(str, result)) - {"scope", "responsibility_complete", "superseded_by"}
            if extra:
                errors.append(f"result: unknown fields {sorted(extra)}")
    return errors


def require_facts(facts: Any) -> dict[str, Any]:
    errors = validate_facts(facts)
    if errors:
        if any("agents publish facts only" in e or "projection notation" in e for e in errors):
            raise ForbiddenProjectionField("; ".join(errors))
        raise DelpError("; ".join(errors))
    return dict(facts)


_FENCE = re.compile(
    r"```[ \t]*(?:ya?ml)?[ \t]*\r?\n(?P<body>[ \t]*" + FACTS_KEY + r":.*?)\r?\n```",
    re.DOTALL,
)


def extract_facts_blocks(text: str) -> list[dict[str, Any]]:
    """Parse every CHECKPOINT_FACTS_V1 fenced block found in a comment body."""
    try:
        import yaml  # type: ignore
    except ImportError as exc:  # pragma: no cover - environment dependent
        raise DelpError("PyYAML is required to parse CHECKPOINT_FACTS_V1 blocks") from exc
    blocks: list[dict[str, Any]] = []
    for match in _FENCE.finditer(str(text or "")):
        document = yaml.safe_load(match.group("body"))
        body = (document or {}).get(FACTS_KEY)
        if not isinstance(body, Mapping):
            raise DelpError(f"{FACTS_KEY} block must be a mapping")
        facts = dict(body)
        facts.setdefault("schema", FACTS_SCHEMA)
        blocks.append(facts)
    return blocks


# --------------------------------------------------------------------------
# graph: the Coordinator's plan (denominators and lineage live here only)
# --------------------------------------------------------------------------


def _positive_int(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise GraphError(f"{label}: must be a positive integer")
    return value


def _str_list(value: Any, label: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(v, str) and v.strip() for v in value):
        raise GraphError(f"{label}: must be a list of non-empty strings")
    return [v.strip() for v in value]


def _ref_list(value: Any, label: str) -> list[str]:
    refs = _str_list(value, label)
    for item in refs:
        try:
            parse_ref(item)
        except DelpError as exc:
            raise GraphError(f"{label}: {exc}") from exc
    return refs


def _size_budget(value: Any, ref: str) -> dict[str, int] | None:
    if value is None:
        return None
    if not isinstance(value, Mapping):
        raise GraphError(f"{ref}.size_budget: must be a mapping")
    unknown = sorted(set(map(str, value)) - set(_BUDGET_KEYS))
    if unknown:
        raise GraphError(f"{ref}.size_budget: unknown keys {unknown} (allowed: {list(_BUDGET_KEYS)})")
    return {str(k): _positive_int(v, f"{ref}.size_budget.{k}") for k, v in value.items()}


def _write_surface(value: Any, ref: str) -> list[str]:
    """Repo-relative file paths or directory prefixes (trailing '/'); globs are rejected so overlap stays decidable."""
    entries = _str_list(value, f"{ref}.write_surface")
    clean = []
    for entry in entries:
        text = entry[2:] if entry.startswith("./") else entry
        segments = [s for s in text.split("/") if s != ""]
        if not segments or text.startswith("/") or "//" in text or ".." in segments or "." in segments or _SURFACE_GLOB.search(text):
            raise GraphError(
                f"{ref}.write_surface: {entry!r} must be a repo-relative file path or a directory prefix ending in '/' "
                "(no globs, no '..', no absolute paths)"
            )
        clean.append(text)
    return sorted(set(clean))


def _surface_overlap(left: list[str], right: list[str]) -> list[str]:
    """Entries on which two write surfaces collide (the more specific side is reported)."""
    hits = set()
    for a in left:
        for b in right:
            if a == b or (a.endswith("/") and b.startswith(a)) or (b.endswith("/") and a.startswith(b)):
                hits.add(a if len(a) >= len(b) else b)
    return sorted(hits)


def _item_key(value: Any, label: str) -> tuple[int, str]:
    match = _ITEM_KEY.fullmatch(str(value or "").strip())
    if not match:
        raise GraphError(f"{label}: {value!r} must be '<leaf ref>:<unit id>' or '<leaf ref>:gate:<gate id>'")
    try:
        return ref_number(match.group("ref")), match.group("item")
    except DelpError as exc:
        raise GraphError(f"{label}: {exc}") from exc


def _plan_updates(value: Any) -> list[dict[str, Any]]:
    """Plan updates are the append-only record of deliberate scope/weight/policy changes."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise GraphError("plan_updates: must be a list")
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for index, raw in enumerate(value):
        where = f"plan_updates[{index}]"
        if not isinstance(raw, Mapping):
            raise GraphError(f"{where}: must be a mapping")
        pid = str(raw.get("id") or "").strip()
        if not pid or pid in seen:
            raise GraphError(f"{where}.id: required and unique")
        seen.add(pid)
        kind = raw.get("kind")
        if kind not in PLAN_UPDATE_KINDS:
            raise GraphError(f"{where}.kind: one of {list(PLAN_UPDATE_KINDS)}")
        reason = str(raw.get("reason") or "").strip()
        if not reason:
            raise GraphError(f"{where}.reason: required")
        owner_authorized = raw.get("owner_authorized", False)
        if not isinstance(owner_authorized, bool):
            raise GraphError(f"{where}.owner_authorized: must be a boolean")
        unit_keys = [_item_key(v, f"{where}.units") for v in _str_list(raw.get("units"), f"{where}.units")]
        try:
            node_numbers = [ref_number(v) for v in _str_list(raw.get("nodes"), f"{where}.nodes")]
        except DelpError as exc:
            raise GraphError(f"{where}.nodes: {exc}") from exc
        if kind != "POLICY_CHANGE" and not unit_keys and not node_numbers:
            raise GraphError(f"{where}: name the units and/or nodes the update covers")
        rows.append(
            {
                "id": pid,
                "kind": kind,
                "reason": reason,
                "owner_authorized": owner_authorized,
                "owner_basis": str(raw.get("owner_basis") or "").strip(),
                "unit_keys": unit_keys,
                "node_numbers": node_numbers,
                "raw": canonical_json(raw),
            }
        )
    return rows


def _decomposition_proposal(value: Any) -> dict[str, Any] | None:
    """Normalize the pre-materialization proposal layer. Provider child refs are intentionally absent."""
    if value is None:
        return None
    if not isinstance(value, Mapping):
        raise GraphError("programme.decomposition_proposal: must be a mapping")
    allowed_top = {
        "version", "responsibilities", "released_proposal_digest", "bindings",
        "delivery_gate_weight_exception_basis",
    }
    if set(map(str, value)) - allowed_top or not {"version", "responsibilities"}.issubset(set(map(str, value))):
        raise GraphError("programme.decomposition_proposal: version/responsibilities plus optional release/bindings fields only")
    if value.get("version") != "V2":
        raise GraphError("programme.decomposition_proposal.version: must be V2")
    raw_rows = value.get("responsibilities")
    if not isinstance(raw_rows, list) or not raw_rows:
        raise GraphError("programme.decomposition_proposal.responsibilities: non-empty array required")
    released_digest = value.get("released_proposal_digest")
    if released_digest is not None and not _DIGEST.fullmatch(str(released_digest)):
        raise GraphError("programme.decomposition_proposal.released_proposal_digest: must be sha256:<64 hex>")
    gate_weight_basis = value.get("delivery_gate_weight_exception_basis")
    if gate_weight_basis is not None and (not isinstance(gate_weight_basis, str) or not gate_weight_basis.strip()):
        raise GraphError("programme.decomposition_proposal.delivery_gate_weight_exception_basis: non-empty string required")
    raw_bindings = value.get("bindings") or []
    if not isinstance(raw_bindings, list):
        raise GraphError("programme.decomposition_proposal.bindings: must be an array")
    bindings: list[dict[str, str]] = []
    seen_binding_ids: set[str] = set()
    seen_binding_refs: set[int] = set()
    for index, binding in enumerate(raw_bindings):
        where = f"programme.decomposition_proposal.bindings[{index}]"
        if not isinstance(binding, Mapping) or set(map(str, binding)) != {"responsibility_id", "ref"}:
            raise GraphError(f"{where}: exact responsibility_id/ref mapping required")
        rid = str(binding.get("responsibility_id") or "")
        if not _UNIT_ID.fullmatch(rid) or rid in seen_binding_ids:
            raise GraphError(f"{where}.responsibility_id: invalid or duplicate responsibility id {rid!r}")
        try:
            number = ref_number(binding.get("ref"))
        except DelpError as exc:
            raise GraphError(f"{where}.ref: {exc}") from exc
        if number in seen_binding_refs:
            raise GraphError(f"{where}.ref: duplicate provider binding")
        seen_binding_ids.add(rid)
        seen_binding_refs.add(number)
        bindings.append({"responsibility_id": rid, "ref": str(binding["ref"])})

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, raw in enumerate(raw_rows):
        where = f"programme.decomposition_proposal.responsibilities[{index}]"
        required = {
            "id", "work_class", "owns_claims", "claim_allocations", "outcome", "independence_basis",
            "semantic_units", "size_budget", "write_surface", "acceptance_methods",
        }
        allowed = required | {"mechanism_exception", "depends_on", "parallel_ok", "parallel_ok_basis"}
        if not isinstance(raw, Mapping) or not required.issubset(set(map(str, raw))) or set(map(str, raw)) - allowed:
            raise GraphError(f"{where}: exact pre-materialization responsibility fields required")
        rid = str(raw.get("id") or "")
        if not _UNIT_ID.fullmatch(rid) or rid in seen:
            raise GraphError(f"{where}.id: invalid or duplicate responsibility id {rid!r}")
        seen.add(rid)
        work_class = raw.get("work_class")
        if work_class not in WORK_CLASSES:
            raise GraphError(f"{where}.work_class: one of {list(WORK_CLASSES)}")
        owns_claims = _str_list(raw.get("owns_claims"), f"{where}.owns_claims")
        if not owns_claims or len(owns_claims) != len(set(owns_claims)) or any(not _UNIT_ID.fullmatch(cid) for cid in owns_claims):
            raise GraphError(f"{where}.owns_claims: non-empty unique claim ids required")
        raw_allocations = raw.get("claim_allocations")
        if not isinstance(raw_allocations, list) or not raw_allocations:
            raise GraphError(f"{where}.claim_allocations: non-empty array required")
        allocations: list[dict[str, Any]] = []
        seen_allocations: set[str] = set()
        for allocation_index, allocation in enumerate(raw_allocations):
            awhere = f"{where}.claim_allocations[{allocation_index}]"
            if not isinstance(allocation, Mapping) or set(map(str, allocation)) != {"claim_id", "weight"}:
                raise GraphError(f"{awhere}: exact claim_id/weight mapping required")
            claim_id = str(allocation.get("claim_id") or "")
            if not _UNIT_ID.fullmatch(claim_id) or claim_id in seen_allocations:
                raise GraphError(f"{awhere}.claim_id: invalid or duplicate claim id {claim_id!r}")
            seen_allocations.add(claim_id)
            allocations.append({"claim_id": claim_id, "weight": _positive_int(allocation.get("weight"), f"{awhere}.weight")})
        if set(seen_allocations) != set(owns_claims):
            raise GraphError(f"{where}.claim_allocations: claim ids must exactly match owns_claims")

        size_budget = _size_budget(raw.get("size_budget"), where)
        write_surface = _write_surface(raw.get("write_surface"), where)
        acceptance_methods = _str_list(raw.get("acceptance_methods"), f"{where}.acceptance_methods")
        if not acceptance_methods or len(acceptance_methods) != len(set(acceptance_methods)):
            raise GraphError(f"{where}.acceptance_methods: non-empty unique strings required")
        depends_on = _str_list(raw.get("depends_on"), f"{where}.depends_on")
        parallel_ok = _str_list(raw.get("parallel_ok"), f"{where}.parallel_ok")
        for field, values in (("depends_on", depends_on), ("parallel_ok", parallel_ok)):
            if any(not _UNIT_ID.fullmatch(value) for value in values) or len(values) != len(set(values)):
                raise GraphError(f"{where}.{field}: unique responsibility ids required")
            if rid in values:
                raise GraphError(f"{where}.{field}: responsibility cannot reference itself")
        parallel_basis = raw.get("parallel_ok_basis")
        if parallel_basis is not None and (not isinstance(parallel_basis, str) or not parallel_basis.strip()):
            raise GraphError(f"{where}.parallel_ok_basis: non-empty string required when present")

        outcome = raw.get("outcome")
        basis = raw.get("independence_basis")
        if not isinstance(outcome, str) or not outcome.strip():
            raise GraphError(f"{where}.outcome: non-empty string required")
        if not isinstance(basis, str) or not basis.strip():
            raise GraphError(f"{where}.independence_basis: non-empty string required")
        raw_units = raw.get("semantic_units")
        if not isinstance(raw_units, list) or not raw_units:
            raise GraphError(f"{where}.semantic_units: non-empty array required")
        units: list[dict[str, str]] = []
        seen_units: set[str] = set()
        for unit_index, unit in enumerate(raw_units):
            uwhere = f"{where}.semantic_units[{unit_index}]"
            if not isinstance(unit, Mapping) or set(map(str, unit)) != {"id", "kind", "weight", "outcome", "verify"}:
                raise GraphError(f"{uwhere}: exact id/kind/weight/outcome/verify fields required")
            uid = str(unit.get("id") or "")
            if not _UNIT_ID.fullmatch(uid) or uid in seen_units:
                raise GraphError(f"{uwhere}.id: invalid or duplicate unit id {uid!r}")
            seen_units.add(uid)
            kind = unit.get("kind")
            if kind not in {"SEMANTIC", "DELIVERY_GATE", "MECHANICAL"}:
                raise GraphError(f"{uwhere}.kind: SEMANTIC, DELIVERY_GATE or MECHANICAL required")
            unit_outcome = unit.get("outcome")
            verify = unit.get("verify")
            if not isinstance(unit_outcome, str) or not unit_outcome.strip():
                raise GraphError(f"{uwhere}.outcome: non-empty string required")
            if not isinstance(verify, str) or not verify.strip():
                raise GraphError(f"{uwhere}.verify: non-empty string required")
            units.append(
                {
                    "id": uid,
                    "kind": kind,
                    "weight": _positive_int(unit.get("weight"), f"{uwhere}.weight"),
                    "outcome": unit_outcome.strip(),
                    "verify": verify.strip(),
                }
            )
        mechanism_exception = raw.get("mechanism_exception")
        clean_exception = None
        if mechanism_exception is not None:
            if not isinstance(mechanism_exception, Mapping) or set(map(str, mechanism_exception)) != {"basis", "claim_ids"}:
                raise GraphError(f"{where}.mechanism_exception: exact basis/claim_ids mapping required")
            exception_basis = mechanism_exception.get("basis")
            exception_claims = _str_list(mechanism_exception.get("claim_ids"), f"{where}.mechanism_exception.claim_ids")
            if not isinstance(exception_basis, str) or not exception_basis.strip() or not exception_claims:
                raise GraphError(f"{where}.mechanism_exception: non-empty basis and claim_ids required")
            if any(not _UNIT_ID.fullmatch(cid) for cid in exception_claims) or len(exception_claims) != len(set(exception_claims)):
                raise GraphError(f"{where}.mechanism_exception.claim_ids: unique claim ids required")
            clean_exception = {"basis": exception_basis.strip(), "claim_ids": sorted(exception_claims)}
        rows.append(
            {
                "id": rid,
                "work_class": work_class,
                "owns_claims": sorted(owns_claims),
                "claim_allocations": sorted(allocations, key=lambda row: row["claim_id"]),
                "outcome": outcome.strip(),
                "independence_basis": basis.strip(),
                "mechanism_exception": clean_exception,
                "size_budget": size_budget,
                "write_surface": write_surface,
                "acceptance_methods": sorted(acceptance_methods),
                "depends_on": sorted(depends_on),
                "parallel_ok": sorted(parallel_ok),
                "parallel_ok_basis": parallel_basis.strip() if isinstance(parallel_basis, str) else None,
                "semantic_units": units,
            }
        )
    proposal_ids = {row["id"] for row in rows}
    for row in rows:
        for field in ("depends_on", "parallel_ok"):
            unknown = sorted(set(row[field]) - proposal_ids)
            if unknown:
                raise GraphError(
                    f"programme.decomposition_proposal.{row['id']}.{field}: unknown responsibility id(s) {_id_list(unknown)}"
                )
    walk_state: dict[str, int] = {}
    by_id = {row["id"]: row for row in rows}

    def walk(rid: str) -> None:
        walk_state[rid] = 1
        for dep in by_id[rid]["depends_on"]:
            if walk_state.get(dep) == 1:
                raise GraphError(f"programme.decomposition_proposal.depends_on cycle through {rid} and {dep}")
            if dep not in walk_state:
                walk(dep)
        walk_state[rid] = 2

    for rid in proposal_ids:
        if rid not in walk_state:
            walk(rid)

    unknown_bindings = sorted(set(seen_binding_ids) - proposal_ids)
    if unknown_bindings:
        raise GraphError(
            f"programme.decomposition_proposal.bindings: unknown responsibility id(s) {_id_list(unknown_bindings)}"
        )
    return {
        "version": "V2",
        "released_proposal_digest": str(released_digest) if released_digest is not None else None,
        "delivery_gate_weight_exception_basis": gate_weight_basis.strip() if isinstance(gate_weight_basis, str) else None,
        "bindings": bindings,
        "responsibilities": rows,
    }

def _acceptance_claims(value: Any) -> list[dict[str, Any]]:
    """Normalize parent acceptance claims. Claims describe outcomes; leaves own them."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise GraphError("programme.acceptance_claims: must be an array")
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, raw in enumerate(value):
        where = f"programme.acceptance_claims[{index}]"
        if not isinstance(raw, Mapping):
            raise GraphError(f"{where}: must be a mapping")
        allowed = {"id", "claim", "kind", "weight", "shared", "mechanism_exception_allowed"}
        extra = sorted(set(map(str, raw)) - allowed)
        if extra:
            raise GraphError(f"{where}: unknown fields {extra}")
        cid = str(raw.get("id") or "")
        if not _UNIT_ID.fullmatch(cid) or cid in seen:
            raise GraphError(f"{where}.id: invalid or duplicate claim id {cid!r}")
        claim = raw.get("claim")
        if not isinstance(claim, str) or not claim.strip():
            raise GraphError(f"{where}.claim: must be a non-empty string")
        kind = raw.get("kind")
        if kind not in CLAIM_KINDS:
            raise GraphError(f"{where}.kind: one of {list(CLAIM_KINDS)}")
        shared = raw.get("shared", False)
        if not isinstance(shared, bool):
            raise GraphError(f"{where}.shared: must be boolean")
        weight = raw.get("weight")
        if weight is not None:
            weight = _positive_int(weight, f"{where}.weight")
        mechanism_exception_allowed = raw.get("mechanism_exception_allowed", False)
        if not isinstance(mechanism_exception_allowed, bool):
            raise GraphError(f"{where}.mechanism_exception_allowed: must be boolean")
        seen.add(cid)
        rows.append(
            {
                "id": cid,
                "claim": claim.strip(),
                "kind": kind,
                "weight": weight,
                "shared": shared,
                "mechanism_exception_allowed": mechanism_exception_allowed,
            }
        )
    return rows


def resolve_policy(overrides: Any) -> dict[str, Any]:
    """Merge `programme.decomposition_policy` over the defaults and validate it. Raises GraphError."""
    policy = copy.deepcopy(DEFAULT_POLICY)
    if overrides is None:
        return policy
    if not isinstance(overrides, Mapping):
        raise GraphError("programme.decomposition_policy: must be a mapping")
    unknown = sorted(set(map(str, overrides)) - set(DEFAULT_POLICY))
    if unknown:
        raise GraphError(f"programme.decomposition_policy: unknown keys {unknown}")
    for key, value in overrides.items():
        if key == "mode":
            if value not in POLICY_MODES:
                raise GraphError(f"programme.decomposition_policy.mode: one of {list(POLICY_MODES)}")
            policy["mode"] = value
        elif key in ("units", "leaf_budget", "require", "claim_first"):
            if not isinstance(value, Mapping):
                raise GraphError(f"programme.decomposition_policy.{key}: must be a mapping")
            extra = sorted(set(map(str, value)) - set(policy[key]))
            if extra:
                raise GraphError(f"programme.decomposition_policy.{key}: unknown keys {extra}")
            policy[key].update(value)
        else:
            policy[key] = value
    units, budget = policy["units"], policy["leaf_budget"]
    for label, mapping in (("units", units), ("leaf_budget", budget)):
        for k, v in mapping.items():
            _positive_int(v, f"programme.decomposition_policy.{label}.{k}")
    if units["min"] > units["max"]:
        raise GraphError("programme.decomposition_policy.units: min must not exceed max")
    if units["max_share_percent"] > 100:
        raise GraphError("programme.decomposition_policy.units.max_share_percent: at most 100")
    if budget["target_loc"] > budget["hard_loc"] or budget["target_minutes"] > budget["hard_minutes"]:
        raise GraphError("programme.decomposition_policy.leaf_budget: target must not exceed hard")
    nano = policy["min_leaf_target_loc"]
    if isinstance(nano, bool) or not isinstance(nano, int) or nano < 0:
        raise GraphError("programme.decomposition_policy.min_leaf_target_loc: must be a non-negative integer")
    if not all(isinstance(v, bool) for v in policy["require"].values()):
        raise GraphError("programme.decomposition_policy.require: values must be booleans")
    claim_first = policy["claim_first"]
    if claim_first["mode"] not in POLICY_MODES:
        raise GraphError(f"programme.decomposition_policy.claim_first.mode: one of {list(POLICY_MODES)}")
    if not isinstance(claim_first["require_independence_basis"], bool):
        raise GraphError("programme.decomposition_policy.claim_first.require_independence_basis: must be boolean")
    return policy


def resolve_health_policy(overrides: Any) -> dict[str, Any]:
    """Merge `programme.health_policy` over the defaults and validate it. Raises GraphError."""
    policy = copy.deepcopy(DEFAULT_HEALTH_POLICY)
    if overrides is None:
        return policy
    if not isinstance(overrides, Mapping):
        raise GraphError("programme.health_policy: must be a mapping")
    unknown = sorted(set(map(str, overrides)) - set(DEFAULT_HEALTH_POLICY))
    if unknown:
        raise GraphError(f"programme.health_policy: unknown keys {unknown}")
    for key, value in overrides.items():
        if key == "mode":
            if value not in HEALTH_MODES:
                raise GraphError(f"programme.health_policy.mode: one of {list(HEALTH_MODES)}")
            policy["mode"] = value
            continue
        if not isinstance(value, Mapping):
            raise GraphError(f"programme.health_policy.{key}: must be a mapping")
        extra = sorted(set(map(str, value)) - set(policy[key]))
        if extra:
            raise GraphError(f"programme.health_policy.{key}: unknown keys {extra}")
        policy[key].update(value)
    for section in ("checkpoint", "drift", "interruptions"):
        for name, number in policy[section].items():
            _positive_int(number, f"programme.health_policy.{section}.{name}")
    c, d, i = policy["checkpoint"], policy["drift"], policy["interruptions"]
    if c["watch_added_loc"] > c["at_risk_added_loc"] or c["watch_changed_loc"] > c["at_risk_changed_loc"]:
        raise GraphError("programme.health_policy.checkpoint: a watch level must not exceed its at-risk level")
    if d["watch_behind"] > d["at_risk_behind"] or i["watch"] > i["at_risk"]:
        raise GraphError("programme.health_policy: a watch level must not exceed its at-risk level")
    return policy


def validate_graph(graph: Any) -> dict[str, Any]:
    """Validate the plan and return an indexed view. Raises GraphError."""
    if not isinstance(graph, Mapping):
        raise GraphError("graph must be a mapping")
    if graph.get("schema") not in (None, GRAPH_SCHEMA):
        raise GraphError(f"schema: must be {GRAPH_SCHEMA}")
    programme = graph.get("programme") or {}
    root_ref = programme.get("root")
    if not root_ref:
        raise GraphError("programme.root: required")
    try:
        parse_ref(root_ref)
    except DelpError as exc:
        raise GraphError(f"programme.root: {exc}") from exc
    policy = resolve_policy(programme.get("decomposition_policy"))
    health_policy = resolve_health_policy(programme.get("health_policy"))
    acceptance_claims = _acceptance_claims(programme.get("acceptance_claims"))
    claims_by_id = {row["id"]: row for row in acceptance_claims}
    decomposition_proposal = _decomposition_proposal(programme.get("decomposition_proposal"))
    total_weight = _positive_int(programme.get("total_weight", DEFAULT_TOTAL_WEIGHT), "programme.total_weight")
    base_ref = programme.get("base_ref")
    if base_ref is not None and (not isinstance(base_ref, str) or not base_ref.strip()):
        raise GraphError("programme.base_ref: must be a non-empty branch name")

    nodes: dict[str, dict[str, Any]] = {}
    by_number: dict[int, str] = {}
    order: list[str] = []
    for raw in graph.get("nodes") or []:
        if not isinstance(raw, Mapping):
            raise GraphError("nodes[]: must be mappings")
        ref = str(raw.get("ref") or "")
        try:
            number = ref_number(ref)
        except DelpError as exc:
            raise GraphError(f"nodes[].ref: {exc}") from exc
        if number in by_number:
            raise GraphError(f"duplicate node {ref}")
        kind = raw.get("kind")
        if kind not in NODE_KINDS:
            raise GraphError(f"{ref}.kind: one of {sorted(NODE_KINDS)}")
        node = {
            "ref": ref,
            "number": number,
            "kind": kind,
            "parent": raw.get("parent"),
            "weight": None,
            "reserve_weight": 0,
            "children": [],
        }
        if kind != "ROOT":
            if not raw.get("parent"):
                raise GraphError(f"{ref}.parent: required")
            node["weight"] = _positive_int(raw.get("weight"), f"{ref}.weight")
        elif raw.get("parent"):
            raise GraphError(f"{ref}: ROOT cannot have a parent")
        reserve = raw.get("reserve_weight", 0)
        if kind == "LEAF" and reserve:
            raise GraphError(f"{ref}: reserve_weight is only valid on ROOT/INTERMEDIATE nodes")
        if isinstance(reserve, bool) or not isinstance(reserve, int) or reserve < 0:
            raise GraphError(f"{ref}.reserve_weight: must be a non-negative integer")
        node["reserve_weight"] = reserve
        if kind == "LEAF":
            units = raw.get("units")
            if not isinstance(units, list) or not units:
                raise GraphError(f"{ref}.units: at least one declared unit with a weight is required")
            seen_units: set[str] = set()
            clean_units = []
            for unit in units:
                if not isinstance(unit, Mapping):
                    raise GraphError(f"{ref}.units: every unit must be a mapping")
                uid = str(unit.get("id") or "")
                if not _UNIT_ID.fullmatch(uid) or uid in seen_units:
                    raise GraphError(f"{ref}.units: invalid or duplicate unit id {uid!r}")
                seen_units.add(uid)
                moved_from = unit.get("moved_from")
                if moved_from is not None:
                    try:
                        parse_ref(moved_from)
                    except DelpError as exc:
                        raise GraphError(f"{ref}.units.{uid}.moved_from: {exc}") from exc
                texts = {}
                for text_key in ("verify", "outcome"):
                    if unit.get(text_key) is not None and not isinstance(unit[text_key], str):
                        raise GraphError(f"{ref}.units.{uid}.{text_key}: must be a string")
                    texts[text_key] = str(unit.get(text_key) or "").strip() or None
                successor_policy = unit.get("successor_policy")
                clean_successor_policy = None
                if successor_policy is not None:
                    if not isinstance(successor_policy, Mapping):
                        raise GraphError(f"{ref}.units.{uid}.successor_policy: must be a mapping")
                    extra_policy = sorted(
                        set(map(str, successor_policy)) - {"mode", "decision_at_risk", "protected_invariants"}
                    )
                    if extra_policy:
                        raise GraphError(
                            f"{ref}.units.{uid}.successor_policy: unknown keys {extra_policy}"
                        )
                    policy_mode = successor_policy.get("mode")
                    if policy_mode not in HANDOVER_MODES:
                        raise GraphError(
                            f"{ref}.units.{uid}.successor_policy.mode: one of {sorted(HANDOVER_MODES)}"
                        )
                    decision = successor_policy.get("decision_at_risk")
                    if decision is not None and (
                        not isinstance(decision, str) or not decision.strip() or len(decision) > 200 or "\n" in decision
                    ):
                        raise GraphError(
                            f"{ref}.units.{uid}.successor_policy.decision_at_risk: single non-empty line, at most 200 characters"
                        )
                    if policy_mode == "INDEPENDENT_RECONSTRUCTION" and not decision:
                        raise GraphError(
                            f"{ref}.units.{uid}.successor_policy.decision_at_risk: required for INDEPENDENT_RECONSTRUCTION"
                        )
                    invariants = successor_policy.get("protected_invariants") or []
                    if not isinstance(invariants, list) or not all(
                        isinstance(item, str) and item.strip() and len(item) <= 200 and "\n" not in item
                        for item in invariants
                    ):
                        raise GraphError(
                            f"{ref}.units.{uid}.successor_policy.protected_invariants: list of non-empty single lines <= 200 chars"
                        )
                    if len(set(invariants)) != len(invariants):
                        raise GraphError(
                            f"{ref}.units.{uid}.successor_policy.protected_invariants: duplicates are not allowed"
                        )
                    clean_successor_policy = {
                        "mode": policy_mode,
                        "decision_at_risk": decision.strip() if isinstance(decision, str) else None,
                        "protected_invariants": list(invariants),
                    }
                clean_units.append(
                    {
                        "id": uid,
                        "weight": _positive_int(unit.get("weight"), f"{ref}.units.{uid}.weight"),
                        "verify": texts["verify"],
                        "outcome": texts["outcome"],
                        "successor_policy": clean_successor_policy,
                        "moved_from": moved_from,
                    }
                )
            gates = []
            seen_gates: set[str] = set()
            for gate in raw.get("delivery_gates") or []:
                gid = str((gate or {}).get("id") or "")
                if not _UNIT_ID.fullmatch(gid) or gid in seen_gates:
                    raise GraphError(f"{ref}.delivery_gates: invalid or duplicate gate id {gid!r}")
                seen_gates.add(gid)
                gates.append({"id": gid, "weight": _positive_int(gate.get("weight"), f"{ref}.delivery_gates.{gid}.weight")})
            coder_weight = raw.get("coder_weight")
            if gates:
                coder_weight = _positive_int(coder_weight if coder_weight is not None else 60, f"{ref}.coder_weight")
            outcome = raw.get("outcome")
            if outcome is not None and not isinstance(outcome, str):
                raise GraphError(f"{ref}.outcome: must be a string")
            work_class = raw.get("work_class", "PRODUCT")
            if work_class not in WORK_CLASSES:
                raise GraphError(f"{ref}.work_class: one of {list(WORK_CLASSES)}")
            basis = raw.get("parallel_ok_basis")
            if basis is not None and not isinstance(basis, str):
                raise GraphError(f"{ref}.parallel_ok_basis: must be a string")
            independence_basis = raw.get("independence_basis")
            if independence_basis is not None and not isinstance(independence_basis, str):
                raise GraphError(f"{ref}.independence_basis: must be a string")
            acceptance_methods = _str_list(raw.get("acceptance_methods"), f"{ref}.acceptance_methods")
            if len(acceptance_methods) != len(set(acceptance_methods)):
                raise GraphError(f"{ref}.acceptance_methods: duplicates are not allowed")
            owns_claims = _str_list(raw.get("owns_claims"), f"{ref}.owns_claims")
            for cid in owns_claims:
                if not _UNIT_ID.fullmatch(cid):
                    raise GraphError(f"{ref}.owns_claims: invalid claim id {cid!r}")
            if len(owns_claims) != len(set(owns_claims)):
                raise GraphError(f"{ref}.owns_claims: claim ids must be unique")
            node.update(
                {
                    "units": clean_units,
                    "delivery_gates": gates,
                    "coder_weight": coder_weight if gates else 1,
                    "responsibility_id": raw.get("responsibility_id"),
                    "primary_pr": raw.get("primary_pr"),
                    # Branch/tag whose head is the candidate when the leaf has no PR yet.
                    "candidate_ref": (str(raw["candidate_ref"]) if raw.get("candidate_ref") else None),
                    "critical": bool(raw.get("critical", False)),
                    "verification": sorted(set(raw.get("verification") or ["VERIFIED"])),
                    "contract_digest": raw.get("contract_digest"),
                    # decomposition contract (judged by decomposition_report; the progress maths never reads it)
                    "work_class": work_class,
                    "outcome": (outcome or "").strip() or None,
                    "size_budget": _size_budget(raw.get("size_budget"), ref),
                    "write_surface": _write_surface(raw.get("write_surface"), ref),
                    "depends_on": _ref_list(raw.get("depends_on"), f"{ref}.depends_on"),
                    "parallel_ok": _ref_list(raw.get("parallel_ok"), f"{ref}.parallel_ok"),
                    "parallel_ok_basis": (basis or "").strip() or None,
                    "owns_claims": sorted(set(owns_claims)),
                    "independence_basis": (independence_basis or "").strip() or None,
                    "acceptance_methods": sorted(acceptance_methods),
                }
            )
            if node["primary_pr"] is not None:
                try:
                    parse_ref(node["primary_pr"])
                except DelpError as exc:
                    raise GraphError(f"{ref}.primary_pr: {exc}") from exc
            bad = [r for r in node["verification"] if r not in UNIT_RESULTS]
            if bad:
                raise GraphError(f"{ref}.verification: unknown results {bad}")
            if node["contract_digest"] is not None and not _DIGEST.fullmatch(str(node["contract_digest"])):
                raise GraphError(f"{ref}.contract_digest: must be sha256:<64 hex>")
        nodes[ref] = node
        by_number[number] = ref
        order.append(ref)

    roots = [ref for ref, n in nodes.items() if n["kind"] == "ROOT"]
    if len(roots) != 1:
        raise GraphError("exactly one ROOT node is required")
    if not same_ref(roots[0], root_ref):
        raise GraphError("programme.root must name the ROOT node")

    for ref, node in nodes.items():
        if node["kind"] == "ROOT":
            continue
        parent_number = ref_number(node["parent"])
        parent_ref = by_number.get(parent_number)
        if parent_ref is None:
            raise GraphError(f"{ref}.parent: {node['parent']} is not a declared node")
        if nodes[parent_ref]["kind"] == "LEAF":
            raise GraphError(f"{ref}.parent: a LEAF cannot have children")
        node["parent_ref"] = parent_ref
        nodes[parent_ref]["children"].append(ref)

    # cycle / reachability: every node must reach the root by following parents
    for ref in nodes:
        seen: set[str] = set()
        cursor = ref
        while nodes[cursor]["kind"] != "ROOT":
            if cursor in seen:
                raise GraphError(f"cycle through {ref}")
            seen.add(cursor)
            cursor = nodes[cursor]["parent_ref"]
    for ref, node in nodes.items():
        if node["kind"] != "LEAF" and not node["children"]:
            proposal_root = (
                node["kind"] == "ROOT"
                and decomposition_proposal is not None
                and len(nodes) == 1
            )
            if not proposal_root:
                raise GraphError(f"{ref}: a ROOT/INTERMEDIATE node needs at least one child")

    # leaf-to-leaf references (ordering and declared parallelism) must name declared leaves
    leaf_by_number = {n["number"]: ref for ref, n in nodes.items() if n["kind"] == "LEAF"}
    for ref, node in nodes.items():
        if node["kind"] != "LEAF":
            continue
        for field in ("depends_on", "parallel_ok"):
            resolved = set()
            for value in node[field]:
                target = leaf_by_number.get(ref_number(value))
                if target is None:
                    raise GraphError(f"{ref}.{field}: {value} is not a declared LEAF")
                if target == ref:
                    raise GraphError(f"{ref}.{field}: a leaf cannot reference itself")
                resolved.add(target)
            node[field] = sorted(resolved, key=lambda r: nodes[r]["number"])
    walk_state: dict[str, int] = {}  # 1 = on the current path, 2 = fully explored

    def walk(ref: str) -> None:
        walk_state[ref] = 1
        for dep in nodes[ref]["depends_on"]:
            if walk_state.get(dep) == 1:
                raise GraphError(f"depends_on cycle through {ref} and {dep}")
            if dep not in walk_state:
                walk(dep)
        walk_state[ref] = 2

    for ref in leaf_by_number.values():
        if ref not in walk_state:
            walk(ref)

    return {
        "programme": dict(programme),
        "policy": policy,
        "health_policy": health_policy,
        "acceptance_claims": acceptance_claims,
        "claims_by_id": claims_by_id,
        "decomposition_proposal": decomposition_proposal,
        "total_weight": total_weight,
        "plan_updates": _plan_updates(graph.get("plan_updates")),
        "nodes": nodes,
        "order": order,
        "root": roots[0],
        "by_number": by_number,
        "digest": canonical_digest(graph),
    }


def lineage(indexed: Mapping[str, Any], ref: str) -> list[str]:
    nodes = indexed["nodes"]
    chain = [ref]
    while nodes[chain[-1]]["kind"] != "ROOT":
        chain.append(nodes[chain[-1]]["parent_ref"])
    return list(reversed(chain))


# --------------------------------------------------------------------------
# decomposition gate: is the plan small, verifiable and collision-free enough to hand to an agent?
#
# The gate judges the PLAN (the execution graph). It never reads agent facts and never moves a percentage;
# its only effects are a `plan` block, a NOT_RELEASEABLE / PLAN_GAP state (ENFORCED mode only) and the
# FIX_PLAN continuation action.
# --------------------------------------------------------------------------


def _finding(code: str, detail: str, severity: str = "BLOCKER") -> dict[str, str]:
    return {"code": code, "severity": severity, "detail": detail}


def _id_list(ids: Iterable[str], limit: int = 6) -> str:
    ids = list(ids)
    return ", ".join(ids[:limit]) + (f" (+{len(ids) - limit} more)" if len(ids) > limit else "")


def _parts_at_target(budget: Mapping[str, int], limits: Mapping[str, int]) -> int:
    parts = 1
    for dim in ("loc", "minutes"):
        declared = budget.get(f"target_{dim}") or budget.get(f"hard_{dim}")
        if declared:
            parts = max(parts, -(-declared // limits[f"target_{dim}"]))
    return parts


def _leaf_findings(
    node: Mapping[str, Any], policy: Mapping[str, Any], claims_by_id: Mapping[str, Mapping[str, Any]]
) -> list[dict[str, str]]:
    """Every per-leaf rule. Claim-first checks are explicit topology checks, never keyword inference."""
    unit_rules, limits, require = policy["units"], policy["leaf_budget"], policy["require"]
    product = node["work_class"] == "PRODUCT"
    rows = node["units"]
    found: list[dict[str, str]] = []
    claim_policy = policy["claim_first"]
    if claim_policy["mode"] != "OFF":
        severity = "ADVISORY" if claim_policy["mode"] == "ADVISORY" else "BLOCKER"
        owned = node["owns_claims"]
        if not owned:
            found.append(_finding("LEAF_CLAIM_MISSING", "claim-first plan requires every leaf to own at least one parent acceptance claim", severity))
        unknown = [cid for cid in owned if cid not in claims_by_id]
        if unknown:
            found.append(_finding("CLAIM_UNKNOWN", f"owns undeclared parent claim(s): {_id_list(unknown)}", severity))
        if product and owned and not any(
            claims_by_id[cid]["kind"] == "SEMANTIC" for cid in owned if cid in claims_by_id
        ):
            found.append(
                _finding(
                    "PRODUCT_SEMANTIC_CLAIM_MISSING",
                    "PRODUCT leaf owns only DELIVERY_GATE claims; implementation mechanics belong in acceptance methods or a GATE leaf",
                    severity,
                )
            )
        if claim_policy["require_independence_basis"] and not node["independence_basis"]:
            found.append(
                _finding(
                    "INDEPENDENCE_BASIS_MISSING",
                    "state why this leaf can receive an independent RESPONSIBILITY_COMPLETE YES/NO without completing its siblings",
                    severity,
                )
            )
    if len(rows) > unit_rules["max"]:
        found.append(_finding("UNITS_ABOVE_MAX", f"{len(rows)} units (max {unit_rules['max']}): split the leaf"))
    if product and len(rows) < unit_rules["min"]:
        found.append(
            _finding(
                "UNITS_BELOW_MIN",
                f"{len(rows)} units (min {unit_rules['min']}): declare verifiable slices (rote or review-only work is classed MECHANICAL or GATE by the Coordinator)",
            )
        )
    if product:
        total = sum(u["weight"] for u in rows)
        for u in rows:
            if u["weight"] * 100 > unit_rules["max_share_percent"] * total:
                found.append(
                    _finding(
                        "UNIT_SHARE_OVER",
                        f"{u['id']} carries {percent(Fraction(u['weight'], total))}% of the leaf "
                        f"(max {unit_rules['max_share_percent']}%): split or reweight it",
                    )
                )
    if require["verify"]:
        unverifiable = [u["id"] for u in rows if not u["verify"]]
        if unverifiable:
            found.append(_finding("UNIT_VERIFY_MISSING", f"no verify step for {_id_list(unverifiable)}"))
    if require["outcome"] and not node["outcome"]:
        found.append(_finding("OUTCOME_MISSING", "state the observable outcome of the leaf in one sentence"))
    if require["write_surface"] and not node["write_surface"]:
        found.append(_finding("WRITE_SURFACE_MISSING", "declare the files or directories the leaf will write"))
    budget = node["size_budget"] or {}
    absent = [k for k in _BUDGET_KEYS if k not in budget]
    if require["size_budget"] and absent:
        found.append(_finding("SIZE_BUDGET_MISSING", f"declare the size_budget keys {_id_list(absent)}"))
    for dim in ("loc", "minutes"):
        target, hard = budget.get(f"target_{dim}"), budget.get(f"hard_{dim}")
        if target is not None and hard is not None and target > hard:
            found.append(_finding("SIZE_BUDGET_INCONSISTENT", f"target_{dim} {target} exceeds hard_{dim} {hard}"))
    over_hard = [
        f"hard_{dim} {budget[f'hard_{dim}']} > {limits[f'hard_{dim}']}"
        for dim in ("loc", "minutes")
        if budget.get(f"hard_{dim}", 0) > limits[f"hard_{dim}"]
    ]
    over_target = [
        f"target_{dim} {budget[f'target_{dim}']} > {limits[f'target_{dim}']}"
        for dim in ("loc", "minutes")
        if budget.get(f"target_{dim}", 0) > limits[f"target_{dim}"]
    ]
    if over_hard:
        parts = _parts_at_target(budget, limits)
        hint = f"split into at least {parts} leaves" if parts > 1 else "lower the cap or split the leaf"
        found.append(_finding("SIZE_OVER_HARD", f"{', '.join(over_hard)}: {hint}"))
    elif over_target:
        found.append(_finding("SIZE_OVER_TARGET", ", ".join(over_target), "ADVISORY"))
    nano = policy["min_leaf_target_loc"]
    if product and nano and budget.get("target_loc", nano) < nano:
        found.append(
            _finding(
                "LEAF_TOO_SMALL",
                f"target_loc {budget['target_loc']} < {nano}: fold it into a sibling leaf (an issue and a PR cost more than the work)",
                "ADVISORY",
            )
        )
    if node["parallel_ok"] and not node["parallel_ok_basis"]:
        found.append(_finding("PARALLEL_BASIS_MISSING", "parallel_ok needs a parallel_ok_basis saying why the write surfaces do not conflict"))
    return found


_MECHANISM_WORDS = frozenset(
    {
        "workflow", "ci", "browser", "evidence", "handoff", "renderer", "migration",
        "test", "tests", "testing", "checkpoint", "schema", "script", "fixture", "fixtures",
    }
)


def _mechanism_terms(*texts: str) -> list[str]:
    found: set[str] = set()
    for text in texts:
        tokens = re.findall(r"[a-z0-9]+", str(text).lower().replace("_", " ").replace("-", " "))
        found.update(token for token in tokens if token in _MECHANISM_WORDS)
    return sorted(found)


def _proposal_decomposition(indexed: Mapping[str, Any], mode: str | None = None) -> dict[str, Any]:
    """Evaluate the pre-materialization proposal before child provider refs exist."""
    proposal, policy = indexed["decomposition_proposal"], indexed["policy"]
    assert proposal is not None
    proposal_digest = canonical_digest(
        {
            "version": proposal["version"],
            "acceptance_claims": indexed["acceptance_claims"],
            "responsibilities": proposal["responsibilities"],
            "delivery_gate_weight_exception_basis": proposal["delivery_gate_weight_exception_basis"],
            "total_weight": indexed["total_weight"],
            "decomposition_policy": policy,
        }
    )
    claims_by_id = indexed["claims_by_id"]
    claim_policy = policy["claim_first"]
    claim_severity = "ADVISORY" if claim_policy["mode"] == "ADVISORY" else "BLOCKER"
    rows: dict[str, Any] = {}
    findings: dict[str, list[dict[str, str]]] = {row["id"]: [] for row in proposal["responsibilities"]}

    total_weight = indexed["total_weight"]
    missing_weights = [cid for cid, claim in claims_by_id.items() if claim.get("weight") is None]
    global_findings: list[dict[str, str]] = []
    if policy["mode"] != "ENFORCED" or claim_policy["mode"] != "ENFORCED":
        global_findings.append(
            _finding(
                "PROPOSAL_GATE_NOT_ENFORCED",
                "proposal-v2 child release requires decomposition_policy.mode=ENFORCED and claim_first.mode=ENFORCED",
            )
        )
    if missing_weights:
        global_findings.append(
            _finding(
                "PARENT_CLAIM_WEIGHT_MISSING",
                f"proposal-v2 requires weight on parent claim(s): {_id_list(missing_weights)}",
            )
        )
    elif sum(claim["weight"] for claim in claims_by_id.values()) != total_weight:
        global_findings.append(
            _finding(
                "PARENT_CLAIM_WEIGHT_TOTAL",
                f"parent claim weights must sum to programme.total_weight {total_weight}",
            )
        )
    if not missing_weights and claims_by_id:
        semantic_weight = sum(claim["weight"] for claim in claims_by_id.values() if claim["kind"] == "SEMANTIC")
        gate_weight = sum(claim["weight"] for claim in claims_by_id.values() if claim["kind"] == "DELIVERY_GATE")
        if gate_weight and gate_weight >= semantic_weight and not proposal["delivery_gate_weight_exception_basis"]:
            global_findings.append(
                _finding(
                    "DELIVERY_GATE_WEIGHT_DOMINATES",
                    f"DELIVERY_GATE claim weight {gate_weight} must not equal/exceed semantic weight {semantic_weight} "
                    "without delivery_gate_weight_exception_basis",
                )
            )

    owners: dict[str, list[str]] = {cid: [] for cid in claims_by_id}
    allocations_by_claim: dict[str, list[tuple[str, int]]] = {cid: [] for cid in claims_by_id}
    for row in proposal["responsibilities"]:
        rid = row["id"]
        owned = row["owns_claims"]
        unknown = [cid for cid in owned if cid not in claims_by_id]
        if unknown:
            findings[rid].append(_finding("CLAIM_UNKNOWN", f"owns undeclared parent claim(s): {_id_list(unknown)}", claim_severity))
        for cid in owned:
            if cid in owners:
                owners[cid].append(rid)
        for allocation in row["claim_allocations"]:
            cid = allocation["claim_id"]
            if cid in allocations_by_claim:
                allocations_by_claim[cid].append((rid, allocation["weight"]))
        if row["work_class"] == "PRODUCT" and owned and not any(
            claims_by_id[cid]["kind"] == "SEMANTIC" for cid in owned if cid in claims_by_id
        ):
            findings[rid].append(
                _finding(
                    "PRODUCT_SEMANTIC_CLAIM_MISSING",
                    "PRODUCT responsibility owns only DELIVERY_GATE claims",
                    claim_severity,
                )
            )

        units = row["semantic_units"]
        semantic_count = sum(unit["kind"] == "SEMANTIC" for unit in units)
        if row["work_class"] == "PRODUCT":
            wrong = [unit["id"] for unit in units if unit["kind"] != "SEMANTIC"]
            if wrong:
                findings[rid].append(
                    _finding(
                        "PRODUCT_UNIT_NOT_SEMANTIC",
                        f"PRODUCT responsibility has non-semantic progress unit(s): {_id_list(wrong)}",
                    )
                )
            if semantic_count < policy["units"]["min"]:
                findings[rid].append(
                    _finding(
                        "SEMANTIC_UNITS_BELOW_MIN",
                        f"{semantic_count} semantic units (min {policy['units']['min']})",
                    )
                )
            if semantic_count > policy["units"]["max"]:
                findings[rid].append(
                    _finding(
                        "SEMANTIC_UNITS_ABOVE_MAX",
                        f"{semantic_count} semantic units (max {policy['units']['max']})",
                    )
                )
            semantic_units = [unit for unit in units if unit["kind"] == "SEMANTIC"]
            semantic_total = sum(unit["weight"] for unit in semantic_units)
            for unit in semantic_units:
                if unit["weight"] * 100 > policy["units"]["max_share_percent"] * semantic_total:
                    findings[rid].append(
                        _finding(
                            "SEMANTIC_UNIT_SHARE_OVER",
                            f"{unit['id']} carries {percent(Fraction(unit['weight'], semantic_total))}% "
                            f"(max {policy['units']['max_share_percent']}%)",
                        )
                    )
        elif row["work_class"] == "GATE":
            wrong = [unit["id"] for unit in units if unit["kind"] != "DELIVERY_GATE"]
            if wrong:
                findings[rid].append(
                    _finding("GATE_UNIT_KIND_INVALID", f"GATE responsibility has non-delivery-gate unit(s): {_id_list(wrong)}")
                )
        elif row["work_class"] == "MECHANICAL":
            wrong = [unit["id"] for unit in units if unit["kind"] != "MECHANICAL"]
            if wrong:
                findings[rid].append(
                    _finding("MECHANICAL_UNIT_KIND_INVALID", f"MECHANICAL responsibility has non-mechanical unit(s): {_id_list(wrong)}")
                )

        if policy["require"]["write_surface"] and not row["write_surface"]:
            findings[rid].append(_finding("WRITE_SURFACE_MISSING", "declare pre-materialization write_surface"))
        budget = row["size_budget"] or {}
        absent = [k for k in _BUDGET_KEYS if k not in budget]
        if policy["require"]["size_budget"] and absent:
            findings[rid].append(_finding("SIZE_BUDGET_MISSING", f"declare size_budget keys {_id_list(absent)}"))
        for dim in ("loc", "minutes"):
            target, hard = budget.get(f"target_{dim}"), budget.get(f"hard_{dim}")
            if target is not None and hard is not None and target > hard:
                findings[rid].append(_finding("SIZE_BUDGET_INCONSISTENT", f"target_{dim} {target} exceeds hard_{dim} {hard}"))
            if hard is not None and hard > policy["leaf_budget"][f"hard_{dim}"]:
                findings[rid].append(_finding("SIZE_OVER_HARD", f"hard_{dim} {hard} exceeds policy hard {policy['leaf_budget'][f'hard_{dim}']}"))
        if row["parallel_ok"] and not row["parallel_ok_basis"]:
            findings[rid].append(_finding("PARALLEL_BASIS_MISSING", "parallel_ok needs a basis"))
        if row["work_class"] == "PRODUCT":
            exception = row.get("mechanism_exception")
            valid_exception = False
            if exception:
                cited = exception["claim_ids"]
                owned_set = set(row["owns_claims"])
                valid_exception = (
                    set(cited).issubset(owned_set)
                    and all(
                        cid in claims_by_id
                        and claims_by_id[cid]["kind"] == "SEMANTIC"
                        and claims_by_id[cid]["mechanism_exception_allowed"]
                        for cid in cited
                    )
                )
                if not set(cited).issubset(owned_set):
                    findings[rid].append(
                        _finding(
                            "MECHANISM_EXCEPTION_CLAIM_UNOWNED",
                            f"mechanism exception cites unowned claim(s): {_id_list(set(cited) - owned_set)}",
                        )
                    )
            mechanism_terms = _mechanism_terms(row["id"], row["outcome"])
            unit_mechanisms = {
                unit["id"]: _mechanism_terms(unit["id"], unit["outcome"])
                for unit in units
                if unit["kind"] == "SEMANTIC" and _mechanism_terms(unit["id"], unit["outcome"])
            }
            if unit_mechanisms and not valid_exception:
                for uid, terms in unit_mechanisms.items():
                    findings[rid].append(
                        _finding(
                            "MECHANISM_SEMANTIC_UNIT",
                            f"{uid} is labelled SEMANTIC but is mechanism-shaped ({_id_list(terms)}); "
                            "implementation/test mechanics belong in acceptance_methods or require the same explicit infrastructure exception",
                        )
                    )
            if mechanism_terms and not valid_exception:
                findings[rid].append(
                    _finding(
                        "MECHANISM_PRODUCT_BOUNDARY",
                        f"PRODUCT responsibility boundary is mechanism-shaped ({_id_list(mechanism_terms)}); "
                        "use acceptance methods/GATE or cite an allowed infrastructure semantic claim with mechanism_exception",
                    )
                )

    if claim_policy["mode"] != "OFF":
        if not claims_by_id:
            for rid in findings:
                findings[rid].append(
                    _finding("PARENT_CLAIMS_MISSING", "claim-first proposal requires programme.acceptance_claims", claim_severity)
                )
        else:
            uncovered = [cid for cid, refs in owners.items() if not refs]
            if uncovered:
                for rid in findings:
                    findings[rid].append(
                        _finding(
                            "PARENT_CLAIM_UNCOVERED",
                            f"no proposed responsibility owns parent acceptance claim(s): {_id_list(uncovered)}",
                            claim_severity,
                        )
                    )
            for cid, refs in owners.items():
                if len(refs) <= 1 or claims_by_id[cid]["shared"]:
                    continue
                for rid in refs:
                    findings[rid].append(
                        _finding(
                            "DUPLICATE_CLAIM_OWNERSHIP",
                            f"{cid} is owned by {_id_list(refs)}; set claim.shared=true only when intentional",
                            claim_severity,
                        )
                    )

    reach: dict[str, set[str]] = {}
    proposal_by_id = {row["id"]: row for row in proposal["responsibilities"]}

    def reachable(rid: str) -> set[str]:
        if rid not in reach:
            reach[rid] = set()
            for dep in proposal_by_id[rid]["depends_on"]:
                reach[rid] |= {dep} | reachable(dep)
        return reach[rid]

    proposal_rows = proposal["responsibilities"]
    for index, left in enumerate(proposal_rows):
        for right in proposal_rows[index + 1:]:
            hits = _surface_overlap(left["write_surface"], right["write_surface"])
            ordered = right["id"] in reachable(left["id"]) or left["id"] in reachable(right["id"])
            parallel = right["id"] in left["parallel_ok"] or left["id"] in right["parallel_ok"]
            if hits and not ordered and not parallel:
                for me, other in ((left, right), (right, left)):
                    findings[me["id"]].append(
                        _finding(
                            "WRITE_SURFACE_COLLISION",
                            f"overlaps {other['id']} on {_id_list(hits, 3)} with no depends_on order or parallel_ok",
                        )
                    )

    for finding in global_findings:
        for rid in findings:
            findings[rid].append(finding)

    if not missing_weights:
        for cid, claim in claims_by_id.items():
            allocated = allocations_by_claim[cid]
            if not allocated:
                continue
            total_allocated = sum(weight for _, weight in allocated)
            if total_allocated != claim["weight"]:
                code = "SHARED_CLAIM_WEIGHT_MISMATCH" if claim["shared"] else "CLAIM_WEIGHT_MISMATCH"
                detail = f"{cid} allocates {total_allocated} but parent claim weight is {claim['weight']}"
                targets = [rid for rid, _ in allocated]
                for rid in targets:
                    findings[rid].append(_finding(code, detail))

    base_blocked = any(any(f["severity"] == "BLOCKER" for f in rows) for rows in findings.values())
    bindings = proposal["bindings"]
    if bindings:
        if base_blocked:
            for binding in bindings:
                findings[binding["responsibility_id"]].append(
                    _finding(
                        "MATERIALIZATION_BEFORE_RELEASE",
                        "provider binding exists while the exact pre-materialization proposal is NOT_RELEASEABLE",
                    )
                )
        if proposal["released_proposal_digest"] != proposal_digest:
            for binding in bindings:
                findings[binding["responsibility_id"]].append(
                    _finding(
                        "PROPOSAL_RELEASE_DIGEST_MISMATCH",
                        "provider binding requires released_proposal_digest equal to the exact current RELEASEABLE proposal digest",
                    )
                )

        proposal_by_id = {row["id"]: row for row in proposal["responsibilities"]}
        bound_ids = {binding["responsibility_id"] for binding in bindings}
        leaf_refs = {ref for ref, node in indexed["nodes"].items() if node["kind"] == "LEAF"}
        for binding in bindings:
            rid, requested_ref = binding["responsibility_id"], binding["ref"]
            target = next((ref for ref in leaf_refs if same_ref(ref, requested_ref)), None)
            if target is None:
                findings[rid].append(
                    _finding("BINDING_REF_UNMATERIALIZED", f"{requested_ref} is not a declared materialized LEAF")
                )
                continue
            node = indexed["nodes"][target]
            if node.get("responsibility_id") != rid:
                findings[rid].append(
                    _finding(
                        "BINDING_IDENTITY_MISMATCH",
                        f"{requested_ref} responsibility_id {node.get('responsibility_id')!r} does not match {rid}",
                    )
                )
            if set(node.get("owns_claims") or []) != set(proposal_by_id[rid]["owns_claims"]):
                findings[rid].append(
                    _finding(
                        "BINDING_CLAIM_MISMATCH",
                        f"{requested_ref} claim ownership differs from the released proposal",
                    )
                )
            proposed = proposal_by_id[rid]
            if node.get("work_class") != proposed["work_class"]:
                findings[rid].append(_finding("BINDING_CLASS_MISMATCH", f"{requested_ref} work_class differs from proposal"))
            if node.get("outcome") != proposed["outcome"]:
                findings[rid].append(_finding("BINDING_OUTCOME_MISMATCH", f"{requested_ref} outcome differs from proposal"))
            if node.get("independence_basis") != proposed["independence_basis"]:
                findings[rid].append(_finding("BINDING_INDEPENDENCE_MISMATCH", f"{requested_ref} independence basis differs"))
            if node.get("size_budget") != proposed["size_budget"]:
                findings[rid].append(_finding("BINDING_SIZE_BUDGET_MISMATCH", f"{requested_ref} size budget differs"))
            if node.get("write_surface") != proposed["write_surface"]:
                findings[rid].append(_finding("BINDING_WRITE_SURFACE_MISMATCH", f"{requested_ref} write surface differs"))
            if node.get("acceptance_methods") != proposed["acceptance_methods"]:
                findings[rid].append(
                    _finding("BINDING_ACCEPTANCE_METHOD_MISMATCH", f"{requested_ref} acceptance methods differ from proposal")
                )
            expected_units = [
                {
                    "id": unit["id"],
                    "weight": unit["weight"],
                    "verify": unit["verify"],
                    "outcome": unit["outcome"],
                }
                for unit in proposed["semantic_units"]
            ]
            actual_units = [
                {
                    "id": unit["id"],
                    "weight": unit["weight"],
                    "verify": unit["verify"],
                    "outcome": unit["outcome"],
                }
                for unit in node["units"]
            ]
            if actual_units != expected_units:
                findings[rid].append(_finding("BINDING_UNIT_MISMATCH", f"{requested_ref} units differ from proposal"))
            binding_by_id = {b["responsibility_id"]: b["ref"] for b in bindings}
            expected_deps = {binding_by_id[dep] for dep in proposed["depends_on"] if dep in binding_by_id}
            actual_deps = set(node.get("depends_on") or [])
            if {ref_number(x) for x in actual_deps} != {ref_number(x) for x in expected_deps}:
                findings[rid].append(_finding("BINDING_DEPENDENCY_MISMATCH", f"{requested_ref} dependencies differ from proposal"))
            expected_parallel = {binding_by_id[peer] for peer in proposed["parallel_ok"] if peer in binding_by_id}
            actual_parallel = set(node.get("parallel_ok") or [])
            if {ref_number(x) for x in actual_parallel} != {ref_number(x) for x in expected_parallel}:
                findings[rid].append(_finding("BINDING_PARALLEL_MISMATCH", f"{requested_ref} parallel topology differs from proposal"))
            if node.get("parallel_ok_basis") != proposed["parallel_ok_basis"]:
                findings[rid].append(_finding("BINDING_PARALLEL_BASIS_MISMATCH", f"{requested_ref} parallel basis differs from proposal"))
            share = Fraction(1)
            chain = lineage(indexed, target)
            for child_ref in chain[1:]:
                parent_ref = indexed["nodes"][child_ref]["parent_ref"]
                parent = indexed["nodes"][parent_ref]
                denominator = sum(indexed["nodes"][c]["weight"] for c in parent["children"]) + parent["reserve_weight"]
                share *= Fraction(indexed["nodes"][child_ref]["weight"], denominator)
            bound_points = share * indexed["total_weight"]
            proposed_points = sum(a["weight"] for a in proposal_by_id[rid]["claim_allocations"])
            if bound_points != proposed_points:
                findings[rid].append(
                    _finding(
                        "BINDING_WEIGHT_MISMATCH",
                        f"{requested_ref} carries {_points_text(share, indexed['total_weight'])} programme points; "
                        f"released proposal assigns {proposed_points}",
                    )
                )

        for ref in leaf_refs:
            node = indexed["nodes"][ref]
            rid = node.get("responsibility_id")
            if rid in proposal_by_id and rid not in bound_ids:
                findings[rid].append(
                    _finding(
                        "UNDECLARED_MATERIALIZATION",
                        f"{ref} materializes proposed responsibility {rid} without an explicit provider binding",
                    )
                )

    classes: dict[str, int] = {}
    for row in proposal["responsibilities"]:
        rid = row["id"]
        ordered = sorted(findings[rid], key=lambda f: (f["severity"] != "BLOCKER", f["code"], f["detail"]))
        blockers = [{"code": f["code"], "detail": f["detail"]} for f in ordered if f["severity"] == "BLOCKER"]
        advisories = [{"code": f["code"], "detail": f["detail"]} for f in ordered if f["severity"] != "BLOCKER"]
        rows[rid] = {
            "work_class": row["work_class"],
            "weight": sum(allocation["weight"] for allocation in row["claim_allocations"]),
            "releasable": not blockers,
            "blockers": blockers,
            "advisories": advisories,
        }
        classes[row["work_class"]] = classes.get(row["work_class"], 0) + 1
    return {
        "schema": DECOMPOSITION_SCHEMA,
        "authority": AUTHORITY,
        "mode": mode or policy["mode"],
        "policy": policy,
        "proposal_version": proposal["version"],
        "proposal_digest": proposal_digest,
        "released_proposal_digest": proposal["released_proposal_digest"],
        "bindings": list(proposal["bindings"]),
        "release_state": "RELEASEABLE" if all(row["releasable"] for row in rows.values()) else "NOT_RELEASEABLE",
        "leaves": rows,
        "summary": {
            "evaluated": len(rows),
            "skipped_closed": 0,
            "releasable": sum(1 for row in rows.values() if row["releasable"]),
            "not_releasable": sum(1 for row in rows.values() if not row["releasable"]),
            "advisories": sum(len(row["advisories"]) for row in rows.values()),
            "by_class": dict(sorted(classes.items())),
        },
    }


def _decomposition(
    indexed: Mapping[str, Any], closed: Iterable[str] = (), mode: str | None = None
) -> dict[str, Any]:
    nodes, policy = indexed["nodes"], indexed["policy"]
    closed = set(closed)
    leaves = [ref for ref in indexed["order"] if nodes[ref]["kind"] == "LEAF"]
    active = [ref for ref in leaves if ref not in closed]
    claims_by_id = indexed["claims_by_id"]
    found = {ref: _leaf_findings(nodes[ref], policy, claims_by_id) for ref in active}

    claim_policy = policy["claim_first"]
    if claim_policy["mode"] != "OFF" and active:
        severity = "ADVISORY" if claim_policy["mode"] == "ADVISORY" else "BLOCKER"
        if not claims_by_id:
            finding = _finding(
                "PARENT_CLAIMS_MISSING",
                "claim-first plan requires programme.acceptance_claims before child release",
                severity,
            )
            for ref in active:
                found[ref].append(finding)
        else:
            owners: dict[str, list[str]] = {cid: [] for cid in claims_by_id}
            for ref in leaves:
                for cid in nodes[ref]["owns_claims"]:
                    if cid in owners:
                        owners[cid].append(ref)
            uncovered = [cid for cid, refs in owners.items() if not refs]
            if uncovered:
                finding = _finding(
                    "PARENT_CLAIM_UNCOVERED",
                    f"no leaf owns parent acceptance claim(s): {_id_list(uncovered)}",
                    severity,
                )
                for ref in active:
                    found[ref].append(finding)
            for cid, refs in owners.items():
                if len(refs) <= 1 or claims_by_id[cid]["shared"]:
                    continue
                detail = f"{cid} is owned by {_id_list(refs)}; set claim.shared=true only when joint ownership is intentional"
                targets = [ref for ref in refs if ref in found]
                for ref in targets:
                    found[ref].append(_finding("DUPLICATE_CLAIM_OWNERSHIP", detail, severity))

    reach: dict[str, set[str]] = {}

    def reachable(ref: str) -> set[str]:
        if ref not in reach:  # validate_graph guarantees the depends_on graph is acyclic
            reach[ref] = set()
            for dep in nodes[ref]["depends_on"]:
                reach[ref] |= {dep} | reachable(dep)
        return reach[ref]

    for index, a in enumerate(active):
        for b in active[index + 1 :]:
            hits = _surface_overlap(nodes[a]["write_surface"], nodes[b]["write_surface"])
            ordered = b in reachable(a) or a in reachable(b)
            declared_parallel = b in nodes[a]["parallel_ok"] or a in nodes[b]["parallel_ok"]
            if not hits or ordered or declared_parallel:
                continue
            for me, other in ((a, b), (b, a)):
                found[me].append(
                    _finding(
                        "WRITE_SURFACE_COLLISION",
                        f"overlaps #{nodes[other]['number']} on {_id_list(hits, 3)} with no depends_on order and no parallel_ok",
                    )
                )

    rows: dict[str, Any] = {}
    classes: dict[str, int] = {}
    for ref in active:
        ordered_findings = sorted(found[ref], key=lambda f: (f["severity"] != "BLOCKER", f["code"], f["detail"]))
        blockers = [{"code": f["code"], "detail": f["detail"]} for f in ordered_findings if f["severity"] == "BLOCKER"]
        advisories = [{"code": f["code"], "detail": f["detail"]} for f in ordered_findings if f["severity"] != "BLOCKER"]
        rows[ref] = {
            "work_class": nodes[ref]["work_class"],
            "releasable": not blockers,
            "blockers": blockers,
            "advisories": advisories,
        }
        classes[nodes[ref]["work_class"]] = classes.get(nodes[ref]["work_class"], 0) + 1
    return {
        "schema": DECOMPOSITION_SCHEMA,
        "authority": AUTHORITY,
        "mode": mode or policy["mode"],
        "policy": policy,
        "leaves": rows,
        "summary": {
            "evaluated": len(active),
            "skipped_closed": len(leaves) - len(active),
            "releasable": sum(1 for r in rows.values() if r["releasable"]),
            "not_releasable": sum(1 for r in rows.values() if not r["releasable"]),
            "advisories": sum(len(r["advisories"]) for r in rows.values()),
            "by_class": dict(sorted(classes.items())),
        },
    }


def decomposition_report(graph: Any, mode: str | None = None, closed: Iterable[str] = ()) -> dict[str, Any]:
    """Evaluate the decomposition policy over every LEAF not in `closed` (e.g. already COMPLETE). Pure."""
    if mode is not None and mode not in POLICY_MODES:
        raise GraphError(f"mode: one of {list(POLICY_MODES)}")
    indexed = validate_graph(graph)
    if indexed["decomposition_proposal"] is not None:
        return _proposal_decomposition(indexed, mode)
    closed_numbers = {ref_number(c) for c in closed}
    return _decomposition(indexed, {r for r in indexed["nodes"] if indexed["nodes"][r]["number"] in closed_numbers}, mode)


def render_decomposition(report: Mapping[str, Any]) -> str:
    mode = report["mode"]
    lines = [f"DECOMPOSITION GATE — {mode}" + (" (informational: nothing is enforced)" if mode == "OFF" else "")]
    for ref, row in report["leaves"].items():
        lines.append(f"{ref} [{row['work_class']}] {'RELEASABLE' if row['releasable'] else 'NOT_RELEASEABLE'}")
        lines += [f"  BLOCKER  {f['code']}: {f['detail']}" for f in row["blockers"]]
        lines += [f"  ADVISORY {f['code']}: {f['detail']}" for f in row["advisories"]]
    s = report["summary"]
    classes = ", ".join(f"{k} {v}" for k, v in s["by_class"].items())
    lines.append(
        f"SUMMARY: {s['evaluated']} leaves · {s['releasable']} releasable · {s['not_releasable']} not releasable"
        f" · {s['advisories']} advisories · {s['skipped_closed']} closed (skipped) · classes: {classes or 'none'}"
    )
    return "\n".join(lines)


# --------------------------------------------------------------------------
# agent health: observed or derived, never declared. Advisory; never moves a number, a state or a title.
#
# Seven components, each OK / WATCH / AT_RISK / UNOBSERVED. UNOBSERVED means nothing was observed and is never read
# as healthy; the verdict is the worst component, never an average. The words are about delivery continuity (how far
# a successor would have to reconstruct), not about the quality of anyone's work: telemetry locates evidence and
# constrains delivery, it does not measure value.
# --------------------------------------------------------------------------


def _count(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def _health_components(
    leaf: Mapping[str, Any],
    node: Mapping[str, Any],
    observation: Mapping[str, Any],
    policy: Mapping[str, Any],
    limits: Mapping[str, int],
) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}

    def put(name: str, status: str, detail: str) -> None:
        out[name] = {"status": status, "detail": detail}

    materialization = leaf.get("materialization")
    if materialization:
        put("materialization", "AT_RISK", f"no accepted facts; the provider shows {materialization['provider_signal']}")
        put("evidence", "UNOBSERVED", "no facts to qualify")
    else:
        put("materialization", "OK", "the ledger holds accepted facts")
        verdict, gaps = leaf["evidence"]["health"], leaf["evidence"]["gaps"]
        put(
            "evidence",
            {"CURRENT": "OK", "GAP": "WATCH", "STALE_CANDIDATE": "AT_RISK", "UNVERIFIABLE": "UNOBSERVED"}[verdict],
            verdict + (": " + ", ".join(f"{g['unit']}:{g['reason']}" for g in gaps) if gaps else ""),
        )

    additions = _count(observation.get("additions"))
    deletions = _count(observation.get("deletions")) or 0
    since = observation.get("since_checkpoint")
    distance: tuple[int, int] | None
    if isinstance(since, Mapping) and _count(since.get("additions")) is not None:
        distance = (since["additions"], since["additions"] + (_count(since.get("deletions")) or 0))
    elif materialization and additions is not None:
        distance = (additions, additions + deletions)  # nothing was ever checkpointed: the whole branch is the distance
    else:
        distance = None
    c = policy["checkpoint"]
    if distance is None:
        put("checkpoint_distance", "UNOBSERVED", "the lines authored since the last checkpoint were not observed")
    else:
        added, changed = distance
        if added >= c["at_risk_added_loc"] or changed >= c["at_risk_changed_loc"]:
            status = "AT_RISK"
        elif added >= c["watch_added_loc"] or changed >= c["watch_changed_loc"]:
            status = "WATCH"
        else:
            status = "OK"
        put(
            "checkpoint_distance",
            status,
            f"{added} lines authored ({changed} changed) since the last checkpoint; trigger {c['watch_added_loc']}, hard ceiling {c['at_risk_added_loc']}",
        )

    budget = node.get("size_budget") or {}
    declared = "target_loc" in budget and "hard_loc" in budget
    target, hard = (budget["target_loc"], budget["hard_loc"]) if declared else (limits["target_loc"], limits["hard_loc"])
    if additions is None:
        put("size", "UNOBSERVED", "the changed lines of the candidate were not observed")
    else:
        total = additions + deletions
        status = "AT_RISK" if total > hard else "WATCH" if total > target else "OK"
        put("size", status, f"{total} changed lines against target {target} / hard {hard} ({'declared budget' if declared else 'policy default'})")

    behind = _count(observation.get("behind_by"))
    d = policy["drift"]
    if behind is None:
        put("base_drift", "UNOBSERVED", "the divergence from the base was not observed")
    else:
        status = "AT_RISK" if behind >= d["at_risk_behind"] else "WATCH" if behind >= d["watch_behind"] else "OK"
        put("base_drift", status, f"{behind} commit(s) behind the base")

    interruptions = observation.get("interruptions")
    i = policy["interruptions"]
    recorded = interruptions.get("losses") if isinstance(interruptions, Mapping) else None
    watched_from = interruptions.get("coverage_from") if isinstance(interruptions, Mapping) else None
    if not isinstance(recorded, list) or (not recorded and not watched_from):
        # A recorded loss is a loss whether or not anyone declared when watching began; zero can only be claimed by an observer.
        put("interruptions", "UNOBSERVED", "no observer was watching for stream losses, so zero cannot be claimed")
    else:
        losses = len(recorded)
        status = "AT_RISK" if losses >= i["at_risk"] else "WATCH" if losses >= i["watch"] else "OK"
        put(
            "interruptions",
            status,
            f"{losses} stream loss(es) in this executor lifecycle" + ("; the written rule plans a handover at the third" if losses >= i["at_risk"] else ""),
        )

    liveness = leaf.get("liveness")
    put(
        "liveness",
        {"ACTIVE": "OK", "QUIET": "WATCH", "STALE": "AT_RISK"}.get(liveness or "", "UNOBSERVED"),
        f"observed {liveness}" if liveness else "no observer reported liveness",
    )
    return out


def _health_block(components: Mapping[str, Mapping[str, str]]) -> dict[str, Any]:
    worst = max((c["status"] for c in components.values()), key=HEALTH_RANK.__getitem__)
    verdict = HEALTH_VERDICT[worst]
    ordered = sorted(components.items(), key=lambda kv: (-HEALTH_RANK[kv[1]["status"]], kv[0]))
    return {
        "mode": "ADVISORY",
        "verdict": verdict,
        "light": HEALTH_LIGHT[verdict],
        "components": {name: dict(c) for name, c in ordered},
        "reasons": [f"{name} ({c['detail']})" for name, c in ordered if c["status"] != "OK"],
        "advisory": True,
    }


def _health_rollup(rows: list[tuple[str, Mapping[str, Any]]]) -> dict[str, Any] | None:
    if not rows:
        return None
    rank = {"HEALTHY": 0, "UNOBSERVED": 1, "WATCH": 2, "AT_RISK": 3}
    verdict = max((h["verdict"] for _, h in rows), key=rank.__getitem__)
    counts = {v: sum(1 for _, h in rows if h["verdict"] == v) for v in rank}
    return {
        "mode": "ADVISORY",
        "verdict": verdict,
        "light": HEALTH_LIGHT[verdict],
        "leaves": len(rows),
        "counts": {k: v for k, v in counts.items() if v},
        "at_risk": [ref for ref, h in rows if h["verdict"] == "AT_RISK"],
        "advisory": True,
    }


# --------------------------------------------------------------------------
# conservation: re-planning must not create or destroy progress
# --------------------------------------------------------------------------


def _item_shares(indexed: Mapping[str, Any]) -> dict[tuple[int, str], Fraction]:
    """Exact share of the whole programme carried by every unit and delivery gate.

    share = Π(sibling weight / (Σ sibling weights + reserve)) down the lineage, then the unit's slice of the
    leaf's coder share (or the gate's slice of the delivery weight). The shares plus every reserve sum to 1, so
    adding, dropping, reweighting or moving work changes somebody's share unless the plan conserves it.
    """
    nodes = indexed["nodes"]
    shares: dict[tuple[int, str], Fraction] = {}

    def descend(ref: str, share: Fraction) -> None:
        node = nodes[ref]
        if node["kind"] == "LEAF":
            unit_total = sum(u["weight"] for u in node["units"])
            delivery_total = node["coder_weight"] + sum(g["weight"] for g in node["delivery_gates"])
            coder = share * Fraction(node["coder_weight"], delivery_total)
            for u in node["units"]:
                shares[(node["number"], u["id"])] = coder * Fraction(u["weight"], unit_total)
            for g in node["delivery_gates"]:
                shares[(node["number"], f"gate:{g['id']}")] = share * Fraction(g["weight"], delivery_total)
            return
        den = sum(nodes[c]["weight"] for c in node["children"]) + node["reserve_weight"]
        for child in node["children"]:
            descend(child, share * Fraction(nodes[child]["weight"], den))

    descend(indexed["root"], Fraction(1))
    return shares


def _lineage_numbers(indexed: Mapping[str, Any], number: int) -> set[int]:
    ref = indexed["by_number"].get(number)
    return {indexed["nodes"][r]["number"] for r in lineage(indexed, ref)} if ref else {number}


def _item_text(indexed: Mapping[str, Any], key: tuple[int, str]) -> str:
    return f"{indexed['by_number'].get(key[0], f'#{key[0]}')}:{key[1]}"


def _points_text(share: Fraction, scale: int) -> str:
    points = share * scale
    return str(points.numerator) if points.denominator == 1 else f"{float(points):.2f}"


def _policy_weakened(old: Mapping[str, Any], new: Mapping[str, Any]) -> list[str]:
    """Ways in which `new` is a looser gate than `old`. Tightening is never reported."""
    rank = {m: i for i, m in enumerate(POLICY_MODES)}
    out = []
    if rank[new["mode"]] < rank[old["mode"]]:
        out.append(f"mode {old['mode']} -> {new['mode']}")
    for section, key, looser_is_higher in (
        ("units", "max", True),
        ("units", "min", False),
        ("units", "max_share_percent", True),
        ("leaf_budget", "target_loc", True),
        ("leaf_budget", "hard_loc", True),
        ("leaf_budget", "target_minutes", True),
        ("leaf_budget", "hard_minutes", True),
    ):
        before, after = old[section][key], new[section][key]
        if (after > before) if looser_is_higher else (after < before):
            out.append(f"{section}.{key} {before} -> {after}")
    if new["min_leaf_target_loc"] < old["min_leaf_target_loc"]:
        out.append(f"min_leaf_target_loc {old['min_leaf_target_loc']} -> {new['min_leaf_target_loc']}")
    out += [f"require.{k} dropped" for k, v in old["require"].items() if v and not new["require"][k]]
    return out


def graph_diff(old_graph: Any, new_graph: Any) -> dict[str, Any]:
    """Judge a re-plan (split, merge, reweight, drop) against the plan it replaces. Pure.

    A unit or gate keeps its exact programme share across a re-plan unless a NEW `plan_updates` entry covers the
    change, so splitting a leaf can neither manufacture progress nor delete it. Plan updates are append-only
    history; each new one must carry `owner_authorized: true` and an `owner_basis`. Weakening the decomposition
    policy needs a POLICY_CHANGE update. `owner_authorized` is a record for review, not proof of identity.
    """
    old, new = validate_graph(old_graph), validate_graph(new_graph)
    old_shares, new_shares = _item_shares(old), _item_shares(new)
    scale = new["total_weight"]
    findings: list[dict[str, str]] = []

    def add(code: str, detail: str, severity: str = "BLOCKER") -> None:
        findings.append(_finding(code, detail, severity))

    previous = {u["id"]: u for u in old["plan_updates"]}
    current = {u["id"]: u for u in new["plan_updates"]}
    for pid, u in previous.items():
        if pid not in current or current[pid]["raw"] != u["raw"]:
            add("PLAN_HISTORY_CHANGED", f"plan update {pid} was removed or edited; plan_updates is append-only")
    fresh = [u for u in new["plan_updates"] if u["id"] not in previous]
    for u in fresh:
        if not (u["owner_authorized"] and u["owner_basis"]):
            add("PLAN_UPDATE_UNAUTHORISED", f"{u['id']} ({u['kind']}) needs owner_authorized: true and an owner_basis")
    used: set[str] = set()

    def covered(kinds: set[str], key: tuple[int, str], scope_numbers: set[int]) -> bool:
        for u in fresh:
            if u["kind"] not in kinds:
                continue
            scope = set(u["node_numbers"])
            if u["kind"] == "UNIT_DROPPED":  # dropping a unit re-normalises the rest of its leaf
                scope |= {n for n, _ in u["unit_keys"]}
            if key in u["unit_keys"] or scope & scope_numbers:
                used.add(u["id"])
                return True
        return False

    origin: dict[tuple[int, str], tuple[int, str] | None] = {}
    claims: dict[tuple[int, str], list[tuple[int, str]]] = {}
    for key in sorted(new_shares):
        number, item = key
        source: tuple[int, str] | None = key if key in old_shares else None
        if source is None and not item.startswith("gate:"):
            leaf = new["nodes"][new["by_number"][number]]
            moved_from = next((u["moved_from"] for u in leaf["units"] if u["id"] == item and u["moved_from"]), None)
            if moved_from is not None:
                candidate = (ref_number(moved_from), item)
                if candidate in old_shares:
                    source = candidate
                else:
                    add("MOVE_ORIGIN_UNKNOWN", f"{_item_text(new, key)} claims moved_from {moved_from} but that leaf had no {item}")
        origin[key] = source
        if source is not None:
            claims.setdefault(source, []).append(key)
    for source, keys in sorted(claims.items()):
        if len(keys) > 1:
            add("MOVE_DUPLICATE", f"{_item_text(old, source)} is claimed by {_id_list(_item_text(new, k) for k in keys)}")

    dropped = []
    for source in sorted(old_shares):
        if source in claims:
            continue
        dropped.append(_item_text(old, source))
        if not covered({"UNIT_DROPPED", "SCOPE_REDUCTION"}, source, _lineage_numbers(old, source[0])):
            add("UNIT_LOST", f"{_item_text(old, source)} no longer exists and no UNIT_DROPPED or SCOPE_REDUCTION update covers it")

    drift: list[dict[str, str]] = []
    for key, source in origin.items():
        if source is None or new_shares[key] == old_shares[source]:
            continue
        diluted = new_shares[key] < old_shares[source]
        kinds = {"SCOPE_EXPANSION", "UNIT_REWEIGHT"} if diluted else {"SCOPE_REDUCTION", "UNIT_REWEIGHT", "UNIT_DROPPED"}
        row = {
            "item": _item_text(new, key),
            "points_before": _points_text(old_shares[source], scale),
            "points_after": _points_text(new_shares[key], scale),
        }
        drift.append(row)
        if not covered(kinds, key, _lineage_numbers(new, key[0]) | _lineage_numbers(old, source[0])):
            add(
                "POINTS_DRIFT",
                f"{row['item']} {row['points_before']} -> {row['points_after']} points; "
                f"no {' / '.join(sorted(kinds))} update covers it",
            )

    weakened = _policy_weakened(old["policy"], new["policy"])
    policy_updates = [u for u in fresh if u["kind"] == "POLICY_CHANGE"]
    if old["policy"] != new["policy"]:
        used.update(u["id"] for u in policy_updates)
    if weakened and not policy_updates:
        add("POLICY_WEAKENED", f"{'; '.join(weakened)} without a POLICY_CHANGE update")
    for u in fresh:
        if u["id"] not in used:
            add("PLAN_UPDATE_UNUSED", f"{u['id']} ({u['kind']}) covers nothing in this change", "ADVISORY")

    ordered = sorted(findings, key=lambda f: (f["severity"] != "BLOCKER", f["code"], f["detail"]))
    return {
        "schema": DIFF_SCHEMA,
        "authority": AUTHORITY,
        "conserved": not any(f["severity"] == "BLOCKER" for f in ordered),
        "findings": ordered,
        "drift": drift,
        "summary": {
            "items_before": len(old_shares),
            "items_after": len(new_shares),
            "moved": sum(1 for k, s in origin.items() if s is not None and s != k),
            "added": sum(1 for s in origin.values() if s is None),
            "dropped": len(dropped),
            "new_plan_updates": len(fresh),
        },
    }


def render_graph_diff(report: Mapping[str, Any]) -> str:
    s = report["summary"]
    lines = [
        f"PLAN CONSERVATION — {'CONSERVED' if report['conserved'] else 'NOT_CONSERVED'}",
        f"items {s['items_before']} -> {s['items_after']} · moved {s['moved']} · added {s['added']} · dropped {s['dropped']}"
        f" · new plan updates {s['new_plan_updates']}",
    ]
    lines += [f"  {f['severity']:<8} {f['code']}: {f['detail']}" for f in report["findings"]]
    return "\n".join(lines)


# --------------------------------------------------------------------------
# leaf computation: P from claimed units, E only from CURRENT evidence
# --------------------------------------------------------------------------


def _fraction(num: int, den: int) -> Fraction:
    return Fraction(num, den) if den else Fraction(0)


def _observed_material(observation: Mapping[str, Any]) -> dict[str, Any]:
    """The provider-observed facts about a leaf's material that are safe to publish, validated and typed."""
    out: dict[str, Any] = {}
    base = observation.get("base_sha")
    if isinstance(base, str) and _SHA.fullmatch(base):
        out["base_sha"] = base
    pr_state = str(observation.get("pr_state") or "").upper()
    if pr_state in _PR_ACTIVITY_STATES:
        out["pr_state"] = pr_state
    for key in ("ahead_by", "behind_by"):
        value = observation.get(key)
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            out[key] = value
    return out


def _provider_signal(observation: Mapping[str, Any]) -> str | None:
    """What the provider shows about a leaf's work, independent of anything an agent published."""
    pr_state = str(observation.get("pr_state") or "").upper()
    if pr_state in _PR_ACTIVITY_STATES:
        return f"PR_{pr_state}"
    ahead = observation.get("ahead_by")
    if isinstance(ahead, int) and not isinstance(ahead, bool) and ahead > 0:
        return f"BRANCH_AHEAD_{ahead}"
    return None


def compute_leaf(
    node: Mapping[str, Any],
    records: list[Mapping[str, Any]],
    observation: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Pure leaf projection. `records` are accepted facts for this leaf, oldest first."""
    observation = dict(observation or {})
    observed_candidate = observation.get("candidate_sha")
    if observed_candidate is not None and not _SHA.fullmatch(str(observed_candidate)):
        observed_candidate = None
    declared = {u["id"]: u["weight"] for u in node["units"]}
    gate_weights = {g["id"]: g["weight"] for g in node["delivery_gates"]}
    warnings: list[str] = []

    claims: dict[str, dict[str, Any]] = {}
    gate_claims: dict[str, dict[str, Any]] = {}
    latest: Mapping[str, Any] | None = None
    result_fact: Mapping[str, Any] | None = None
    # Most recent STATED value per field: a reviewer's gates-only record must not reset the Coder's
    # blocker / next unit / owner action / activity back to defaults.
    last_next: Mapping[str, Any] = {}
    last_activity = None
    last_blocker = None
    last_owner_action = None
    handover_offer: Mapping[str, Any] | None = None
    handover_accept: Mapping[str, Any] | None = None
    entry_prepared: Mapping[str, Any] | None = None
    entry_end: Mapping[str, Any] | None = None
    for rec in records:
        latest = rec
        if rec.get("next") is not None:
            last_next = rec["next"]
        if rec.get("activity") is not None:
            last_activity = rec["activity"]
        if rec.get("blocker") is not None:
            last_blocker = rec["blocker"]
        if rec.get("owner_action") is not None:
            last_owner_action = rec["owner_action"]
        if rec.get("handover") is not None:
            h = dict(rec["handover"])
            h["_source"] = rec.get("_source")
            h["_candidate_sha"] = (rec.get("material") or {}).get("candidate_sha")
            if h.get("event") == "OFFERED":
                handover_offer = h
                handover_accept = None
            else:
                handover_accept = h
        if rec.get("entry") is not None:
            e = dict(rec["entry"])
            e["_source"] = rec.get("_source")
            e["_candidate_sha"] = (rec.get("material") or {}).get("candidate_sha")
            if e.get("event") == "PREPARED":
                entry_prepared = e
            else:
                entry_end = e
        record_candidate = (rec.get("material") or {}).get("candidate_sha")
        record_pr = (rec.get("material") or {}).get("pr")
        for unit in rec.get("units") or []:
            if unit["id"] not in declared:
                warnings.append(f"UNKNOWN_UNIT:{unit['id']}")
                continue
            claims[unit["id"]] = {
                "state": unit["state"],
                "result": unit.get("result") or "NOT_RUN",
                "evidence_refs": [str(r) for r in unit.get("evidence_refs") or []],
                "candidate_sha": unit.get("candidate_sha") or record_candidate,
                "contract_digest": unit.get("contract_digest"),
                "pr": record_pr,
                "source": rec.get("_source"),
            }
        for gate in rec.get("gates") or []:
            if gate["id"] not in gate_weights:
                warnings.append(f"UNKNOWN_GATE:{gate['id']}")
                continue
            gate_claims[gate["id"]] = {
                "result": gate["result"],
                "evidence_refs": [str(r) for r in gate.get("evidence_refs") or []],
                "candidate_sha": gate.get("candidate_sha") or record_candidate,
                "pr": record_pr,
            }
        if rec.get("result") is not None:
            result_fact = rec["result"]

    def unit_gap(uid: str, claim: Mapping[str, Any]) -> str | None:
        if claim["result"] not in node["verification"]:
            return f"RESULT_NOT_ACCEPTED({claim['result']})"
        if not claim["evidence_refs"]:
            return "NO_EVIDENCE_REFS"
        if node.get("primary_pr") and claim.get("pr") and not same_ref(node["primary_pr"], claim["pr"]):
            return "PR_MISMATCH"
        if observed_candidate is None:
            return "CANDIDATE_UNOBSERVED"
        if claim["candidate_sha"] != observed_candidate:
            return "CANDIDATE_MISMATCH"
        digest = node.get("contract_digest")
        if digest and claim.get("contract_digest") != digest:
            return "CONTRACT_DIGEST_MISMATCH"
        return None

    total = sum(declared.values())
    complete_weight = 0
    evidenced_weight = 0
    unit_rows = []
    gaps: list[dict[str, str]] = []
    for uid, weight in declared.items():
        claim = claims.get(uid)
        complete = bool(claim and claim["state"] == "COMPLETE")
        gap = unit_gap(uid, claim) if complete and claim else None
        current = complete and gap is None
        if complete:
            complete_weight += weight
        if current:
            evidenced_weight += weight
        if gap:
            gaps.append({"unit": uid, "reason": gap})
        unit_rows.append(
            {
                "id": uid,
                "weight": weight,
                "claimed_state": claim["state"] if claim else "NOT_STARTED",
                "complete": complete,
                "evidence_current": current,
                "gap": gap,
                "evidence_refs": claim["evidence_refs"] if claim else [],
                "evidence_candidate_sha": claim["candidate_sha"] if claim else None,
            }
        )
    P = _fraction(complete_weight, total)
    E = _fraction(evidenced_weight, total)

    gate_rows = []
    gate_total = sum(gate_weights.values())
    gate_passed = 0
    gate_evidenced = 0
    for gid, weight in gate_weights.items():
        claim = gate_claims.get(gid)
        passed = bool(claim and claim["result"] == "PASSED")
        current = bool(
            passed
            and claim["evidence_refs"]
            and observed_candidate is not None
            and claim["candidate_sha"] == observed_candidate
        )
        if passed:
            gate_passed += weight
        if current:
            gate_evidenced += weight
        gate_rows.append({"id": gid, "weight": weight, "passed": passed, "evidence_current": current})
    coder_weight = node["coder_weight"]
    delivery_total = coder_weight + gate_total
    D = (coder_weight * P + gate_passed) / delivery_total
    DE = (coder_weight * E + gate_evidenced) / delivery_total

    reasons = {g["reason"].split("(")[0] for g in gaps}
    if not gaps:
        health = "CURRENT"
    elif "CANDIDATE_UNOBSERVED" in reasons:
        health = "UNVERIFIABLE"
    elif "CANDIDATE_MISMATCH" in reasons or "PR_MISMATCH" in reasons:
        health = "STALE_CANDIDATE"
    else:
        health = "GAP"

    incomplete = [row["id"] for row in unit_rows if not row["complete"]]
    next_unit = last_next.get("unit")
    active_unit = next_unit if next_unit in incomplete else (incomplete[0] if incomplete else None)
    active_plan_unit = next((item for item in node["units"] if item["id"] == active_unit), None)
    successor_policy = (active_plan_unit or {}).get("successor_policy")

    handover_projection = None
    if handover_offer is not None:
        accepted = handover_accept is not None
        offered_challenge_digest = handover_offer.get("challenge_digest")
        expected_question_ids = list(handover_offer.get("question_ids") or [])
        accepted_answers = list((handover_accept or {}).get("answer_evidence") or [])
        answered_question_ids = [row.get("question_id") for row in accepted_answers if isinstance(row, Mapping)]
        accepted_challenge_digest = (handover_accept or {}).get("challenge_digest")
        challenge_identity_matched = (
            offered_challenge_digest is None
            or accepted_challenge_digest == offered_challenge_digest
        )
        coverage_matched = (
            offered_challenge_digest is None
            or answered_question_ids == expected_question_ids
        )
        answers_grounded = bool(
            offered_challenge_digest is None
            or (
                accepted_answers
                and all(row.get("evidence_refs") and row.get("live_refs") for row in accepted_answers if isinstance(row, Mapping))
            )
        )
        by_id = {
            row.get("question_id"): row
            for row in accepted_answers
            if isinstance(row, Mapping) and row.get("question_id")
        }
        q1_grounded = (
            "Q1" not in expected_question_ids
            or any(live.get("kind") == "REPOSITORY" for live in (by_id.get("Q1") or {}).get("live_refs") or [] if isinstance(live, Mapping))
        )
        q2_authority = (
            "Q2" not in expected_question_ids
            or bool((by_id.get("Q2") or {}).get("authority_classifications"))
        )
        root_classification = (handover_accept or {}).get("root_classification")
        q3_rooted = (
            "Q3" not in expected_question_ids
            or bool(root_classification and root_classification.get("evidence_refs"))
        )
        challenge_evidence_complete = bool(
            offered_challenge_digest is None
            or (
                challenge_identity_matched
                and coverage_matched
                and answers_grounded
                and q1_grounded
                and q2_authority
                and q3_rooted
            )
        )
        matched = bool(
            accepted
            and handover_accept.get("mode") == handover_offer.get("mode")
            and handover_accept.get("decision_at_risk") == handover_offer.get("decision_at_risk")
            and handover_accept.get("frontier_digest") == handover_offer.get("frontier_digest")
            and handover_accept.get("predecessor_ref") == handover_offer.get("_source")
            and handover_accept.get("_candidate_sha") == handover_offer.get("_candidate_sha")
            and challenge_identity_matched
        )
        if accepted and not matched:
            warnings.append("HANDOVER_ACCEPTANCE_MISMATCH")
        if accepted and offered_challenge_digest is not None and not challenge_evidence_complete:
            warnings.append("HANDOVER_CHALLENGE_EVIDENCE_INCOMPLETE")
        if successor_policy and handover_offer.get("mode") != successor_policy.get("mode"):
            warnings.append("HANDOVER_MODE_DIFFERS_FROM_ACTIVE_UNIT_POLICY")
        if (
            successor_policy
            and successor_policy.get("decision_at_risk")
            and handover_offer.get("decision_at_risk") != successor_policy.get("decision_at_risk")
        ):
            warnings.append("HANDOVER_DECISION_DIFFERS_FROM_ACTIVE_UNIT_POLICY")
        if not accepted:
            handover_status = "HANDOFF"
        elif matched and handover_accept.get("result") == "RECONCILED" and challenge_evidence_complete:
            handover_status = "RECONCILED"
        else:
            handover_status = "RECONSTRUCTING"
        handover_projection = {
            "status": handover_status,
            "mode": handover_offer.get("mode"),
            "decision_at_risk": handover_offer.get("decision_at_risk"),
            "frontier_digest": handover_offer.get("frontier_digest"),
            "challenge_digest": offered_challenge_digest,
            "expected_question_ids": expected_question_ids,
            "answered_question_ids": answered_question_ids,
            "challenge_evidence_complete": challenge_evidence_complete,
            "root_classification": (
                root_classification.get("classification")
                if isinstance(root_classification, Mapping)
                else None
            ),
            "predecessor_ref": handover_accept.get("predecessor_ref") if accepted else None,
            "result": handover_accept.get("result") if accepted else None,
            "matched": matched,
        }

    superseded_by = (result_fact or {}).get("superseded_by")
    claims_complete = bool(
        result_fact
        and result_fact.get("scope") == "RESPONSIBILITY"
        and result_fact.get("responsibility_complete") == "YES"
    )
    if claims_complete and incomplete:
        warnings.append("RESULT_CLAIMS_COMPLETE_BUT_UNITS_OPEN")
    if claims_complete and not incomplete and health != "CURRENT":
        warnings.append("COMPLETE_CLAIM_WITHOUT_CURRENT_EVIDENCE")
    if claims_complete and not incomplete and delivery_total > coder_weight and gate_passed < gate_total:
        warnings.append("COMPLETE_CLAIM_WITH_OPEN_DELIVERY_GATES")
    if claims_complete and not incomplete and gate_passed == gate_total and gate_evidenced < gate_total:
        warnings.append("COMPLETE_CLAIM_WITH_UNEVIDENCED_DELIVERY_GATES")

    activity = last_activity
    liveness = observation.get("liveness")
    if liveness not in OBSERVED_LIVENESS:
        liveness = None

    # No accepted facts but the provider shows work: the numbers are a lower bound, not the truth.
    provider_signal = _provider_signal(observation)
    unmaterialized = not records and provider_signal is not None
    if unmaterialized:
        active_unit = None  # no fact says which unit is next
        warnings.append(f"UNMATERIALIZED:{provider_signal}")

    if superseded_by:
        lifecycle = "SUPERSEDED"
    elif claims_complete and not incomplete and health == "CURRENT" and D == 1 and DE == 1:
        lifecycle = "COMPLETE"
    elif unmaterialized:
        lifecycle = "UNMATERIALIZED"
    elif not records and liveness is None:
        lifecycle = "NOT_STARTED"
    elif activity == "PAUSED" and handover_projection is None:
        lifecycle = "PAUSED"
    elif activity == "RECOVERING":
        lifecycle = "RECOVERING"
    else:
        lifecycle = "ACTIVE"

    if lifecycle in {"COMPLETE", "SUPERSEDED", "NOT_STARTED", "PAUSED"}:
        state = lifecycle
    elif liveness == "STALE":
        state = "STALE"
    elif lifecycle == "UNMATERIALIZED":
        state = "UNMATERIALIZED"
    elif health == "STALE_CANDIDATE":
        state = "EVIDENCE_STALE"
    elif health in {"GAP", "UNVERIFIABLE"}:
        state = "EVIDENCE_GAP"
    elif handover_projection and handover_projection["status"] == "HANDOFF":
        state = "HANDOFF"
    elif handover_projection and handover_projection["status"] == "RECONSTRUCTING":
        state = "RECONSTRUCTING"
    elif liveness == "QUIET":
        state = "QUIET"
    elif lifecycle == "RECOVERING":
        state = "RECOVERING"
    elif activity and activity.startswith("WAITING"):
        state = activity
    else:
        state = "ACTIVE"

    material_candidate = observed_candidate
    evidence_candidate = ((latest or {}).get("material") or {}).get("candidate_sha")
    if material_candidate is None:
        relation = "MATERIAL_UNKNOWN"
    elif evidence_candidate is None:
        relation = "EVIDENCE_UNKNOWN"
    elif evidence_candidate == material_candidate:
        relation = "ALIGNED"
    else:
        relation = "CANDIDATE_MOVED"

    owner_action = last_owner_action
    if latest and owner_action is None:
        warnings.append("OWNER_ACTION_UNSTATED")
    result = {
        "lifecycle": lifecycle,
        "state": state,
        "active_unit": active_unit,
        "progress": {
            "P": percent(P),
            "E": percent(E),
            "D": percent(D),
            "DE": percent(DE),
            "ratio": {"P": ratio_text(P), "E": ratio_text(E), "D": ratio_text(D), "DE": ratio_text(DE)},
        },
        "_fractions": {"D": D, "DE": DE},
        "units": unit_rows,
        "gates": gate_rows,
        "evidence": {
            "health": health,
            "gaps": gaps,
            "latest_source": (records[-1].get("_source") if records else None),
        },
        "frontier": {
            "material_candidate": material_candidate,
            "evidence_candidate": evidence_candidate,
            "relation": relation,
        },
        "activity_epoch": len(records),
        "liveness": liveness,
        "next": {
            "unit": active_unit,
            "action": _one_line(last_next.get("action")) or None,
        },
        "blocker": _one_line(last_blocker or "NONE"),
        "owner_action": _one_line(owner_action or "NONE"),
        "successor_policy": successor_policy,
        "warnings": warnings,
    }
    if handover_projection is not None:
        result["handover"] = handover_projection
    if entry_prepared is not None or entry_end is not None:
        result["entry"] = {
            "prepared": dict(entry_prepared) if entry_prepared is not None else None,
            "execution_end": dict(entry_end) if entry_end is not None else None,
        }
    if unmaterialized:
        result["materialization"] = {"status": "UNMATERIALIZED", "provider_signal": provider_signal}
    return result


# --------------------------------------------------------------------------
# title grammar
# --------------------------------------------------------------------------

_PREFIX = re.compile(
    "^(?P<light>[" + _LIGHTS + r"])\s+\[(?P<path>[^\[\]]*)\]\s+(?P<scope>R|Φ|Π):(?P<dm>[PD])(?P<primary>\d{1,3})/E(?P<evidence>\d{1,3})"
    r"(?P<tail>(?:\s+·\s+[^—·]+?)*)(?:\s+—\s+(?P<base>.*))?$",
    re.DOTALL,
)
_LEGACY_PREFIX = re.compile("^[" + _LIGHTS + r"]\s+\{P\d+%[^{}]*\}\s+(?P<base>.*)$", re.DOTALL)
_LEGACY_SUFFIX = re.compile(r"\s+\{P\d+% · E\d+% · [^{}]+\}\s*$")


def split_title(title: str) -> tuple[dict[str, str] | None, str]:
    """Return (generated-part info or None, human base title)."""
    text = str(title or "")
    match = _PREFIX.match(text)
    if match:
        info = {k: (v or "") for k, v in match.groupdict().items() if k != "base"}
        return info, (match.group("base") or "").strip()
    legacy = _LEGACY_PREFIX.match(text)
    if legacy:
        return {"legacy": "PREFIX"}, legacy.group("base").strip()
    stripped = _LEGACY_SUFFIX.sub("", text).strip()
    if stripped != text.strip():
        return {"legacy": "SUFFIX"}, stripped
    return None, text.strip()


def _path_text(indexed: Mapping[str, Any], ref: str) -> str:
    return " › ".join(f"#{indexed['nodes'][r]['number']}" for r in lineage(indexed, ref))


def render_title(prefix: str, base: str) -> str:
    base = (base or "").strip()
    if not base:
        return prefix
    text = f"{prefix} — {base}"
    if len(text) <= TITLE_LIMIT:
        return text
    room = TITLE_LIMIT - len(prefix) - len(" — ") - 1
    return f"{prefix} — {base[: max(room, 1)].rstrip()}…" if room > 0 else prefix[:TITLE_LIMIT]


def title_drift(actual_title: str, expected_prefix: str, expected_base: str | None = None) -> dict[str, Any]:
    """Classify a provider title against the derived projection."""
    info, base = split_title(actual_title)
    expected = render_title(expected_prefix, expected_base if expected_base is not None else base)
    if actual_title.strip() == expected.strip():
        return {"status": "OK", "expected": expected}
    if info is None:
        # Projection notation outside the generated grammar is still an agent-authored projection.
        status = "STALE_OR_HAND_EDITED" if _NOTATION.search(str(actual_title)) else "MISSING_PROJECTION"
    elif "legacy" in info:
        status = "LEGACY_FORMAT"
    else:
        status = "STALE_OR_HAND_EDITED"
    return {"status": status, "expected": expected, "actual": actual_title, "base": base}


# --------------------------------------------------------------------------
# projection
# --------------------------------------------------------------------------


def _frontier_summary(indexed: Mapping[str, Any], leaves: list[str]) -> str:
    parts = []
    for ref in leaves[:2]:
        n = indexed["nodes"][ref]
        pr = n.get("primary_pr")
        parts.append(f"#{n['number']}/PR#{ref_number(pr)}" if pr else f"#{n['number']}")
    if len(leaves) > 2:
        parts.append(f"+{len(leaves) - 2}")
    return ", ".join(parts)


def partition_ledger(
    indexed: Mapping[str, Any], ledger: Iterable[Mapping[str, Any]]
) -> tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]]]:
    """Validate every facts record. Invalid/forbidden/unknown records are rejected, never trusted."""
    accepted: dict[str, list[tuple[int, int, dict[str, Any]]]] = {}
    rejected: list[dict[str, Any]] = []
    leaves = {n["number"]: ref for ref, n in indexed["nodes"].items() if n["kind"] == "LEAF"}
    for position, entry in enumerate(ledger):
        facts = entry.get("facts") if isinstance(entry, Mapping) else None
        source = str((entry or {}).get("source") or f"ledger[{position}]")
        errors = validate_facts(facts)
        if not errors and (entry or {}).get("untrusted_author"):
            errors = [f"author {(entry or {})['untrusted_author']} is not a trusted fact author for this programme"]
        if not errors:
            number = ref_number(facts["responsibility"]["issue"])
            leaf_ref = leaves.get(number)
            if leaf_ref is None:
                errors = [f"responsibility.issue: {facts['responsibility']['issue']} is not a declared LEAF"]
            else:
                declared_id = indexed["nodes"][leaf_ref].get("responsibility_id")
                claimed_id = facts["responsibility"].get("id")
                if declared_id and claimed_id and declared_id != claimed_id:
                    errors = [f"responsibility.id: {claimed_id} does not match planned {declared_id}"]
        if errors:
            rejected.append({"source": source, "reasons": errors})
            continue
        order = entry.get("order")
        record = dict(facts)
        record["_source"] = source
        accepted.setdefault(leaf_ref, []).append(
            (int(order) if isinstance(order, int) and not isinstance(order, bool) else position, position, record)
        )
    return (
        {ref: [item[2] for item in sorted(rows, key=lambda r: (r[0], r[1]))] for ref, rows in accepted.items()},
        rejected,
    )


def project(
    graph: Any,
    ledger: Iterable[Mapping[str, Any]] = (),
    observations: Mapping[str, Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Recompute every node from the plan, accepted facts and observations."""
    ledger = list(ledger)
    indexed = validate_graph(graph)
    nodes = indexed["nodes"]
    observations = {ref_number(k): dict(v or {}) for k, v in (observations or {}).items()}
    accepted, rejected = partition_ledger(indexed, ledger)
    results: dict[str, dict[str, Any]] = {}
    mode = indexed["policy"]["mode"]

    for ref in indexed["order"]:
        if nodes[ref]["kind"] == "LEAF":
            results[ref] = compute_leaf(nodes[ref], accepted.get(ref, []), observations.get(nodes[ref]["number"]))
    if mode != "OFF":
        # Closed (COMPLETE/SUPERSEDED) leaves are history, not work to release: the gate skips them.
        closed = {ref for ref, leaf in results.items() if leaf["lifecycle"] in _TERMINAL}
        # In a released Proposal-V2 programme, future responsibilities are allowed
        # to remain unmaterialized. Re-evaluating claim coverage over only existing
        # leaves would falsely block the first admitted child. Instead, reuse the
        # same exact released-proposal and provider-binding verdict as decompose-check.
        if indexed["decomposition_proposal"] is None:
            plan_rows = _decomposition(indexed, closed)["leaves"]
        else:
            proposal_report = _proposal_decomposition(indexed)
            bound_by_number = {
                ref_number(binding["ref"]): binding["responsibility_id"]
                for binding in indexed["decomposition_proposal"]["bindings"]
            }
            plan_rows = {}
            for ref in indexed["order"]:
                if nodes[ref]["kind"] != "LEAF" or ref in closed:
                    continue
                rid = nodes[ref].get("responsibility_id")
                proposed = (
                    proposal_report["leaves"].get(rid)
                    if rid and bound_by_number.get(nodes[ref]["number"]) == rid
                    else None
                )
                if proposed is None:
                    plan_rows[ref] = {
                        "releasable": False,
                        "blockers": [{
                            "code": "PROPOSAL_BINDING_UNRESOLVED",
                            "detail": "Materialized leaf lacks its exact released responsibility/provider binding",
                        }],
                        "advisories": [],
                    }
                    continue
                blockers = list(proposed["blockers"])
                if proposal_report["release_state"] != "RELEASEABLE":
                    blockers.append({
                        "code": "PROPOSAL_NOT_RELEASEABLE",
                        "detail": "Released Proposal-V2 topology or provider bindings are not valid",
                    })
                plan_rows[ref] = {
                    "releasable": not blockers,
                    "blockers": blockers,
                    "advisories": list(proposed["advisories"]),
                }
        for ref, row in plan_rows.items():
            leaf = results[ref]
            leaf["plan"] = {
                "mode": mode,
                "releasable": row["releasable"],
                "blockers": row["blockers"],
                "advisories": row["advisories"],
            }
            if row["blockers"]:
                leaf["warnings"].append("DECOMPOSITION_BLOCKERS:" + ",".join(sorted({b["code"] for b in row["blockers"]})))
            if row["advisories"]:
                leaf["warnings"].append("DECOMPOSITION_ADVISORIES:" + ",".join(sorted({a["code"] for a in row["advisories"]})))
            if mode == "ENFORCED" and not row["releasable"] and leaf["state"] in _PLAN_OVERLAID_STATES:
                leaf["state"] = "NOT_RELEASEABLE"

    # Serial decomposition is an execution constraint, not documentation. Dependency readiness is derived only
    # from predecessor projections; agents never author it and it never changes P/E/D.
    for ref in indexed["order"]:
        if nodes[ref]["kind"] != "LEAF":
            continue
        declared_dependencies = list(nodes[ref]["depends_on"])
        blocking_dependencies = [
            {
                "ref": dep,
                "state": results[dep]["state"],
                "lifecycle": results[dep]["lifecycle"],
            }
            for dep in declared_dependencies
            if results[dep]["lifecycle"] != "COMPLETE"
        ]
        results[ref]["dependencies"] = {
            "declared": declared_dependencies,
            "ready": not blocking_dependencies,
            "blocking": blocking_dependencies,
        }
        if blocking_dependencies and results[ref]["state"] in {"ACTIVE", "NOT_STARTED"}:
            results[ref]["state"] = "WAITING_DEPENDENCY"

    health_mode = indexed["health_policy"]["mode"]
    if health_mode != "OFF":
        # Advisory telemetry for leaves that have started and are not finished: it adds a block, never a state or a number.
        for ref, leaf in results.items():
            if leaf["lifecycle"] in {"NOT_STARTED", "COMPLETE", "SUPERSEDED"}:
                continue
            seen = observations.get(nodes[ref]["number"]) or {}
            leaf["health"] = _health_block(
                _health_components(leaf, nodes[ref], seen, indexed["health_policy"], indexed["policy"]["leaf_budget"])
            )

    # R-READMODEL is leaf-scoped and advisory. It consumes the already-derived operational health plus
    # optional Agent Metrics observations, and is never consulted by state/progress/title/admission logic.
    for ref, leaf in results.items():
        if nodes[ref]["kind"] != "LEAF":
            continue
        seen = observations.get(nodes[ref]["number"]) or {}
        if "health" in leaf or "agent_quality" in seen:
            leaf["agent_health"] = _agent_health_read_model(leaf.get("health"), seen.get("agent_quality"))

    def visit(ref: str) -> dict[str, Any]:
        node = nodes[ref]
        if node["kind"] == "LEAF":
            return results[ref]
        child_rows = [(c, visit(c)) for c in node["children"]]
        den = sum(nodes[c]["weight"] for c, _ in child_rows) + node["reserve_weight"]
        D = sum(Fraction(nodes[c]["weight"]) * _node_fraction(r, "D") for c, r in child_rows) / den
        E = sum(Fraction(nodes[c]["weight"]) * _node_fraction(r, "DE") for c, r in child_rows) / den
        frontier = sorted(
            (leaf for leaf in _leaves_under(indexed, ref) if results[leaf]["lifecycle"] in _FRONTIER_LIFECYCLE),
            key=lambda r: nodes[r]["number"],
        )
        leaf_rows = [results[leaf] for leaf in _leaves_under(indexed, ref)]
        critical = [r for leaf, r in zip(_leaves_under(indexed, ref), leaf_rows) if nodes[leaf]["critical"]]
        states = {r["state"] for r in leaf_rows}
        unreleasable = [
            leaf for leaf in _leaves_under(indexed, ref) if (results[leaf].get("plan") or {}).get("releasable") is False
        ]
        unmaterialized = [leaf for leaf in _leaves_under(indexed, ref) if results[leaf]["lifecycle"] == "UNMATERIALIZED"]
        if D == 1 and all(r["lifecycle"] in _TERMINAL for r in leaf_rows) and node["reserve_weight"] == 0:
            state = "COMPLETE"
        elif any(r["state"] == "STALE" for r in critical):
            state = "STALE"
        elif unmaterialized:
            state = "UNMATERIALIZED"  # the roll-up below is a lower bound: it cannot see the work the ledger lacks
        elif "EVIDENCE_STALE" in states or "EVIDENCE_GAP" in states:
            state = "EVIDENCE_GAP"
        elif any(r["state"] in {"QUIET", "RECOVERING"} for r in critical) or "STALE" in states:
            state = "QUIET"
        elif any(r["state"].startswith("WAITING") for r in critical):
            state = "WAITING"
        elif frontier:
            state = "ACTIVE"
        elif mode == "ENFORCED" and unreleasable:
            state = "PLAN_GAP"  # nothing is moving and the plan, not the executors, is why
        else:
            state = "IDLE"
        warnings: list[str] = []
        if node["reserve_weight"]:
            warnings.append(f"UNDECOMPOSED_RESERVE:{node['reserve_weight']}")
        if unreleasable:
            warnings.append(f"DECOMPOSITION_BLOCKED_LEAVES:{len(unreleasable)}")
        if unmaterialized:
            warnings.append(f"UNMATERIALIZED_LEAVES:{len(unmaterialized)}")
        result = {
            "lifecycle": {"COMPLETE": "COMPLETE", "IDLE": "IDLE", "PLAN_GAP": "IDLE", "UNMATERIALIZED": "UNMATERIALIZED"}.get(
                state, "ACTIVE"
            ),
            "state": state,
            "progress": {
                "D": percent(D),
                "E": percent(E),
                "ratio": {"D": ratio_text(D), "E": ratio_text(E)},
            },
            "_fractions": {"D": D, "DE": E},
            "frontier": {"count": len(frontier), "leaves": frontier},
            "children": node["children"],
            "warnings": warnings,
        }
        if mode != "OFF":
            result["plan"] = {"mode": mode, "not_releasable": len(unreleasable), "leaves": unreleasable}
        if unmaterialized:
            result["materialization"] = {"status": "UNMATERIALIZED", "leaves": unmaterialized}
        if health_mode != "OFF":
            rollup = _health_rollup([(leaf, results[leaf]["health"]) for leaf in _leaves_under(indexed, ref) if "health" in results[leaf]])
            if rollup:
                result["health"] = rollup
        results[ref] = result
        return result

    visit(indexed["root"])

    out_nodes: dict[str, Any] = {}
    for ref in indexed["order"]:
        node = nodes[ref]
        data = results[ref]
        chain = lineage(indexed, ref)
        public = {k: v for k, v in data.items() if not k.startswith("_")}
        public.update(
            {
                "ref": ref,
                "kind": node["kind"],
                "identity": {
                    "programme": indexed["programme"].get("id"),
                    "root": indexed["root"],
                    "lineage": chain,
                    "responsibility_id": node.get("responsibility_id"),
                    "contract_digest": node.get("contract_digest"),
                },
                "weight": node["weight"],
            }
        )
        if node["kind"] == "LEAF":
            public["material"] = {
                "primary_pr": node.get("primary_pr"),
                "candidate_sha": data["frontier"]["material_candidate"],
                **_observed_material(observations.get(node["number"]) or {}),
            }
            prefix = _leaf_prefix(indexed, ref, data)
        elif node["kind"] == "INTERMEDIATE":
            prefix = _group_prefix(indexed, ref, data, "Φ", with_frontier=True)
        else:
            prefix = _group_prefix(indexed, ref, data, "Π", with_frontier=False)
        public["title_prefix"] = prefix
        public["light"] = STATE_LIGHT[data["state"]]
        out_nodes[ref] = public

    return {
        "schema": PROJECTION_SCHEMA,
        "authority": AUTHORITY,
        "protocol_line": PROTOCOL_LINE,
        "programme": indexed["programme"],
        "root": indexed["root"],
        "plan_digest": indexed["digest"],
        "nodes": out_nodes,
        "rejected_facts": rejected,
        "input_digest": canonical_digest(
            {
                "graph": indexed["digest"],
                "ledger": [
                    {"source": str((e or {}).get("source") or ""), "order": (e or {}).get("order"), "facts": (e or {}).get("facts")}
                    for e in ledger
                ],
                "observations": {str(k): v for k, v in sorted(observations.items())},
            }
        ),
    }


def _node_fraction(result: Mapping[str, Any], key: str) -> Fraction:
    return result["_fractions"][key]


def _leaves_under(indexed: Mapping[str, Any], ref: str) -> list[str]:
    node = indexed["nodes"][ref]
    if node["kind"] == "LEAF":
        return [ref]
    out: list[str] = []
    for child in node["children"]:
        out.extend(_leaves_under(indexed, child))
    return out


def _leaf_prefix(indexed: Mapping[str, Any], ref: str, data: Mapping[str, Any]) -> str:
    node = indexed["nodes"][ref]
    pr = node.get("primary_pr")
    path = _path_text(indexed, ref) + (f" → PR#{ref_number(pr)}" if pr else "")
    p = data["progress"]
    tokens = [f"R:P{p['P']}/E{p['E']}"]
    if data["active_unit"]:
        tokens.append(data["active_unit"])
    elif data["state"] != "COMPLETE":
        tokens.append("NO_ACTIVE_UNIT")
    tokens.append(data["state"])
    return f"{STATE_LIGHT[data['state']]} [{path}] " + " · ".join(tokens)


def _group_prefix(
    indexed: Mapping[str, Any], ref: str, data: Mapping[str, Any], scope: str, *, with_frontier: bool
) -> str:
    path = _path_text(indexed, ref)
    leaves = data["frontier"]["leaves"]
    if with_frontier and leaves:
        path += " → " + _frontier_summary(indexed, leaves)
    p = data["progress"]
    light = STATE_LIGHT[data["state"]]
    return f"{light} [{path}] {scope}:D{p['D']}/E{p['E']} · F{data['frontier']['count']} · {data['state']}"


def expected_titles(projection: Mapping[str, Any], base_titles: Mapping[str, str]) -> dict[str, str]:
    """Derive the exact issue title for every node from the current human base titles."""
    out = {}
    for ref, node in projection["nodes"].items():
        _, base = split_title(base_titles.get(ref, ""))
        out[ref] = render_title(node["title_prefix"], base)
    return out


# --------------------------------------------------------------------------
# continuation admission: reconstruct, never continue from conversation memory
# --------------------------------------------------------------------------


def classify_continuation(text: str) -> bool:
    return bool(CONTINUATION_COMMANDS.match(str(text or "")))


def _takeover_entry_requirement(owner_intent: Any) -> dict[str, Any] | None:
    if owner_intent is None:
        return None
    if not isinstance(owner_intent, Mapping):
        raise DelpError("owner_intent: must be a mapping")
    payload = owner_intent.get("owner_intent") if isinstance(owner_intent.get("owner_intent"), Mapping) else owner_intent
    intent = owner_intent.get("intent")
    deliverables = payload.get("requested_deliverables") or []
    kinds = {
        row.get("type")
        for row in deliverables
        if isinstance(row, Mapping) and isinstance(row.get("type"), str)
    }
    takeover = intent == "TAKEOVER_RECONCILE" or {
        "ENTRY_RECONCILIATION", "PHASE_PLAN_REFRESH", "BOUNDED_CHILD_BLOCK"
    }.issubset(kinds)
    if not takeover:
        return None
    source_ref = payload.get("source_ref")
    if not isinstance(source_ref, str) or not source_ref.strip():
        return {"error": "OWNER_INTENT_SOURCE_REQUIRED", "detail": "takeover/lateral admission requires durable owner_intent.source_ref"}
    basis = {
        "source_ref": source_ref,
        "verbatim_request": payload.get("verbatim_request"),
        "target": payload.get("target"),
        "requested_deliverables": deliverables,
        "boundary_constraints": payload.get("boundary_constraints") or [],
    }
    return {"session_digest": canonical_digest(basis), "source_ref": source_ref}


def entry_session_digest(owner_intent: Any) -> str:
    requirement = _takeover_entry_requirement(owner_intent)
    if requirement is None:
        raise DelpError("owner_intent is not a takeover/lateral entry")
    if requirement.get("error"):
        raise DelpError(str(requirement["detail"]))
    return str(requirement["session_digest"])


def _entry_admission(
    projection: Mapping[str, Any], leaf_ref: str, owner_intent: Any
) -> dict[str, Any] | None:
    requirement = _takeover_entry_requirement(owner_intent)
    if requirement is None:
        return None
    if requirement.get("error"):
        return {"code": requirement["error"], "detail": requirement["detail"]}
    leaf = projection["nodes"][leaf_ref]
    plan = leaf.get("plan")
    if not plan or plan.get("mode") != "ENFORCED" or not plan.get("releasable"):
        return {
            "code": "ENTRY_PLAN_NOT_RELEASEABLE",
            "detail": "takeover/lateral coding requires the current bounded child to pass the ENFORCED decomposition gate",
        }
    prepared = (leaf.get("entry") or {}).get("prepared")
    if not prepared:
        return {
            "code": "ENTRY_PREPARED_EVIDENCE_MISSING",
            "detail": "publish current PREPARED entry evidence after reconciliation, phase-plan refresh and bounded-child materialization",
        }
    if prepared.get("session_digest") != requirement["session_digest"]:
        return {"code": "ENTRY_OWNER_SESSION_MISMATCH", "detail": "PREPARED evidence is not bound to the active Owner entry request"}
    if prepared.get("plan_digest") != projection.get("plan_digest"):
        return {"code": "ENTRY_PLAN_STALE", "detail": "PREPARED evidence covers a different execution graph; refresh the phase plan and evidence"}
    try:
        child_matches = same_ref(prepared.get("child_ref"), leaf_ref)
    except DelpError:
        child_matches = False
    if not child_matches:
        return {"code": "ENTRY_CHILD_MISMATCH", "detail": "PREPARED evidence names a different bounded child"}
    planned_contract = (leaf.get("identity") or {}).get("contract_digest")
    if planned_contract and prepared.get("child_contract_digest") != planned_contract:
        return {"code": "ENTRY_CHILD_CONTRACT_MISMATCH", "detail": "PREPARED evidence does not match the bounded child's current contract digest"}
    if not prepared.get("phase_plan_ref") or not prepared.get("reconciliation_ref") or not prepared.get("evidence_refs"):
        return {"code": "ENTRY_GROUNDING_MISSING", "detail": "phase-plan, reconciliation and durable evidence references are required"}
    sequence = int(prepared.get("sequence") or 0)
    if sequence == 1:
        for ref, other in projection["nodes"].items():
            if ref == leaf_ref or other.get("kind") != "LEAF":
                continue
            other_prepared = (other.get("entry") or {}).get("prepared")
            if other_prepared and other_prepared.get("session_digest") == requirement["session_digest"]:
                return {
                    "code": "ENTRY_SEQUENCE_RESTART",
                    "detail": f"the Owner entry session already prepared {ref}; next child must use sequence >1 and link its execution-end evidence",
                }
    elif sequence > 1:
        previous_ref = prepared.get("previous_leaf_ref")
        previous_source = prepared.get("previous_evidence_ref")
        if not previous_ref or not previous_source or previous_ref not in projection["nodes"]:
            return {"code": "ENTRY_PREVIOUS_END_MISSING", "detail": "sequence >1 requires the exact previous leaf and execution-end evidence"}
        previous = projection["nodes"][previous_ref]
        previous_end = (previous.get("entry") or {}).get("execution_end")
        if not previous_end:
            return {"code": "ENTRY_PREVIOUS_END_MISSING", "detail": f"{previous_ref} has no accepted EXECUTION_END entry evidence"}
        if (
            previous_end.get("session_digest") != requirement["session_digest"]
            or previous_end.get("sequence") != sequence - 1
            or previous_end.get("_source") != previous_source
        ):
            return {"code": "ENTRY_PREVIOUS_END_MISMATCH", "detail": "previous execution-end evidence does not match this Owner entry sequence"}
        if previous.get("evidence", {}).get("health") != "CURRENT":
            return {"code": "ENTRY_PREVIOUS_END_STALE", "detail": f"{previous_ref} execution-end evidence is not current"}
        if previous_end.get("_candidate_sha") != previous.get("material", {}).get("candidate_sha"):
            return {"code": "ENTRY_PREVIOUS_END_STALE", "detail": f"{previous_ref} material moved after its execution-end evidence"}
    else:
        return {"code": "ENTRY_SEQUENCE_INVALID", "detail": "PREPARED entry evidence requires sequence >=1"}
    return None


def admit(
    projection: Mapping[str, Any],
    leaf_ref: str,
    command: str = "continue",
    owner_intent: Any = None,
) -> dict[str, Any]:
    """Compact reconstruction proof for continuation/takeover commands. Pure; changes nothing."""
    nodes = projection["nodes"]
    if leaf_ref not in nodes or nodes[leaf_ref]["kind"] != "LEAF":
        raise DelpError(f"{leaf_ref} is not a LEAF in the projection")
    leaf = nodes[leaf_ref]
    lineage_refs = leaf["identity"]["lineage"]
    ancestors = [nodes[r] for r in lineage_refs[:-1]]
    health = leaf["evidence"]["health"]
    gaps = leaf["evidence"]["gaps"]
    plan = leaf.get("plan")
    materialization = leaf.get("materialization")
    plan_blocked = bool(plan and plan["mode"] == "ENFORCED" and not plan["releasable"])
    entry_block = _entry_admission(projection, leaf_ref, owner_intent)
    entry_required = _takeover_entry_requirement(owner_intent) is not None
    if leaf["lifecycle"] in _TERMINAL:
        action = "NONE"
        next_text = f"{leaf['lifecycle']} — no further unit; select the next responsibility from the plan"
    elif materialization:
        # The ledger is empty but the provider shows work. What exists must be reported before anything new is
        # started, and nothing is inferred: completion is claimed only where current evidence supports it.
        action = "MATERIALIZE_FACTS"
        also = ""
        if plan_blocked:
            also = f"; the plan also fails the decomposition gate ({', '.join(b['code'] for b in plan['blockers'][:3])}) — the Coordinator must fix it before new units"
        next_text = (
            f"MATERIALIZE_FACTS before any new work — the provider shows {materialization['provider_signal']} but the ledger has "
            f"no accepted CHECKPOINT_FACTS_V1 for this leaf; publish facts for exactly what current evidence supports "
            f"(completion is never inferred){also}"
        )
    elif plan_blocked:
        action = "FIX_PLAN"
        shown = "; ".join(f"{b['code']} ({b['detail']})" for b in plan["blockers"][:3])
        more = f"; +{len(plan['blockers']) - 3} more" if len(plan["blockers"]) > 3 else ""
        also = f"; evidence is also {health}" if health != "CURRENT" else ""
        next_text = (
            f"FIX_PLAN before coding — {shown}{more}{also} — "
            "request a plan update (split or reweight) from the Coordinator; do not start or continue units"
        )
    elif health != "CURRENT":
        action = "RECOVER_EVIDENCE"
        detail = ", ".join(f"{g['unit']}:{g['reason']}" for g in gaps) or health
        next_text = f"RECOVER_EVIDENCE before new coding — {detail}"
    elif entry_block:
        action = "RECONCILE_ENTRY"
        next_text = f"RECONCILE_ENTRY before coding — {entry_block['code']}: {entry_block['detail']}"
    elif (
        leaf.get("successor_policy")
        and leaf["successor_policy"].get("mode") == "INDEPENDENT_RECONSTRUCTION"
        and leaf.get("handover")
        and leaf["handover"].get("status") != "RECONCILED"
    ):
        action = "RECONCILE_HANDOFF"
        next_text = (
            "RECONCILE_HANDOFF before this high-risk unit — "
            + str(leaf["successor_policy"].get("decision_at_risk") or "successor grounding required")
        )
    elif leaf.get("dependencies") and not leaf["dependencies"]["ready"]:
        action = "WAIT_DEPENDENCY"
        blocked = ", ".join(
            f"{row['ref']}:{row['lifecycle']}" for row in leaf["dependencies"]["blocking"]
        )
        next_text = (
            f"WAIT_DEPENDENCY before coding — {blocked}; only COMPLETE predecessors satisfy depends_on, "
            "then reproject from durable facts"
        )
    elif leaf["active_unit"]:
        action = "CONTINUE_UNIT"
        tail = f" — {leaf['next']['action']}" if leaf["next"]["action"] else ""
        next_text = f"{leaf['active_unit']}{tail}"
    else:
        action = "AWAIT_RESULT"
        next_text = "all declared units complete — publish the scoped result"
    report = {
        "command": command,
        "is_continuation": classify_continuation(command),
        "leaf": leaf_ref,
        "lineage": lineage_refs,
        "state": leaf["state"],
        "evidence_health": "NONE" if materialization else health,
        "action": action,
        "recovery_required": action == "RECOVER_EVIDENCE",
        "next": next_text,
        "blocker": leaf["blocker"],
        "owner_action": leaf["owner_action"],
        "ancestors": [
            {"ref": a["ref"], "scope": "Φ" if a["kind"] == "INTERMEDIATE" else "Π", "D": a["progress"]["D"], "E": a["progress"]["E"]}
            for a in ancestors
        ],
        "child": {"P": leaf["progress"]["P"], "E": leaf["progress"]["E"], "unit": leaf["active_unit"]},
        "material": leaf["material"],
        "evidence_candidate": leaf["frontier"]["evidence_candidate"],
        "authority_effects": [],  # a continuation never changes parent, denominator, scope or merge authority
    }
    if entry_required:
        report["entry_admission"] = {
            "required": True,
            "ready": entry_block is None,
            "blocker": entry_block,
            "session_digest": (_takeover_entry_requirement(owner_intent) or {}).get("session_digest"),
        }
    if leaf.get("successor_policy") is not None:
        report["successor_policy"] = leaf["successor_policy"]
    if leaf.get("handover") is not None:
        report["handover"] = leaf["handover"]
        report["handover_reconciliation_required"] = action == "RECONCILE_HANDOFF"
    if leaf.get("dependencies") is not None:
        report["dependencies"] = leaf["dependencies"]
        report["dependency_wait_required"] = action == "WAIT_DEPENDENCY"
    if plan:  # present only when the decomposition gate is not OFF
        report["plan"] = plan
        report["plan_fix_required"] = action == "FIX_PLAN"
    if materialization:  # present only when the provider shows work the ledger lacks
        report["materialization"] = materialization
        report["materialize_required"] = True
    if leaf.get("health"):  # present only when programme.health_policy.mode is ADVISORY and the leaf has started
        report["health"] = leaf["health"]
    return report


def render_checkpoint(report: Mapping[str, Any]) -> str:
    short = lambda sha: (sha or "UNKNOWN")[:7]  # noqa: E731
    path = " → ".join(f"#{ref_number(r)}" for r in report["lineage"])
    pr = report["material"].get("primary_pr")
    if pr:
        path += f" → PR#{ref_number(pr)}"
    if report["evidence_health"] == "NONE":
        evidence = (
            f"NONE — no accepted facts; provider shows {report['materialization']['provider_signal']} "
            f"(live @ {short(report['material'].get('candidate_sha'))})"
        )
    elif report["evidence_health"] == "CURRENT":
        evidence = f"CURRENT @ {short(report['material'].get('candidate_sha'))}"
    else:
        evidence = (
            f"{report['evidence_health']} (evidence @ {short(report['evidence_candidate'])}, "
            f"live @ {short(report['material'].get('candidate_sha'))})"
        )
    lines = [
        "CONTINUE CHECKPOINT",
        "",
        f"PATH: {path}",
        f"CHILD: R:P{report['child']['P']}/E{report['child']['E']} · {report['child']['unit'] or 'NO_ACTIVE_UNIT'} · {report['state']}",
        f"EVIDENCE: {evidence}",
    ]
    material = report["material"]
    seen = [
        f"base {short(material['base_sha'])}" if material.get("base_sha") else None,
        f"candidate {short(material.get('candidate_sha'))}",
        f"PR {material['pr_state']}" if material.get("pr_state") else None,
        f"ahead {material['ahead_by']}" if material.get("ahead_by") is not None else None,
        f"behind {material['behind_by']}" if material.get("behind_by") is not None else None,
    ]
    if any(material.get(k) is not None for k in ("base_sha", "pr_state", "ahead_by", "behind_by")):
        lines.append("FRONTIER: " + " · ".join(s for s in seen if s))
    plan = report.get("plan")
    if plan:
        codes = ", ".join(b["code"] for b in plan["blockers"])
        if plan["blockers"]:
            lines.append(f"PLAN: {'NOT_RELEASEABLE' if plan['mode'] == 'ENFORCED' else 'WOULD_BLOCK (advisory)'} — {codes}")
        elif plan["advisories"]:
            lines.append(f"PLAN: RELEASABLE — ADVISORY: {', '.join(a['code'] for a in plan['advisories'])}")
        else:
            lines.append("PLAN: RELEASABLE")
    dependencies = report.get("dependencies")
    if dependencies and dependencies["declared"]:
        if dependencies["ready"]:
            lines.append("DEPENDENCIES: READY — " + ", ".join(dependencies["declared"]))
        else:
            shown = ", ".join(
                f"{row['ref']}:{row['lifecycle']}" for row in dependencies["blocking"]
            )
            lines.append("DEPENDENCIES: BLOCKED — " + shown)
    handover = report.get("handover")
    if handover:
        lines.append(
            "HANDOVER: "
            + handover["status"]
            + " · "
            + handover["mode"]
            + " · decision "
            + str(handover.get("decision_at_risk") or "UNKNOWN")
        )
    health = report.get("health")
    if health:
        shown = health["reasons"][:3]
        more = f"; +{len(health['reasons']) - 3} more" if len(health["reasons"]) > 3 else ""
        lines.append(f"HEALTH: {health['light']} {health['verdict']} (advisory)" + (f" — {'; '.join(shown)}{more}" if shown else ""))
    for ancestor in reversed(report["ancestors"]):
        label = "ROOT" if ancestor["scope"] == "Π" else "PARENT"
        lines.append(f"{label}: #{ref_number(ancestor['ref'])} {ancestor['scope']}:D{ancestor['D']}/E{ancestor['E']}")
    lines += [
        f"BLOCKER: {report['blocker']}",
        f"OWNER_ACTION: {report['owner_action']}",
        f"NEXT: {report['next']}",
    ]
    return "\n".join(lines)


# --------------------------------------------------------------------------
# frontier: what a handover may honestly carry, and how a successor checks it is still true
# --------------------------------------------------------------------------

FRONTIER_DRIFT_SCHEMA = f"{SCHEMA_PREFIX}-frontier-drift"
# Provider-observed or ledger inputs a frontier depends on. A change in any of them means the handed-over values are
# stale. Divergence counts (ahead/behind) follow from the base and the candidate, so they are shown, not judged.
_FRONTIER_INPUTS = (
    ("BASE", ("observed", "base_sha")),
    ("CANDIDATE_HEAD", ("observed", "candidate_sha")),
    ("PR_STATE", ("observed", "pr_state")),
    ("LIVENESS", ("observed", "liveness")),
    ("FACTS", ("inputs", "facts", "digest")),
    ("DEPENDENCY_FACTS", ("inputs", "dependencies", "digest")),
    ("PLAN", ("inputs", "graph")),
)
_FRONTIER_CONSEQUENCES = (
    ("STATE", ("derived", "state")),
    ("EVIDENCE_HEALTH", ("derived", "evidence", "health")),
    ("PROGRESS_P", ("derived", "progress", "P")),
    ("PROGRESS_E", ("derived", "progress", "E")),
    ("ACTIVE_UNIT", ("derived", "active_unit")),
    ("DEPENDENCIES", ("derived", "dependencies")),
)


def _dig(value: Any, path: tuple[str, ...]) -> Any:
    for key in path:
        value = value.get(key) if isinstance(value, Mapping) else None
    return value


def frontier(
    graph: Any,
    ledger: Iterable[Mapping[str, Any]],
    observations: Mapping[str, Mapping[str, Any]] | None,
    leaf_ref: str,
) -> dict[str, Any]:
    """One leaf's frontier at this moment: provider-observed material, derived state, and the digests of its inputs.

    This is what a handover may honestly carry. It holds no authored number: everything in it is observed or derived,
    and it is only ever the predecessor's view at one instant, never current truth. Pure.
    """
    ledger = list(ledger)
    indexed = validate_graph(graph)
    ref = indexed["by_number"].get(ref_number(leaf_ref))
    if ref is None or indexed["nodes"][ref]["kind"] != "LEAF":
        raise DelpError(f"{leaf_ref} is not a LEAF in the graph")
    projection = project(graph, ledger, observations)
    leaf = projection["nodes"][ref]
    accepted, _ = partition_ledger(indexed, ledger)
    mine = [{k: v for k, v in record.items() if k != "_source"} for record in accepted.get(ref, [])]
    dependency_facts = {
        dep: [{k: v for k, v in record.items() if k != "_source"} for record in accepted.get(dep, [])]
        for dep in indexed["nodes"][ref]["depends_on"]
    }
    material = leaf["material"]
    observed = {k: material[k] for k in ("base_sha", "candidate_sha", "pr_state", "ahead_by", "behind_by") if material.get(k) is not None}
    if leaf.get("liveness"):
        observed["liveness"] = leaf["liveness"]
    ratios = leaf["progress"]["ratio"]
    derived: dict[str, Any] = {
        "state": leaf["state"],
        "lifecycle": leaf["lifecycle"],
        "active_unit": leaf["active_unit"],
        "progress": dict(ratios),
        "evidence": {
            "health": leaf["evidence"]["health"],
            "candidate": leaf["frontier"]["evidence_candidate"],
            "gaps": [f"{g['unit']}:{g['reason']}" for g in leaf["evidence"]["gaps"]],
        },
        "next": dict(leaf["next"]),
        "blocker": leaf["blocker"],
        "owner_action": leaf["owner_action"],
        "dependencies": copy.deepcopy(leaf.get("dependencies") or {"declared": [], "ready": True, "blocking": []}),
    }
    if "plan" in leaf:
        derived["plan"] = {"mode": leaf["plan"]["mode"], "releasable": leaf["plan"]["releasable"], "blockers": [b["code"] for b in leaf["plan"]["blockers"]]}
    if "materialization" in leaf:
        derived["materialization"] = dict(leaf["materialization"])
    body = {
        "leaf": ref,
        "observed": observed,
        "derived": derived,
        "inputs": {
            "graph": indexed["digest"],
            "facts": {"accepted": len(mine), "digest": canonical_digest(mine)},
            "dependencies": {
                "accepted": {dep: len(records) for dep, records in dependency_facts.items()},
                "digest": canonical_digest(dependency_facts),
            },
        },
    }
    ancestors = [projection["nodes"][r] for r in leaf["identity"]["lineage"][:-1]]
    return {
        "schema": f"{SCHEMA_PREFIX}-frontier",
        "authority": AUTHORITY,
        "protocol_line": PROTOCOL_LINE,
        "lineage": leaf["identity"]["lineage"],
        "ancestors": [
            {"ref": a["ref"], "state": a["state"], "D": a["progress"]["ratio"]["D"], "E": a["progress"]["ratio"]["E"]} for a in ancestors
        ],
        **body,
        "frontier_digest": canonical_digest(body),
    }


def frontier_drift(snapshot: Mapping[str, Any], live: Mapping[str, Any]) -> dict[str, Any]:
    """Compare a handed-over frontier with the one recomputed now. Pure.

    `moved` names the inputs that changed since the snapshot (provider truth, ledger, plan): any of them means the
    handed-over values are stale and must be recomputed, never trusted. `changed` lists the derived consequences, which are
    informational. An input the snapshot never observed counts as moved once it is observed: unobserved is not unchanged.
    """
    if snapshot.get("leaf") != live.get("leaf"):
        raise DelpError(f"the snapshot is for {snapshot.get('leaf')} but the live frontier is for {live.get('leaf')}")

    def differences(fields: tuple[tuple[str, tuple[str, ...]], ...]) -> list[dict[str, Any]]:
        rows = []
        for name, path in fields:
            was, now = _dig(snapshot, path), _dig(live, path)
            if was != now:
                rows.append({"what": name, "was": was, "now": now})
        return rows

    moved = differences(_FRONTIER_INPUTS)
    for row in moved:
        if row["what"] == "FACTS":  # show the count, not two digests
            row["was"], row["now"] = _dig(snapshot, ("inputs", "facts", "accepted")), _dig(live, ("inputs", "facts", "accepted"))
            row["detail"] = "accepted facts records (content differs)" if row["was"] == row["now"] else "accepted facts records"
        elif row["what"] == "DEPENDENCY_FACTS":
            row["was"], row["now"] = (
                _dig(snapshot, ("inputs", "dependencies", "accepted")),
                _dig(live, ("inputs", "dependencies", "accepted")),
            )
            row["detail"] = "accepted dependency facts changed"
        elif row["what"] == "PLAN":
            row["was"], row["now"] = str(row["was"])[:19], str(row["now"])[:19]
    return {
        "schema": FRONTIER_DRIFT_SCHEMA,
        "authority": AUTHORITY,
        "leaf": live["leaf"],
        "status": "MOVED" if moved else "CURRENT",
        "action": "RECONCILE" if moved else "NONE",
        "moved": moved,
        "changed": differences(_FRONTIER_CONSEQUENCES),
        "snapshot_digest": snapshot.get("frontier_digest"),
        "live_digest": live.get("frontier_digest"),
    }


def render_health(projection: Mapping[str, Any], only: str | None = None) -> str:
    nodes = projection["nodes"]
    lines = ["AGENT HEALTH (advisory; observed or derived, never declared; telemetry constrains delivery and does not measure value)"]
    root = nodes[projection["root"]].get("health")
    if root and only is None:
        counts = ", ".join(f"{k} {v}" for k, v in root["counts"].items())
        lines.append(f"PROGRAMME: {root['light']} {root['verdict']} — {root['leaves']} started leaves ({counts})")
    for ref, node in nodes.items():
        if node["kind"] == "LEAF" and node.get("health") and (only is None or ref == only):
            h = node["health"]
            lines.append(f"{h['light']} {h['verdict']:<10} {ref}  {'; '.join(h['reasons']) or 'every component observed and OK'}")
    if len(lines) == 1:
        lines.append("(no started leaf to assess, or the health policy is OFF)")
    return "\n".join(lines)


def render_frontier(snapshot: Mapping[str, Any]) -> str:
    o, d = snapshot["observed"], snapshot["derived"]
    short = lambda sha: (sha or "UNOBSERVED")[:7]  # noqa: E731
    lines = [
        f"FRONTIER (derived, observed at one instant; not current truth) — {snapshot['leaf']}",
        f"PATH: {' → '.join('#' + str(ref_number(r)) for r in snapshot['lineage'])}",
        f"MATERIAL: base {short(o.get('base_sha'))} · candidate {short(o.get('candidate_sha'))}"
        + (f" · PR {o['pr_state']}" if o.get("pr_state") else "")
        + (f" · ahead {o['ahead_by']}" if o.get("ahead_by") is not None else "")
        + (f" · behind {o['behind_by']}" if o.get("behind_by") is not None else ""),
        f"STATE: {d['state']} · P {d['progress']['P']} · E {d['progress']['E']} · unit {d['active_unit'] or 'NONE'}",
        f"EVIDENCE: {d['evidence']['health']}" + (f" ({', '.join(d['evidence']['gaps'])})" if d["evidence"]["gaps"] else ""),
        f"FRONTIER_DIGEST: {snapshot['frontier_digest']}",
    ]
    return "\n".join(lines)


def render_frontier_drift(report: Mapping[str, Any]) -> str:
    short = lambda v: str(v)[:7] if isinstance(v, str) and _SHA.fullmatch(v) else str(v)  # noqa: E731
    lines = [f"FRONTIER DRIFT — {report['status']} ({report['leaf']})"]
    lines += [f"  MOVED   {r['what']}: {short(r['was'])} -> {short(r['now'])}" + (f" ({r['detail']})" if r.get("detail") else "") for r in report["moved"]]
    lines += [f"  changed {r['what']}: {short(r['was'])} -> {short(r['now'])}" for r in report["changed"]]
    lines.append(
        "ACTION: NONE — every input is as the predecessor observed it"
        if report["status"] == "CURRENT"
        else "ACTION: RECONCILE — the handed-over frontier is stale; recompute from live truth before acting (a handover is the predecessor's view at one instant, never current truth)"
    )
    return "\n".join(lines)


# --------------------------------------------------------------------------
# provider surface: compare-and-swap by version + digest (no last-writer-wins)
# --------------------------------------------------------------------------


def status_document(node_projection: Mapping[str, Any], *, version: int, digest: str, programme: Mapping[str, Any]) -> dict[str, Any]:
    """LIVE_STATUS_V1 document written to the provider for one node."""
    body = {k: v for k, v in node_projection.items() if k not in {"title_prefix"}}
    return {
        "schema": STATUS_SCHEMA,
        "authority": AUTHORITY,
        "programme": programme.get("id"),
        "node": body,
        "projection": {"version": version, "input_digest": digest},
    }


def render_status_comment(document: Mapping[str, Any]) -> str:
    version = document["projection"]["version"]
    digest = document["projection"]["input_digest"]
    return "\n".join(
        [
            STATUS_START,
            f"<!-- relay-delp:version={version} digest={digest} -->",
            "LIVE_STATUS_V1 — derived projection; never authority; agents do not edit this comment.",
            "",
            "```json",
            json.dumps(document, indent=2, sort_keys=True, ensure_ascii=False),
            "```",
            STATUS_END,
        ]
    )


def read_status_marker(body: str) -> dict[str, Any] | None:
    if STATUS_START not in str(body or ""):
        return None
    match = _STATUS_MARKER.search(body)
    if not match:
        return None
    return {"version": int(match.group("version")), "input_digest": match.group("digest")}


class InMemoryStore:
    """Reference provider with real compare-and-swap semantics (used by tests and dry runs)."""

    def __init__(self, titles: Mapping[str, str] | None = None) -> None:
        self.titles = dict(titles or {})
        self.status: dict[str, dict[str, Any]] = {}
        self.writes: list[tuple[str, int | None, int]] = []

    def read(self, ref: str) -> dict[str, Any] | None:
        row = self.status.get(ref)
        if row is None:
            return {"version": None, "input_digest": None, "title": self.titles.get(ref, "")}
        return {"version": row["version"], "input_digest": row["digest"], "title": self.titles.get(ref, "")}

    def write(self, ref: str, expected_version: int | None, document: Mapping[str, Any], title: str) -> int:
        row = self.status.get(ref)
        observed = row["version"] if row else None
        if observed != expected_version:
            raise ProjectionConflict(f"{ref}: expected version {expected_version}, observed {observed}")
        version = (observed or 0) + 1
        final = json.loads(canonical_json(document))
        final["projection"]["version"] = version
        self.status[ref] = {"version": version, "digest": final["projection"]["input_digest"], "document": final}
        self.titles[ref] = title
        self.writes.append((ref, expected_version, version))
        return version


def apply_projection(
    store: Any,
    ref: str,
    compute: Callable[[], tuple[dict[str, Any], str]],
    *,
    max_attempts: int = 4,
    on_conflict: Callable[[], None] | None = None,
) -> dict[str, Any]:
    """Write one node projection with compare-and-swap.

    `compute()` returns `(status_document_without_final_version, title)`. After a lost race
    `on_conflict()` drops cached inputs so the next attempt recomputes from fresh truth and
    converges instead of overwriting.
    """
    last: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        current = store.read(ref) or {"version": None, "input_digest": None, "title": ""}
        expected = current["version"]
        document, title = compute()
        digest = document["projection"]["input_digest"]
        if current["input_digest"] == digest and current.get("title") == title:
            return {"status": "UNCHANGED", "version": expected, "attempts": attempt}
        try:
            version = store.write(ref, expected, document, title)
        except ProjectionConflict as exc:
            last = exc
            if on_conflict:
                on_conflict()
            continue
        return {
            "status": "WRITTEN",
            "version": version,
            "attempts": attempt,
            "title_corrected": current.get("title") not in ("", title),
        }
    raise ProjectionConflict(f"{ref}: lost compare-and-swap {max_attempts} times: {last}")


class _InputCache:
    """Compute the projection once per pass; recompute from fresh inputs after a conflict."""

    def __init__(
        self,
        graph: Any,
        ledger_provider: Callable[[], Iterable[Mapping[str, Any]]],
        observation_provider: Callable[[], Mapping[str, Mapping[str, Any]]],
    ) -> None:
        self.graph = graph
        self.ledger_provider = ledger_provider
        self.observation_provider = observation_provider
        self._projection: dict[str, Any] | None = None

    def invalidate(self) -> None:
        self._projection = None

    def projection(self) -> dict[str, Any]:
        if self._projection is None:
            self._projection = project(self.graph, self.ledger_provider(), self.observation_provider())
        return self._projection


def _source_view_title_contract(graph: Any) -> tuple[str, str] | None:
    """Derive owner-scoped title authority from the released graph, not issue IDs.

    Only a graph with an explicitly bound R-PROJECTION responsibility and a
    released V2 decomposition requires cross-surface smart titles. This stays
    generic to other repositories, issue numbers and draft PR numbers.
    """
    if not isinstance(graph, Mapping):
        return None
    programme = graph.get("programme") or {}
    proposal = programme.get("decomposition_proposal") or {}
    if str(proposal.get("version")) != "V2":
        return None
    bindings = proposal.get("bindings") or []
    leaves = [
        n for n in graph.get("nodes") or []
        if n.get("kind") == "LEAF" and n.get("responsibility_id") == "R-PROJECTION"
        and n.get("primary_pr") and
        any(b.get("ref") == n.get("ref") and
            b.get("responsibility_id") == "R-PROJECTION" for b in bindings)
    ]
    if not leaves:
        return None
    if len(leaves) != 1:
        raise DelpError("AMBIGUOUS_SMART_TITLE_RESPONSIBILITY")
    root = programme.get("root")
    leaf = leaves[0].get("ref")
    if not isinstance(root, str) or not isinstance(leaf, str) or root == leaf:
        raise DelpError("INVALID_SMART_TITLE_RESPONSIBILITY_BINDING")
    return root, leaf


def sync_projection(
    store: Any,
    graph: Any,
    ledger_provider: Callable[[], Iterable[Mapping[str, Any]]],
    observation_provider: Callable[[], Mapping[str, Mapping[str, Any]]],
    base_titles: Mapping[str, str],
    *,
    title_overrides: Mapping[str, str] | None = None,
    selected_refs: Iterable[str] | None = None,
    expected_input_digest: str | None = None,
) -> dict[str, Any]:
    """The SINGLE issue-title + versioned LIVE_STATUS publisher.

    For released source-view R-PROJECTION responsibilities the graph requires
    root/leaf smart titles generated by the read model. Legacy `sync-github`
    cannot overwrite those titles using a competing DELP prefix grammar.
    Optional refs scope issue writes; root is still last. This is a provider
    read/check/write, not atomic CAS across GitHub issues.
    """
    indexed = validate_graph(graph)
    all_refs = set(indexed["nodes"])
    chosen = all_refs if selected_refs is None else set(selected_refs)
    if not chosen or not chosen.issubset(all_refs):
        raise DelpError("ISSUE_PUBLISHER_INVALID_SELECTED_REFS")
    override = dict(title_overrides or {})
    if not set(override).issubset(all_refs) or any(
            not isinstance(x, str) or not x.strip() for x in override.values()):
        raise DelpError("ISSUE_PUBLISHER_INVALID_TITLE_OVERRIDE")
    title_contract = _source_view_title_contract(graph)
    if title_contract:
        if not set(title_contract).issubset(override):
            raise DelpError("SOURCE_SMART_TITLE_POLICY_REQUIRED")
        if chosen != set(title_contract):
            raise DelpError("SOURCE_SMART_TITLE_SCOPE_MISMATCH")
        if not isinstance(expected_input_digest, str) or not expected_input_digest.startswith("sha256:"):
            raise DelpError("SOURCE_DELP_INPUT_PIN_REQUIRED")
    cache = _InputCache(graph, ledger_provider, observation_provider)
    report: dict[str, Any] = {}
    ordered = sorted(chosen, key=lambda r: (-len(lineage(indexed, r)), indexed["nodes"][r]["number"]))
    for ref in ordered:

        def compute(ref: str = ref) -> tuple[dict[str, Any], str]:
            projection = cache.projection()
            if expected_input_digest is not None and projection["input_digest"] != expected_input_digest:
                raise DelpError("ISSUE_PUBLISHER_INPUT_MOVED")
            node = projection["nodes"][ref]
            _, base = split_title(base_titles.get(ref, ""))
            title = override.get(ref, render_title(node["title_prefix"], base))
            return (
                status_document(node, version=0, digest=projection["input_digest"], programme=projection["programme"]),
                title,
            )

        report[ref] = apply_projection(store, ref, compute, on_conflict=cache.invalidate)
    return report


def ledger_from_github(transport: Any, graph: Any) -> list[dict[str, Any]]:
    """Collect CHECKPOINT_FACTS_V1 blocks from each declared leaf issue's comments, oldest first.

    Blocks from untrusted authors are kept but tagged, so the projector rejects them visibly
    (`rejected_facts`) instead of silently dropping or, worse, believing them.
    """
    indexed = validate_graph(graph)
    allowlist = {str(a) for a in (indexed["programme"].get("fact_authors") or [])}
    ledger: list[dict[str, Any]] = []
    for ref, node in indexed["nodes"].items():
        if node["kind"] != "LEAF":
            continue
        for comment in transport.list_comments(node["number"]):
            login = str((comment.get("user") or {}).get("login") or "")
            trusted = (
                login in allowlist
                if allowlist
                else str(comment.get("author_association") or "") in TRUSTED_ASSOCIATIONS
            )
            for facts in extract_facts_blocks(str(comment.get("body") or "")):
                row = {
                    "source": f"{ref}#issuecomment-{comment.get('id')}",
                    "order": int(comment.get("id") or 0),
                    "facts": facts,
                }
                if not trusted:
                    row["untrusted_author"] = login or "UNKNOWN"
                ledger.append(row)
    return ledger


def require_repository_match(graph: Any, repository: str, *, live: bool) -> None:
    """A plan may only be applied to the repository it declares.

    Issue numbers in a plan are not globally unique, and the shipped examples deliberately reuse numbers that exist
    in real repositories. A live `sync-github` therefore needs `programme.repository` and refuses on any mismatch; a
    dry run (read-only) may omit it but is still refused when it declares a different repository.
    """
    declared = (graph.get("programme") or {}).get("repository") if isinstance(graph, Mapping) else None
    if declared is None or not str(declared).strip():
        if live:
            raise DelpError(
                "programme.repository is required for a live sync-github and must equal --repository, "
                "so that a plan can never write to another repository"
            )
        return
    if str(declared).strip().lower() != str(repository).strip().lower():
        raise DelpError(
            f"programme.repository {str(declared).strip()!r} does not match --repository {repository!r}: "
            "refusing to read or write (the shipped examples declare example/delp-demo for this reason)"
        )


def plan_github(transport: Any, graph: Any) -> dict[str, Any]:
    """Read-only dry run of `sync-github`: what would change, what drifted, what was rejected. Writes nothing."""
    indexed = validate_graph(graph)
    titles = {ref: str(transport.get_issue(ref_number(ref)).get("title") or "") for ref in indexed["nodes"]}
    projection = project(graph, ledger_from_github(transport, graph), observe_github(transport, graph))
    drift = {}
    for ref, node in projection["nodes"].items():
        result = title_drift(titles[ref], node["title_prefix"])
        if result["status"] != "OK":
            drift[ref] = result
    return {
        "would_write_titles": len(drift),
        "drift": drift,
        "rejected_facts": projection["rejected_facts"],
        "expected_titles": expected_titles(projection, titles),
        "input_digest": projection["input_digest"],
    }


def observe_github(transport: Any, graph: Any) -> dict[str, dict[str, Any]]:
    """Observe the live candidate for every leaf from provider truth, never from agent facts.

    A leaf's candidate is its primary PR head, or the head of `candidate_ref` when it has no PR. A branch-only leaf
    also gets `ahead_by` / `behind_by` against `programme.base_ref` (default `main`): commits beyond the base are the
    provider's proof that work exists, which is what separates an unreported leaf from one that has not started.
    """
    indexed = validate_graph(graph)
    base_ref = str(indexed["programme"].get("base_ref") or "main")
    base_sha = str(transport.get_commit_sha(base_ref) or "") or None  # one read per pass: the head every leaf is measured against
    observed: dict[str, dict[str, Any]] = {}
    for ref, node in indexed["nodes"].items():
        if node["kind"] != "LEAF":
            continue
        pr = node.get("primary_pr")
        if pr:
            pull = transport.get_pull(ref_number(pr))
            observed[ref] = {
                "candidate_sha": str((pull.get("head") or {}).get("sha") or "") or None,
                "pr_state": "MERGED" if pull.get("merged") else str(pull.get("state") or "UNKNOWN").upper(),
                "base_sha": base_sha,
            }
        elif node.get("candidate_ref"):
            comparison = transport.compare(base_ref, node["candidate_ref"])
            observed[ref] = {
                "candidate_sha": str(transport.get_commit_sha(node["candidate_ref"]) or "") or None,
                "ahead_by": int(comparison.get("ahead_by") or 0),
                "behind_by": int(comparison.get("behind_by") or 0),
                "base_sha": base_sha,
            }
    return observed


class GhTransport:
    """`gh api` transport. Kept thin so tests can substitute a fake."""

    def __init__(self, repository: str) -> None:
        self.repository = repository

    def _gh(self, *args: str) -> Any:
        proc = subprocess.run(
            ["gh", "api", *args], text=True, capture_output=True, encoding="utf-8", errors="replace"
        )
        if proc.returncode:
            raise DelpError(proc.stderr.strip() or "gh api failed")
        return json.loads(proc.stdout) if proc.stdout.strip() else {}

    def get_commit_sha(self, ref: str) -> str:
        return str(self._gh(f"repos/{self.repository}/commits/{ref}").get("sha") or "")

    def compare(self, base: str, head: str) -> dict[str, Any]:
        return self._gh(f"repos/{self.repository}/compare/{base}...{head}")

    def get_issue(self, number: int) -> dict[str, Any]:
        return self._gh(f"repos/{self.repository}/issues/{number}")

    def get_pull(self, number: int) -> dict[str, Any]:
        return self._gh(f"repos/{self.repository}/pulls/{number}")

    def list_comments(self, number: int) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        page = 1
        while True:
            chunk = self._gh("--method", "GET", f"repos/{self.repository}/issues/{number}/comments", "-f", "per_page=100", "-f", f"page={page}")
            if not isinstance(chunk, list):
                raise DelpError("GitHub comments response must be a list")
            rows.extend(chunk)
            if len(chunk) < 100:
                return rows
            page += 1

    def post_comment(self, number: int, body: str) -> dict[str, Any]:
        return self._gh("--method", "POST", f"repos/{self.repository}/issues/{number}/comments", "-f", f"body={body}")

    def patch_comment(self, comment_id: int, body: str) -> dict[str, Any]:
        return self._gh("--method", "PATCH", f"repos/{self.repository}/issues/comments/{comment_id}", "-f", f"body={body}")

    def patch_title(self, number: int, title: str) -> dict[str, Any]:
        return self._gh("--method", "PATCH", f"repos/{self.repository}/issues/{number}", "-f", f"title={title}")

    def patch_issue_body(self, number: int, body: str) -> dict[str, Any]:
        """Only body: DELP's GitHubStore exclusively owns issue titles/status."""
        return self._gh("--method", "PATCH", f"repos/{self.repository}/issues/{number}",
                        "-f", f"body={body}")

    def patch_pull_title_body(self, number: int, title: str, body: str) -> dict[str, Any]:
        """PR-specific provider write; PR titles are NOT DELP issue titles."""
        return self._gh("--method", "PATCH", f"repos/{self.repository}/pulls/{number}",
                        "-f", f"title={title}", "-f", f"body={body}")


class GitHubStore:
    """Managed LIVE_STATUS comment + issue title per node, written with detect-and-retry CAS.

    GitHub has no conditional update for comments or titles. DELP therefore re-reads the
    version marker immediately before writing, writes version N+1, and reads back; a lost
    race is detected (version/digest mismatch) and retried from freshly recomputed inputs.
    """

    def __init__(self, transport: Any) -> None:
        self.transport = transport

    def _managed(self, number: int) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        matches = [c for c in self.transport.list_comments(number) if STATUS_START in str(c.get("body") or "")]
        if len(matches) > 1:
            raise DelpError(f"#{number}: multiple managed LIVE_STATUS comments")
        if not matches:
            return None, None
        return matches[0], read_status_marker(str(matches[0].get("body") or ""))

    def read(self, ref: str) -> dict[str, Any] | None:
        number = ref_number(ref)
        comment, marker = self._managed(number)
        title = str(self.transport.get_issue(number).get("title") or "")
        return {
            "version": marker["version"] if marker else None,
            "input_digest": marker["input_digest"] if marker else None,
            "title": title,
            "comment_id": comment.get("id") if comment else None,
        }

    def write(self, ref: str, expected_version: int | None, document: Mapping[str, Any], title: str) -> int:
        number = ref_number(ref)
        comment, marker = self._managed(number)
        observed = marker["version"] if marker else None
        if observed != expected_version:
            raise ProjectionConflict(f"{ref}: expected version {expected_version}, observed {observed}")
        version = (observed or 0) + 1
        final = json.loads(canonical_json(document))
        final["projection"]["version"] = version
        body = render_status_comment(final)
        if comment:
            self.transport.patch_comment(int(comment["id"]), body)
        else:
            self.transport.post_comment(number, body)
        if str(self.transport.get_issue(number).get("title") or "") != title:
            self.transport.patch_title(number, title)
        _, back = self._managed(number)
        if not back or back["version"] != version or back["input_digest"] != final["projection"]["input_digest"]:
            raise ProjectionConflict(f"{ref}: readback lost the race (wrote {version}, saw {back})")
        return version


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def _load_structured(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in {".yaml", ".yml"}:
        try:
            import yaml  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise DelpError("PyYAML is required to read YAML inputs") from exc
        return yaml.safe_load(text)
    return json.loads(text)


def _load_ledger(paths: list[Path]) -> list[dict[str, Any]]:
    ledger: list[dict[str, Any]] = []
    for path in paths:
        if path.suffix.lower() in {".md", ".txt"}:
            for facts in extract_facts_blocks(path.read_text(encoding="utf-8")):
                ledger.append({"source": str(path), "order": len(ledger), "facts": facts})
            continue
        document = _load_structured(path)
        rows = document if isinstance(document, list) else [document]
        for row in rows:
            facts = row.get("facts") if isinstance(row, Mapping) and "facts" in row else row
            if isinstance(facts, Mapping) and FACTS_KEY in facts:
                facts = {**facts[FACTS_KEY], "schema": FACTS_SCHEMA}
            ledger.append({"source": f"{path}", "order": len(ledger), "facts": facts})
    return ledger


def _emit(value: Any, output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=f"DELP {PROTOCOL_LINE}: facts in, projections out.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    vg = sub.add_parser("validate-graph")
    vg.add_argument("--graph", type=Path, required=True)

    vf = sub.add_parser("validate-facts", help="Reject agent-authored progress/titles; exit 1 on any violation.")
    vf.add_argument("facts", type=Path, nargs="+")

    dc = sub.add_parser(
        "decompose-check",
        help="Judge the plan against the decomposition policy; exit 1 on blockers when the effective mode is ENFORCED.",
    )
    dc.add_argument("--graph", type=Path, required=True)
    dc.add_argument("--mode", choices=POLICY_MODES, help="Override programme.decomposition_policy.mode for this run.")
    dc.add_argument("--facts", type=Path, nargs="*", default=[], help="Skip leaves these facts show COMPLETE or SUPERSEDED.")
    dc.add_argument("--observations", type=Path)
    dc.add_argument("--json", action="store_true")

    gd = sub.add_parser("graph-diff", help="Check that a re-plan conserves progress and records its scope changes; exit 1 on blockers.")
    gd.add_argument("--old", type=Path, required=True, help="The plan being replaced (e.g. the PR base version).")
    gd.add_argument("--new", type=Path, required=True)
    gd.add_argument("--json", action="store_true")

    fr = sub.add_parser(
        "frontier",
        help="One leaf's derived frontier at this instant (observed material, derived state, input digests): what a handover may carry.",
    )
    fv = sub.add_parser(
        "frontier-verify",
        help="Compare a handed-over frontier with the live one; exit 2 when any input moved (the handover is stale).",
    )
    for sp in (fr, fv):
        sp.add_argument("--graph", type=Path, required=True)
        sp.add_argument("--facts", type=Path, nargs="*", default=[])
        sp.add_argument("--observations", type=Path)
        sp.add_argument("--repository", help="Observe live from GitHub (read-only) instead of --facts / --observations.")
        sp.add_argument("--leaf", required=True)
    fr.add_argument("--output", type=Path)
    fr.add_argument("--text", action="store_true", help="Human-readable form instead of JSON.")
    fv.add_argument("--snapshot", type=Path, required=True, help="The frontier JSON the predecessor handed over.")
    fv.add_argument("--json", action="store_true")

    hl = sub.add_parser(
        "health",
        help="Advisory delivery-continuity health of started leaves: observed or derived, never declared. Always exits 0.",
    )
    hl.add_argument("--graph", type=Path, required=True)
    hl.add_argument("--facts", type=Path, nargs="*", default=[])
    hl.add_argument("--observations", type=Path)
    hl.add_argument("--mode", choices=HEALTH_MODES, default="ADVISORY", help="Override programme.health_policy.mode for this run.")
    hl.add_argument("--leaf", help="Show a single leaf.")
    hl.add_argument("--json", action="store_true")

    pr = sub.add_parser("project")
    pr.add_argument("--graph", type=Path, required=True)
    pr.add_argument("--facts", type=Path, nargs="*", default=[])
    pr.add_argument("--observations", type=Path)
    pr.add_argument("--base-titles", type=Path)
    pr.add_argument("--output", type=Path)

    ad = sub.add_parser("admit", help="Reconstruct-before-continue checkpoint for continue/proceed/next/resume.")
    ad.add_argument("--graph", type=Path, required=True)
    ad.add_argument("--facts", type=Path, nargs="*", default=[])
    ad.add_argument("--observations", type=Path)
    ad.add_argument("--leaf", required=True)
    ad.add_argument("--command", default="continue")
    ad.add_argument("--owner-intent", type=Path, help="Parsed Owner command/envelope; TAKEOVER_RECONCILE enables entry admission.")
    ad.add_argument("--json", action="store_true")

    vt = sub.add_parser("verify-titles", help="Report hand-edited, stale, missing or legacy titles; exit 2 on drift.")
    vt.add_argument("--graph", type=Path, required=True)
    vt.add_argument("--facts", type=Path, nargs="*", default=[])
    vt.add_argument("--observations", type=Path)
    vt.add_argument("--actual-titles", type=Path, required=True)

    gh = sub.add_parser(
        "sync-github",
        help="Observe live PR heads + CHECKPOINT_FACTS_V1 comments, then write titles and LIVE_STATUS with compare-and-swap (uses gh).",
    )
    gh.add_argument("--graph", type=Path, required=True)
    gh.add_argument("--repository", required=True)
    gh.add_argument("--dry-run", action="store_true", help="Read-only: report drift, rejected facts and expected titles; write nothing.")

    args = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):  # titles carry emoji and arrows; never depend on the console codepage
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8")
            except (ValueError, OSError):  # pragma: no cover - exotic stream
                pass
    try:
        if args.cmd == "validate-graph":
            indexed = validate_graph(_load_structured(args.graph))
            print(f"OK {len(indexed['nodes'])} nodes root={indexed['root']} digest={indexed['digest']}")
            return 0
        if args.cmd == "validate-facts":
            failed = 0
            for path in args.facts:
                rows = _load_ledger([path])
                if not rows:
                    failed += 1
                    print(f"REJECTED {path}", file=sys.stderr)
                    print(f"  - no {FACTS_KEY} block found (a malformed fence or key is not a valid publication)", file=sys.stderr)
                for row in rows:
                    errors = validate_facts(row["facts"])
                    if errors:
                        failed += 1
                        print(f"REJECTED {row['source']}", file=sys.stderr)
                        for error in errors:
                            print(f"  - {error}", file=sys.stderr)
            return 1 if failed else 0
        if args.cmd == "graph-diff":
            diff = graph_diff(_load_structured(args.old), _load_structured(args.new))
            if args.json:
                _emit(diff, None)
            else:
                print(render_graph_diff(diff))
            return 0 if diff["conserved"] else 1

        graph = _load_structured(args.graph)
        if args.cmd == "decompose-check":
            closed: list[str] = []
            if args.facts:
                seen = project(graph, _load_ledger(args.facts), _load_structured(args.observations) if args.observations else {})
                closed = [r for r, n in seen["nodes"].items() if n["kind"] == "LEAF" and n["lifecycle"] in _TERMINAL]
            report = decomposition_report(graph, args.mode, closed)
            if args.json:
                _emit(report, None)
            else:
                print(render_decomposition(report))
            return 1 if report["mode"] == "ENFORCED" and report["summary"]["not_releasable"] else 0
        if args.cmd == "health":
            planned = copy.deepcopy(graph)
            planned.setdefault("programme", {}).setdefault("health_policy", {})["mode"] = args.mode
            projected = project(planned, _load_ledger(args.facts), _load_structured(args.observations) if args.observations else {})
            if args.json:
                _emit(
                    {
                        "programme": projected["nodes"][projected["root"]].get("health"),
                        "leaves": {r: n["health"] for r, n in projected["nodes"].items() if n["kind"] == "LEAF" and n.get("health")},
                    },
                    None,
                )
            else:
                print(render_health(projected, args.leaf))
            return 0
        if args.cmd in {"frontier", "frontier-verify"}:
            if args.repository:
                require_repository_match(graph, args.repository, live=False)
                transport = GhTransport(args.repository)
                ledger, observations = ledger_from_github(transport, graph), observe_github(transport, graph)
            else:
                ledger = _load_ledger(args.facts)
                observations = _load_structured(args.observations) if args.observations else {}
            live = frontier(graph, ledger, observations, args.leaf)
            if args.cmd == "frontier":
                if args.text:
                    print(render_frontier(live))
                else:
                    _emit(live, args.output)
                return 0
            drift = frontier_drift(_load_structured(args.snapshot), live)
            if args.json:
                _emit(drift, None)
            else:
                print(render_frontier_drift(drift))
            return 2 if drift["status"] == "MOVED" else 0
        if args.cmd == "sync-github":
            require_repository_match(graph, args.repository, live=not args.dry_run)
        if args.cmd == "sync-github" and args.dry_run:
            _emit(plan_github(GhTransport(args.repository), graph), None)
            return 0
        if args.cmd == "sync-github":
            transport = GhTransport(args.repository)
            store = GitHubStore(transport)
            indexed = validate_graph(graph)
            base_titles = {
                ref: str(transport.get_issue(ref_number(ref)).get("title") or "") for ref in indexed["nodes"]
            }
            report = sync_projection(
                store,
                graph,
                lambda: ledger_from_github(transport, graph),
                lambda: observe_github(transport, graph),
                base_titles,
            )
            _emit(report, None)
            return 0
        ledger = _load_ledger(args.facts)
        observations = _load_structured(args.observations) if getattr(args, "observations", None) else {}
        projection = project(graph, ledger, observations)
        if args.cmd == "project":
            if args.base_titles:
                projection["expected_titles"] = expected_titles(projection, _load_structured(args.base_titles))
            _emit(projection, args.output)
            return 0
        if args.cmd == "admit":
            owner_intent = _load_structured(args.owner_intent) if args.owner_intent else None
            report = admit(projection, args.leaf, args.command, owner_intent)
            if args.json:
                _emit(report, None)
            else:
                print(render_checkpoint(report))
            return 0
        if args.cmd == "verify-titles":
            actual = _load_structured(args.actual_titles)
            drift = {}
            for ref, node in projection["nodes"].items():
                result = title_drift(str(actual.get(ref, "")), node["title_prefix"])
                if result["status"] != "OK":
                    drift[ref] = result
            _emit({"drift": drift, "checked": len(projection["nodes"])}, None)
            return 2 if drift else 0
    except DelpError as exc:
        print(f"DELP error: {exc}", file=sys.stderr)
        return 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
