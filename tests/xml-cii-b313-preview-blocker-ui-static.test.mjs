import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const composer = await readFile(fileURLToPath(new URL('../converters/xml-cii2019-core/b313-preview-wall-update.js', import.meta.url)), 'utf8');
const audit = await readFile(fileURLToPath(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-audit-controller.js', import.meta.url)), 'utf8');

for (const status of [
  'QUALIFICATION_STATUS_REJECTED',
  'MANUFACTURING_ROUTE_REQUIRED',
  'MANUFACTURING_ROUTE_NO_MATCH',
  'NO_EXACT_TEMPERATURE_RECORD',
]) assert(composer.includes(status), status);
assert(composer.includes('strictAcceptedStatuses'));
assert(composer.includes('candidateStatuses'));
assert(composer.includes('availableTemperaturesC'));
assert(composer.includes('availableManufacturingRoutes'));
assert(composer.includes("qualificationMode: 'strict'"));
assert(!composer.includes("qualificationMode: 'benchmark'"), 'Preview must not opt into BENCHMARK_ONLY authority');
assert(!composer.includes("qualificationMode: 'screening'"), 'Preview must not opt into SCREENING authority');

assert(audit.includes('factorBlockerText'));
assert(audit.includes('candidate status'));
assert(audit.includes('manufacturing route required'));
assert(audit.includes('no exact T1 record'));
assert(audit.includes('Line-list and Piping Class data may resolve the governed material identity'));
assert(audit.includes('They do not invent numeric S/E/W/Y'));
assert(audit.includes('BENCHMARK_ONLY / SCREENING factors'));

console.log('xml-cii B31.3 blocker diagnostics UI static tests: PASS');
