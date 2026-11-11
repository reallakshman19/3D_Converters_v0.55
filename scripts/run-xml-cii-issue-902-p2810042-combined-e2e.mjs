import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { buildP2810042C06FixtureXml } from '../tests/fixtures/xml-cii-p2810042-c06-combined-fixture.js';

const baseUrl = process.env.XML_CII_ISSUE_902_URL || 'http://127.0.0.1:4173';
const outputPath = process.env.XML_CII_ISSUE_902_OUTPUT || 'ValidationRecords/xml-cii-issue-902-p2810042-combined.json';
const finalXmlPath = 'ValidationRecords/xml-cii-issue-902-p2810042-final.xml';
const ciiPath = 'ValidationRecords/xml-cii-issue-902-p2810042.cii';
const sourcePath = 'ValidationRecords/xml-cii-issue-902-p2810042-source.xml';

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function close(actual, expected, tolerance = 1e-6) {
  return Number.isFinite(Number(actual))
    && Math.abs(Number(actual) - Number(expected)) <= tolerance;
}
function fields(line, count = 6) {
  const out = [line.slice(0, 15).trim()];
  for (let index = 1; index < count; index += 1) {
    out.push(line.slice(15 + ((index - 1) * 13), 15 + (index * 13)).trim());
  }
  return out;
}
function section(lines, name) {
  const start = lines.indexOf(`#$ ${name}`);
  requireValue(start >= 0, `CII section ${name} missing`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith('#$ '));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
}
function lineNumberName(line) {
  const length = Number(line.slice(7, 12).trim() || 0);
  return line.slice(13, 13 + length);
}
function parseElements(lines) {
  const control = section(lines, 'CONTROL');
  const count = Number(fields(control[0])[0]);
  const payload = section(lines, 'ELEMENTS');
  requireValue(payload.length >= count * 15, `ELEMENTS payload ${payload.length} shorter than ${count * 15}`);
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const block = payload.slice(index * 15, (index + 1) * 15);
    const first = fields(block[0]);
    const second = fields(block[1]);
    const aux13 = fields(block[12]);
    const aux15 = fields(block[14], 3);
    rows.push({
      index: index + 1,
      from: Number(first[0]),
      to: Number(first[1]),
      dx: Number(first[2]),
      dy: Number(first[3]),
      dz: Number(first[4]),
      outsideDiameterMm: Number(first[5]),
      wallThicknessMm: Number(second[0]),
      branchName: lineNumberName(block[10]),
      rigidIndex: Number(aux13[1] || 0),
      reducerIndex: Number(aux15[0] || 0),
    });
  }
  return rows;
}
function parseRigid(lines) {
  return section(lines, 'RIGID').map((line, index) => ({
    index: index + 1,
    weightN: Number(fields(line, 2)[0]),
  }));
}
function parseReducers(lines) {
  return section(lines, 'REDUCERS').map((line, index) => {
    const row = fields(line, 5);
    return {
      index: index + 1,
      secondOutsideDiameterMm: Number(row[0]),
      secondWallThicknessMm: Number(row[1]),
      alphaAngleDeg: Number(row[2]),
    };
  });
}
function parseCoords(lines) {
  const payload = section(lines, 'COORDS');
  const count = Number(payload[0]?.slice(0, 15).trim() || 0);
  return payload.slice(1, 1 + count).map((line) => ({
    node: Number(line.slice(0, 15)),
    x: Number(line.slice(15, 28)),
    y: Number(line.slice(28, 41)),
    z: Number(line.slice(41, 54)),
  }));
}
function branchEnds(row, suffix) {
  return row.branchName.endsWith(suffix);
}
function edge(rows, suffix, from, to) {
  const found = rows.find((row) => branchEnds(row, suffix) && row.from === from && row.to === to);
  requireValue(found, `CII edge ${suffix} ${from}->${to} missing`);
  return found;
}
async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server unavailable at ${url}: ${lastError}`);
}

const url = `${baseUrl}/tests/browser/xml-cii-issue-902-p2810042-combined-e2e.html`;
await waitForServer(url);
const browser = await chromium.launch({ headless: true });
let browserResult;
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.error(`[browser:pageerror] ${error.stack || error}`));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__XML_CII_ISSUE_902_DONE__ === true, null, { timeout: 120_000 });
  browserResult = await page.evaluate(() => globalThis.__XML_CII_ISSUE_902_RESULT__);
} finally {
  await browser.close();
}
requireValue(browserResult?.ok, browserResult?.error || 'combined browser authority ledger failed');

await fs.mkdir('ValidationRecords', { recursive: true });
await fs.writeFile(sourcePath, `${buildP2810042C06FixtureXml()}\n`, 'utf8');
await fs.writeFile(finalXmlPath, `${browserResult.finalXmlText}\n`, 'utf8');

const python = process.env.PYTHON || 'python3';
const args = [
  'converters/scripts/xml_to_cii2019_runtime_custody.py',
  '--input', finalXmlPath,
  '--output', ciiPath,
  '--coords-mode', 'first',
  '--weight-scale', '10',
  '--support-config-json', browserResult.supportConfigJson,
  '--split-condensed-valve-flange',
  '--use-restraint-type-based-on-json',
];
const conversion = spawnSync(python, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
console.log(conversion.stdout || '');
console.error(conversion.stderr || '');
requireValue(conversion.status === 0, `Standalone runtime-custody converter failed with ${conversion.status}`);

const ciiText = await fs.readFile(ciiPath, 'utf8');
const ciiLines = ciiText.split(/\r?\n/);
const elements = parseElements(ciiLines);
const rigids = parseRigid(ciiLines);
const reducers = parseReducers(ciiLines);
const coords = parseCoords(ciiLines);

const anchor10 = coords.find((row) => row.node === 10);
requireValue(anchor10, 'CII COORDS node 10 source-datum anchor missing');
requireValue(close(anchor10.x, 72298.4) && close(anchor10.y, 100000) && close(anchor10.z, -115930),
  `CII node10 coordinate drift: ${JSON.stringify(anchor10)}`);

const reducer = edge(elements, '/B2', 110, 120);
requireValue(close(reducer.outsideDiameterMm, 610) && close(reducer.wallThicknessMm, 30.9626),
  'CII B2 110->120 first-side reducer authority drift');
requireValue(reducer.reducerIndex > 0, 'CII B2 110->120 reducer index missing');
const reducerAux = reducers[reducer.reducerIndex - 1];
requireValue(reducerAux && close(reducerAux.secondOutsideDiameterMm, 508) && close(reducerAux.secondWallThicknessMm, 26.1874),
  'CII reducer second-side OD/wall drift');

const dn450 = edge(elements, '/B8', 150, 160);
requireValue(close(dn450.outsideDiameterMm, 457) && close(dn450.wallThicknessMm, 23.8252),
  'CII DN450 branch authority drift');

const dn25 = edge(elements, '/B5', 70, 200);
requireValue(close(dn25.outsideDiameterMm, 33.4) && close(dn25.wallThicknessMm, 6.35),
  'CII DN25 branch authority drift');

const dn50 = edge(elements, '/B7', 50, 430);
requireValue(close(dn50.outsideDiameterMm, 60.3) && close(dn50.wallThicknessMm, 8.7376),
  'CII DN50 branch authority drift');

const weight150 = elements.find((row) => branchEnds(row, '/B3') && row.to === 150 && row.rigidIndex > 0);
requireValue(weight150, 'CII B3 edge arriving at Rigid=2 node150 missing');
requireValue(close(weight150.outsideDiameterMm, 610) && close(weight150.wallThicknessMm, 30.9626),
  'CII B3 node150 OD/wall drift');
requireValue(close(rigids[weight150.rigidIndex - 1]?.weightN, 422.5),
  `CII B3 node150 rigid weight drift: ${rigids[weight150.rigidIndex - 1]?.weightN}`);

const weight10 = edge(elements, 'EXE/B2', 480, 10);
requireValue(weight10.rigidIndex > 0, 'CII EXE/B2 480->10 lost rigid ownership');
requireValue(close(weight10.outsideDiameterMm, 610) && close(weight10.wallThicknessMm, 30.9626),
  'CII EXE/B2 480->10 OD/wall drift');
requireValue(close(rigids[weight10.rigidIndex - 1]?.weightN, 515),
  `CII EXE/B2 node10 rigid weight drift: ${rigids[weight10.rigidIndex - 1]?.weightN}`);

const ciiEvidence = {
  coordsNode10: anchor10,
  reducer110to120: { ...reducer, reducer: reducerAux },
  dn450_150to160: dn450,
  dn25_70to200: dn25,
  dn50_50to430: dn50,
  rigidB3to150: { ...weight150, weightN: rigids[weight150.rigidIndex - 1]?.weightN },
  rigidExe480to10: { ...weight10, weightN: rigids[weight10.rigidIndex - 1]?.weightN },
};
const result = {
  schema: 'XMLCII_ISSUE_902_P2810042_COMBINED_AUTHORITY_V1',
  ok: true,
  browser: { ...browserResult, finalXmlText: '[written separately]', supportConfigJson: '[used by exact Standalone invocation]' },
  cii: ciiEvidence,
  assertions: {
    sourcePreviewFinalParity: true,
    lineIdentityDidNotFlattenMixedSourceOd: true,
    reducerEndpointCustody: true,
    acceptedWeightsReachedExactRigidOwners: true,
    ciiCoordinateDatumPreserved: true,
    ciiOdWallParity: true,
    ciiRigidWeightsScaledKgToNExactlyOnce: true,
  },
};
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log('XML_CII_ISSUE_902_P2810042_COMBINED_AUTHORITY_RESULT');
console.log(JSON.stringify(result, null, 2));
