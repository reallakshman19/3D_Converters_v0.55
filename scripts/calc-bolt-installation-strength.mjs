import { calculateInstallationBoltStrength } from '../converters/engineering-calculations/bolts/installation-strength.js';

function usage() {
  return [
    'Usage:',
    '  node scripts/calc-bolt-installation-strength.mjs <json>',
    '',
    'JSON fields:',
    '  preloadN, tensileStressAreaM2, threadTorqueNm, stressSectionDiameterM, referenceStressPa',
    '',
    'threadTorqueNm is the transmitted thread torque, not total wrench torque.',
  ].join('\n');
}

function main() {
  if (!process.argv[2]) throw new Error(usage());
  const input = JSON.parse(process.argv[2]);
  const result = calculateInstallationBoltStrength(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
