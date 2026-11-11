import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {resolveXml229FourMasterCustody} from '../tabs/xml-cii-2019-standalone/integration/xml229-four-master-custody.mjs';
import {DEFAULT_WEIGHT_MASTER_ROWS} from '../converters/xml-cii2019-core/default-weight-master-rows.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const keys=['lineList','pipingClass','materialMap','weight'];
const section={lineList:'linelist',pipingClass:'pipingClass',materialMap:'material',weight:'weight'};
const field={lineList:'masterRows',pipingClass:'masterRows',materialMap:'mapRows',weight:'masterRows'};
const rowsOf=kind=>[{id:kind+'-0',value:11},{id:kind+'-1',value:19}];
const fixture=()=>{
 const config={},context={datasetRefs:{},rowCounts:{},
   sourceMetadata:{},appliedMappingRevision:{}};
 for(const kind of keys){
   config[section[kind]]={[field[kind]]:rowsOf(kind),fieldMap:{tag:'id'}};
   context.rowCounts[kind]=2;
   context.appliedMappingRevision[kind]=2;
   context.sourceMetadata[kind]={status:'loaded',source:kind+'.csv',sourceType:'manual'};
 }
 return {config,context};
};
const rejectCode=(code)=>error=>(assert.equal(error?.code,code,error?.stack),true);
test('valid resident localStorage masters become exact content-attested P4 masters without invented dataset IDs',async()=>{
 const {config,context}=fixture();
 const {masters,attestations}=await resolveXml229FourMasterCustody(config,context);
 assert.deepEqual(Object.keys(masters),keys);
 for(const kind of keys){
   assert.equal(masters[kind].rows.length,2);
   assert.match(masters[kind].datasetId,new RegExp('^resident:'+kind+':sha256:[0-9a-f]{64}$'));
   assert.equal(attestations[kind].storage,'resident');
   assert.equal(attestations[kind].rowCount,2);
   assert.equal(attestations[kind].revision,2);
   assert.match(attestations[kind].mappingSha256,/^[0-9a-f]{64}$/);
 }
 const first=attestations.lineList.contentSha256;
 config.linelist.masterRows[0].value=12;
 const next=await resolveXml229FourMasterCustody(config,context);
 assert.notEqual(first,next.attestations.lineList.contentSha256);
 assert.notEqual(masters.lineList.datasetId,next.masters.lineList.datasetId);
});
test('dataset-backed masters retain dataset identity and still challenge complete rows',async()=>{
 const {config,context}=fixture();
 for(const kind of keys){
   context.datasetRefs[kind]={datasetId:'id-'+kind,rowCount:2,datasetRevision:2};
 }
 const out=await resolveXml229FourMasterCustody(config,context);
 assert.equal(out.masters.lineList.datasetId,'id-lineList');
 assert.equal(out.attestations.lineList.storage,'dataset');
 context.datasetRefs.lineList.rowCount=3;
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context),
   rejectCode('MASTER_DATASET_DRIFT'));
});
test('never accept partial preview samples, corrupt restores, stale counts or counterfeit default weight',async()=>{
 const {config,context}=fixture();
 config.linelist.masterRows=[];
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context),
   rejectCode('MASTER_CONTENT_UNAVAILABLE'));
 config.linelist.masterRows=rowsOf('lineList');
 context.rowCounts.lineList=1;
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context),
   rejectCode('MASTER_ROWCOUNT_DRIFT'));
 context.rowCounts.lineList=2;
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context,{
   restoreFailures:{lineList:{code:'MISSING_DB',message:'Corrupt IndexedDB'}}}),
   rejectCode('MASTER_RESTORE_FAILED'));
 context.sourceMetadata.weight={status:'loaded',source:'Embedded default',sourceType:'default'};
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context),
   rejectCode('BUNDLED_WEIGHT_CUSTODY_INVALID'));
 context.sourceMetadata.weight.sourceType='restore-pending';
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context),
   rejectCode('MASTER_RESTORE_PENDING'));
});

test('repository-bundled 1595 Valve Weights are verified proposals, not a forced reimport or reviewed decision',async()=>{
 const shipped=JSON.parse(await readFile(new URL('../docs/Masters/wtValveweights.json',import.meta.url),'utf8'));
 assert.equal(shipped.length,1595);
 assert.deepEqual(DEFAULT_WEIGHT_MASTER_ROWS,shipped,'embedded default must match bundled repository master');
 const {config,context}=fixture();
 context.sourceMetadata.weight={status:'loaded',source:'Embedded default',sourceType:'default',rowCount:1595};
 config.weight.masterRows=shipped.map(row=>({...row}));
 context.rowCounts.weight=1595;
 context.appliedMappingRevision.weight=1;
 const {masters,attestations}=await resolveXml229FourMasterCustody(config,context);
 assert.match(masters.weight.datasetId,/^bundled:docs\/Masters\/wtValveweights\.json:sha256:[a-f0-9]{64}$/);
 assert.equal(attestations.weight.storage,'bundled');
 assert.equal(attestations.weight.proposalOnly,true);
 assert.equal(attestations.weight.source,'docs/Masters/wtValveweights.json');
 assert.equal(masters.weight.rows.length,1595);
 assert.equal(Object.hasOwn(masters.weight,'accepted'),false);
 config.weight.masterRows[0].weight=999999;
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context),
   rejectCode('BUNDLED_WEIGHT_CUSTODY_DRIFT'));
 context.sourceMetadata.weight.sourceType='restore-pending';
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context),
   rejectCode('MASTER_RESTORE_PENDING'));
 await assert.rejects(()=>resolveXml229FourMasterCustody(config,context,{
   restoreFailures:{weight:{code:'MISSING_DATASET',message:'Persisted Weight is missing'}}}),
   rejectCode('MASTER_RESTORE_FAILED'));
});

test('active existing Preview/Weight/Run routes use the shared session without duplicate build panels',async()=>{
 const paths=[
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-button-session.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',
 ];
 const src=await Promise.all(paths.map(x=>readFile(new URL('../'+x,import.meta.url),'utf8')));
 assert.doesNotMatch(src[0],/installXml229P4PreviewBridge\(|installXml229WorkerHeldWeightPanel\(/);
 assert.match(src[1],/openVerifiedEngineeringSession/);
 assert.match(src[1],/session\.controller=null/);
 assert.match(src[2],/openXml229P4VerifiedSession\(stateRef/);
 assert.match(src[3],/existingWorkflow:true/);
 assert.doesNotMatch(src[4],/installXml229P4RunAdvisory\(/);
 for(const file of paths){
   assert.equal(await readFile(new URL('../'+file,import.meta.url),'utf8'),
     await readFile(new URL('../docs/'+file,import.meta.url),'utf8'),
     'served mirror drift '+file);
 }
});
