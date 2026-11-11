import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=createServer(async(req,res)=>{
  const filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const b=await readFile(filename);
    const ext=path.extname(filename).toLowerCase();
    res.writeHead(200,{'content-type':ext==='.html'?'text/html':ext==='.xml'?'application/xml':
      ext==='.mjs'||ext==='.js'?'text/javascript':'application/octet-stream'}).end(b);
  }catch(e){res.writeHead(404).end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/browser/xml-cii-preview-p22b-controller.html`,
   {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__P22B_READY__===true);
 await page.click('#start');
 await page.waitForFunction(()=>Boolean(globalThis.__P22B_RESULT__),null,{timeout:90000});
 const result=await page.evaluate(()=>globalThis.__P22B_RESULT__);
 console.log('PREVIEW_P22B_CHROMIUM_CANCELLATION_EVIDENCE');
 console.log(JSON.stringify({...result,pageErrors:errors},null,2));
 if(!result?.ok||errors.length)process.exitCode=1;
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
