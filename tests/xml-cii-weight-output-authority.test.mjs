import test from 'node:test';
import assert from 'node:assert/strict';
import { installWeightBasisXmlDom } from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
// Explicit XML DOM test adapter; production browser uses its native DOM.
installWeightBasisXmlDom(globalThis);
const parity = await import('../tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js');
const { prepareStandaloneRigidWeightAuthority, applyStandaloneAcceptedRigidWeights, deferStandaloneRigidWeights } = await import('../tabs/xml-cii-2019-standalone/xml-cii-weight-output-authority.js');
const { buildXmlCiiRigidWeightMatch1Provenance, withXmlCiiRigidWeightMatch1 } = await import('../converters/xml-cii2019-core/rigid-weight-authority.js');
const branch = '/SYS-1-8"-L-31441C4-X/B1', key = `${branch}::20`;
const xml = `<PipeStressExport><Pipe><Branch><Branchname>${branch}</Branchname>
<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType><Endpoint>1</Endpoint><Position>0 0 0</Position></Node>
<Node><NodeNumber>20</NodeNumber><ComponentType>RIGID</ComponentType><Rigid>2</Rigid><Endpoint>2</Endpoint><ComponentRefNo>=A/20</ComponentRefNo><Position>112 0 0</Position><Weight>0</Weight></Node>
<Node><NodeNumber>30</NodeNumber><ComponentType>PIPE</ComponentType><Endpoint>1</Endpoint><Position>224 0 0</Position></Node>
</Branch></Pipe></PipeStressExport>`;
const config = { rating: { tokenDelimiter: '-', pipingClassTokenIndex: 5, ratingSequence: [['3', '300']] },
  weight: { tokenDelimiter: '-', boreTokenIndex: 3, masterRows: [{ bore: 25, rating: 150, length: 100, weight: 3 }], masterRevision: 2 } };
function authority(input = config, source = xml) {
  return prepareStandaloneRigidWeightAuthority(parity, source, '', input, { splitCondensedValveFlange: true }, {});
}
function weight(output) {
  const doc = new DOMParser().parseFromString(output, 'application/xml');
  return Number([...doc.getElementsByTagName('Node')].find(n => n.getElementsByTagName('NodeNumber')[0]?.textContent === '20')?.getElementsByTagName('Weight')[0]?.textContent);
}
test('accepted final weight writes without a matching master candidate, replacing prior XML value', () => {
  const input = { ...config, overrides: { rigidWeightFinal: { [key]: 17.75 } } };
  const prepared = authority(input);
  const result = applyStandaloneAcceptedRigidWeights(xml.replace('<Weight>0</Weight>', '<Weight>100</Weight>'), prepared);
  assert.equal(weight(result.xmlText), 17.75);
  assert.equal(result.expectedEntries[0].expected, '17.75');
  assert.deepEqual(deferStandaloneRigidWeights(input).overrides, {});
  assert.equal(input.overrides.rigidWeightFinal[key], 17.75);
});
test('canonical source basis preserves accepted length authority; real length/Rating/master changes invalidate', () => {
  const row = authority().basisRows.find(row => row.key === key);
  assert.ok(row);
  const accepted = withXmlCiiRigidWeightMatch1(config, { [key]: 57.25 }, {
    [key]: buildXmlCiiRigidWeightMatch1Provenance(row, config, null, { weightKg: 57.25 }),
  });
  assert.equal(authority(accepted).validation.validCount, 1);
  for (const [changed, source] of [
    [accepted, xml.replace('112 0 0', '120 0 0')],
    [{ ...accepted, overrides: { ...accepted.overrides, rating: { [branch]: '600' } } }, xml],
    [{ ...accepted, weight: { ...accepted.weight, masterRevision: 3 } }, xml],
  ]) {
    const invalid = authority(changed, source);
    assert.equal(invalid.validation.staleCount, 1);
    assert.equal(invalid.config.overrides.rigidWeight[key], undefined);
    assert.equal(weight(applyStandaloneAcceptedRigidWeights(xml, invalid).xmlText), 0);
  }
});
test('accepted component removed during geometry preparation cannot silently disappear', () => {
  const accepted = authority({ ...config, overrides: { rigidWeightFinal: { [key]: 17.75 } } });
  assert.throws(() => applyStandaloneAcceptedRigidWeights('<PipeStressExport/>', accepted), /Accepted weight has no output node/);
});

test('negative-number component custody cannot be satisfied by a different helper in the same branch', async () => {
  const { createStandaloneRunParityEvidence } = await import('../tabs/xml-cii-2019-standalone/xml-cii-run-parity-evidence.js');
  const source = xml.replace('<NodeNumber>20</NodeNumber>', '<NodeNumber>-1</NodeNumber>');
  const row = prepareStandaloneRigidWeightAuthority(parity, source, '', config, { splitCondensedValveFlange: false }, {}).basisRows[0];
  assert.equal(row.key, `${branch}::=A/20|2|112 0 0|RIGID`);
  const accepted = prepareStandaloneRigidWeightAuthority(parity, source, '', { ...config, overrides: { rigidWeightFinal: { [row.key]: 17.75 } } }, { splitCondensedValveFlange: false }, {});
  const result = applyStandaloneAcceptedRigidWeights(source, accepted);
  assert.equal(createStandaloneRunParityEvidence({ xmlText: result.xmlText, expectedEntries: result.expectedEntries }).ok, true);
  const wrong = result.xmlText.replace('=A/20', '=OTHER/20');
  assert.equal(createStandaloneRunParityEvidence({ xmlText: wrong, expectedEntries: result.expectedEntries }).ok, false);
  assert.throws(() => applyStandaloneAcceptedRigidWeights(wrong, accepted), /Accepted weight has no output node/);
});
test('UI job normalizes absent optional master arrays without inventing master values', async () => {
  const { enrichSupportConfigJson } = await import('../tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js');
  const input = { ...config, linelist: { masterRows: null }, material: { mapRows: null }, pipingClass: { masterRows: null } };
  const output = JSON.parse(await enrichSupportConfigJson({ supportConfigJson: JSON.stringify(input) }));
  assert.deepEqual(output.linelist.masterRows, []);
  assert.deepEqual(output.material.mapRows, []);
  assert.deepEqual(output.pipingClass.masterRows, []);
  assert.deepEqual(output.weight.masterRows, config.weight.masterRows);
});
