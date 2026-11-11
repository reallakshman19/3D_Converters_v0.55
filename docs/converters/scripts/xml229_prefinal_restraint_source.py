"""Independent original-JSON support resolution for pre-Final XML verification.

Reads source hierarchy/coordinates, never Worker-claimed kinds or gaps. This is
the native counterpart of the existing positional/PS source matching contract.
"""
import html
import itertools
import math
import re

NUMBER = r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?"
POSITIONS = ('SUPPORTCOORD', 'SUPPORT_COORD', 'POS', 'POSI', 'BPOS',
             'APOS', 'LPOS', 'CPOS', 'HPOS', 'TPOS', 'SPOS', 'EPOS', 'DTXR_POS')


def text(v):
    return '' if v is None else str(v).strip()


def attr(attrs, *names):
    for name in names:
        for key, value in attrs.items():
            if key.upper() == name.upper() and text(value):
                return value
    return ''


def branch_name(v):
    v = re.sub(r'<\/?Branchname[^>]*>', '', html.unescape(text(v)), flags=re.I)
    v = re.sub(r'^\s*=\s*', '', v).replace('“', '"').replace('”', '"')
    v = v.replace('‘', "'").replace('’', "'").replace('\\"', '"').replace('\\', '/')
    v = '/' + re.sub(r'\s+', '', re.sub('/+', '/', v)).strip('/')
    return re.sub(r'/B0*(\d+)$', r'/B\1', v, flags=re.I).upper()


def branch_root(v):
    return re.sub(r'/B\d+$', '', branch_name(v), flags=re.I)


def relationship(a, b):
    if not text(b):
        return 50
    a, b = branch_name(a), branch_name(b)
    if a == b:
        return 100
    a, b = branch_root(a), branch_root(b)
    if a == b:
        return 95
    return 92 if a.replace('"', '').replace("'", '') == b.replace('"', '').replace("'", '') else 0


def point(value):
    if isinstance(value, dict):
        value = [next((value[k] for k in keys if k in value), None) for keys in
                 [('x', 'X', 'E', 'east'), ('y', 'Y', 'N', 'north'),
                  ('z', 'Z', 'U', 'EL', 'elev', 'elevation')]]
    if isinstance(value, (list, tuple)):
        try:
            p = tuple(float(v) for v in value[:3])
            return p if len(p) == 3 and all(map(math.isfinite, p)) else None
        except (ValueError, TypeError):
            return None
    axes = {}
    for axis, raw in re.findall(r'\b(EL|E|W|N|S|U|D)\s*[:=]?\s*(' + NUMBER + ')', text(value), re.I):
        key, sign = {'E': (0, 1), 'W': (0, -1), 'N': (1, 1), 'S': (1, -1),
                     'U': (2, 1), 'EL': (2, 1), 'D': (2, -1)}[axis.upper()]
        axes[key] = float(raw) * sign
    if len(axes) == 3:
        return tuple(axes[i] for i in range(3))
    nums = re.findall(NUMBER, text(value))
    return point(nums[:3]) if len(nums) >= 3 else None


def tags(value):
    return {v.lstrip('/').replace('PS-', 'PS') for v in
            re.findall(r'/?PS-?\d+(?:\.\d+)?', text(value).upper())}


def tolerance(config):
    values = [(config.get('resolverJsonTrace') or {}).get('coordinateTolerance'),
              (config.get('jsonTrace') or {}).get('coordinateTolerance'),
              config.get('dtxrCoordinateToleranceMm'), config.get('coordinateTolerance'),
              (config.get('dtxrPositionOffset') or {}).get('tolerance')]
    for v in values:
        try:
            if float(v) > 0 and math.isfinite(float(v)):
                return float(v)
        except (ValueError, TypeError):
            pass
    return 6


