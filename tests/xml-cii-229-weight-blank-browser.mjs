import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=createServer(async(req,res)=>{
  try{
    const p=new URL(req.url,'http://localhost').pathname;
    if(p==='/test.html'){
      res.writeHead(200,{'content-type':'text/html'});
      res.end('<!doctype html><meta charset="utf-8"><title>XML229 Weight UI witness</title><button id="mc-wm-refresh">Build</button><button id="mc-wm-fill-best">Apply suggestion to blank cells</button><button id="mc-wm-length-toggle">Length</button><button id="mc-wm-use-dtxr-rating">Rating</button><div id="mc-wm-hint-panel"></div><span id="mc-wm-status"></span><div id="mc-wm-content"></div>');
      return;
    }
    const file=path.resolve(root,'.'+decodeURIComponent(p));
    if(!file.startsWith(root+path.sep))throw Error('path outside fixture');
    const b=await readFile(file);
    res.writeHead(200,{'content-type':({'.js':'text/javascript','.json':'application/json'})[path.extname(file)]||'application/octet-stream'});
    res.end(b);
  }catch(e){res.writeHead(404);res.end(String(e))}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/test.html');
 const init=await page.evaluate(async()=>{
  const mod=await import('/docs/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js');
  const mk=(key,weight,props={})=>({key,weight,componentType:'RIGID',branchName:key,
    lineKey:'L-1',nodeNumber:'04',componentRefNo:'77',rating:'150',boreMm:50,lengthMm:100,
    candidates:[{selectedWeight:12.5,preferred:true,typeDesc:'TOP'}, {selectedWeight:13,preferred:false,typeDesc:'NEXT'}],
    ...props});
  const issues=[
    mk('blank',null),
    mk('sameStored',null),
    mk('nonblank',null),
    mk('mapped',14.5,{mapped:true}),
    mk('final',null),
    mk('stale',null,{staleMatch1:{reason:'basis-changed'}}),
    mk('alternate',null,{candidates:[{selectedWeight:8,zeroFallback:true},{selectedWeight:15.5,typeDesc:'ALTERNATE'}]}),
  ];
  const state={config:{overrides:{
    rigidWeight:{sameStored:12.5},
    rigidWeightFinal:{final:55.1},
  }}};
  window.__witness=state;
  mod.bindXmlCiiWeightMatchPhase(document.body,{
    xmlFile:new File(['<Plant/>'],'test.xml',{type:'application/xml'}),
    stagedJsonText:'',
    config:state.config,
    resolveConfig:()=>state.config,
    onSaveConfig:cfg=>{state.config=cfg;},
    ensureOverrides:cfg=>(cfg.overrides ||= {}),
    resolveStagedJsonText:async()=>({text:''}),
    weightDatasetRef:{datasetId:'witness',masterFingerprint:'known',datasetRevision:1},
    prepareWeightBasis:async()=>({issues,match1Validation:{stale:{stale:{reason:'basis-changed'}},staleCount:1},effectiveRigidWeight:{}}),
    rankWeightIssues:async rows=>({datasetId:'witness',issues:rows}),
  });
  document.querySelector('#mc-wm-refresh').click();
  return {button:document.querySelector('#mc-wm-fill-best').textContent};
 });
 assert.equal(init.button,'Apply suggestion to blank cells');
 await page.waitForFunction(()=>document.querySelectorAll('.mc-rigid-review-input').length===7,{timeout:10000});
 const before=await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('.mc-rigid-review-input')];
  rows[2].value='4.2'; // typed but not yet saved: still never overwrite.
  return rows.map(r=>r.value);
 });
 assert.deepEqual(before,['','','4.2','14.5','','','']);
 await page.locator('#mc-wm-fill-best').click();
 const after=await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('.mc-rigid-review-input')];
  const overrides=window.__witness.config.overrides;
  return {values:rows.map(r=>r.value),
    accepted:rows.map(r=>r.dataset.wmAccepted),
    saved:Object.fromEntries(Object.entries(overrides.rigidWeight||{})),
    provenance:Object.keys(overrides.rigidWeightProposalMeta||{}),
    status:document.querySelector('#mc-wm-status').textContent};
 });
 assert.deepEqual(after.values,['12.5','','4.2','14.5','','','15.5']);
 assert.equal(after.saved.blank,12.5);
 assert.equal(after.saved.alternate,15.5);
 assert.equal(after.saved.sameStored,12.5);
 assert(!Object.hasOwn(after.saved,'nonblank'));
 assert(!Object.hasOwn(after.saved,'mapped'));
 assert(!Object.hasOwn(after.saved,'final'));
 assert(!Object.hasOwn(after.saved,'stale'));
 assert.deepEqual(after.provenance.sort(),['alternate','blank']);
 assert.match(after.status,/Applied 2/);
 await page.locator('#mc-wm-fill-best').click();
 const twice=await page.evaluate(()=>({saved:window.__witness.config.overrides.rigidWeight,status:document.querySelector('#mc-wm-status').textContent}));
 assert.deepEqual(twice.saved,after.saved,'second click must be idempotent');
 assert.match(twice.status,/Applied 0/);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({schema:'XML229_WEIGHT_BLANK_ONLY_REAL_CHROMIUM_V1',ok:true,button:init.button,before,after,twice,errors},null,2));
}finally{await browser?.close();await new Promise(ok=>server.close(ok))}
