import { calculateUg44RatedFlange } from '../converters/engineering-calculations/flange/ug44.js';

function usage() {
  return [
    'Usage:',
    '  node scripts/calc-flange-ug44.mjs <json>',
    '',
    'JSON fields:',
    '  ratedPressurePa, designPressurePa, gasketReactionDiameterM,',
    '  momentFactor, bendingMomentNm, openingAxialForceN',
  ].join('\n');
}

function main() {
  if (!process.argv[2]) throw new Error(usage());
  const input = JSON.parse(process.argv[2]);
  const result = calculateUg44RatedFlange(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
