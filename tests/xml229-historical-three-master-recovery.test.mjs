import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import xlsx from 'xlsx';
import {parseTextSource} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-parser.js';
import {prepareNormalizedDataset} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-normalize.js';
import {reconstructHistoricalMasters,evaluateHistoricalMaster,historicalMasterExpectations,canonicalSha256}
 from '../scripts/xml229-historical-three-master-recovery.mjs';

const bytes=p=>readFileSync(new URL('../'+p,import.meta.url));
const bufferView=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
test('October 1 repository reconstructs three exact historical normalized masters',async()=>{
 const r=await reconstructHistoricalMasters({xlsx});
 assert.equal(r.schema,'XML229.HistoricalThreeMasterReconstruction.v1');
 assert.equal(r.recoveredMasterCount,3);
 assert.deepEqual(r.recovered.map(x=>x.kind),['pipingClass','materialMap','weight']);
 assert.deepEqual(r.recovered.map(x=>x.count),[10699,383,1595]);
 assert(r.recovered.every(x=>x.sourceMatchesOctober1===true));
 assert(r.recovered.every(x=>x.historicalSessionDatasetIdVerified===false));
 assert.equal(r.lineList.status,'UNRECOVERED');
 assert.equal(r.lineList.expectedCount,385);
 assert.equal(r.fullHistoricalInputBasisVerified,false);
 assert.equal(r.historicalDecisionsMutated,0);
 assert.equal(r.historicalKgApproved,0);
 assert.equal(r.finalApproved,0);
 assert.equal(r.nativeCiiReleaseAuthorized,false);
});
test('tampering with a 383-record Material Map changes exact historical digest',()=>{
 const b=bytes('docs/Masters/PCF_MAT_MAP.TXT');
 const raw=parseTextSource(bufferView(b),'PCF_MAT_MAP.TXT','materialMap');
 const normalized=prepareNormalizedDataset('materialMap',raw,{},{});
 assert.equal(normalized.rows.length,383);
 assert.equal(canonicalSha256(normalized.fieldMap),historicalMasterExpectations.materialMap.mappingSha256);
 const tampered=normalized.rows.map((x,i)=>i===0?{...x,material:'FAKE-MATERIAL'}:x);
 assert.throws(()=>evaluateHistoricalMaster('materialMap',tampered,normalized.fieldMap,b),
  {code:'HISTORICAL_MASTER_RECONSTRUCTION_DRIFT'});
});
test('same-count Piping Class JSON is not historical Excel-normalized master',()=>{
 const bytesJson=bytes('docs/Masters/Piping_class_master.json');
 const raw=JSON.parse(bytesJson.toString('utf8'));
 const x=prepareNormalizedDataset('pipingClass',raw,{},{});
 assert.equal(x.rows.length,10699);
 assert.equal(canonicalSha256(x.fieldMap),historicalMasterExpectations.pipingClass.mappingSha256);
 assert.notEqual(canonicalSha256(x.rows),historicalMasterExpectations.pipingClass.sha256);
 assert.throws(()=>evaluateHistoricalMaster('pipingClass',x.rows,x.fieldMap,bytesJson),
  {code:'HISTORICAL_MASTER_RECONSTRUCTION_DRIFT'});
});
test('unrecovered LineList cannot be promoted from three-master evidence',()=>{
 assert.throws(()=>evaluateHistoricalMaster('lineList',[],{},Buffer.alloc(0)),
  {code:'HISTORICAL_MASTER_SOURCE_NOT_ATTESTED'});
});
