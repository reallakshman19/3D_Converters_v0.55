import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createMasterDatasetClient } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-client.js';
import { MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';

class ScriptedWorker {
  constructor(mode) {
    this.mode = mode;
    this.listeners = new Map();
    this.terminated = false;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  postMessage(message) {
    if (this.mode === 'stall') return;
    queueMicrotask(() => {
      if (this.mode === 'messageerror') {
        this.listeners.get('messageerror')?.({});
        return;
      }
      this.listeners.get('message')?.({
        data: {
          type: MASTER_DATASET_EVENT.WEIGHT_MATCH_RESULT,
          requestId: message.requestId,
          datasetId: message.datasetId,
          issues: message.issues || [],
        },
      });
    });
  }

  terminate() {
    this.terminated = true;
  }
}

function recoveryClient(firstMode, timeout = 20) {
  const workers = [];
  const client = createMasterDatasetClient({
    weightRequestTimeoutMs: timeout,
    workerFactory: () => {
      const worker = new ScriptedWorker(workers.length ? 'success' : firstMode);
      workers.push(worker);
      return worker;
    },
  });
  return { client, workers };
}

test('Weight ranking recovers once from worker message transport failure', async () => {
  const { client, workers } = recoveryClient('messageerror');
  const result = await client.rankWeightIssues('weight-dataset', [{ key: 'B1::1' }], {}, {});
  assert.equal(result.datasetId, 'weight-dataset');
  assert.equal(workers.length, 2);
  assert.equal(workers[0].terminated, true);
  client.dispose();
});

test('Weight ranking cannot wait forever: timed-out worker is restarted and retried once', async () => {
  const { client, workers } = recoveryClient('stall', 5);
  const result = await client.rankWeightIssues('weight-dataset', [{ key: 'B1::1' }], {}, {});
  assert.equal(result.datasetId, 'weight-dataset');
  assert.equal(workers.length, 2);
  assert.equal(workers[0].terminated, true);
  client.dispose();
});

test('mapping draft status explicitly prompts Apply mapping without modal interruption', () => {
  const source = fs.readFileSync(
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-mapping-events.js',
    'utf8',
  );
  assert.match(source, /Mapping changed — click Apply mapping to use this selection in Preview/);
  assert.doesNotMatch(source, /alert\(['"]Mapping changed/);
});

test('Weight Match bounds async I/O and exposes the lightweight basis/ranking stages', () => {
  const source = fs.readFileSync(
    'tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js',
    'utf8',
  );
  assert.match(source, /withWeightStageTimeout/);
  assert.match(source, /Reading Weight Match inputs/);
  assert.match(source, /Preparing Weight Match basis/);
  assert.doesNotMatch(source, /Preparing Weight Match geometry/);
  assert.match(source, /Ranking \$\{issueRows\.length\} component\(s\)/);
  assert.match(source, /Weight Match timed out during \$\{stage\}/);
});

test('changed runtime files remain byte-identical to docs mirrors', () => {
  for (const path of [
    'tabs/xml-cii-2019-standalone/workers/master-dataset-client.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-mapping-events.js',
    'tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js',
  ]) {
    assert.equal(fs.readFileSync(path, 'utf8'), fs.readFileSync(`docs/${path}`, 'utf8'), path);
  }
});
