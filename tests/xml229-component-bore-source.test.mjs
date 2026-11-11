import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {indexXml229PhysicalBores,xml229PhysicalBore} from '../tabs/xml-cii-2019-standalone/integration/xml229-physical-bore-authority.mjs';
const fail=(code)=>{throw Object.assign(new Error(code),{code});};
const original={nodeNumber:'-1',componentType:'VALV',componentRefNo:'part',endpoint:'2'};
const row={...original,branchOccurrenceIndex:1,nodeOrdinal:22,boreMm:250};
const originals=new Map([[JSON.stringify([1,22]),original]]);
test('physical bore takes component DN250 without branch DN300 authority',()=>{
 const rows=indexXml229PhysicalBores([row],originals,fail);
 assert.equal(xml229PhysicalBore(rows.get('[1,22]'),{boreMm:250},fail),250);
 assert.throws(()=>xml229PhysicalBore(row,{boreMm:300},fail),{code:'PHYSICAL_BORE_DRIFT'});
 assert.equal(xml229PhysicalBore(null,null,fail),null);
});
test('duplicate and wrong-source bore rows fail closed',()=>{
 assert.throws(()=>indexXml229PhysicalBores([row,row],originals,fail),{code:'PHYSICAL_BORE_SOURCE_DRIFT'});
 assert.throws(()=>indexXml229PhysicalBores([{...row,endpoint:'1'}],originals,fail),{code:'PHYSICAL_BORE_SOURCE_DRIFT'});
});
test('actual PL-BM1 native port and contrary cases',()=>{
 execFileSync('python3',[new URL('./xml-cii-connected-port-diameter.test.py',import.meta.url).pathname],{stdio:'pipe'});
});
