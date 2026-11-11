import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=createServer(async(req,res)=>{
  try{
    const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');
    const target=path.resolve(root,relative);
    if(!target.startsWith(root+path.sep))throw Error('Outside repo');
    const contents=await readFile(target);
    const ext=path.extname(target).toLowerCase();
    const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
      '.xml':'application/xml','.json':'application/json'};
    res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream'}).end(contents);
  }catch(e){res.writeHead(404).end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
  const uri=`http://127.0.0.1:${server.address().port}/tests/browser/xml-cii-preview-b2a-worker-rebuild.html`;
  await page.goto(uri,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>Boolean(globalThis.__PREVIEW_B2A_RESULT__),null,{timeout:120000});
  const result=await page.evaluate(()=>globalThis.__PREVIEW_B2A_RESULT__);
  console.log('PREVIEW_B2A_WORKER_REBUILD_CHROMIUM_RESULT');
  console.log(JSON.stringify({...result,pageErrors:errors},null,2));
  if(!result?.ok||errors.length||result.maxHeartbeatGapMs>250)process.exitCode=1;
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
