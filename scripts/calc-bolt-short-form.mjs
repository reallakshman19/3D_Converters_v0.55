import { calculateShortFormBoltAssembly } from '../converters/engineering-calculations/bolts/short-form.js';

function usage() {
  return [
    'Usage:',
    '  node scripts/calc-bolt-short-form.mjs <json>',
    '',
    'JSON fields:',
    '  tensileStressAreaM2, referenceStressPa, preloadFraction, nominalDiameterM,',
    '  nutFactorMin, nutFactor, nutFactorMax',
    '',
    'All preload fractions and friction/nut factors are explicit caller inputs.',
  ].join('\n');
}

function main() {
  if (!process.argv[2]) throw new Error(usage());
  const input = JSON.parse(process.argv[2]);
  const result = calculateShortFormBoltAssembly(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
