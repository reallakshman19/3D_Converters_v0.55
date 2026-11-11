import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const tempRoot = await mkdtemp(join(tmpdir(), 'xml-cii-strict-line-authority-'));
const sourcePath = 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js';

async function copy(relativePath) {
  const target = join(tempRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(fileURLToPath(new URL(relativePath, root)), target);
}

await writeFile(join(tempRoot, 'package.json'), '{"type":"module"}', 'utf8');
await copy(sourcePath);
// Explicit module-loading substitute; body-bore behavior is exercised by the
// real Preview/Worker/native transfer regression, not this line-match unit.
await mkdir(join(tempRoot, 'tabs/xml-cii-2019-standalone/integration'), {recursive:true});
await writeFile(join(tempRoot, 'tabs/xml-cii-2019-standalone/integration/xml229-component-body-bore.mjs'),
  'export function applyXml229ComponentBodyBores({result}) { return result; }\n', 'utf8');

await mkdir(join(tempRoot, 'converters/xml-cii2019-core'), { recursive: true });
await writeFile(join(tempRoot, 'converters/xml-cii2019-core/dtxr-resolver.js'), [
  'let rebuilds = 0;',
  'export function buildStagedDtxrIndex(json, config) {',
  '  rebuilds += 1;',
  '  return { sourceText: json, config, rebuilt: rebuilds };',
  '}',
  'export function stagedIndexBuildCount() { return rebuilds; }',
  '',
].join('\n'), 'utf8');

const moduleDir = join(tempRoot, 'tabs/xml-cii-2019-standalone/ui-adapted');
await mkdir(moduleDir, { recursive: true });
// The imported production wrapper has these static/runtime dependencies.
// Test substitutes no scorers; only the module-loading side effects are inert.
await writeFile(join(moduleDir, 'xml-cii-adapted-authority-migration.js'),
  'export {};\n', 'utf8');
await writeFile(join(tempRoot, 'converters/xml-cii2019-core/rigid-weight-authority.js'),
  'export function withXmlCiiEffectiveRigidWeightLegacyView(config) { return config; }\n', 'utf8');
await mkdir(join(tempRoot, 'tabs'), { recursive: true });
await writeFile(join(tempRoot, 'tabs/xml-cii-effective-class-shard-hydrator.js'),
  'export function installXmlCiiEffectiveClassShardHydrator() {}\n', 'utf8');
await writeFile(join(moduleDir, 'xml-cii-adapted-preview-dryrun-core.js'), `
export function xmlCiiDryRunPreview() { return { branchRows: [], nodeRows: [] }; }
`, 'utf8');
for (const file of [
  'xml-cii-adapted-preview-bore-wall-authority.js',
  'xml-cii-adapted-preview-material-authority.js',
  'xml-cii-adapted-preview-rating-authority.js',
]) {
  const exportName = file.includes('bore-wall')
    ? 'applyPreviewBoreWallAuthority'
    : (file.includes('material') ? 'applyPreviewMaterialCodeAuthority' : 'applyPreviewRatingAuthority');
  const extra = file.includes('rating')
    ? 'export function rerankPreviewNodeRows(rows) { return rows; }\n'
    : '';
  await writeFile(join(moduleDir, file), `export function ${exportName}({ result }) { return result; }\n${extra}`, 'utf8');
}
await writeFile(join(moduleDir, 'xml-cii-adapted-preview-incremental.js'), `
export function buildIncrementalPreview({ fullBuild }) { return { result: fullBuild() }; }
`, 'utf8');
await writeFile(join(moduleDir, 'xml-cii-adapted-source-derived-context.js'), `
export function getSourceDocumentContext() { return { document: null }; }
`, 'utf8');
await writeFile(join(moduleDir, 'xml-cii-adapted-preview-line-index.js'), `
export function preparePreviewLineListCoreConfig(sourceDocument, config) {
  if (!sourceDocument?.__lineIndexTest) return { config, indexed: false };
  return { config: { ...config, linelist: { ...(config.linelist || {}), masterRows: ['INDEXED_VIEW'] } }, indexed: true };
}
`, 'utf8');

const strict = await import(pathToFileURL(join(tempRoot, sourcePath)).href);
after(() => rm(tempRoot, { recursive: true, force: true }));

test('first core build receives prepared lookup view while strict rebuild remains fail-closed', () => {
  const calls = [];
  const sourceDocument = { __lineIndexTest: true };
  strict.buildStrictLineAuthorityCorePreview('<Plant/>', {
    linelist: { masterRows: [{ lineKey: 'FULL_MASTER' }] },
  }, '', {
    sourceDocument,
    buildCorePreview: (_xmlText, config) => {
      calls.push(config.linelist.masterRows);
      if (calls.length === 1) {
        return {
          branchRows: [{ branchName: '/X/B1', lineKeyMethod: 'similar-linekey' }],
          nodeRows: [],
        };
      }
      return { branchRows: [{ branchName: '/X/B1', lineKeyMethod: 'none' }], nodeRows: [] };
    },
    branchFragments: () => [{ xmlText: '<Root><Branch/></Root>' }],
  });
  assert.deepEqual(calls[0], ['INDEXED_VIEW']);
  assert.deepEqual(calls[1], []);
});

test('automatic similar-linekey and similar-lineseq methods are rejected', () => {
  assert.equal(strict.isAutomaticLineNumberMatchMethod('similar-linekey'), true);
  assert.equal(strict.isAutomaticLineNumberMatchMethod('similar-lineseq'), true);
  assert.equal(strict.isAutomaticLineNumberMatchMethod('exact'), false);
  assert.equal(strict.isAutomaticLineNumberMatchMethod('override'), false);
});

test('fuzzy Preview row is rebuilt without Line List master authority', () => {
  const calls = [];
  const buildCorePreview = (xmlText, config) => {
    calls.push({ xmlText, rows: config?.linelist?.masterRows || [] });
    if (calls.length === 1) {
      return {
        branchRows: [
          {
            branchName: '/ASIM-1841-3"-S8810793-91261M7-01/B2',
            lineKey: 'S8810793',
            lineKeyMethod: 'exact',
            lineKeyConfidence: 1,
            lineMiss: false,
            p1: '11600',
          },
          {
            branchName: '/ASIM-1840-3"-S8810XXX-91261M7-09/B1',
            lineKey: 'S8810XXX',
            lineKeyMethod: 'similar-linekey',
            lineKeyConfidence: 0.85,
            lineKeyProposed: 'A8810145',
            lineMiss: false,
            lineFrom: 'PL-2"-G8810027',
            lineTo: '88-UZV-10953',
            p1: '1100',
          },
        ],
        nodeRows: [
          { branchName: '/ASIM-1841-3"-S8810793-91261M7-01/B2', key: 'exact-node' },
          { branchName: '/ASIM-1840-3"-S8810XXX-91261M7-09/B1', key: 'fuzzy-node', rating: '900' },
        ],
      };
    }
    assert.deepEqual(config.linelist.masterRows, []);
    return {
      branchRows: [{
        branchName: '/ASIM-1840-3"-S8810XXX-91261M7-09/B1',
        lineKey: 'S8810XXX',
        lineKeyMethod: 'none',
        lineKeyConfidence: 0,
        lineKeyProposed: '',
        lineMiss: true,
        lineFrom: '',
        lineTo: '',
        p1: '',
      }],
      nodeRows: [{ branchName: '/ASIM-1840-3"-S8810XXX-91261M7-09/B1', key: 'strict-node' }],
    };
  };

  const result = strict.buildStrictLineAuthorityCorePreview('<Plant/>', {
    linelist: { masterRows: [{ lineKey: 'A8810145' }] },
  }, '', {
    buildCorePreview,
    branchFragments: () => [
      { xmlText: '<Root><Branch id="exact"/></Root>' },
      { xmlText: '<Root><Branch id="fuzzy"/></Root>' },
    ],
  });

  assert.equal(calls.length, 2);
  assert.equal(result.branchRows[0].lineKeyMethod, 'exact');
  assert.equal(result.branchRows[0].p1, '11600');
  assert.equal(result.branchRows[1].lineKey, 'S8810XXX');
  assert.equal(result.branchRows[1].lineKeyMethod, 'none');
  assert.equal(result.branchRows[1].lineMiss, true);
  assert.equal(result.branchRows[1].lineKeyProposed, '');
  assert.equal(result.branchRows[1].p1, '');
  assert.equal(result.branchRows[1].automaticLineMatchRemoved, true);
  assert.equal(result.strictLineAuthority.automaticMatchesRemoved, 1);
  assert.deepEqual(result.nodeRows.map((row) => row.key).sort(), ['exact-node', 'strict-node']);
});

test('explicit branch mapping that resolves exactly is preserved', () => {
  let calls = 0;
  const result = strict.buildStrictLineAuthorityCorePreview('<Plant/>', {
    linelist: {
      branchLineKeyMap: {
        '/ASIM-1840-3"-S8810XXX-91261M7-08/B1': 'S8810791',
      },
      masterRows: [{ lineKey: 'S8810791' }],
    },
  }, '', {
    buildCorePreview: () => {
      calls += 1;
      return {
        branchRows: [{
          branchName: '/ASIM-1840-3"-S8810XXX-91261M7-08/B1',
          lineKey: 'S8810791',
          lineKeyMethod: 'exact',
          lineKeyConfidence: 1,
          lineMiss: false,
          p1: '11600',
        }],
        nodeRows: [],
      };
    },
    branchFragments: () => [],
  });
  assert.equal(calls, 1);
  assert.equal(result.branchRows[0].lineKey, 'S8810791');
  assert.equal(result.branchRows[0].lineKeyMethod, 'exact');
  assert.equal(result.branchRows[0].p1, '11600');
});

test('strict Line List authority invalidates cached non-weight Preview basis', async () => {
  const source = await readFile(fileURLToPath(new URL(`../${sourcePath}`, import.meta.url)), 'utf8');
  assert.match(source, /strict-explicit-or-exact-v1/);
  assert.match(source, /buildIncrementalPreview\(\{/);
  assert.match(source, /automaticMatchesRemoved/);
  assert.doesNotMatch(source, /lineKeyProposed:\s*similar\.proposedKey/);

  const {buildIncrementalPreview,resetIncrementalPreviewRuntime} = await import(
    new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-incremental.js', import.meta.url));
  resetIncrementalPreviewRuntime();
  let fullBuilds=0,weightOnly=0;
  const evaluate=config=>buildIncrementalPreview({
    xmlText:'<Plant><Branch/></Plant>',stagedJsonText:'{"source":"A"}',config,
    fullBuild:()=>{fullBuilds++;return {branchRows:[{lineKeyMethod:'none'}],nodeRows:[]};},
    rerankWeight:()=>{weightOnly++;return [];},
  });
  evaluate({linelist:{allowSimilar:true},weight:{revision:1}});
  evaluate({linelist:{allowSimilar:false},weight:{revision:2}});
  assert.equal(fullBuilds,2,'strict Line List configuration drift must force full Preview');
  assert.equal(weightOnly,0,'cannot reuse old fuzzy branch rows through weight-only cache');
  resetIncrementalPreviewRuntime();
});


test('multiple strict branch repairs share one staged JSON index without changing rejection', async () => {
  const indexModule = await import(pathToFileURL(join(
    tempRoot, 'converters/xml-cii2019-core/dtxr-resolver.js')).href);
  const before = indexModule.stagedIndexBuildCount();
  const seen = [];
  const output = strict.buildStrictLineAuthorityCorePreview('<Plant/>', {
    linelist: { masterRows: [{ lineKey: 'A-11' }] },
  }, '{"staged":"original-DTXR"}', {
    buildCorePreview: (_xml, config, _json, runtime = {}) => {
      seen.push({ config, runtime });
      if (seen.length === 1) return {
        branchRows: [
          { branchName:'A', lineKeyMethod:'similar-linekey' },
          { branchName:'B', lineKeyMethod:'similar-lineseq' },
        ],
        nodeRows: [],
      };
      return { branchRows:[{lineKeyMethod:'none'}], nodeRows:[] };
    },
    branchFragments: () => [
      {xmlText:'<Root><Branch name="A"/></Root>'},
      {xmlText:'<Root><Branch name="B"/></Root>'},
    ],
  });
  assert.equal(indexModule.stagedIndexBuildCount() - before, 1,
    'full staged JSON DTXR index constructed only once for both fragments');
  assert.equal(seen.length, 3, 'initial full build plus two strict fragments');
  assert.strictEqual(seen[1].runtime.stagedIndex, seen[2].runtime.stagedIndex);
  assert.deepEqual(seen[1].config.linelist.masterRows, []);
  assert.equal(output.strictLineAuthority.automaticMatchesRemoved, 2);
  assert(output.branchRows.every(row => row.lineKeyMethod === 'none'));
});

test('without automatic matches the optimization builds no staged JSON index', async () => {
  const indexModule = await import(pathToFileURL(join(
    tempRoot, 'converters/xml-cii2019-core/dtxr-resolver.js')).href);
  const before = indexModule.stagedIndexBuildCount();
  const output = strict.buildStrictLineAuthorityCorePreview('<Plant/>', {}, '{"large":"json"}', {
    buildCorePreview: () => ({branchRows:[{branchName:'A',lineKeyMethod:'exact'}],nodeRows:[]}),
    branchFragments: () => { throw new Error('No branch repair should be performed'); },
  });
  assert.equal(indexModule.stagedIndexBuildCount(), before);
  assert.equal(output.branchRows[0].lineKeyMethod, 'exact');
});
