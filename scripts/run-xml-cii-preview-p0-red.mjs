import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.XML_CII_RED_BASE_URL || 'http://127.0.0.1:4173';
const results={schema:'PREVIEW_P0_RED_RUN_V1',sourceHead:process.env.PREVIEW_EXACT_HEAD||process.env.GITHUB_SHA||'local',
  caveat:'Uses real repository XML + synthetic master scale; not private owner inputs',
  cases:[],hotFunctions:[]};
const browser=await chromium.launch({headless:true});
try {
  for(const mode of ['reject','scale']){
    const page=await browser.newPage();
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');
    let profilerStarted=false;
    let result;
    const began=Date.now();
    try{
      await page.goto(`${base}/tests/browser/xml-cii-preview-p0-red.html?case=${mode}`,
        {waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>globalThis.__PREVIEW_P0_READY__===true,null,{timeout:15000});
      await cdp.send('Profiler.start');profilerStarted=true;
      await page.evaluate(()=>globalThis.__PREVIEW_P0_TRIGGER__());
      await page.waitForFunction(()=>Boolean(globalThis.__PREVIEW_P0_RED_RESULT__),
        null,{timeout:mode==='scale'?120000:15000});
      result=await page.evaluate(()=>globalThis.__PREVIEW_P0_RED_RESULT__);
    }catch(error){
      result={mode,status:'BROWSER_OR_HARNESS_TIMEOUT',error:String(error),
        caveat:'A timeout is failure evidence, not completed Preview'};
    }
    const profile=profilerStarted?await cdp.send('Profiler.stop').catch(()=>({profile:null})):{profile:null};
    const profiles=profile.profile;
    if(profiles){
      const frames=new Map((profiles.nodes||[]).map(n=>[n.id,n.callFrame]));
      const counts=new Map();
      for(const id of profiles.samples||[]){
        const f=frames.get(id);if(!f)continue;
        const key=`${f.functionName||'(anonymous)'} @ ${f.url?.split('/').pop()||'?'}:${f.lineNumber+1}`;
        counts.set(key,(counts.get(key)||0)+1);
      }
      results.hotFunctions.push({mode,sampleCount:profiles.samples?.length||0,
        topSelfSamples:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,18)
          .map(([frame,samples])=>({frame,samples}))});
    }
    results.cases.push({...result,pageErrors,runnerElapsedMs:Date.now()-began});
    await page.close();
  }
}finally{await browser.close()}
const rejection=results.cases.find(x=>x.mode==='reject');
const scale=results.cases.find(x=>x.mode==='scale');
results.redStagedRejectionReproduced=Boolean(rejection?.status==='SPINNER_STUCK'
  && rejection.events?.some(x=>x.message?.includes('P0_STAGED_SOURCE_REJECTED_SENTINEL')));
results.ownerScaleSyntheticCompleted=Boolean(scale?.status==='COMPLETED' && scale.fullSelectedBranchesPreserved);
results.greenProductClaim=false; // Diagnostic artifacts are never product acceptance.
await mkdir('ValidationRecords',{recursive:true});
await writeFile('ValidationRecords/xml-cii-preview-p0-red.json',JSON.stringify(results,null,2)+'\n');
console.log('PREVIEW_P0_RED_DIAGNOSTIC');
console.log(JSON.stringify(results,null,2));
if(!rejection || !scale || [rejection,scale].some(x=>
  ['HARNESS_OR_PRODUCT_THROW','BROWSER_OR_HARNESS_TIMEOUT'].includes(x.status))){
  process.exitCode=1; // inconclusive diagnostic; never present a setup failure as a successful RED
}
