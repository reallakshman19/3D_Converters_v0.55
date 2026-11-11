"""Recompute permitted pre-Final restraint changes from native source custody.

This deliberately does not copy restraint values out of the Worker snapshot.
The caller retains the whole-XML comparison after replaying this bounded stage.
"""
from xml229_support_type_mapper import (mapped_support_kind, configured_support_rule,
                                         configured_mapper_semantic_conflict)
from decimal import Decimal, InvalidOperation
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from xml229_prefinal_restraint_source import (
    NUMBER, attr, calibrated_groups, source_entries, text,
)


def local(element):
    return element.tag.rsplit('}', 1)[-1]


def children(parent, name):
    return [e for e in parent if isinstance(e.tag, str) and local(e) == name]


def field(parent, name):
    return next((text(e.text) for e in children(parent, name)), '')


def xml_type(v):
    v = text(v).upper()
    return {'GUIDE': 'GUI', 'X': 'GUI', 'LIMIT': 'LIM', 'LINESTOP': 'LIM', 'Z': 'LIM'}.get(v, v)


def present_type(v):
    v = xml_type(v)
    return {'Y': '+Y', 'REST': '+Y', '14': '+Y', '8': 'GUI', '9': 'LIM'}.get(v, v)


def placeholder(r):
    if field(r, 'Type').upper().replace(' ', '') not in ('LIM', 'LIMIT', 'LINESTOP'):
        return False
    try:
        if any(float(field(r, k) or 0) != 0 for k in ('Stiffness', 'Gap')):
            return False
    except ValueError:
        return False
    return not any(field(r, k) for k in ('DirectionCosineX', 'DirectionCosineY',
                   'DirectionCosineZ', 'OriginalText', 'ResolvedFrom', 'SideloadRow')) and not any(
                   text(r.get(k)) for k in ('source', 'basis', 'resolvedKey'))


def numeric(v):
    m = re.search(NUMBER, text(v))
    return float(m[0]) if m else None


def is_rest_hardware_member(attrs, kind):
    if kind != 'REST' or text(attrs.get('NODETYPE')) != '4':
        return False
    code = text(attrs.get('MDSSUPPTYPE')).upper()
    desc = ' '.join(text(attrs.get(k)) for k in ('DTXR','DESC','DESCRIPTION')).upper()
    return ((code == 'AT01' and re.search(r'\bPIPE\s+SHOE\b', desc)) or
            (code == 'AT05' and re.search(r'\bWEAR\s+PLATE\b', desc)))


