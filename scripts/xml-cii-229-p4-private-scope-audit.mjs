/**
 * XML229 P4 read-only original XML selection audit.
 * The Owner's private source is NOT sent to GitHub, browser storage, or logs.
 * Example:
 * node scripts/xml-cii-229-p4-private-scope-audit.mjs --xml original.xml
 *   --selection original-selection.json --expect 28 --out audit.json
 *
 * JSON report contains only SHA256, counts, selection-custody status and HOLD.
 * It cannot authorize Weight/Final or native CII output.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {buildXmlCiiBranchOccurrences,xmlCiiSourceDigest}
 from '../tabs/xml-cii-2019-standalone/xml-cii-branch-scope.js';
import {assertXml229P4OriginalFullSelection}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js';

export function auditXml229PrivateP4Scope({xml,branchSelection={},expectedSelectedCount=null}={}){
 const text=String(xml??'');
 if(!text.trim())throw new Error('ORIGINAL_XML_REQUIRED');
 const original=buildXmlCiiBranchOccurrences(text);
 if(!original.length)throw new Error('ORIGINAL_XML_BRANCH_CENSUS_EMPTY');
 const sourceSha256=createHash('sha256').update(text).digest('hex');
 const sourceDigest=xmlCiiSourceDigest(text);
 let scope=null,errorCode=null;
 try{scope=assertXml229P4OriginalFullSelection({sourceText:text,branchSelection});}
 catch(error){errorCode=error?.code||'SOURCE_SCOPE_UNVERIFIED';}
 const explicit=Array.isArray(branchSelection?.selectedBranchOccurrenceIds)||
   Array.isArray(branchSelection?.selectedBranchNames);
 const selectionBound=explicit?branchSelection.sourceDigest===sourceDigest:null;
 // A stale selection is never normalized for authoritative P4 reporting.
 const knownCount=selectionBound===false?null:
   scope?.selectedBranchOccurrences?.length??null;
 const expectedMatch=expectedSelectedCount===null?null:
   knownCount===Number(expectedSelectedCount);
 const allowed=!errorCode&&expectedMatch!==false;
 const result=Object.freeze({
   schema:'XML229.P4.PrivateOriginalScopeAudit.v1',
   evidence:'LOCAL_SOURCE_ONLY_NOT_INDEPENDENTLY_ATTESTED',
   sourceSha256,sourceBranchOccurrenceCount:original.length,
   explicitlySelected:explicit,selectionBoundToCurrentXml:selectionBound,
   verifiedFullSourceSelectedCount:knownCount,expectedSelectedCount,
   expectedSelectedCountMatched:expectedMatch,
   originalPhysicalFactCensusVerified:false,
   weightFinalEngineeringAccepted:false,
   nativeCiiReleaseAuthorized:false,
   status:allowed?'FULL_ORIGINAL_XML_SCOPE_ELIGIBLE_ONLY':'HOLD',
   blocker:errorCode||(expectedMatch===false?'SELECTED_COUNT_MISMATCH':null),
   note:'No original XML contents, names or staged JSON included. Eligible full XML scope alone does not prove original JSON, physical FactRecords, Final decisions or CII output.',
 });
 return result;
}
export async function auditXml229PrivateP4ScopeFiles({xmlPath,selectionPath=null,expected=null,out=null}={}){
 if(typeof xmlPath!=='string'||!xmlPath)throw new Error('ORIGINAL_XML_PATH_REQUIRED');
 const raw=await readFile(xmlPath,'utf8');
 if(Buffer.byteLength(raw,'utf8')>100*1024*1024)throw new Error('XML_INPUT_EXCEEDS_LOCAL_AUDIT_BOUND');
 const selection=selectionPath?JSON.parse(await readFile(selectionPath,'utf8')):{};
 const report=auditXml229PrivateP4Scope({
   xml:raw,branchSelection:selection,
   expectedSelectedCount:expected===null?null:Number(expected),
 });
 const json=JSON.stringify(report,null,2)+'\n';
 if(out)await writeFile(out,json,'utf8');
 return {report,json};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);const get=key=>{
  const at=args.indexOf('--'+key);
  return at<0?null:args[at+1]??null;
 };
 try{
  const {report,json}=await auditXml229PrivateP4ScopeFiles({
   xmlPath:get('xml'),selectionPath:get('selection'),
   expected:get('expect')===null?null:Number(get('expect')),out:get('out'),
  });
  if(!get('out'))process.stdout.write(json);
  if(report.status==='HOLD')process.exitCode=2;
 }catch(error){
  process.stderr.write('P4 source-scope audit unavailable: '+String(error?.code||error?.message||'ERROR')+'\n');
  process.exitCode=1;
 }
}
