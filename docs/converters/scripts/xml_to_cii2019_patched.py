#!/usr/bin/env python3
"""Patched PSI116 XML -> CII(2019) converter wrapper.

Final-stage enrichment wrapper for XML->CII(2019): line-list semantic
mapping, DTXR restraint derivation, hydro pressure, insulation density,
optional condensed valve/flange split, and CII element-row case values.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import xml_to_cii2019 as base

try:
    import xml_to_cii2019_master_addon as addon
except Exception:  # pragma: no cover
    addon = None

SENTINEL_TEMPERATURE = -100000.0
NO_AUTO_WEIGHT_COMPONENT_TYPES = {"TEE", "REDU", "REE", "BEND", "ELBO"}
RENUMBERABLE_NEGATIVE_TYPES = {"FLAN", "RIGID"}

DEFAULT_SUPPORT_CONFIG: dict[str, Any] = {
    "useFrictionSentinelForNonYSupports": True,
    "convertDensityKgM3ToKgCm3": True,
    "disableCiiSupportTagPopulation": False,
    "supportKindToXmlType": {"REST": "+Y", "SHOE": "+Y", "GUIDE": "GUI", "LINESTOP": "LIM", "LIMIT": "LIM", "ANCHOR": "ANC", "SPRING": "YSPR"},
    "defaultStiffness": "1.751270E+12",
    "defaultGap": "0",
    "defaultFriction": "0.3",
    "insulationDensityDefault": 210,
    "splitCondensedValveFlange": True,
    "keywordRules": [
        {"kind": "GUIDE", "patterns": [r"\bGUIDE\b", r"\bGUI\b", r"\bPDO-TYPE-603\b"]},
        {"kind": "LINESTOP", "patterns": [r"\bLINE\s*STOP\b", r"\bLINESTOP\b", r"\bLIMIT\s*STOP\b", r"\bAXIAL\s*STOP\b", r"\bDIRECTIONAL\s+ANCHOR\b"]},
        {"kind": "REST", "patterns": [r"\bREST\b", r"\bSHOE\b", r"\bSADDLE\b", r"\bWEAR\s+PLATE\b", r"\bPAD\b"]},
        {"kind": "ANCHOR", "patterns": [r"\bANCHOR\b"]},
        {"kind": "SPRING", "patterns": [r"\bSPRING\b", r"\bHANGER\b"]},
    ],
}

SUPPORT_KIND_TO_XML_TYPE = {"REST": "+Y", "SHOE": "+Y", "GUIDE": "GUI", "LINESTOP": "LIM", "LIMIT": "LIM", "ANCHOR": "ANC", "SPRING": "YSPR"}
SUPPORT_KIND_TO_CII_CODE = {"REST": 14, "SHOE": 14, "GUIDE": 8, "LINESTOP": 9, "LIMIT": 9, "ANCHOR": 1, "SPRING": 55}


def _safe_text(value: object) -> str:
    return "" if value is None else str(value).strip()


def _truthy(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return _safe_text(value).lower() in {"1", "true", "yes", "on"}


def _local_name(tag: str) -> str:
    return tag.split("}", 1)[1] if tag.startswith("{") else tag


def _namespace(tag: str) -> str:
    return tag[1:].split("}", 1)[0] if tag.startswith("{") else ""


def _q(namespace: str, name: str) -> str:
    return f"{{{namespace}}}{name}" if namespace else name


def _child_text(parent: ET.Element, namespace: str, name: str) -> str:
    child = parent.find(_q(namespace, name))
    return _safe_text(child.text if child is not None else "")


def _ensure_child(parent: ET.Element, namespace: str, name: str) -> ET.Element:
    child = parent.find(_q(namespace, name))
    if child is None:
        child = ET.Element(_q(namespace, name))
        parent.append(child)
    return child


def _set_child(parent: ET.Element, namespace: str, name: str, value: object) -> None:
    _ensure_child(parent, namespace, name).text = _safe_text(value)


def _to_float(value: object, fallback: float) -> float:
    try:
        number = float(_safe_text(value))
        return number if math.isfinite(number) else fallback
    except (TypeError, ValueError):
        return fallback


def _numeric_token(value: object) -> str:
    match = re.search(r"-?\d+(?:\.\d+)?", _safe_text(value).replace(",", ""))
    return match.group(0) if match else ""


def _numeric_text(value: object) -> float | None:
    token = _numeric_token(value)
    if not token:
        return None
    try:
        return float(token)
    except ValueError:
        return None


def _load_support_config(raw_json: str | None) -> dict[str, Any]:
    cfg = json.loads(json.dumps(DEFAULT_SUPPORT_CONFIG))
    if _safe_text(raw_json):
        user_cfg = json.loads(_safe_text(raw_json))
        if not isinstance(user_cfg, dict):
            raise ValueError("--support-config-json must be a JSON object.")
        for key, value in user_cfg.items():
            if isinstance(value, dict) and isinstance(cfg.get(key), dict):
                cfg[key].update(value)
            else:
                cfg[key] = value
    cfg.setdefault("supportKindToXmlType", {})["REST"] = "+Y"
    cfg["supportKindToXmlType"]["SHOE"] = "+Y"
    cfg["splitCondensedValveFlange"] = _truthy(cfg.get("splitCondensedValveFlange"))
    cfg["useFrictionSentinelForNonYSupports"] = _truthy(cfg.get("useFrictionSentinelForNonYSupports") if cfg.get("useFrictionSentinelForNonYSupports") is not None else True)
    cfg["convertDensityKgM3ToKgCm3"] = _truthy(cfg.get("convertDensityKgM3ToKgCm3") if cfg.get("convertDensityKgM3ToKgCm3") is not None else True)
    cfg["disableCiiSupportTagPopulation"] = _truthy(cfg.get("disableCiiSupportTagPopulation", False))
    return cfg


def _friction_for_xml_restraint(xml_type: str, support_config: dict[str, Any]) -> str:
    if _truthy(support_config.get("useFrictionSentinelForNonYSupports", True)) and xml_type != "+Y":
        return "-1.0101"
    return _safe_text(support_config.get("defaultFriction", "0.3"))


def _cii_friction_value(raw_friction: float, support_config: dict[str, Any]) -> float:
    if abs(raw_friction - (-1.0101)) < 1e-6:
        return 0.0
    return raw_friction


def _density_for_output(value: float, support_config: dict[str, Any]) -> float:
    if _truthy(support_config.get("convertDensityKgM3ToKgCm3", True)):
        return value / 1000000.0
    return value


def _norm_header(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _safe_text(value).lower()).strip()


def _row_value(row: dict[str, Any] | None, key: str) -> str:
    if not isinstance(row, dict) or not key:
        return ""
    if _safe_text(row.get(key)):
        return _safe_text(row.get(key))
    raw = row.get("_raw")
    if isinstance(raw, dict) and _safe_text(raw.get(key)):
        return _safe_text(raw.get(key))
    return ""


def _candidate_headers_from_rows(rows: list[dict[str, Any]]) -> list[str]:
    headers: list[str] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        for key in row.keys():
            if key == "_raw" and isinstance(row.get("_raw"), dict):
                for raw_key in row["_raw"].keys():
                    if raw_key not in seen:
                        seen.add(raw_key)
                        headers.append(raw_key)
            elif key not in seen:
                seen.add(key)
                headers.append(key)
    return headers


def _sample_labels_for_header(rows: list[dict[str, Any]], header: str, limit: int = 4) -> list[str]:
    labels = [header]
    for row in rows[:limit]:
        value = _row_value(row, header)
        if value and value not in labels:
            labels.append(value)
    return labels


def _semantic_score(header: str, labels: list[str], target: str) -> int:
    joined = " ".join(_norm_header(v) for v in labels if _safe_text(v))
    compact = joined.replace(" ", "")
    if not joined:
        return 0
    has_temp = bool(re.search(r"\b(temp|temperature)\b", joined)) or "temperature" in compact or "temp" in compact
    has_pressure = bool(re.search(r"\b(press|pressure|kpa|bar|psig?)\b", joined))
    has_test = bool(re.search(r"\b(test|hydro|hydrostatic)\b", joined)) or "testpressure" in compact or "hydropressure" in compact
    has_max = bool(re.search(r"\b(max|maximum)\b", joined)) or "tempmax" in compact or "temperaturemax" in compact
    has_min = bool(re.search(r"\b(min|minimum)\b", joined)) or "tempmin" in compact or "temperaturemin" in compact
    has_ins = bool(re.search(r"\b(ins|insulation)\b", joined))
    has_thk = bool(re.search(r"\b(thickness|thk|mm)\b", joined))
    has_type = bool(re.search(r"\btype\b", joined))
    has_density = bool(re.search(r"\bdensity\b", joined)) or bool(re.search(r"\bkg\b.*\bm\b", joined)) or "kg/m" in joined
    has_gas = bool(re.search(r"\bgas\b", joined))
    has_mixed = bool(re.search(r"\bmixed\b", joined))
    has_liquid = bool(re.search(r"\b(liquid|liq)\b", joined))
    if target == "t1":
        return 100 if has_temp and has_max and not has_pressure else 0
    if target == "t2":
        return 95 if has_temp and not has_max and not has_min and not has_pressure else 0
    if target == "t3":
        return 100 if has_temp and has_min and not has_pressure else 0
    if target == "hydroPressure":
        return 100 if has_pressure and has_test else 0
    if target == "insThk":
        return 100 if has_ins and has_thk and not has_type else 0
    if target == "densityMixed":
        return 100 if has_mixed and has_density else 0
    if target == "densityGas":
        return 100 if has_gas and has_density else 0
    if target == "densityLiquid":
        return 100 if has_liquid and has_density else 0
    return 0


def _normalize_process_field_map(config: dict[str, Any]) -> None:
    linelist = config.setdefault("linelist", {}) if isinstance(config.get("linelist"), dict) else {}
    rows = linelist.get("masterRows")
    if not isinstance(rows, list):
        return
    field_map = linelist.setdefault("fieldMap", {})
    for target in ("t1", "t2", "t3", "hydroPressure", "insThk", "densityMixed", "densityGas", "densityLiquid"):
        best_header = ""
        best_score = 0
        for header in _candidate_headers_from_rows(rows):
            score = _semantic_score(header, _sample_labels_for_header(rows, header), target)
            if score > best_score:
                best_score = score
                best_header = header
        if not _safe_text(field_map.get(target)) and best_header and best_score >= 90:
            field_map[target] = best_header


def _regex_tester_field(branch: str, rule: dict[str, Any], delimiter: str, joiner: str = "") -> str:
    """Match saved Smart Regex FORMAT extraction: explicit TOKEN / REGEX authority."""
    mode = _safe_text(rule.get("extractMode")).upper()
    if mode not in ("", "TOKEN", "REGEX"):
        return ""
    pattern = _safe_text(rule.get("regex"))
    if mode != "TOKEN":
        if mode == "REGEX" and not pattern:
            return ""
        if pattern:
            try:
                match = re.search(pattern, branch)
                group = int(rule.get("group") if rule.get("group") is not None else 1)
                if match is not None and 0 <= group <= match.re.groups:
                    value = _safe_text(match.group(group))
                    if value:
                        return value
            except (ValueError, TypeError, re.error, IndexError):
                return ""
            if rule.get("fallbackOnRegexMiss") is not True:
                return ""
    pos_text = _safe_text(rule.get("tokenPosition"))
    if not pos_text:
        return ""
    try:
        positions = [int(p.strip()) for p in re.split(r"[,+]", pos_text)]
    except ValueError:
        return ""
    if not positions or any(p < 1 for p in positions):
        return ""
    cleaned = re.sub(r"/B\d+$", "", branch.lstrip("/"), flags=re.I)
    parts = [part.strip() for part in cleaned.split(delimiter)]
    selected = [parts[i - 1] if i <= len(parts) else "" for i in positions]
    return joiner.join(selected) if all(selected) else ""


def _regex_tester_format_disabled(fmt: dict[str, Any], index: int) -> bool:
    if fmt.get("enabled") is False:
        return True
    if index == 0 or fmt.get("enabled") is True:
        return False
    # The unused alternate template is not an authored Format 2. Match JS
    # isBranchFormatEnabled so it cannot create a false multi-format conflict.
    hints = {"lineKey": 3, "pipingClass": 4, "rating": 4, "bore": 2}
    return (all(isinstance(fmt.get(key), dict)
                and not _safe_text(fmt[key].get("regex"))
                and not _safe_text(fmt[key].get("extractMode"))
                and _safe_text(fmt[key].get("group") or 1) == "1"
                and _safe_text(fmt[key].get("tokenPosition")) == str(pos)
                and fmt[key].get("fallbackOnRegexMiss") is not True
                for key, pos in hints.items())
            and (_safe_text(fmt.get("tokenDelimiter")) or "-") == "-"
            and not _safe_text(fmt.get("lineKeyJoiner")))


def _regex_tester_branch_line_key(branch: str, config: dict[str, Any]) -> str | None:
    """Saved Smart Regex formats govern source Line List identity in native CII.

    None means no explicit formats were saved; an explicit formats=[] means
    UNMATCHED, never an invitation to use stale legacy token positions.
    """
    regex_cfg = config.get("regexTester")
    if not isinstance(regex_cfg, dict) or not isinstance(regex_cfg.get("formats"), list):
        return None
    candidates = []
    sequence = regex_cfg.get("ratingSequence")
    if not isinstance(sequence, list):
        rating_cfg = config.get("rating")
        sequence = (rating_cfg.get("ratingSequence", []) if isinstance(rating_cfg, dict) else [])
    for index, fmt in enumerate(regex_cfg["formats"]):
        if not isinstance(fmt, dict):
            if config.get("requireVerifiedMasterCompleteness") is True:
                raise ValueError("XML229_BRANCH_FORMAT_INVALID")
            continue  # invalid enrichment format is not a conversion error
        if _regex_tester_format_disabled(fmt, index):
            continue
        delimiter = _safe_text(fmt.get("tokenDelimiter")) or "-"
        joiner = _safe_text(fmt.get("lineKeyJoiner"))
        fields = {}
        for key in ("lineKey", "pipingClass", "rating", "bore"):
            rule = fmt.get(key) if isinstance(fmt.get(key), dict) else {}
            fields[key] = _regex_tester_field(
                branch, rule, delimiter, joiner if key == "lineKey" else "")
        if not fields["lineKey"] or not fields["pipingClass"]:
            continue
        rating = ""
        for pair in sequence:
            if isinstance(pair, list) and len(pair) >= 2 and _safe_text(pair[0]) and (
                fields["pipingClass"].upper().startswith(_safe_text(pair[0]).upper())):
                rating = _safe_text(pair[1])
                break
        if not rating:
            matched = re.search(r"\d+", fields["rating"])
            rating = matched.group() if matched else ""
        candidates.append((
            re.sub(r"\s+", "", fields["lineKey"].upper()),
            fields["pipingClass"], rating, re.sub(r"[^0-9.]", "", fields["bore"])
        ))
    if not candidates:
        if config.get("requireVerifiedMasterCompleteness") is True:
            raise ValueError("XML229_BRANCH_FORMAT_UNMATCHED")
        return ""  # no source identity; XML fields and geometry still convert
    # Rating and bore are optional enrichment, not format identity.
    identities = {(line, cls.upper()) for line, cls, _rating, _bore in candidates}
    if len(identities) != 1:
        if config.get("requireVerifiedMasterCompleteness") is True:
            raise ValueError("XML229_BRANCH_FORMAT_AMBIGUOUS")
        return ""  # don't pick a competing source master
    return candidates[0][0]


def _line_key_from_branch(branch_name: str, config: dict[str, Any]) -> str:
    line_from_saved_formats = _regex_tester_branch_line_key(branch_name, config)
    if line_from_saved_formats is not None:
        return line_from_saved_formats
    linelist = config.get("linelist", {}) if isinstance(config.get("linelist"), dict) else {}
    # Older stand-alone configs may provide the line regex directly. Apply
    # the authored capture before token fallback, never ignore this setting.
    pattern = _safe_text(linelist.get("branchNameRegex"))
    if pattern:
        try:
            matched = re.search(pattern, branch_name)
            group = int(linelist.get("lineNoGroup") or 1)
            if matched is not None and 0 <= group <= matched.re.groups:
                value = _safe_text(matched.group(group))
                if value:
                    return re.sub(r"\s+", "", value.upper())
        except (ValueError, TypeError, re.error, IndexError):
            raise ValueError("XML229_BRANCH_FORMAT_INVALID")
    cleaned = branch_name.strip().lstrip("/").split("/")[0]
    parts = [p.strip() for p in cleaned.split(_safe_text(linelist.get("tokenDelimiter")) or "-") if p.strip()]
    selected: list[str] = []
    for part in re.split(r"[,+]", _safe_text(linelist.get("lineKeyTokenPositions") or "4")):
        try:
            idx = int(part.strip()) - 1
        except ValueError:
            continue
        if 0 <= idx < len(parts):
            selected.append(parts[idx])
    if selected:
        return re.sub(r"\s+", "", "".join(selected).upper())
    return ""


def _line_key_from_row(row: dict[str, Any], config: dict[str, Any]) -> str:
    field_map = config.get("linelist", {}).get("fieldMap", {}) if isinstance(config.get("linelist"), dict) else {}
    for key in [field_map.get("lineSeqNo"), field_map.get("lineKey1"), "lineNo", "lineKey", "lineSeqNo", "Line No", "Line Number", "ColumnX1"]:
        value = _row_value(row, _safe_text(key))
        if value:
            return re.sub(r"\s+", "", value.upper())
    return ""


def _matching_linelist_rows(line_key: str, config: dict[str, Any]) -> list[dict[str, Any]]:
    rows = config.get("linelist", {}).get("masterRows", []) if isinstance(config.get("linelist"), dict) else []
    wanted = re.sub(r"\s+", "", line_key.upper())
    if not wanted:
        return []  # an unresolved format must never join an empty Line List key
    exact = [row for row in rows if isinstance(row, dict) and _line_key_from_row(row, config) == wanted]
    if exact or not re.fullmatch(r"P[0-9]{7}", wanted):
        return exact
    # BM2 PSI branch P4110001 versus its pinned LL_BM2 C9=4110001.
    # A single numeric source row may qualify; never guess among duplicates.
    alias = [row for row in rows if isinstance(row, dict) and _line_key_from_row(row, config) == wanted[1:]]
    return alias if len(alias) == 1 else []


def _mapped_process_value(line_key: str, config: dict[str, Any], field: str, fallbacks: list[str]) -> str:
    field_map = config.get("linelist", {}).get("fieldMap", {}) if isinstance(config.get("linelist"), dict) else {}
    keys = [_safe_text(field_map.get(field)) if isinstance(field_map, dict) else "", field, field.upper(), *fallbacks]
    values: list[str] = []
    for row in _matching_linelist_rows(line_key, config):
        for key in keys:
            value = _row_value(row, key)
            if value:
                values.append(value)
                break
    numeric_values = [_numeric_token(value) for value in values if _numeric_token(value)]
    if numeric_values:
        return numeric_values[-1] if field in {"t3", "densityMixed"} else numeric_values[0]
    return values[0] if values else ""


def _branch_nodes(branch: ET.Element, namespace: str) -> list[ET.Element]:
    return [node for node in list(branch) if _local_name(node.tag) == "Node"]


def _kind_from_dtxr(text: str, support_config: dict[str, Any]) -> list[str]:
    normalized = _safe_text(text).upper()
    if not normalized:
        return []
    kinds: list[str] = []
    rules = support_config.get("keywordRules") if isinstance(support_config.get("keywordRules"), list) else DEFAULT_SUPPORT_CONFIG["keywordRules"]
    for rule in rules:
        kind = _safe_text(rule.get("kind")).upper() if isinstance(rule, dict) else ""
        patterns = rule.get("patterns") if isinstance(rule, dict) else None
        if not kind or not isinstance(patterns, list):
            continue
        for pattern in patterns:
            try:
                matched = re.search(str(pattern), normalized, flags=re.I) is not None
            except re.error:
                matched = str(pattern).upper() in normalized
            if matched:
                if kind not in kinds:
                    kinds.append(kind)
                break
    if "LINESTOP" in kinds and "ANCHOR" in kinds:
        kinds = [kind for kind in kinds if kind != "ANCHOR"]
    return kinds


def _xml_types_from_dtxr(text: str, support_config: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for kind in _kind_from_dtxr(text, support_config):
        xml_type = SUPPORT_KIND_TO_XML_TYPE.get(kind, kind)
        if xml_type and xml_type not in out:
            out.append(xml_type)
    return out


def _apply_dtxr_restraints_to_node(node: ET.Element, namespace: str, support_config: dict[str, Any], use_dtxr_only: bool = True) -> bool:
    text = " | ".join(filter(None, [_child_text(node, namespace, "DTXR_POS"), _child_text(node, namespace, "DTXR_PS")]))
    xml_types = _xml_types_from_dtxr(text, support_config)
    if not xml_types:
        return False
    existing = [child for child in list(node) if _local_name(child.tag) == "Restraint"]
    keep: list[str] = []
    if not use_dtxr_only:
        keep = [_child_text(rest, namespace, "Type") for rest in existing if _child_text(rest, namespace, "Type")]
    for restraint in existing:
        node.remove(restraint)
    for xml_type in [*keep, *xml_types]:
        restraint = ET.Element(_q(namespace, "Restraint"))
        _set_child(restraint, namespace, "Type", xml_type)
        _set_child(restraint, namespace, "Stiffness", support_config.get("defaultStiffness", "1.751270E+12"))
        _set_child(restraint, namespace, "Gap", support_config.get("defaultGap", "0"))
        _set_child(restraint, namespace, "Friction", _friction_for_xml_restraint(xml_type, support_config))
        node.append(restraint)
    return True


def _renumber_length_bearing_negative_nodes(root: ET.Element, namespace: str) -> bool:
    branches = [branch for branch in root.iter() if _local_name(branch.tag) == "Branch"]
    branch_nodes = [_branch_nodes(branch, namespace) for branch in branches]
    original_numbers = {id(node): _numeric_text(_child_text(node, namespace, "NodeNumber")) for nodes in branch_nodes for node in nodes}
    used = {int(round(value)) for value in original_numbers.values() if value is not None and value > 0}
    fallback = 10000
    changed = False
    for nodes in branch_nodes:
        for idx, node in enumerate(nodes):
            node_no = original_numbers.get(id(node))
            comp = _child_text(node, namespace, "ComponentType").upper()
            elem_len = _numeric_text(_child_text(node, namespace, "ElementLengthMm"))
            if node_no is None or int(round(node_no)) >= 0 or comp not in RENUMBERABLE_NEGATIVE_TYPES or elem_len is None or elem_len <= 0:
                continue
            prev_num = next((int(round(v)) for p in reversed(nodes[:idx]) for v in [original_numbers.get(id(p))] if v is not None and v > 0), None)
            next_num = next((int(round(v)) for n in nodes[idx + 1:] for v in [original_numbers.get(id(n))] if v is not None and v > 0), None)
            candidates = [c for c in ((next_num - 1 if next_num else None), (prev_num + 1 if prev_num else None)) if c and c > 0]
            assigned = next((candidate for candidate in candidates if candidate not in used), None)
            if assigned is None:
                while fallback in used:
                    fallback += 10
                assigned = fallback
                fallback += 10
            _set_child(node, namespace, "NodeNumber", assigned)
            used.add(assigned)
            changed = True
    return changed



def _source_class_dn(row: dict[str, Any]) -> int | None:
    """Selected master rows may be raw NPS/Size or normalized convertedBore.

    Never confuse an NPS=6 source row with DN=6: normalize to DN150.
    Reject inconsistent supplied bore keys rather than silently choosing one.
    """
    dn_text = (_row_value(row, "convertedBore") or
               _row_value(row, "converted_bore"))
    nps_text = (_row_value(row, "Size") or _row_value(row, "size") or
                _row_value(row, "NPS"))
    try:
        if dn_text:
            raw = float(dn_text)
            if not math.isfinite(raw) or not raw.is_integer() or raw <= 0:
                raise ValueError("invalid converted bore")
            dn = int(raw)
        else:
            dn = None
        if nps_text:
            nps = float(nps_text.replace('"', '').strip())
            from_nps = addon.nps_to_dn(nps) if addon is not None else None
            if from_nps is None:
                raise ValueError("unsupported NPS")
            if dn is not None and dn != from_nps:
                raise ValueError("inconsistent DN and NPS")
            dn = from_nps
    except (ValueError, TypeError, OverflowError) as exc:
        raise ValueError("XML229_PIPING_CLASS_BORE_INVALID") from exc
    return dn


def _source_class_wall_index(config: dict[str, Any], requested: set[str] | None = None) -> dict[tuple[str, int], float]:
    """Index only explicit class + converted DN master facts; never infer wall."""
    section = config.get("pipingClass", {})
    rows = section.get("masterRows", []) if isinstance(section, dict) else []
    index: dict[tuple[str, int], float] = {}
    if not isinstance(rows, list):
        return index
    for row in rows:
        if not isinstance(row, dict):
            continue
        class_code = (_row_value(row, "Piping Class") or
                      _row_value(row, "pipingClass")).strip()
        if requested is not None and class_code not in requested:
            continue
        dn = _source_class_dn(row)
        wall_text = (_row_value(row, "Wall thickness") or
                     _row_value(row, "wallThicknessMm") or
                     _row_value(row, "WallThickness"))
        if not class_code or dn is None or not wall_text:
            continue
        try:
            wall = float(wall_text)
        except ValueError:
            raise ValueError("XML229_PIPING_CLASS_INVALID_MASTER_VALUE") from None
        if not math.isfinite(wall) or wall <= 0:
            raise ValueError("XML229_PIPING_CLASS_INVALID_MASTER_VALUE")
        key = (class_code, dn)
        if key in index and not math.isclose(index[key], wall, rel_tol=0, abs_tol=1e-6):
            raise ValueError("XML229_PIPING_CLASS_BORE_AMBIGUOUS")
        index[key] = wall
    return index


def _apply_source_class_wall(branch: ET.Element, namespace: str,
                             index: dict[tuple[str, int], float]) -> bool:
    """A node's real OD, not only the branch header size, controls its wall."""
    name = _child_text(branch, namespace, "Branchname")
    match = re.search(r"-(\d{4,8})-\d+(?:/B\d+)?$", name, re.I)
    if not match or not index or addon is None:
        return False
    class_code = match.group(1)
    changed = False
    for node in _branch_nodes(branch, namespace):
        existing = _numeric_text(_child_text(node, namespace, "WallThickness"))
        if existing is not None and existing > 0:
            continue  # source wall is explicit; never replace it with derived master.
        od = _numeric_text(_child_text(node, namespace, "OutsideDiameter"))
        dn = addon.od_to_dn(od) if od is not None else None
        wall = index.get((class_code, dn)) if dn is not None else None
        if wall is None:
            continue  # no source-approved row; do not manufacture a dimension.
        if od is None or wall * 2 >= od:
            raise ValueError("XML229_PIPING_CLASS_WALL_EXCEEDS_OD")
        _set_child(node, namespace, "WallThickness", format(wall, ".12g"))
        changed = True
    return changed



