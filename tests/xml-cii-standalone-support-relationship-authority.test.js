const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function unzipSingle(filePath) {
  const bytes = fs.readFileSync(filePath);
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert(eocd >= 0, `EOCD missing: ${filePath}`);
  const cdOffset = bytes.readUInt32LE(eocd + 16);
  assert.strictEqual(bytes.readUInt32LE(cdOffset), 0x02014b50);
  const method = bytes.readUInt16LE(cdOffset + 10);
  const compressedSize = bytes.readUInt32LE(cdOffset + 20);
  const localOffset = bytes.readUInt32LE(cdOffset + 42);
  assert.strictEqual(bytes.readUInt32LE(localOffset), 0x04034b50);
  const nameLength = bytes.readUInt16LE(localOffset + 26);
  const extraLength = bytes.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const payload = bytes.subarray(start, start + compressedSize);
  if (method === 0) return payload.toString('utf8');
  assert.strictEqual(method, 8, 'benchmark ZIP must use STORE or DEFLATE');
  return zlib.inflateRawSync(payload).toString('utf8');
}

function syntheticXml(branch, tag, position = '10 20 30') {
  return `<CAESARII><Branch><Branchname>${branch}</Branchname><Node><NodeNumber>10</NodeNumber><NodeName>${tag}</NodeName><ComponentType>ANCI</ComponentType><Position>${position}</Position></Node></Branch></CAESARII>`;
}

function stagedSupport(containerBranch, tag, attachment, position = { x: 10, y: 20, z: 30 }) {
  return {
    type: 'BRANCH',
    name: containerBranch,
    children: [{
      type: 'SUPPORT',
      name: `SUPPORT ${tag}`,
      attributes: {
        NAME: `/${tag}`,
        TYPE: 'ANCI',
        COMPRE: attachment,
        DTXR: 'REST',
        SUPPORT_KIND: 'REST',
        SUPPORT_MAPPER_KIND: 'REST',
        MDSSUPPFUNC: 'PIPE-REST',
        MDSSUPPTYPE: 'PIPE-REST',
        POS: position,
      },
    }],
  };
}

(async () => {
  const ledgerApi = await import(pathToFileURL(path.join(
    root,
    'tabs/xml-cii-2019-standalone/xml-cii-trace-resolution-ledger.js',
  )).href);

  const xml = unzipSingle(path.join(root, 'Benchmarks/GLRD-1000-PI-01.zip'));
  const staged = unzipSingle(path.join(root, 'Benchmarks/STF_2026Sep16-0859_managed_stage.zip'));
  const real = ledgerApi.buildStandaloneDtxrResolutionLedger(
    xml,
    staged,
    { resolverJsonTrace: { coordinateTolerance: 6 } },
  );

  const missing = real.records.find((row) => row.xmlNodeNumber === '3140');
  assert(missing, 'reported XML node 3140 must exist');
  assert.strictEqual(missing.xmlNodeName, 'PS00608.1');
  assert.strictEqual(missing.status, 'RESOLVED_PS_FALLBACK');
  assert.strictEqual(missing.effectiveDtxr, 'REST');
  assert.strictEqual(missing.fallbackAuthority, 'explicit-component-ref');
  assert.strictEqual(missing.fallbackReason, '');
  assert.strictEqual(missing.branchRelationship, 'exact');
  assert(missing.derivedSupportTypes.includes('REST'));

  const comparator = real.records.find((row) => row.xmlNodeNumber === '3420');
  assert(comparator, 'working comparator XML node 3420 must exist');
  assert.strictEqual(comparator.xmlNodeName, 'PS00573.1');
  assert(comparator.status.startsWith('RESOLVED_'));
  assert(comparator.derivedSupportTypes.includes('REST'));

  const xmlBranch = '/GLRD-1000-2"-B4110001-93833-01/B2';
  const conflictStaged = JSON.stringify([
    stagedSupport(xmlBranch, 'PS09999.1', '/GLRD-1000-2"-P4110009-93833-01/B1'),
  ]);
  const conflict = ledgerApi.buildStandaloneDtxrResolutionLedger(
    syntheticXml(xmlBranch, 'PS09999.1'),
    conflictStaged,
    { resolverJsonTrace: { coordinateTolerance: 6 } },
  ).records[0];
  assert.strictEqual(conflict.status, 'UNRESOLVED');
  assert.strictEqual(conflict.fallbackAuthority, 'explicit-component-ref');
  assert.strictEqual(conflict.fallbackReason, 'explicit-attachment-mismatch');
  assert.strictEqual(conflict.effectiveDtxr, '');

  const ambiguousStaged = JSON.stringify([
    stagedSupport('/A/B1', 'PS08888.1', xmlBranch, { x: 100, y: 200, z: 300 }),
    stagedSupport('/B/B1', 'PS08888.1', xmlBranch, { x: 400, y: 500, z: 600 }),
  ]);
  const ambiguous = ledgerApi.buildStandaloneDtxrResolutionLedger(
    syntheticXml(xmlBranch, 'PS08888.1'),
    ambiguousStaged,
    { resolverJsonTrace: { coordinateTolerance: 6 } },
  ).records[0];
  assert.strictEqual(ambiguous.status, 'AMBIGUOUS_REVIEW');
  assert.strictEqual(ambiguous.matchType, 'PS_AMBIGUOUS');
  assert.strictEqual(ambiguous.fallbackReason, 'multiple-compatible-explicit-attachments');
  assert.strictEqual(ambiguous.effectiveDtxr, '');

  console.log('XML CII standalone support relationship authority checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
