import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditPr1290CandidateDirectory } from '../engineering/hp-class-standardization/qualification/kd320-q1/pr1290-candidate-audit.js';

const DEFAULT_MANIFEST = fileURLToPath(new URL('../engineering/hp-class-standardization/qualification/kd320-q1/pr1290-candidate-reconciliation.json', import.meta.url));

function main() {
  const [, , dir, manifestPath = DEFAULT_MANIFEST] = process.argv;
  if (!dir) {
    console.error('Usage: node scripts/audit-b313-ch9-kd320-pr1290-candidate.mjs <PR1290-Hi-PR-dir> [manifest.json]');
    process.exitCode = 1;
    return;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const result = auditPr1290CandidateDirectory(dir, manifest);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 2;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: 'PR1290_CANDIDATE_AUDIT_FAILED', message: error.message }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
