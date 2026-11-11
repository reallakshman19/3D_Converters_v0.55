import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as F } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.env.HP_BROWSER_ARTIFACT_DIR ?? path.join(REPO, 'artifacts/hp-piping-class-production-browser'));
const MODE = process.env.HP_BROWSER_MODE ?? 'full';
const TIMEOUT = Number(process.env.HP_BROWSER_TIMEOUT_MS ?? 45000);
const STORAGE = 'format-converters.hpPipingClass.project.v2';
const SAMPLE = 'NPS4_S160_PRESSURE_FATIGUE_REGRESSION';
const MATRIX = [
  'product_id,nominal_size,od_mm,allowable_stress_mpa,nominal_wall_mm,minus_tolerance_pct,internal_allowance_mm,external_allowance_mm,fatigue_wall_basis,measured_current_wall_mm,future_internal_loss_mm,future_external_loss_mm',
  'NPS4-S160,NPS 4,114.3,138,13.49,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,',
  'NPS6-XXS,NPS 6,168.3,138,18.26,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,',
].join('\n');
const KD = 'cycle_id,location_id,user_salt_mpa,seq_mpa,permissible_cycles\nC1,BORE_INNER_SURFACE,63.29949581051363,70,10000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function readable(p) { try { await access(p, F.R_OK); return true; } catch { return false; } }

class CDP {
  constructor(ws) { this.ws=ws; this.i=1; this.p=new Map(); this.events=[]; ws.onmessage=(e)=>{ const x=JSON.parse(String(e.data)); if(x.id){const q=this.p.get(x.id); if(!q)return; this.p.delete(x.id); x.error?q.reject(new Error(x.error.message)):q.resolve(x.result??{});} else if(x.method)this.events.push(x); }; }
  static async connect(url){ const ws=new WebSocket(url); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;}); return new CDP(ws); }
  send(method,params={}){ const id=this.i++; return new Promise((resolve,reject)=>{this.p.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));}); }
  async eval(expression){ const x=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true}); if(x.exceptionDetails)throw new Error(x.exceptionDetails.exception?.description??x.exceptionDetails.text); return x.result?.value; }
  close(){this.ws.close();}
}

