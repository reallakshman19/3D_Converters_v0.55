import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateFlangeFaceBindingSourceAdmission } from '../converters/engineering-calculations/flange/flange-face-binding-source-admission.js';

function usage() {
  return 'Usage: node scripts/validate-flange-face-binding-source-admission.mjs <admission.json>';
}

export function validateFlangeFaceBindingSourceAdmissionFile(filePath) {
  if (!String(filePath ?? '').trim()) throw new TypeError(usage());
  const admission = JSON.parse(readFileSync(resolve(filePath), 'utf8'));
  const validation = validateFlangeFaceBindingSourceAdmission(admission);
  if (!validation.ok) {
    const error = new RangeError(validation.errors.join(' '));
    error.code = 'FLANGE_FACE_BINDING_SOURCE_ADMISSION_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  return Object.freeze({ ok: true, admissionSemanticHash: admission.admissionSemanticHash });
}

export function runFlangeFaceBindingSourceAdmissionValidation(argv = process.argv.slice(2)) {
  if (argv.length !== 1) throw new TypeError(usage());
  const result = validateFlangeFaceBindingSourceAdmissionFile(argv[0]);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const invokedAsScript = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  try {
    runFlangeFaceBindingSourceAdmissionValidation();
  } catch (error) {
    process.stderr.write(`${error.code ?? error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
