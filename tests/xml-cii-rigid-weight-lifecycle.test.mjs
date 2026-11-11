import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  resolveXmlCiiRigidWeight,
  withXmlCiiRigidWeightFinal,
  withXmlCiiRigidWeightMatch1,
  withXmlCiiEffectiveRigidWeightLegacyView,
  xmlCiiEffectiveRigidWeightMap,
} from '../converters/xml-cii2019-core/rigid-weight-authority.js';
import { buildInvocation } from '../converters/invocation-builder.js';
import { compareObservedWeightToEmpiricalEstimate } from '../converters/empirical-weight/empirical-weight-validation.js';

const key = '/UNIT/LINE::100';
const source = {
  overrides: {
    rigidWeight: { [key]: 125 },
  },
};

const legacy = resolveXmlCiiRigidWeight(source, [key]);
assert.equal(legacy.weightKg, 125);
assert.equal(legacy.source, 'legacy-override');

const afterMatch1 = withXmlCiiRigidWeightMatch1(source, { [key]: 12.5 });
assert.equal(afterMatch1.overrides.rigidWeight[key], 125, 'legacy evidence must be retained');
assert.equal(afterMatch1.overrides.rigidWeightMatch1[key], 12.5);
assert.equal(resolveXmlCiiRigidWeight(afterMatch1, [key]).weightKg, 12.5, 'Match-1 must supersede legacy');

const afterFinal = withXmlCiiRigidWeightFinal(afterMatch1, { [key]: 13 });
const finalResolution = resolveXmlCiiRigidWeight(afterFinal, [key]);
assert.equal(finalResolution.weightKg, 13);
assert.equal(finalResolution.source, 'final-review');
assert.equal(afterFinal.overrides.rigidWeightMatch1[key], 12.5, 'Final review must preserve Match-1 evidence');

const revisedMatch1 = withXmlCiiRigidWeightMatch1(afterFinal, { [key]: 11.75 });
assert.equal(revisedMatch1.overrides.rigidWeightMatch1[key], 11.75);
assert.equal(revisedMatch1.overrides.rigidWeightFinal?.[key], undefined, 'changing Match-1 must invalidate stale Final authority');
assert.equal(resolveXmlCiiRigidWeight(revisedMatch1, [key]).weightKg, 11.75);

const effective = xmlCiiEffectiveRigidWeightMap(afterFinal);
assert.equal(effective[key], 13, 'effective compatibility map must follow Final > Match-1 > legacy');
const compatibilityView = withXmlCiiEffectiveRigidWeightLegacyView(afterFinal);
assert.equal(compatibilityView.overrides.rigidWeight[key], 13);
assert.equal(afterFinal.overrides.rigidWeight[key], 125, 'compatibility projection must not mutate persisted legacy evidence');

const invocation = buildInvocation('xml_to_cii', '/job/input.xml', 'input.xml', null, { kgToNewton: true }, '/job');
const scaleFlags = invocation.argv.reduce((out, value, index) => {
  if (value === '--weight-scale') out.push(Number(invocation.argv[index + 1]));
  return out;
}, []);
assert.deepEqual(scaleFlags, [10], 'XML→CII invocation must contain exactly one kg→CII weight scale');
assert.equal(12.5 * scaleFlags[0], 125, '12.5 kg must become 125 CII force units at the final writer boundary');

const pythonPath = fileURLToPath(new URL('../converters/scripts/xml_to_cii2019.py', import.meta.url));
const python = await readFile(pythonPath, 'utf8');
const rigidPayload = python.match(/def _build_rigid_payload[\s\S]*?(?=\ndef |\Z)/)?.[0] || '';
assert(rigidPayload.includes('weight = _rigid_weight_for_edge(edge) * weight_scale'), 'Python rigid writer must apply the configured scale once');
assert(!rigidPayload.includes('weight_scale * weight_scale'), 'Python rigid writer must not square the scale');

const previewPath = fileURLToPath(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js', import.meta.url));
const previewSource = await readFile(previewPath, 'utf8');
assert(previewSource.includes('withXmlCiiEffectiveRigidWeightLegacyView'), 'Preview must consume the effective lifecycle projection');
assert(previewSource.includes('config: previewConfig'), 'Preview authority layers must receive the transient effective view');

const estimate100 = { ok: true, weightKg: 100, approach: 'test' };
for (const observed of [70, 130]) {
  const result = compareObservedWeightToEmpiricalEstimate(observed, estimate100, 30);
  assert.equal(result.abnormal, false, `${observed} kg is exactly on the ±30% boundary and must be within threshold`);
  assert.equal(result.status, 'WITHIN_THRESHOLD');
}
const low = compareObservedWeightToEmpiricalEstimate(69.9, estimate100, 30);
assert.equal(low.abnormal, true);
assert.equal(low.status, 'ABNORMAL_LOW');
const high = compareObservedWeightToEmpiricalEstimate(130.1, estimate100, 30);
assert.equal(high.abnormal, true);
assert.equal(high.status, 'ABNORMAL_HIGH');

const unavailable = compareObservedWeightToEmpiricalEstimate(100, { ok: false, error: { code: 'NO_MODEL', message: 'none' } }, 30);
assert.equal(unavailable.available, false);
assert.equal(unavailable.abnormal, false);
assert.equal(unavailable.status, 'ESTIMATE_UNAVAILABLE', 'missing empirical authority must be neutral, not an all-good result');

console.log('xml-cii rigid weight lifecycle tests: PASS');
