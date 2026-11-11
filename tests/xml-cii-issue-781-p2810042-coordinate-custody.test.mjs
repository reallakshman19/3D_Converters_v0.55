import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

function node(no, position, { type = 'BRAN', rigid = 0, ref = '' } = {}) {
  return `<Node><NodeNumber>${no}</NodeNumber><NodeName></NodeName><Endpoint>0</Endpoint>${rigid ? `<Rigid>${rigid}</Rigid>` : ''}<ComponentType>${type}</ComponentType><Weight>0</Weight><ComponentRefNo>${ref}</ComponentRefNo><OutsideDiameter>610</OutsideDiameter><WallThickness>30.9626</WallThickness><CorrosionAllowance>3</CorrosionAllowance><InsulationThickness>0</InsulationThickness><Position>${position}</Position><BendRadius>0</BendRadius><SIF>0</SIF></Node>`;
}

function documentXml(branches, restrainOpenEnds = 'Yes') {
  return `<PipeStressExport>
<DateTime></DateTime><Source>AVEVA PSI</Source><Version>3.1.7.0</Version><UserName></UserName><Purpose></Purpose><ProjectName></ProjectName><MDBName></MDBName><TitleLine>P2810042 coordinate custody</TitleLine>
<Units><DistanceUnits>mm</DistanceUnits></Units><RestrainOpenEnds>${restrainOpenEnds}</RestrainOpenEnds><AmbientTemperature>21</AmbientTemperature>
<Pipe><FullName>/TEST</FullName><Ref>=TEST</Ref>${branches}</Pipe>
</PipeStressExport>`;
}

function branch(name, nodes) {
  return `<Branch><Branchname>${name}</Branchname><Temperature><Temperature1>82</Temperature1></Temperature><Pressure><Pressure1>0</Pressure1></Pressure><MaterialNumber>177</MaterialNumber><InsulationDensity>0</InsulationDensity><FluidDensity>0</FluidDensity>${nodes}</Branch>`;
}

function runConverter(input, output) {
  return spawnSync(python, [
    'converters/scripts/xml_to_cii2019_runtime_custody.py',
    '--input', input,
    '--output', output,
    '--coords-mode', 'first',
    '--weight-scale', '10',
  ], { cwd: root, encoding: 'utf8' });
}

function section(text, name) {
  return text.split(`#$ ${name}`, 2)[1]?.split('#$', 1)[0] || '';
}

function coordsRows(text) {
  return section(text, 'COORDS').split(/\r?\n/).filter((line) => line.trim());
}

test('P2810042 analogue preserves Node 10 as the connected-component source datum', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xml-cii-781-p2810042-coordinate-'));
  const input = join(dir, 'p2810042-coordinate.xml');
  const output = join(dir, 'p2810042-coordinate.cii');

  // Reported topology analogue:
  // - Node 10 is the first retained source node.
  // - A later branch terminates back on Node 10, so Node 10 has degree 2.
  // - RestrainOpenEnds=Yes creates different degree-1 open-end restraints.
  // The default single component anchor must retain the source datum (Node 10),
  // not silently switch absolute-coordinate authority to a later open end.
  await writeFile(input, documentXml(
    branch('/HBMR-1000-24"-P2810042-61440-01/B2',
      node(10, '72298.40 115930.00 100000.00', { type: 'BRAN' })
      + node(20, '72588.00 115930.00 100000.00', { type: 'RIGID', rigid: 2, ref: '=67127481/56' })
      + node(30, '73502.00 115930.00 100000.00', { type: 'ELBO' }))
    + branch('/HBMR-1000-24-"P2810042-61440-01-EXE/B2',
      node(480, '72088.40 115930.00 100000.00', { type: 'FLAN' })
      + node(10, '72298.40 115930.00 100000.00', { type: 'RIGID', rigid: 2, ref: '=67127432/19' }))
  ));

  const run = runConverter(input, output);
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const cii = await readFile(output, 'utf8');
  const coords = coordsRows(cii);
  assert.equal(Number(coords[0].trim()), 1, 'one connected graph must retain one absolute COORDS anchor');
  const anchor = coords[1].trim().split(/\s+/).map(Number);
  assert.equal(anchor[0], 10,
    'default COORDS datum must remain the first retained source node, not a later generated/open-end authority');
  assert.deepEqual(anchor.slice(1, 4), [72298.4, 100000.0, -115930.0],
    'Node 10 global coordinate must preserve source Position under XML XYZ -> CII X,Z,-Y mapping');
});

test('malformed Position fails closed instead of becoming implicit origin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xml-cii-781-bad-coordinate-'));
  const input = join(dir, 'bad-position.xml');
  const output = join(dir, 'bad-position.cii');
  await writeFile(input, documentXml(
    branch('/BAD-POSITION',
      node(10, 'not-a-position')
      + node(20, '100 0 0')),
    'No',
  ));

  const run = runConverter(input, output);
  assert.notEqual(run.status, 0, 'malformed Position must block conversion instead of becoming (0,0,0)');
  assert.match(`${run.stdout}\n${run.stderr}`, /Position|coordinate/i,
    'fail-closed diagnostic must identify Position/coordinate custody');
});
