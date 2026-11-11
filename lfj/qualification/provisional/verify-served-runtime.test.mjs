import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {auditServedRuntime} from './verify-served-runtime.mjs';

const reportPath=process.env.LFJ_STAGE_ROOT
  ?join(process.env.LFJ_STAGE_ROOT,'lfj/source-derived-staging-report.json')
  :null;
assert.ok(reportPath,'LFJ_STAGE_ROOT from independent canonical staging required');
const origin='http://127.0.0.1:4184/';
const positive=await auditServedRuntime({origin,reportPath});
assert.equal(positive.moduleCount,14);
assert.equal(positive.rightsBasis,'SOURCE_FACTS_ONLY');
assert.equal(positive.appWired,false);
assert.equal(positive.publishedDocsProven,false);
assert.ok(positive.modules.every(x=>x.mime.includes('javascript')));

const target='lfj/runtime/source-session.mjs';
const tamperedFetch=async(url,opts)=>{
  const response=await fetch(url,opts);
  if(new URL(url).pathname!=='/'+target)return response;
  const bytes=new Uint8Array(await response.arrayBuffer());
  bytes[16]^=1;
  return new Response(bytes,{status:200,
    headers:{'content-type':'text/javascript','content-length':String(bytes.length)}});
};
await assert.rejects(
  auditServedRuntime({origin,reportPath,fetchImpl:tamperedFetch}),
  e=>e?.code==='AUDIT_HTTP_MISMATCH',
  'a successful HTTP 200 must not conceal a changed served module');

const missingFetch=(url,opts)=>{
  if(new URL(url).pathname==='/'+target)
    return Promise.resolve(new Response('missing',{status:404,
      headers:{'content-type':'text/plain'}}));
  return fetch(url,opts);
};
await assert.rejects(
  auditServedRuntime({origin,reportPath,fetchImpl:missingFetch}),
  e=>e?.code==='AUDIT_HTTP_NOT_OK',
  'an incomplete publication cannot be accepted by a copied manifest');

const wrongMimeFetch=async(url,opts)=>{
  const response=await fetch(url,opts);
  if(new URL(url).pathname!=='/'+target)return response;
  const bytes=await response.arrayBuffer();
  return new Response(bytes,{status:200,
    headers:{'content-type':'text/plain','content-length':String(bytes.byteLength)}});
};
await assert.rejects(
  auditServedRuntime({origin,reportPath,fetchImpl:wrongMimeFetch}),
  e=>e?.code==='AUDIT_MIME_INVALID',
  'correct bytes with unusable JavaScript MIME cannot be called browser deployment');

const tmp=await mkdtemp(join(process.env.RUNNER_TEMP||tmpdir(),'lfj-sha-test-'));
try{
  const original=JSON.parse(await readFile(reportPath,'utf8'));
  const liar={...original,canonicalCommit:'0'.repeat(40)};
  const path=join(tmp,'spoofed.json');
  await writeFile(path,JSON.stringify(liar));
  await assert.rejects(
    auditServedRuntime({origin,reportPath:path}),
    e=>e?.code==='AUDIT_COMMIT_MISMATCH',
    'a self-asserted manifest source commit cannot impersonate source checkout');
}finally{await rm(tmp,{recursive:true,force:true});}
console.log('LFJ #1105 U03 HTTP provenance PASS: 14/14 real served modules SHA/MIME; changed bytes, 404, wrong MIME and forged commit rejected');
