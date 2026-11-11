"""Independent original-source/actual-CII audit for BM2 TEE main-run routing.

No production selector or writer imports. Reuses the independent fixed-column
reader from the preceding OLET audit. Test Final kg is not Owner acceptance.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location(
    'olet_audit', Path(__file__).with_name('audit-xml229-bm2-olet-output.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def tee_groups(root):
    found = []
    for bi, branch in enumerate(audit.branches(root)):
        rows = audit.nodes(branch)
        for i, center in enumerate(rows):
            if audit.text(center, 'ComponentType') != 'TEE' or audit.text(center, 'Endpoint') != '0':
                continue
            group = rows[i-2:i+2]
            assert len(group) == 4
            assert [audit.text(n, 'Endpoint') for n in group] == ['1', '3', '0', '2']
            assert all(audit.text(n, 'ComponentRefNo') == audit.text(center, 'ComponentRefNo') for n in group)
            tip = group[1]
            assert audit.text(tip, 'NodeNumber') == '-1'
            assert not audit.text(tip, 'NodeName') and not tip.findall('{*}Restraint')
            assert float(audit.text(tip, 'Weight') or 0) == 0
            assert float(audit.text(tip, 'Rigid') or 0) == 0
            assert float(audit.text(tip, 'SIF') or 0) == 0
            found.append((bi, i-2, group))
    assert len(found) == 31
    return found


def occurrences(packet, root):
    mapping = {}
    ordinals = packet['finalizedGeometry']['retainedSourceOrdinalsByBranch']
    for bi, branch in enumerate(audit.branches(root)):
        rows = audit.nodes(branch)
        assert len(rows) == len(ordinals[bi])
        for ordinal, node in zip(ordinals[bi], rows):
            mapping[bi, ordinal] = node
    return mapping


def values(node):
    # Native IDs can change when removed witnesses stop consuming IDs.
    return [(child.tag, child.attrib, child.text, tuple(values(child)))
            for child in node if child.tag.split('}')[-1] != 'NodeNumber']


def geometry(section, xyz):
    # Every emitted vector is independently verified against its source position.
    audit.cii_elements(section, xyz)
    rows = section['ELEMENTS']
    result = Counter()
    for offset in range(0, len(rows), 15):
        a, b, _, _, _, od = audit.fields(rows[offset])
        result[(xyz[int(a)], xyz[int(b)], od, rows[offset+10].strip())] += 1
    return result


def replace_detours(before, old_occurrences, groups):
    expected = before.copy()
    for bi, start, _ in groups:
        a, tip, center = [audit.position(old_occurrences[bi, start+j]) for j in (0, 1, 2)]
        inlet = [key for key, count in expected.items() if count and key[0] == a and key[1] == tip]
        assert len(inlet) == 1
        # Four original branch segments share the same endpoint coordinates.
        # Only remove the detour in the inlet's main-run branch; retain those
        # separately authored branch edges and their labels exactly.
        back = [key for key, count in expected.items() if count and key[0] == tip
                and key[1] == center and key[3] == inlet[0][3]]
        assert len(back) == 1
        expected[inlet[0]] -= 1
        expected[back[0]] -= 1
        expected[a, center, inlet[0][2], inlet[0][3]] += 1
    return +expected


def verify_runs(section, occurrences_by_source, groups):
    rows = section['ELEMENTS']
    by_nodes = {(int(v[0]), int(v[1])): v[2:5]
                for v in (audit.fields(rows[i]) for i in range(0, len(rows), 15))}
    witnesses = []
    for bi, start, group in groups:
        for left, right in ((0, 2), (2, 3)):
            a, b = [occurrences_by_source[bi, start+i] for i in (left, right)]
            ids = (int(audit.text(a, 'NodeNumber')), int(audit.text(b, 'NodeNumber')))
            p, q = [audit.position(group[i]) for i in (left, right)]
            expected = (q[0]-p[0], q[2]-p[2], p[1]-q[1])
            actual = by_nodes[ids]
            assert all(math.isclose(x, y, rel_tol=5e-6, abs_tol=1e-6) for x, y in zip(actual, expected))
            ref = audit.text(group[0], 'ComponentRefNo')
            if left == 0 and ref in {'=134234934/28025', '=134234934/18024'}:
                witnesses.append({'ref': ref, 'nodes': ids, 'actualCiiVectorMm': actual})
    assert len(witnesses) == 2
    return witnesses


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('source', 'packet', 'cii', 'baseline-packet', 'baseline-cii'):
        parser.add_argument('--' + key, type=Path, required=True)
    args = parser.parse_args()
    raw = args.source.read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    assert blob == '2008bbcc344ef48dde95addd6a72dc9e08aee56c'
    groups = tee_groups(ET.fromstring(raw))
    fixed, root, xyz, owners = audit.packet_data(args.packet)
    old, old_root, old_xyz, old_owners = audit.packet_data(args.baseline_packet)
    assert owners == old_owners and len(owners) == 139
    removed = {(bi, start+1) for bi, start, _ in groups}
    before = old['finalizedGeometry']['retainedSourceOrdinalsByBranch']
    after = fixed['finalizedGeometry']['retainedSourceOrdinalsByBranch']
    assert after == [[j for j in branch if (i, j) not in removed]
                     for i, branch in enumerate(before)]
    old_occ, new_occ = occurrences(old, old_root), occurrences(fixed, root)
    assert old_occ.keys() - new_occ.keys() == removed
    assert all(values(node) == values(old_occ[key]) for key, node in new_occ.items())
    s, old_s = audit.sections(args.cii), audit.sections(args.baseline_cii)
    actual, baseline = geometry(s, xyz), geometry(old_s, old_xyz)
    assert actual == replace_detours(baseline, old_occ, groups)
    assert sum(baseline.values()) == 816 and sum(actual.values()) == 785
    assert audit.restraints(s, xyz) == audit.restraints(old_s, old_xyz)
    assert sum(audit.restraints(s, xyz).values()) == 69
    for key in ('BEND', 'RIGID', 'SIF&TEES', 'REDUCERS'):
        assert s[key] == old_s[key], key + ' auxiliary payload drift'
    witnesses = verify_runs(s, new_occ, groups)
    # The source-authored B4110009 terminal at3120 remains attached exactly once.
    branch_end = new_occ[25, len(audit.nodes(audit.branches(ET.fromstring(raw))[25]))-1]
    assert audit.text(branch_end, 'NodeNumber') == '3120'
    assert audit.text(branch_end, 'ComponentType') == 'BRAN'
    degree = sum(count for key, count in actual.items()
                 if audit.position(branch_end) in key[:2])
    assert degree == 3
    print(json.dumps({'status': 'PASS', 'sourceGitBlob': blob,
        'teeGroups': 31, 'runVectorsVerified': 62,
        'baselineElements': 816, 'correctedElements': 785,
        'physicalOwnersUnchanged': 139, 'restraintSlotsUnchanged': 69,
        'otherSourceFieldsAndEdgesUnchanged': True,
        'rigidBendSifReducerPayloadsUnchanged': True,
        'actualBranch3120Degree': degree, 'witnesses': witnesses,
        'actualCiiSha256': hashlib.sha256(args.cii.read_bytes()).hexdigest(),
        'nativeImport': 'NOT_RUN'}, indent=2))


if __name__ == '__main__':
    main()
