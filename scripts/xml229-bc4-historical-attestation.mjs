/**
 * Read-only historical BC4 Line List comparator; private backup stays local.
 * Exit 2 = HOLD, exit 1 = corrupt evidence. No GC-PW review/Final writer.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {parseTextSource} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-parser.js';
import {prepareNormalizedDataset} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-normalize.js';
import {canonicalJson} from '../contracts/gc-pw-v1/contract.mjs';

export const ORIGINAL_BACKUP_SHA256='8c8e1a85a455eb541418d98de2b050d1b3bd482641333581f4373a48a3727aa8';
export const BC4_FIXTURE_SHA256='53b322405795dc7a74c1154043c31bf9c8b2a1763f207cabf0c7f1888fd9c1bb';
const EXPECTED_COUNT=385, HEX=/^[a-f0-9]{64}$/i;
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonicalSha=o=>sha(Buffer.from(canonicalJson(o)));
const validObject=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const fail=code=>{const e=new Error(code);e.code=code;throw e;};

export function inspectHistoricalBasisBackup(backup,rawFileSha256){
 if(rawFileSha256!==ORIGINAL_BACKUP_SHA256||
    backup?.schema!=='XML229.SourceBoundGC-PWReviewBackup.v1'||
    backup.physicalCount!==423||backup.factCount!==2961||
    backup.nativeCiiReleaseAuthorized!==false)
  fail('PRIVATE_BACKUP_INTEGRITY_OR_SOURCE_MISMATCH');
 const all=backup.inputBasisDigests,line=all?.masters?.lineList;
 if(!validObject(line)||line.rowCount!==EXPECTED_COUNT||
    !HEX.test(line.sha256)||!HEX.test(line.mappingSha256)||
    !HEX.test(all.configSha256)||Object.keys(all.masters||{}).length!==4)
  fail('PRIVATE_BACKUP_MISSING_FOUR_MASTER_DIGESTS');
 return {historicalLineListCount:line.rowCount,historicalRowSha256:line.sha256,
  historicalMapSha256:line.mappingSha256,historicalEffectiveConfigSha256:all.configSha256};
}

export function evaluateBc4Fixture({fixtureBytes,historical,appliedFieldMap=null}){
 if(!fixtureBytes||sha(fixtureBytes)!==BC4_FIXTURE_SHA256)
  fail('ORIGINAL_BC4_JSON_FIXTURE_CHANGED');
 const source=JSON.parse(fixtureBytes.toString('utf8'));
 if(source.schema!=='XML229.BC4.LineListRawJsonFixture.v1'||
    source.rowCount!==EXPECTED_COUNT||source.rows?.length!==EXPECTED_COUNT||
    source.engineeringApproval!==false||source.nativeCiiReleaseAuthorized!==false)
  fail('BC4_FIXTURE_METADATA_DRIFT');
 if(!validObject(historical)||historical.historicalLineListCount!==EXPECTED_COUNT||
    !HEX.test(historical.historicalRowSha256)||!HEX.test(historical.historicalMapSha256))
  fail('HISTORICAL_DIGESTS_REQUIRED');
 if(appliedFieldMap!==null&&!validObject(appliedFieldMap))
  fail('FIELD_MAP_MUST_BE_OBJECT');
 const ab=fixtureBytes.buffer.slice(fixtureBytes.byteOffset,fixtureBytes.byteOffset+fixtureBytes.byteLength);
 const rawRows=parseTextSource(ab,'BC4.LineList.json','lineList');
 if(rawRows.length!==EXPECTED_COUNT)fail('BC4_PARSER_ROWCOUNT_DRIFT');
 const normalized=prepareNormalizedDataset('lineList',rawRows,{}, {},appliedFieldMap);
 const currentMapDigest=canonicalSha(normalized.fieldMap);
 const currentRowsDigest=canonicalSha(normalized.rows);
 const mappingMatches=currentMapDigest===historical.historicalMapSha256;
 const rowsMatch=currentRowsDigest===historical.historicalRowSha256;
 return Object.freeze({
  schema:'XML229.BC4.HistoricalLineListComparison.v1',
  source:'OWNER_BC4_JSON_FIXED_SHA256',rawRows:rawRows.length,
  selectedMappingSource:appliedFieldMap===null?'CURRENT_AUTOMATIC_MAPPING':'SUPPLIED_APPLIED_MAPPING_CANDIDATE',
  currentMapDigest,currentRowsDigest,historicalMapDigest:historical.historicalMapSha256,
  historicalRowsDigest:historical.historicalRowSha256,mappingMatches,rowsMatch,
  historicalLineListContentVerified:mappingMatches&&rowsMatch,
  originalAppliedMappingProvided:appliedFieldMap!==null,
  historicalEffectiveConfigSha256:historical.historicalEffectiveConfigSha256||null,
  fullOriginalInputBasisVerified:false,historicalDecisionUpdates:0,
  engineeringKgApproved:0,acceptedFinal:0,governedNativeCiiReleaseAuthorized:false,
  verdict:mappingMatches&&rowsMatch?'LINELIST_CONTENT_MATCH_ONLY_INPUT_BASIS_STILL_HELD':
    'HISTORICAL_LINELIST_RECONSTRUCTION_NOT_ATTESTED_HOLD',
 });
}
export async function runHistoricalBc4Attestation({fixturePath,backupPath,mapPath=null}){
 if(!fixturePath||!backupPath)fail('PRIVATE_BACKUP_AND_BC4_FIXTURE_REQUIRED');
 const [fixtureBytes,backupBytes]=await Promise.all([readFile(fixturePath),readFile(backupPath)]);
 const historical=inspectHistoricalBasisBackup(JSON.parse(backupBytes.toString('utf8')),sha(backupBytes));
 const appliedFieldMap=mapPath?JSON.parse(await readFile(mapPath,'utf8')):null;
 return evaluateBc4Fixture({fixtureBytes,historical,appliedFieldMap});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{
  const args=process.argv.slice(2),opts={};
  for(let i=0;i<args.length;i+=2){
   if(!['--fixture','--backup','--applied-field-map'].includes(args[i])||!args[i+1])
    fail('INVALID_CLI_ARGUMENTS');
   opts[args[i]]=args[i+1];
  }
  const result=await runHistoricalBc4Attestation({fixturePath:opts['--fixture'],
   backupPath:opts['--backup'],mapPath:opts['--applied-field-map']||null});
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  process.exitCode=2;
 }catch(e){process.stderr.write('BC4_HISTORICAL_ATTESTATION_INVALID '+String(e.code||e.message)+'\n');process.exitCode=1;}
}
