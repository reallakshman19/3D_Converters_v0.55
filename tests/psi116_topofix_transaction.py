from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest
import json
import copy
from hashlib import sha256
import xml.etree.ElementTree as ET

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from converters.psi116_topology_resolver import ResolverConfig, resolve_psi116
from converters.psi116_topology_resolver.lineage import (
    TopoFixLineageError, build_topofix_source_lineage, verify_topofix_pre_final,
)
from converters.psi116_topology_resolver.transaction import (
    TransactionPolicy,
    apply_topofix_transaction,
    write_topofix_outputs,
)

SYNTHETIC_XML = '''<?xml version="1.0"?>
<PipeStressExport xmlns="http://aveva.com/pipeStress116.xsd">
  <Pipe><Branch><Branchname>/A</Branchname>
    <Node><NodeNumber>10</NodeNumber><NodeName></NodeName><Endpoint>0</Endpoint><Rigid>0</Rigid><ComponentType>PIPE</ComponentType><Weight>0</Weight><ComponentRefNo>PIPE-A</ComponentRefNo><OutsideDiameter>100</OutsideDiameter><WallThickness>5</WallThickness><Position>0 0 0</Position></Node>
    <Node><NodeNumber>20</NodeNumber><NodeName></NodeName><Endpoint>0</Endpoint><Rigid>0</Rigid><ComponentType>ELBO</ComponentType><Weight>0</Weight><ComponentRefNo>=E1</ComponentRefNo><OutsideDiameter>100</OutsideDiameter><WallThickness>5</WallThickness><Position>0 0 0</Position><BendRadius>150</BendRadius></Node>
    <Node><NodeNumber>30</NodeNumber><NodeName></NodeName><Endpoint>0</Endpoint><Rigid>0</Rigid><ComponentType>PIPE</ComponentType><Weight>0</Weight><ComponentRefNo>PIPE-B</ComponentRefNo><OutsideDiameter>100</OutsideDiameter><WallThickness>5</WallThickness><Position>100 0 0</Position></Node>
  </Branch></Pipe>
  <Pipe><Branch><Branchname>/B</Branchname>
    <Node><NodeNumber>50</NodeNumber><NodeName></NodeName><Endpoint>2</Endpoint><Rigid>0</Rigid><ComponentType>REDU</ComponentType><Weight>0</Weight><ComponentRefNo>=R1</ComponentRefNo><OutsideDiameter>150</OutsideDiameter><WallThickness>6</WallThickness><Position>0 0 0</Position><AlphaAngle>10</AlphaAngle></Node>
    <Node><NodeNumber>60</NodeNumber><NodeName></NodeName><Endpoint>0</Endpoint><Rigid>0</Rigid><ComponentType>PIPE</ComponentType><Weight>0</Weight><ComponentRefNo>PIPE-C</ComponentRefNo><OutsideDiameter>150</OutsideDiameter><WallThickness>6</WallThickness><Position>0 100 0</Position></Node>
  </Branch></Pipe>
</PipeStressExport>'''


def action_for_nodes(result, disposition, numbers):
    expected = set(numbers)
    return next(action for action in result.fix_actions if action.disposition == disposition and set(action.node_numbers) == expected)


def local_name(tag):
    return tag.rsplit('}', 1)[-1]


def node_numbers(xml_text):
    root = ET.fromstring(xml_text)
    return [
        int((next(child for child in node if local_name(child.tag) == 'NodeNumber').text or '0').strip())
        for node in root.iter() if local_name(node.tag) == 'Node'
    ]