def kinds(entries, require, config=None):
    config = config or {}
    out = {}
    for e in entries:
        a = e['attrs']
        # The historical qualified mapper lets explicit engineering meaning
        # outrank abbreviated GT/ST. Do not copy its legacy DOF/axis defaults.
        desc = ' '.join([text(a.get(k)) for k in ('DTXR', 'DESC', 'DESCRIPTION')] +
                        [text(e['desc'])]).upper()
        semantic = [
            k for k, pat in (
                ('LINESTOP', r'\b(?:PIPE\s*STOP|LINE\s*STOP|LINESTOP|LIMIT\s*STOP|AXIAL\s*STOP|DIRECTIONAL\s+ANCHOR)\b'),
                ('GUIDE', r'\bGUIDE\b'),
                ('REST', r'\b(?:PIPE[- ]?REST|REST)\b|\bSHOE\b'))
            if re.search(pat, desc)
        ]
        if 'REST' in semantic and 'LINESTOP' in semantic and \
                re.search(r'\bSHOE\b', desc) and \
                not re.search(r'\b(?:PIPE[- ]?REST|REST)\b', desc):
            semantic.remove('REST')
        if 'REST' in semantic and 'GUIDE' in semantic and \
                re.search(r'\bSHOE\b', desc) and \
                not re.search(r'\b(?:PIPE[- ]?REST|REST)\b', desc):
            semantic.remove('REST')
        require(len(set(semantic)) <= 1, 'NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS')
        canonical = {
            text(a.get(k)).upper().replace(' ', '') for k in
            ('SUPPORT_KIND', 'SUPPORT_MAPPER_KIND', 'SUPPORT_TYPE')
            if text(a.get(k)).upper().replace(' ', '') in ('REST', 'GUIDE', 'LINESTOP')
        }
        require(len(canonical) <= 1, 'NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS')
        custom_kind = configured_support_rule(a, e['desc'], config, require)
        if custom_kind and semantic:
            require(custom_kind == semantic[0],
                    'NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS')
        if custom_kind:
            require(custom_kind in ('REST','GUIDE','LINESTOP'),
                    'NATIVE_PREFINAL_RESTRAINT_KIND_UNSUPPORTED')
        if semantic or custom_kind:
            configured_mapper_semantic_conflict(a, e['desc'], config,
                                                 semantic[0] if semantic else custom_kind, require)
        mapped_kind, score = ('', 0) if semantic or custom_kind else mapped_support_kind(
            a, e['desc'], config, require)
        code = text(a.get('MDSSUPPTYPE')).upper()
        kind = (semantic[0] if semantic
                else custom_kind if custom_kind
                else mapped_kind if score >= .65 and mapped_kind in ('REST','GUIDE','LINESTOP')
                else next(iter(canonical)) if canonical
                else mapped_kind if mapped_kind in ('REST','GUIDE','LINESTOP')
                else 'GUIDE' if code.startswith('GT') else 'LINESTOP' if code.startswith('ST')
                else 'REST' if code == 'PIPE-REST' or code.startswith('AT') or
                re.search(r'\b(?:PIPE[- ]?REST|REST|SHOE)\b',
                          text(a.get('SPRE')).upper()) else '')
        if not kind:
            continue
        raw = source_gap(a)
        # CMPSUPGAP is a source member's explicit gap. Historical NODEGAP=0
        # is a placeholder when this SAME member supplies CMPSUPGAP.
        # Two nonzero/different explicit values must still fail closed.
        legacy_zero_placeholder = bool(text(a.get('CMPSUPGAP'))) and (
            text(a.get('NODEGAP')) != '' and numeric(a.get('NODEGAP')) == 0
        )
        alias_values = [text(a.get(k)) for k in
                        ('CMPSUPGAP', 'CMPSUPGAP_POS', 'CMPSUPGAP_PS', 'NODEGAP')
                        if text(a.get(k)) and (k != 'NODEGAP' or not legacy_zero_placeholder)]
        if legacy_zero_placeholder and numeric(a.get('CMPSUPGAP')) != 0:
            print('XML229_GAP_ALIAS_AUTHORITY ' + json.dumps({
                'memberName': text(a.get('NAME')),
                'kind': kind, 'sourceField': 'CMPSUPGAP',
                'sourceValue': text(a.get('CMPSUPGAP')),
                'ignoredLegacyZero': text(a.get('NODEGAP')),
                'reason': 'legacy-NODEGAP-zero-placeholder',
            }, sort_keys=True))
        require(all(numeric(v) is not None for v in alias_values),
                'NATIVE_PREFINAL_RESTRAINT_GAP_INVALID')
        require(all(numeric(v) == numeric(raw) for v in alias_values),
                'NATIVE_PREFINAL_RESTRAINT_GAP_AMBIGUOUS')
        previous_attrs = out.get(kind, {})
        # A REST datum is a different structural source role from its co-located
        # AT01 shoe / AT05 wear-pad hardware; prioritize the true REST owner
        # before testing for conflicting authoritative REST gaps.
        if previous_attrs and kind == 'REST':
            previous_hardware = is_rest_hardware_member(previous_attrs, kind)
            current_hardware = is_rest_hardware_member(a, kind)
            if previous_hardware != current_hardware:
                if previous_hardware:
                    out[kind] = a
                continue
        previous = source_gap(previous_attrs)
        require(not (previous and raw and numeric(previous) != numeric(raw)),
                'NATIVE_PREFINAL_RESTRAINT_GAP_AMBIGUOUS')
        prior_type = node_type_mutation(previous_attrs, config)
        current_type = node_type_mutation(a, config)
        if prior_type and current_type and prior_type != current_type:
            first_aux = is_rest_hardware_member(previous_attrs, kind)
            second_aux = is_rest_hardware_member(a, kind)
            if first_aux != second_aux:
                if first_aux:
                    out[kind] = a
                continue
            require(False, 'NATIVE_PREFINAL_RESTRAINT_TYPE_AMBIGUOUS')
        if kind not in out or (not previous and raw):
            out[kind] = a
    return out


def source_gap(a):
    return next((text(a.get(k)) for k in
                 ('CMPSUPGAP', 'CMPSUPGAP_POS', 'CMPSUPGAP_PS', 'NODEGAP')
                 if text(a.get(k))), '')


def vector(value):
    if isinstance(value, dict):
        value = [value.get(k, value.get(k.upper(), 0)) for k in ('x', 'y', 'z')]
    if isinstance(value, str):
        value = re.findall(NUMBER, value)
    if not isinstance(value, (list, tuple)) or len(value) < 3:
        return None
    try:
        v = tuple(float(x) for x in value[:3])
        size = math.sqrt(sum(x*x for x in v))
        return tuple(x/size for x in v) if math.isfinite(size) and size > 1e-9 else None
    except (TypeError, ValueError):
        return None


