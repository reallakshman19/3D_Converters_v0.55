import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end('forbidden');return;}
  try{const body=await readFile(file),ext=path.extname(file).toLowerCase();
    res.writeHead(200,{'content-type':ext==='.html'?'text/html':ext==='.xml'?'application/xml':
      ext==='.js'||ext==='.mjs'?'text/javascript':'application/octet-stream'}).end(body);
  }catch(error){res.writeHead(404).end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
 for(const mode of ['reject','scale']){
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(String(error?.stack||error)));
  const url=`http://127.0.0.1:${server.address().port}/tests/browser/xml-cii-preview-p3a-button.html?case=${mode}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>Boolean(globalThis.__P3A_BUTTON_RESULT__),null,{timeout:60000});
  const result=await page.evaluate(()=>globalThis.__P3A_BUTTON_RESULT__);
  const output={...result,pageErrors:errors};
  console.log('PREVIEW_P3A_ACTUAL_BUTTON_EVIDENCE');
  console.log(JSON.stringify(output,null,2));
  if(!result?.ok||errors.length)process.exitCode=1;
  if(result?.ok&&result.maxHeartbeatGapMs>250){
    console.error('Measured UI heartbeat >250ms; no responsive product claim');
    process.exitCode=1;
  }
  await page.close();
 }
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
