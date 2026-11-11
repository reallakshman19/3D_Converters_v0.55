"""Spatial acceleration must preserve the original exhaustive matching contract."""
from copy import deepcopy
import math
from pathlib import Path
import random
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'converters/scripts'))
import xml229_prefinal_restraint_source as source


def entry(x, branch='/P/B1', y=0, z=0):
    return dict(branch=branch, point=(x, y, z), attrs={}, type='SUPPORT',
                desc='GUIDE', ps='', name='', tags=set())


def exhaustive_groups(entries, tol):
    """Frozen pre-fix linear reference; independent of the new spatial index."""
    groups = []
    for item in entries:
        hits = [(math.dist(g['point'], item['point']), i) for i, g in enumerate(groups)
                if source.branch_root(g['branch']) == source.branch_root(item['branch'])
                and math.dist(g['point'], item['point']) <= tol]
        if hits:
            group = groups[min(hits)[1]]
        else:
            group = dict(point=item['point'], branch=item['branch'], entries=[])
            groups.append(group)
        group['entries'].append(item)
    return groups


def exhaustive_calibration(nodes, entries, config, field):
    tol = source.tolerance(config)
    groups = exhaustive_groups(entries, tol)
    if (config.get('dtxrPositionOffset') or {}).get('enabled') is True or any(
        source.point(field(n, 'Position')) and source.relationship(b, g['branch']) and
        math.dist(source.point(field(n, 'Position')), g['point']) <= tol
        for b, n in nodes for g in groups):
        return groups
    options = config.get('resolverJsonTrace') or {}
    precision = max(float(options.get('autoCalibratePrecision') or .1), .001)
    votes = {}
    for branch, node in nodes:
        pos = source.point(field(node, 'Position'))
        if pos:
            for g in groups:
                if source.relationship(branch, g['branch']):
                    offset = tuple(a-b for a, b in zip(pos, g['point']))
                    key = tuple(math.floor(v / precision + .5) for v in offset)
                    votes.setdefault(key, []).append(offset)
    best = max(votes.values(), key=len, default=[])
    if len(best) >= max(math.floor(float(options.get('autoCalibrateMinSamples') or 2)+.5), 1):
        offset = tuple(sum(v[i] for v in best) / len(best) for i in range(3))
        for g in groups:
            g['point'] = tuple(a+b for a, b in zip(g['point'], offset))
    return groups


class SpatialContract(unittest.TestCase):
    def test_literal_nearest_tie_order_and_nontransitive_groups(self):
        values = [entry(0), entry(12), entry(6)]
        actual = source.position_groups(values, 6)
        self.assertEqual([len(g['entries']) for g in actual], [2, 1])
        self.assertIs(actual[0]['entries'][1], values[2])
        self.assertEqual([g['point'][0] for g in source.position_groups(
            [entry(0), entry(5), entry(10)], 6)], [0, 10])

    def test_normalized_branch_roots_and_distinct_pipes(self):
        values = [entry(0, '= /P/B01'), entry(0, '/P/B2'), entry(0, '/Q/B1')]
        self.assertEqual([len(g['entries']) for g in source.position_groups(values, 6)], [2, 1])

    def test_boundaries_negative_coordinates_zero_tolerance_and_extreme_fallback(self):
        for tol in [6, .001, 0, -1, math.inf]:
            for start in [0., -12., 1e20, 1e-300]:
                values = [entry(start), entry(start+6), entry(math.nextafter(start+6, math.inf)),
                          entry(-start, y=6), entry(start, z=-6)]
                self.assertEqual(source.position_groups(values, tol), exhaustive_groups(values, tol))

    def test_randomized_exhaustive_equivalence_and_input_order(self):
        for seed in range(12):
            rng = random.Random(seed)
            values = [entry(rng.uniform(-40, 40), rng.choice(['/P/B1','/P/B02','/Q/B1','']),
                            rng.uniform(-10, 10), rng.uniform(-10, 10)) for _ in range(75)]
            self.assertEqual(source.position_groups(values, 6), exhaustive_groups(values, 6))

    def test_calibration_keeps_direct_match_offset_votes_ties_and_disabled_rules(self):
        field = lambda n, k: n.get(k, '')
        nodes = [('/P/B1', {'Position':'0 0 0'}), ('/P/B1', {'Position':'100 0 0'}),
                 ('/Q/B2', {'Position':'not-a-point'})]
        cases = [([entry(0), entry(100)], {}), ([entry(1000), entry(1100)], {}),
                 ([entry(20), entry(-20)], {}), ([entry(20)], {'dtxrPositionOffset':{'enabled':True}}),
                 ([entry(50, '/Q/B1')], {}), ([], {})]
        for values, config in cases:
            self.assertEqual(source.calibrated_groups(nodes, deepcopy(values), config, field),
                             exhaustive_calibration(nodes, deepcopy(values), config, field))

    def test_normalization_work_is_bounded_by_distinct_branches_not_position_pairs(self):
        # Explicit instrumentation wraps the real normalizer; no engineering values mocked.
        values = [entry(i*100.) for i in range(1500)]
        with patch.object(source, 'branch_root', wraps=source.branch_root) as normalizer:
            groups = source.position_groups(values, 6)
        self.assertEqual(len(groups), 1500)
        self.assertLessEqual(normalizer.call_count, 2)

    def test_resolve_preserves_ambiguity_and_authoritative_branch_ref(self):
        field = lambda n, k: n.get(k, '')
        def require(ok, code):
            if not ok:
                raise ValueError(code)
        values = [entry(-6, '/P/B1'), entry(6, '/P/B1')]
        with self.assertRaisesRegex(ValueError, 'MATCH_AMBIGUOUS'):
            source.resolve({'Position':'0 0 0'}, '/P/B1', source.position_groups(values, 6), 6, field, require)
        values[0]['tags'] = {'PS10'}
        values[0]['attrs']['ComponentRefNo'] = '/Q/B1'
        self.assertEqual(source.resolve({'Position':'-6 0 0','NodeName':'PS10'}, '/P/B1',
                         source.position_groups(values, 6), 6, field, require), [])

    def test_root_docs_module_bytes_match(self):
        path = 'converters/scripts/xml229_prefinal_restraint_source.py'
        self.assertEqual((ROOT/path).read_bytes(), (ROOT/'docs'/path).read_bytes())


if __name__ == '__main__':
    unittest.main()
