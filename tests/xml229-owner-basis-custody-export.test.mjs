import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildXml229OwnerEffectiveBasisCustody,OWNER_BASIS_CUSTODY_SCHEMA}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-owner-basis-custody-export.mjs';
const basisId='a'.repeat(64),originalJsonSha256='b'.repeat(64),sourceId='SAFE_SYNTHETIC';
const lease='c'.repeat(64);
const kinds={lineList:['linelist','masterRows'],pipingClass:['pipingClass','masterRows'],
  materialMap:['material','mapRows'],weight:['weight','masterRows']};
const fixture=()=>{
 const masters={},config={overrides:{}},overrides={};
 for(const [kind,[section,prop]] of Object.entries(kinds)){
  const rows=[{TypeDesc:'synthetic valve',kg:12.5}];
  masters[kind]={datasetId:'synthetic:'+kind,revision:1,rows,mapping:{}};
  config[section]={fieldMap:{},[prop]:structuredClone(rows)};
 }
 let current=true,reads=0;
 const receipt={basisId,sourceId,originalJsonSha256,physicalCount:1,
  physicalFactCount:7};
 const inputs={inputLease:lease,isCurrent:()=>current,xmlText:'<synthetic/>',
  originalStagedSourceReceipt:{sha256:originalJsonSha256},sourceId,
  selection:[{sourceId,selectionRef:'all'}],config,masters,overrides};
 const session={receipt,closed:false,async readCompletion(){reads++;return {
  basisId,originalJsonSha256,engineeringFactsVerified:true,
  ciiReleaseAuthorized:false,verifiedPhysicalCount:1,verifiedFactCount:7};}};
 return {masters,inputs,session,lease,isCurrent:()=>current,
  close:()=>{current=false;},get reads(){return reads}};
};
test('Owner private export checks exact current lease and all four normalized master digests',async()=>{
 const f=fixture();const report=await buildXml229OwnerEffectiveBasisCustody(f);
 assert.equal(report.schema,OWNER_BASIS_CUSTODY_SCHEMA);
 assert.equal(report.basisId,basisId);
 assert.equal(report.privateOwnerLocalOnly,true);
 assert.equal(Object.keys(report.masterDigests).length,4);
 assert.equal(report.population.facts,7);
 assert.equal(report.historicalDecisionUpdates,0);
 assert.equal(report.finalAcceptedAutomatically,false);
 assert.equal(report.nativeCiiReleaseAuthorized,false);
 assert.equal(f.reads,1);
 assert(!JSON.stringify(report).includes('originalStagedBlob'));
});
test('Owner export refuses stale lease before Worker read',async()=>{
 const f=fixture();
 await assert.rejects(buildXml229OwnerEffectiveBasisCustody({...f,lease:'d'.repeat(64)}),
  {code:'OWNER_CUSTODY_VERIFIED_LIVE_LEASE_REQUIRED'});
 assert.equal(f.reads,0);
});
test('Owner export refuses same-count modified master and inconsistent config overrides',async()=>{
 const f=fixture();f.inputs.masters.weight.rows[0].kg=999;
 await assert.rejects(buildXml229OwnerEffectiveBasisCustody(f),
  {code:'OWNER_CUSTODY_MASTER_CONFIG_DRIFT'});
 const g=fixture();g.inputs.config.overrides={manual:true};
 await assert.rejects(buildXml229OwnerEffectiveBasisCustody(g),
  {code:'OWNER_CUSTODY_OVERRIDES_CONFIG_DRIFT'});
});
test('Owner export refuses wrong Worker InputBasis, stale or cancelled session',async()=>{
 const f=fixture();f.session.receipt.basisId='d'.repeat(64);
 await assert.rejects(buildXml229OwnerEffectiveBasisCustody(f),
  {code:'OWNER_CUSTODY_WORKER_POPULATION_DRIFT'});
 const g=fixture();g.session.readCompletion=async()=>{g.close();return {
   basisId,originalJsonSha256,engineeringFactsVerified:true,ciiReleaseAuthorized:false,
   verifiedPhysicalCount:1,verifiedFactCount:7};};
 await assert.rejects(buildXml229OwnerEffectiveBasisCustody(g),
  {code:'OWNER_CUSTODY_SOURCE_CHANGED_DURING_EXPORT'});
});
test('Private export and download modules have exact served mirror parity',async()=>{
 for(const file of ['xml229-owner-basis-custody-export.mjs','xml229-owner-basis-custody-download.mjs']){
  const path='tabs/xml-cii-2019-standalone/ui-adapted/'+file;
  const root=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const docs=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(root,docs);
  assert.doesNotMatch(root,/\.commitQualifiedBlankFill\(|\.commitVerifiedIndividualWeightReview\(/);
 }
 const panel=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 assert.match(panel,/downloadXml229OwnerBasisCustody/);
 assert.match(panel,/data-p4-export-effective-basis/);
 assert(panel.split('\n').length<=620,'legacy panel size ratchet');
});
