import assert from 'node:assert/strict';
import test from 'node:test';
import { installWeightBasisXmlDom } from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import { extractXmlCiiParityAuthorityEntries, compareXmlCiiParityAuthorityEntries, createStandaloneRunParityEvidence } from '../tabs/xml-cii-2019-standalone/xml-cii-run-parity-evidence.js';
import { applyStandaloneProcessParity } from '../tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js';

installWeightBasisXmlDom(globalThis);
// Reduced original branch/node facts from PL-01_XML.xml and PL-06_XML.xml.
// The combined document offsets the PL-06 positives by 200000 and preserves -1 helpers.
const pl01 = '/ASIM-1885-PL-8"-S8810104-HOT-01/B2';
const pl06 = '/ASIM-1885-PL-10"-S8810105-HOT-01/B3';
function node(number, ref, endpoint, position, component, rating = '900', pipingClass = 'S8810105') {
  return '<Node><NodeNumber>' + number + '</NodeNumber><ComponentRefNo>' + ref
    + '</ComponentRefNo><Endpoint>' + endpoint + '</Endpoint><Position>' + position
    + '</Position><ComponentType>' + component + '</ComponentType><PipingClass>' + pipingClass + '</PipingClass>'
    + '<Rating>' + rating + '</Rating><BoreMm>300</BoreMm><CorrosionAllowance>0</CorrosionAllowance></Node>';
}
function branch(name, nodes) {
  return '<Pipe><Branch><Branchname>' + name + '</Branchname>' + nodes.join('') + '</Branch></Pipe>';
}
const first = node('10', '=1006649755/1898', '1', '596080.15 -1122803.20 102409.55', 'FLAN', '900', 'S8810104');
const numbered = node('200010', '=1006649755/1750', '1', '803427.00 -1140678.00 98762.35', 'BRAN');
const negative1 = node('-1', '=1006657947/24', '1', '803427.00 -1134477.00 98736.95', 'ELBO');
const negative2 = node('-1', '=1006657947/24', '2', '803808.00 -1134096.00 98736.95', 'ELBO');
const xml = '<PipeStressExport xmlns="http://aveva.com/pipeStress116.xsd">'
  + branch(pl01, [first]) + branch(pl06, [numbered, negative1, negative2]) + '</PipeStressExport>';
const signature = (...values) => values.join('\u001f');
const identities = [
  { number: '200010', ordinal: 0,
    identity: signature('200010', '=1006649755/1750', '1', '803427.00 -1140678.00 98762.35', 'BRAN') },
  { number: '-1', ordinal: 1,
    identity: signature('-1', '=1006657947/24', '1', '803427.00 -1134477.00 98736.95', 'ELBO') },
  { number: '-1', ordinal: 2,
    identity: signature('-1', '=1006657947/24', '2', '803808.00 -1134096.00 98736.95', 'ELBO') },
];
function entry(info, field = 'Rating', expected = '900') {
  return {
    scope: 'node', branchName: pl06, branchOccurrenceIndex: 1, nodeOrdinal: info.ordinal,
    nodeNumber: info.number, nodeSignature: info.identity,
    nodeKey: pl06 + '::' + (info.number === '-1' ? '-1' : '10'),
    path: [field], field: field.toLowerCase(), expected,
    kind: field === 'BoreMm' ? 'number' : 'text', source: 'standalone-preview',
  };
}

test('RED: combined Mode B verifies offset and duplicate negative nodes by occurrence', () => {
  const expected = identities.flatMap(info => [
    entry(info, 'PipingClass', 'S8810105'), entry(info, 'Rating', '900'),
    entry(info, 'BoreMm', '300'), entry(info, 'CorrosionAllowance', '0'),
  ]);
  const actual = extractXmlCiiParityAuthorityEntries(xml, expected);
  const result = compareXmlCiiParityAuthorityEntries(expected, actual, [], xml);
  assert.equal(result.ok, true, JSON.stringify(result.mismatches));
  assert.equal(result.comparisons, 12);
});

test('RED: duplicate Branchname resolves by occurrence, not first branch by name', () => {
  const xml2 = '<PipeStressExport>' + branch(pl06, [
    node('200010', '=1006649755/1750', '1', '803427.00 -1140678.00 98762.35', 'BRAN', '1500'),
  ]) + branch(pl06, [numbered]) + '</PipeStressExport>';
  const actual = extractXmlCiiParityAuthorityEntries(xml2, [entry(identities[0])]);
  assert.equal(actual[0].found, true);
  assert.equal(actual[0].actual, '900');
});

test('wrong engineering value remains blocked even when physical node matches', () => {
  const bad = xml.replace(numbered, numbered.replace('<Rating>900</Rating>', '<Rating>1500</Rating>'));
  const expected = [entry(identities[0])];
  const actual = extractXmlCiiParityAuthorityEntries(bad, expected);
  const compared = compareXmlCiiParityAuthorityEntries(expected, actual, [], bad);
  assert.equal(compared.ok, false);
  assert.ok(compared.mismatches.some(item => item.field === 'rating'));
});

test('physical node identity changed: fail closed, never guess from an ordinal alone', () => {
  const bad = xml.replace(negative1,
    negative1.replace('803427.00 -1134477.00 98736.95', '803428.00 -1134477.00 98736.95'));
  const actual = extractXmlCiiParityAuthorityEntries(bad, [entry(identities[1])]);
  assert.equal(actual[0].found, false);
  assert.equal(actual[0].missing, 'node-identity');
});


