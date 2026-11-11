"""Independent replay of Step 7 Support Type Mapper aliases for native Final.

Source rows come from saved supportTypeMapper.rows, not from a claimed Worker
resolution. Non-REST/GUIDE/LINESTOP targets never fabricate governed restraints.
"""
import re

_LOW = {'GT', 'ST', 'PG', 'LS'}
_HIGH = {'SHOE','PIPEREST','WEARPAD','REST','RES','GUIDE',
         'LATERALGUIDE','LINESTOP','DIRECTIONALANCHOR','AXIALSTOP','ANCHOR','FIXED'}


def _norm(value):
    return re.sub(r'[^A-Z0-9]', '', str(value or '').upper())


def _match_alias(source, alias):
    key, pattern = _norm(alias), str(alias or '').upper().strip()
    if not key or not pattern:
        return None
    if '*' in pattern:
        rx = '.*'.join(re.escape(piece) for piece in pattern.split('*'))
        return .75 if re.search(rx, source) else None
    if pattern in _LOW:
        rx = r'(?:^|[^A-Z0-9])' + re.escape(pattern) + r'[A-Z0-9_-]*(?=$|[^A-Z0-9])'
        return .45 if re.search(rx, source) else None
    if pattern == 'RES' and not re.search(r'(?:^|[^A-Z0-9])RES(?=$|[^A-Z0-9])', source):
        return None
    if key not in _norm(source):
        return None
    return .98 if key in _HIGH else .9 if len(key) >= 6 else .75



def configured_support_rule(attrs, description, config, require):
    """Replay saved Tab 8 custom rule/regex directly from original source fields.

    Built-in and generated Tab 7 prefix rules retain their existing fallback
    roles; user-authored rules are evaluated by explicit priority, with
    equal-priority conflicting kinds rejected rather than guessed.
    """
    mapping = config.get('supportMapping') or {}
    rows = mapping.get('rules')
    if not isinstance(rows, list):
        return ''
    values = dict(attrs)
    values.setdefault('DESCRIPTION', description)
    matches = []
    for index, rule in enumerate(rows):
        if not isinstance(rule, dict) or rule.get('enabled') is False:
            continue
        ident = str(rule.get('id') or '')
        if ident.startswith(('builtin-', 'standalone-mds-')):
            continue
        scope = str(rule.get('source') or '').lower().strip()
        if scope not in ('', 'all', 'staged-json', 'json'):
            continue
        kind = str(rule.get('kind') or '').upper().replace(' ', '')
        if not kind:
            continue
        mode = str(rule.get('match') or 'contains')
        require(mode in ('regex', 'contains', 'equals', 'startsWith'),
                'NATIVE_PREFINAL_RESTRAINT_CONFIG_INVALID')
        fields = [('*' if f.strip() == '*' else
                   re.sub(r'[^A-Z0-9]', '', f.upper())) for f in
                  re.split(r'[,;\n]', str(rule.get('field') or '')) if f.strip()]
        candidates = [str(v) for k,v in values.items()
                      if v is not None and (not fields or '*' in fields or
                      'ANY' in fields or re.sub(r'[^A-Z0-9]', '', k.upper()) in fields)
                      and str(v).strip()]
        pattern = str(rule.get('pattern') or '').strip()
        if not pattern:
            continue
        if mode == 'regex':
            require(len(pattern) <= 512, 'NATIVE_PREFINAL_RESTRAINT_CONFIG_INVALID')
            try:
                expression = re.compile(pattern, re.I)
            except re.error:
                require(False, 'NATIVE_PREFINAL_RESTRAINT_CONFIG_INVALID')
            found = any(expression.search(v) for v in candidates)
        else:
            terms = [v.strip().upper() for v in re.split(r'[,;\n]', pattern) if v.strip()]
            found = any(any(
                c.upper() == term if mode == 'equals' else
                c.upper().startswith(term) if mode == 'startsWith' else
                term in c.upper() for term in terms) for c in candidates)
        if found:
            priority = rule.get('priority', (index+1)*10)
            try:
                priority = float(priority)
            except (ValueError, TypeError):
                priority = (index+1)*10
            if not __import__('math').isfinite(priority):
                priority = (index+1)*10
            matches.append((priority, kind, ident or 'rule-'+str(index)))
    if not matches:
        return ''
    matches.sort(key=lambda item: (item[0], item[2]))
    best = matches[0][0]
    first = {kind for priority, kind, _ in matches if priority == best}
    require(len(first) == 1, 'NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS')
    return next(iter(first))


_DEFAULT_KIND_ALIASES = {
    'REST': {'SHOE','PIPEREST','WEARPAD','REST','RES'},
    'GUIDE': {'GUIDE','PG','LATERALGUIDE','GT'},
    'LINESTOP': {'LINESTOP','DIRECTIONALANCHOR','LS','AXIALSTOP','ST'},
    'ANCHOR': {'ANCHOR','FIXED'},
}


def configured_mapper_semantic_conflict(attrs, description, config, semantic, require):
    """Detect newly configured Tab 7 keywords that contradict source semantics.

    Default cross-kind hardware terms (e.g. SHOE in a DIRECTIONAL ANCHOR)
    do not become a false contradiction.
    """
    rows = (config.get('supportTypeMapper') or {}).get('rows')
    if not isinstance(rows, list) or not semantic:
        return
    source = ' '.join(str(v) for v in
        [attrs.get('DTXR'),attrs.get('DESC'),attrs.get('DESCRIPTION'),
         description,attrs.get('CMPSUPTYPE'),attrs.get('MDSSUPPTYPE'),
         attrs.get('SPRE')] if v).upper()
    for row in rows:
        if not isinstance(row, dict):
            continue
        kind = str(row.get('kind') or '').upper()
        if kind == semantic:
            continue
        for alias in row.get('aliases') or []:
            if _norm(alias) in _DEFAULT_KIND_ALIASES.get(kind, set()):
                continue
            score = _match_alias(source, alias)
            if score is not None and score >= 0.65:
                require(False, 'NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS')


def mapped_support_kind(attrs, description, config, require):
    rows = (config.get('supportTypeMapper') or {}).get('rows')
    if not isinstance(rows, list):
        return '', 0
    source = ' '.join(str(v) for v in
        [attrs.get('DTXR'),attrs.get('DESC'),attrs.get('DESCRIPTION'),
         description,attrs.get('CMPSUPTYPE'),attrs.get('MDSSUPPTYPE'),
         attrs.get('SPRE')] if v).upper()
    primary = bool(re.search(r'\b(?:LINE\s*STOP|LINESTOP|AXIAL\s*STOP|'
                             r'DIRECTIONAL\s+ANCHOR|LATERAL\s+GUIDE|GUIDE)\b', source))
    matches = []
    for row in rows:
        kind = str(row.get('kind') or '').upper() if isinstance(row, dict) else ''
        if not kind:
            continue
        for alias in row.get('aliases') or []:
            score = _match_alias(source, alias)
            if score is not None:
                if primary and kind == 'REST' and _norm(alias) in ('WEARPAD','SHOE'):
                    score = .75
                matches.append((score, kind))
    if not matches:
        return '', 0
    strongest = max(score for score, kind in matches)
    winners = {kind for score, kind in matches if abs(score - strongest) < 1e-9}
    require(len(winners) == 1, 'NATIVE_PREFINAL_RESTRAINT_KIND_AMBIGUOUS')
    return next(iter(winners)), strongest