def _material_scoped_pin_ids(config: dict[str, Any],
                             requested: set[str] | None) -> dict[str, int]:
    """Honor only explicit Material-identity pins, never branch/class guesses."""
    if not requested:
        return {}
    overrides = config.get("overrides", {})
    pins = overrides.get("materialCode", {}) if isinstance(overrides, dict) else {}
    if not isinstance(pins, dict):
        return {}
    permitted: dict[str, set[str]] = {}
    for material in requested:
        tokens = {" ".join(material.upper().split())}
        tokens.add(re.sub(r"[^A-Z0-9]", "", material.upper()))
        spec = re.search(r"\b([AB]\d{3})\b", material.upper())
        grade = re.search(r"\b([SN]\d{5})\b", material.upper())
        if spec and grade:
            tokens.add(spec.group(1) + "-" + grade.group(1))
        permitted[material] = tokens
    result: dict[str, int] = {}
    for raw_key, raw_code in pins.items():
        key = " ".join(str(raw_key).upper().strip().split())
        if key.startswith("MAT:"):
            key = key[4:].strip()
        candidates = [name for name, keys in permitted.items() if key in keys]
        if not candidates:
            continue  # class, branch, and line scoped overrides are not material pins.
        if len(candidates) != 1:
            raise ValueError("XML229_MATERIAL_PIN_OWNER_AMBIGUOUS")
        code = str(raw_code).strip() if type(raw_code) is not bool else ""
        if not re.fullmatch(r"[1-9]\d*", code):
            raise ValueError("XML229_MATERIAL_PIN_INVALID")
        name = candidates[0]
        if name in result and result[name] != int(code):
            raise ValueError("XML229_MATERIAL_PIN_CONFLICT")
        result[name] = int(code)
    return result