const branchRows = [
  { branchName: pl01, pipingClass: 'S8810104', rating: '300', corrosion: '0' },
  { branchName: pl06, pipingClass: 'S8810105', rating: '900', corrosion: '0' },
];
const nodeFacts = [
  { branchName: pl01, nodeNumber: '10', componentRefNo: '=1006649755/1898',
    endpoint: '1', boreMm: 200, wallThickness: '6' },
  { branchName: pl06, nodeNumber: '200010', componentRefNo: '=1006649755/1750',
    endpoint: '1', boreMm: 300, wallThickness: '9' },
  { branchName: pl06, nodeNumber: '-1', componentRefNo: '=1006657947/24',
    endpoint: '1', boreMm: 300, wallThickness: '9' },
  { branchName: pl06, nodeNumber: '-1', componentRefNo: '=1006657947/24',
    endpoint: '2', boreMm: 250, wallThickness: '7' },
];

test('actual Preview-to-enriched-XML writer preserves per-node bores and parity PASS', async () => {
  const process = await applyStandaloneProcessParity(xml, {}, '', [], {
    previewBuilder: () => ({ branchRows, nodeRows: [], nodeBoreWallRows: nodeFacts }),
  });
  assert.equal(process.branchRows.length, 2);
  assert.equal(process.expectedEntries.filter(item => item.scope === 'node').length > 0, true);
  const doc = new DOMParser().parseFromString(process.xmlText, 'application/xml');
  const branches = [...doc.getElementsByTagName('Branch')];
  assert.equal(branches.length, 2);
  assert.equal(branches[0].getElementsByTagName('PipingClass')[0]?.textContent, 'S8810104');
  const nodes = [...branches[1].getElementsByTagName('Node')];
  assert.deepEqual(nodes.map(n => n.getElementsByTagName('BoreMm')[0]?.textContent),
    ['300', '300', '250']);
  const proof = createStandaloneRunParityEvidence({
    xmlText: process.xmlText, expectedEntries: process.expectedEntries,
    branchRows: process.branchRows, nodeRows: [],
  });
  assert.equal(proof.ok, true, JSON.stringify(proof.mismatches));
  assert.ok(proof.comparisons >= 15);
});

test('writer refuses missing or out-of-order node authority, never silently pairs by name', async () => {
  const invalid = [nodeFacts[0], nodeFacts[1], nodeFacts[3], nodeFacts[2]];
  await assert.rejects(
    applyStandaloneProcessParity(xml, {}, '', [], {
      previewBuilder: () => ({ branchRows, nodeRows: [], nodeBoreWallRows: invalid }),
    }),
    /node bore authority occurrence differs/,
  );
});

test('writer does not collapse identically named branch occurrences with independent authority', async () => {
  const duplicateXml = '<PipeStressExport>' + branch(pl06, [numbered])
    + branch(pl06, [numbered]) + '</PipeStressExport>';
  const rows = [
    { branchName: pl06, pipingClass: 'S8810105', rating: '1500', corrosion: '0' },
    { branchName: pl06, pipingClass: 'S8810105', rating: '900', corrosion: '0' },
  ];
  const facts = [nodeFacts[1], nodeFacts[1]];
  const written = await applyStandaloneProcessParity(duplicateXml, {}, '', [], {
    previewBuilder: () => ({ branchRows: rows, nodeRows: [], nodeBoreWallRows: facts }),
  });
  const doc = new DOMParser().parseFromString(written.xmlText, 'application/xml');
  const branches = [...doc.getElementsByTagName('Branch')];
  assert.deepEqual(branches.map(el => el.getElementsByTagName('Rating')[0]?.textContent),
    ['1500', '900']);
  const proof = createStandaloneRunParityEvidence({
    xmlText: written.xmlText, expectedEntries: written.expectedEntries,
    branchRows: written.branchRows, nodeRows: [],
  });
  assert.equal(proof.ok, true, JSON.stringify(proof.mismatches));
});


test('missing Preview numerics never synthesize zero or overwrite source engineering fields', async () => {
  const one = '<PipeStressExport>' + branch(pl01, [
    first.replace('<CorrosionAllowance>0</CorrosionAllowance>',
      '<CorrosionAllowance>1.5</CorrosionAllowance>'),
  ]).replace('</Branchname>',
    '</Branchname><Temperature><Temperature1>-100000</Temperature1></Temperature>'
    + '<Pressure><Pressure1>42</Pressure1></Pressure>') + '</PipeStressExport>';
  const result = await applyStandaloneProcessParity(one, {}, '', [], {
    previewBuilder: () => ({
      branchRows: [{ branchName: pl01, pipingClass: 'S8810104' }],
      nodeRows: [],
      nodeBoreWallRows: [],
    }),
  });
  const doc = new DOMParser().parseFromString(result.xmlText, 'application/xml');
  const read = tag => doc.getElementsByTagName(tag)[0]?.textContent;
  assert.equal(read('Temperature1'), '-100000', 'unassigned temperature is preserved');
  assert.equal(read('Pressure1'), '42', 'unassigned pressure is preserved');
  assert.equal(read('CorrosionAllowance'), '1.5', 'unassigned corrosion is preserved');
  assert.equal(doc.getElementsByTagName('BoreMm').length, 0, 'unassigned nominal bore is not zero');
  assert.equal(doc.getElementsByTagName('WallThickness').length, 0, 'unassigned wall is not zero');
  assert.ok(result.expectedEntries.every(item =>
    !['t1', 'p1', 'boreMm', 'wallThickness', 'corrosion'].includes(item.field)),
    'only actually sourced Preview numbers are admitted to output authority');
});