def attr_vector(a, names):
    return next((v for name in names if (v := vector(a.get(name)))), None)


def direction(profile, attrs, node):
    mode = profile['directionMode']
    if mode == 'fixed':
        return vector(profile.get('direction'))
    if mode == 'from-xml':
        return vector([field(node, 'DirectionCosine' + axis) or 0 for axis in 'XYZ'])
    if mode == 'from-staged':
        return attr_vector(attrs, ['DIRECTION_COSINES', 'DIRECTIONCOSINES', 'SUPPORT_DIRECTION_COSINES',
                                  'SUPPORTDIRECTIONCOSINES', 'DIRCOS', 'DIRECTION', 'SUPPORT_DIRECTION'])
    axis = attr_vector(attrs, ['PIPE_AXIS_COSINES', 'PIPEAXISCOSINES', 'PIPE_AXIS', 'PIPEAXIS',
                              'PIPE_AXIS_VECTOR', 'PIPEAXISVECTOR', 'AXIS', 'DIRECTION_COSINES', 'DIRECTIONCOSINES'])
    if not axis or mode not in ('pipe-axis', 'pipe-normal'):
        return None
    if mode == 'pipe-axis':
        return axis
    x, y, z = axis
    return vector((z, 0, -x) if abs(y) < .9 else (0, -z, y))


def profile_for(kind, config):
    typ, mode = {'REST': ('+Y', 'fixed'), 'GUIDE': ('GUI', 'pipe-normal'),
                 'LINESTOP': ('LIM', 'pipe-axis')}[kind]
    p = dict(xmlTypes=(config.get('supportKindToXmlType') or {}).get(kind) or [typ],
             directionMode=mode, direction={'x': 0, 'y': 1, 'z': 0} if kind == 'REST' else None,
             stiffness='default', gap=text(config.get('defaultGap', '0')),
             frictionMode='default' if kind == 'REST' else 'sentinel', fixedFriction='')
    mapping = config.get('supportMapping') or {}
    if float(mapping.get('version') or 0) >= 2:
        p.update({k: v for k, v in (mapping.get('kindProfiles', {}).get(kind) or {}).items() if v is not None})
    values = p['xmlTypes']
    if isinstance(values, str):
        values = [v for part in re.split(r'[,;\n]', values) for v in re.split(r'(?<=\w)(?=\+)', part)]
    p['xmlTypes'] = [xml_type(v) for v in values if text(v)]
    return p



def node_type_mutation(attrs, config):
    """Native counterpart of 8 Config mutation; source NODETYPE is numeric."""
    raw = text(attrs.get('NODETYPE'))
    if not raw:
        return ''
    if not re.fullmatch(r'[0-9]+', raw) or not 1 <= int(raw) <= 62:
        raise ValueError('NATIVE_PREFINAL_RESTRAINT_TYPE_INVALID')
    value = int(raw)
    rules = (config.get('inputXmlRestraintTypeMutation') or
             config.get('restraintTypeMutation') or {})
    defaults = [('17', '14'), ('7', '9'), ('10', '8'),
                ('1', '2'), ('2', '3'), ('3', '5'), ('18', '15')]
    if rules.get('enabled') is not False:
        rows = rules.get('rows')
        selected = [(row.get('from'), row.get('to')) for row in rows
                    if isinstance(row, dict)] if isinstance(rows, list) else defaults
        for source, target in selected:
            if text(source) == str(value):
                if not re.fullmatch(r'[0-9]+', text(target)) or not 1 <= int(target) <= 62:
                    raise ValueError('NATIVE_PREFINAL_RESTRAINT_TYPE_INVALID')
                value = int(target)
                break
    return present_type(str(value))

