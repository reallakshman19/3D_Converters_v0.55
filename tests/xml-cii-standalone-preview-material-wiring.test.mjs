import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildIncrementalPreview,
  resetIncrementalPreviewRuntime,
  snapshotIncrementalPreviewRuntime,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-incremental.js';
import { applyPreviewMaterialCodeAuthority } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js';

const WRAPPER_PATH = new URL(
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js',
  import.meta.url,
);
let moduleId = 0;

function stripImports(source) {
  const out = [];
  let skipping = false;
  for (const line of source.split('\n')) {
    const trimmed = line.trimStart();
    if (!skipping && trimmed.startsWith('import ')) {
      skipping = !line.trimEnd().endsWith(';');
      continue;
    }
    if (skipping) {
      if (line.trimEnd().endsWith(';')) skipping = false;
      continue;
    }
    if (trimmed.startsWith('export * from ')) continue;
    out.push(line);
  }
  return out.join('\n');
}

async function loadWrapper(stubs) {
  const key = `__c5_material_wiring_${moduleId++}`;
  globalThis[key] = stubs;
  const source = fs.readFileSync(WRAPPER_PATH, 'utf8');
  const names = Object.keys(stubs).join(', ');
  const body = `const { ${names} } = globalThis[${JSON.stringify(key)}];\n${stripImports(source)}`;
  return import(`data:text/javascript;base64,${Buffer.from(body).toString('base64')}#${moduleId}`);
}

function config(code) {
  return {
    linelist: { masterRows: [] },
    pipingClass: { masterRows: [] },
    material: { mapRows: [{ code, material: 'A106-B' }] },
    weight: { masterRows: [{ id: 'V1', weight: 10 }] },
    stablePolicy: true,
  };
}

function coreResult() {
  return {
    branchRows: [{
      branchName: 'B1',
      material: 'A106-B',
      materialSource: 'line-list',
      materialCode: '',
      pipingClass: 'A1',
      sizeMm: 100,
    }],
    nodeRows: [{ branchName: 'B1', nodeNumber: '10', selectedWeight: 10 }],
  };
}

test('wrapper wires Material-only callback without replaying XML/Bore/Rating stages', async () => {
  resetIncrementalPreviewRuntime();
  const calls = { source: 0, core: 0, wall: 0, material: 0, rating: 0 };
  const rawSourceDocument = { tag: 'raw-source' };

  const wrapper = await loadWrapper({
    buildCorePreview: () => {
      calls.core += 1;
      return coreResult();
    },
    applyPreviewBoreWallAuthority: ({ result, sourceDocument }) => {
      calls.wall += 1;
      assert.equal(sourceDocument, rawSourceDocument);
      return result;
    },
    applyPreviewMaterialCodeAuthority: (args) => {
      calls.material += 1;
      return applyPreviewMaterialCodeAuthority(args);
    },
    applyPreviewRatingAuthority: ({ result, sourceDocument }) => {
      calls.rating += 1;
      assert.equal(sourceDocument, rawSourceDocument);
      return result;
    },
    rerankPreviewNodeRows: (rows) => rows,
    buildIncrementalPreview,
    getSourceDocumentContext: () => {
      calls.source += 1;
      return { document: rawSourceDocument };
    },
  });

  const first = wrapper.xmlCiiDryRunPreview('<Root/>', config('001'), '{}');
  assert.equal(first.branchRows[0].materialCode, '001');
  const firstNodes = first.nodeRows;
  assert.deepEqual(calls, { source: 1, core: 1, wall: 1, material: 1, rating: 1 });

  const second = wrapper.xmlCiiDryRunPreview('<Root/>', config('002'), '{}');
  assert.equal(second.branchRows[0].materialCode, '002');
  assert.equal(second.nodeRows, firstNodes, 'Material-only path must preserve nodeRows identity');
  assert.deepEqual(calls, { source: 1, core: 1, wall: 1, material: 2, rating: 1 });
  assert.deepEqual(snapshotIncrementalPreviewRuntime(), {
    fullBuilds: 1,
    weightOnlyBuilds: 0,
    branchRowsReused: 0,
    nodeRowsRecomputed: 0,
    materialOnlyBuilds: 1,
    branchRowsRecomputed: 1,
    nodeRowsReused: 1,
    hasCachedPreview: true,
  });

  resetIncrementalPreviewRuntime();
  const fresh = wrapper.xmlCiiDryRunPreview('<Root/>', config('002'), '{}');
  assert.deepEqual(second, fresh, 'Material-only result must deep-equal a fresh full Preview under the new Material Master');
});

test('wrapper retains C6b exact-source custody and explicit Material callback routing', () => {
  const source = fs.readFileSync(WRAPPER_PATH, 'utf8');
  assert.match(source, /getSourceDocumentContext\(xmlText\)\.document/);
  assert.match(source, /fullBuild:\s*\(\)\s*=>\s*buildFullDryRunPreview/);
  assert.match(source, /rerankWeight:\s*rerankPreviewNodeRows/);
  assert.match(source, /reapplyMaterial:\s*\(previousResult, nextConfig\)/);
  assert.match(source, /applyPreviewMaterialCodeAuthority\(\{[\s\S]*config:\s*nextConfig,[\s\S]*result:\s*previousResult/);
});
