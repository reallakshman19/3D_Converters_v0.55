#!/usr/bin/env node
// Offline, private-only, bounded; never records original source or authorizes CII.
import {stat,readFile} from 'node:fs/promises';
import {auditXml229CrossWorkerFlowTrace}
 from '../contracts/xml229-flow-trace-v1/audit.mjs';
const files=process.argv.slice(2);
if(files.length!==1){
 console.error('Usage: node scripts/xml229-audit-cross-worker-flow.mjs <local-private-flow-trace.json>');
 process.exitCode=1;
}else{
 try{
   const f=await stat(files[0]);
   if(!f.isFile()||f.size<1||f.size>131072)throw Error('NOT_BOUNDED');
   const v=JSON.parse(await readFile(files[0],'utf8'));
   const outcome=auditXml229CrossWorkerFlowTrace(v);
   console.log(JSON.stringify(outcome,null,2));
   process.exitCode=outcome.status==='BROKEN_FLOW'?2:
     outcome.status==='INVALID'?3:0;
 }catch{
   console.error('Invalid or unreadable bounded private flow-trace file.');
   process.exitCode=1;
 }
}
