#!/usr/bin/env node
/** Read-only local audit of redacted XML229 evidence JSON; never issues Run permission. */
import {readFile,stat} from 'node:fs/promises';
import {auditXml229Evidence} from '../contracts/xml229-evidence-v1/audit.mjs';

const filename=process.argv[2];
if(!filename||process.argv.length!==3){
  process.stderr.write('Usage: node scripts/xml229-audit-evidence.mjs <readiness-or-evidence.json>\n');
  process.exitCode=1;
}else{
  try{
    const size=(await stat(filename)).size;
    if(size===0||size>16*1024*1024)throw Error('SIZE');
    const parsed=JSON.parse(await readFile(filename,'utf8'));
    // Existing Output/Run downloads contain a readiness report, not an
    // engineering proof. Treat such input as INCOMPLETE: never invent receipts.
    const input=parsed?.checklistRows&&parsed?.summary ? {readiness:parsed}:parsed;
    const result=auditXml229Evidence(input);
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if(result.status==='INCONSISTENT')process.exitCode=2;
    else if(result.status==='INCOMPLETE')process.exitCode=3;
  }catch{
    // Do not echo file paths, private source text or attacker-provided errors.
    process.stderr.write('XML229_EVIDENCE_READ_FAILED\n');
    process.exitCode=1;
  }
}