def source_entries(value, config, branch='', inherited=None):
    if isinstance(value, list):
        return [e for item in value for e in source_entries(item, config, branch, inherited)]
    if not isinstance(value, dict):
        return []
    a = value.get('attributes') or {}
    typ = text(value.get('type') or a.get('TYPE')).upper()
    children = value.get('children') or []
    if typ == 'BRANCH':
        branch = text(value.get('name') or attr(a, 'OWNER', 'BRANCH', 'PIPE') or branch)
    direct = None
    for alias in POSITIONS:
        direct = point(attr(a, alias))
        if direct is not None:
            off = config.get('dtxrPositionOffset') or {}
            if alias == 'POSI' and off.get('enabled') is True:
                direct = tuple(v + float(off.get(k) or 0) for v, k in
                               zip(direct, ('xOffset', 'yOffset', 'zOffset')))
            break
    direct = direct or point(value.get('position') or value.get('point'))
    pos = direct or inherited
    raw = attr(a, 'DTXR_POS')
    desc = text((attr(a, 'DTXR', 'DESC', 'DESCRIPTION', 'RTEXT', 'SPRE') if point(raw)
                 else raw or attr(a, 'DTXR', 'DESC', 'DESCRIPTION', 'RTEXT', 'SPRE'))
                or ('' if children else value.get('name') or typ))
    ps = text(attr(a, 'DTXR_PS', 'DTXRPS'))
    name = text(attr(a, 'NAME', 'NodeName', 'SupportTag'))
    out = []
    if typ != 'BRANCH' and not (direct and children and not desc and not ps) and pos and (
            desc or ps or text(attr(a, 'CMPSUPGAP', 'SUPPORT GAP'))):
        out.append(dict(branch=branch, point=pos, attrs=a, type=typ, desc=desc,
                        ps=ps, name=name, tags=tags(' '.join([name, desc, ps,
                        text(attr(a, 'PS', 'supportPs', 'psNo'))]))))
    for child in children:
        out.extend(source_entries(child, config, branch, pos))
    return out


class _PositionIndex:
    """Candidate acceleration only; callers retain exact distance/branch tests."""
    def __init__(self, tol):
        self.tol = tol
        self.cells, self.unindexed, self.size = {}, [], 0

    def cell(self, pos):
        if not math.isfinite(self.tol) or self.tol <= 0:
            return None
        values = tuple(v / self.tol for v in pos)
        # Very large quotients lose cell precision: retain the exhaustive path.
        return tuple(math.floor(v) for v in values) if all(
            math.isfinite(v) and abs(v) <= 2**50 for v in values) else None

    def add(self, pos):
        cell = self.cell(pos)
        if cell is None:
            self.unindexed.append(self.size)
        else:
            self.cells.setdefault(cell, []).append(self.size)
        self.size += 1

    def nearby(self, pos):
        cell = self.cell(pos)
        if cell is None:
            return range(self.size)
        return itertools.chain(self.unindexed, *(self.cells.get(tuple(a+b for a, b in zip(cell, delta)), ())
            for delta in itertools.product((-2, -1, 0, 1, 2), repeat=3)))


def position_groups(entries, tol):
    groups, roots, normalized = [], [], {}
    index = _PositionIndex(tol)
    for entry in entries:
        branch = entry['branch']
        if branch not in normalized:
            normalized[branch] = branch_root(branch)
        root = normalized[branch]
        hits = [(distance, i) for i in index.nearby(entry['point'])
                if roots[i] == root and
                (distance := math.dist(groups[i]['point'], entry['point'])) <= tol]
        if hits:
            group = groups[min(hits)[1]]
        else:
            group = dict(point=entry['point'], branch=entry['branch'], entries=[])
            groups.append(group)
            roots.append(root)
            index.add(entry['point'])
        group['entries'].append(entry)
    return groups


class _ResolutionIndex:
    """Read-only acceleration; branch, member and ambiguity semantics unchanged."""
    def __init__(self, groups, tol):
        self.groups = groups
        self.spatial = _PositionIndex(tol)
        self.by_tag = {}
        self.branch_names = tuple(dict.fromkeys(g['branch'] for g in groups))
        self.score_cache = {}
        for i, group in enumerate(groups):
            self.spatial.add(group['point'])
            for entry in group['entries']:
                for tag in entry['tags']:
                    self.by_tag.setdefault(tag, []).append((i, group, entry))

    def scores(self, branch):
        if branch not in self.score_cache:
            self.score_cache[branch] = {
                name: relationship(branch, name) for name in self.branch_names
            }
        return self.score_cache[branch]


