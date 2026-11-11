import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../../',import.meta.url);
const files = [
  ['tabs/model-converters-tab.js','model-converters/index.js'],
  ['tabs/model-converters/index.js','ModelConvertersTab-fbx2-managed-reference.js'],
  ['tabs/model-converters/ModelConvertersTab-fbx2-managed-reference.js','ModelConvertersTab.js'],
  ['tabs/model-converters/ModelConvertersTab.js','legacy-adapter.js'],
];
for (const [file, child] of files) {
  const s = await readFile(new URL(file,root),'utf8');
  assert.ok(s.includes(child+'?v=20261008-txt-tree-ux-r5-1'),
    'Runtime import chain not updated: '+file+' → '+child);
}
const legacy = await readFile(new URL('tabs/model-converters/legacy-adapter.js',root),'utf8');
const popup = await readFile(new URL('tabs/model-converters/att-native-scope-popup.js',root),'utf8');
const converter = await readFile(new URL('tabs/model-converters/converters/rvmattr-to-xml.js',root),'utf8');
assert.match(legacy,/scopeSelection = await openAttNativeScopePopup/);
assert.match(legacy,/runValues\.rvmScope = scopeSelection/);
assert.match(popup,/data-native-full/);
assert.match(popup,/data-native-confirm/);
assert.match(popup,/partial.length/);
assert.match(converter,/parseRmssStructuralMembers/);
assert.match(converter,/nativeFiltered/);
console.log('test-att-native-runtime-cache-chain: PASS newly shipped H1-H4 live path');
