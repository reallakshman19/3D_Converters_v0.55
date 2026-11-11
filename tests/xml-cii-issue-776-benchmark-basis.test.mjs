import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const xml = await readFile(new URL('../Benchmarks/WSW-2-RE-AFC.xml', import.meta.url), 'utf8');
const originalCii = await readFile(new URL('../Benchmarks/WSW-2-RE-AFC_ORI.cii', import.meta.url), 'utf8');

function nodeOccurrences(source, nodeNumber) {
  const blocks = source.match(/<Node>[\s\S]*?<\/Node>/g) || [];
  return blocks
    .filter((block) => new RegExp(`<NodeNumber>\\s*${nodeNumber}\\s*<\\/NodeNumber>`).test(block))
    .map((block) => ({
      componentType: block.match(/<ComponentType>(.*?)<\/ComponentType>/)?.[1]?.trim() || '',
      componentRefNo: block.match(/<ComponentRefNo>(.*?)<\/ComponentRefNo>/)?.[1]?.trim() || '',
      position: (block.match(/<Position>(.*?)<\/Position>/)?.[1] || '').trim(),
      endpoint: (block.match(/<Endpoint>(.*?)<\/Endpoint>/)?.[1] || '').trim(),
    }));
}

function elements(ciiText) {
  const body = ciiText.split('#$ ELEMENTS', 2)[1]?.split('#$', 1)[0] || '';
  const rows = body.split(/\r?\n/).filter((line) => line.trim());
  const out = [];
  for (let index = 0; index + 14 < rows.length; index += 15) {
    const head = rows[index].trim().split(/\s+/).map(Number);
    if (!Number.isFinite(head[0]) || !Number.isFinite(head[1])) break;
    const pointers = rows[index + 12].trim().split(/\s+/).map(Number);
    out.push({
      from: head[0],
      to: head[1],
      dx: head[2],
      dy: head[3],
      dz: head[4],
      rigid: pointers[1] || 0,
    });
  }
  return out;
}

const node60 = nodeOccurrences(xml, 60);
const node70 = nodeOccurrences(xml, 70);
assert.equal(node60.length, 1);
assert.equal(node70.length, 1);
assert.equal(node60[0].position, '119886.00 125999.99 101394.45');
assert.equal(node70[0].position, '119717.26 125999.99 101394.45');

const splitFlangePositions = [
  '119886.00 125999.99 101394.45',
  '119801.63 125999.99 101394.45',
  '119717.26 125999.99 101394.45',
];
const xs = splitFlangePositions.map((row) => Number(row.split(/\s+/)[0]));
assert.ok(Math.abs((xs[0] - xs[1]) - 84.37) < 1e-9);
assert.ok(Math.abs((xs[1] - xs[2]) - 84.37) < 1e-9);
assert.ok(Math.abs((xs[0] - xs[2]) - 168.74) < 1e-9);

for (const junction of [360, 770]) {
  const rows = nodeOccurrences(xml, junction);
  assert.equal(rows.length, 2, `source node ${junction} must appear at both sides of a branch junction`);
  assert.equal(rows[0].position, rows[1].position, `source node ${junction} junction coordinates must coincide`);
  assert.equal(rows[0].componentType, 'RIGID');
  assert.equal(rows[1].componentType, 'RIGID');
}

const originalElements = elements(originalCii);
const byPair = new Map(originalElements.map((row) => [`${row.from}->${row.to}`, row]));

assert.equal(byPair.get('70->80')?.rigid, 0, 'benchmark 70→80 span is pipe, not rigid');
assert.ok(byPair.has('350->360'), 'benchmark must preserve direct connectivity into junction 360');
assert.ok(byPair.has('360->370'), 'benchmark must preserve direct connectivity out of junction 360');
assert.ok(byPair.has('760->770'), 'benchmark must preserve direct connectivity into junction 770');
assert.ok(byPair.has('770->780'), 'benchmark must preserve direct connectivity out of junction 770');

console.log('Issue #776 benchmark basis verified.');
