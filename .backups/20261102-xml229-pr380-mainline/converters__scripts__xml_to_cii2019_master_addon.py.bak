#!/usr/bin/env python3
"""Master-enrichment ADDON for the XML -> CII (2019) pipeline.

This is a standalone *addon*: it does NOT modify or import xml_to_cii2019.py.
Given the same PipeStressExport XML plus master tables, it resolves per-line
customization (piping class, rating, wall thickness, corrosion, material name +
code) using the portable `master_customization` primitives, and emits:
  * an enrichment JSON keyed by Line No. Key (and per branch), and
  * a human-readable diagnostics table (with confidence + needs_review so the
    host can raise an "approximate match" prompt).

Portable by design (copy alongside xml_to_cii2019.py into the standalone app):
no DOM/localStorage; masters/overrides/config are plain files passed on the CLI;
the only local dependency is master_customization.py.

Masters (all optional):
  --piping-class-master  JSON array; rows hold Piping Class, convertedBore (mm)
                         or Size (NPS), Wall thickness, Corrosion, Material_Name,
                         Rating  (e.g. docs/Masters/Piping_class_master.json)
  --material-map         JSON [{code, material}] OR a 2-column text file
                         "<code> <name>" (e.g. docs/Masters/PCF_MAT_MAP.TXT)
  --linelist             JSON array; rows hold a line key (ColumnX1/lineNo) and
                         optionally pipingClass / rating
  --overrides            JSON { "pipingClass": {key: val}, "material": {name: code} }
  --config               JSON of fuzzy thresholds (see master_customization)
  --staged-json          JSON staged hierarchy; used to annotate XML nodes with
                         DTXR_PS for every staged component matching the node PS tag
"""
from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import master_customization as MC

# --- bore tables (NPS inch -> DN mm, and OD mm -> DN mm) --------------------
NPS_TO_DN = {
    0.125: 6, 0.25: 8, 0.375: 10, 0.5: 15, 0.75: 20, 1: 25, 1.25: 32, 1.5: 40,
    2: 50, 2.5: 65, 3: 80, 3.5: 90, 4: 100, 5: 125, 6: 150, 8: 200, 10: 250,
    12: 300, 14: 350, 16: 400, 18: 450, 20: 500, 24: 600, 30: 750, 36: 900,
}
OD_TO_DN = [
    (21.3, 15), (26.7, 20), (33.4, 25), (42.2, 32), (48.3, 40), (60.3, 50),
    (73.0, 65), (88.9, 80), (114.3, 100), (141.3, 125), (168.3, 150),
    (219.1, 200), (273.1, 250), (323.9, 300), (355.6, 350), (406.4, 400),
    (508.0, 500), (609.6, 600), (762.0, 750), (914.4, 900),
]
DEFAULT_DTXR_POSITION_OFFSET = {
    "enabled": True,
    "xOffset": 150500.0,
    "yOffset": 43000.0,
    "zOffset": 100000.0,
    "tolerance": 0.5,
}


def nps_to_dn(nps):
    try:
        n = float(nps)
    except (TypeError, ValueError):
        return None
    for k, v in NPS_TO_DN.items():
        if abs(n - k) <= 0.01:
            return v
    return None


def od_to_dn(od):
    try:
        n = float(od)
    except (TypeError, ValueError):
        return None
    best, bestd = None, 1e9
    for o, dn in OD_TO_DN:
        d = abs(o - n)
        if d < bestd:
            best, bestd = dn, d
    return best if bestd <= 6.0 else None


# --- branch-name parsing (portable; mirrors the JS scan logic) --------------
def extract_line_key(branch_name: str) -> str:
    main = re.sub(r"^/+", "", branch_name or "").split("/")[0]
    parts = [p.strip() for p in main.split("-") if p.strip()]
    for p in parts:                                   # position-independent scan
        if re.fullmatch(r"[A-Za-z][A-Za-z0-9]*\d{4,}", p):
            return p
    for i in range(len(parts) - 1):                   # split variant: S-8810101
        if re.fullmatch(r"[A-Za-z]{1,3}", parts[i]) and re.fullmatch(r"\d+", parts[i + 1]):
            tok = parts[i] + parts[i + 1]
            if re.fullmatch(r"[A-Za-z]\d{4,}", tok):
                return tok
    return ""


def extract_nps(branch_name: str):
    m = re.search(r'(\d+(?:\.\d+)?)\s*"', branch_name or "")
    return float(m.group(1)) if m else None


def class_tokens(branch_name: str):
    main = re.sub(r"^/+", "", branch_name or "").split("/")[0]
    return [p.strip() for p in main.split("-") if p.strip()]


# --- master loaders ---------------------------------------------------------
def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig")) if path else None


def load_material_map(path):
    if not path:
        return []
    p = Path(path)
    text = p.read_text(encoding="utf-8-sig")
    if p.suffix.lower() == ".json":
        data = json.loads(text)
        return [{"code": str(r.get("code")), "material": r.get("material") or r.get("desc") or r.get("name")}
                for r in data if isinstance(r, dict)]
    rows = []
    for line in text.splitlines():
        m = re.match(r"\s*(\S+)\s+(.+?)\s*$", line)
        if m and re.fullmatch(r"\d+", m.group(1)):     # skip header lines like "2019"
            rows.append({"code": m.group(1), "material": m.group(2)})
    return rows


