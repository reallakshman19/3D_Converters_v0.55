// DEPLOY-GATE U01 test-first real source-to-docs byte equality.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('docs/lfj/deployment-manifest.json','utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
test('V4.1 shipped Worker/module import closure is byte-exact to canonical LFJ source',async()=>{
  assert.equal(manifest.schema,'LFJ.V4.1.DeployedModuleManifest.v1');
  assert.equal(manifest.engineeringReady,false);
  assert.equal(manifest.resolverWired,false);
  assert.ok(manifest.sources.length>=11,'all dynamic imports need exact source mirrors');
  for(const source of manifest.sources){
    assert.ok(source.startsWith('lfj/'));
    const mirror='docs/'+source;
    const [original,published]=await Promise.all([readFile(source),readFile(mirror)]);
    assert.equal(sha(published),sha(original),'stale deployed source: '+source);
  }
});
test('V4.1 deployed original Resolver scope mirrors cannot lag source owners',async()=>{
  for(const path of [
    'tabs/xml-cii-2019-standalone/xml-cii-json-hierarchy-scope.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-resolver-scope.js'
  ]){
    const [source,deployed]=await Promise.all([readFile(path),readFile('docs/'+path)]);
    assert.equal(sha(deployed),sha(source),'deployed Resolver mirror diverges '+path);
  }
});
