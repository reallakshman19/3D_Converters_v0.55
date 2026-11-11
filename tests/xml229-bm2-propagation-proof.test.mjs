import test from 'node:test';
import assert from 'node:assert/strict';
import {
  engineeringNumber, parseCiiEngineeringFields, ciiBranchFieldMatches,
  ciiNodeWeightMatches, verifyCiiEngineeringAgainstNativeXml
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-propagation-proof.mjs';

const branch = '/GLRD-1000-6"-P4110001-93833-01/B6';
const other = '/GLRD-1000-2"-P4110003-93833-01/B2';
const row = (...entries) => entries.join('  ');
function element(from, to, b, p = 0, t = 0, density = 0, rigidPtr = 0) {
  return [
    row(from.toFixed(5), to.toFixed(5), 0, 0, 0, 168.3),
    row(7.112, 0, 0, t, t, t),
    row(0, 0, 0, 0, 0, 0),
    row(p, 0, 0, 0, 0, 0),
    row(0, 0, 0, 0, 0, 0),
    row(0, density, 0, 0, 0, 0),
    row(0, 0, 0, 0, 0, 0),
    row(0, 0, 0, 0, 0, 0),
    row(0, 0, 0, 0, 0),
    ' '.repeat(24) + '0',
    '1 ' + b,
    '0',
    row(0, rigidPtr, 0, 0, 0, 0),
    row(0, 0, 0, 0, 0, 0),
    row(0, 0, 0),
  ];
}
const sample = [
  '#$ VERSION', '5', '#$ CONTROL', '2 0 0 0 0 0', '#$ ELEMENTS',
  ...element(10, 20, branch, 50, 145, 900, 1),
  ...element(30, 40, other, 0, 0, 0, 0),
  '#$ RIGID', row(368, 125),
].join('\n');

test('absence and temp sentinel never convert to engineering zero', () => {
  for (const value of [null, undefined, '', '—', '-', 'n/a', 'hello']) {
    assert.equal(engineeringNumber(value), null);
  }
  assert.equal(engineeringNumber(0), 0);
  assert.equal(engineeringNumber('-100000', true), null);
});
test('CII identity and fixed row slots: unrelated zeros are not matches', () => {
  const parsed = parseCiiEngineeringFields(sample);
  assert.equal(parsed.elements.length, 2);
  assert.equal(ciiBranchFieldMatches(parsed, branch, 'p1', 50), true);
  assert.equal(ciiBranchFieldMatches(parsed, branch, 'p1', 0), false);
  assert.equal(ciiBranchFieldMatches(parsed, branch, 't1', 145), true);
  assert.equal(ciiBranchFieldMatches(parsed, branch, 'density', 900), true);
  assert.equal(ciiBranchFieldMatches(parsed, branch, 'p1', '—'), null);
  assert.equal(ciiBranchFieldMatches(parsed, other, 'p1', 0), true);
});
test('weight requires owning element RIGID pointer', () => {
  const parsed = parseCiiEngineeringFields(sample);
  assert.equal(ciiNodeWeightMatches(parsed, branch, 20, 12.5), true);
  assert.equal(ciiNodeWeightMatches(parsed, branch, 20, 0), false);
  assert.equal(ciiNodeWeightMatches(parsed, other, 40, 12.5), false);
  assert.equal(ciiNodeWeightMatches(parsed, branch, -1, 12.5), null);
});
test('malformed output blocks instead of globally searching CII bytes', () => {
  assert.throws(() => parseCiiEngineeringFields(sample.replace('#$ ELEMENTS', '#$ GARBLED')),
    /CII_ELEMENT_BLOCK_COUNT_INVALID/);
  assert.throws(() => parseCiiEngineeringFields(sample.replace('2 0 0 0 0 0', '3 0 0 0 0 0')),
    /CII_CONTROL_ELEMENT_COUNT_MISMATCH/);
});

test('governed independent proof checks every exact source element and RESTRANT gap', async () => {
  const {installWeightBasisXmlDom}=await import(
    '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js');
  installWeightBasisXmlDom(globalThis);
  const xml='<PipeStressExport><Pipe><Branch><Branchname>'+branch+'</Branchname>'
    +'<Pressure><Pressure1>50</Pressure1></Pressure>'
    +'<Temperature><Temperature1>145</Temperature1><Temperature2>145</Temperature2>'
    +'<Temperature3>145</Temperature3></Temperature><FluidDensity>900</FluidDensity>'
    +'<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'
    +'<WallThickness>7.112</WallThickness><CorrosionAllowance>0</CorrosionAllowance><MaterialCode>741</MaterialCode></Node>'
    +'<Node><NodeNumber>20</NodeNumber><ComponentType>PIPE</ComponentType>'
    +'<WallThickness>7.112</WallThickness><CorrosionAllowance>0</CorrosionAllowance><MaterialCode>741</MaterialCode>'
    +'<Restraint><Type>GUI</Type><Gap>4.5</Gap></Restraint></Node>'
    +'<Node><NodeNumber>30</NodeNumber><ComponentType>PIPE</ComponentType>'
    +'<WallThickness>7.112</WallThickness><CorrosionAllowance>0</CorrosionAllowance><MaterialCode>741</MaterialCode></Node>'
    +'</Branch></Pipe></PipeStressExport>';
  const body=[...element(10,20,branch,50,145,0.0009,0),
              ...element(20,30,branch,50,145,0.0009,0)];
  const cii=(rows=body, gap='4.5')=>[
    '#$ CONTROL','2 0 0 0 0 0','#$ ELEMENTS',...rows,
    '#$ MISCEL_1','741 741 0 0 0 0',
    '#$ RESTRANT','20 8 0 '+gap+' 0 0',
    '0 0 0 0 0 0','0 0 0 0 0 0','0 0 0 0 0 0',
  ].join('\n');
  const valid=verifyCiiEngineeringAgainstNativeXml(xml,cii());
  assert.equal(valid.elements,2);
  assert.equal(valid.restraints,1);
  assert.equal(valid.status,'VERIFIED');
  const badWall=[...body];
  badWall[16]=badWall[16].replace('7.112','9.500');
  assert.throws(()=>verifyCiiEngineeringAgainstNativeXml(xml,cii(badWall)),
    /CII_VERIFIED_ELEMENT_WALL_CONFLICT/, 'the SECOND element wall must be checked');
  const badPressure=[...body];
  badPressure[18]=badPressure[18].replace('50','51');
  assert.throws(()=>verifyCiiEngineeringAgainstNativeXml(xml,cii(badPressure)),
    /CII_VERIFIED_BRANCH_FIELD_CONFLICT_P1/);
  assert.throws(()=>verifyCiiEngineeringAgainstNativeXml(xml,
    cii().replace('741 741 0 0 0 0','741 742 0 0 0 0')),
    /CII_VERIFIED_ELEMENT_MATERIAL_CODE_CONFLICT/);
  assert.throws(()=>verifyCiiEngineeringAgainstNativeXml(xml,cii(body,'6')),
    /CII_VERIFIED_RESTRAINT_TYPE_OR_GAP_CONFLICT/);
  assert.throws(()=>verifyCiiEngineeringAgainstNativeXml(xml,cii().replace('20 8 0 4.5','20 14 0 4.5')),
    /CII_VERIFIED_RESTRAINT_TYPE_OR_GAP_CONFLICT/);
});
