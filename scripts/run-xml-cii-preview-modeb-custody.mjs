import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
let result;
try{
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e?.stack||e)));
 await page.goto('http://127.0.0.1:4173/tests/browser/xml-cii-preview-modeb-custody.html',
  {waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>Boolean(globalThis.__P3B3_BROWSER_RESULT__),null,{timeout:30000});
 result={...await page.evaluate(()=>globalThis.__P3B3_BROWSER_RESULT__),pageErrors:errors};
 await page.close();
}finally{await browser.close();}
console.log('P3_B3_NATIVE_BROWSER',JSON.stringify(result));
if(!result?.ok||result.pageErrors.length)process.exitCode=1;
