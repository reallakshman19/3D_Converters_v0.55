"""Independent native assertions for the real JS Preview/Worker packet.

Invoked by xml229-json-restraint-body-transfer.test.mjs with controlled inputs;
expected types/gaps are analytical constants, not copied from the candidate.
"""
from copy import deepcopy
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'converters/scripts'))
from xml229_native_final_mass_binding import NativeMassError, stage_native_original_lineage

folder = Path(sys.argv[1])
source = folder / 'source.xml'
staged = folder / 'staged.json'
manifest = folder / 'packet.json'
config = json.loads((folder / 'config.json').read_text())
packet = json.loads(manifest.read_text())
raw = staged.read_bytes()


def write_packet(value):
    value = deepcopy(value)
    final = value['finalizedGeometry']
    final['sha256'] = hashlib.sha256(final['xmlText'].encode()).hexdigest()
    manifest.write_text(json.dumps(value))


def challenge(value, cfg=config, staged_path=staged, code='NATIVE_FINALIZED_GEOMETRY_SOURCE_DRIFT'):
    write_packet(value)
    try:
        stage_native_original_lineage(source, manifest, staged_path, cfg)
    except NativeMassError as error:
        assert error.code == code, (error.code, code)
    else:
        raise AssertionError('Forged pre-Final support data was accepted')


# Keep the existing entire-source comparison: even a recomputed finalized SHA
# cannot authorize an invented type/gap, material, position, or extra restraint.
for before, after in [('<Gap>6</Gap>', '<Gap>9</Gap>'),
                      ('<Type>GUI</Type>', '<Type>+Y</Type>'),
                      ('<Position>300 0 0</Position>', '<Position>300 2 0</Position>'),
                      ('<OutsideDiameter>60.3</OutsideDiameter>', '<OutsideDiameter>99</OutsideDiameter>')]:
    changed = deepcopy(packet)
    assert before in changed['finalizedGeometry']['xmlText']
    changed['finalizedGeometry']['xmlText'] = changed['finalizedGeometry']['xmlText'].replace(before, after, 1)
    challenge(changed)
challenge(packet, {**config, 'defaultGap': 9})
challenge(packet, {**config, 'defaultFriction': .3})
challenge(packet, {**config, 'defaultStiffness': 987})
challenge(packet, staged_path=None, code='NATIVE_PREFINAL_RESTRAINT_SOURCE_SHA_DRIFT')
staged.write_bytes(raw + b' ')
challenge(packet, code='NATIVE_PREFINAL_RESTRAINT_SOURCE_SHA_DRIFT')
staged.write_bytes(raw)
changed = deepcopy(packet)
changed['originalJsonSha256'] = 'f' * 64
challenge(changed, code='NATIVE_PREFINAL_RESTRAINT_SOURCE_SHA_DRIFT')


def native(kg):
    current = deepcopy(packet)
    current['components'][0]['effectiveKg'] = kg
    write_packet(current)
    output, enriched = folder / 'output.cii', folder / 'enriched.xml'
    cmd = [sys.executable, str(ROOT / 'converters/scripts/xml_to_cii2019_runtime_custody.py'),
           '--input', str(source), '--staged-json', str(staged), '--output', str(output),
           '--support-config-json', json.dumps(config), '--weight-scale', '10',
           '--xml229-native-final-packet', str(manifest),
           '--xml229-native-mass-proof', str(folder / 'proof.json'),
           '--enriched-output', str(enriched)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    nodes = {int(n.findtext('NodeNumber')): n for n in ET.parse(enriched).iter('Node')}
    assert float(nodes[20].findtext('Weight')) == kg
    assert nodes[40].findtext('Position') == '300 0 0'
    expected = {30: ('+Y', 7), 40: ('GUI', 6), 50: ('LIM', 8), 60: ('+Y', 7)}
    for number, (typ, gap) in expected.items():
        restraint = nodes[number].find('Restraint')
        assert restraint.findtext('Type') == typ
        assert float(restraint.findtext('Gap')) == gap
        assert float(restraint.findtext('Stiffness')) == 123456
    assert float(nodes[30].find('Restraint').findtext('Friction')) == 0
    # RESTRANT is four lines per slot; node/type/stiffness/gap/friction are
    # read directly from emitted CII, not reconstructed from native objects.
    lines = output.read_text().split('#$ RESTRANT\n')[1].split('#$')[0].splitlines()
    actual = {int(row[0]): row for i in range(0, len(lines), 4)
              if (row := list(map(float, lines[i].split())))[0]}
    assert set(actual) == {30, 40, 50, 60}
    for number, code, gap in [(30, 14, 7), (40, 8, 6), (50, 9, 8), (60, 14, 7)]:
        assert actual[number][1:5] == [code, 123456, gap, 0]
    proof = json.loads((folder / 'proof.json').read_text())
    assert len(proof['claims']) == 1
    assert proof['claims'][0]['massKg'] == kg
    assert proof['claims'][0]['emittedForceN'] == kg * 10


native(12.5)
native(0)  # Explicit controlled Final zero is retained, never auto replaced.
print('SOURCE_JSON_NATIVE_TRANSFER_PASS: XML, CII, Final12.5/0; 11 tamper challenges held')