class Psi116TopoFixTransactionTests(unittest.TestCase):
    def test_path_and_memory_keep_exact_source_bytes_and_replay_receipts(self):
        lf = SYNTHETIC_XML.replace("\r\n", "\n").replace("\r", "\n")
        unicode_xml = lf.replace("</PipeStressExport>", "<!-- café Δ -->\n</PipeStressExport>")
        variants = {"lf": lf, "crlf": lf.replace("\n", "\r\n"),
                    "cr": lf.replace("\n", "\r"),
                    "mixed": lf.replace("\n", "\r\n", 3),
                    "bom_unicode": "\ufeff" + unicode_xml.replace("\n", "\r\n")}
        with tempfile.TemporaryDirectory() as folder:
            for label, original in variants.items():
                with self.subTest(format=label):
                    raw = original.encode("utf-8")
                    path = Path(folder) / (label + ".xml")
                    path.write_bytes(raw)
                    memory = resolve_psi116(original, source_name=str(path))
                    disk = resolve_psi116(path)
                    expected = sha256(raw).hexdigest()
                    self.assertEqual(disk.document.source_text, original)
                    self.assertEqual(disk.document.source_sha256, expected)
                    self.assertEqual(memory.document.source_sha256, expected)
                    self.assertEqual(disk.fix_plan_payload(ResolverConfig()),
                                     memory.fix_plan_payload(ResolverConfig()))
                    action = action_for_nodes(disk, 'ALIAS_COINCIDENT_NODE', {10, 20, 50})
                    tx = apply_topofix_transaction(disk, policy=TransactionPolicy(
                        selected_action_ids=(action.action_id,)))
                    self.assertTrue(tx.committed, tx.reject_reasons)
                    lineage = build_topofix_source_lineage(tx)
                    receipt = verify_topofix_pre_final(original, tx.fixed_xml,
                        tx.transaction_payload(), tx.validation_payload(), lineage,
                        reviewed_action_ids=(action.action_id,))
                    self.assertEqual(lineage['sourceXmlSha256'], expected)
                    self.assertEqual(receipt['originalSourceXmlSha256'], expected)
                    self.assertEqual(path.read_bytes(), raw)

    def test_explicit_alias_action_commits_without_deleting_component_records(self):
        result = resolve_psi116(SYNTHETIC_XML, source_name='synthetic.xml')
        action = action_for_nodes(result, 'ALIAS_COINCIDENT_NODE', {10, 20, 50})
        transaction = apply_topofix_transaction(
            result,
            policy=TransactionPolicy(selected_action_ids=(action.action_id,)),
        )
        self.assertTrue(transaction.committed, transaction.reject_reasons)
        self.assertEqual(len(transaction.operations), 2)
        self.assertTrue(all(operation.operation == 'ALIAS_NODE_NUMBER' for operation in transaction.operations))
        numbers = node_numbers(transaction.fixed_xml or '')
        self.assertNotIn(10, numbers)
        self.assertNotIn(50, numbers)
        self.assertEqual(numbers.count(20), 3)
        self.assertEqual(transaction.source_result.document.source_text, SYNTHETIC_XML)
        self.assertTrue(all(check.passed for check in transaction.checks if check.blocking))


    def test_l2_verified_alias_preserves_source_ordinals(self):
        result=resolve_psi116(SYNTHETIC_XML,source_name='synthetic.xml')
        action=action_for_nodes(result,'ALIAS_COINCIDENT_NODE',{10,20,50})
        tx=apply_topofix_transaction(result,policy=TransactionPolicy(
            selected_action_ids=(action.action_id,)))
        self.assertTrue(tx.committed,tx.reject_reasons)
        lineage=build_topofix_source_lineage(tx)
        qualified=verify_topofix_pre_final(
            SYNTHETIC_XML,tx.fixed_xml,tx.transaction_payload(),
            tx.validation_payload(),lineage,reviewed_action_ids=(action.action_id,))
        self.assertEqual(lineage['counts']['sourceNodeOccurrences'],5)
        self.assertEqual(lineage['counts']['fixedNodeOccurrences'],5)
        self.assertEqual(lineage['counts']['changedRetainedOccurrences'],2)
        self.assertEqual(sum(row['status']=='RENUMBERED_CONNECTION'
                             for row in lineage['sourceOccurrenceMap']),2)
        self.assertEqual(len({(row['branchOccurrenceIndex'],row['sourceNodeOrdinal'])
                              for row in lineage['sourceOccurrenceMap']}),5)
        self.assertFalse(qualified['nativeCiiReleaseAuthorized'])
        self.assertTrue(qualified['requiresFreshWorkerBasis'])
        self.assertFalse(qualified['acceptedFinalTransferred'])

    def test_l2_real_firstpass_safe_drop_preserves_lossless_receipt(self):
        result=resolve_psi116(REPO_ROOT/'Benchmarks'/'1885Sjson'/'FirstpassXML')
        drop=action_for_nodes(result,'SAFE_DROP_PIPE_GEOMETRY',{1600,1610})
        alias=action_for_nodes(result,'ALIAS_COINCIDENT_NODE',{1570,2260})
        selected=(drop.action_id,alias.action_id)
        tx=apply_topofix_transaction(result,policy=TransactionPolicy(
            selected_action_ids=selected))
        self.assertTrue(tx.committed,tx.reject_reasons)
        lineage=build_topofix_source_lineage(tx)
        receipt=verify_topofix_pre_final(
            result.document.source_text,tx.fixed_xml,tx.transaction_payload(),
            tx.validation_payload(),lineage,reviewed_action_ids=selected)
        self.assertEqual(lineage['counts']['sourceNodeOccurrences'],216)
        self.assertEqual(lineage['counts']['fixedNodeOccurrences'],215)
        self.assertEqual(lineage['counts']['removedPlainPipeOccurrences'],1)
        self.assertEqual(sum(row['status']=='REMOVED_PLAIN_PIPE'
                             for row in lineage['sourceOccurrenceMap']),1)
        self.assertEqual(receipt['newSourceXmlSha256'],lineage['fixedXmlSha256'])
        self.assertNotEqual(receipt['originalSourceXmlSha256'],receipt['newSourceXmlSha256'])

    def test_l2_rejects_stale_final_and_tampered_provenance(self):
        result=resolve_psi116(SYNTHETIC_XML,source_name='synthetic.xml')
        action=action_for_nodes(result,'ALIAS_COINCIDENT_NODE',{10,20,50})
        tx=apply_topofix_transaction(result,policy=TransactionPolicy(
            selected_action_ids=(action.action_id,)))
        self.assertTrue(tx.committed)
        inputs={'original_xml':SYNTHETIC_XML,'fixed_xml':tx.fixed_xml,
                'transaction_receipt':tx.transaction_payload(),
                'validation_receipt':tx.validation_payload(),
                'lineage_receipt':build_topofix_source_lineage(tx),
                'reviewed_action_ids':(action.action_id,)}
        def bad(code,**kwargs):
            received={**inputs,**kwargs}
            with self.assertRaises(TopoFixLineageError) as e:
                verify_topofix_pre_final(**received)
            self.assertIn(e.exception.code,code if isinstance(code,tuple) else (code,))
        bad('TOPOFIX_REQUIRES_FRESH_FINAL_BASIS',existing_final_intent_sha256='f'*64)
        bad('TOPOFIX_REQUIRES_FRESH_FINAL_BASIS',existing_worker_basis_id='b'*64)
        bad('TOPOFIX_LINEAGE_REVIEW_REQUIRED',reviewed_action_ids=('OTHER',))
        bad('TOPOFIX_LINEAGE_FIXED_XML_DRIFT',
            fixed_xml=tx.fixed_xml.replace('<NodeNumber>20</NodeNumber>',
                                           '<NodeNumber>999</NodeNumber>',1))
        wrong=copy.deepcopy(inputs['transaction_receipt'])
        wrong['operations'][0]['after']=987
        bad('TOPOFIX_LINEAGE_TRANSACTION_REPLAY_DRIFT',transaction_receipt=wrong)
        wrong=copy.deepcopy(inputs['validation_receipt'])
        wrong['checks'][0]['passed']=False
        bad('TOPOFIX_LINEAGE_VALIDATION_REPLAY_DRIFT',validation_receipt=wrong)
        wrong=copy.deepcopy(inputs['lineage_receipt'])
        wrong['sourceOccurrenceMap'][0]['fixedNodeOrdinal']=1000
        bad('TOPOFIX_LINEAGE_RECEIPT_DRIFT',lineage_receipt=wrong)
        bad(('TOPOFIX_LINEAGE_FIXED_XML_DRIFT','TOPOFIX_LINEAGE_REPLAY_REJECTED','TOPOFIX_LINEAGE_TRANSACTION_REPLAY_DRIFT','TOPOFIX_LINEAGE_POLICY_INVALID'),
            original_xml=SYNTHETIC_XML.replace('<Weight>0</Weight>',
                                                '<Weight>99</Weight>',1))

    def test_transaction_requires_explicit_selection(self):
        result = resolve_psi116(SYNTHETIC_XML, source_name='synthetic.xml')
        with self.assertRaises(ValueError):
            apply_topofix_transaction(result, policy=TransactionPolicy())

    def test_outputs_emit_xml_only_for_committed_transaction(self):
        result = resolve_psi116(SYNTHETIC_XML, source_name='synthetic.xml')
        action = action_for_nodes(result, 'ALIAS_COINCIDENT_NODE', {10, 20, 50})
        transaction = apply_topofix_transaction(
            result,
            policy=TransactionPolicy(selected_action_ids=(action.action_id,)),
        )
        with tempfile.TemporaryDirectory() as directory:
            transaction_path, validation_path, fixed_path = write_topofix_outputs(transaction, directory, stem='case')
            self.assertTrue(transaction_path.is_file())
            self.assertTrue(validation_path.is_file())
            self.assertIsNotNone(fixed_path)
            self.assertTrue(Path(fixed_path).is_file())
            self.assertTrue((Path(directory)/'case.topofix-lineage.json').is_file())

    def test_real_1885_selected_aliases_commit_and_preserve_engineering_inventory(self):
        fixture = Path(__file__).resolve().parents[1] / 'Benchmarks' / '1885Sjson' / 'FirstpassXML'
        source_before = fixture.read_text(encoding='utf-8')
        result = resolve_psi116(fixture)
        elbow_contract = action_for_nodes(result, 'SAFE_DROP_PIPE_GEOMETRY', {1600, 1610})
        cross_branch = action_for_nodes(result, 'ALIAS_COINCIDENT_NODE', {1570, 2260})
        transaction = apply_topofix_transaction(
            result,
            policy=TransactionPolicy(selected_action_ids=(cross_branch.action_id, elbow_contract.action_id)),
            config=ResolverConfig(),
        )
        self.assertTrue(transaction.committed, transaction.reject_reasons)
        self.assertEqual(fixture.read_text(encoding='utf-8'), source_before)
        self.assertEqual(
            {operation.operation for operation in transaction.operations},
            {'ALIAS_NODE_NUMBER', 'REMOVE_PLAIN_PIPE_NODE_RECORD'},
        )
        numbers = node_numbers(transaction.fixed_xml or '')
        self.assertNotIn(1600, numbers)
        self.assertNotIn(2260, numbers)
        self.assertGreaterEqual(numbers.count(1570), 2)
        self.assertGreaterEqual(numbers.count(1610), 1)
        checks = {check.code: check for check in transaction.checks}
        self.assertTrue(checks['SPECIAL_COMPONENT_OCCURRENCES_PRESERVED'].passed)
        self.assertTrue(checks['RESTRAINT_COUNT_PRESERVED'].passed)
        self.assertTrue(checks['WEIGHT_SUM_PRESERVED'].passed)
        self.assertTrue(checks['SELECTED_FINDINGS_RESOLVED'].passed)


if __name__ == '__main__':
    unittest.main()
