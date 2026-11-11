/**
 * Byte-preserving installer for the owner's BC4.xlsx test fixture.
 * Local source file only: never uploads a workbook or writes GC-PW decisions.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const dir=path.join(root,'tests/fixtures/xml229');
const manifest=JSON.parse(await readFile(path.join(dir,'BC4.fixture.json'),'utf8'));
export const gitBlobSha1=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function validateBc4Bytes(bytes){
 if(bytes.length!==manifest.sizeBytes||sha256(bytes)!==manifest.sha256||
    gitBlobSha1(bytes)!==manifest.gitBlobSha1)
  throw Object.assign(new Error('BC4_FIXTURE_BYTES_NOT_MATCHED'),{code:'BC4_FIXTURE_BYTES_NOT_MATCHED'});
 return Object.freeze({sha256:manifest.sha256,bytes:bytes.length,source:'OWNER_UPLOADED_BC4'});
}
export async function installBc4(sourceFile){
 if(!sourceFile)throw new Error('Usage: node scripts/xml229-install-bc4-fixture.mjs /path/to/BC4.xlsx');
 const bytes=await readFile(sourceFile);
 const attested=validateBc4Bytes(bytes);
 await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,'BC4.xlsx'),bytes,{flag:'w'});
 const checked=validateBc4Bytes(await readFile(path.join(dir,'BC4.xlsx')));
 if(checked.sha256!==attested.sha256)throw new Error('BC4_FIXTURE_POSTCOPY_DRIFT');
 return {destination:'tests/fixtures/xml229/BC4.xlsx',
  ...attested,historyInputBasisVerified:false,
  historicalReviewDecisionsMutated:0,nativeCiiReleaseAuthorized:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await installBc4(process.argv[2]),null,2));}
 catch(e){console.error(String(e.code||e.message));process.exitCode=1;}
}
