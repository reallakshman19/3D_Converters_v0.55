import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', import.meta.url), 'utf8');
const start = source.indexOf('export async function computeXmlCiiWeightIssues');
assert.ok(start >= 0);
const fn = source.slice(start);

assert.match(fn, /const basisRows = collectXmlCiiWeightMatchRows\(geometryXml, jsonText, cfg\)/);
assert.match(fn, /buildXmlCiiValidatedRigidWeightLegacyView\(cfg, basisRows\)/);
assert.match(fn, /collectXmlCiiWeightMatchRows\(geometryXml, jsonText, authorityConfig\)/);
assert.match(fn, /staleMatch1: validated\.validation\.stale\?\.\[row\.key\]/);
assert.match(fn, /match1Validation: validated\.validation/);

console.log('Issue #776 post-run Weight Match validator uses canonical Match-1 authority.');
