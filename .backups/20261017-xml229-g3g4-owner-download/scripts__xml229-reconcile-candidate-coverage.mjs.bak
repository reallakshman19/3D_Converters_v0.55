#!/usr/bin/env node
// Offline only: compare two exported redacted G3/G4 receipts; never read XML
// or Owner master bytes, and NEVER enable Run based on structural consistency.
import {readFile} from 'node:fs/promises';
import {reconcileXml229CandidateCoverage}
 from '../contracts/xml229-evidence-v1/candidate-readiness-reconciliation.mjs';
async function main(){
 const [g3,g4]=process.argv.slice(2);
 if(!g3||!g4||process.argv.length!==4){
   console.error('Usage: node scripts/xml229-reconcile-candidate-coverage.mjs <g3-coverage.json> <g4-run-advisory.json>');
   process.exitCode=1;return;
 }
 try{
   const [coverage,readiness]=await Promise.all([g3,g4].map(async path=>
     JSON.parse(await readFile(path,'utf8'))));
   const result=reconcileXml229CandidateCoverage({coverage,readiness});
   console.log(JSON.stringify(result,null,2));
   process.exitCode=result.status==='CONSISTENT'?0:
     result.status==='INCOMPLETE'?3:2;
 }catch{
   console.error('Unable to parse both redacted aggregate receipts.');
   process.exitCode=1;
 }
}
await main();
