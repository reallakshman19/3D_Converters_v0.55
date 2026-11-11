import { calculateLegacyWorkbookDetailedAssembly } from '../converters/engineering-calculations/bolts/detailed-friction.js';

function usage() {
  return [
    'Usage:',
    '  node scripts/calc-bolt-detailed-friction.mjs <json>',
    '',
    'JSON fields:',
    '  preloadN, nominalDiameterM, pitchM, includedThreadAngleDeg, starts,',
    '  threadFrictionCoefficient, bearingFrictionCoefficient,',
    '  innerBearingDiameterM, outerBearingDiameterM',
    '',
    'The command reports both the exact V-thread reference torque and the',
    'legacy-workbook linearized comparator. All friction inputs are explicit.',
  ].join('\n');
}

function main() {
  if (!process.argv[2]) throw new Error(usage());
  const input = JSON.parse(process.argv[2]);
  const result = calculateLegacyWorkbookDetailedAssembly(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
