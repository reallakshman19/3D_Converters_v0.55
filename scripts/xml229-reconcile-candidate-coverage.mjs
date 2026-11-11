#!/usr/bin/env node
/**
 * Offline diagnostics ONLY: one Owner-local redacted G3/G4 aggregate export,
 * or two legacy same-session G3 and G4 receipts. Never read original/master
 * data or authorize native conversion, irrespective of structural consistency.
 */
import {readFile,stat} from 'node:fs/promises';
import {reconcileXml229CandidateCoverage}
 from '../contracts/xml229-evidence-v1/candidate-readiness-reconciliation.mjs';
const localSchema='XML229.G3G4.LocalAggregateEvidenceExport.v1';
const invalid=()=>({schema:'XML229.G3.CandidateReadinessReconciliation.v1',
 status:'INCOMPLETE',issues:['G3_G4_LOCAL_AGGREGATE_ENVELOPE_INVALID'],
 authoritative:false,nativeCiiReleaseAuthorized:false});
async function smallJson(path){
 const info=await stat(path);
 if(!info.isFile()||info.size<1||info.size>65536)
   throw Error('AGGREGATE_FILE_NOT_SMALL_JSON');
 return JSON.parse(await readFile(path,'utf8'));
}
async function main(){
 const files=process.argv.slice(2);
 if(files.length!==1&&files.length!==2){
   console.error('Usage: node scripts/xml229-reconcile-candidate-coverage.mjs <local-g3g4-aggregate.json> OR <coverage.json> <run-advisory.json>');
   process.exitCode=1;return;
 }
 try{
   let coverage,readiness;
   if(files.length===1){
     const e=await smallJson(files[0]);
     if(e?.schema!==localSchema||e?.localOwnerReviewOnly!==true||
        e?.structuralStatus!=='CONSISTENT'||
        e?.reviewDecisionsAuthorized!==false||
        e?.nativeCiiReleaseAuthorized!==false){
       console.log(JSON.stringify(invalid(),null,2));
       process.exitCode=3;return;
     }
     coverage=e.coverage;readiness=e.readiness;
   }else{
     [coverage,readiness]=await Promise.all(files.map(smallJson));
   }
   const result=reconcileXml229CandidateCoverage({coverage,readiness});
   console.log(JSON.stringify(result,null,2));
   process.exitCode=result.status==='CONSISTENT'?0:
     result.status==='INCOMPLETE'?3:2;
 }catch{
   console.error('Cannot read the small local redacted aggregate JSON file(s).');
   process.exitCode=1;
 }
}
await main();