def _material_ids_from_config(config: dict[str, Any],
                              requested: set[str] | None = None) -> dict[str, int]:
    """Only exact selected material-map names with positive numeric CII IDs."""
    section = config.get("material", {})
    rows = section.get("mapRows", []) if isinstance(section, dict) else []
    result: dict[str, int] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        name = (_row_value(row, "material") or _row_value(row, "Material") or
                _row_value(row, "Material_Name") or _row_value(row, "Material Name") or
                 _row_value(row, "materialName"))
        code = (_row_value(row, "code") or _row_value(row, "Code") or
                _row_value(row, "materialCode") or _row_value(row, "MaterialCode") or
                _row_value(row, "Material Code"))
        if not name or not re.fullmatch(r"[1-9]\d*", code):
            continue  # nonnumeric map code is not a CAESAR material index.
        key = " ".join(name.upper().split())
        if requested is not None and key not in requested:
            continue
        val = int(code)
        if key in result and result[key] != val:
            raise ValueError("XML229_MATERIAL_CODE_AMBIGUOUS")
        result[key] = val
    for name, pinned_id in _material_scoped_pin_ids(config, requested).items():
        if name in result and result[name] != pinned_id:
            raise ValueError("XML229_MATERIAL_PIN_MAP_CONFLICT")
        result[name] = pinned_id
    return result


def _process_material_for_line(line_key: str, config: dict[str, Any]) -> str:
    """The selected Line List Material outranks class fallback; never guess."""
    section = config.get("linelist", {})
    field_map = section.get("fieldMap", {}) if isinstance(section, dict) else {}
    # A duplicated numeric fallback is not an absent Process Material;
    # fail closed before the lower-authority class can supply its material.
    wanted = re.sub(r"\s+", "", line_key.upper())
    if re.fullmatch(r"P[0-9]{7}", wanted):
        rows = section.get("masterRows", []) if isinstance(section, dict) else []
        exact = [row for row in rows if isinstance(row, dict) and
                 _line_key_from_row(row, config) == wanted]
        if not exact:
            alias = [row for row in rows if isinstance(row, dict) and
                     _line_key_from_row(row, config) == wanted[1:]]
            if len(alias) > 1:
                raise ValueError("XML229_LINE_MATERIAL_AMBIGUOUS")
    keys = [field_map.get("material") if isinstance(field_map, dict) else None,
            "material", "Material", "MATERIAL", "MOC",
            "Material Name", "Material_Name", "processMaterial"]
    unique: dict[str, str] = {}
    for row in _matching_linelist_rows(line_key, config):
        for key in keys:
            value = _row_value(row, str(key)) if key else ""
            if value:
                unique.setdefault(" ".join(value.upper().split()), value)
                break
    if len(unique) > 1:
        raise ValueError("XML229_LINE_MATERIAL_AMBIGUOUS")
    return next(iter(unique.values()), "")


def _source_class_meta_index(config: dict[str, Any],
                             requested: set[str] | None = None) -> dict[tuple[str, int], tuple[str, str]]:
    """Require one consistent spec material/rating for each exact class/bore."""
    section = config.get("pipingClass", {})
    rows = section.get("masterRows", []) if isinstance(section, dict) else []
    index: dict[tuple[str, int], tuple[str, str]] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        cls = _row_value(row, "Piping Class") or _row_value(row, "pipingClass")
        dn = _source_class_dn(row)
        if not cls or (requested is not None and cls not in requested) or dn is None:
            continue
        material = (_row_value(row, "Material_Name") or
                    _row_value(row, "materialName"))
        rating = _row_value(row, "Rating") or _row_value(row, "rating")
        key = (cls, dn)
        if key in index and index[key] != (material, rating):
            raise ValueError("XML229_PIPING_CLASS_MATERIAL_RATING_AMBIGUOUS")
        index[key] = material, rating
    return index


