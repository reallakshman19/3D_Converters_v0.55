"""Independent source/actual-CII audit for the BM2 OLET helper repair.

Run after production Worker/native conversion, with baseline and corrected
packet/CII paths. Does not import the cleanup selector or native writer.
Controlled test Final values are not Owner acceptance or native import approval.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET


def text(node, key):
    return (node.findtext('{*}' + key) or '').strip()


def branches(root):
    return [n for n in root.iter() if n.tag.split('}')[-1] == 'Branch']


def nodes(branch):
    return [n for n in branch if n.tag.split('}')[-1] == 'Node']


def position(node):
    return tuple(map(float, text(node, 'Position').split()))


def source_helpers(root):
    found, junctions, tips = set(), set(), []
    witnesses = {'=134234934/29482', '=134234934/29481', '=134234934/28795'}
    for bi, branch in enumerate(branches(root)):
        rows = nodes(branch)
        for i, center in enumerate(rows):
            if text(center, 'ComponentType') != 'OLET' or text(center, 'Endpoint') != '0':
                continue
            group = rows[i-2:i+2]
            assert len(group) == 4
            assert [text(n, 'Endpoint') for n in group] == ['1', '3', '0', '2']
            assert all(text(n, 'ComponentRefNo') == text(center, 'ComponentRefNo') for n in group)
            assert position(group[0]) == position(center) == position(group[3])
            assert int(text(center, 'NodeNumber')) > 0
            junctions.add(int(text(center, 'NodeNumber')))
            for j in (0, 1, 3):
                assert text(group[j], 'NodeNumber') == '-1'
                assert not group[j].findall('{*}Restraint')
                assert float(text(group[j], 'Weight') or 0) == 0
                found.add((bi, i-2+j))
            if text(center, 'ComponentRefNo') in witnesses:
                tips.append(position(group[1]))
    assert len(found) == 147 and len(junctions) == 49 and len(tips) == 3
    return found, junctions, tips


def sections(path):
    out, current = {}, None
    for line in path.read_text().splitlines():
        if line.startswith('#$ '):
            current = line[3:].strip()
            assert current not in out
            out[current] = []
        elif current and line.strip():
            out[current].append(line)
    return out


def fields(line):
    assert len(line) == 80
    return [float(line[:15])] + [float(line[i:i+13]) for i in range(15, 80, 13)]


def cii_elements(section, xyz):
    rows = section['ELEMENTS']
    assert len(rows) % 15 == 0
    output = []
    for offset in range(0, len(rows), 15):
        a, b, dx, dy, dz, od = fields(rows[offset])
        a, b = int(a), int(b)
        first, second = xyz[a], xyz[b]
        delta = [second[i]-first[i] for i in range(3)]
        # Governing XML XYZ -> CII X,Z,-Y axis convention; source positions
        # remain unchanged. Fixed CII number formatting uses six significant digits.
        expected = [delta[0], delta[2], -delta[1]]
        assert all(math.isclose(x, y, rel_tol=5e-6, abs_tol=1e-6)
                   for x, y in zip([dx, dy, dz], expected))
        output.append((a, b, od, rows[offset+10].strip()))
    assert int(section['CONTROL'][0].split()[0]) == len(output)
    return output


def packet_data(path):
    packet = json.loads(path.read_text())
    root = ET.fromstring(packet['finalizedGeometry']['xmlText'])
    xyz = {}
    for branch in branches(root):
        for node in nodes(branch):
            number = int(text(node, 'NodeNumber'))
            if number in xyz:
                assert xyz[number] == position(node)
            xyz[number] = position(node)
    owners = sorted((json.dumps(json.loads(c['occurrenceId'])[1:]), c['effectiveKg'])
                    for c in packet['components'])
    return packet, root, xyz, owners


def restraints(section, xyz):
    rows, found = section['RESTRANT'], []
    assert len(rows) % 24 == 0
    for offset in range(0, len(rows), 4):
        values = fields(rows[offset])
        if values[1] == 0:
            continue
        number = int(values[0])
        found.append((xyz[number], tuple(values[1:]), tuple(rows[offset+1:offset+4])))
    return Counter(found)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'packet', 'cii', 'baseline-packet', 'baseline-cii'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    raw = args.source.read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    assert blob == '2008bbcc344ef48dde95addd6a72dc9e08aee56c'
    helpers, junctions, tips = source_helpers(ET.fromstring(raw))
    fixed, root, xyz, owners = packet_data(args.packet)
    old, old_root, old_xyz, old_owners = packet_data(args.baseline_packet)
    assert owners == old_owners and len(owners) == 139
    before = old['finalizedGeometry']['retainedSourceOrdinalsByBranch']
    after = fixed['finalizedGeometry']['retainedSourceOrdinalsByBranch']
    assert after == [[j for j in branch if (i, j) not in helpers]
                     for i, branch in enumerate(before)]
    assert junctions.issubset(xyz)
    s, old_s = sections(args.cii), sections(args.baseline_cii)
    edges, old_edges = cii_elements(s, xyz), cii_elements(old_s, old_xyz)
    assert len(old_edges)-len(edges) == 147
    used = {n for a, b, _, _ in edges for n in (a, b)}
    assert junctions.issubset(used)
    assert all(tip not in {xyz[n] for n in used} for tip in tips)
    assert any(a == 300 and od == 60.3 and 'P4110028' in label
               for a, b, od, label in edges)
    assert any((a == 300 or b == 300) and od == 168.3 and 'P4110001' in label
               for a, b, od, label in edges)
    support_rows = restraints(s, xyz)
    assert support_rows == restraints(old_s, old_xyz)
    print(json.dumps({'status': 'PASS', 'sourceGitBlob': blob,
        'excludedHelpers': len(helpers), 'retainedJunctions': len(junctions),
        'baselineElements': len(old_edges), 'correctedElements': len(edges),
        'physicalOwnersUnchanged': len(owners), 'restraintSlotsUnchanged': sum(support_rows.values()),
        'threeHelperTipsAbsent': True, 'junction300ChildOD': 60.3,
        'junction300MainOD': 168.3, 'nativeImport': 'NOT_RUN'}, indent=2))


if __name__ == '__main__':
    main()
