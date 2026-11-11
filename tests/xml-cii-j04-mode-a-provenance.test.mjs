import assert from 'node:assert/strict';
import test from 'node:test';

import { buildModeAConsolidatedPreview } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated.js';
import { composeModeASupportConfig } from '../tabs/xml-cii-2019-standalone/xml-cii-mode-a-batch.js';

test('Mode A retains source-specific match provenance and distinguishes blocked engineering identity', async () => {
  const executionRows = [
    { source: { sourceId: 'A', fileName: 'a.xml' }, state: { sourceText: 'a.xml' } },
    { source: { sourceId: 'B', fileName: 'b.xml' }, state: { sourceText: 'b.xml' } },
  ];
  const result = await buildModeAConsolidatedPreview({}, {
    executionRows: () => executionRows,
    configBuilder: () => ({}),
    previewBuilder: (xml) => ({
      branchRows: [xml === 'a.xml'
        ? { branchName: 'B-F2', lineKey: 'S8822000', pipingClass: '91261M7', lineMiss: false,
            extractionStatus: 'MATCHED', matchedFormatIndex: 1, agreeingFormatIndices: [1] }
        : { branchName: 'B-CONFLICT', lineKey: '', pipingClass: '', lineMiss: true,
            extractionStatus: 'AMBIGUOUS', matchedFormatIndex: null,
            branchIdentityConflict: 'EXACT_LINE_LIST_CLASS_CONFLICT' }],
      nodeRows: [],
    }),
    yieldUi: async () => {},
  });
  assert.equal(result.sourceCount, 2);
  assert.equal(result.identityBlockedCount, 1);
  assert.deepEqual(
    [result.rows[0].sourceId, result.rows[0].extractionStatus,
      result.rows[0].matchedFormatIndex, result.rows[0].agreeingFormatIndices[0]],
    ['A', 'MATCHED', 1, 1],
  );
  assert.deepEqual(
    [result.rows[1].sourceId, result.rows[1].extractionStatus,
      result.rows[1].branchIdentityConflict, result.rows[1].pipingClass],
    ['B', 'AMBIGUOUS', 'EXACT_LINE_LIST_CLASS_CONFLICT', ''],
  );
});

test('Mode A shares format rules but retains source-local reviewed line mapping and overrides', () => {
  const shared = {
    regexTester: { formats: [{ lineKey: { regex: 'F1' } }, { lineKey: { regex: 'F2' } }] },
    linelist: { branchLineKeyMap: { OLD: 'OLD' } },
    overrides: { rating: { OLD: '900' } },
  };
  const source = {
    regexTester: { formats: [{ lineKey: { regex: 'SHOULD_NOT_REPLACE_GLOBAL' } }] },
    linelist: { branchLineKeyMap: { '/BRANCH': 'S8822000' } },
    overrides: { rating: { S8822000: '1500' } },
  };
  const result = JSON.parse(composeModeASupportConfig(JSON.stringify(shared), JSON.stringify(source)));
  assert.equal(result.regexTester.formats.length, 2);
  assert.equal(result.regexTester.formats[1].lineKey.regex, 'F2');
  assert.deepEqual(result.linelist.branchLineKeyMap, { '/BRANCH': 'S8822000' });
  assert.deepEqual(result.overrides.rating, { S8822000: '1500' });
});