def _apply_source_material_rating(branch: ET.Element, namespace: str,
                                  specs: dict[tuple[str, int], tuple[str, str]],
                                  material_ids: dict[str, int],
                                  process_material: str = "") -> bool:
    name = _child_text(branch, namespace, "Branchname")
    match = re.search(r"-(\d{4,8})-\d+(?:/B\d+)?$", name, re.I)
    if not match or addon is None:
        return False
    changed = False
    for node in _branch_nodes(branch, namespace):
        # The class master describes pipe material, not the body of a valve,
        # support, flange or gasket. Their IDs require separate source facts.
        if _child_text(node, namespace, "ComponentType").upper() not in {"PIPE", "PCOM", "BRAN", "TUBE"}:
            continue
        od = _numeric_text(_child_text(node, namespace, "OutsideDiameter"))
        dn = addon.od_to_dn(od) if od is not None else None
        metadata = specs.get((match.group(1), dn)) if dn is not None else None
        if metadata is None and not process_material:
            continue
        material, rating = metadata if metadata is not None else ("", "")
        selected_material = process_material or material
        # A process Material claim has higher authority than class fallback,
        # but a contradictory pre-existing XML grade is not ours to erase.
        existing_name = _child_text(node, namespace, "MaterialName")
        if (process_material and existing_name and
                " ".join(existing_name.upper().split()) !=
                " ".join(process_material.upper().split())):
            raise ValueError("XML229_PROCESS_MATERIAL_NAME_CONFLICT")
        for key, value in (("PipingClass", match.group(1)),
                           ("MaterialName", selected_material), ("PipingClassRating", rating)):
            if value and not _child_text(node, namespace, key):
                _set_child(node, namespace, key, value)
                changed = True
        # Existing source material IDs take precedence. Never infer a CII
        # numeric ID from DSS, a 900# rating, or the unapproved S32803 alias.
        existing = (_numeric_text(_child_text(node, namespace, "MaterialCode")) or
                    _numeric_text(_child_text(node, namespace, "MaterialNumber")))
        material_id = material_ids.get(" ".join(selected_material.upper().split()))
        if (process_material and material_id and existing is not None and
                existing > 0 and existing != material_id):
            raise ValueError("XML229_PROCESS_MATERIAL_CODE_CONFLICT")
        if material_id and not (existing is not None and existing > 0):
            _set_child(node, namespace, "MaterialCode", str(material_id))
            changed = True
    return changed


def _apply_staged_position_restraints(node: ET.Element, namespace: str,
                                       support_config: dict[str, Any],
                                       branch_name: str) -> bool:
    """Replay original position-matched staged members under current Step 7/8.

    The source ownership match has already been qualified by XYZ, branch and
    PS tag in master_addon. Never turn a preview text/keyword-only match into
    new CII engineering authority; interpret the same original member attrs
    with the same config as governed pre-Final Python replay.
    """
    node_no = _child_text(node, namespace, "NodeNumber")
    source_members = support_config.get("_stagedPositionMemberRows", {}).get(
        (branch_name, node_no), [])
    if (support_config.get("supportMapping") or {}).get("useJsonForRestraints") is False:
        return False
    pos_text = _child_text(node, namespace, "DTXR_POS")
    if not pos_text:
        raise ValueError(f"XML229_STAGED_POS_OWNER_MISSING branch={branch_name} node={node_no}")
    if not source_members:
        # Older enrichment clients did not transfer source member attributes.
        # No naked DTXR keyword may impersonate a selected original source.
        raise ValueError(f"XML229_STAGED_POSITION_SOURCE_MEMBERS_REQUIRED branch={branch_name} node={node_no}")

    from xml229_prefinal_restraints import (kinds as classify_source_kinds,
                                            source_gap, append_profile, numeric,
                                            present_type, placeholder)

    def require(condition, code):
        if not condition:
            raise ValueError(code)

    entries = []
    for member in source_members:
        # Do not derive a new restraint from a PIPE/ELBO/VALV DTXR token.
        # Only a physical staged support member can carry support intent.
        component_type = str(member.get("sourceType") or "").upper()
        if component_type and component_type not in ("SUPPORT", "ATTA", "ANCI"):
            continue
        attrs = dict(member.get("sourceAttrs") or {})
        if not attrs.get("DTXR"):
            attrs["DTXR"] = member.get("dtxr", "")
        if not any(attrs.get(key) is not None for key in
                   ("CMPSUPGAP", "CMPSUPGAP_POS", "CMPSUPGAP_PS", "NODEGAP")):
            gap = _parse_cmpsupgap_from_dtxr_entry(member.get("dtxr", ""))
            if gap is not None:
                attrs["CMPSUPGAP"] = str(gap)
        entries.append({"attrs": attrs, "desc": attrs.get("DTXR", ""),
                        "type": member.get("sourceType") or "SUPPORT"})

    matched = classify_source_kinds(entries, require, support_config)
    if not matched:
        # DTXR from ordinary fittings does not constitute a support restraint.
        print("XML229_STAGED_NO_SUPPORT_INTENT " + json.dumps(
            {"branch": branch_name, "node": node_no,
             "sourceMembers": len(source_members)}, sort_keys=True))
        return False

    for kind, attrs in matched.items():
        gap = source_gap(attrs)
        if kind == "LINESTOP" and (not gap or numeric(gap) is None):
            raise ValueError(f"XML229_STAGED_LINESTOP_GAP_MISSING branch={branch_name} node={node_no}")

    prior = [child for child in list(node) if _local_name(child.tag) == "Restraint"]
    original = [{
        "type": _child_text(rest, namespace, "Type"),
        "gap": _child_text(rest, namespace, "Gap"),
        "source": rest.get("source") or rest.get("basis") or "",
    } for rest in prior]
    expected_node = ET.Element(_q(namespace, "Node"))
    for kind in ("REST", "GUIDE", "LINESTOP"):
        if kind in matched:
            append_profile(expected_node, kind, matched[kind], support_config)
    expected = [r for r in expected_node if _local_name(r.tag) == "Restraint"]
    valid_types = {present_type(_child_text(rest, namespace, "Type")) for rest in expected}
    # A generated DTXR annotation is replaceable; an independently authored
    # XML restraint is not. Unmarked non-placeholder XML without a prior DTXR
    # stamp has unknown provenance and cannot silently be rewritten.
    originally_annotated = (branch_name, node_no) in support_config.get(
        "_originalDtxrStampedOwners", ())
    authoritative = []
    for rest in prior:
        label = str(rest.get("source") or rest.get("basis") or "").lower()
        if label in ("original", "inputxml", "input-xml", "owner", "manual",
                     "authoritative", "source-original"):
            authoritative.append(rest)
        elif label in ("generated", "preview", "staged", "derived", "dtxr"):
            continue
        elif placeholder(rest) or originally_annotated:
            continue
        else:
            # Untagged XML is not automatically stale. It can be retained
            # when the independently matched source agrees in BOTH type and
            # explicit gap; otherwise its authority is unresolved.
            old_type = present_type(_child_text(rest, namespace, "Type"))
            old_gap = _child_text(rest, namespace, "Gap")
            compatible = [row for row in expected
                if present_type(_child_text(row, namespace, "Type")) == old_type]
            if (len(compatible) != 1 or
                    (old_gap and (numeric(old_gap) is None or
                     numeric(_child_text(compatible[0], namespace, "Gap")) is None or
                     not math.isclose(numeric(old_gap),
                         numeric(_child_text(compatible[0], namespace, "Gap")),
                         abs_tol=1e-6, rel_tol=0)))):
                raise ValueError("XML229_XML_RESTRAINT_PROVENANCE_UNRESOLVED")
            authoritative.append(rest)
    for rest in authoritative:
        typ = present_type(_child_text(rest, namespace, "Type"))
        if typ not in valid_types:
            raise ValueError("XML229_SOURCE_XML_RESTRAINT_TYPE_CONFLICT")
        source_rows = [r for r in expected
                       if present_type(_child_text(r, namespace, "Type")) == typ]
        if len(source_rows) != 1:
            raise ValueError("XML229_SOURCE_XML_RESTRAINT_TYPE_AMBIGUOUS")
        prior_gap = _child_text(rest, namespace, "Gap")
        source_gap_text = _child_text(source_rows[0], namespace, "Gap")
        if prior_gap and (numeric(prior_gap) is None or
                numeric(source_gap_text) is None or
                not math.isclose(numeric(prior_gap), numeric(source_gap_text),
                                 abs_tol=1e-6, rel_tol=0)):
            raise ValueError("XML229_SOURCE_XML_RESTRAINT_GAP_CONFLICT")
    for rest in prior:
        if rest not in authoritative:
            node.remove(rest)
    retained = {present_type(_child_text(rest, namespace, "Type"))
                for rest in authoritative}
    for r in expected:
        if present_type(_child_text(r, namespace, "Type")) not in retained:
            node.append(r)

    added = [r for r in node if _local_name(r.tag) == "Restraint"]
    if not added:
        raise ValueError(f"XML229_STAGED_POS_UNRESOLVED branch={branch_name} node={node_no}")
    print("XML229_STAGED_RESTRAINT_BIND " + json.dumps({
        "branch": branch_name, "node": node_no,
        "posAnnotation": pos_text,
        "supersededXml": original,
        "sourceMemberNames": [str(m.get("sourceAttrs", {}).get("NAME", "")) for m in source_members],
        "nativeRestraints": [{
            "type": _child_text(rest, namespace, "Type"),
            "gapMm": numeric(_child_text(rest, namespace, "Gap")),
        } for rest in added],
        "configSource": "saved-Step7-Step8-original-staged-member",
    }, sort_keys=True))
    return True


def _source_class_corrosion_index(
        config: dict[str, Any], requested: set[str] | None = None
        ) -> dict[tuple[str, int], float]:
    """Optional *explicit* class-bore corrosion source, including 0."""
    section = config.get("pipingClass", {})
    rows = section.get("masterRows", []) if isinstance(section, dict) else []
    index: dict[tuple[str, int], float] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        cls = _row_value(row, "Piping Class") or _row_value(row, "pipingClass")
        if not cls or (requested is not None and cls not in requested):
            continue
        dn = _source_class_dn(row)
        raw = (_row_value(row, "Corrosion") or
               _row_value(row, "CorrosionAllowance") or
               _row_value(row, "corrosionAllowance"))
        if dn is None or not raw:
            continue
        try:
            value = float(raw)
        except (ValueError, TypeError):
            raise ValueError("XML229_PIPING_CLASS_CORROSION_INVALID") from None
        if not math.isfinite(value) or value < 0:
            raise ValueError("XML229_PIPING_CLASS_CORROSION_INVALID")
        key = (cls, dn)
        if key in index and not math.isclose(index[key], value, abs_tol=1e-6):
            raise ValueError("XML229_PIPING_CLASS_CORROSION_AMBIGUOUS")
        index[key] = value
    return index


