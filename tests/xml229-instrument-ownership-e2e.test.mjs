/**
 * End-to-end regression test for XML229 Native CII Instrument Ownership.
 *
 * Verifies:
 * 1. Exact reproduction of NATIVE_RIGID_OWNER_UNSUPPORTED on real EF-05 14-instrument manifest.
 * 2. Source-level trace of all 14 instrument spans (branch, ordinals, refs, span 305mm).
 * 3. Audit-only blocker evidence export matches exact source and preflight findings.
 * 4. Refusal of PR #329 unsafe fallback (xml229NativeFinalPacket: null / bypass).
 * 5. Full native reconciliation when legitimate engineering source revision is provided:
 *    - Fresh source SHA
 *    - Fresh finalized geometry with 0 unsupported owners
 *    - Strict 1:1 actual CII mass reconciliation via reconcileXml229ActualCiiAgainstFinal.
 * 6. Partial classification refusal: any remaining unclassified instrument continues to block.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {
  inspectXml229NativeOwnerPreflight,
  requireXml229NativeOwnerPreflight,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-owner-preflight.mjs';
import {
  buildXml229NativeOwnerBlockerEvidence,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-owner-blocker-evidence.mjs';
import {
  reconcileXml229ActualCiiAgainstFinal,
} from '../converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const manifestUrl = new URL(
  '../docs/architecture/xml229-ef05-14-instrument-pending-approvals.json',
  import.meta.url
);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

const sourceId = 'EF-05-PRO-TEST-SOURCE';
const basisId = '1'.repeat(64);
const finalIntentSha256 = '2'.repeat(64);

function createFinalGeometry(unsupportedIndices = Array.from({length: 14}, (_, i) => i)) {
  const suggestions = manifest.components
    .filter((_, idx) => unsupportedIndices.includes(idx))
    .map(row => ({
      branchOccurrenceIndex: row.branchOccurrenceIndex,
      firstSourceNodeOrdinal: row.startSourceNodeOrdinal,
      secondSourceNodeOrdinal: row.endSourceNodeOrdinal,
      componentRefNo: row.componentRefNo,
      spanMm: row.spanMm,
      suggestedClassification: 'RIGID_CANDIDATE',
    }));
  return {
    schema: 'XML229.FinalizedWeightGeometry.v1',
    basisId,
    sourceXmlSha256: manifest.sourceXmlSha256,
    sha256: '3'.repeat(64),
    xmlText: '<PipeStressExport/>',
    instrumentModelingSuggestions: Object.freeze(suggestions),
  };
}

function createFinalPacket({
  geometry = createFinalGeometry(),
  acceptedIndices = Array.from({length: 14}, (_, i) => i),
  overrides = {},
} = {}) {
  const components = manifest.components
    .filter((_, idx) => acceptedIndices.includes(idx))
    .map(row => ({
      occurrenceId: JSON.stringify([
        sourceId,
        row.branchOccurrenceIndex,
        row.endSourceNodeOrdinal,
        JSON.stringify(['INST', row.componentRefNo, '2', '']),
      ]),
      effectiveKg: 25.0,
    }));
  return {
    schema: 'XML229.NativeFinalPhysicalPacket.v1',
    basisId,
    sourceId,
    sourceXmlSha256: manifest.sourceXmlSha256,
    finalIntentSha256,
    physicalCount: components.length,
    nativeCiiReleaseAuthorized: false,
    finalizedGeometry: geometry,
    components,
    ...overrides,
  };
}

test('Task 1 & 2: reproduce NATIVE_RIGID_OWNER_UNSUPPORTED and trace 14 instrument spans', () => {
  assert.equal(manifest.components.length, 14);
  const packet = createFinalPacket();

  // Preflight inspection detects all 14 unsupported owners
  const preflight = inspectXml229NativeOwnerPreflight(packet);
  assert.equal(preflight.status, 'UNSUPPORTED_OWNERS');
  assert.equal(preflight.unsupportedOwners.length, 14);
  assert.equal(preflight.sourceXmlSha256, manifest.sourceXmlSha256);

  // Exact trace verification across all 14 spans
  const expectedBranches = [2, 3, 4, 5, 7, 8, 9, 10, 15, 16, 17, 21, 23, 25];
  for (let i = 0; i < 14; i++) {
    const raw = manifest.components[i];
    const reported = preflight.unsupportedOwners[i];
    assert.equal(reported.branchOccurrenceIndex, raw.branchOccurrenceIndex);
    assert.equal(reported.branchOccurrenceIndex, expectedBranches[i]);
    assert.equal(reported.sourceNodeOrdinal, raw.endSourceNodeOrdinal);
    assert.equal(reported.componentType, 'INST');
    assert.equal(reported.componentRefNo, raw.componentRefNo);
    assert.equal(reported.spanMm, 305);
    assert.equal(reported.reason, 'INSTRUMENT_RIGID_CLASSIFICATION_NOT_IN_SOURCE');
  }

  // Preflight requirement fails closed
  assert.throws(
    () => requireXml229NativeOwnerPreflight(packet),
    (err) => {
      assert.equal(err.code, 'NATIVE_RIGID_OWNER_UNSUPPORTED');
      assert.equal(err.xml229NativeOwnerPreflight.unsupportedOwners.length, 14);
      return true;
    }
  );
});

test('Task 3 & 4: blocker evidence export preserves source fidelity and prohibits auto-classification', () => {
  const packet = createFinalPacket();
  const preflight = inspectXml229NativeOwnerPreflight(packet);
  const evidence = buildXml229NativeOwnerBlockerEvidence(preflight);

  assert.equal(evidence.schema, 'XML229.NativeOwnerBlockerEvidence.v1');
  assert.equal(evidence.status, 'GOVERNED_CII_HELD');
  assert.equal(evidence.sourceXmlSha256, manifest.sourceXmlSha256);
  assert.equal(evidence.unsupportedOwnerCount, 14);
  assert.equal(evidence.nativeCiiReleaseAuthorized, false);
  assert.equal(evidence.engineeringApprovalVerified, false);
  assert.equal(evidence.instrumentClassificationsApplied, false);

  // Blocker evidence is strictly audit-only; it must not contain classification approvals
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /"classification":\s*"RIGID"/);
  assert.doesNotMatch(serialized, /"status":\s*"APPROVED"/);
});

test('Task 5 & 6: partial revision blocks on remainder; legitimate full revision reconciles 1:1', async () => {
  // Scenario A: partial revision (only 4 of 14 classified as rigid)
  const remainingUnsupported = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // 10 remaining
  const partialGeom = createFinalGeometry(remainingUnsupported);
  const partialPacket = createFinalPacket({
    geometry: partialGeom,
    acceptedIndices: Array.from({length: 14}, (_, i) => i),
  });

  const partialPreflight = inspectXml229NativeOwnerPreflight(partialPacket);
  assert.equal(partialPreflight.status, 'UNSUPPORTED_OWNERS');
  assert.equal(partialPreflight.unsupportedOwners.length, 10);
  assert.throws(
    () => requireXml229NativeOwnerPreflight(partialPacket),
    {code: 'NATIVE_RIGID_OWNER_UNSUPPORTED'}
  );

  // Scenario B: fully revised source where an engineering authority classified all 14 as RIGID
  // In a valid revision, finalized geometry has NO suggestions (all 14 are already rigid in source XML)
  const revisedSourceXml = '<PipeStressExport><Branch><Node><Rigid>2</Rigid></Node></Branch></PipeStressExport>';
  const revisedSha = sha256(revisedSourceXml);
  const revisedBasisId = '4'.repeat(64);
  const revisedFinalGeom = {
    schema: 'XML229.FinalizedWeightGeometry.v1',
    basisId: revisedBasisId,
    sourceXmlSha256: revisedSha,
    sha256: '5'.repeat(64),
    xmlText: revisedSourceXml,
    instrumentModelingSuggestions: Object.freeze([]), // zero unclassified instrument blockers!
  };

  const revisedPacket = createFinalPacket({
    geometry: revisedFinalGeom,
    acceptedIndices: [0], // 1 owner for exact CII reconciliation test
    overrides: {
      basisId: revisedBasisId,
      sourceXmlSha256: revisedSha,
      physicalCount: 1,
    },
  });

  // Preflight PASSES cleanly on legitimately revised source
  const passedPreflight = requireXml229NativeOwnerPreflight(revisedPacket);
  assert.equal(passedPreflight.status, 'NO_SUGGESTED_INSTRUMENT_BLOCKERS');
  assert.equal(passedPreflight.unsupportedOwners.length, 0);

  // Independent emitted-CII reconciliation verification (Task 6)
  const targetOid = revisedPacket.components[0].occurrenceId;
  const massKg = 25.0;
  const forceN = massKg * 10.0; // 250 N

  // Synthesize exact CAESAR II 2019 neutral format with 1 rigid element
  const ciiElements = [
    '10 20 0 0 0 0', ...Array(11).fill('0 0 0 0 0 0'),
    '0 1 0 0 0 0', '0 0 0 0 0 0', '0 0 0',
  ];
  const ciiText = [
    '#$ CONTROL',
    '1 0 0 0 0 0',
    '0 1 0 0 0 0',
    '0 0 0 0 0 0',
    '0',
    '#$ ELEMENTS',
    ciiElements.join('\n'),
    '#$ RIGID',
    `${forceN.toFixed(1)} 0`,
    '#$ UNITS',
    'N.',
    '',
  ].join('\n');

  const writerDiagnostic = {
    schema: 'XML229.NativeRigidConsumptionDiagnostic.v1',
    sourcePhysicalCount: 1,
    claimedNativeRigidCount: 1,
    outputRigidCount: 1,
    nativeCiiReleaseAuthorized: false,
    massesConsumedInNativeRigid: true,
    actualCiiSha256: sha256(ciiText),
    finalizedGeometrySha256: revisedFinalGeom.sha256,
    claims: [
      {
        occurrenceId: targetOid,
        rigidRecordIndex: 0,
        nativeElementIndex: 0,
        ciiFromNode: '10',
        ciiToNode: '20',
        massKg,
        emittedForceN: forceN,
        branchOccurrenceIndex: manifest.components[0].branchOccurrenceIndex,
        engineNodeOrdinal: manifest.components[0].endSourceNodeOrdinal,
      },
    ],
  };

  const reconProof = await reconcileXml229ActualCiiAgainstFinal({
    originalXmlText: revisedSourceXml,
    packet: revisedPacket,
    ciiText,
    writerDiagnostic,
  });

  assert.equal(reconProof.massConsumptionVerified, true);
  assert.equal(reconProof.strictOneToOneOwnerMatch, true);
  assert.equal(reconProof.nativeCiiReleaseAuthorized, true);
  assert.equal(reconProof.physicalCount, 1);
  assert.equal(reconProof.nativeRigidCount, 1);
  assert.equal(reconProof.actualCiiSha256, sha256(ciiText));
});

test('Task 7: non-negotiable constraints: reject silent transfer, altered source, or forged release', async () => {
  // Attempting to reuse an old packet on a new source SHA fails closed
  const packetOldSha = createFinalPacket();
  const alteredSourceXml = '<PipeStressExport><Modified/></PipeStressExport>';

  await assert.rejects(
    reconcileXml229ActualCiiAgainstFinal({
      originalXmlText: alteredSourceXml,
      packet: packetOldSha,
      ciiText: '#$ CONTROL\n1\n',
      writerDiagnostic: {},
    }),
    {code: 'NATIVE_SOURCE_XML_SHA_DRIFT'}
  );
});
