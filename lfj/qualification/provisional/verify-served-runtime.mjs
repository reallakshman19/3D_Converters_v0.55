/**
 * LFJ #1105 / P01 U03 — independent HTTP-served module byte attestation.
 *
 * The expected hashes are recomputed from actual canonical lfj/** bytes at
 * the exact checked-out commit, not accepted from the co-copied site report.
 * The source-derived report declares the expected closure only. This script
 * does NOT publish docs/lfj or grant application/engineering authority.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export class LFJServedProvenanceError extends Error{
  constructor(code,detail){super(code+': '+detail);this.name='LFJServedProvenanceError';this.code=code;}
}
const fail=(code,detail)=>{throw new LFJServedProvenanceError(code,detail);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const allowed=/^lfj\/(?:[a-z0-9_-]+\/)*[a-z0-9._-]+\.mjs$/i;
const jsMime=/^(?:text|application)\/javascript(?:\s*;|\s*$)/i;
const maxModuleBytes=1048576;

export async function auditServedRuntime({
  origin,reportPath,sourceRoot=canonicalRoot,fetchImpl=globalThis.fetch
}={}){
  if(typeof origin!=='string'||typeof reportPath!=='string'||!origin||!reportPath||
     typeof fetchImpl!=='function')fail('AUDIT_INPUT_REQUIRED','origin, report and HTTP fetch required');
  const url=new URL(origin);
  if(!['http:','https:'].includes(url.protocol)||url.pathname!=='/'||
     url.search||url.hash||url.username||url.password)
    fail('AUDIT_ORIGIN_INVALID','fixed origin root required; no redirect or credential URLs');
  const root=resolve(sourceRoot);
  let report;
  try{report=JSON.parse(await readFile(reportPath,'utf8'));}
  catch{fail('AUDIT_REPORT_INVALID','cannot parse independent source-derived closure report');}
  if(report.schema!=='LFJ.ProvisionalServedClosure.v1'||
    report.stageOrigin!=='DISPOSABLE_NOT_AUTHORED_DOCS'||
    !Array.isArray(report.files)||report.files.length<14||
    !Array.isArray(report.entrypoints)||report.entrypoints.length<4)
    fail('AUDIT_REPORT_INVALID','full source-derived package inventory required');
  let gitHead;
  try{gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}
  catch{fail('AUDIT_GIT_SOURCE_INVALID','immutable source checkout required');}
  if(!/^[0-9a-f]{40}$/.test(gitHead)||report.canonicalCommit!==gitHead)
    fail('AUDIT_COMMIT_MISMATCH','report does not match independently checked-out source commit');
  const names=new Set(),attested=[];
  for(const row of report.files){
    const path=row?.source;
    if(typeof path!=='string'||!allowed.test(path)||path.includes('..')||
       names.has(path)||!Number.isSafeInteger(row.bytes)||row.bytes<1||
       row.bytes>maxModuleBytes||!/^[0-9a-f]{64}$/.test(row.sha256))
      fail('AUDIT_MANIFEST_INVALID','unsafe, duplicate or oversized source module entry: '+String(path));
    names.add(path);
    const filename=resolve(root,path);
    if(!filename.startsWith(root+sep))
      fail('AUDIT_PATH_ESCAPE','module escapes immutable source root');
    let source;
    try{source=await readFile(filename);}
    catch{fail('AUDIT_SOURCE_MISSING','canonical LFJ source not found: '+path);}
    const actual=digest(source);
    if(actual!==row.sha256||source.byteLength!==row.bytes)
      fail('AUDIT_SOURCE_MISMATCH','co-copied report disagrees with canonical file: '+path);
    const target=new URL('/'+path,url);
    let response;
    try{
      response=await fetchImpl(target,{redirect:'manual',
        headers:{'cache-control':'no-cache'},cache:'no-store'});
    }catch{fail('AUDIT_HTTP_FAILED','cannot retrieve actual served module: '+path);}
    if(response.status!==200||response.redirected)
      fail('AUDIT_HTTP_NOT_OK','missing or redirected served module: '+path+' HTTP '+response.status);
    const mime=response.headers?.get('content-type')||'';
    if(!jsMime.test(mime))
      fail('AUDIT_MIME_INVALID','served module has non-JavaScript MIME: '+path+' ('+mime+')');
    const declared=response.headers?.get('content-length');
    if(declared!==null&&(Number(declared)>maxModuleBytes||!Number.isFinite(Number(declared))))
      fail('AUDIT_HTTP_SIZE','served module exceeds bounded audit read: '+path);
    let served;
    try{served=new Uint8Array(await response.arrayBuffer());}
    catch{fail('AUDIT_HTTP_BODY','served file body unreadable: '+path);}
    if(served.byteLength!==source.byteLength||served.byteLength>maxModuleBytes||
       digest(served)!==actual)
      fail('AUDIT_HTTP_MISMATCH','served HTTP module differs from canonical source: '+path);
    attested.push({path,sha256:actual,bytes:served.byteLength,mime});
  }
  for(const entry of report.entrypoints){
    if(!names.has(entry))fail('AUDIT_ENTRYPOINT_MISSING','entrypoint omitted: '+entry);
  }
  for(const expected of [
    'lfj/runtime/source-session.mjs','lfj/runtime/indexed-occurrence-pairs.mjs',
    'lfj/ports/source-browser-worker.mjs','lfj/storage/browser/indexed-record-store.mjs'
  ])if(!names.has(expected))
    fail('AUDIT_ENTRYPOINT_MISSING','required actual runtime entrypoint omitted: '+expected);
  return Object.freeze({schema:'LFJ.ServedRuntimeAudit.v1',
    checkedOutSourceCommit:gitHead,actualServedOrigin:url.origin,
    moduleCount:attested.length,modules:attested,
    rightsBasis:'SOURCE_FACTS_ONLY',appWired:false,
    publishedDocsProven:false});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const pick=k=>{const i=process.argv.indexOf(k);return i>=0?process.argv[i+1]:undefined;};
  auditServedRuntime({origin:pick('--origin'),reportPath:pick('--report')})
    .then(out=>console.log('LFJ_HTTP_PROVENANCE_PASS '+JSON.stringify(out)))
    .catch(error=>{console.error('LFJ_HTTP_PROVENANCE_FAIL',error);process.exitCode=1;});
}