def _apply_source_class_corrosion(
        branch: ET.Element, namespace: str,
        index: dict[tuple[str, int], float]) -> bool:
    """Fill only absent pipe corrosion claims; preserve original explicit 0."""
    name = _child_text(branch, namespace, "Branchname")
    match = re.search(r"-(\d{4,8})-\d+(?:/B\d+)?$", name, re.I)
    if not match or addon is None:
        return False
    changed = False
    for node in _branch_nodes(branch, namespace):
        if _child_text(node, namespace, "ComponentType").upper() not in {
                "PIPE", "PCOM", "BRAN", "TUBE"}:
            continue
        if _child_text(node, namespace, "CorrosionAllowance"):
            continue
        od = _numeric_text(_child_text(node, namespace, "OutsideDiameter"))
        dn = addon.od_to_dn(od) if od is not None else None
        key = (match.group(1), dn)
        if key not in index:
            continue
        _set_child(node, namespace, "CorrosionAllowance",
                   format(index[key], ".12g"))
        changed = True
    return changed


def _assert_verified_master_completeness(
        root: ET.Element, namespace: str, support_config: dict[str, Any],
        class_wall_index: dict[tuple[str, int], float],
        class_meta_index: dict[tuple[str, int], tuple[str, str]],
        material_ids: dict[str, int],
        class_corrosion_index: dict[tuple[str, int], float] | None = None) -> None:
    """Fail closed for governed candidates; diagnostics retain legacy behavior.

    A selected source fact must agree with native XML; simply seeing a
    plausible value (or the writer's 0.01-mm fallback) is not verification.
    Final emitted CII fields are independently checked downstream.
    """
    if support_config.get("requireVerifiedMasterCompleteness") is not True:
        return
    if addon is None:
        raise ValueError("XML229_VERIFIED_CLASS_LOOKUP_UNAVAILABLE")
    checked_branches = 0
    checked_nodes = 0
    for branch in root.iter():
        if _local_name(branch.tag) != "Branch":
            continue
        nodes = [node for node in _branch_nodes(branch, namespace)
                 if _child_text(node, namespace, "ComponentType").upper()
                 in {"PIPE", "PCOM", "BRAN", "TUBE"}]
        if not nodes:
            continue
        name = _child_text(branch, namespace, "Branchname")
        class_match = re.search(r"-(\d{4,8})-\d+(?:/B\d+)?$", name, re.I)
        if class_match is None:
            raise ValueError("XML229_VERIFIED_PIPING_CLASS_UNRESOLVED")
        cls = class_match.group(1)
        line = _line_key_from_branch(name, support_config)
        if not line or len(_matching_linelist_rows(line, support_config)) != 1:
            raise ValueError("XML229_VERIFIED_LINE_LIST_UNRESOLVED")
        pressure = next((e for e in branch if _local_name(e.tag) == "Pressure"), None)
        temperature = next((e for e in branch if _local_name(e.tag) == "Temperature"), None)
        for key, parent, xml_key, aliases, mandatory, code in (
                ("p1", pressure, "Pressure1", ["P1", "Design Pressure", "Operating Pressure"],
                 True, "XML229_VERIFIED_PRESSURE_MISSING"),
                ("t1", temperature, "Temperature1", ["T1", "Temp Max", "Temperature Max"],
                 True, "XML229_VERIFIED_T1_MISSING"),
                ("t2", temperature, "Temperature2", ["T2", "Temp", "Temperature"],
                 False, "XML229_VERIFIED_T2_MISSING"),
                ("t3", temperature, "Temperature3", ["T3", "Temp Min", "Temperature Min"],
                 True, "XML229_VERIFIED_T3_MISSING")):
            selected = _mapped_process_value(line, support_config, key, aliases)
            declared = bool(_safe_text((support_config.get("linelist") or {})
                        .get("fieldMap", {}).get(key)))
            if not selected and not mandatory and not declared:
                continue  # T2 may be genuinely not applicable.
            source = _numeric_text(selected)
            xml = _numeric_text(_child_text(parent, namespace, xml_key)) if parent is not None else None
            if source is None or xml is None:
                raise ValueError(code)
            if key.startswith("t") and (source == -100000 or xml == -100000):
                raise ValueError(code)
            if not math.isclose(source, xml, rel_tol=0, abs_tol=1e-6):
                raise ValueError("XML229_VERIFIED_PROCESS_FIELD_CONFLICT")
        density = (_mapped_process_value(line, support_config, "densityMixed",
                       ["Mixed kg/m3", "Mixed kg/m³", "Density Mixed"])
                   or _mapped_process_value(line, support_config, "densityGas",
                       ["Gas kg/m3", "Gas kg/m³", "Density Gas"])
                   or _mapped_process_value(line, support_config, "densityLiquid",
                       ["Liquid kg/m3", "Liquid kg/m³", "Density Liquid"]))
        src_density = _numeric_text(density)
        xml_density = _numeric_text(_child_text(branch, namespace, "FluidDensity"))
        if src_density is None or xml_density is None:
            raise ValueError("XML229_VERIFIED_DENSITY_MISSING")
        if not math.isclose(src_density, xml_density, rel_tol=0, abs_tol=1e-6):
            raise ValueError("XML229_VERIFIED_DENSITY_CONFLICT")
        for node in nodes:
            od = _numeric_text(_child_text(node, namespace, "OutsideDiameter"))
            dn = addon.od_to_dn(od) if od is not None else None
            if dn is None or (cls, dn) not in class_wall_index:
                raise ValueError("XML229_VERIFIED_CLASS_DN_WALL_MISSING")
            wall = _numeric_text(_child_text(node, namespace, "WallThickness"))
            expected = class_wall_index[(cls, dn)]
            if wall is None or wall <= 0 or not math.isclose(
                    wall, expected, rel_tol=0, abs_tol=1e-6):
                raise ValueError("XML229_VERIFIED_CLASS_DN_WALL_CONFLICT")
            if class_corrosion_index and (cls, dn) in class_corrosion_index:
                source_corrosion = class_corrosion_index[(cls, dn)]
                measured_corrosion = _numeric_text(_child_text(
                    node, namespace, "CorrosionAllowance"))
                if measured_corrosion is None or not math.isclose(
                        source_corrosion, measured_corrosion, abs_tol=1e-6, rel_tol=0):
                    raise ValueError("XML229_VERIFIED_CLASS_CORROSION_CONFLICT")
            meta = class_meta_index.get((cls, dn))
            if meta is None:
                raise ValueError("XML229_VERIFIED_CLASS_RATING_MISSING")
            # Owner: Rating is optional enrichment. Verify the XML rating
            # only when the selected master actually supplies one.
            if meta[1] and _child_text(node, namespace, "PipingClassRating") != meta[1]:
                raise ValueError("XML229_VERIFIED_CLASS_RATING_CONFLICT")
            chosen_material = _process_material_for_line(line, support_config) or meta[0]
            actual_material = " ".join(_child_text(node, namespace, "MaterialName").upper().split())
            if not chosen_material or actual_material != " ".join(chosen_material.upper().split()):
                raise ValueError("XML229_VERIFIED_MATERIAL_NAME_CONFLICT")
            approved_code = material_ids.get(actual_material)
            code = _numeric_text(_child_text(node, namespace, "MaterialCode"))
            if approved_code is None or code is None or code <= 0:
                raise ValueError("XML229_VERIFIED_MATERIAL_CODE_UNAPPROVED")
            if code != approved_code or int(code) != code:
                raise ValueError("XML229_VERIFIED_MATERIAL_CODE_CONFLICT")
            checked_nodes += 1
        checked_branches += 1
    if not checked_nodes:
        raise ValueError("XML229_VERIFIED_PIPE_CENSUS_EMPTY")
    print("XML229_VERIFIED_MASTER_COMPLETENESS " + json.dumps({
        "status": "VERIFIED_SOURCE_TO_XML", "branches": checked_branches,
        "pipeNodes": checked_nodes, "actualCiiVerification": "PENDING_INDEPENDENT",
    }, sort_keys=True))


