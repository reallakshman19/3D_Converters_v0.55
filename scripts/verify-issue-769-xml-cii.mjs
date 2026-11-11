import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUSED = Object.freeze([
  'tests/xml-cii-linelist-synthetic-label-mapping.test.mjs',
  'tests/xml-cii-linelist-auto-map-integration.test.mjs',
  'tests/xml-cii-master-large-persistence.test.mjs',
  'tests/xml-cii-regex-confidence-buckets.test.mjs',
  'tests/xml-cii-branch-line-family-suggestion.test.mjs',
  'tests/xml-cii-rigid-weight-lifecycle.test.mjs',
  'tests/xml-cii-mode-a-consolidated-rigid-review.test.mjs',
  'tests/xml-cii-standalone-weight-validator-deprecated-ui.test.mjs',
  'tests/xml-cii-b313-preview-blocker-provenance.test.mjs',
  'tests/xml-cii-b313-preview-blocker-ui-static.test.mjs',
  'tests/xml-cii-authority-migration.test.mjs',
  'tests/xml-cii-pr340-review-regressions.test.mjs',
]);

const ESTABLISHED_GUARDS = Object.freeze([
  'tests/xml-cii-smart-ui-integration.test.mjs',
  'tests/xml-cii-smart-ui-preflight.test.mjs',
  'tests/xml-cii-adapted-branch-line-auto-pattern.test.mjs',
  'tests/xml-cii-standalone-source-mode-integration.test.js',
  'tests/xml-cii-standalone-live-smoke.test.js',
  'tests/engineering-calculation-core.test.mjs',
]);

function allXmlCiiTests() {
  return readdirSync('tests')
    .filter((name) => /^xml-cii-.*\.test\.(?:mjs|js)$/i.test(name))
    .map((name) => `tests/${name}`)
    .sort();
}

function unique(values) {
  return [...new Set(values)];
}

function requireFiles(files) {
  const missing = files.filter((file) => !existsSync(file));
  if (missing.length) throw new Error(`Qualification inputs missing:\n${missing.join('\n')}`);
  return files;
}

const full = process.argv.includes('--full');
const files = requireFiles(unique(full
  ? [...allXmlCiiTests(), 'tests/engineering-calculation-core.test.mjs']
  : [...FOCUSED, ...ESTABLISHED_GUARDS]));

console.log(`[issue-769] mode=${full ? 'full' : 'focused'} tests=${files.length}`);
for (const file of files) console.log(`[issue-769] ${file}`);

const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: resolve('.'),
  stdio: 'inherit',
  env: process.env,
});

if (result.error) throw result.error;
process.exitCode = Number.isInteger(result.status) ? result.status : 1;