def mrow(row, *keys):
    if not isinstance(row, dict):
        return None
    for k in keys:
        if k in row and str(row[k]).strip() != "":
            return row[k]
    return None


def _first_text(*values: object) -> str | None:
    for value in values:
        text = str(value).strip() if value is not None else ""
        if text:
            return text
    return None


def _get_child(parent: ET.Element, name: str) -> ET.Element | None:
    for child in list(parent):
        if _local(child.tag) == name:
            return child
    return None


def _ensure_child(parent: ET.Element, name: str) -> ET.Element:
    child = _get_child(parent, name)
    if child is not None:
        return child
    namespace = parent.tag.split("}", 1)[0][1:] if parent.tag.startswith("{") else ""
    child = ET.Element(f"{{{namespace}}}{name}" if namespace else name)
    parent.append(child)
    return child


def _set_child_text(parent: ET.Element, name: str, value: object) -> None:
    child = _ensure_child(parent, name)
    child.text = str(value)


def _line_process_value(line_key: str, row: dict[str, Any] | None, overrides: dict[str, Any] | None, field: str, keys: list[str]) -> str | None:
    process_overrides = overrides.get("processData", {}) if isinstance(overrides, dict) else {}
    line_overrides = process_overrides.get(line_key, {}) if isinstance(process_overrides, dict) else {}
    override_value = mrow(line_overrides, field)
    return _first_text(override_value, mrow(row or {}, *keys))


def _normalize_ps_tag(value: object) -> str:
    text = str(value).strip().upper().lstrip("/") if value is not None else ""
    match = re.search(r"PS-?(\d+)(?:\.\d+)?", text)
    if not match:
        return ""
    # PSI XML PS00574.1 and JSON /PS-00574.1 share the historic PS-<digits> key.
    return "PS-" + match.group(1)


def _ps_tags_from_text(value: object) -> set[str]:
    text = str(value) if value is not None else ""
    tags = set()
    for match in re.finditer(r"/?PS-?\d+(?:\.\d+)?", text, flags=re.I):
        tag = _normalize_ps_tag(match.group(0))
        if tag:
            tags.add(tag)
    return tags


def _ps_tags_from_attrs(attrs: dict[str, Any], component_name: object) -> set[str]:
    tags = set(_ps_tags_from_text(component_name))
    for key, value in attrs.items():
        if isinstance(value, (dict, list)):
            continue
        tags.update(_ps_tags_from_text(f"{key} {value}"))
    return tags


def _iter_staged_components(value: Any, branch_name: str = ""):
    if isinstance(value, list):
        for item in value:
            yield from _iter_staged_components(item, branch_name)
        return
    if not isinstance(value, dict):
        return
    attrs = value.get("attributes")
    safe_attrs = attrs if isinstance(attrs, dict) else {}
    component_type = str(value.get("type") or safe_attrs.get("TYPE") or "").upper()
    current_branch = str(value.get("name") or safe_attrs.get("NAME") or branch_name) if component_type == "BRANCH" or isinstance(value.get("children"), list) else branch_name
    yield {"component": value, "attrs": safe_attrs, "branchName": current_branch}
    children = value.get("children")
    if isinstance(children, list):
        for child in children:
            yield from _iter_staged_components(child, current_branch)


def _staged_dtxr(entry: dict[str, Any]) -> str:
    attrs = entry.get("attrs") if isinstance(entry, dict) else {}
    component = entry.get("component") if isinstance(entry, dict) else {}
    if not isinstance(attrs, dict):
        attrs = {}
    if not isinstance(component, dict):
        component = {}
    return str(attrs.get("DTXR_POS") or attrs.get("DTXR") or attrs.get("DESC") or attrs.get("DESCRIPTION") or attrs.get("NAME") or component.get("name") or "").strip()


def _staged_position(attrs: dict[str, Any]) -> dict[str, float] | None:
    for key in ("POSI", "POSITION", "POS", "BPOS", "APOS", "LPOS", "CPOS", "HPOS", "TPOS"):
        point = _parse_position_text(attrs.get(key))
        if point is not None:
            return point
    return None