def _apply_process_data_to_xml(xml_path: Path, support_config: dict[str, Any]) -> Path:
    _normalize_process_field_map(support_config)
    tree = ET.parse(xml_path)
    root = tree.getroot()
    namespace = _namespace(root.tag)
    if namespace:
        ET.register_namespace("", namespace)
    changed = False
    skip_dtxr_restraint_fallback = _xml_restraints_are_authoritative(xml_path, support_config)
    insulation_density_default = _to_float(support_config.get("insulationDensityDefault"), 210.0)
    # Source-authority hydration: index only class/material identities present
    # in this physical XML, never mix a class grade into a valve or support.
    source_classes = {match.group(1) for branch in root.iter()
                      if _local_name(branch.tag) == "Branch"
                      for match in [re.search(r"-(\d{4,8})-\d+(?:/B\d+)?$",
                                              _child_text(branch, namespace, "Branchname"), re.I)]
                      if match}
    # Masters only enrich the XML. A bad master never prevents diagnostic
    # conversion, but the governed verified-authority gate still rejects it.
    strict = support_config.get("requireVerifiedMasterCompleteness") is True
    def optional_master_index(build, absent, code):
        try:
            return build(support_config, source_classes)
        except (ValueError, TypeError) as exc:
            if strict:
                raise
            print("XML229_ENRICHMENT_SKIPPED " + json.dumps({
                "source": code, "reason": "CONFLICT_OR_INVALID",
            }, sort_keys=True))
            return absent
    class_wall_index = optional_master_index(_source_class_wall_index, {}, "PIPING_CLASS_WALL")
    class_meta_index = optional_master_index(_source_class_meta_index, {}, "PIPING_CLASS_META")
    class_corrosion_index = optional_master_index(_source_class_corrosion_index, {}, "PIPING_CLASS_CORROSION")
    material_names = {" ".join(name.upper().split()) for name, _rating in class_meta_index.values() if name}
    for source_branch in root.iter():
        if _local_name(source_branch.tag) != "Branch":
            continue
        source_line = _line_key_from_branch(
            _child_text(source_branch, namespace, "Branchname"), support_config)
        try:
            source_material = _process_material_for_line(source_line, support_config)
        except (ValueError, TypeError):
            if strict:
                raise
            source_material = ""  # conflicting source identity is not guessed
        if source_material:
            material_names.add(" ".join(source_material.upper().split()))
    try:
        material_ids = _material_ids_from_config(support_config, material_names)
    except (ValueError, TypeError):
        if strict:
            raise
        print("XML229_ENRICHMENT_SKIPPED " + json.dumps({
            "source": "MATERIAL_MAP", "reason": "CONFLICT_OR_INVALID",
        }, sort_keys=True))
        material_ids = {}
    staged_pos_owners = set(tuple(row) for row in support_config.get("_stagedPositionOwners", ()))
    for branch in root.iter():
        if _local_name(branch.tag) != "Branch":
            continue
        # Class enrichment runs on exactly the XML that the native parser sees.
        # It is independent of staged JSON and of Preview-only presentation.
        class_branch = ET.fromstring(ET.tostring(branch))
        try:
            class_changed = _apply_source_class_wall(
                class_branch, namespace, class_wall_index)
            class_changed = _apply_source_class_corrosion(
                class_branch, namespace, class_corrosion_index) or class_changed
        except (ValueError, TypeError):
            if strict:
                raise
            class_changed = False
            print("XML229_ENRICHMENT_SKIPPED " + json.dumps({
                "source": "PIPING_CLASS_DIMENSION", "reason": "CONFLICT_OR_INVALID",
            }, sort_keys=True))
        if class_changed:
            branch[:] = list(class_branch)
            changed = True
        line_key = _line_key_from_branch(_child_text(branch, namespace, "Branchname"), support_config)
        try:
            process_material = _process_material_for_line(line_key, support_config)
        except (ValueError, TypeError):
            if strict:
                raise
            process_material = ""
            print("XML229_ENRICHMENT_SKIPPED " + json.dumps({
                "source": "LINE_MATERIAL", "reason": "CONFLICT_OR_INVALID",
            }, sort_keys=True))
        # Stage material enrichment in isolation, so a contradiction cannot
        # partially mutate original XML before conversion continues.
        material_branch = ET.fromstring(ET.tostring(branch))
        try:
            updated_material = _apply_source_material_rating(
                material_branch, namespace, class_meta_index, material_ids, process_material)
        except (ValueError, TypeError):
            if strict:
                raise
            updated_material = False
            print("XML229_ENRICHMENT_SKIPPED " + json.dumps({
                "source": "MATERIAL_RATING", "reason": "CONFLICT_OR_INVALID",
            }, sort_keys=True))
        if updated_material:
            branch[:] = list(material_branch)
            changed = True
        # Capture the live branch child only AFTER optional material staging
        # commits. Earlier references may point to detached ET nodes.
        pressure = _ensure_child(branch, namespace, "Pressure")
        hydro = ""
        linelist_rows = _matching_linelist_rows(line_key, support_config)
        if len(linelist_rows) > 1 and not strict:
            # A duplicated or conflicting line key may not choose arbitrary
            # process fields; retain the original XML and continue to CII.
            print("XML229_ENRICHMENT_SKIPPED " + json.dumps({
                "source": "LINE_LIST", "reason": "AMBIGUOUS_SOURCE_ROWS",
            }, sort_keys=True))
            linelist_rows = []
        line_sources: dict[str, str] = {}
        if linelist_rows:
            temperature = _ensure_child(branch, namespace, "Temperature")
            values = {
                "Pressure1": _mapped_process_value(line_key, support_config, "p1", ["P1", "Design Pressure", "Operating Pressure"]),
                "Temperature1": _mapped_process_value(line_key, support_config, "t1", ["T1", "Temp Max", "Temperature Max"]),
                "Temperature2": _mapped_process_value(line_key, support_config, "t2", ["T2", "Temp", "Temperature"]),
                "Temperature3": _mapped_process_value(line_key, support_config, "t3", ["T3", "Temp Min", "Temperature Min"]),
            }
            hydro = _mapped_process_value(line_key, support_config, "hydroPressure", ["HydroPressure", "Hydro Pressure", "Hydro Test Pressure", "Test Pressure"])
            line_sources.update({"p1": values["Pressure1"], "t1": values["Temperature1"],
                                 "t2": values["Temperature2"], "t3": values["Temperature3"],
                                 "hydroPressure": hydro})
            density = (_mapped_process_value(line_key, support_config, "densityMixed", ["Mixed kg/m3", "Mixed kg/m³", "Density Mixed"])
                       or _mapped_process_value(line_key, support_config, "densityGas", ["Gas kg/m3", "Gas kg/m³", "Density Gas"])
                       or _mapped_process_value(line_key, support_config, "densityLiquid", ["Liquid kg/m3", "Liquid kg/m³", "Density Liquid"]))
            if values["Pressure1"]:
                _set_child(pressure, namespace, "Pressure1", values["Pressure1"]); changed = True
            for tag in ("Temperature1", "Temperature2", "Temperature3"):
                if values[tag]:
                    _set_child(temperature, namespace, tag, values[tag]); changed = True
            if density:
                _set_child(branch, namespace, "FluidDensity", density); changed = True
            line_sources["density"] = density
        print("XML229_LINE_SOURCE_TRANSFER " + json.dumps({
            "branch": _child_text(branch, namespace, "Branchname"),
            "lineKey": line_key,
            "matchedSourceRows": len(linelist_rows),
            "sourceFields": line_sources,
            "sourceStatus": ("matched" if linelist_rows else
                             "unmatched" if support_config.get("linelist", {}).get("masterRows") else
                             "no-line-list-supplied"),
        }, sort_keys=True))
        _set_child(pressure, namespace, "HydroPressure", hydro if hydro else _child_text(pressure, namespace, "HydroPressure") or 0)
        changed = True
        branch_name = _child_text(branch, namespace, "Branchname")
        max_insulation = _numeric_text(_child_text(branch, namespace, "InsulationThickness")) or 0.0
        for node in _branch_nodes(branch, namespace):
            max_insulation = max(max_insulation, _numeric_text(_child_text(node, namespace, "InsulationThickness")) or 0.0)
            if _child_text(node, namespace, "ComponentType").upper() in NO_AUTO_WEIGHT_COMPONENT_TYPES and (_numeric_text(_child_text(node, namespace, "Weight")) or 0.0) != 0.0:
                _set_child(node, namespace, "Weight", "0"); changed = True
            claimed_pos = (branch_name, _child_text(node, namespace, "NodeNumber")) in staged_pos_owners
            if claimed_pos:
                changed = _apply_staged_position_restraints(node, namespace, support_config, branch_name) or changed
            else:
                has_explicit_restraints = any(_local_name(child.tag) == "Restraint" for child in list(node))
                if not skip_dtxr_restraint_fallback and not has_explicit_restraints and _apply_dtxr_restraints_to_node(node, namespace, support_config, use_dtxr_only=True):
                    changed = True
        _set_child(branch, namespace, "InsulationDensity", insulation_density_default if max_insulation >= 50.0 else 0)
        changed = True
    if _truthy(support_config.get("splitCondensedValveFlange")) and _renumber_length_bearing_negative_nodes(root, namespace):
        changed = True
    if support_config.get("requireVerifiedMasterCompleteness") is True:
        sys._xml229_native_failure_stage = 'VERIFIED_MASTER_COMPLETENESS'
        if getattr(sys, '_xml229_native_progress_enabled', False):
            print('XML229_NATIVE_STAGE:VERIFIED_MASTER_COMPLETENESS', flush=True)
    _assert_verified_master_completeness(
        root, namespace, support_config, class_wall_index, class_meta_index,
        material_ids, class_corrosion_index)
    if not changed:
        return xml_path
    temp_path = Path(tempfile.gettempdir()) / f"{xml_path.stem}_final_enriched.xml"
    tree.write(temp_path, encoding="unicode", xml_declaration=False)
    return temp_path


def _branch_insulation_density_map(xml_path: Path) -> dict[str, float]:
    root = ET.parse(xml_path).getroot()
    namespace = _namespace(root.tag)
    return {_child_text(branch, namespace, "Branchname"): _to_float(_child_text(branch, namespace, "InsulationDensity"), 0.0) for branch in root.iter() if _local_name(branch.tag) == "Branch"}


def _branch_hydro_pressure_map(xml_path: Path) -> dict[str, float]:
    root = ET.parse(xml_path).getroot()
    namespace = _namespace(root.tag)
    out: dict[str, float] = {}
    for branch in root.iter():
        if _local_name(branch.tag) != "Branch":
            continue
        pressure = branch.find(_q(namespace, "Pressure"))
        out[_child_text(branch, namespace, "Branchname")] = _to_float(_child_text(pressure, namespace, "HydroPressure") if pressure is not None else "", 0.0)
    return out


def _parse_cmpsupgap_value(text: str) -> float | None:
    match = re.search(r"[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?", _safe_text(text))
    if not match:
        return None
    value = float(match.group(0))
    return value if math.isfinite(value) else None


def _parse_cmpsupgap_from_dtxr_entry(entry_text: str) -> float | None:
    """Extract CMPSUPGAP value from an annotated DTXR entry.

    Handles entries of the form:
      'GUIDE PDO-TYPE-603(NAME=/PS-14340.13,CMPSUPGAP=15mm)'
    Returns the numeric mm value, or None if not present.
    """
    match = re.search(r'CMPSUPGAP\s*=\s*([^,)\s]+)', _safe_text(entry_text), re.IGNORECASE)
    if not match:
        return None
    return _parse_cmpsupgap_value(match.group(1))


def _restraint_type_uses_gap(type_text: str) -> bool:
    try:
        return int(round(base._restraint_type_to_code(type_text))) == SUPPORT_KIND_TO_CII_CODE["LINESTOP"]
    except Exception:
        return False


def _line_stop_gap_for_node(node: ET.Element, namespace: str) -> float | None:
    for restraint in node.findall(_q(namespace, "Restraint")):
        if not _restraint_type_uses_gap(_child_text(restraint, namespace, "Type")):
            continue
        for name in ("CMPSUPGAP", "Gap"):
            parsed = _parse_cmpsupgap_value(_child_text(restraint, namespace, name))
            if parsed is not None:
                return parsed
    return None


def _specs_from_dtxr_text(text: str, support_config: dict[str, Any], gap_by_kind: dict[str, float] | None = None) -> tuple[base.RestraintSpec, ...]:
    stiffness = _to_float(support_config.get("defaultStiffness"), base.DEFAULT_LINEAR_STIFFNESS)
    default_gap = _to_float(support_config.get("defaultGap"), 0.0)
    friction = _to_float(support_config.get("defaultFriction"), 0.3)
    specs: list[base.RestraintSpec] = []
    seen: set[int] = set()
    for kind in _kind_from_dtxr(text, support_config):
        code = SUPPORT_KIND_TO_CII_CODE.get(kind)
        if code is None:
            code = base._restraint_type_to_code(SUPPORT_KIND_TO_XML_TYPE.get(kind, kind))
        xml_type = SUPPORT_KIND_TO_XML_TYPE.get(kind, kind)
        spec_friction = -1.0101 if (_truthy(support_config.get("useFrictionSentinelForNonYSupports", True)) and xml_type != "+Y") else friction
        spec_gap = (gap_by_kind or {}).get(kind, default_gap)
        if code not in seen:
            seen.add(code)
            specs.append(base.RestraintSpec(type_code=code, stiffness=stiffness, gap=spec_gap, friction=spec_friction, is_open_end=False))
    return tuple(specs)


def _node_dtxr_texts(xml_path: Path) -> dict[int, str]:
    root = ET.parse(xml_path).getroot()
    namespace = _namespace(root.tag)
    out: dict[int, str] = {}
    for node in root.iter():
        if _local_name(node.tag) != "Node":
            continue
        node_no = base._parse_optional_int(_child_text(node, namespace, "NodeNumber"), "Node/NodeNumber")
        if node_no is None or node_no <= 0:
            continue
        text = " | ".join(filter(None, [_child_text(node, namespace, "DTXR_POS"), _child_text(node, namespace, "DTXR_PS")]))
        if text:
            out[node_no] = text
    return out


