/**
 * #1105 / P01_SOURCE U03 — source-derived, reproducible LFJ HTTP staging.
 *
 * This tool NEVER writes to authored docs/lfj/** or 3D application paths.
 * It creates a disposable *candidate* from canonical source and reports which
 * docs/lfj/** modules are still absent/stale. An HTTP-pass here is NOT proof
 * that the checked-in docs publication, GitHub Pages, or #1104 application
 * imports the runtime.
 */
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,relative,dirname,join,sep} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'../../..');
const outArg=process.argv.indexOf('--stage-dir');
if(outArg<0||!process.argv[outArg+1])
  throw Error('STAGING_DIR_REQUIRED: pass --stage-dir <absolute temporary directory>');
const out=resolve(process.argv[outArg+1]);
if(out===root||out.startsWith(root+sep)||
   !out.startsWith(resolve(process.env.RUNNER_TEMP||'/tmp')+sep))
  throw Error('INVALID_STAGING_ROOT: stage outside repository under RUNNER_TEMP');
const gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.match(gitHead,/^[0-9a-f]{40}$/);

const starts=[
  'runtime/source-session.mjs',
  'runtime/indexed-occurrence-pairs.mjs',
  'storage/browser/indexed-record-store.mjs',
  'ports/source-browser-worker.mjs'
];
const dig=b=>createHash('sha256').update(b).digest('hex');
const allowed=/^[A-Za-z0-9_./-]+\.mjs$/;
const found=new Map();
const importFrom=/(?:\bimport|\bexport)\s+(?:[\s\S]*?\s+from\s*)?['"]([^'"]+)['"]/g;
const dynamicImport=/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const urlImport=/\bnew\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g;
async function visit(rel){
  if(found.has(rel))return;
  if(!allowed.test(rel)||rel.startsWith('/')||rel.startsWith('../')||
     rel.split('/').includes('..'))throw Error('UNTRUSTED_BROWSER_IMPORT: '+rel);
  const canonical=resolve(root,'lfj',rel);
  if(!canonical.startsWith(resolve(root,'lfj')+sep))
    throw Error('IMPORT_ESCAPES_LFJ: '+rel);
  const buf=await readFile(canonical);
  const code=buf.toString('utf8');
  found.set(rel,{sha256:dig(buf),bytes:buf.byteLength});
  const imports=[
    ...[...code.matchAll(importFrom)].map(m=>m[1]),
    ...[...code.matchAll(dynamicImport)].map(m=>m[1]),
    ...[...code.matchAll(urlImport)].map(m=>m[1])
  ];
  // Computed dynamic module and Worker URLs cannot be silently omitted from
  // the package closure. Literal dynamic imports and new URL(...) are allowed.
  const observedDynamic=[...code.matchAll(/\bimport\s*\(/g)].length;
  const observedUrls=[...code.matchAll(/\bnew\s+URL\s*\(/g)].length;
  if(observedDynamic!==[...code.matchAll(dynamicImport)].length||
     observedUrls!==[...code.matchAll(urlImport)].length)
    throw Error('COMPUTED_IMPORT_UNSUPPORTED: '+rel);
  for(const spec of imports){
    if(!spec.startsWith('./')&&!spec.startsWith('../'))
      throw Error('EXTERNAL_BROWSER_IMPORT: '+rel+' -> '+spec);
    const child=relative(resolve(root,'lfj'),
      resolve(dirname(canonical),spec)).split(sep).join('/');
    if(!allowed.test(child)||child.startsWith('../'))
      throw Error('IMPORT_NOT_PORTABLE: '+rel+' -> '+spec);
    await visit(child);
  }
}
for(const entry of starts)await visit(entry);
assert.ok(found.has('runtime/source-session.mjs'));
assert.ok(found.has('runtime/indexed-occurrence-pairs.mjs'));
assert.ok(found.has('ports/source-browser-worker.mjs'));

// The original docs/lfj manifest is a historical inventory, NOT the oracle.
const previous=JSON.parse(await readFile(join(root,'docs/lfj/deployment-manifest.json'),'utf8'));
const recorded=new Set(previous.sources.map(s=>s.slice('lfj/'.length)));
for(const p of recorded)assert.ok(found.has(p),'old shipped module not reachable from live public entries: '+p);
const missingInAuthoredDocs=[],changedInAuthoredDocs=[],entries=[];
await cp(join(root,'docs/lfj'),join(out,'lfj'),{recursive:true});
for(const [path,meta] of [...found.entries()].sort(([a],[b])=>a.localeCompare(b))){
  const src=join(root,'lfj',path);
  const target=join(out,'lfj',path);
  const original=await readFile(src);
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,original);
  const staged=await readFile(target);
  assert.equal(dig(staged),meta.sha256,'staged source digest mismatch: '+path);
  try{
    const committed=await readFile(join(root,'docs/lfj',path));
    if(dig(committed)!==meta.sha256)changedInAuthoredDocs.push(path);
  }catch(e){
    if(e?.code!=='ENOENT')throw e;
    missingInAuthoredDocs.push(path);
  }
  entries.push({source:'lfj/'+path,sha256:meta.sha256,bytes:meta.bytes});
}
const report={
  schema:'LFJ.ProvisionalServedClosure.v1',
  canonicalCommit:gitHead,
  stageOrigin:'DISPOSABLE_NOT_AUTHORED_DOCS',
  moduleCount:entries.length,
  entrypoints:starts.map(x=>'lfj/'+x),
  files:entries,
  missingInAuthoredDocs,
  changedInAuthoredDocs,
  assertion:'STAGING_SUCCESS_IS_NOT_DOCS_PUBLICATION'
};
await writeFile(join(out,'lfj/source-derived-staging-report.json'),
  JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  event:'SOURCE_DERIVED_LFJ_PROVISIONAL_STAGE',
  commit:gitHead,moduleCount:entries.length,
  missingInAuthoredDocs,changedInAuthoredDocs,
  stageRoot:out
}));
