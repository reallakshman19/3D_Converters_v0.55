import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adapter = await readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js', import.meta.url), 'utf8');

assert.match(adapter, /config\.weight\.masterRows = weightMasterRows/);
assert.match(adapter, /state\.masterContext\?\.appliedMappingRevision\?\.weight/);
assert.match(adapter, /config\.weight\.masterRevision = appliedWeightRevision/);

const rowsIndex = adapter.indexOf('config.weight.masterRows = weightMasterRows');
const revisionIndex = adapter.indexOf('config.weight.masterRevision = appliedWeightRevision');
assert.ok(rowsIndex >= 0 && revisionIndex > rowsIndex, 'workflow job must stamp the applied Weight Master revision beside the exact master rows used for Match-1 validation');

console.log('Issue #776 workflow job preserves Weight Master revision in the Match-1 basis.');