def _build_keyword_restraint_specs(xml_path: Path, support_config: dict[str, Any]) -> tuple[dict[int, tuple[base.RestraintSpec, ...]], dict[str, str]]:
    specs_by_node: dict[int, tuple[base.RestraintSpec, ...]] = {}
    support_map: dict[str, str] = {}
    node_gaps: dict[int, float] = {}
    root = ET.parse(xml_path).getroot()
    namespace = _namespace(root.tag)
    for node in root.iter():
        if _local_name(node.tag) != "Node":
            continue
        node_no = base._parse_optional_int(_child_text(node, namespace, "NodeNumber"), "Node/NodeNumber")
        if node_no is None or node_no <= 0:
            continue
        gap = _line_stop_gap_for_node(node, namespace)
        if gap is not None:
            node_gaps[node_no] = gap
    for node_no, text in _node_dtxr_texts(xml_path).items():
        gap_by_kind: dict[str, float] = {}
        if node_no in node_gaps:
            gap_by_kind["LINESTOP"] = node_gaps[node_no]
            gap_by_kind["LIMIT"] = node_gaps[node_no]
        # Extract per-entry CMPSUPGAP from annotated DTXR_POS entries:
        # e.g. "GUIDE PDO-TYPE-603(NAME=/PS-14340.13,CMPSUPGAP=15mm) | Directional Anchor...(NAME=...,CMPSUPGAP=0)"
        for entry in text.split("|"):
            entry_gap = _parse_cmpsupgap_from_dtxr_entry(entry.strip())
            if entry_gap is None:
                continue
            for kind in _kind_from_dtxr(entry.strip(), support_config):
                if kind not in gap_by_kind:  # node-level gap takes precedence
                    gap_by_kind[kind] = entry_gap
        specs = _specs_from_dtxr_text(text, support_config, gap_by_kind if gap_by_kind else None)
        if specs:
            specs_by_node[node_no] = specs
            kinds = _kind_from_dtxr(text, support_config)
            if kinds:
                support_map[str(node_no)] = "+".join(kinds)
    return specs_by_node, support_map


def _merge_specs(left: tuple[base.RestraintSpec, ...], right: tuple[base.RestraintSpec, ...]) -> tuple[base.RestraintSpec, ...]:
    out: list[base.RestraintSpec] = []
    seen: set[int] = set()
    for spec in list(left) + list(right):
        code = int(round(spec.type_code))
        if code not in seen:
            seen.add(code)
            out.append(spec)
        if len(out) >= base.RESTRAINT_SLOTS_PER_AUX:
            break
    return tuple(out)


def _prefer_xml_specs(
    xml_specs: dict[int, tuple[base.RestraintSpec, ...]],
    *fallback_maps: dict[int, tuple[base.RestraintSpec, ...]],
) -> dict[int, tuple[base.RestraintSpec, ...]]:
    out = dict(xml_specs)
    for spec_map in fallback_maps:
        for node_number, specs in spec_map.items():
            if node_number not in out or not out[node_number]:
                out[node_number] = specs
    return out


def _node_name_kind_map(document: base.XmlDocument, node_number_kind_map: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for branch in document.branches:
        for node in branch.nodes:
            kind = node_number_kind_map.get(str(node.node_number))
            if kind and _safe_text(node.node_name):
                out[_safe_text(node.node_name)] = kind
    return out


def _branch_case_maps(document: base.XmlDocument) -> tuple[dict[str, tuple[float, ...]], dict[str, tuple[float, ...]]]:
    return ({b.branch_name: tuple(b.temperatures) for b in document.branches}, {b.branch_name: tuple(b.pressures) for b in document.branches})


def _case_values(values: tuple[float, ...], size: int) -> list[float]:
    out = list(values[:size])
    while len(out) < size:
        out.append(0.0)
    return [0.0 if abs(v - SENTINEL_TEMPERATURE) < 1e-9 else v for v in out]


def _direction_for_spec(spec: base.RestraintSpec) -> tuple[float, float, float]:
    if getattr(spec, 'direction_cosines', None) is not None:
        return spec.direction_cosines
    return base._direction_cosines_for_restraint_type(spec.type_code, spec.is_open_end)


def _patched_build_restraint_payload_factory(support_config: dict[str, Any]):
    def _patched_build_restraint_payload(model: base.ConversionModel, cfg: dict[str, Any] | None = None) -> list[str]:
        actual_config = support_config if cfg is None else cfg
        lines: list[str] = []
        for assigned in model.restraints:
            for slot_index in range(base.RESTRAINT_SLOTS_PER_AUX):
                if slot_index < len(assigned.specs):
                    spec = assigned.specs[slot_index]
                    secondary_flag = base._format_fixed_float(0.0, 6) if spec.is_open_end else base._format_fixed_float(1.0, 5)
                    cx, cy, cz = _direction_for_spec(spec)
                    fric_val = _cii_friction_value(spec.friction, actual_config)
                    line1 = base._row([
                        base._format_auto_float(float(assigned.node_number)),
                        base._format_auto_float(float(spec.type_code)),
                        base._format_auto_float(spec.stiffness),
                        base._format_fixed_float(spec.gap, 6),
                        base._format_fixed_float(fric_val, 6),
                        base._format_fixed_float(0.0, 6),
                    ])
                    raw_tag = assigned.kind if slot_index == 0 else ""
                else:
                    secondary_flag = base._format_fixed_float(0.0, 6)
                    cx, cy, cz = 0.0, 0.0, 0.0
                    line1 = base._row([
                        base._format_fixed_float(0.0, 6),
                        base._format_fixed_float(0.0, 6),
                        base._format_auto_float(base.DEFAULT_LINEAR_STIFFNESS),
                        base._format_fixed_float(0.0, 6),
                        base._format_fixed_float(0.0, 6),
                        base._format_fixed_float(0.0, 6),
                    ])
                    raw_tag = ""
                cz_decimals = 6 if abs(cz) < 1e-9 else 5
                line2 = base._row([
                    base._format_fixed_float(cx, 6),
                    base._format_fixed_float(cy, 6),
                    base._format_fixed_float(cz, cz_decimals),
                ])
                support_tag = base._support_tag_for_cii_aux(raw_tag, actual_config)
                support_guid = base._support_guid_for_cii_aux(getattr(assigned, "support_guid", ""), actual_config)
                tag_line = base._cii_aux_string_record(support_tag)
                guid_line = base._cii_aux_string_record(support_guid)
                lines.extend([line1, line2, tag_line, guid_line])
        return lines
    return _patched_build_restraint_payload


def _patched_elements_payload_factory(temperature_map: dict[str, tuple[float, ...]], pressure_map: dict[str, tuple[float, ...]], insulation_density_map: dict[str, float], hydro_pressure_map: dict[str, float] | None = None, support_config: dict[str, Any] | None = None):
    if support_config is None:
        support_config = {}
    def _build_elements_payload(model: base.ConversionModel) -> list[str]:
        lines: list[str] = []
        zero6 = base._row([base._format_fixed_float(0.0, 6)] * 6)
        for edge_index, edge in enumerate(model.edges):
            mapped_from = base._map_position_to_cii(edge.from_node.position)
            mapped_to = base._map_position_to_cii(edge.to_node.position)
            dx, dy, dz = (mapped_to[i] - mapped_from[i] for i in range(3))
            temps = _case_values(temperature_map.get(edge.branch_name, (edge.branch_temperature,)), 9)
            pressures = _case_values(pressure_map.get(edge.branch_name, (edge.branch_pressure,)), 9)
            insulation_density = _density_for_output(insulation_density_map.get(edge.branch_name, 0.0), support_config)
            fluid_density = _density_for_output(edge.branch_fluid_density, support_config)
            hydro_pressure = (hydro_pressure_map or {}).get(edge.branch_name, 0.0)
            lines.extend([
                base._row([base._format_auto_float(float(edge.from_node.node_number)), base._format_auto_float(float(edge.to_node.node_number)), base._format_auto_float(dx), base._format_auto_float(dy), base._format_auto_float(dz), base._format_auto_float(base._element_outside_diameter(edge))]),
                base._row(["1.000000E-02" if edge.from_node.wall_thickness <= 0.0 else base._format_auto_float(edge.from_node.wall_thickness), base._format_auto_float(edge.to_node.insulation_thickness), base._format_auto_float(edge.to_node.corrosion_allowance), base._format_auto_float(temps[0]), base._format_auto_float(temps[1]), base._format_auto_float(temps[2])]),
                base._row([base._format_auto_float(v) for v in temps[3:9]]),
                base._row([base._format_auto_float(v) for v in pressures[0:6]]),
                base._row([base._format_auto_float(pressures[6]), base._format_auto_float(pressures[7]), base._format_auto_float(pressures[8]), base._format_fixed_float(0.0, 6), base._format_fixed_float(0.0, 6), base._format_fixed_float(0.0, 6)]),
                base._row([base._format_auto_float(insulation_density), base._format_auto_float(fluid_density), base._format_fixed_float(0.0, 6), base._format_fixed_float(0.0, 6), base._format_fixed_float(0.0, 6), base._format_auto_float(hydro_pressure)]),
                zero6, zero6,
                base._row([base._format_fixed_float(0.0, 6)] * 5),
                base.ELEMENT_BLOCK_LONG_ZERO_LINE,
                base._element_line_number_field(edge.branch_name),
                base.ELEMENT_BLOCK_NODE_REF_LINE,
                base._row([str(model.edge_to_bend_index.get(edge_index, 0)), str(model.edge_to_rigid_index.get(edge_index, 0)), "0", str(model.edge_to_restraint_index.get(edge_index, 0)), "0", "0"]),
                base._row(["0", "0", "0", "0", str(model.edge_to_sif_index.get(edge_index, 0)), str(model.edge_to_nodename_index.get(edge_index, 0))]),
                base._row([str(model.edge_to_reducer_index.get(edge_index, 0)), "0", "0"]),
            ])
        return lines
    return _build_elements_payload


def _maybe_enrich_from_staged_json(input_xml: Path, staged_json: Path | None,
                                  support_config: dict[str, Any],
                                  *, original_authored_restraints=None) -> Path:
    if staged_json is None:
        return input_xml
    # Track what was annotated BEFORE staged-source replay. Only these
    # unmarked restraints are eligible as stale derived DTXR output.
    original_root = ET.parse(input_xml).getroot()
    stamped = []
    for old_branch in original_root.iter():
        if _local_name(old_branch.tag) != "Branch":
            continue
        old_name = next(((c.text or "").strip() for c in old_branch
                         if _local_name(c.tag) == "Branchname"), "")
        for old_node in _branch_nodes(old_branch, _namespace(original_root.tag)):
            if any(_local_name(c.tag) in ("DTXR_POS", "DTXR_PS") and
                   _safe_text(c.text) for c in old_node):
                stamped.append((old_name, _child_text(old_node,
                                _namespace(original_root.tag), "NodeNumber")))
    support_config["_originalDtxrStampedOwners"] = stamped
    # Existing annotations are per-node evidence, not a whole-document
    # enrichment-complete bit. Reconcile supplied staged members even when
    # another node was already annotated; keep unmatched XML values intact.
    if addon is None:
        raise ValueError("--staged-json requires xml_to_cii2019_master_addon.py to be available.")
    result = addon.enrich_xml_addons(input_xml, linelist=None, overrides=None, staged_json=staged_json.read_text(encoding="utf-8-sig"), dtxr_position_offset=support_config.get("dtxrPositionOffset") if isinstance(support_config, dict) else None,
                                       original_authored_restraints=original_authored_restraints,
                                       authored_restraint_config=support_config)
    stats = result.get("stats") or {}
    mandatory_ambiguous = stats.get("dtxrPosMandatoryAmbiguous", stats.get("dtxrPosAmbiguous", 0))
    if mandatory_ambiguous:
        # Staged source cannot assign an ambiguous in-scope support owner.
        # Unmatched non-restraint and out-of-scope members are audited
        # exclusions, never a basis for CII engineering annotation or release.
        conflicts = [d for d in result.get("diagnostics", [])
                     if d.get("type") == "dtxr-position-ambiguous"
                     and d.get("scope", "MANDATORY") == "MANDATORY"][:10]
        # Native-version proof and the applied search tolerance must travel in
        # this allowlisted diagnostic receipt. A cached older browser Worker
        # will omit the version, so a repeated nine-pair signature is no longer
        # mistaken for proof that a newly merged matcher was executed.
        position_option = (support_config.get("dtxrPositionOffset")
                           if isinstance(support_config, dict) else None)
        applied_tolerance = addon._dtxr_position_offset(position_option)["tolerance"]
        print("XML229_STAGED_POSITION_AMBIGUITY " + json.dumps({
            "matcherRevision": "XML229_POSITION_CARRIER_PROVENANCE_V6",
            "matchToleranceMm": (round(applied_tolerance, 6)
                                 if math.isfinite(applied_tolerance) else None),
            "count": mandatory_ambiguous, "sample": conflicts,
            "sampleTruncated": mandatory_ambiguous > len(conflicts),
        }, sort_keys=True))
        raise ValueError("XML229_STAGED_POSITION_AMBIGUOUS")
    if stats.get("dtxrPosMandatoryUnmatched", 0):
        rejected = [d for d in result.get("diagnostics", [])
                    if d.get("type") == "dtxr-position-unmatched"
                    and d.get("scope") == "MANDATORY"]
        print("XML229_STAGED_MANDATORY_UNMATCHED " + json.dumps(rejected, sort_keys=True))
        raise ValueError("XML229_STAGED_POSITION_PARTIAL_TRANSFER")
    source_json = staged_json.read_text(encoding="utf-8-sig")
    has_claims = bool(addon.build_dtxr_ps_index(source_json)) or bool(
        addon.build_dtxr_pos_entries(source_json, support_config.get("dtxrPositionOffset")))
    if has_claims and not stats.get("dtxrPos", 0) and not stats.get("dtxrPs", 0):
        raise ValueError("XML229_STAGED_TRANSFER_NO_MATCH")
    # A stale REST annotation must never be interpreted as proof the provided
    # staged JSON was consumed; the receipt makes this a distinct run event.
    excluded = [d for d in result.get("diagnostics", [])
                if d.get("type") == "dtxr-position-unmatched"
                and d.get("scope") == "NOT_APPLICABLE"]
    if excluded:
        print("XML229_STAGED_SCOPE_EXCLUSIONS " + json.dumps({
            "count": len(excluded),
            "reasons": {reason: sum(d.get("reason") == reason for d in excluded)
                        for reason in sorted({d.get("reason", "") for d in excluded})},
            "sample": excluded[:20], "sampleTruncated": len(excluded) > 20
        }, sort_keys=True))
    print("XML229_SOURCE_TRANSFER " + json.dumps({
        "family": "stagedJson",
        "inputHadDtxr": _xml_has_dtxr_annotations(input_xml),
        "dtxrPosOwners": stats.get("dtxrPos", 0),
        "dtxrPsOwners": stats.get("dtxrPs", 0),
        "ambiguous": stats.get("dtxrPosAmbiguous", 0),
        "mandatoryPositionClaimsAmbiguous": stats.get("dtxrPosMandatoryAmbiguous", 0),
        "excludedPositionClaimsAmbiguous": stats.get("dtxrPosExcludedAmbiguous", 0),
        "unmatchedPositionClaims": stats.get("dtxrPosUnmatched", 0),
        "mandatoryPositionClaimsUnmatched": stats.get("dtxrPosMandatoryUnmatched", 0),
        "positionClaimsExcluded": stats.get("dtxrPosExcluded", 0),
    }, sort_keys=True))
    pos_owners = []
    source_members = {}
    for diagnostic in result.get("diagnostics", ()):
        if diagnostic.get("type") == "dtxr-pos":
            owner = (diagnostic["branchName"], str(diagnostic["nodeNumber"]))
            pos_owners.append(owner)
            source_members[owner] = diagnostic.get("members", [])
            print("XML229_DTXR_SOURCE_TO_NODE " + json.dumps(diagnostic, sort_keys=True))
    support_config["_stagedPositionOwners"] = pos_owners
    support_config["_stagedPositionMemberRows"] = source_members
    with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", prefix=f"{input_xml.stem}_dtxr_",
            suffix=".xml", delete=False) as target:
        target.write(result["xmlText"])
        temp_path = Path(target.name)
    support_config["_generatedDtxrEnrichment"] = True
    return temp_path


