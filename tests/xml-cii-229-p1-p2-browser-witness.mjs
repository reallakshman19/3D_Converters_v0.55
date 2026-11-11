import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const { chromium } = await import(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const resolved = path.resolve(root, '.' + route);
    if (!resolved.startsWith(root + path.sep)) throw Error('outside root');
    const contents = await readFile(resolved);
    const mime = ({
      '.js': 'text/javascript', '.mjs': 'text/javascript',
      '.html': 'text/html', '.css': 'text/css', '.json': 'application/json',
      '.xml': 'application/xml',
    })[path.extname(resolved)] || 'application/octet-stream';
    response.writeHead(200, {'content-type':mime,'cache-control':'no-store'});
    response.end(contents);
  } catch (error) {
    response.writeHead(404);
    response.end(String(error));
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({headless:true,
    ...(process.env.XML_CII_CHROMIUM_EXECUTABLE ? {executablePath:process.env.XML_CII_CHROMIUM_EXECUTABLE} : {})});
  const page=await browser.newPage();
  const runtimeErrors=[];
  const badResponses=[];
  page.on('pageerror',err=>runtimeErrors.push(String(err)));
  page.on('response',res=>{if(res.status()>=400)badResponses.push({url:res.url(),status:res.status()})});
  const url=`http://127.0.0.1:${server.address().port}/tests/browser/xml-cii-229-p1-p2-browser-witness.html`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>globalThis.__XML229_BROWSER_DONE__===true,null,{timeout:60000});
  const result=await page.evaluate(()=>globalThis.__XML229_BROWSER_RESULT__);
  console.log(JSON.stringify({result,badResponses,runtimeErrors,runButtonDisabled:await page.locator('#run-ui [data-action="run"]').isDisabled()},null,2));
  assert.equal(result?.ok,true,result?.error||'Browser witness not successful');
  assert.deepEqual(runtimeErrors,[]);
  assert.deepEqual(badResponses,[]);
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
