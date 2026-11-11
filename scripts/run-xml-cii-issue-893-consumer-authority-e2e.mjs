import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.XML_CII_ISSUE_893_URL || 'http://127.0.0.1:4173';
const outputPath = process.env.XML_CII_ISSUE_893_OUTPUT || 'ValidationRecords/xml-cii-issue-893-consumer-authority.json';

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
      lastError = new Error('HTTP ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('server unavailable at ' + url + ': ' + lastError);
}

const seedUrl = baseUrl + '/tests/browser/xml-cii-issue-892-three-master-cold-reload-e2e.html';
await waitForServer(seedUrl);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log('[browser:' + message.type() + '] ' + message.text()));
  page.on('pageerror', (error) => console.error('[browser:pageerror] ' + (error.stack || error)));

  await page.goto(seedUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__XML_CII_ISSUE_892_DONE__ === true, null, { timeout: 300_000 });
  const seed = await page.evaluate(() => globalThis.__XML_CII_ISSUE_892_RESULT__);
  if (!seed?.ok) throw new Error(seed?.error || 'Issue 892 seed lifecycle failed');

  const result = await page.evaluate(async () => {
    const v = '20261007-c05-6-2-consumer-authority-1';
    const [
      hydration,
      configModule,
      regexModule,
      weightModule,
      runtime,
    ] = await Promise.all([
      import('../../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js?v=' + v),
      import('../../tabs/xml-cii-2019-standalone/xml-cii-dataset-backed-config.js?v=' + v),
      import('../../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js?v=' + v),
      import('../../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js?v=' + v),
      import('../../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js?v=' + v),
    ]);

    function requireValue(condition, message) {
      if (!condition) throw new Error(message);
    }
    async function expectReject(fn, pattern, label) {
      try {
        await fn();
      } catch (error) {
        requireValue(pattern.test(String(error?.message || error)), label + ': unexpected error ' + String(error?.message || error));
        return String(error?.message || error);
      }
      throw new Error(label + ': expected rejection');
    }
    function blankContext() {
      return {
        config: {}, rawRows: {}, mappingRows: {}, datasetRefs: {}, rowCounts: {},
        previewRows: {}, sourceMetadata: {}, appliedMappingRevision: {},
      };
    }

    const stateRef = { current: { supportConfigJson: '{}', masterContext: blankContext() } };
    requireValue(await hydration.hydratePersistedMasterDatasets(stateRef) === true, 'consumer hydration reported no change');
    const context = stateRef.current.masterContext;
    const refs = context.datasetRefs || {};
    for (const key of ['pipingClass', 'materialMap', 'weight']) {
      requireValue(refs[key]?.datasetId, key + ' cold-hydrated ref missing');
    }
    const revisionsBefore = JSON.stringify(context.appliedMappingRevision || {});

    const sourceEntriesBefore = performance.getEntriesByType('resource')
      .filter((entry) => /Piping_class_master\.json|PCF_MAT_MAP\.TXT|wtValveweights\.json/.test(entry.name))
      .length;

    const generic = await configModule.materializeXmlCiiDatasetBackedConfig({}, stateRef.current);
    requireValue(generic.pipingClass?.masterRows?.length === 10699, 'Piping Class generic consumer row count mismatch');
    requireValue(generic.material?.mapRows?.length === 383, 'Mat_Map generic consumer row count mismatch');
    requireValue(generic.weight?.masterRows?.length === 1595, 'Weight generic consumer row count mismatch');
    requireValue(Number(generic.weight?.masterRevision) === Number(context.appliedMappingRevision.weight),
      'Weight generic consumer applied revision mismatch');
    requireValue(generic.weight?.masterFingerprint === refs.weight.masterFingerprint,
      'Weight generic consumer fingerprint mismatch');

    // Later bounded Regex evidence deliberately does NOT rehydrate 10,699
    // master rows without sample-derived queries. The old test expected the
    // deprecated full-array behavior; preserve the stronger no-bulk guarantee.
    const regex = await regexModule.materializeRegexSmartMasterContext(stateRef.current, {
      async search() { throw new Error('EMPTY_SAMPLE_MUST_NOT_SEARCH_MASTER'); },
      async getRowsByIndexes() { throw new Error('EMPTY_SAMPLE_MUST_NOT_READ_MASTER'); },
      async materializeRows() { throw new Error('UNBOUNDED_REGEX_MASTER_ROWS_FORBIDDEN'); },
    });
    requireValue(regex.pipingClassRowCount === 0,
      'Regex without branch samples must not hydrate the full Piping Class dataset');
    requireValue(regex.evidenceBasis.includes(refs.pipingClass.datasetId),
      'Regex/Piping Class evidence did not bind restored datasetId');
    requireValue(context.pipingClassRows.length === 0,
      'Regex evidence must not retain whole Piping Class rows in application state');

    // Bind the branch sample to the exact original row imported by the #892
    // native Worker and re-read from its compact first-load evidence receipt.
    // Hardcoded illustrative class C1234M1 had no source matches.
    const seedReceipt = JSON.parse(localStorage.getItem('xml-cii-issue-892-first-load-expected') || '{}');
    const pipingReceipt = seedReceipt.masters?.find((entry) => entry.key === 'pipingClass');
    const originalSourceRow = pipingReceipt?.firstRow;
    const sourceClassToken = String(originalSourceRow?.['Piping Class'] || '').trim();
    requireValue(/^\d{3,}$/.test(sourceClassToken),
      'Native Worker seed did not retain a real numeric Piping Class source token');
    requireValue(pipingReceipt.datasetId === refs.pipingClass.datasetId,
      'Sample source row does not belong to the restored pipingClass dataset');
    requireValue(Number(pipingReceipt.datasetRevision) === Number(refs.pipingClass.datasetRevision),
      'Sample source row has stale pipingClass revision');

    // Exercise real IndexedDB-backed Worker search/indexed-row retrieval for
    // that source-attested sample. Keep 4 per query, 8 total, zero full scans.
    const searched = [];
    const rowFetches = [];
    const regexWithSamples = await regexModule.materializeRegexSmartMasterContext({
      ...stateRef.current,
      regexTesterResult: { branchSamples: [{ branchName: '/LINE12345-' + sourceClassToken }] },
    }, {
      async search(masterKey, datasetId, query) {
        searched.push({ masterKey, datasetId, query });
        requireValue(masterKey === 'pipingClass' && datasetId === refs.pipingClass.datasetId,
          'Regex bounded search used wrong master authority');
        return runtime.searchMasterDatasetRows(masterKey, datasetId, query);
      },
      async getRowsByIndexes(masterKey, datasetId, indexes, datasetRef) {
        rowFetches.push({ masterKey, datasetId, indexes, datasetRevision: datasetRef.datasetRevision });
        requireValue(masterKey === 'pipingClass' && datasetId === refs.pipingClass.datasetId,
          'Regex bounded row fetch used wrong master authority');
        requireValue(datasetRef.datasetRevision === refs.pipingClass.datasetRevision,
          'Regex bounded fetch lost the restored source revision');
        requireValue(indexes.length <= 8, 'Regex bounded fetch exceeds requested maximum indexes');
        const nativeResult = await runtime.getMasterDatasetRowsByIndexes(masterKey, datasetId, indexes, datasetRef);
        requireValue(nativeResult.datasetId === refs.pipingClass.datasetId,
          'Native indexed-row response lost the original Piping Class datasetId');
        requireValue(Number(nativeResult.datasetRevision) === Number(refs.pipingClass.datasetRevision),
          'Native indexed-row response returned a stale dataset revision');
        requireValue(Array.isArray(nativeResult.rows) && nativeResult.rows.length > 0,
          'Native Worker returned no indexed source rows');
        requireValue(nativeResult.rows.every((row) =>
          String(row['Piping Class'] || '').trim() === sourceClassToken),
          'Indexed-row values do not match the source-attested Piping Class token');
        return nativeResult;
      },
      maxIndexesPerQuery: 4,
      maxTotalIndexes: 8,
    });
    requireValue(searched.length > 0, 'Regex branch sample did not trigger indexed search');
    requireValue(searched.some((entry) => String(entry.query) === sourceClassToken),
      'The original source-derived class token was not actually searched');
    requireValue(rowFetches.length > 0,
      'Source-matching bounded search returned no native indexed-row fetches');
    requireValue(rowFetches.every((fetch) =>
      fetch.indexes.length > 0 && fetch.indexes.length <= 8),
      'Native indexed-row request exceeded the bounded nonempty fetch contract');
    requireValue(regexWithSamples.pipingClassRowCount > 0,
      'No original Piping Class source rows were retrieved from the native Worker');
    requireValue(regexWithSamples.evidenceBasis.includes(refs.pipingClass.datasetId),
      'sampled Regex evidence lost Piping Class dataset identity');
    requireValue(regexWithSamples.pipingClassRowCount <= 8,
      'sampled Regex evidence fetched more than the explicitly bounded row limit');
    requireValue(context.pipingClassRows.length === 0,
      'transient sampled Regex rows leaked into durable application context');

    const weightConfig = await weightModule.weightMatchConfigFromState(stateRef.current, {
      materializeRows: async () => { throw new Error('Weight Match compact authority must not trigger compatibility materialization'); },
    });
    requireValue(!('masterRows' in (weightConfig.weight || {})), 'Weight Match compact authority unexpectedly includes masterRows');
    requireValue(Number(weightConfig.weight?.masterRevision) === Number(context.appliedMappingRevision.weight),
      'Weight Match compact revision mismatch');
    requireValue(weightConfig.weight?.masterFingerprint === refs.weight.masterFingerprint,
      'Weight Match compact fingerprint mismatch');

    const rankResult = await runtime.rankMasterDatasetWeightIssues(
      'weight',
      refs.weight.datasetId,
      [],
      weightConfig,
      { ratingMode: 'preview', previewRatingSnapshot: {} },
    );
    weightModule.assertWeightDatasetResultAuthority(rankResult, refs.weight);

    const crossMasterError = await expectReject(
      () => runtime.materializeMasterDatasetRows('pipingClass', refs.materialMap),
      /dataset belongs to materialMap/i,
      'cross-master substitution',
    );
    const staleRevisionError = await expectReject(
      () => runtime.materializeMasterDatasetRows('materialMap', {
        ...refs.materialMap,
        datasetRevision: Number(refs.materialMap.datasetRevision) + 1,
      }),
      /Dataset revision mismatch for materialMap/i,
      'stale revision substitution',
    );
    const staleFingerprintError = await expectReject(
      () => runtime.materializeMasterDatasetRows('weight', {
        ...refs.weight,
        masterFingerprint: 'stale-fingerprint-893',
      }),
      /Dataset fingerprint mismatch for weight/i,
      'stale fingerprint substitution',
    );
    const nonWeightRankError = await expectReject(
      () => runtime.rankMasterDatasetWeightIssues('weight', refs.materialMap.datasetId, [], weightConfig, {
        ratingMode: 'preview',
        previewRatingSnapshot: {},
      }),
      /requires a weight dataset/i,
      'non-weight Weight Match substitution',
    );

    requireValue(JSON.stringify(context.appliedMappingRevision || {}) === revisionsBefore,
      'consumer operations mutated applied mapping revisions');

    const sourceEntriesAfter = performance.getEntriesByType('resource')
      .filter((entry) => /Piping_class_master\.json|PCF_MAT_MAP\.TXT|wtValveweights\.json/.test(entry.name))
      .length;
    requireValue(sourceEntriesAfter === sourceEntriesBefore,
      'consumer operations refetched master source files');

    return {
      schema: 'XMLCII_ISSUE_893_CONSUMER_AUTHORITY_V1',
      ok: true,
      refs: {
        pipingClass: {
          datasetId: refs.pipingClass.datasetId,
          datasetRevision: refs.pipingClass.datasetRevision,
          appliedRevision: context.appliedMappingRevision.pipingClass,
        },
        materialMap: {
          datasetId: refs.materialMap.datasetId,
          datasetRevision: refs.materialMap.datasetRevision,
          appliedRevision: context.appliedMappingRevision.materialMap,
        },
        weight: {
          datasetId: refs.weight.datasetId,
          datasetRevision: refs.weight.datasetRevision,
          appliedRevision: context.appliedMappingRevision.weight,
          masterFingerprint: refs.weight.masterFingerprint,
        },
      },
      consumers: {
        pipingClassRows: generic.pipingClass.masterRows.length,
        regexPipingClassRows: regex.pipingClassRowCount,
        regexSampledBoundedRows: regexWithSamples.pipingClassRowCount,
        regexSearches: searched.length,
        regexIndexedRowFetches: rowFetches.length,
        regexSourceSampleToken: sourceClassToken,
        regexFirstIndexedRowMatchesOriginalSource: regexWithSamples.masterContext.pipingClassRows.some(
          (row) => String(row?.['Piping Class'] || '').trim() === sourceClassToken),
        materialMapRows: generic.material.mapRows.length,
        weightRows: generic.weight.masterRows.length,
        weightRankDatasetId: rankResult.datasetId,
        weightRankDatasetRevision: rankResult.datasetRevision,
        weightRankFingerprint: rankResult.masterFingerprint,
      },
      guards: {
        crossMasterError,
        staleRevisionError,
        staleFingerprintError,
        nonWeightRankError,
      },
      assertions: {
        correctConsumerBinding: true,
        crossMasterSubstitutionFailsClosed: true,
        staleRevisionSubstitutionFailsClosed: true,
        staleFingerprintSubstitutionFailsClosed: true,
        appliedRevisionsIndependent: true,
        noSecondMasterSourceImport: true,
        emptyRegexHasNoBulkHydration: true,
        nativeWorkerBoundedSearchQueriesObserved: searched.length > 0,
        nativeWorkerIndexedRowRetrievalObserved: rowFetches.length > 0 && regexWithSamples.pipingClassRowCount > 0,
        originalSourceRowIdentityVerified: true,
        boundedNativeRowCountVerified: true,
        regexSourceRevisionPreserved: true,
      },
    };
  });

  await fs.mkdir('ValidationRecords', { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log('XML_CII_ISSUE_893_CONSUMER_AUTHORITY_RESULT');
  console.log(JSON.stringify(result, null, 2));
  if (!result?.ok) throw new Error(result?.error || 'C05.6.2 consumer authority lifecycle returned no result');
} finally {
  await browser.close();
}
