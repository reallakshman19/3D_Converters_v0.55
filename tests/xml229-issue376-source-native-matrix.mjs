/** EF05 exact-source Node service -> actual native Python -> independent syntax.
 * Python conversion is real; injected transport is NOT the browser Worker. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {runXmlCii2019WorkflowService} from '../tabs/xml-cii-2019-standalone/xml-cii-workflow-service.js';
import {xmlCiiDryRunPreview} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
const xml=readFileSync(new URL('../Benchmarks/EF-05-PRO.TEST.xml',import.meta.url),'utf8');
const formats=[
 {lineKey:{regex:'(P8810021)'},pipingClass:{regex:'(31441C4)'}},
 {lineKey:{regex:'(P8810021)'},pipingClass:{regex:'(PP)'}},
];
const cases={
 none:{},
 lineList:{linelist:{masterRows:[{lineKey:'P8810021'}]}},
 pipingClass:{pipingClass:{masterRows:[{class:'31441C4'}]}},
 material:{material:{mapRows:[{material:'106'}]}},
 allThree:{linelist:{masterRows:[{lineKey:'P8810021'}]},
   pipingClass:{masterRows:[{class:'31441C4'}]},material:{mapRows:[{material:'106'}]}},
 conflicting:{regexTester:{formats}},
 ratingAbsent:{regexTester:{formats:[{lineKey:{regex:'(P\\d+)'},
   pipingClass:{regex:'(31441C4)'}}]}},
};
function runPython(args){
 const result=spawnSync('python3',args,{encoding:'utf8',timeout:60000,maxBuffer:5000000});
 assert.equal(result.status,0,(result.stderr||result.error?.message||'').slice(-1200));
}
function nativeConverter(job){
 const dir=mkdtempSync(join(tmpdir(),'xml229-issue376-'));
 try{
  const source=join(dir,'source.xml'),cii=join(dir,'result.cii');
  const syntaxFile=join(dir,'syntax.json');
  writeFileSync(source,job.sourceText);
  runPython(['converters/scripts/xml_to_cii2019_runtime_custody.py','--input',source,
   '--output',cii,'--coords-mode','first','--weight-scale','10',
   '--support-config-json',job.supportConfigJson,'--use-restraint-type-based-on-json']);
  runPython(['converters/scripts/cii_syntax_check_2019.py','--input',cii,
   '--output',syntaxFile]);
  const syntax=JSON.parse(readFileSync(syntaxFile,'utf8'));
  assert.equal(syntax.ok,true,JSON.stringify(syntax.errors));
  assert.deepEqual(syntax.errors,[]);
  assert.equal(syntax.metrics.elements,600);
  return {ok:true,ciiText:readFileSync(cii,'utf8'),diagnostics:{}};
 }finally{rmSync(dir,{force:true,recursive:true});}
}
export async function proveNativeOptionalMatrix(){
 assert.equal(sha(xml),'2573883480af904096dea2663c9cf585be2db28dd047785397b4d61edee0a030');
 assert.equal((xml.match(/<Branch>/g)||[]).length,41);
 let reference=null;
 for(const [label,config] of Object.entries(cases)){
  let invoked=0;
  const result=await runXmlCii2019WorkflowService({
   sourceKind:'xml',sourceName:'EF05.xml',sourceText:xml,
   supportConfigJson:JSON.stringify(config),options:{outputMode:'cii-only'},
  },{
   engineRunner:async job=>{
    invoked++;
    assert.equal(job.sourceText,xml,label+': original XML changed');
    assert.equal(job.supportConfigJson,'{}',label+': unapproved mapping leaked');
    return nativeConverter(job);
   },
   runParityEnricher:async()=>{throw Error(label+': optional enrichment unexpectedly mandatory');},
  });
  assert.equal(invoked,1,label+': native engine not reached');
  assert.equal(result.ok,true,label+': '+result.error);
  assert.equal(result.diagnostics.optionalEnrichment?.nativeReleaseNotImplied,true);
  assert(result.ciiText?.length>100000,label+': CII empty');
  if(reference!==null)assert.equal(sha(result.ciiText),reference,label+': drift');
  else reference=sha(result.ciiText);
 }
 return {scenarios:Object.keys(cases).length,sourceSha256:sha(xml),ciiSha256:reference};
}
export function proveDualFormatPreview(){
 installWeightBasisXmlDom(globalThis);
 const result=xmlCiiDryRunPreview(xml,{regexTester:{formats}},'');
 assert.equal(result.branchRows.length,41);
 assert.equal(result.formatPreviewPasses.length,2);
 assert(result.branchRows.some(x=>x.extractionStatus==='AMBIGUOUS'));
 assert.equal(result.formatPreviewPasses[0].branchRows[0].pipingClass,'31441C4');
 assert.equal(result.formatPreviewPasses[1].branchRows[0].pipingClass,'PP');
 assert.equal(result.formatPreviewPasses[0].branchRows[0].rating,'');
 assert.equal(result.formatPreviewPasses[1].branchRows[0].rating,'');
 return true;
}
