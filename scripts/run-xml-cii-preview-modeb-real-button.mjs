import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const mode of ['positive','missing-originals','wrong-original']){
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
  await page.goto('http://127.0.0.1:4173/tests/browser/xml-cii-preview-modeb-real-button.html?case='+mode,
   {waitUntil:'domcontentloaded',timeout:30000});
  let result;
  try{
   await page.waitForFunction(()=>Boolean(globalThis.__P3B2B_REAL_BUTTON_RESULT__),
    null,{timeout:120000});
   result=await page.evaluate(()=>globalThis.__P3B2B_REAL_BUTTON_RESULT__);
  }catch(error){
   result={ok:false,mode,error:String(error),html:(await page.locator('#evidence').textContent()).slice(0,1000)};
  }
  results.push({...result,pageErrors:errors});
  await page.close();
 }
}finally{await browser.close();}
console.log('P3_B3B2_REAL_BUTTON',JSON.stringify(results,null,2));
if(results.length!==3||results.some(r=>!r.ok||r.pageErrors.length))process.exitCode=1;
