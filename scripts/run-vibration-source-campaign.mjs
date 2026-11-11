import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertExpectedControlledPdf,
  buildVibrationMasterSourceExtractionManifest,
  extractPdfText,
  validateVibrationMasterSourceExtractionRequest,
} from './extract-vibration-master-source.mjs';
import {
  hashVibrationMasterSourceRegister,
  validateVibrationMasterSourceRegister,
} from './vibration-master-source-register.mjs';

export const VIBRATION_SOURCE_CAMPAIGN_REQUEST_SCHEMA = 'VibrationMasterSourceCampaignRequest.v1';
export const VIBRATION_SOURCE_CAMPAIGN_RECEIPT_SCHEMA = 'VibrationMasterSourceCampaignReceipt.v1';

const CAMPAIGN_FIELDS = new Set(['schema', 'campaignId', 'sourceId', 'requests']);

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requireText(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(code);
  return value.trim();
}

function assertPlainObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(code);
}

function validateCampaignFields(raw) {
  assertPlainObject(raw, 'VIBRATION_SOURCE_CAMPAIGN_INVALID');
  for (const key of Object.keys(raw)) {
    if (!CAMPAIGN_FIELDS.has(key)) throw new TypeError(`VIBRATION_SOURCE_CAMPAIGN_FIELD_UNKNOWN: ${key}`);
  }
}

export function validateVibrationSourceCampaignRequest(raw) {
  validateCampaignFields(raw);
  if (raw.schema !== VIBRATION_SOURCE_CAMPAIGN_REQUEST_SCHEMA) {
    throw new TypeError('VIBRATION_SOURCE_CAMPAIGN_SCHEMA_INVALID');
  }
  if (!Array.isArray(raw.requests) || raw.requests.length === 0) {
    throw new TypeError('VIBRATION_SOURCE_CAMPAIGN_REQUESTS_REQUIRED');
  }
  const requests = raw.requests.map(validateVibrationMasterSourceExtractionRequest);
  const masterIds = requests.map(({ masterId }) => masterId);
  if (new Set(masterIds).size !== masterIds.length) {
    throw new Error('VIBRATION_SOURCE_CAMPAIGN_MASTER_ID_DUPLICATE');
  }
  return {
    schema: raw.schema,
    campaignId: requireText(raw.campaignId, 'VIBRATION_SOURCE_CAMPAIGN_ID_REQUIRED'),
    sourceId: requireText(raw.sourceId, 'VIBRATION_SOURCE_CAMPAIGN_SOURCE_ID_REQUIRED'),
    requests,
  };
}

function campaignSource(register, campaign) {
  const source = register.controlledSources.find(({ sourceId }) => sourceId === campaign.sourceId);
  if (!source) throw new Error(`VIBRATION_SOURCE_CAMPAIGN_SOURCE_UNKNOWN: ${campaign.sourceId}`);
  const entries = new Map(register.entries.map((entry) => [entry.masterId, entry]));
  for (const request of campaign.requests) {
    const entry = entries.get(request.masterId);
    if (!entry) throw new Error(`VIBRATION_SOURCE_CAMPAIGN_MASTER_UNKNOWN: ${request.masterId}`);
    if (entry.sourceRef !== campaign.sourceId) {
      throw new Error(`VIBRATION_SOURCE_CAMPAIGN_SOURCE_MISMATCH: ${request.masterId}`);
    }
  }
  return source;
}

export function preflightVibrationSourceCampaign(bytesInput, registerRaw, campaignRaw) {
  const bytes = Buffer.isBuffer(bytesInput) ? bytesInput : Buffer.from(bytesInput);
  const register = validateVibrationMasterSourceRegister(registerRaw);
  const campaign = validateVibrationSourceCampaignRequest(campaignRaw);
  const source = campaignSource(register, campaign);
  const sourceIdentity = assertExpectedControlledPdf(bytes, source);
  return { bytes, register, campaign, source, sourceIdentity };
}

function artifactFileName(masterId) {
  return `${encodeURIComponent(masterId)}.source-extraction.json`;
}

function targetSummary(manifest) {
  const receiptText = `${JSON.stringify(manifest, null, 2)}\n`;
  return {
    masterId: manifest.masterId,
    mechanismId: manifest.mechanismId,
    dataType: manifest.dataType,
    artifactFile: artifactFileName(manifest.masterId),
    receiptSha256: sha256(receiptText),
    locator: manifest.locator,
    selectedTextSha256: manifest.extraction.selectedTextSha256,
    pageHashes: manifest.pages.map(({ pdfPageNumber, textSha256 }) => ({ pdfPageNumber, textSha256 })),
  };
}

function campaignAuthority() {
  return {
    purpose: 'SOURCE_EXTRACTION_CAMPAIGN_EVIDENCE_ONLY',
    engineeringAuthority: 'NONE',
    screeningAuthority: 'NOT_AUTHORIZED',
    designAuthority: false,
    masterValuesPublished: false,
    pageInferenceAllowed: false,
    anchorInferenceAllowed: false,
    partialCampaignAuthoritative: false,
  };
}

