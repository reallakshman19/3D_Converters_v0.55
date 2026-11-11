/** Real Chromium module -> actual Worker/Pyodide -> CII, source-only and
 * conflicted optional format.  Separate from the governed Final path. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const scenarios={
 sourceOnly:{},
 formatConflict:{regexTester:{formats:[
   {lineKey:{regex:'(P8810021)'},pipingClass:{regex:'(31441C4)'}},
   {lineKey:{regex:'(P8810021)'},pipingClass:{regex:'(PP)'}},
 ]}},
};
async function realBrowserCii(page,sourceXml,config){
 return page.evaluate(async ({xml,config})=>{
   const {runXmlCii2019WorkflowService}=await import(
     new URL('tabs/xml-cii-2019-standalone/xml-cii-workflow-service.js',
       document.baseURI).href);
   const result=await runXmlCii2019WorkflowService({
     sourceKind:'xml',sourceName:'EF-05-PRO.TEST.xml',sourceText:xml,
     supportConfigJson:JSON.stringify(config),options:{outputMode:'cii-only'},
   });
   return {ok:result.ok,error:result.error||null,ciiText:result.ciiText||'',
     enrichment:result.diagnostics?.optionalEnrichment||null,
     nativeReleaseAuthorized:result.diagnostics?.nativeCiiReleaseAuthorized===true};
 },{xml:sourceXml,config});
}
async function independentlyCheckCii(ciiText){
 const directory=await mkdtemp(join(tmpdir(),'xml229-issue376-browser-'));
 try{
  const input=join(directory,'output.cii'),proof=join(directory,'syntax.json');
  await writeFile(input,ciiText,'utf8');
  execFileSync('python3',['converters/scripts/cii_syntax_check_2019.py',
    '--input',input,'--output',proof],{timeout:30000});
  const data=JSON.parse(await readFile(proof,'utf8'));
  assert.equal(data.ok,true,JSON.stringify(data.errors));
  assert.deepEqual(data.errors,[]);
  assert.equal(data.metrics.elements,600);
  return {syntaxOk:true,elements:data.metrics.elements,rigids:data.metrics.rigids};
 }finally{await rm(directory,{force:true,recursive:true});}
}
export async function proveXml229Issue376BrowserNative(page,source,record){
 const original=source.toString('utf8');
 record.stages.issue376BrowserNative={};
 let baseline=null;
 for(const [name,config] of Object.entries(scenarios)){
  const start=Date.now();
  const result=await realBrowserCii(page,original,config);
  assert.equal(result.ok,true,name+': '+result.error);
  assert.equal(result.nativeReleaseAuthorized,false);
  assert.equal(result.enrichment?.nativeReleaseNotImplied,true);
  assert(result.ciiText.length>100000,name+': missing CII');
  const syntax=await independentlyCheckCii(result.ciiText),digest=hash(result.ciiText);
  if(baseline!==null)assert.equal(digest,baseline,
    name+': optional format changed source-only native output');
  else baseline=digest;
  record.stages.issue376BrowserNative[name]={
   sourceSha256:hash(source),ciiSha256:digest,
   ciiBytes:Buffer.byteLength(result.ciiText),elapsedMs:Date.now()-start,
   optionalEnrichment:result.enrichment,releaseAuthorized:false,...syntax,
  };
  record.passes.push('issue 376 '+name+' real browser Worker CII and syntax passed');
  console.log('XML229_ISSUE376_REAL_BROWSER_NATIVE',JSON.stringify({
   name,...record.stages.issue376BrowserNative[name]}));
 }
}
