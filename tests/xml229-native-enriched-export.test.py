"""Actual native binding/export, with an explicit downstream writer fault."""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / 'converters/scripts'
SOURCE = ('<PipeStressExport><Pipe><Branch><Branchname>BR-1</Branchname>'
          '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
          '<Position>0 0 0</Position><Weight>0</Weight></Node>'
          '<Node><NodeNumber>20</NodeNumber><NodeName>WGT</NodeName>'
          '<ComponentType>RIGID</ComponentType><ComponentRefNo>REF-1</ComponentRefNo>'
          '<Endpoint>2</Endpoint><Position>100 0 0</Position><Rigid>2</Rigid>'
          '<Weight>0</Weight></Node></Branch></Pipe></PipeStressExport>')


class NativeEnrichedExport(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.folder = Path(self.directory.name)
        self.source = self.folder / 'source.xml'
        self.source.write_text(SOURCE)
        self.output = self.folder / 'output.cii'
        self.xml = self.folder / 'actual-enriched.xml'
        self.manifest = self.folder / 'packet.json'
        oid = json.dumps(['SOURCE', 0, 1, json.dumps(
            ['RIGID', 'REF-1', '2', 'WGT'], separators=(',', ':'))], separators=(',', ':'))
        self.packet = {'schema': 'XML229.NativeFinalPhysicalPacket.v1',
                       'sourceId': 'SOURCE', 'basisId': 'a' * 64,
                       'finalIntentSha256': 'b' * 64,
                       'sourceXmlSha256': hashlib.sha256(SOURCE.encode()).hexdigest(),
                       'physicalCount': 1, 'nativeCiiReleaseAuthorized': False,
                       'components': [{'occurrenceId': oid, 'effectiveKg': 12.5}]}

    def run_native(self, fault=False):
        self.manifest.write_text(json.dumps(self.packet))
        argv = ['--input', str(self.source), '--output', str(self.output),
                '--weight-scale', '10', '--xml229-native-final-packet', str(self.manifest),
                '--xml229-native-mass-proof', str(self.folder / 'proof.json'),
                '--enriched-output', str(self.xml)]
        if fault:
            # Explicit fault ONLY at CII serialization; XML/binding remain real.
            code = ('import sys;sys.path.insert(0, sys.argv.pop(1));'
                    'import xml_to_cii2019_runtime_custody as runtime;'
                    'runtime.base._build_cii_text=lambda *a,**k: '
                    '(_ for _ in ()).throw(ValueError("TEST_CII_WRITE_HELD"));'
                    'runtime.main()')
            cmd = [sys.executable, '-c', code, str(SCRIPTS), *argv]
        else:
            cmd = [sys.executable, str(SCRIPTS / 'xml_to_cii2019_runtime_custody.py'), *argv]
        return subprocess.run(cmd, cwd=self.folder, capture_output=True, text=True, timeout=30)

    def assert_actual_xml(self):
        root = ET.parse(self.xml).getroot()
        node = next(n for n in root.iter('Node') if n.findtext('NodeNumber') == '20')
        self.assertEqual(float(node.findtext('Weight')), 12.5)
        self.assertEqual(node.findtext('ComponentRefNo'), 'REF-1')
        self.assertEqual(node.findtext('Position'), '100 0 0')
        self.assertEqual(self.source.read_text(), SOURCE)

    def test_actual_final_masses_in_export(self):
        result = self.run_native()
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assert_actual_xml()
        self.assertTrue(self.output.exists())

    def test_later_cii_failure_retains_actual_xml(self):
        result = self.run_native(fault=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('TEST_CII_WRITE_HELD', result.stderr)
        self.assert_actual_xml()
        self.assertFalse(self.output.exists())

    def test_failed_binding_does_not_publish_xml(self):
        self.packet['sourceXmlSha256'] = '0' * 64
        result = self.run_native()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.xml.exists())
        self.assertFalse(self.output.exists())

    def test_export_cannot_overwrite_original(self):
        self.xml = self.source
        result = self.run_native()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('NATIVE_ENRICHED_OUTPUT_PATH_COLLISION', result.stderr)
        self.assertEqual(self.source.read_text(), SOURCE)


if __name__ == '__main__':
    unittest.main()