def resolve(node, branch, groups, tol, field, require, index=None):
    pos, tag = point(field(node, 'Position')), tags(field(node, 'NodeName') or field(node, 'ComponentRefNo'))
    tag = next(iter(tag), '')
    if index is None:
        index = _ResolutionIndex(groups, tol)
    explicit, authoritative = [], []
    scores = index.scores(branch)
    tagged = index.by_tag.get(tag, ()) if tag else ()
    for i, g, e in tagged:
        ref = attr(e['attrs'], 'ComponentRefNo', 'COMPONENTREFNO', 'COMPRE',
                   'ATTACHED_COMPONENT_REF', 'REF', 'RefNo')
        if re.search(r'/B\d+$', branch_name(ref)):
            authoritative.append(e)
            if relationship(branch, ref):
                explicit.append((g, e))
    require(len(explicit) <= 1, 'NATIVE_PREFINAL_RESTRAINT_MATCH_AMBIGUOUS')
    if authoritative and not explicit:
        return []
    hits = []
    indices = index.spatial.nearby(pos) if pos is not None else ()
    for i in indices:
        g = groups[i]
        score = scores[g['branch']]
        dist = math.dist(pos, g['point'])
        if score and dist <= tol:
            hits.append((-score, -int(any(tag and tag in e['tags'] for e in g['entries'])), dist, i, g))
    hits.sort(key=lambda h: h[:4])
    require(not (len(hits) > 1 and hits[0][:2] == hits[1][:2] and
                 abs(hits[0][2] - hits[1][2]) < .001), 'NATIVE_PREFINAL_RESTRAINT_MATCH_AMBIGUOUS')
    if hits and (not explicit or hits[0][4] is explicit[0][0]):
        return hits[0][4]['entries']
    if explicit:
        return [explicit[0][1]]
    ps = [(scores[g['branch']], i, e) for i, g, e in tagged
          if scores[g['branch']]]
    ps.sort(key=lambda h: (-h[0], h[1]))
    return [ps[0][2]] if ps and (len(ps) == 1 or ps[0][0] > ps[1][0]) else []


def calibrated_groups(source_nodes, entries, config, field):
    tol = tolerance(config)
    groups = position_groups(entries, tol)
    # Auto offset is permitted only when no direct positional match exists.
    if (config.get('dtxrPositionOffset') or {}).get('enabled') is True:
        return groups
    sources = [(branch, point(field(node, 'Position'))) for branch, node in source_nodes]
    scores = {(b, gb): relationship(b, gb)
              for b in dict.fromkeys(b for b, pos in sources)
              for gb in dict.fromkeys(g['branch'] for g in groups)}
    index = _PositionIndex(tol)
    for g in groups:
        index.add(g['point'])
    if any(scores[b, groups[i]['branch']] and math.dist(pos, groups[i]['point']) <= tol
           for b, pos in sources if pos for i in index.nearby(pos)):
        return groups
    options = config.get('resolverJsonTrace') or {}
    precision = max(float(options.get('autoCalibratePrecision') or .1), .001)
    votes = {}
    # Preserve each eligible group's original order but avoid repeated scans
    # through every unrelated source branch for every candidate position.
    eligible = {branch: [g for g in groups if scores[branch, g['branch']]]
                for branch, _ in sources}
    for branch, pos in sources:
        if not pos:
            continue
        for g in eligible[branch]:
            offset = tuple(a - b for a, b in zip(pos, g['point']))
            key = tuple(math.floor(v / precision + .5) for v in offset)
            votes.setdefault(key, []).append(offset)
    best = max(votes.values(), key=len, default=[])
    if len(best) >= max(math.floor(float(options.get('autoCalibrateMinSamples') or 2) + .5), 1):
        offset = tuple(sum(v[i] for v in best) / len(best) for i in range(3))
        for g in groups:
            g['point'] = tuple(a + b for a, b in zip(g['point'], offset))
    return groups
