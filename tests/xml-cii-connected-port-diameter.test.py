"""Port-specific OD, original PL-BM1 source witnesses, and native CII fields."""
import dataclasses
import sys
import unittest
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'converters/scripts'))
import xml_to_cii2019 as base


class ConnectedPortDiameter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = ET.parse(ROOT / 'Benchmarks/XML-CII-2019/revamped/PL-BM1.xml')
        # Native parsing intentionally rejects unassigned negative source IDs.
        # Assign only those IDs in a temporary copy; no coordinate/OD edit.
        for i, node in enumerate(n for n in source.getroot().iter() if n.tag.split('}')[-1] == 'Node'):
            number = node.find('{*}NodeNumber')
            if number is not None and int(number.text) <= 0:
                number.text = str(200000 + i)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'numbered.xml'
            source.write(path)
            cls.document = base._parse_xml_document(path, preserve_finalized_geometry=True)

    def test_actual_pl_source_port_and_cii_element(self):
        # Original ordinals independently documented in #351; no new numbering
        # is needed to identify the original takeoff edge.
        parent = self.document.branches[0]
        child = self.document.branches[3]
        self.assertEqual(parent.nodes[449].component_type, 'OLET')
        self.assertEqual(parent.nodes[449].endpoint, 3)
        self.assertEqual(parent.nodes[450].endpoint, 0)
        self.assertEqual(child.nodes[0].outside_diameter, 60.3)
        self.assertEqual(child.nodes[0].position, parent.nodes[450].position)
        edges = base._build_edges(self.document.branches)
        edge = next(e for e in edges if e.from_node is parent.nodes[449]
                    and e.to_node is parent.nodes[450])
        self.assertEqual(base._element_outside_diameter(edge), 60.3)
        self.assertEqual(edge.from_node.outside_diameter, 323.8)
        self.assertEqual(edge.to_node.outside_diameter, 323.8)
        model = base._build_conversion_model(self.document)
        offset = model.edges.index(edge) * 15
        line = base._build_elements_payload(model)[offset]
        self.assertEqual(float(line[67:80]), 60.3)

    def branch_set(self, *, position=None, od=60.3, endpoint=1, duplicate=False):
        parent = self.document.branches[0]
        a, b = parent.nodes[449:451]
        a = dataclasses.replace(a, node_number=100)
        b = dataclasses.replace(b, node_number=110)
        child = dataclasses.replace(self.document.branches[3].nodes[0],
            node_number=110, position=position or b.position,
            outside_diameter=od, endpoint=endpoint)
        p = dataclasses.replace(parent, nodes=[a, b])
        c = dataclasses.replace(self.document.branches[3], nodes=[child])
        branches = [p, c]
        if duplicate:
            branches.append(dataclasses.replace(c, nodes=[dataclasses.replace(child, outside_diameter=88.9)]))
        return branches

    def test_other_position_or_nonport_does_not_resize_parent(self):
        for branches in [self.branch_set(position=(0, 0, 0)), self.branch_set(endpoint=2)]:
            edge = base._build_edges(branches)[0]
            self.assertEqual(base._element_outside_diameter(edge), 323.8)

    def test_main_run_and_different_component_are_unchanged(self):
        for change in [{'endpoint': 1}, {'component_ref_no': 'other'}, {'component_type': 'PIPE'}]:
            branches = self.branch_set()
            branches[0] = dataclasses.replace(branches[0], nodes=[
                dataclasses.replace(branches[0].nodes[0], **change), branches[0].nodes[1]])
            self.assertEqual(base._element_outside_diameter(base._build_edges(branches)[0]), 323.8)

    def test_conflicting_ports_at_same_node_fail_closed(self):
        with self.assertRaisesRegex(ValueError, 'AMBIGUOUS_OLET_PORT_DIAMETER'):
            base._build_edges(self.branch_set(duplicate=True))


if __name__ == '__main__':
    unittest.main()