def _xml_has_dtxr_annotations(xml_path: Path) -> bool:
    root = ET.parse(xml_path).getroot()
    namespace = _namespace(root.tag)
    for node in root.iter():
        if _local_name(node.tag) != "Node":
            continue
        if _child_text(node, namespace, "DTXR_POS") or _child_text(node, namespace, "DTXR_PS"):
            return True
    return False


def _xml_restraints_are_authoritative(xml_path: Path, support_config: dict[str, Any]) -> bool:
    return bool(support_config.get("_inputAlreadyEnriched")) or (
        _xml_has_dtxr_annotations(xml_path) and not bool(support_config.get("_generatedDtxrEnrichment"))
    )


def _build_conversion_model(
    document: base.XmlDocument,
    explicit_specs: dict[int, tuple[base.RestraintSpec, ...]],
    support_map: dict[str, str] | None,
    support_config: dict[str, Any] | None = None,
) -> base.ConversionModel:
    edges = base._build_edges(document.branches)
    degrees = base._build_degree_map(edges)
    nodename_lines, edge_to_nodename_index = base._build_nodename_lines(edges, support_config)
    bend_edges, edge_to_bend_index = base._build_bend_indices(edges)
    rigid_edges, edge_to_rigid_index = base._build_rigid_indices(edges)
    sif_edges, edge_to_sif_index = base._build_sif_indices(edges)
    reducer_edges, edge_to_reducer_index = base._build_reducer_indices(edges)
    restraints, edge_to_restraint_index = base._build_restraints(document.metadata, edges, degrees, explicit_specs, support_map)
    return base.ConversionModel(document.metadata, edges, degrees, nodename_lines, edge_to_nodename_index, bend_edges, edge_to_bend_index, rigid_edges, edge_to_rigid_index, sif_edges, edge_to_sif_index, reducer_edges, edge_to_reducer_index, restraints, edge_to_restraint_index)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Patched PSI116 XML to CII(2019) converter.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--template-cii", required=False, type=Path, default=None)
    parser.add_argument("--coords-mode", required=False, default="first", choices=["first", "all", "none"])
    parser.add_argument("--weight-scale", required=False, type=float, default=1.0)
    parser.add_argument("--support-config-json", required=False, default="")
    parser.add_argument("--staged-json", required=False, type=Path, default=None)
    # Accepted GC-PW Final masses: exact-original owner transfer and actual
    # emitted CII postcheck. Never inferred from a suggestion or cache.
    parser.add_argument("--xml229-native-final-packet", required=False, type=Path, default=None)
    parser.add_argument("--xml229-native-mass-proof", required=False, type=Path, default=None)
    parser.add_argument("--enriched-output", required=False, type=Path, default=None)
    parser.add_argument("--diagnostics-out", required=False, type=Path, default=None)
    parser.add_argument("--use-restraint-type-based-on-json", dest="use_restraint_type_based_on_json", action="store_true", default=True)
    parser.add_argument("--no-use-restraint-type-based-on-json", dest="use_restraint_type_based_on_json", action="store_false")
    parser.add_argument("--split-condensed-valve-flange", dest="split_condensed_valve_flange", action="store_true", default=None)
    parser.add_argument("--no-split-condensed-valve-flange", dest="split_condensed_valve_flange", action="store_false")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    support_config = _load_support_config(args.support_config_json)
    if args.split_condensed_valve_flange is not None:
        support_config["splitCondensedValveFlange"] = bool(args.split_condensed_valve_flange)
    input_xml = _maybe_enrich_from_staged_json(args.input, args.staged_json, support_config)
    input_xml = _apply_process_data_to_xml(input_xml, support_config)
    insulation_density_map = _branch_insulation_density_map(input_xml)
    hydro_pressure_map = _branch_hydro_pressure_map(input_xml)
    document = base._parse_xml_document(input_xml)
    dtxr_specs, node_number_kind_map = _build_keyword_restraint_specs(input_xml, support_config)
    xml_specs = base._build_explicit_restraint_specs(document.branches)
    explicit_specs = dict(xml_specs) if _xml_restraints_are_authoritative(input_xml, support_config) else _prefer_xml_specs(xml_specs, dtxr_specs)
    model = _build_conversion_model(document, explicit_specs, _node_name_kind_map(document, node_number_kind_map), support_config)
    temperature_map, pressure_map = _branch_case_maps(document)
    base._build_restraint_payload = _patched_build_restraint_payload_factory(support_config)
    base._build_elements_payload = _patched_elements_payload_factory(temperature_map, pressure_map, insulation_density_map, hydro_pressure_map, support_config)  # type: ignore[assignment]
    cii_text = base._build_cii_text(model, args.coords_mode, base._resolve_template_version_line(args.template_cii), args.weight_scale)
    args.output.write_text(cii_text, encoding="utf-8")
    if args.diagnostics_out:
        args.diagnostics_out.write_text(base._build_diagnostics_report(model), encoding="utf-8")
    print(f"Wrote {args.output} with {len(model.edges)} elements and {len(model.restraints)} restraints. use_restraint_type_based_on_json={args.use_restraint_type_based_on_json}; split_condensed_valve_flange={support_config.get('splitCondensedValveFlange')}")


if __name__ == "__main__":
    main()
