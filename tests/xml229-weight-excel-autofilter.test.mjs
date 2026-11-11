import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 XML229_WEIGHT_COLUMNS,xml229ExcelCell,parseXml229ExcelRequest,
 isXml229VerifiedShortPhysical,XML229_SHORT_ELEMENT_HIDE_LIMIT_MM,
 matchesXml229ExcelColumns,sortXml229ExcelRows,xml229ExcelColumnOptions,
} from '../tabs/xml-cii-2019-standalone/integration/xml229-weight-excel-filter.mjs';
import {renderXml229WeightReviewPage} from
 '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs';

const base={branchName:'B-10',lineKey:'X-1',componentType:'INST',
 shortName:'Gate Valve',dtxr:'GATE VALVE FLGD 300#',boreMm:200,
 rating:300,nodeNumber:310,componentRefNoEndpoint:'I-1_2',
 lengthMm:305,sourceKg:null};
const status=(final=null,match1=null)=>({final,match1});

test('Excel columns match the exact 13 rendered Weight headers',()=>{
 assert.deepEqual(XML229_WEIGHT_COLUMNS.map(c=>c.label),[
  'Status','Short name / Valve Hint','DTXR','Branch','Line Key','ComponentType',
  'Bore','Rating','Node','ComponentRefNo_Endpoint','Length',
  'Nearest Suggestions','Applied Weight',
 ]);
 const html=renderXml229WeightReviewPage({rows:[],totalCount:0},0,{
  columnFilters:{status:{values:['Final reviewed']}},sort:{column:'rating',direction:'desc'},
 });
 assert.equal((html.match(/data-p4-excel-column=/g)||[]).length,13);
 assert.match(html,/data-p4-excel-column="componentType"/);
 assert.match(html,/data-p4-excel-clear/);
 assert.match(html,/1 active column\(s\)/);
 assert.match(html,/sorted descending/);
 assert.doesNotMatch(html,/data-p4-applied-weight/);
});
test('status and Applied Weight reflect accepted Worker facts, not proposed values',()=>{
 assert.equal(xml229ExcelCell(base,status(),'status'),'No recorded mass');
 assert.equal(xml229ExcelCell(base,status({state:'accepted',value:0}),'status'),
   'Final 0 kg (confirmed)');
 assert.equal(xml229ExcelCell(base,status({state:'accepted',value:0}),'appliedWeight'),'0');
 assert.equal(xml229ExcelCell(base,status({state:'accepted',value:7}),'appliedWeight'),'7');
 assert.equal(xml229ExcelCell({...base,sourceKg:9},status(),'status'),'Original XML mass');
 assert.equal(xml229ExcelCell(base,status(null,{state:'accepted',value:6}),'status'),'Match-1 reviewed');
 assert.equal(xml229ExcelCell(base,status(),'appliedWeight'),'(Blanks)');
 assert.equal(xml229ExcelCell(base,{hasSuggestions:true},'nearestSuggestions'),'Has suggestions');
});
test('source-wide facets honor other columns without self-filtering and include blanks',()=>{
 const rows=[
  {index:0,cells:{componentType:'INST',branchName:'B-10',rating:'300',appliedWeight:'0'}},
  {index:1,cells:{componentType:'VALV',branchName:'B-10',rating:'150',appliedWeight:'18'}},
  {index:2,cells:{componentType:'INST',branchName:'B-20',rating:'300',appliedWeight:'(Blanks)'}},
  {index:3,cells:{componentType:'INST',branchName:'B-10',rating:'600',appliedWeight:'4'}},
 ];
 const {columnFilters}=parseXml229ExcelRequest({columnFilters:{
  branchName:{values:['B-10']},rating:{values:['300']},
 }});
 assert.deepEqual(rows.filter(x=>matchesXml229ExcelColumns(x.cells,columnFilters)).map(x=>x.index),[0]);
 const facets=xml229ExcelColumnOptions(rows,{column:'rating',columnFilters});
 assert.deepEqual(facets.options.map(x=>[x.value,x.count]),[['150',1],['300',1],['600',1]]);
 const options=xml229ExcelColumnOptions(rows,{column:'appliedWeight',columnFilters:{},search:''});
 assert.equal(options.options[0].value,'(Blanks)');
 assert.equal(options.totalDistinct,4);
 const narrowed=xml229ExcelColumnOptions(rows,{column:'branchName',columnFilters:{},search:'-20'});
 assert.deepEqual(narrowed.options,[{value:'B-20',count:1}]);
});
test('AND-selected values, text contains and zero-selected rows remain read-only',()=>{
 const req=parseXml229ExcelRequest({columnFilters:{
  componentType:{values:['INST','RIGID']},dtxr:{contains:'VAlvE'},
 }});
 assert.equal(matchesXml229ExcelColumns({
  componentType:'INST',dtxr:'Gate Valve Flgd'},req.columnFilters),true);
 assert.equal(matchesXml229ExcelColumns({
  componentType:'VALV',dtxr:'Gate Valve Flgd'},req.columnFilters),false);
 assert.equal(matchesXml229ExcelColumns({
  componentType:'INST',dtxr:'Gasket'},req.columnFilters),false);
 assert.equal(matchesXml229ExcelColumns({
  componentType:'VALV',dtxr:'Gasket'},req.columnFilters,'componentType'),false);
 const zero=parseXml229ExcelRequest({columnFilters:{status:{values:[]}}});
 assert.equal(matchesXml229ExcelColumns({status:'Final reviewed'},zero.columnFilters),false);
});
test('numeric sorting orders original occurrences stably, blanks last in either direction',()=>{
 const inputs=['100','2','30','(Blanks)','2'].map((v,index)=>({
  index,cells:{appliedWeight:v},
 }));
 assert.deepEqual(sortXml229ExcelRows([...inputs],{column:'appliedWeight',direction:'asc'})
  .map(x=>x.index),[1,4,2,0,3]);
 assert.deepEqual(sortXml229ExcelRows([...inputs],{column:'appliedWeight',direction:'desc'})
  .map(x=>x.index),[0,2,1,4,3]);
});
test('reject unknown keys, malformed filters, unbounded selection and unsupported sort',()=>{
 for(const columnFilters of [
  {'__proto__':null,foo:{values:['yes']}},{status:{values:[1]}},
  {status:{values:['yes','yes']}},{status:{contains:'x'.repeat(121)}},
  {status:{values:Array.from({length:251},(_,i)=>String(i))}},
  {status:{values:['ok'],bad:true}},
 ]){
  assert.throws(()=>parseXml229ExcelRequest({columnFilters}),/WEIGHT_EXCEL_/);
 }
 assert.throws(()=>parseXml229ExcelRequest({sort:{column:'NOPE',direction:'asc'}}),
  /WEIGHT_EXCEL_SORT_INVALID/);
 assert.throws(()=>parseXml229ExcelRequest({sort:{column:'status',direction:'down'}}),
  /WEIGHT_EXCEL_SORT_INVALID/);
 assert.throws(()=>xml229ExcelColumnOptions([],{column:'status',columnFilters:{},limit:1000}),
  /WEIGHT_EXCEL_OPTIONS_INVALID/);
});
test('authoritative source, served docs and P4 panel remain byte-identical',async()=>{
 const root=new URL('../',import.meta.url),names=[
  'tabs/xml-cii-2019-standalone/integration/xml229-weight-excel-filter.mjs',
  'tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',
  'tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-client.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-excel-autofilter.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',
 ];
 for(const path of names){
  const a=await readFile(new URL(path,root),'utf8');
  const b=await readFile(new URL('docs/'+path,root),'utf8');
  assert.equal(a,b,path);
 }
 const panel=await readFile(new URL(names.at(-1),root),'utf8');
 assert.ok(panel.split('\n').length<=620,'keep existing controller ratchet');
 assert.match(panel,/excel\.snapshot\(\)/);
 assert.match(panel,/excel\.reset\(\)/);
 const worker=await readFile(new URL(names[1],root),'utf8');
 assert.match(worker,/req\.what==='column-options'/);
 assert.match(worker,/matchesXml229ExcelColumns/);
});

