import assert from 'node:assert/strict';
import {
  mkdtempSync, readFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { gitBlobSha1Hex } from '../scripts/extract-vibration-master-source.mjs';
import {
  buildVibrationSourceCampaign,
  preflightVibrationSourceCampaign,
  validateVibrationSourceCampaignRequest,
  writeVibrationSourceCampaignArtifacts,
} from '../scripts/run-vibration-source-campaign.mjs';

const PDF_BYTES = Buffer.from('synthetic controlled pdf bytes', 'utf8');

function source(sourceId = 'EI') {
  return {
    sourceId,
    repository: 'example/controlled',
    commit: 'a'.repeat(40),
    path: 'controlled.pdf',
    gitBlobSha1: `sha1:${gitBlobSha1Hex(PDF_BYTES)}`,
    sizeBytes: PDF_BYTES.length,
    edition: 'test edition',
  };
}

function entry(masterId, sourceRef, identifier, printedPage) {
  return {
    masterId,
    mechanismId: masterId === 'MASTER.T4' ? 'thermowells' : 'cavitationFlashing',
    dataType: masterId === 'MASTER.T4' ? 'TABLE' : 'RULE',
    sourceState: 'SOURCE_PINNED',
    sourceRef,
    locator: {
      identifier,
      section: masterId === 'MASTER.T4' ? 'T4' : 'T2.9',
      printedPage,
      pdfPages: [],
      locatorStatus: 'NAVIGATION_ONLY',
    },
    extractionReceipt: null,
    notes: null,
  };
}

function register() {
  return {
    schema: 'VibrationMasterSourceRegister.v1',
    registerRevision: 'test',
    controlledSources: [source(), source('OTHER')],
    entries: [
      entry('MASTER.T29', 'EI', 'Flowchart T2-9', '66'),
      entry('MASTER.T4', 'EI', 'Table T4-1', '87'),
      entry('MASTER.OTHER', 'OTHER', 'Other', '1'),
    ],
    authority: {
      engineeringAuthority: 'NONE',
      screeningAuthority: 'NOT_AUTHORIZED',
      designAuthority: false,
      statement: 'SOURCE_REGISTER_ONLY',
    },
  };
}

function request(masterId, pdfPage, identifier, section, printedPage, anchor) {
  return {
    schema: 'VibrationMasterSourceExtractionRequest.v1',
    masterId,
    pdfPages: [pdfPage],
    locator: { identifier, section, printedPage },
    requiredAnchors: [{
      id: `${masterId}-anchor`, text: anchor,
      expectedOccurrences: 1, caseSensitive: true,
    }],
  };
}

function campaign() {
  return {
    schema: 'VibrationMasterSourceCampaignRequest.v1',
    campaignId: 'EI-QUAL-TEST',
    sourceId: 'EI',
    requests: [
      request('MASTER.T29', 1, 'Flowchart T2-9', 'T2.9', '66', 'private-anchor-t29'),
      request('MASTER.T4', 2, 'Table T4-1', 'T4', '87', 'private-anchor-t4'),
    ],
  };
}

function extraction() {
  return {
    binary: 'fake-pdftotext',
    version: 'fake 1.0',
    pages: [
      { pdfPageNumber: 1, text: 'Flowchart T2-9\nprivate-anchor-t29\n' },
      { pdfPageNumber: 2, text: 'Table T4-1\nprivate-anchor-t4\n' },
      { pdfPageNumber: 3, text: 'unselected page\n' },
    ],
  };
}

test('campaign builds deterministic hash-only receipts for multiple explicit requests', () => {
  const first = buildVibrationSourceCampaign(PDF_BYTES, register(), campaign(), extraction());
  const second = buildVibrationSourceCampaign(PDF_BYTES, register(), campaign(), extraction());
  assert.equal(first.receipt.schema, 'VibrationMasterSourceCampaignReceipt.v1');
  assert.equal(first.receipt.requestCount, 2);
  assert.equal(first.receipt.extraction.sharedExtraction, true);
  assert.equal(first.receipt.targets.length, 2);
  assert.equal(first.receipt.campaignContentSha256, second.receipt.campaignContentSha256);
  assert.equal(first.receipt.authority.engineeringAuthority, 'NONE');
  assert.equal(first.receipt.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(first.receipt.authority.masterValuesPublished, false);
  assert.equal(first.receipt.authority.pageInferenceAllowed, false);
  assert.equal(first.receipt.authority.anchorInferenceAllowed, false);
  assert.equal(first.receipt.authority.partialCampaignAuthoritative, false);
  const receiptText = JSON.stringify(first.receipt);
  assert.doesNotMatch(receiptText, /private-anchor-t29|private-anchor-t4/);
});

test('campaign rejects duplicate master IDs and unknown campaign fields', () => {
  const duplicate = campaign();
  duplicate.requests = [duplicate.requests[0], duplicate.requests[0]];
  assert.throws(
    () => validateVibrationSourceCampaignRequest(duplicate),
    /VIBRATION_SOURCE_CAMPAIGN_MASTER_ID_DUPLICATE/,
  );
  assert.throws(
    () => validateVibrationSourceCampaignRequest({ ...campaign(), inferredPages: [1] }),
    /VIBRATION_SOURCE_CAMPAIGN_FIELD_UNKNOWN/,
  );
});

test('campaign rejects a target bound to a different controlled source', () => {
  const crossSource = campaign();
  crossSource.requests = [
    request('MASTER.OTHER', 1, 'Other', 'T2.9', '1', 'private-anchor-t29'),
  ];
  assert.throws(
    () => buildVibrationSourceCampaign(PDF_BYTES, register(), crossSource, extraction()),
    /VIBRATION_SOURCE_CAMPAIGN_SOURCE_MISMATCH/,
  );
});

test('existing extractor remains the per-target authority and anchor mismatch fails the whole build', () => {
  const bad = campaign();
  bad.requests[1].requiredAnchors[0].text = 'not-on-selected-page';
  assert.throws(
    () => buildVibrationSourceCampaign(PDF_BYTES, register(), bad, extraction()),
    /VIBRATION_SOURCE_ANCHOR_OCCURRENCE_MISMATCH/,
  );
});

test('artifact publication writes all target receipts and aggregate only after successful build', () => {
  const root = mkdtempSync(join(tmpdir(), 'vib-source-campaign-'));
  try {
    const result = buildVibrationSourceCampaign(PDF_BYTES, register(), campaign(), extraction());
    const aggregate = join(root, 'campaign-receipt.json');
    const targetDir = join(root, 'targets');
    const outputs = writeVibrationSourceCampaignArtifacts(result, aggregate, targetDir);
    assert.equal(outputs.targetReceipts.length, 2);
    assert.equal(JSON.parse(readFileSync(aggregate, 'utf8')).requestCount, 2);
    for (const path of outputs.targetReceipts) {
      assert.equal(JSON.parse(readFileSync(path, 'utf8')).schema, 'VibrationMasterSourceExtraction.v1');
    }
    assert.throws(
      () => writeVibrationSourceCampaignArtifacts(result, aggregate, targetDir),
      /VIBRATION_SOURCE_CAMPAIGN_OUTPUT_EXISTS/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('wrong controlled PDF fails at preflight', () => {
  assert.throws(
    () => preflightVibrationSourceCampaign(Buffer.from('wrong'), register(), campaign()),
    /VIBRATION_SOURCE_MISMATCH/,
  );
});

test('production CLI preflights source identity before invoking pdftotext', () => {
  const sourceText = readFileSync(new URL('../scripts/run-vibration-source-campaign.mjs', import.meta.url), 'utf8');
  const runStart = sourceText.indexOf('export function runVibrationSourceCampaign');
  const runBody = sourceText.slice(runStart);
  const preflightIndex = runBody.indexOf('preflightVibrationSourceCampaign(bytes, register, campaign)');
  const extractIndex = runBody.indexOf('extractPdfText(inputPath');
  assert.ok(runStart >= 0 && preflightIndex >= 0 && extractIndex >= 0);
  assert.ok(preflightIndex < extractIndex);
});
