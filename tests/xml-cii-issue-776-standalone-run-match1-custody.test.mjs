import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js', import.meta.url), 'utf8');
const authority = await readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-weight-output-authority.js', import.meta.url), 'utf8');

assert.match(source, /applyXmlCiiStagedGeometryAuthority\(/);
assert.match(authority, /collectXmlCiiWeightMatchBasisRows\(geometry\.xmlText/);
assert.match(authority, /buildXmlCiiValidatedRigidWeightLegacyView\(basisConfig, basisRows\)/);
assert.match(source, /prepareStandaloneRigidWeightAuthority\(parity, sourceText/);
assert.match(source, /supportConfigJson: JSON\.stringify\(deferStandaloneRigidWeights\(supportConfig\)\)/);
assert.match(source, /const authorityConfig = validated\.config/);
assert.match(source, /applyStandaloneProcessParity\(\s*geometry\.xmlText,\s*authorityConfig/s);
assert.match(source, /validMatch1Weights: validated\.validation\.validCount/);
assert.match(source, /staleMatch1Weights: validated\.validation\.staleCount/);

const validationIndex = source.indexOf('const validated = prepareStandaloneRigidWeightAuthority(');
const processIndex = source.search(/applyStandaloneProcessParity\(\s*geometry\.xmlText/s);
assert.ok(validationIndex >= 0 && processIndex > validationIndex, 'Match-1 must be validated against canonical geometry before Weight is written into the standalone engine input');
assert.match(source, /applyStandaloneAcceptedRigidWeights\(process\.xmlText, validated\)/);

console.log('Issue #776 standalone run validates Match-1 before CII engine release.');
