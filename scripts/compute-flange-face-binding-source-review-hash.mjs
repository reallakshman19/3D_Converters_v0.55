import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { computeFlangeFaceBindingSourceSubmissionReviewHash } from '../converters/engineering-calculations/flange/flange-face-binding-source-admission.js';

function usage() {
  return 'Usage: node scripts/compute-flange-face-binding-source-review-hash.mjs <record.json>';
}

export function computeFlangeFaceBindingSourceReviewHashFile(filePath) {
  if (!String(filePath ?? '').trim()) throw new TypeError(usage());
  const record = JSON.parse(readFileSync(resolve(filePath), 'utf8'));
  const reviewedSubmissionHash = computeFlangeFaceBindingSourceSubmissionReviewHash(record);
  return Object.freeze({
    recordId: String(record.recordId).trim(),
    recordRevisionId: String(record.recordRevisionId).trim(),
    reviewedSubmissionHash,
  });
}

export function runFlangeFaceBindingSourceReviewHash(argv = process.argv.slice(2)) {
  if (argv.length !== 1) throw new TypeError(usage());
  const fingerprint = computeFlangeFaceBindingSourceReviewHashFile(argv[0]);
  process.stdout.write(`${JSON.stringify(fingerprint, null, 2)}\n`);
  return fingerprint;
}

const invokedAsScript = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  try {
    runFlangeFaceBindingSourceReviewHash();
  } catch (error) {
    process.stderr.write(`${error.code ?? error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
