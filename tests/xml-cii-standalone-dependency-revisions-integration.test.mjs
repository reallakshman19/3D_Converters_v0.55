import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const STATE = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js', import.meta.url);
test('workflow state owns dependency revision initialization and advancement centrally', async () => {
  const source = await readFile(STATE, 'utf8');
  assert.match(source, /initializeDependencyRevisionState/);
  assert.match(source, /advanceDependencyRevisionState/);
  assert.match(source, /parseSupportConfigForState/);
  assert.match(source, /return \{ \.\.\.next, \.\.\.advanceDependencyRevisionState\(/);
});
