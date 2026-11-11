import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createMasterDatasetClient } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-client.js';
import { MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';
import { prepareXmlCiiWeightBasis } from '../tabs/xml-cii-2019-standalone/workers/weight-basis-service.js';

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
  assert.match(source, /xmlCiiWeightRawPayloadText/);
  assert.doesNotMatch(source, /clean\(stagedJsonText\)/);
  assert.doesNotMatch(source, /clean\(stagedSource/);
  assert.match(source, /export function xmlCiiWeightRawPayloadText/);
  assert.match(source, /Reading XML source/);
  assert.match(source, /Resolving staged JSON/);
  assert.match(source, /Preparing Weight Match basis in worker/);
  assert.match(source, /typeof prepareWeightBasis === 'function'/);
  assert.match(source, /onProgress: basisProgressStatus/);
  assert.doesNotMatch(source, /Preparing Weight Match geometry/);
  assert.match(source, /Ranking \$\{issueRows\.length\} component\(s\)/);
  assert.match(source, /Weight Match timed out during \$\{stage\}/);
});


test('worker Weight basis preserves split geometry and Preview rating authority', async () => {
  const xmlText = '<Model><Branch><Branchname>B1</Branchname>'
    + '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType><Position>0 0 0</Position></Node>'
    + '<Node><NodeNumber>-1</NodeNumber><NodeName>GATE VALVE</NodeName><ComponentType>VALV</ComponentType><ComponentRefNo>V-1</ComponentRefNo><Endpoint>2</Endpoint><BoreMm>100</BoreMm><Position>100 0 0</Position></Node>'
    + '<Node><NodeNumber>20</NodeNumber><ComponentType>PIPE</ComponentType><Position>100 0 0</Position></Node>'
    + '</Branch></Model>';
  const stagedJsonText = JSON.stringify([{
    type: 'VALV',
    attributes: { REF: 'V-1', APOS: '0 0 0', LPOS: '100 0 0', DTXR_POS: 'GATE VALVE' },
  }]);
  const stages = [];
  const result = await prepareXmlCiiWeightBasis({
    xmlText,
    stagedJsonText,
    config: { splitCondensedValveFlange: true, split_condensed_valve_flange: true, overrides: {} },
    geometryConfig: { splitCondensedValveFlange: true, split_condensed_valve_flange: true, overrides: {} },
    previewRatingSnapshot: {
      schema: 'xml-cii-preview-rating-snapshot/v2',
      revision: 'worker-basis-test',
      records: [{
        branchName: 'B1',
        branchIdentity: 'B1',
        lineKey: 'P0310051',
        lineKeyIdentity: 'P0310051',
        pipingClass: '61440',
        pipingClassIdentity: '61440',
        sizeMm: '100',
        rating: '150',
        ratingSource: 'test',
      }],
    },
    onProgress: ({ stage }) => stages.push(stage),
  });
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].rating, '150');
  assert.equal(result.issues[0].lineKey, 'P0310051');
  assert.equal(result.issues[0].requestedPipingClass, '61440');
  assert.equal(result.issues[0].resolvedPipingClass, '61440');
  assert.equal(result.issues[0].boreMm, 100);
  assert.ok(Number(result.issues[0].lengthMm) > 6);
  assert.notEqual(result.issues[0].key, 'B1::-1');
  assert.ok(stages.includes('preparing-geometry'));
  assert.ok(stages.includes('validating-match1'));
});


test('Weight basis collector does not hydrate unrelated applied master datasets', () => {
  const service = fs.readFileSync(
    'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js',
    'utf8',
  );
  const model = fs.readFileSync(
    'converters/xml-cii2019-core/weight-match-model.js',
    'utf8',
  );
  assert.doesNotMatch(service, /hydrateWeightBasisConfig/);
  assert.match(service, /stage: 'using-preview-authority'/);
  assert.match(model, /lightweightBasis \? null : buildPipingClassIndex/);
  assert.match(model, /skipKnownNonReviewDtxr: true/);
  assert.match(model, /isKnownNonWeightReviewType\(componentType\)/);
});

test('changed runtime files remain byte-identical to docs mirrors', () => {
  for (const path of [
    'converters/xml-cii2019-core/weight-match-model.js',
    'converters/xml-cii2019-core/piping-class-resolver.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-client.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js',
    'tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js',
    'tabs/xml-cii-2019-standalone/workers/weight-basis-service.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-mapping-events.js',
    'tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js',
  ]) {
    assert.equal(fs.readFileSync(path, 'utf8'), fs.readFileSync(`docs/${path}`, 'utf8'), path);
  }
});
