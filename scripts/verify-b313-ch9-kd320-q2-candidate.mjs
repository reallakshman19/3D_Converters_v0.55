import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { evaluateKd320Q2AdmissionCandidate } from
  '../engineering/hp-class-standardization/qualification/kd320-q2/intake.js';

export function verifyKd320Q2CandidateFile(filePath, options = {}) {
  const absolute = path.resolve(filePath);
  const candidate = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  const result = evaluateKd320Q2AdmissionCandidate(candidate);
  return {
    ...result,
    candidateFile: absolute,
    requireReady: options.requireReady === true,
  };
}

function main(argv) {
  const args = argv.slice(2);
  const requireReady = args.includes('--require-ready');
  const filePath = args.find((arg) => !arg.startsWith('--'));
  if (!filePath) {
    console.error('Usage: node scripts/verify-b313-ch9-kd320-q2-candidate.mjs <candidate.json> [--require-ready]');
    return 1;
  }
  try {
    const result = verifyKd320Q2CandidateFile(filePath, { requireReady });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) return 2;
    if (requireReady && !result.q2OracleAdmissionReady) return 2;
    return 0;
  } catch (error) {
    console.error(error?.stack || String(error));
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exitCode = main(process.argv);
}
