/** Read-only supplied-input checks. Synthetic kg exercise custody, never Owner acceptance. */
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.XML229_PLAYWRIGHT_PATH||'playwright');
const manifest=JSON.parse(await readFile('.local-test-tmp/owner-input-checks/manifest.json','utf8'))
 .filter(row=>!process.env.XML229_INPUT_FILTER||row.name===process.env.XML229_INPUT_FILTER);
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
try{
 for(const input of manifest){
  const page=await browser.newPage();let deadline;
  try{
   await page.goto('http://127.0.0.1:8080/');
   const sourceText=(await readFile(input.path,'utf8')).replace(/^\uFEFF/,'');
   console.log(JSON.stringify({file:input.name,status:'STARTED'}));
   const result=await Promise.race([page.evaluate(async({sourceText,name})=>{
    const {runXmlCii2019StandaloneEngineJob:run}=await import('/tabs/xml-cii-2019-standalone/xml-cii-workflow-engine-client.js');
    const {createPreviewBasis}=await import('/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js');
    const {projectXmlCiiOccurrences}=await import('/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js');
    const {xmlCiiDryRunPreview}=await import('/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js');
    const {openXml229EngineeringFactModel}=await import('/tabs/xml-cii-2019-standalone/integration/xml229-preview-engineering-fact-producer.mjs');
    const {reconcileXml229ActualCiiAgainstFinal}=await import('/converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs');
    const {diagnoseXml229NativeConverterFailure}=await import('/tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs');
    const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
    const job={sourceKind:'xml',sourceName:name,sourceText,stagedJsonText:'',supportConfigJson:'{}',
     options:{outputMode:'cii-only',splitCondensedValveFlange:false}};
    const plainStart=performance.now(),plain=await run(job);
    const report={xmlOnly:{ok:plain.ok,durationMs:performance.now()-plainStart,
     ciiBytes:plain.ciiText?new TextEncoder().encode(plain.ciiText).length:0,
     ...(plain.ok?{}:{phase:plain.nativeFailurePhase,error:String(plain.error).slice(0,240)})}};
    const sourceId='OWNER-INPUT-CHECK',masters={},config={},overrides={},selection=[{sourceId,selectionRef:'all'}];
    const start=performance.now();
    const basis=await createPreviewBasis({domainId:'xml-cii/2019',sources:[{sourceId,mediaType:'application/xml',text:sourceText}],
     masters,selection,stagedSource:null,config,overrides,sha256:digest});
    const projection=projectXmlCiiOccurrences({xmlText:sourceText,sourceId});
    const preview=xmlCiiDryRunPreview(sourceText,config,'');
    const opened=await openXml229EngineeringFactModel({basis,
     live:{sources:{[sourceId]:sourceText},masters,selection,stagedSource:null,config,overrides},
     xmlText:sourceText,sourceId,previewResult:{...preview,sourceOccurrences:projection,
      engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
     expectedOriginalCount:projection.branchCount+projection.nodeCount});
    const packet={schema:'XML229.NativeFinalPhysicalPacket.v1',sourceId,basisId:basis.basisId,
     originalJsonSha256:await digest(''),sourceGenerationId:'SYNTHETIC-TEST-MASSES',
     sourceXmlSha256:await digest(sourceText),finalIntentSha256:'b'.repeat(64),
     physicalCount:opened.physicalOccurrences.length,finalizedGeometry:opened.finalizedGeometry,
     components:opened.physicalOccurrences.map(o=>({occurrenceId:o.occurrenceId,effectiveKg:4.5})),
     nativeCiiReleaseAuthorized:false};
    const preparedMs=performance.now()-start,phases=[],nativeStart=performance.now();
    const native=await run({...job,xml229NativeFinalPacket:packet},
     {onProgress:phase=>phases.push({phase,elapsedMs:performance.now()-nativeStart})});
    report.governedNative={ok:native.ok,preparedMs,durationMs:performance.now()-nativeStart,
     physicalCount:packet.physicalCount,phases};
    if(!native.ok){
     const diagnosis=diagnoseXml229NativeConverterFailure(native);
     Object.assign(report.governedNative,{code:diagnosis.code,phase:diagnosis.phase,
      nativePhase:native.nativePythonFailure?.stage||native.nativeFailurePhase,
      detail:String(native.error).slice(0,300)});
     const doc=new DOMParser().parseFromString(packet.finalizedGeometry.xmlText,'application/xml');
     const local=n=>n.localName||n.nodeName;
     const field=(n,k)=>[...n.children].find(c=>local(c)===k)?.textContent?.trim()||'';
     const branches=[...doc.getElementsByTagName('*')].filter(n=>local(n)==='Branch');
     // Read-only snapshot metadata, not a substitute native ownership oracle.
     report.governedNative.unclassifiedOwnerReadback=packet.components.flatMap(row=>{
      const id=JSON.parse(row.occurrenceId),bi=id[1],ordinal=id[2];
      const index=packet.finalizedGeometry.retainedSourceOrdinalsByBranch[bi].indexOf(ordinal);
      const nodes=[...branches[bi].children].filter(n=>local(n)==='Node'),node=nodes[index];
      if(!node||field(node,'Rigid')==='2')return [];
      return [{branchOrdinal:bi+1,sourceNodeOrdinal:ordinal+1,
       type:field(node,'ComponentType'),ref:field(node,'ComponentRefNo'),
       endpoint:field(node,'Endpoint'),position:field(node,'Position'),
       previousType:index?field(nodes[index-1],'ComponentType'):null,
       previousRigid:index?field(nodes[index-1],'Rigid'):null}];
     }).slice(0,20);
    }else{
     try{const check=await reconcileXml229ActualCiiAgainstFinal({originalXmlText:sourceText,packet,
       ciiText:native.ciiText,writerDiagnostic:native.xml229NativeMassDiagnostic});
      Object.assign(report.governedNative,{massVerified:check.massConsumptionVerified,
       ownerCount:check.physicalCount,ciiBytes:new TextEncoder().encode(native.ciiText).length});
     }catch(error){Object.assign(report.governedNative,{ok:false,code:error.code||error.message,phase:'INDEPENDENT_RECONCILIATION'});}
    }
    return report;
   },{sourceText,name:input.name}),new Promise((_,reject)=>{
    deadline=setTimeout(()=>reject(Error('INPUT_CHECK_180S_DEADLINE')),180000);
   })]);
   reports.push({file:input.name,sourceSha256:input.sha256,...result});
   console.log(JSON.stringify(reports.at(-1)));
  }catch(error){reports.push({file:input.name,ok:false,error:error.message});console.log(JSON.stringify(reports.at(-1)));}
  finally{clearTimeout(deadline);await page.close();}
  await mkdir('output/playwright',{recursive:true});
  await writeFile('output/playwright/'+(process.env.XML229_INPUT_FILTER?'xml229-owner-input-detail.json':'xml229-owner-input-checks.json'),JSON.stringify({
   basis:'SUPPLIED_XML_BYTES_REAL_CHROME_SYNTHETIC_4_5_KG_NO_LOADED_JSON_OR_MASTERS',
   nativeCiiReleaseAuthorized:false,reports},null,2));
 }
}finally{await browser.close();}
