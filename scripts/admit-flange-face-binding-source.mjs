import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { admitFlangeFaceBindingSourceSubmission } from '../converters/engineering-calculations/flange/flange-face-binding-source-admission.js';

function usage() {
  return 'Usage: node scripts/admit-flange-face-binding-source.mjs <submission.json>';
}

export function admitFlangeFaceBindingSourceFile(filePath) {
  if (!String(filePath ?? '').trim()) throw new TypeError(usage());
  const submission = JSON.parse(readFileSync(resolve(filePath), 'utf8'));
  return admitFlangeFaceBindingSourceSubmission(submission);
}

export function runFlangeFaceBindingSourceAdmission(argv = process.argv.slice(2)) {
  if (argv.length !== 1) throw new TypeError(usage());
  const admission = admitFlangeFaceBindingSourceFile(argv[0]);
  process.stdout.write(`${JSON.stringify(admission, null, 2)}\n`);
  return admission;
}

const invokedAsScript = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  try {
    runFlangeFaceBindingSourceAdmission();
  } catch (error) {
    process.stderr.write(`${error.code ?? error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