test('Hide <=6mm is display-only, inclusive, source-verified and defaults off',async()=>{
 assert.equal(XML229_SHORT_ELEMENT_HIDE_LIMIT_MM,6);
 for(const mm of [0,2,3,6])assert.equal(isXml229VerifiedShortPhysical({lengthMm:mm}),true);
 for(const mm of [6.001,10,305,-1,Infinity,NaN,'3',null,undefined])
  assert.equal(isXml229VerifiedShortPhysical({lengthMm:mm}),false);
 assert.equal(isXml229VerifiedShortPhysical({},6),false);
 const html=renderXml229WeightReviewPage({
   totalCount:2,populationCount:5,hiddenShortCount:3,rows:[{
    occurrenceId:'SOURCE',componentType:'VALV',lengthMm:10,proposals:[],
   }],
 },0,{hideShortMm:true});
 assert.match(html,/data-p4-hide-short-mm/);
 assert.match(html,/type="checkbox" checked/);
 assert.match(html,/3 verified ≤6 mm physical row\(s\) hidden/);
 assert.match(html,/table only/);
 const defaultHtml=renderXml229WeightReviewPage({totalCount:0,rows:[]});
 assert.doesNotMatch(defaultHtml,/type="checkbox" checked/);
 const root=new URL('../',import.meta.url);
 const worker=await readFile(new URL('tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',root),'utf8');
 const client=await readFile(new URL('tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-client.mjs',root),'utf8');
 const panel=await readFile(new URL('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',root),'utf8');
 const popup=await readFile(new URL('tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-excel-autofilter.mjs',root),'utf8');
 assert.match(worker,/hideShortMm&&isXml229VerifiedShortPhysical\(meta\)/);
 assert.match(worker,/typeof req\.hideShortMm!=='boolean'/);
 assert.match(worker,/hiddenShortCount/);
 assert.match(client,/readColumnOptions\(\{column,filter='all',query='',columnFilters=\{\},search='',hideShortMm=false\}/);
 assert.match(panel,/hideShortMm=event\.target\.checked/);
 assert.match(panel,/render\(\{suppressAutoCommit:true\}\)/);
 assert.match(popup,/hideShortMm:scope\.hideShortMm/);
 assert.doesNotMatch(worker,/hideShortMm\s*\?\s*review\./);
});
