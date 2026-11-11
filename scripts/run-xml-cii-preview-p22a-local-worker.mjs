import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const contentType=(file)=>({'.html':'text/html','.js':'text/javascript',
  '.mjs':'text/javascript','.xml':'application/xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream';
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end('forbidden');return;}
  try{
    const body=await readFile(file);
    res.writeHead(200,{'content-type':contentType(file),'cache-control':'no-store'}).end(body);
  }catch(e){res.writeHead(404).end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
  const href=`http://127.0.0.1:${server.address().port}/tests/browser/xml-cii-preview-p22a-local-worker.html`;
  await page.goto(href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>globalThis.__P22A_WORKER_READY__===true);
  await page.click('#start');
  await page.waitForFunction(()=>Boolean(globalThis.__P22A_WORKER_RESULT__),null,{timeout:90000});
  const result=await page.evaluate(()=>globalThis.__P22A_WORKER_RESULT__);
  const summary={...result,pageErrors:errors};
  console.log('PREVIEW_P22A_CHROMIUM_WORKER_EVIDENCE');
  console.log(JSON.stringify(summary,null,2));
  if(!result?.ok||errors.length)process.exitCode=1;
  // Responsiveness is not set based on arbitrary worker completion alone.
  if(result?.ok && result?.maxHeartbeatGapMs>250){
    console.error('Main-thread heartbeat exceeded 250ms; worker moved computation but not UI responsively.');
    process.exitCode=1;
  }
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
