import assert from 'node:assert/strict';
import test from 'node:test';
import { installWeightBasisXmlDom } from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import { extractXmlCiiParityAuthorityEntries, compareXmlCiiParityAuthorityEntries } from '../tabs/xml-cii-2019-standalone/xml-cii-run-parity-evidence.js';

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
