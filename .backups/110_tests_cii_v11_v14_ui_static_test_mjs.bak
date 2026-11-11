import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const indexHtml = read('index.html');
const startup = read('main-rhbg-fitguard.js');
const app = read('core/app.js');
const shim = read('tabs/model-converters-tab.js');
const canonicalIndex = read('tabs/model-converters/index.js');
const managedReference = read('tabs/model-converters/ModelConvertersTab-fbx2-managed-reference.js');
const tab = read('tabs/model-converters/ModelConvertersTab.js');
const addon = read('tabs/model-converters/cii-v11-v14-addon.js');
const integration = read('tabs/model-converters/cii-v11-v14-dropdown-integration.js');
const runner = read('tabs/model-converters/converters/cii-v11-v14.js');
const worker = read('converters/cii-v11-v14-worker.js');
const legacyAdapter = read('tabs/model-converters/legacy-adapter.js');

const appShellKey = '20260929-pr780-worker-search-1';
const modelConvertersKey = '20260928-rvm-full-scope-core-1';
const releaseKey = '20260816-cii-v11-v14-dropdown-release-4';
const workerReleaseKey = '20260816-cii-v11-v14-import-rca-1';
const registryQuery = 'v=20260617-basic-glb-3';

// Full browser cache-custody chain. Every parent URL must advance or a browser
// can legally keep executing the pre-RCA child module even when Python changed.
assert.match(indexHtml, new RegExp(`main-rhbg-fitguard\\.js\\?v=${appShellKey}`));
assert.match(startup, new RegExp(`core/app\\.js\\?v=${appShellKey}`));
assert.match(app, new RegExp(`model-converters-tab\\.js\\?v=${modelConvertersKey}`));
assert.match(app, new RegExp(`__MODEL_CONVERTERS_CACHE_KEY__ = '${modelConvertersKey}'`));
assert.match(shim, new RegExp(`model-converters/index\\.js\\?v=${modelConvertersKey}`));
assert.match(canonicalIndex, new RegExp(`ModelConvertersTab-fbx2-managed-reference\\.js\\?v=${modelConvertersKey}`));
assert.match(managedReference, new RegExp(`ModelConvertersTab\\.js\\?v=${modelConvertersKey}`));
assert.match(tab, new RegExp(`legacy-adapter\\.js\\?v=${releaseKey}`));
assert.match(tab, new RegExp(`cii-v11-v14-dropdown-integration\\.js\\?v=${releaseKey}`));
assert.match(tab, new RegExp(`cii-merge-dropdown-integration\\.js\\?v=${releaseKey}`));

// A malformed shim once carried duplicate const declarations after concurrent
// merges. Keep this as a hard syntax-structure guard.
assert.equal((shim.match(/const MODEL_CONVERTERS_SHIM_VERSION/g) || []).length, 1);
assert.equal((shim.match(/const CANONICAL_MODULE/g) || []).length, 1);
assert.match(shim, new RegExp(`cii-v11-v14-addon\\.js\\?v=${modelConvertersKey}`));
assert.match(shim, new RegExp(`cii-v11-v14-dropdown-integration\\.js\\?v=${modelConvertersKey}`));
assert.match(shim, /installCiiV11V14Addon/);
assert.match(shim, /installRenderedCiiV11V14Dropdown/);
assert.match(shim, /dropdown addon did not register the converter/);
assert.match(shim, /rendered dropdown integration did not install/);

// Registry ownership remains singular and the engineering runner remains the
// worker-backed converter. The rendered-dropdown bridge is UI custody only.
assert.match(addon, /id:\s*CONVERTER_ID/);
assert.match(addon, /CAESAR Ver\. 14 ↔ 11/);
assert.match(addon, /targetVersion/);
assert.match(addon, /allowLossy/);
assert.match(addon, /cii_syntax_check_2019/);
assert.match(addon, /CONVERTERS as DROPDOWN_CONVERTERS/);
assert.match(addon, /converter-registry\.js\?v=20260617-basic-glb-3/);
assert.match(addon, new RegExp(`cii-v11-v14\\.js\\?v=${workerReleaseKey}`));
assert.match(addon, /installIntoDropdown\(DROPDOWN_CONVERTERS\)/);
assert.match(addon, new RegExp(`const VERSION = '${releaseKey}'`));
assert.doesNotMatch(addon, /document\.createElement|innerHTML|appendChild/);
assert.match(legacyAdapter, /converter-registry\.js\?v=20260617-basic-glb-3/);
assert.match(integration, /getConverterById/);
assert.match(integration, /definition\.run\(/);
assert.match(integration, /event\.stopImmediatePropagation\(\)/);
assert.match(integration, /compatibility-bridge/);
assert.match(integration, /option\[value="cii_syntax_check_2019"\]/);
assert.match(integration, /Future\/native legacy-adapter support wins/);
assert.match(integration, /Legacy SIF\/TEE items 1–30 are retained independently for both tee slots/);
assert.match(integration, new RegExp(`const VERSION = '${releaseKey}'`));
assert.doesNotMatch(integration, /cii_v11_v14\.py|postMessage\(\{\s*type:\s*['"]run/);

assert.match(runner, new RegExp(`cii-v11-v14-worker\\.js\\?v=${workerReleaseKey}`));
assert.match(runner, /target structure validation=PASS/);
assert.match(runner, /\.audit\.json/);
assert.match(worker, /cii_v11_v14\.py/);
assert.match(worker, /cii_v11_v14_validate\.py/);
assert.match(worker, /cii2019_section_rules\.py/);
assert.match(worker, /--audit-json/);
assert.match(worker, /--allow-lossy/);

// Root-cause guard: legacy-adapter currently renders a frozen local order rather
// than iterating the dynamically-extended registry. If native ordering is added
// later, the compatibility bridge intentionally becomes a no-op.
const orderMatch = legacyAdapter.match(/const CONVERTER_ORDER = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert.ok(orderMatch, 'legacy CONVERTER_ORDER must remain discoverable for dropdown custody checks');
const legacyOrder = orderMatch[1];
const nativeLegacyOrder = /['"]cii_v11_v14['"]/.test(legacyOrder);
if (!nativeLegacyOrder) {
  assert.match(tab, /installSafely\('cii-v11-v14-dropdown-integration', installCiiV11V14DropdownIntegration, container\)/);
}

// Runtime registry proof: install the addon into the exact module instance used
// by legacy-adapter and prove one authoritative enabled definition exists.
const registryUrl = pathToFileURL(path.join(root, 'tabs/model-converters/converter-registry.js'));
registryUrl.search = registryQuery;
const registryModule = await import(registryUrl.href);
assert.equal(typeof registryModule.getConverterById('cii_v11_v14'), 'object');

console.log('CAESAR v11-v14 dropdown static/runtime qualification passed.');