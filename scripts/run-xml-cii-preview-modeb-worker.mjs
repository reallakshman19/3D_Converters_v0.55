import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
let output;
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
 await page.goto('http://127.0.0.1:4173/tests/browser/xml-cii-preview-modeb-worker.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 try {
   await page.waitForFunction(()=>Boolean(globalThis.__P3B2A_NATIVE_WORKER_RESULT__),
     null,{timeout:120000});
   output=await page.evaluate(()=>globalThis.__P3B2A_NATIVE_WORKER_RESULT__);
 }catch(error){
   output={ok:false,error:String(error),report:await page.locator('#report').textContent()};
 }
 output.pageErrors=errors;
 await page.close();
}finally{await browser.close();}
console.log('P3B2A_NATIVE_WORKER',JSON.stringify(output));
if(!output?.ok||output.pageErrors?.length)process.exitCode=1;
