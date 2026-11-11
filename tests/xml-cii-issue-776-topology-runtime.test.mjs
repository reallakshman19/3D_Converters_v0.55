import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = await mkdtemp(join(tmpdir(), 'xml-cii-776-topology-'));
const input = join(dir, 'input.xml');
const output = join(dir, 'output.cii');

function node(no, type, rigid, ref, x, weightKg = 0) {
  return `<Node><NodeNumber>${no}</NodeNumber><NodeName></NodeName><Endpoint>0</Endpoint>${rigid ? `<Rigid>${rigid}</Rigid>` : ''}<ComponentType>${type}</ComponentType><Weight>${weightKg}</Weight><ComponentRefNo>=${ref}</ComponentRefNo><OutsideDiameter>88.9</OutsideDiameter><WallThickness>0</WallThickness><CorrosionAllowance>0</CorrosionAllowance><InsulationThickness>0</InsulationThickness><Position>${x} 0 0</Position><BendRadius>0</BendRadius><SIF>0</SIF></Node>`;
}

const xml = `<PipeStressExport>
<DateTime></DateTime><Source>TEST</Source><Version>1</Version><UserName></UserName><Purpose></Purpose><ProjectName></ProjectName><MDBName></MDBName><TitleLine>issue-776</TitleLine>
<Units><DistanceUnits>mm</DistanceUnits></Units><RestrainOpenEnds>No</RestrainOpenEnds><AmbientTemperature>21</AmbientTemperature><Pipe><FullName>/TEST</FullName><Ref>=TEST</Ref>
<Branch><Branchname>/A</Branchname><Temperature><Temperature1>20</Temperature1></Temperature><Pressure><Pressure1>0</Pressure1></Pressure><MaterialNumber>0</MaterialNumber><InsulationDensity>0</InsulationDensity><FluidDensity>0</FluidDensity>
${node(60,'FLAN',1,'211',0)}
${node(68,'FLAN',2,'211',84.37,9.492)}
${node(70,'RIGID',2,'210',168.74)}
${node(80,'FLAN',1,'209',1453.74)}
${node(88,'FLAN',2,'209',1538.11)}
${node(90,'RIGID',2,'68',1622.48)}
${node(350,'FLAN',1,'98',2000)}
${node(359,'INST',2,'99',2240)}
${node(360,'RIGID',2,'67',2240)}
</Branch>
<Branch><Branchname>/B</Branchname><Temperature><Temperature1>20</Temperature1></Temperature><Pressure><Pressure1>0</Pressure1></Pressure><MaterialNumber>0</MaterialNumber><InsulationDensity>0</InsulationDensity><FluidDensity>0</FluidDensity>
${node(360,'RIGID',2,'116',2240)}
${node(370,'FLAN',2,'117',2324.37)}
${node(760,'FLAN',1,'152',5000)}
${node(769,'VALV',2,'153',5508.42)}
${node(770,'RIGID',2,'116',5508.42)}
</Branch>
<Branch><Branchname>/C</Branchname><Temperature><Temperature1>20</Temperature1></Temperature><Pressure><Pressure1>0</Pressure1></Pressure><MaterialNumber>0</MaterialNumber><InsulationDensity>0</InsulationDensity><FluidDensity>0</FluidDensity>
${node(770,'RIGID',2,'16',5508.42)}
${node(780,'FLAN',2,'17',5613.84)}
</Branch>
</Pipe></PipeStressExport>`;
await writeFile(input, xml);

const run = spawnSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [
  'converters/scripts/xml_to_cii2019_runtime_custody.py',
  '--input', input,
  '--output', output,
  '--coords-mode', 'first',
  '--weight-scale', '10',
], { cwd: root, encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr || run.stdout);
const cii = await readFile(output, 'utf8');

function section(name) {
  return cii.split(`#$ ${name}`, 2)[1]?.split('#$', 1)[0] || '';
}
const rows = section('ELEMENTS').split(/\r?\n/).filter((line) => line.trim());
const elements = [];
for (let index = 0; index + 14 < rows.length; index += 15) {
  const head = rows[index].trim().split(/\s+/).map(Number);
  if (!Number.isFinite(head[0]) || !Number.isFinite(head[1])) break;
  const pointers = rows[index + 12].trim().split(/\s+/).map(Number);
  elements.push({ from: head[0], to: head[1], rigid: pointers[1] || 0 });
}
const byPair = new Map(elements.map((row) => [`${row.from}->${row.to}`, row]));
assert.equal(byPair.get('70->80')?.rigid, 0, 'different-component 70→80 pipe must not inherit RIGID');
const flangeRigidIndex = byPair.get('60->68')?.rigid;
assert.ok(flangeRigidIndex > 0, 'the accepted flange edge must own a RIGID payload');
const rigidRows = section('RIGID').split(/\r?\n/).filter((line) => line.trim());
assert.ok(Math.abs(Number(rigidRows[flangeRigidIndex - 1].trim().split(/\s+/)[0]) - 94.92) < 1e-9,
  '9.492 kg must be scaled exactly once at the final CII writer');
assert.ok(byPair.has('359->360') === false, 'generated helper 359 must collapse into canonical junction 360');
assert.ok(byPair.has('350->360'), 'incoming branch must terminate on canonical junction 360');
assert.ok(byPair.has('360->370'), 'outgoing branch must start from canonical junction 360');
assert.ok(byPair.has('769->770') === false, 'generated helper 769 must collapse into canonical junction 770');
assert.ok(byPair.has('760->770'), 'incoming branch must terminate on canonical junction 770');
assert.ok(byPair.has('770->780'), 'outgoing branch must start from canonical junction 770');

const coords = section('COORDS').split(/\r?\n/).filter((line) => line.trim());
assert.equal(Number(coords[0].trim()), 1, 'repaired graph should need one coordinate anchor');
assert.equal(Number(coords[1].trim().split(/\s+/)[0]), 60);

console.log('Issue #776 runtime topology regression passed.');

// Keep the established #776 topology gate as the execution carrier for the
// reported #781 P2810042 coordinate-custody regression. This import adds a
// scenario only; it does not change the existing #776 assertions above.
await import('./xml-cii-issue-781-p2810042-coordinate-custody.test.mjs');