async function chromium(){
  for(const p of [process.env.HP_BROWSER_CHROMIUM,'/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable'].filter(Boolean)){
    try{await access(p,F.X_OK);return p;}catch{}
  }
  throw new Error('HP_BROWSER_CHROMIUM_NOT_FOUND');
}
async function launch(){
  const exe=await chromium(), dir=await mkdtemp(path.join(os.tmpdir(),'hp-matrix-browser-'));
  const child=spawn(exe,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--window-size=1600,1100','about:blank'],{stdio:['ignore','ignore','pipe']});
  const portFile=path.join(dir,'DevToolsActivePort'), end=Date.now()+TIMEOUT;
  while(Date.now()<end && !(await readable(portFile)))await sleep(50);
  if(!(await readable(portFile)))throw new Error('CHROMIUM_DEVTOOLS_TIMEOUT');
  const [port]=(await readFile(portFile,'utf8')).trim().split(/\r?\n/), targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target=targets.find((x)=>x.type==='page'); if(!target?.webSocketDebuggerUrl)throw new Error('CHROMIUM_PAGE_TARGET_NOT_FOUND');
  const cdp=await CDP.connect(target.webSocketDebuggerUrl); await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  return {exe,dir,child,cdp};
}
async function close(b){try{b.cdp.close();}catch{} try{b.child.kill('SIGTERM');}catch{} await sleep(100); try{b.child.kill('SIGKILL');}catch{} await rm(b.dir,{recursive:true,force:true});}
async function wait(cdp,expr){const end=Date.now()+TIMEOUT;while(Date.now()<end){try{if(await cdp.eval(`Boolean(${expr})`))return;}catch{}await sleep(80);}throw new Error(`WAIT_TIMEOUT ${expr}`);}
async function click(cdp,s){await wait(cdp,`document.querySelector(${JSON.stringify(s)})`);await cdp.eval(`document.querySelector(${JSON.stringify(s)}).click()`);}
async function set(cdp,s,v,event='input'){await wait(cdp,`document.querySelector(${JSON.stringify(s)})`);await cdp.eval(`(()=>{const e=document.querySelector(${JSON.stringify(s)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);}
async function text(cdp,s='body'){return cdp.eval(`document.querySelector(${JSON.stringify(s)})?.innerText??''`);}
async function shot(cdp,name){const {data}=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(OUT,name),Buffer.from(data,'base64'));return name;}
function mime(p){return p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.png')?'image/png':'text/javascript';}
async function serve(){const server=http.createServer(async(req,res)=>{try{let n=decodeURIComponent(new URL(req.url??'/','http://x').pathname);if(n==='/')n='/index.html';const p=path.resolve(REPO,`.${n}`);if(!p.startsWith(`${REPO}${path.sep}`))throw 0;res.writeHead(200,{'content-type':mime(p),'cache-control':'no-store'});res.end(await readFile(p));}catch{res.writeHead(404);res.end('Not found');}});await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});return {server,url:`http://127.0.0.1:${server.address().port}/`};}
function pass(r,id,name,details={}){r.steps.push({id,name,status:'PASS',...details});}

async function sourceGate(){
  const [route,wrapper,input]=await Promise.all([
    readFile(path.join(REPO,'tabs/engineering-workspace-tab.js'),'utf8'),
    readFile(path.join(REPO,'tabs/hp-piping-class-product-bulk-workbench-tab.js'),'utf8'),
    readFile(path.join(REPO,'tabs/hp-piping-class-product-bulk-input.js'),'utf8'),
  ]);
  assert.match(route,/import\('\.\/hp-piping-class-product-bulk-workbench-tab\.js/);
  assert.match(wrapper,/hp-piping-class-kd-bulk-workbench-tab\.js/);
  assert.match(wrapper,/data-hpwb-product-bulk/); assert.match(wrapper,/Apply \+ batch calculate/);
  assert.match(input,/previewHpPipingClassProductBulkInput/); assert.match(input,/applyHpPipingClassProductBulkInput/);
}

async function runFull(receipt){
  if(!(await readable(path.join(REPO,'index.html'))))throw new Error('FULL_APP_MODE_REQUIRES_REPOSITORY_INDEX_HTML');
  await sourceGate(); const {server,url}=await serve(), b=await launch(), {cdp}=b;
  try{
    await cdp.send('Page.navigate',{url}); await wait(cdp,`document.readyState==='complete'||document.readyState==='interactive'`);
    await click(cdp,'[data-tab="engineering-calculations"]'); await click(cdp,'[data-engineering-subtab="hp-piping-class"]'); await wait(cdp,`document.querySelector('[data-hp-piping-class-workbench="true"]')`);
    pass(receipt,'HPM-001','Open real routed HP workbench',{screenshot:await shot(cdp,'matrix-01-workbench.png')});

    await set(cdp,'[data-hpwb-reference-select]',SAMPLE,'change'); await click(cdp,'[data-hpwb-action="load-sample"]'); await wait(cdp,`document.body.innerText.includes('NPS4-S160')`);
    await click(cdp,'[data-hpwb-goto="design"]'); await wait(cdp,`document.querySelector('[data-hpwb-product-bulk]')`);
    await set(cdp,'[data-hpwb-product-bulk]',MATRIX); await click(cdp,'[data-hpwb-product-bulk-action="validate"]'); await wait(cdp,`document.querySelector('[data-hpwb-product-bulk-preview]')?.innerText.includes('Product matrix valid.')`);
    const preview=await text(cdp,'[data-hpwb-product-bulk-preview]'); for(const x of ['NPS4-S160','NPS6-XXS','11.80375','8.80375','15.97750','12.97750'])assert.ok(preview.includes(x),`missing preview ${x}`);
    pass(receipt,'HPM-002','Validate two-product matrix and exact wall arithmetic',{screenshot:await shot(cdp,'matrix-02-preview.png')});

    await click(cdp,'[data-hpwb-product-bulk-action="apply"]'); await wait(cdp,`document.querySelector('[data-hpwb-product-bulk-preview]')?.innerText.includes('Product matrix applied.')`); await wait(cdp,`document.body.innerText.includes('NPS6-XXS')`);
    const project=await cdp.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)}))`);
    assert.deepEqual(project.products.map((x)=>x.productId),['NPS4-S160','NPS6-XXS']); assert.equal(project.classBasis.internalAllowanceMm,3); assert.equal(project.classBasis.externalAllowanceMm,0);
    assert.equal(project.fatigueEvidence.some((x)=>x.productId==='NPS4-S160'),true); assert.equal(project.methodManifest.nativeCoreKd3Qualified,false); assert.equal(project.methodManifest.codeCompliance,false); assert.equal(project.methodManifest.canUseForDesignAuthority,false);
    pass(receipt,'HPM-003','Apply via existing controller and preserve fatigue/authority custody');

    await click(cdp,'[data-hpwb-goto="cycles"]'); const cyc=await text(cdp,'.hpwb-panel'); for(const x of ['LOW','HIGH','C1'])assert.ok(cyc.includes(x));
    await click(cdp,'[data-hpwb-goto="kd"]'); await set(cdp,'[data-hpwb-kd-bulk="0"]',KD); await click(cdp,'[data-hpwb-kd-bulk-action="validate"][data-evidence-index="0"]'); await wait(cdp,`document.body.innerText.includes('Bulk table valid.')`); await click(cdp,'[data-hpwb-kd-bulk-action="apply"][data-evidence-index="0"]');
    pass(receipt,'HPM-004','Preserve C1 and apply governed NPS4 Seq/N');

    await click(cdp,'[data-hpwb-goto="envelope"]'); await wait(cdp,`document.querySelector('[data-hpwb-class-result-matrix="true"]')`); await wait(cdp,`document.querySelector('[data-hpwb-class-result-matrix]')?.innerText.includes('NPS6-XXS')`);
    const env=await text(cdp,'.hpwb-panel'); for(const x of ['NPS4-S160','NPS6-XXS','23.08612','23.11423','1.154306','0.050000','63.299496','NO DESIGN AUTHORITY'])assert.ok(env.includes(x),`missing result ${x}`);
    assert.equal(await cdp.eval(`document.querySelectorAll('.hpwb-class-result-table tbody tr').length`),2);
    pass(receipt,'HPM-005','Verify two-product result matrix including NPS6 P-rating 23.11423 MPa',{screenshot:await shot(cdp,'matrix-05-results.png')});

    await cdp.eval(`(()=>{window.__hpDownloads=[];const o=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){window.__hpDownloads.push(this.download||'');return o.call(this);};})()`);
    await click(cdp,'[data-hpwb-result-action="verify-roundtrip"]'); await wait(cdp,`document.querySelector('[data-hpwb-result-roundtrip-status]')?.innerText.includes('Round trip PASS')`); await click(cdp,'[data-hpwb-result-action="export-csv"]'); await click(cdp,'[data-hpwb-result-action="export-json"]');
    const dl=await cdp.eval('window.__hpDownloads'); assert.ok(dl.some((x)=>x.endsWith('.hp-review-results.csv'))); assert.ok(dl.some((x)=>x.endsWith('.hp-review-results.json')));
    pass(receipt,'HPM-006','Verify parser-backed result round trip and CSV/JSON export',{downloads:dl});

    await click(cdp,'[data-hpwb-goto="design"]'); const wall='[data-hpwb-bind="products.1.calculationBasis.nominalWallMm"]'; await set(cdp,wall,'18.27'); await click(cdp,'[data-hpwb-goto="envelope"]'); await sleep(100); assert.equal(await cdp.eval(`Boolean(document.querySelector('[data-hpwb-production-results]'))`),false);
    await click(cdp,'[data-hpwb-goto="design"]'); await set(cdp,wall,'18.26'); await click(cdp,'[data-hpwb-action="calculate"]'); await click(cdp,'[data-hpwb-goto="envelope"]'); await wait(cdp,`document.querySelector('[data-hpwb-class-result-matrix]')?.innerText.includes('NPS6-XXS')`);
    pass(receipt,'HPM-007','NPS6 edit invalidates stale results and recalculation restores matrix');

    await cdp.eval(`if(!document.querySelector('meta[name=viewport]'))document.head.insertAdjacentHTML('beforeend','<meta name="viewport" content="width=device-width,initial-scale=1">')`); await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});
    const resultLayout=await cdp.eval(`(()=>{const w=document.querySelector('.hpwb-class-result-table')?.closest('.hpwb-table-wrap');return{overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,local:Boolean(w&&w.scrollWidth>w.clientWidth)}})()`); assert.ok(resultLayout.overflow<=2); assert.equal(resultLayout.local,true);
    await click(cdp,'[data-hpwb-goto="design"]'); const productLayout=await cdp.eval(`(()=>{const t=document.querySelector('.hpwb-product-bulk-preview-table'),w=t?.closest('.hpwb-table-wrap');return{overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,local:Boolean(w&&w.scrollWidth>w.clientWidth)}})()`); assert.ok(productLayout.overflow<=2); assert.equal(productLayout.local,true);
    pass(receipt,'HPM-008','375x900 keeps result and product-matrix overflow table-local',{resultLayout,productLayout,screenshot:await shot(cdp,'matrix-08-mobile.png')});

    const exceptions=cdp.events.filter((e)=>e.method==='Runtime.exceptionThrown'); assert.equal(exceptions.length,0,JSON.stringify(exceptions)); receipt.browser={executable:b.exe,runtimeExceptions:0}; receipt.fullActiveWorkbenchNavigation=true; receipt.productMatrixFullAppQualified=true;
  } finally {await close(b);await new Promise((r)=>server.close(r));}
}

async function selfTest(receipt){const b=await launch();try{await b.cdp.eval(`document.body.innerHTML='<button id=b>go</button><div id=o></div>';b.onclick=()=>o.textContent='PASS'`);await click(b.cdp,'#b');assert.equal(await text(b.cdp,'#o'),'PASS');receipt.browser={executable:b.exe,runtimeExceptions:0};pass(receipt,'SELF-001','Chromium CDP companion-runner self-test');}finally{await close(b);}}

async function main(){await mkdir(OUT,{recursive:true});const r={schema:'HpPipingClassProductMatrixBrowserReceipt.v1',status:'RUNNING',requestedMode:MODE,fullActiveWorkbenchNavigation:false,productMatrixFullAppQualified:false,numericalAuthority:'UNCHANGED',authority:{nativeCoreKd3Qualified:false,codeCompliance:false,canUseForDesignAuthority:false},steps:[],startedAt:new Date().toISOString()};try{if(MODE==='self-test')await selfTest(r);else await runFull(r);r.status='PASS';}catch(e){r.status='FAIL';r.failure={message:String(e?.message||e),stack:String(e?.stack||'')};throw e;}finally{r.completedAt=new Date().toISOString();await writeFile(path.join(OUT,'product-matrix-browser-receipt.json'),`${JSON.stringify(r,null,2)}\n`);}console.log(`PASS HP product-matrix browser fullApp=${r.productMatrixFullAppQualified} steps=${r.steps.length}`);}
main().catch((e)=>{console.error(e);process.exitCode=1;});
