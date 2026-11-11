/**
 * XML229 source-safe historical master forensic check.
 * Read-only: derives imported normalized master digests from public repository
 * source using the exact production parser/mapper. No review state is loaded.
 * Recovering a row digest or mapping does not recreate a browser datasetId.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {canonicalJson} from '../contracts/gc-pw-v1/contract.mjs';
import {prepareNormalizedDataset} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-normalize.js';
import {parseTextSource,parseWorkbookSheet} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-parser.js';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const EXPECTED=Object.freeze({
  pipingClass:Object.freeze({count:10699,source:'docs/Masters/Piping class master.xlsx',sheet:'PMSTable',
    gitBlob:'b3e74b70dd7b567c8dfc0c56e24bee48643e9b20',
    sha256:'d320f34e6fad2f8ed9eeb8fcdf78abc7b7d64493eeff0a4c34481a8c273226ad',
    mappingSha256:'b1be9414bd37d14cdaef87aac13deba1b5cc7f08253fe11531e5bcfa784a5850'}),
  materialMap:Object.freeze({count:383,source:'docs/Masters/PCF_MAT_MAP.TXT',
    gitBlob:'371ce3a1bd854228650847d8f511e98baa5dc5f3',
    sha256:'985a7495bdfe3ac8af9d344c4158afdb7b1063f716b768ebafc37fd67a52fd7d',
    mappingSha256:'d138b30256e691f2437ea0983117a1fad91d74eae9c7d9c72aa29db20cc3ae4a'}),
  weight:Object.freeze({count:1595,source:'docs/Masters/wtValveweights.json',
    gitBlob:'f969d32dfea1bf03eb7dc310d9f3becacad5a4d1',
    sha256:'f2eb76d655f2629a8526b5f12488b467ca2bd1534d4df6929604455fc833fb7f',
    mappingSha256:'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'}),
  lineList:Object.freeze({count:385,status:'UNRECOVERED',sourceSheet:'LineList',
    sha256:'7611c84e6aa365069154cd0eaab04196b930912162487adc7266b8d9962be62d',
    mappingSha256:'ce24f71840ac38d5f014688a68768cab9f459dd20f89378e37b66c80369a7507'}),
});
const err=code=>{const e=new Error(code);e.code=code;throw e;};
export const sha256=input=>createHash('sha256').update(input).digest('hex');
export const canonicalSha256=value=>sha256(canonicalJson(value));
export const gitBlobSha1=buffer=>createHash('sha1').update('blob '+buffer.length+'\0').update(buffer).digest('hex');
export const historicalMasterExpectations=EXPECTED;
export function evaluateHistoricalMaster(key,rows,mapping,sourceBlob){
  const expected=EXPECTED[key];
  if(!expected||key==='lineList')err('HISTORICAL_MASTER_SOURCE_NOT_ATTESTED');
  const report={kind:key,count:rows.length,rowDigest:canonicalSha256(rows),
    mappingDigest:canonicalSha256(mapping),sourceGitBlob:gitBlobSha1(sourceBlob)};
  if(report.count!==expected.count||report.rowDigest!==expected.sha256||
     report.mappingDigest!==expected.mappingSha256||report.sourceGitBlob!==expected.gitBlob)
    err('HISTORICAL_MASTER_RECONSTRUCTION_DRIFT');
  return Object.freeze({...report,source:expected.source,sourceMatchesOctober1:true,
    historicalSessionDatasetIdVerified:false,engineeringMassApproved:false});
}
export async function reconstructHistoricalMasters({xlsx}={}){
  if(!xlsx||typeof xlsx.read!=='function'||typeof xlsx.utils?.sheet_to_json!=='function')
    err('HISTORICAL_XLSX_PARSER_REQUIRED');
  const load=async name=>readFile(path.join(root,name));
  const pipingBytes=await load(EXPECTED.pipingClass.source);
  const workbookBuffer=pipingBytes.buffer.slice(pipingBytes.byteOffset,pipingBytes.byteOffset+pipingBytes.byteLength);
  const rawPiping=parseWorkbookSheet(workbookBuffer,'PMSTable',xlsx);
  const piping=prepareNormalizedDataset('pipingClass',rawPiping,{},{});
  const materialBytes=await load(EXPECTED.materialMap.source);
  const materialBuffer=materialBytes.buffer.slice(materialBytes.byteOffset,materialBytes.byteOffset+materialBytes.byteLength);
  const rawMaterial=parseTextSource(materialBuffer,'PCF_MAT_MAP.TXT','materialMap');
  const material=prepareNormalizedDataset('materialMap',rawMaterial,{},{});
  const weightBytes=await load(EXPECTED.weight.source);
  const weight=JSON.parse(weightBytes.toString('utf8'));
  const results=[evaluateHistoricalMaster('pipingClass',piping.rows,piping.fieldMap,pipingBytes),
    evaluateHistoricalMaster('materialMap',material.rows,material.fieldMap,materialBytes),
    evaluateHistoricalMaster('weight',weight,{},weightBytes)];
  return Object.freeze({schema:'XML229.HistoricalThreeMasterReconstruction.v1',
    baselineGitCommit:'f2cc9d3fa19233a891ea475f4c777536482e508c',
    baselineGitCommitDate:'2026-10-01T16:00:46Z',
    recoveredMasterCount:3,expectedMasterCount:4,recovered:results,
    lineList:{status:'UNRECOVERED',expectedCount:EXPECTED.lineList.count,
      expectedSha256:EXPECTED.lineList.sha256,
      expectedMappingSha256:EXPECTED.lineList.mappingSha256,
      reason:'NO_OCTOBER_16_LINE_LIST_SHEET_WITH_VERIFIED_385_ROW_SOURCE'},
    fullHistoricalInputBasisVerified:false,sessionDatasetIdsVerified:false,
    historicalDecisionsMutated:0,historicalKgApproved:0,finalApproved:0,
    nativeCiiReleaseAuthorized:false,
    verdict:'PARTIAL_THREE_OF_FOUR_MASTERS_CONTENT_VERIFIED_HOLD'});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const {default:xlsx}=await import('xlsx');
    const result=await reconstructHistoricalMasters({xlsx});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    process.exitCode=2; // intentional HOLD: fourth master and session inputs missing
  }catch(e){
    process.stderr.write('HISTORICAL_RECONSTRUCTION_FAILED '+String(e?.code||e?.message||e)+'\n');
    process.exitCode=1;
  }
}
