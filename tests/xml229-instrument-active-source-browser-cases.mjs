import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');

function fixture(){
 const branch='/ASIM-1836-2"-P8810021-31441C4-PP/B4';
 const nodes=[],children=[];
 for(let i=0;i<14;i++){
  const ref='CONTROL-INST-'+i;
  for(const ep of [1,2])nodes.push('<Node><NodeNumber>'+((i*2+ep)*10)+'</NodeNumber>'+
   '<NodeName>CONTROL-'+i+'-'+ep+'</NodeName><ComponentType>INST</ComponentType>'+
   '<ComponentRefNo>'+ref+'</ComponentRefNo><Endpoint>'+ep+'</Endpoint>'+
   '<Position>'+(i*700+(ep-1)*305)+' 0 0</Position><OutsideDiameter>60.3</OutsideDiameter>'+
   '<WallThickness>3.91</WallThickness><Weight>0</Weight></Node>');
  children.push({name:ref,type:'INST',attributes:{NAME:ref},children:[]});
 }
 const weight=[{Rating:'300',Bore:50,Length:305,'RF/RTJ KG':1.25,TypeDesc:'Controlled instrument'}];
 const config={useRestraintTypeBasedOnJson:false,weight:{masterRows:weight},
  linelist:{masterRows:[{Line:'P8810021'}]},pipingClass:{masterRows:[{Class:'31441C4'}]},
  material:{mapRows:[{Material:'CONTROL'}]},overrides:{rating:{P8810021:'300'},processData:{P8810021:{rating:'300'}}}};
 const masters=Object.fromEntries(['weight','linelist','pipingClass','material'].map(k=>[k,{
  datasetId:'CONTROL-'+k,revision:'v1',rows:k==='material'?config[k].mapRows:config[k].masterRows,
  mapping:k==='weight'?{weight:'RF/RTJ KG'}:{}}]));
 return {xml:'<PipeStressExport><Pipe><Branch><Branchname>'+branch+'</Branchname>'+nodes.join('')+'</Branch></Pipe></PipeStressExport>',
  json:JSON.stringify([{name:branch,type:'BRANCH',bore:'50mm',attributes:{NAME:branch},children}]),
  config,masters,context:{config,lineRows:config.linelist.masterRows,pipingClassRows:config.pipingClass.masterRows,
   materialMapRows:config.material.mapRows,weightMasterRows:weight}};
}

async function prepare(page,url,input){
 // Explicit test transport; the server executes the unchanged native Python
 // runtime and returns its ACTUAL CII and mass diagnostic to the real UI runner.
 await page.route('**/xml-cii-workflow-engine-client.js',route=>route.fulfill({contentType:'text/javascript',body:
  'export async function runXmlCii2019StandaloneEngineJob(job){const r=await fetch("/native-instrument-control",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(job)});return r.json();}'}));
 await page.goto(url+'/test.html');
 await page.evaluate(async input=>{
  window.__I=await import('/tests/xml229-instrument-active-source-page.mjs');
  window.__I.setupInstrumentSourcePage(input);
 },input);
 await page.locator('[data-field="staged-json-file"]').setInputFiles({name:'control.json',mimeType:'application/json',buffer:Buffer.from(input.json)});
 await page.waitForFunction(()=>window.__instrumentActiveRef?.current?.xml229StagedSourceReceipt?.phase==='INDEX_COMMITTED',null,{timeout:60000});
 return page.evaluate(()=>window.__I.prepareOriginalModelReview());
}

async function activate(page,before,input){
 assert.equal(before.count,14);assert.equal(before.blocked,14);
 await page.locator('[data-action="xml229-review-instrument-source"]').click();
 await page.locator('[data-instrument-owner]').first().waitFor();
 const use=page.locator('[data-action="xml229-use-instrument-source"]');
 assert.equal(await use.isDisabled(),true);
 for(const check of await page.locator('[data-instrument-owner]').all())await check.check();
 await use.click();
 try{await page.waitForFunction(()=>window.__instrumentActivationComplete===true,null,{timeout:60000});}
 catch(error){throw Error('Fresh source activation failed: '+await page.locator('#models').innerText()+' '+error);}
 const after=await page.evaluate(()=>window.__I.finalizeRevisedSource());
 assert.equal(after.before.final,0);assert.equal(after.oldWorkerClosed,true);
 assert.equal(after.oldBackupRejected,true);assert.equal(after.proof,false);
 assert.equal(after.advice,0);assert.equal(after.blocked,0);assert.equal(after.count,14);
 assert.notEqual(after.sha,before.sourceSha);assert.notEqual(after.generation,before.generation);
 assert.notEqual(after.basis,before.basis);assert.equal(before.sourceSha,sha(input.xml));
 return after;
}

export async function runXml229InstrumentActiveSourceBrowserCases(browser,url){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  const input=fixture(),before=await prepare(page,url,input),after=await activate(page,before,input);
  const auto=page.waitForEvent('download',{timeout:60000});
  await page.evaluate(()=>window.__I.renderInstrumentNativeRun());
  let downloaded;
  try{downloaded=await auto;}
  catch(error){throw Error('Native CII download did not complete: '+JSON.stringify(await page.evaluate(()=>window.__I.instrumentRunResult()))+' '+error);}
  const cii=await readFile(await downloaded.path(),'utf8');
  const result=await page.evaluate(()=>window.__I.instrumentRunResult());
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.values.length,14);
  assert.deepEqual(result.values,Array(14).fill(1.25));assert.equal(result.sourceSha,after.sha);
  assert.equal(result.output.massConsumptionVerified,true);assert.equal(result.output.strictOneToOneOwnerMatch,true);
  assert.equal(result.output.nativeCiiReleaseAuthorized,true);assert.equal(result.actualCiiSha256,sha(cii));
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-action="download-cii"]')].some(b=>!b.disabled),null,{timeout:20000});
  const manual=page.waitForEvent('download');await page.locator('[data-action="download-cii"]:enabled').first().click();
  assert.equal(await readFile(await (await manual).path(),'utf8'),cii);
  let lateDownloads=0;page.on('download',()=>lateDownloads++);
  await page.evaluate(()=>window.__I.changeInstrumentFinalAfterOutput());
  await page.locator('[data-action="download-cii"]:enabled').first().click();
  await page.waitForFunction(()=>document.querySelector('[data-xml229-artifact-download-status]')?.textContent.includes('Download held:'));
  assert.equal(lateDownloads,0,'changed Final must refuse the old CII, even before a Run repaint');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({schema:'XML229.InstrumentActiveSourceNativeDownloadProof.v1',
   controlledOwners:14,originalBlocked:14,revisedBlocked:0,freshO1Generation:true,freshWorkerBasis:true,
   previousFinalNotMigrated:true,oldBackupRejected:true,newFinalKgEach:1.25,
   realPythonNativeCii:true,independentMassConsumptionVerified:true,autoDownload:true,manualDownload:true,staleFinalDownloadRefused:true,
   ownerEngineeringAcceptance:false}));
 }finally{await page.close();}
}
