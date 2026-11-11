import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseTextSource} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-parser.js';
import {prepareNormalizedDataset} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-normalize.js';
import {canonicalJson} from '../contracts/gc-pw-v1/contract.mjs';

const fixture=new URL('./fixtures/xml229/BC4.LineList.json',import.meta.url);
const manifest=new URL('./fixtures/xml229/BC4.fixture.json',import.meta.url);
const sha256=v=>createHash('sha256').update(v).digest('hex');
const gitBlob=v=>createHash('sha1').update('blob '+v.length+'\0').update(v).digest('hex');
const canonicalSha256=o=>sha256(canonicalJson(o));
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);

test('Original BC4 workbook conversion is committed as exact-byte JSON, not a skipped XLSX test',async()=>{
 const [bytes,metaBytes]=await Promise.all([readFile(fixture),readFile(manifest)]);
 const m=JSON.parse(metaBytes.toString('utf8')),json=JSON.parse(bytes.toString('utf8'));
 assert.equal(bytes.length,199182);
 assert.equal(sha256(bytes),'53b322405795dc7a74c1154043c31bf9c8b2a1763f207cabf0c7f1888fd9c1bb');
 assert.equal(gitBlob(bytes),'6b84b5e350e76de05db0c4a858da39114cddbc70');
 assert.equal(m.convertedJson.sha256,sha256(bytes));
 assert.equal(m.convertedJson.gitBlobSha1,gitBlob(bytes));
 assert.equal(json.schema,'XML229.BC4.LineListRawJsonFixture.v1');
 assert.equal(json.sourceWorkbook,'BC4.xlsx');
 assert.equal(json.sourceWorkbookSha256,m.sha256);
 assert.equal(json.worksheet,'LineList');
 assert.equal(json.rowCount,385);
 assert.equal(json.rows.length,385);
 assert.equal(json.rows[0]['2'],'Service');
 assert.equal(json.rows[0]['3'],'Line number');
 assert.equal(json.rows[0]['22'],'Piping Class');
 assert.equal(json.rows[3]['2'],'A');
 assert.equal(json.engineeringApproval,false);
 assert.equal(json.nativeCiiReleaseAuthorized,false);
 assert.equal(m.historicalContentDigestProven,false);
 assert.equal(m.historicalMappingDigestProven,false);
});

test('Load all 385 BC4 JSON records through the actual production master parser',async()=>{
 const bytes=await readFile(fixture);
 const rows=parseTextSource(ab(bytes),'BC4.LineList.json','lineList');
 const json=JSON.parse(bytes.toString('utf8'));
 assert.equal(rows.length,385);
 assert.deepEqual(rows,json.rows);
 assert(rows.every(row=>Object.keys(row).length===41));
 const normalized=prepareNormalizedDataset('lineList',rows,{},{});
 assert.equal(normalized.rows.length,385);
 assert.equal(normalized.fieldMap.lineKey1,'2');
 assert.equal(normalized.fieldMap.lineKey2,'3');
 assert.equal(normalized.fieldMap.pipingClass,'22');
 assert.equal(canonicalSha256(normalized.rows),'65548a7e176534c457b7be41b50b64b22a54f869a5606ffc2ddff856d67c7f53');
 assert.equal(canonicalSha256(normalized.fieldMap),'d85c6c7fa1e59f649451f01141b79e39ce693646b429846922ee3e6e49701717');
 // Historical imported master fieldMap and rows were not yet reproduced.
 assert.notEqual(canonicalSha256(normalized.rows),
   '7611c84e6aa365069154cd0eaab04196b930912162487adc7266b8d9962be62d');
 assert.notEqual(canonicalSha256(normalized.fieldMap),
   'ce24f71840ac38d5f014688a68768cab9f459dd20f89378e37b66c80369a7507');
});

test('Invalid JSON conversion cannot pass through the master import contract',()=>{
 const invalid=new TextEncoder().encode('{"rows":null}');
 assert.throws(()=>parseTextSource(ab(invalid),'BC4.LineList.json','lineList'),
  /JSON master import requires an array or an object with a rows array/);
});
