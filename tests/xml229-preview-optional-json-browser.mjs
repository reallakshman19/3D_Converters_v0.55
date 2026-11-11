/** Real Preview panel/button + module Workers; synthetic masters test routing, not engineering acceptance. */
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.XML229_PLAYWRIGHT_PATH||'playwright');
const inputs=JSON.parse(await readFile('.local-test-tmp/owner-input-checks/manifest.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
try{
  for(const scenario of [...inputs.map(input=>({input,kind:'absent'})),
    ...['load-during','replace-during','remove-during','stale-selected'].map(kind=>({input:inputs[0],kind}))]){
    const page=await browser.newPage();
    try{
      await page.goto('http://127.0.0.1:8080/tests/');
      const xmlText=(await readFile(scenario.input.path,'utf8')).replace(/^\uFEFF/,'');
      const setup=await page.evaluate(async({xmlText,name,kind})=>{
        localStorage.clear();document.body.innerHTML='<div id="fixture"></div>';
        const {renderStandalonePreviewReportPanel:render}=await import(
          '/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js');
        const {createXmlCiiAdaptedWorkflowState:create}=await import(
          '/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js');
        const rows=(n,make)=>Array.from({length:n},(_,i)=>make(i));
        const config={linelist:{masterRows:rows(385,i=>({line:'TEST-'+i}))},
          pipingClass:{masterRows:rows(10699,i=>({pipingClass:'TEST-'+i,wallThickness:6}))},
          material:{mapRows:rows(383,i=>({material:'TEST-'+i,code:String(i)}))},
          weight:{masterRows:rows(1595,i=>({componentType:'VALV',bore:i+1,weight:4.5}))},overrides:{}};
        const ref={current:{...create(),modeASourceId:name,sourceText:xmlText,sourceFile:new File([xmlText],name),
          supportConfigJson:JSON.stringify(config),masterContext:{
            lineRows:config.linelist.masterRows,pipingClassRows:config.pipingClass.masterRows,
            materialMapRows:config.material.mapRows,weightMasterRows:config.weight.masterRows,
            sourceMetadata:Object.fromEntries(['lineList','pipingClass','materialMap','weight'].map(k=>
              [k,{status:'loaded',source:'Explicit synthetic routing fixture',sourceType:'fixture'}])),
            appliedMappingRevision:{lineList:1,pipingClass:1,materialMap:1,weight:1}}}};
        if(kind==='stale-selected')ref.current={...ref.current,
          stagedJsonFile:new File(['{}'],'selected.json'),xml229StagedSourceStatus:'FAILED'};
        const root=document.querySelector('#fixture');
        await render(root,ref,()=>{});
        const host=root.querySelector('#mc-preview-table-host');
        globalThis.__optionalJson={ref,host};
        if(['replace-during','remove-during'].includes(kind)){
          const {runPreviewButtonSession:run}=await import(
            '/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-button-session.js');
          let reads=0;
          void run({host,rootEl:root,xmlText,config,options:{sourceId:name,
            resolveStagedJsonText:()=>++reads===1?'{}':kind==='remove-during'?'':'{"changed":true}'},
            renderResult:()=>{throw Error('Stale legacy source must not render');}});
          return {hasBuild:false,text:''};
        }
        const button=host.querySelector('[data-mc-preview-build]');
        if(button){button.click();
          if(kind==='load-during')ref.current={...ref.current,
            stagedJsonFile:new File(['{}'],'new.json')};
        }
        return {hasBuild:!!button,text:host.textContent.slice(0,600)};
      },{xmlText,name:scenario.input.name,kind:scenario.kind});
      if(scenario.kind!=='stale-selected')await page.waitForFunction(()=>{
        const {host}=globalThis.__optionalJson;
        return !!host.__xmlCiiPreviewResult?.branchRows?.length||host.textContent.includes('Preview failed');
      },null,{timeout:90000});
      const result=await page.evaluate(()=>{
        const {host}=globalThis.__optionalJson;
        return {branches:host.__xmlCiiPreviewOriginalOccurrences?.branchCount||0,
          nodes:host.__xmlCiiPreviewOriginalOccurrences?.nodeCount||0,
          renderedBranches:host.__xmlCiiPreviewResult?.branchRows?.length||0,
          basisId:host.dataset.mcPreviewBasisId||'',error:host.querySelector('[data-mc-preview-job-state] code')?.textContent||'',
          text:host.textContent.slice(0,500),jsonAuthority:host.dataset.mcPreviewJsonSource||null};
      });
      if(scenario.kind==='load-during')console.log(JSON.stringify({mutationResult:result}));
      if(scenario.kind==='absent'){
        assert.equal(result.branches,scenario.input.branches);
        assert.equal(result.nodes,scenario.input.nodes);
        assert.equal(result.renderedBranches,scenario.input.branches);
        assert.match(result.basisId,/^[a-f0-9]{64}$/);assert.equal(result.jsonAuthority,'XML_ONLY_ENGINEERING_VERIFIED');
        assert.equal(result.error,'');
      }else{
        assert.equal(result.renderedBranches,0);
        if(scenario.kind==='stale-selected')assert.match(setup.text,/ORIGINAL_JSON_SOURCE_FAILED/);
        else if(scenario.kind==='load-during')assert.match(result.text,/Preview failed/);
        else assert.equal(result.error,'STALE_INPUT_BASIS');
      }
      reports.push({file:scenario.input.name,scenario:scenario.kind,ok:true,...result});
    }catch(error){reports.push({file:scenario.input.name,scenario:scenario.kind,ok:false,error:String(error.stack)});}
    finally{await page.close();}
    console.log(JSON.stringify(reports.at(-1)));
  }
}finally{await browser.close();}
await mkdir('output/playwright',{recursive:true});
await writeFile('output/playwright/xml229-preview-optional-json.json',JSON.stringify({
  basis:'REAL_SUPPLIED_XML_REAL_PREVIEW_BUTTON_REAL_WORKERS_SYNTHETIC_MASTERS_385_10699_383_1595',
  engineeringAcceptance:'NOT_ASSESSED',nativeCiiReleaseAuthorized:false,reports},null,2));
if(reports.some(row=>!row.ok))process.exitCode=1;
