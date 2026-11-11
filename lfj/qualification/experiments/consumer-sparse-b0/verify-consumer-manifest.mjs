/** B0-01 source-pinned manifest oracle; no product changes or inferred credit. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../../../..',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('./consumer-field-manifest.proposal.json',import.meta.url),'utf8'));
assert.equal(manifest.schema,'LFJ.B0.ConsumerFieldManifestProposal.v1');
assert.equal(manifest.status,'PROPOSAL_ONLY_NOT_ACCEPTED');
const blob=new Map();
for(const {path,git_blob_sha} of manifest.source_bindings){
  const source=await readFile(new URL(path,root));
  const sha=createHash('sha1')
    .update(Buffer.from('blob '+source.length+'\0'))
    .update(source).digest('hex');
  assert.equal(sha,git_blob_sha,'source changed; refresh consumer contract: '+path);
  blob.set(path,source.toString('utf8'));
}
const fields=blob.get('tabs/xml-cii-2019-standalone/xml-cii-json-trace-fields.js');
const captureBlock=fields.split('DEFAULT_JSON_TRACE_CAPTURE_FIELDS = Object.freeze([')[1]?.split(']);')[0];
assert.ok(captureBlock,'default capture-field block missing');
const actualCapture=[...captureBlock.matchAll(/\{ name: '([^']+)'/g)].map(m=>m[1]);
assert.deepEqual(actualCapture,manifest.resolver.capture_field_defaults,
  'configured Resolver defaults drift from the proposed manifest');
const primary=fields.match(/PRIMARY_FIELD_ORDER = Object.freeze\(\[([^\]]+)\]\)/)?.[1];
assert.ok(primary);
assert.deepEqual([...primary.matchAll(/'([^']+)'/g)].map(m=>m[1]),
  manifest.resolver.primary_descriptor_order);
const adapter=blob.get('converters/xml-cii2019-core/source-schema-adapter.js');
const rolesBlock=adapter.split('const LEGACY_FIELDS = Object.freeze({')[1]?.split('});')[0];
assert.ok(rolesBlock,'LEGACY_FIELDS block missing');
const actualRoles={};
for(const match of rolesBlock.matchAll(/^\s+(\w+):\s+\[([^\]]*)\],?/gm))
  actualRoles[match[1]]=[...match[2].matchAll(/'([^']+)'/g)].map(m=>m[1]);
assert.deepEqual(actualRoles,manifest.resolver.legacy_semantic_roles,
  'consumer field/alias role contract drifted');
assert.equal(Object.keys(actualRoles).length,20);
const ledger=blob.get('tabs/xml-cii-2019-standalone/xml-cii-trace-resolution-ledger.js');
for(const required of ['walkStaged(', 'context.branchName','context.point','context.bore',
  'supportTags(', 'sourceFieldEvidence('])
  assert.ok(ledger.includes(required),'expected consumer path missing: '+required);
const context=blob.get('tabs/xml-cii-2019-standalone/stagedjson-enrichment/stagedjson-branch-context.js');
for(const name of ['sourceAttributes','APOS','LPOS','CENTER','SCHEDULE','RATING'])
  assert.ok(context.includes(name),'enrichment expected field missing: '+name);
assert.equal(manifest.authority_boundaries.engineering_readiness,false);
console.log('LFJ_B0_CONSUMER_MANIFEST_SOURCE_ORACLE_PASS '+JSON.stringify({
  sourceFiles:manifest.source_bindings.length,
  defaultCapturedFields:actualCapture.length,
  semanticRoles:Object.keys(actualRoles).length,
  status:'CONTRACT_PROPOSAL_ONLY',
  basis:manifest.source_baseline
}));