export function buildVibrationSourceCampaign(bytesInput, registerRaw, campaignRaw, extraction) {
  const preflight = preflightVibrationSourceCampaign(bytesInput, registerRaw, campaignRaw);
  const { bytes, register, campaign, source, sourceIdentity } = preflight;
  const manifests = campaign.requests.map((request) => (
    buildVibrationMasterSourceExtractionManifest(bytes, register, request, extraction)
  ));
  const targets = manifests.map(targetSummary);
  const requestHash = sha256(stableJson(campaign));
  const sourceRegisterHash = hashVibrationMasterSourceRegister(register);
  const receiptCore = {
    schema: VIBRATION_SOURCE_CAMPAIGN_RECEIPT_SCHEMA,
    campaignId: campaign.campaignId,
    requestSha256: requestHash,
    sourceRegisterHash,
    source: { ...source, ...sourceIdentity },
    requestCount: campaign.requests.length,
    targets,
    extraction: {
      tool: extraction.binary,
      toolVersion: extraction.version,
      totalPdfPageCount: extraction.pages.length,
      sharedExtraction: true,
    },
    authority: campaignAuthority(),
  };
  return {
    receipt: {
      ...receiptCore,
      campaignContentSha256: sha256(stableJson(receiptCore)),
    },
    manifests,
  };
}

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function ensureOutputsAbsent(outPath, outDir, manifests) {
  const paths = [outPath, ...manifests.map(({ masterId }) => resolve(outDir, artifactFileName(masterId)))];
  const existing = paths.find(existsSync);
  if (existing) throw new Error(`VIBRATION_SOURCE_CAMPAIGN_OUTPUT_EXISTS: ${existing}`);
  return paths;
}

function temporaryPath(path) {
  return `${path}.tmp-${process.pid}`;
}

export function writeVibrationSourceCampaignArtifacts(result, outPathInput, outDirInput) {
  const outPath = resolve(outPathInput);
  const outDir = resolve(outDirInput);
  mkdirSync(dirname(outPath), { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const finalPaths = ensureOutputsAbsent(outPath, outDir, result.manifests);
  const targetPaths = result.manifests.map((manifest) => resolve(outDir, artifactFileName(manifest.masterId)));
  const temporary = [];
  const published = [];
  try {
    result.manifests.forEach((manifest, index) => {
      const temp = temporaryPath(targetPaths[index]);
      temporary.push(temp);
      writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    });
    const aggregateTemp = temporaryPath(outPath);
    temporary.push(aggregateTemp);
    writeFileSync(aggregateTemp, `${JSON.stringify(result.receipt, null, 2)}\n`, 'utf8');
    targetPaths.forEach((path, index) => {
      renameSync(temporary[index], path);
      published.push(path);
    });
    renameSync(aggregateTemp, outPath);
    published.push(outPath);
    return { campaignReceipt: outPath, targetReceipts: targetPaths, allPaths: finalPaths };
  } catch (error) {
    for (const path of [...temporary, ...published]) rmSync(path, { force: true });
    throw error;
  }
}

function parseArguments(argv) {
  const positional = [];
  const args = {
    register: 'docs/Masters/Vibration/source-register.json',
    campaign: null, out: null, outDir: null, binary: 'pdftotext',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--register') args.register = argv[++index] ?? null;
    else if (arg === '--campaign') args.campaign = argv[++index] ?? null;
    else if (arg === '--out') args.out = argv[++index] ?? null;
    else if (arg === '--out-dir') args.outDir = argv[++index] ?? null;
    else if (arg === '--pdftotext') args.binary = argv[++index] ?? null;
    else if (arg.startsWith('--')) throw new TypeError(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length !== 1 || !args.register || !args.campaign || !args.out || !args.outDir) {
    throw new TypeError('Usage: node scripts/run-vibration-source-campaign.mjs <controlled.pdf> --campaign <campaign.json> --out <campaign-receipt.json> --out-dir <target-receipts-dir> [--register source-register.json] [--pdftotext path]');
  }
  return { input: positional[0], ...args };
}

export function runVibrationSourceCampaign(argv = process.argv.slice(2)) {
  const args = parseArguments(argv);
  const inputPath = resolve(args.input);
  const bytes = readFileSync(inputPath);
  const register = loadJson(args.register);
  const campaign = loadJson(args.campaign);
  preflightVibrationSourceCampaign(bytes, register, campaign);
  const extraction = extractPdfText(inputPath, { binary: args.binary });
  const result = buildVibrationSourceCampaign(bytes, register, campaign, extraction);
  const outputs = writeVibrationSourceCampaignArtifacts(result, args.out, args.outDir);
  return { receipt: result.receipt, outputs };
}

const invoked = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  try {
    const result = runVibrationSourceCampaign();
    process.stdout.write(`${basename(result.outputs.campaignReceipt)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  }
}
