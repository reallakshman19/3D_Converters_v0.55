import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage(),errors=[],failedRequests=[],messages=[];
  page.on('pageerror',error=>errors.push(String(error?.stack||error)));
  page.on('console',message=>{
    if(message.type()==='error') messages.push(message.text());
  });
  page.on('requestfailed',request=>failedRequests.push({
    url:request.url(),error:request.failure()?.errorText||''}));
  page.on('response',response=>{
    if(response.status()>=400)messages.push('HTTP '+response.status()+' '+response.url());
  });
  const url='http://127.0.0.1:4173/tests/browser/xml-cii-preview-v7-observer-feedback.html';
  await page.goto(url,{timeout:45000});
  let waitError='';
  try {
    await page.waitForFunction(()=>Boolean(globalThis.__PREVIEW_V7_OBSERVER_RESULT__),null,{timeout:15000});
  } catch(error) {
    waitError=String(error?.message||error);
  }
  const result=await page.evaluate(()=>globalThis.__PREVIEW_V7_OBSERVER_RESULT__||null);
  const diagnostic={...result,waitError,pageErrors:errors,consoleErrors:messages,
    failedRequests,fixture:await page.locator('#evidence').textContent()};
  console.log('PREVIEW_V7_OBSERVER_FEEDBACK',JSON.stringify(diagnostic,null,2));
  if(!result?.ok||errors.length||messages.length||failedRequests.length||waitError)
    process.exitCode=1;
} finally {
  await browser.close();
}
