import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const modulePath='tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';
test('real production EF05 Chromium harness imports state from the active site base URL',async()=>{
  const runner=await readFile(new URL('../scripts/xml229-ef05-native-output-e2e.mjs',import.meta.url),'utf8');
  assert.ok(runner.includes("new URL('"+modulePath+"',document.baseURI).href"),
    'E2E must import a document-relative URL, never the domain root on GitHub Pages');
  assert.equal(runner.includes("'/" + modulePath),false);
  assert.equal(new URL(modulePath,'http://127.0.0.1:4173/index.html').href,
    'http://127.0.0.1:4173/'+modulePath);
  assert.equal(new URL(modulePath,'https://reallakshman19.github.io/3D_Converters/index.html').href,
    'https://reallakshman19.github.io/3D_Converters/'+modulePath);
});

test('hosted app-shell retries happen only before original XML or decision scope exists',async()=>{
  const runner=await readFile(new URL('../scripts/xml229-ef05-native-output-e2e.mjs',import.meta.url),'utf8');
  assert.ok(runner.includes('const maxBootstrapAttempts=siteUrl===DEPLOYED_E2E_URL?3:1'));
  assert.ok(runner.includes("await page.locator('[data-phase=\"source\"]').waitFor"));
  assert.ok(runner.indexOf('for(let attempt=1;attempt<=maxBootstrapAttempts;attempt++)')
    <runner.indexOf("setInputFiles(xmlPath)"));
  assert.ok(runner.includes("if(attempt===maxBootstrapAttempts)throw error"));
  assert.ok(runner.includes('record.stages.bootstrapAttempts.push'));
});