def append_profile(node, kind, attrs, config, allowed=None):
    p = profile_for(kind, config)
    ns = node.tag.rsplit('}', 1)[0] + '}' if '}' in node.tag else ''
    d = direction(p, attrs, node)
    raw = source_gap(attrs) if kind in ('REST', 'GUIDE', 'LINESTOP') else ''
    gap = str(numeric(raw)) if raw else text(p.get('gap')) or '0'
    node_gap = next((field(node, k) for k in ('CMPSUPGAP', 'CMPSUPGAP_POS', 'CMPSUPGAP_PS') if field(node, k)), '')
    original_type = node_type_mutation(attrs, config)
    if original_type in ('+Y','GUI','LIM') and original_type != {
            'REST':'+Y','GUIDE':'GUI','LINESTOP':'LIM'}[kind]:
        raise ValueError('NATIVE_PREFINAL_RESTRAINT_TYPE_KIND_CONFLICT')
    for typ in ([original_type] if original_type else p['xmlTypes']):
        if allowed is not None and present_type(typ) in allowed:
            continue
        friction = text(config.get('defaultFriction', '0.3')) or '0.3'
        if p['frictionMode'] == 'fixed' and text(p.get('fixedFriction')):
            friction = text(p['fixedFriction'])
        elif p['frictionMode'] == 'sentinel' and config.get('useFrictionSentinelForNonYSupports') is not False and typ not in ('Y', '+Y'):
            friction = '-1.010100'
        actual_gap = str(numeric(node_gap)) if typ in ('GUI', 'LIM') and not raw and numeric(gap) == 0 and node_gap else gap
        values = [('Type', typ), ('Stiffness', text(p['stiffness']) if text(p['stiffness']) not in ('', 'default')
                  else text(config.get('defaultStiffness')) or '1.751270E+12'),
                  ('Gap', actual_gap), ('Friction', friction)]
        if (raw and typ in ('GUI', 'LIM')) or (typ in ('GUI', 'LIM') and node_gap):
            values.append(('CMPSUPGAP', raw or node_gap))
        if d:
            values.extend(('DirectionCosine' + axis, f'{v:.9f}') for axis, v in zip('XYZ', d))
        r = ET.SubElement(node, ns + 'Restraint')
        for name, value in values:
            ET.SubElement(r, ns + name).text = value
        if allowed is not None:
            allowed.add(present_type(typ))


def replay_prefinal_restraints(expected, packet, staged_json_path, config, require):
    final = packet.get('finalizedGeometry') or {}
    stage = final.get('prefinalRestraints')
    if stage is None:
        return False
    require(isinstance(stage, dict) and stage.get('schema') == 'XML229.PrefinalRestraints.v1',
            'NATIVE_PREFINAL_RESTRAINT_STAGE_INVALID')
    raw = staged_json_path.read_bytes() if staged_json_path is not None else b''
    sha = hashlib.sha256(raw).hexdigest()
    require(stage.get('originalJsonSha256') == sha and
            (not packet.get('originalJsonSha256') or packet['originalJsonSha256'] == sha),
            'NATIVE_PREFINAL_RESTRAINT_SOURCE_SHA_DRIFT')
    require(isinstance(config, dict), 'NATIVE_PREFINAL_RESTRAINT_CONFIG_REQUIRED')
    if (config.get('supportMapping') or {}).get('useJsonForRestraints') is False:
        return True
    try:
        parsed = json.loads(raw.decode('utf-8-sig')) if raw.strip() else []
    except (ValueError, UnicodeError):
        require(False, 'NATIVE_PREFINAL_RESTRAINT_SOURCE_INVALID')
    source_nodes = [(field(b, 'Branchname'), n) for b in expected.iter() if local(b) == 'Branch'
                    for n in children(b, 'Node')]
    groups = calibrated_groups(source_nodes, source_entries(parsed, config), config, field)
    from xml229_prefinal_restraint_source import resolve, tolerance, _ResolutionIndex
    resolver_index = _ResolutionIndex(groups, tolerance(config))
    for branch, node in source_nodes:
        typ = field(node, 'ComponentType').upper()
        if typ not in ('ATTA', 'ANCI'):
            continue
        evidence = kinds(resolve(node, branch, groups, tolerance(config), field, require,
                                 resolver_index), require, config)
        if evidence:
            for r in children(node, 'Restraint'):
                if placeholder(r):
                    node.remove(r)
            present = {present_type(field(r, 'Type')) for r in children(node, 'Restraint')}
            for kind in ('REST', 'GUIDE', 'LINESTOP'):
                if kind in evidence:
                    append_profile(node, kind, evidence[kind], config, present)
        rows = children(node, 'Restraint')
        if typ == 'ATTA' and (not rows or all(map(placeholder, rows))):
            for r in rows:
                node.remove(r)
            append_profile(node, 'REST', {}, config)
    return True


def restraint_semantics(element):
    """Canonical numeric formatting only; never ignore fields/attributes/order."""
    numeric_fields = {'Stiffness', 'Gap', 'Friction', 'DirectionCosineX', 'DirectionCosineY', 'DirectionCosineZ'}
    for r in element.iter():
        if local(r) != 'Restraint':
            continue
        for c in r:
            if local(c) in numeric_fields:
                try:
                    value = Decimal(text(c.text))
                    if value.is_finite():
                        c.text = str(value.normalize()) if value else '0'
                except InvalidOperation:
                    pass
