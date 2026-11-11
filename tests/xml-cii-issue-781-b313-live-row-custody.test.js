const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const renderer = read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer.js');
const rendererV7 = read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer-v7.js');
const activation = read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js');
const updateController = read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-update.js');
const auditController = read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-audit-controller.js');

assert(renderer.includes('function publishPreviewResult(host, branchRows = [], nodeRows = [])'));
assert(renderer.includes('host.__xmlCiiPreviewResult = result'));
assert(renderer.includes('const previewResult = publishPreviewResult(host, branchRows, nodeRows)'));
assert(renderer.includes('return previewResult;'));

assert(rendererV7.includes('const legacyResult = await buildLegacyPreview(rootEl, xmlText, config, delegatedOptions)'));
assert(rendererV7.includes('const previewResult = currentPreviewResult(host, legacyResult)'));
assert(rendererV7.includes('branchRows: previewResult.branchRows'));
assert(rendererV7.includes('return previewResult;'));

assert(activation.includes('precomputedPreview:result'),
  'current Worker-attested Preview rows must be published through the existing editable renderer');
assert(activation.includes('if(!previewResult)previewResult=await xmlCiiBuildAndRenderPreview('),
  'non-restorable or non-governed Preview continues through original renderer');
assert(activation.includes('readXml229LivePreviewForCurrentInput'),
  'Worker Preview restoration must validate source, generation and full FactRecords');
assert(activation.includes('rows: previewResult?.branchRows || []'));

assert(updateController.includes('export function selectPreviewB313ActionRows'));
assert(updateController.includes('host?.__xmlCiiPreviewResult?.branchRows'));
assert(updateController.includes('if (liveRows.length) return liveRows'));
assert(updateController.includes('if (supplied.length) return supplied'));
assert(updateController.includes('return normalizePreviewRows(legacyRows)'));
assert(updateController.includes('function installAction(host, config, xmlText, options, suppliedRows)'));
assert(updateController.includes('const rows = currentPreviewB313Rows(host, suppliedRows)'));
assert(!/function installAction[\s\S]*?const rows = readLegacyBranchRows\(\)/.test(updateController), 'Legacy cache must not gate B31.3 action creation.');
assert(updateController.includes('installPreviewB313WallUpdateController({ host, config, xmlText, rows = [], options = {} }'));

const selectorBlock = updateController.match(/function normalizePreviewRows\(rows\) \{[\s\S]*?\n\}\n\nexport function selectPreviewB313ActionRows\([\s\S]*?\n\}/);
assert(selectorBlock, 'Expected production row selector block.');
const selectorFactory = new Function(`${selectorBlock[0].replace('export function', 'function')}; return selectPreviewB313ActionRows;`);
const selectRows = selectorFactory();
const live = [{ id: 'live' }];
const supplied = [{ id: 'supplied' }];
const legacy = [{ id: 'legacy' }];
const ids = (rows) => rows.map((row) => row.id);
assert.deepStrictEqual(ids(selectRows({ host: { __xmlCiiPreviewResult: { branchRows: live } }, suppliedRows: supplied, legacyRows: legacy })), ['live']);
assert.deepStrictEqual(ids(selectRows({ host: {}, suppliedRows: supplied, legacyRows: legacy })), ['supplied']);
assert.deepStrictEqual(ids(selectRows({ host: {}, suppliedRows: [], legacyRows: legacy })), ['legacy']);
assert.deepStrictEqual(ids(selectRows({ host: {}, suppliedRows: [], legacyRows: [] })), []);

assert(auditController.includes('selectPreviewB313ActionRows'));
assert(auditController.includes('const suppliedRows = snapshotRows(rows)'));
assert(auditController.includes('const getLiveRows = () => currentPreviewRows(host, suppliedRows)'));
assert(auditController.includes('const liveRows = normalizeRows(getLiveRows?.())'));
assert(auditController.includes('installPreviewB313WallUpdateController({ host, config, xmlText, rows: suppliedRows, options })'));

console.log('PASS issue #781 B31.3 live Preview row custody contract');
