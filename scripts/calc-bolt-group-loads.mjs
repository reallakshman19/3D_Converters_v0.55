import { distributeLinearBoltGroupLoads } from '../converters/engineering-calculations/bolts/group-loads.js';

function usage() {
  return [
    'Usage:',
    '  node scripts/calc-bolt-group-loads.mjs <json>',
    '',
    'JSON fields:',
    '  bolts: [{ id, xM, yM }, ...]',
    '  forceN: { x, y, z }',
    '  momentNm: { x, y, z }',
    '',
    'Loads must already be expressed in the bolt-group local frame at its centroid.',
  ].join('\n');
}

function main() {
  if (!process.argv[2]) throw new Error(usage());
  const input = JSON.parse(process.argv[2]);
  const result = distributeLinearBoltGroupLoads(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
