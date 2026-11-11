import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareXml229G3G4LocalAggregateExport as prepare}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-g3g4-local-aggregate-export.mjs';
const s='a'.repeat(64),h='b'.repeat(64);
const err=e=>e?.code==='G3_G4_AGGREGATE_EXPORT_HELD';
const clone=x=>structuredClone(x);
const counts=()=>({zeroCandidateOccurrences:1,oneCandidateOccurrences:1,
 multiCandidateOccurrences:0,qualifiedCandidateCount:1,unqualifiedCandidateCount:0,
 occurrencesWithQualifiedCandidates:1,onlyUnqualifiedCandidateOccurrences:0,
 multipleQualifiedCandidateOccurrences:0,positiveSourceMassCount:0,
 nullSourceMassCount:2,invalidSourceMassCount:0,acceptedMatch1Count:0,
 acceptedFinalCount:0,rejectedMatch1Count:0,deferredMatch1Count:0,
 rejectedFinalCount:0,deferredFinalCount:0});
function fixture(){
 const coverage={schema:'XML229.G3.CandidateCoverageReport.v1',basisId:s,
  sourceId:'S1',originalJsonSha256:h,sourceGenerationId:'G1',requestId:'R1',
  physicalCount:2,verifiedFactCount:14,proposalCount:1,
  counts:counts(),decisionRevisions:{match1:null,final:null},
  sourceBasisVerified:true,reviewDecisionsAuthorized:false,
  nativeQualificationAuthorized:false,nativeCiiReleaseAuthorized:false};
 const readiness={schema:'XML229.P4.RunAdvisory.v1',basisId:s,sourceId:'S1',
  originalJsonSha256:h,sourceGenerationId:'G1',
  verifiedPhysicalCount:2,verifiedFactCount:14,
  counts:{source:0,match1:0,final:0,unresolved:2},
  stageRevisions:{S1:{match1:null,final:null}},
  engineeringFactsVerified:true,ciiReleaseAuthorized:false};
 return {pair:{schema:'XML229.G3G4.SourceBoundAggregatePair.v1',
  coverage,readiness,reconciliation:{status:'CONSISTENT',authoritative:false,
   nativeCiiReleaseAuthorized:false},readOnly:true,
  reviewDecisionsAuthorized:false,nativeCiiReleaseAuthorized:false},
  receipt:{basisId:s,sourceId:'S1',originalJsonSha256:h,sourceGenerationId:'G1'}};
}
test('private download contains only whitelisted G3/G4 aggregates',()=>{
 const x=fixture();
 x.pair.coverage.masterRows=[{secret:'VERY_PRIVATE_MASTER'}];
 x.pair.coverage.counts.extremePrivateKg=99999;
 x.pair.readiness.nativePhysicalValues=[777];
 const result=prepare(x);
 assert.equal(result.filename,'xml229-g3-g4-source-bound-aggregate.json');
 const parsed=JSON.parse(result.text);
 assert.equal(parsed.coverage.physicalCount,2);
 assert.equal(parsed.structuralStatus,'CONSISTENT');
 assert.equal(parsed.nativeCiiReleaseAuthorized,false);
 for(const privateText of ['VERY_PRIVATE_MASTER','extremePrivateKg',
   'nativePhysicalValues','99999','777'])
  assert.equal(result.text.includes(privateText),false);
});
test('source, generation and basis drift forbid local export',()=>{
 for(const key of ['basisId','sourceId','originalJsonSha256','sourceGenerationId']){
  const x=fixture();x.receipt[key]='OTHER';
  assert.throws(()=>prepare(x),err);
 }
});
test('unverified, inconsistent and release-authorizing report denied',()=>{
 const x=fixture();x.pair.reconciliation.status='INCONSISTENT';
 assert.throws(()=>prepare(x),err);
 const y=fixture();y.pair.nativeCiiReleaseAuthorized=true;
 assert.throws(()=>prepare(y),err);
 const z=fixture();z.pair.readiness.ciiReleaseAuthorized=true;
 assert.throws(()=>prepare(z),err);
 const p=fixture();p.pair.coverage.reviewDecisionsAuthorized=true;
 assert.throws(()=>prepare(p),err);
});
test('missing pair or receipt fails without partial file',()=>{
 assert.throws(()=>prepare(),err);
 assert.throws(()=>prepare({pair:{},receipt:{}}),err);
});
test('source and served local export contract remain byte-identical',async()=>{
 const src=new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-g3g4-local-aggregate-export.mjs',import.meta.url);
 const served=new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-g3g4-local-aggregate-export.mjs',import.meta.url);
 const [a,b]=await Promise.all([readFile(src,'utf8'),readFile(served,'utf8')]);
 assert.equal(a,b);
});

test('one-click downloaded local aggregate validates with a single offline CLI argument',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'xml229-g3g4-redacted-'));
 try{
   const p=join(temp,'aggregate.json');
   await writeFile(p,prepare(fixture()).text,'utf8');
   const cli=fileURLToPath(new URL('../scripts/xml229-reconcile-candidate-coverage.mjs',import.meta.url));
   const run=(input)=>spawnSync(process.execPath,[cli,input],{encoding:'utf8'});
   const ok=run(p);
   assert.equal(ok.status,0,ok.stderr+' '+ok.stdout);
   assert.equal(JSON.parse(ok.stdout).status,'CONSISTENT');
   assert.equal(JSON.parse(ok.stdout).nativeCiiReleaseAuthorized,false);

   const forged=JSON.parse(await readFile(p,'utf8'));
   forged.nativeCiiReleaseAuthorized=true;
   await writeFile(p,JSON.stringify(forged),'utf8');
   const denied=run(p);
   assert.equal(denied.status,3);
   assert.equal(JSON.parse(denied.stdout).status,'INCOMPLETE');

   forged.nativeCiiReleaseAuthorized=false;
   forged.coverage.originalJsonSha256='c'.repeat(64);
   await writeFile(p,JSON.stringify(forged),'utf8');
   const drift=run(p);
   assert.equal(drift.status,2);
   assert(JSON.parse(drift.stdout).issues.includes('G3_G4_INPUT_BASIS_DRIFT'));

   await writeFile(p,'X'.repeat(65537),'utf8');
   const oversized=run(p);
   assert.equal(oversized.status,1);
   assert(!oversized.stdout.includes('X'.repeat(50)));
 }finally{await rm(temp,{recursive:true,force:true});}
});