def _staged_gap_annotation(dtxr: str, attrs: dict[str, Any]) -> str:
    """Keep independent CMPSUPGAP on its own DTXR source member, not another support."""
    raw = next((str(value).strip() for key, value in attrs.items()
                if key.upper() == "CMPSUPGAP" and str(value).strip()), "")
    if not raw or re.search(r"CMPSUPGAP\s*=", dtxr, re.I):
        return dtxr
    if not re.fullmatch(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?\s*(?:mm)?", raw, re.I):
        return dtxr
    if dtxr.endswith(")") and "(" in dtxr:
        return dtxr[:-1] + ",CMPSUPGAP=" + raw + ")"
    return dtxr + "(CMPSUPGAP=" + raw + ")"


def build_dtxr_ps_index(staged_json: Any, *, unpositioned_only: bool = False) -> dict[str, list[str]]:
    """Return PS base tag -> ordered unique DTXR values from staged JSON."""
    try:
        parsed = json.loads(staged_json) if isinstance(staged_json, str) else staged_json
    except json.JSONDecodeError:
        return {}
    index: dict[str, list[str]] = {}
    for entry in _iter_staged_components(parsed):
        attrs = entry.get("attrs") if isinstance(entry, dict) else {}
        if unpositioned_only and _staged_position(attrs) is not None:
            continue
        dtxr = _staged_gap_annotation(_staged_dtxr(entry), attrs)
        if not dtxr:
            continue
        component = entry.get("component") if isinstance(entry, dict) else {}
        if not isinstance(attrs, dict):
            attrs = {}
        if not isinstance(component, dict):
            component = {}
        for tag in _ps_tags_from_attrs(attrs, component.get("name", "")):
            bucket = index.setdefault(tag, [])
            if dtxr not in bucket:
                bucket.append(dtxr)
    return index


def _node_ps_tags(node: ET.Element) -> list[str]:
    values = []
    for child in list(node):
        if _local(child.tag) in {"NodeName", "ComponentRefNo", "SupportTag"}:
            values.append(child.text or "")
    tags: list[str] = []
    for value in values:
        for tag in _ps_tags_from_text(value):
            if tag not in tags:
                tags.append(tag)
    return tags


def _register_default_namespace(root: ET.Element) -> None:
    if root.tag.startswith("{"):
        ET.register_namespace("", root.tag.split("}", 1)[0][1:])


def _float_or(value: object, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _dtxr_position_offset(option: dict[str, Any] | None) -> dict[str, Any]:
    source = option if isinstance(option, dict) else {}
    return {
        "enabled": source.get("enabled", DEFAULT_DTXR_POSITION_OFFSET["enabled"]) is True,
        "xOffset": _float_or(source.get("xOffset"), DEFAULT_DTXR_POSITION_OFFSET["xOffset"]),
        "yOffset": _float_or(source.get("yOffset"), DEFAULT_DTXR_POSITION_OFFSET["yOffset"]),
        "zOffset": _float_or(source.get("zOffset"), DEFAULT_DTXR_POSITION_OFFSET["zOffset"]),
        "tolerance": max(_float_or(source.get("tolerance"), DEFAULT_DTXR_POSITION_OFFSET["tolerance"]), 0.0),
    }


def _parse_position_text(value: object) -> dict[str, float] | None:
    text = str(value).strip() if value is not None else ""
    if not text:
        return None
    directional = {"x": 0.0, "y": 0.0, "z": 0.0}
    found_directional = False
    for direction, number_text in re.findall(r"([EWSNUD])\s*(-?\d+(?:\.\d+)?)\s*mm?", text, flags=re.I):
        numeric = float(number_text)
        axis = direction.upper()
        if axis == "E":
            directional["x"] = numeric
        elif axis == "W":
            directional["x"] = -numeric
        elif axis == "N":
            directional["y"] = numeric
        elif axis == "S":
            directional["y"] = -numeric
        elif axis == "U":
            directional["z"] = numeric
        elif axis == "D":
            directional["z"] = -numeric
        found_directional = True
    if found_directional:
        return directional
    values = [float(match) for match in re.findall(r"-?\d+(?:\.\d+)?", text)]
    if len(values) < 3:
        return None
    return {"x": values[0], "y": values[1], "z": values[2]}


def _apply_dtxr_position_offset(point: dict[str, float] | None, option: dict[str, Any] | None) -> dict[str, float] | None:
    if point is None:
        return None
    offset = _dtxr_position_offset(option)
    if not offset["enabled"]:
        return point
    return {
        "x": point["x"] + offset["xOffset"],
        "y": point["y"] + offset["yOffset"],
        "z": point["z"] + offset["zOffset"],
    }


def _positions_match(left: dict[str, float] | None, right: dict[str, float] | None, tolerance: float) -> bool:
    if left is None or right is None:
        return False
    return (
        abs(left["x"] - right["x"]) <= tolerance
        and abs(left["y"] - right["y"]) <= tolerance
        and abs(left["z"] - right["z"]) <= tolerance
    )


def build_dtxr_pos_entries(staged_json: Any, offset_option: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Return staged DTXR entries whose POSI was converted into XML coordinates."""
    try:
        parsed = json.loads(staged_json) if isinstance(staged_json, str) else staged_json
    except json.JSONDecodeError:
        return []
    entries: list[dict[str, Any]] = []
    for entry in _iter_staged_components(parsed):
        attrs = entry.get("attrs") if isinstance(entry, dict) else {}
        if not isinstance(attrs, dict):
            continue
        dtxr = _staged_dtxr(entry)
        raw_point = None
        for key in ("POSI", "POSITION", "POS", "BPOS", "APOS", "LPOS", "CPOS", "HPOS", "TPOS"):
            raw_point = _parse_position_text(attrs.get(key))
            if raw_point is not None:
                break
        point = _apply_dtxr_position_offset(raw_point, offset_option)
        if not dtxr or point is None:
            continue
        component = entry.get("component") or {}
        tags = _ps_tags_from_attrs(attrs, component.get("name", ""))
        branch_name = str(entry.get("branchName") or attrs.get("OWNER") or "")
        fields = ("DTXR", "NAME", "MDSSUPPTYPE", "SPRE", "CMPSUPTYPE",
                  "NODETYPE", "CMPSUPGAP", "CMPSUPGAP_POS", "CMPSUPGAP_PS",
                  "NODEGAP", "DESCRIPTION", "DESC", "OWNER", "SUPPORT_KIND",
                  "SUPPORT_TYPE", "SUPPORT_MAPPER_KIND")
        source_fields = {key: attrs[key] for key in fields
                         if key in attrs and attrs[key] is not None}
        entries.append({"dtxr": _staged_gap_annotation(dtxr, attrs),
                        "point": point, "rawPoint": raw_point,
                        "sourceAttrs": source_fields,
                        "sourceType": str(component.get("type") or attrs.get("TYPE") or ""),
                        "tags": tags, "branchName": branch_name})
    return entries


# --- shared resolvers (used by branch- and element-level enrichment) --------
def _resolve_line(bname, bore, ctx):
    """Full per-(branch|element) resolution at a given bore. Returns a flat dict."""
    line_key = extract_line_key(bname)
    ll_row = ctx["ll_index"].get(MC.normalize(line_key)) if line_key else None

    # Call unified resolve_branch_process_data
    resolved = MC.resolve_branch_process_data(
        branch_name=bname,
        line_key=line_key,
        line_row=ll_row,
        bore_mm=bore,
        component_type="PIPE",
        rating=None,  # let it read from line_row/class match rating inside
        material_map=ctx["material_map"],
        piping_class_rows=ctx["pclass_master"],
        overrides=ctx["overrides"],
        xml_node=None,
        xml_branch=None,
        config=ctx["cfg"]
    )

    mat_method = resolved["materialSource"]
    if mat_method == "line-list-material-map" or mat_method == "piping-class-material-map":
        mat_method = "exact"

    needs_review = resolved["pipingClassNeedsReview"] or (not resolved["materialCode"] and bool(resolved["material"]))

    return {
        "branch": bname, "lineNoKey": line_key, "bore_mm": bore,
        "pipingClass": resolved["pipingClass"],
        "class_method": resolved["pipingClassMatchMethod"],
        "class_confidence": round(resolved["pipingClassConfidence"], 3),
        "rating": resolved["pipingClassMatchedRow"].get("rating") if (resolved["pipingClassMatchedRow"] and resolved["pipingClassMatchedRow"].get("rating")) else (mrow(ll_row, "rating", "Rating")),
        "wallThickness": resolved["wallThicknessMm"] if resolved["wallThicknessMm"] else None,
        "corrosion": resolved["corrosionAllowanceMm"] if resolved["corrosionAllowanceMm"] is not None else None,
        "materialName": resolved["material"],
        "materialCode": resolved["materialCode"] if resolved["materialCode"] else None,
        "material_method": mat_method,
        "material_confidence": 1.0 if resolved["materialCode"] else 0.0,
        "needs_review": needs_review,
    }


def _make_ctx(pclass_master, material_map, linelist, overrides, cfg):
    return {
        "pclass_master": pclass_master,
        "material_map": material_map,
        "ll_index": build_linelist_index(linelist),
        "known_classes": sorted({str(mrow(r, "Piping Class", "pipingClass") or "").strip()
                                 for r in (pclass_master or [])} - {""}),
        "overrides": overrides,
        "cfg": cfg,
    }


# --- core enrichment --------------------------------------------------------
def build_linelist_index(linelist):
    idx = {}
    for r in (linelist or []):
        key = MC.normalize(mrow(r, "ColumnX1", "lineNoKey", "lineNo", "Line No", "Line Number") or "")
        if key:
            idx[key] = r
    return idx


def _local(tag):
    return tag.split("}", 1)[1] if "}" in tag else tag


def _iter_branches(root):
    """Yield (branch_name, [ (node_number, od) ... ]) for each Branch in order."""
    for branch in root.iter():
        if _local(branch.tag) != "Branch":
            continue
        bname, nodes = "", []
        for ch in branch:
            if _local(ch.tag) == "Branchname":
                bname = (ch.text or "").strip()
            elif _local(ch.tag) == "Node":
                num = od = None
                for f in ch:
                    if _local(f.tag) == "NodeNumber":
                        num = (f.text or "").strip()
                    elif _local(f.tag) == "OutsideDiameter":
                        od = (f.text or "").strip()
                if num not in (None, ""):
                    nodes.append((num, od))
        if bname:
            yield bname, nodes


def enrich(xml_path, pclass_master, material_map, linelist, overrides, cfg):
    """Branch-level enrichment (one row per branch, nominal bore from the name)."""
    ctx = _make_ctx(pclass_master, material_map, linelist, overrides, cfg)
    root = ET.parse(xml_path).getroot()
    return [_resolve_line(bname, nps_to_dn(extract_nps(bname)), ctx)
            for bname, _nodes in _iter_branches(root)]


def enrich_elements(xml_path, pclass_master, material_map, linelist, overrides, cfg):
    """Element-level enrichment: one entry per element (consecutive node pair),
    with bore taken from the element's from-node OD (-> DN) and re-resolved so
    reducers within a branch get the right wall thickness."""
    ctx = _make_ctx(pclass_master, material_map, linelist, overrides, cfg)
    root = ET.parse(xml_path).getroot()
    elements = []
    for bname, nodes in _iter_branches(root):
        nominal = nps_to_dn(extract_nps(bname))
        for i in range(len(nodes) - 1):
            (fn, fod), (tn, _tod) = nodes[i], nodes[i + 1]
            bore = od_to_dn(fod) or nominal
            r = _resolve_line(bname, bore, ctx)
            try:
                fnum, tnum = int(round(float(fn))), int(round(float(tn)))
            except (TypeError, ValueError):
                continue
            r["from_node"], r["to_node"] = fnum, tnum
            elements.append(r)
    return elements


def build_ca_sidecar(xml_path, pclass_master, material_map, linelist, overrides, cfg):
    """CII-injection sidecar: per-element CA values keyed by node so a host can
    merge them into the CII (CA3=material code, CA4=wall thickness,
    CA7=corrosion). Node numbers match the CII (preserved from the XML)."""
    elements = enrich_elements(xml_path, pclass_master, material_map, linelist, overrides, cfg)
    out_elems, by_node = [], {}
    for r in elements:
        ca = {"CA3": r["materialCode"], "CA4": r["wallThickness"], "CA7": r["corrosion"]}
        entry = {
            "from_node": r["from_node"], "to_node": r["to_node"],
            "lineNoKey": r["lineNoKey"], "bore_mm": r["bore_mm"],
            "pipingClass": r["pipingClass"], "rating": r["rating"],
            "materialName": r["materialName"], "needs_review": r["needs_review"], **ca,
        }
        out_elems.append(entry)
        # Attach by the element's TO node (CII attaches element data at the to-node).
        by_node[str(r["to_node"])] = {**ca, "pipingClass": r["pipingClass"], "rating": r["rating"]}
    return {
        "schema": "cii-ca-injection/1.0",
        "ca_fields": {"CA3": "materialCode", "CA4": "wallThickness", "CA7": "corrosion"},
        "elements": out_elems,
        "by_node": by_node,
    }


def _position_bound_dtxr(root: ET.Element, entries: list[dict[str, Any]],
                         option: dict[str, Any] | None,
                         conflict_samples: list[dict[str, Any]] | None = None
                         ) -> tuple[dict[int, list[dict[str, Any]]], int]:
    """Assign each positioned JSON member to one source node using XYZ first.

    A coincident element boundary (BM2 20/30) is *not* two support owners.
    A matching PS tag may disambiguate equal XYZ only; it cannot rescue an
    offset-mismatched source member by itself. Never replicate a single member
    onto multiple CII nodes.
    """
    import itertools
    import math

    offset = _dtxr_position_offset(option)
    tol = offset["tolerance"]
    cell_size = tol if tol > 0 else 0.000001
    rows: list[tuple[ET.Element, str, dict[str, float], set[str]]] = []
    by_cell: dict[tuple[int, int, int], list[int]] = {}
    by_tag: dict[str, list[int]] = {}

    def cell(pos: dict[str, float]) -> tuple[int, int, int]:
        return tuple(math.floor(pos[k] / cell_size) for k in ("x", "y", "z"))

    for branch in root.iter():
        if _local(branch.tag) != "Branch":
            continue
        name = next(((c.text or "").strip() for c in branch if _local(c.tag) == "Branchname"), "")
        for node in branch:
            if _local(node.tag) != "Node":
                continue
            point = _parse_position_text(next(
                ((c.text or "") for c in node if _local(c.tag) == "Position"), ""))
            if point is None:
                continue
            tags = set(_node_ps_tags(node))
            index = len(rows)
            rows.append((node, name.upper(), point, tags))
            by_cell.setdefault(cell(point), []).append(index)
            for tag in tags:
                by_tag.setdefault(tag, []).append(index)

    def compatible(entry: dict[str, Any], row: tuple) -> bool:
        branch = str(entry.get("branchName") or "").strip().upper()
        return not re.search(r"/B\d+$", branch) or branch == row[1]

    def nearby(entry: dict[str, Any], point: dict[str, float]) -> list[int]:
        key = cell(point)
        neighbors = itertools.product((-1, 0, 1), repeat=3)
        return [i for delta in neighbors
                for i in by_cell.get(tuple(a + d for a, d in zip(key, delta)), ())
                if compatible(entry, rows[i]) and
                _positions_match(rows[i][2], point, tol)]

    # Follow the historical Trace principle of multi-anchor source calibration,
    # not the historical implementation. Require two *different* PS anchors,
    # a unique dominant translation and no previously valid direct/declared match.
    calibration = option if isinstance(option, dict) else {}
    inferred = None
    if calibration.get("enabled") is not False and calibration.get("autoCalibrate") is not False:
        precision = max(_float_or(calibration.get("autoCalibratePrecision"), 1.0), 0.001)
        clusters: dict[tuple[int, int, int], list[tuple[dict[str, float], str]]] = {}
        for entry in entries:
            raw = entry.get("rawPoint")
            if not raw or nearby(entry, raw) or nearby(entry, entry["point"]):
                continue
            anchors = {i for tag in entry.get("tags") or () for i in by_tag.get(tag, ())
                       if compatible(entry, rows[i])}
            if len(anchors) != 1:
                continue
            target = rows[next(iter(anchors))][2]
            diff = {k: target[k] - raw[k] for k in ("x", "y", "z")}
            key = tuple(round(diff[k] / precision) for k in ("x", "y", "z"))
            for tag in entry.get("tags") or ():
                if next(iter(anchors)) in by_tag.get(tag, ()):
                    clusters.setdefault(key, []).append((diff, tag))
                    break
        ranked = sorted(clusters.values(), key=len, reverse=True)
        minimum = max(2, round(_float_or(calibration.get("autoCalibrateMinSamples"), 2)))
        if ranked and len(ranked[0]) >= minimum and len({tag for _, tag in ranked[0]}) >= 2 and \
                (len(ranked) == 1 or len(ranked[0]) > len(ranked[1])):
            inferred = {k: sum(d[k] for d, _ in ranked[0]) / len(ranked[0])
                        for k in ("x", "y", "z")}

    assignments: dict[int, list[dict[str, Any]]] = {}
    ambiguous = 0

    def record_conflict(claim_index: int, reason: str, groups: list[list[int]]) -> None:
        if conflict_samples is None or len(conflict_samples) >= 20:
            return
        owner_rows = sorted({index for group in groups for index in group})
        conflict_samples.append({
            "type": "dtxr-position-ambiguous",
            "sourceClaimIndex": claim_index,
            "reason": reason,
            "candidateCount": len(owner_rows),
            "candidatePositionRowIndices": owner_rows[:12],
        })

    for claim_index, entry in enumerate(entries):
        positions = [entry["rawPoint"], entry["point"]]
        if inferred is not None:
            positions.append({k: entry["rawPoint"][k] + inferred[k] for k in ("x", "y", "z")})
        matches = []
        for point in positions:
            candidates = nearby(entry, point)
            if candidates:
                matches.append(candidates)
        if not matches:
            continue
        # Competing transforms must not silently claim different source nodes.
        if any(set(hit) != set(matches[0]) for hit in matches[1:]):
            ambiguous += 1
            record_conflict(claim_index, "COMPETING_POSITION_TRANSFORMS", matches)
            continue
        hits = matches[0]
        if len(hits) > 1:
            corroborated = [i for i in hits if rows[i][3] & (entry.get("tags") or set())]
            hits = corroborated if len(corroborated) == 1 else []
        if len(hits) != 1:
            ambiguous += 1
            record_conflict(claim_index, "NON_UNIQUE_POSITION_OWNER", matches[:1])
            continue
        node = rows[hits[0]][0]
        assignments.setdefault(id(node), []).append(entry)
    return assignments, ambiguous


def enrich_xml_addons(xml_path: Path, linelist: list[dict[str, Any]] | None, overrides: dict[str, Any] | None, staged_json: Any, dtxr_position_offset: dict[str, Any] | None = None) -> dict[str, Any]:
    """Annotate XML with process T2/T3 and PS-matched staged DTXR values.

    Inputs:
    - xml_path: PipeStressExport XML path.
    - linelist: mapped line-list rows containing lineNo plus optional t2/t3.
    - overrides: optional {"processData": {lineKey: {"t2": ..., "t3": ...}}}.
    - staged_json: staged hierarchy JSON text/object. DTXR_PS uses PS base tags.
      DTXR_POS uses POSI converted into XML coordinates with dtxr_position_offset.

    Output:
    - dict with xmlText, stats, and diagnostics. No fallback is applied when a
      line or PS tag is not mapped; the original XML value is left unchanged.
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()
    _register_default_namespace(root)
    line_index = build_linelist_index(linelist or [])
    # POS evidence has first claim when present. PS-only lookup is limited to
    # members that lack any usable position, not a bypass for a failed POS claim.
    dtxr_index = build_dtxr_ps_index(staged_json, unpositioned_only=True)
    dtxr_pos_entries = build_dtxr_pos_entries(staged_json, dtxr_position_offset)
    ambiguous_position_samples: list[dict[str, Any]] = []
    pos_owners, pos_ambiguous = _position_bound_dtxr(
        root, dtxr_pos_entries, dtxr_position_offset, ambiguous_position_samples)
    assigned_entries = {id(entry) for owner_entries in pos_owners.values() for entry in owner_entries}
    # A support POSI claim is mandatory only within the XML's represented
    # branch scope. Non-support geometry and unrelated source branches remain
    # explicit, auditable exclusions; they are never quietly counted as matches.
    xml_branches = {next(((c.text or "").strip().upper() for c in branch
                    if _local(c.tag) == "Branchname"), "")
                    for branch in root.iter() if _local(branch.tag) == "Branch"}
    def claim_scope(entry):
        kind = str(entry.get("sourceType") or "").upper()
        attrs = entry.get("sourceAttrs") or {}
        support_identity = any(attrs.get(key) for key in
                               ("MDSSUPPTYPE", "SUPPORT_KIND", "SUPPORT_TYPE",
                                "SUPPORT_MAPPER_KIND"))
        # Missing type is not an excuse to discard a clearly declared support.
        if kind not in ("SUPPORT", "ATTA", "ANCI", "REST",
                        "GUIDE", "LINESTOP") and not support_identity:
            return "NOT_APPLICABLE", "non-restraint-source-component"
        branch = str(entry.get("branchName") or "").strip().upper()
        if branch and branch not in xml_branches and (
                re.search(r"/B\\d+$", branch) or
                not any(x.startswith(branch.rstrip("/") + "/B") for x in xml_branches)):
            return "NOT_APPLICABLE", "source-branch-out-of-selected-xml-scope"
        return "MANDATORY", "source-support-positional-owner"
    unresolved_claims = [
        {"sourceClaimIndex": i, "sourceType": e.get("sourceType", ""),
         "sourceName": e.get("sourceAttrs", {}).get("NAME", ""),
         "sourceBranch": e.get("branchName", ""),
         "rawPosition": e.get("rawPoint"),
         "convertedPosition": e.get("point"),
         "scope": claim_scope(e)[0], "reason": claim_scope(e)[1]}
        for i, e in enumerate(dtxr_pos_entries) if id(e) not in assigned_entries
    ]
    stats = {"temperature2": 0, "temperature3": 0, "dtxrPs": 0,
             "dtxrPos": 0, "dtxrPosAmbiguous": pos_ambiguous,
             "dtxrPosUnmatched": len(unresolved_claims),
             "dtxrPosMandatoryUnmatched": sum(x["scope"] == "MANDATORY" for x in unresolved_claims),
             "dtxrPosExcluded": sum(x["scope"] == "NOT_APPLICABLE" for x in unresolved_claims)}
    # PS-only fallback is also unique within this exact XML source basis.
    ps_nodes: dict[str, set[int]] = {}
    for source_node in root.iter():
        if _local(source_node.tag) == "Node":
            for key in _node_ps_tags(source_node):
                ps_nodes.setdefault(key, set()).add(id(source_node))
    diagnostics: list[dict[str, Any]] = list(ambiguous_position_samples)
    diagnostics.extend({"type": "dtxr-position-unmatched", **claim}
                       for claim in unresolved_claims)

    for branch in root.iter():
        if _local(branch.tag) != "Branch":
            continue
        branch_name = ""
        for child in list(branch):
            if _local(child.tag) == "Branchname":
                branch_name = (child.text or "").strip()
                break
        line_key = extract_line_key(branch_name)
        row = line_index.get(MC.normalize(line_key)) if line_key else None
        temperature = _ensure_child(branch, "Temperature")
        t2 = _line_process_value(line_key, row, overrides, "t2", ["t2", "T2", "Temperature2", "Temperature 2", "Temp", "Temp. °C", "Temp. C"])
        t3 = _line_process_value(line_key, row, overrides, "t3", ["t3", "T3", "Temperature3", "Temperature 3", "Temp Min", "Temp Min °C", "Min", "Minimum Temp"])
        if t2 is not None:
            _set_child_text(temperature, "Temperature2", t2)
            stats["temperature2"] += 1
        if t3 is not None:
            _set_child_text(temperature, "Temperature3", t3)
            stats["temperature3"] += 1
        if t2 is not None or t3 is not None:
            diagnostics.append({"type": "process-temperature", "branchName": branch_name, "lineKey": line_key, "t2": t2 or "", "t3": t3 or ""})

    # Stable source identity for each positional owner (not a process-global node number).
    branch_owner = {}
    for source_branch in root.iter():
        if _local(source_branch.tag) != "Branch":
            continue
        name = next(((c.text or "").strip() for c in source_branch
                     if _local(c.tag) == "Branchname"), "")
        for source_node in source_branch:
            if _local(source_node.tag) == "Node":
                branch_owner[id(source_node)] = name

    for node in root.iter():
        if _local(node.tag) != "Node":
            continue
        dtxr_values: list[str] = []
        node_tags = _node_ps_tags(node)
        positioned = pos_owners.get(id(node), [])
        for entry in positioned:
            if set(node_tags) & (entry.get("tags") or set()) and entry["dtxr"] not in dtxr_values:
                dtxr_values.append(entry["dtxr"])
        for tag in node_tags:
            if len(ps_nodes.get(tag, ())) != 1:
                continue
            for dtxr in dtxr_index.get(tag, []):
                if dtxr and dtxr not in dtxr_values:
                    dtxr_values.append(dtxr)
        if not dtxr_values:
            pass
        else:
            joined = "|".join(dtxr_values)
            _set_child_text(node, "DTXR_PS", joined)
            stats["dtxrPs"] += 1
            diagnostics.append({
                "type": "dtxr-ps",
                "nodeNumber": mrow({ _local(child.tag): child.text for child in list(node) }, "NodeNumber") or "",
                "tags": "|".join(node_tags),
                "count": len(dtxr_values),
            })
        dtxr_pos_values: list[str] = []
        for entry in positioned:
            if entry["dtxr"] not in dtxr_pos_values:
                dtxr_pos_values.append(entry["dtxr"])
        if dtxr_pos_values:
            previous = _get_child(node, "DTXR_POS")
            old_annotation = (previous.text or "").strip() if previous is not None else ""
            new_annotation = "|".join(dtxr_pos_values)
            _set_child_text(node, "DTXR_POS", new_annotation)
            stats["dtxrPos"] += 1
            diagnostics.append({
                "type": "dtxr-pos",
                "nodeNumber": mrow({_local(child.tag): child.text for child in list(node)}, "NodeNumber") or "",
                "nodeName": mrow({_local(child.tag): child.text for child in list(node)}, "NodeName") or "",
                "branchName": branch_owner.get(id(node), ""),
                "count": len(dtxr_pos_values),
                "previousValue": old_annotation,
                "newValue": new_annotation,
                "operation": "unchanged" if old_annotation == new_annotation else "source-bound-replace",
                "members": [
                    {"dtxr": e["dtxr"], "rawPosition": e.get("rawPoint"),
                     "convertedPosition": e.get("point"), "branch": e.get("branchName"),
                     "sourceAttrs": e.get("sourceAttrs", {}),
                     "sourceType": e.get("sourceType", "")}
                    for e in positioned
                ],
            })

    xml_text = ET.tostring(root, encoding="unicode")
    return {"xmlText": xml_text, "stats": stats, "diagnostics": diagnostics}


def diagnostics_table(rows):
    out = ["XML -> CII MASTER ENRICHMENT (addon)",
           f"branches={len(rows)}  needs_review={sum(1 for r in rows if r['needs_review'])}", ""]
    hdr = (f"{'LineNoKey':<12}{'Bore':>6} {'Class':<10}{'ClsBy':<10}{'Rating':>7} "
           f"{'Wall':>9}{'Corr':>6} {'MatCode':<8}{'MatBy':<12}{'Review':<6}")
    out.append(hdr)
    out.append("-" * len(hdr))
    for r in rows:
        out.append(
            f"{(r['lineNoKey'] or '-'):<12}{(r['bore_mm'] if r['bore_mm'] is not None else '-'):>6} "
            f"{str(r['pipingClass'] or '-'):<10}{r['class_method']:<10}{str(r['rating'] or '-'):>7} "
            f"{str(r['wallThickness'] or '-'):>9}{str(r['corrosion'] or '-'):>6} "
            f"{str(r['materialCode'] or '-'):<8}{r['material_method']:<12}{('YES' if r['needs_review'] else ''):<6}")
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser(description="Master-enrichment addon for XML->CII (does not modify xml_to_cii2019.py).")
    ap.add_argument("--input", required=True, type=Path, help="PipeStressExport XML.")
    ap.add_argument("--piping-class-master", type=Path)
    ap.add_argument("--material-map", type=Path)
    ap.add_argument("--linelist", type=Path)
    ap.add_argument("--overrides", type=Path)
    ap.add_argument("--config", type=Path)
    ap.add_argument("--out", type=Path, help="Branch-level enrichment JSON output.")
    ap.add_argument("--diagnostics-out", type=Path, help="Diagnostics table output.")
    ap.add_argument("--ca-sidecar-out", type=Path,
                    help="CII-injection sidecar JSON (per-element CA3/CA4/CA7 keyed by node).")
    ap.add_argument("--staged-json", type=Path,
                    help="Staged JSON used to annotate matching XML nodes with DTXR_PS and DTXR_POS.")
    ap.add_argument("--enriched-xml-out", type=Path,
                    help="XML output with process Temperature2/Temperature3 plus DTXR_PS/DTXR_POS addon annotations.")
    args = ap.parse_args()

    pclass = load_json(args.piping_class_master)
    matmap = load_material_map(args.material_map)
    linelist = load_json(args.linelist)
    overrides = load_json(args.overrides)
    cfg = load_json(args.config)

    rows = enrich(args.input, pclass, matmap, linelist, overrides, cfg)
    if args.out:
        args.out.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    if args.diagnostics_out:
        args.diagnostics_out.write_text(diagnostics_table(rows), encoding="utf-8")
    if args.ca_sidecar_out:
        sidecar = build_ca_sidecar(args.input, pclass, matmap, linelist, overrides, cfg)
        args.ca_sidecar_out.write_text(json.dumps(sidecar, indent=2), encoding="utf-8")
        print(f"Wrote CA sidecar ({len(sidecar['elements'])} elements) to {args.ca_sidecar_out}")
    if args.enriched_xml_out:
        staged_json = args.staged_json.read_text(encoding="utf-8-sig") if args.staged_json else None
        addon_xml = enrich_xml_addons(args.input, linelist, overrides, staged_json, (cfg or {}).get("dtxrPositionOffset") if isinstance(cfg, dict) else None)
        args.enriched_xml_out.write_text(addon_xml["xmlText"], encoding="utf-8")
        print(f"Wrote addon-enriched XML to {args.enriched_xml_out}")
    print(diagnostics_table(rows))


if __name__ == "__main__":
    main()
