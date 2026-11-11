/**
 * TAB3-O1-W06: independently compare ORIGINAL XML and JSON facts to real
 * downloaded Worker CSV rows, and navigate root + generated docs route.
 * No resolver/exporter helpers are imported to manufacture the oracle.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const hash=b=>createHash('sha256').update(b).digest('hex');
const fixtures={xml:'Benchmarks/1885Sjson/FirstpassXML',
  json:'Benchmarks/1885Sjson/Sjson.json'};
const originalXml=await readFile(fixtures.xml);
const originalJson=await readFile(fixtures.json);
assert.equal(hash(originalXml),'feee5a5a6399207337e63bc56c8afb001fe37ab30c6a7a9283333ec60f6eea38');
assert.equal(hash(originalJson),'6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288');
const source=JSON.parse(originalJson.toString('utf8'));
const xml=originalXml.toString('utf8');
const decode=s=>String(s||'').replaceAll('&quot;','"').replaceAll('&apos;',"'")
  .replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
const field=(s,k)=>decode((s.match(new RegExp('<'+k+'>([\\s\\S]*?)</'+k+'>'))||[])[1]||'').trim();
const xmlNodes=[...xml.matchAll(/<Branch>([\s\S]*?)<\/Branch>/g)].flatMap(m=>{
  const branch=field(m[1],'Branchname');
  return [...m[1].matchAll(/<Node>([\s\S]*?)<\/Node>/g)].map(n=>({
    branch,no:field(n[1],'NodeNumber'),type:field(n[1],'ComponentType'),
    ref:field(n[1],'ComponentRefNo'),pos:field(n[1],'Position')
  }));
});
assert.equal(xmlNodes.length,216,'independent original XML node-count witness');
function readCsv(buf){
 const text=buf.toString('utf8').replace(/^\uFEFF/,'');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}
   else if(c==='"')quoted=false;
   else cell+=c;
  }else if(c==='"')quoted=true;
  else if(c===','){row.push(cell);cell='';}
  else if(c==='\n'){row.push(cell.replace(/\r$/,''));if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 assert.equal(quoted,false,'CSV quote must close');
 const headers=rows.shift();
 assert.ok(headers?.length>2);
 return rows.map(cells=>{
  assert.equal(cells.length,headers.length,'all complete CSV columns retained');
  return Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));
 });
}
function atOriginalPath(path){
 const m=/^\$\[(\d+)\]((?:\.children\[\d+\])*)$/.exec(path);
 assert.ok(m,'source path must describe original array child object: '+path);
 let v=source[Number(m[1])];
 assert.ok(v,'existing original root element');
 for(const child of m[2].matchAll(/\.children\[(\d+)\]/g)){
  v=v.children?.[Number(child[1])];
  assert.ok(v,'original child occurrence must exist: '+path);
 }
 return {node:v,root:source[Number(m[1])]};
}
const format=n=>String(Math.round(Number(n)*1000)/1000);
const point=p=>'E='+format(p.x)+' N='+format(p.y)+' EL='+format(p.z);
const witnesses=[
 '$[0].children[1]','$[0].children[2]','$[0].children[4]',
 '$[0].children[5]','$[0].children[6]','$[0].children[7]',
 '$[0].children[8]'
];
const evidenceRows=new Map();
const record={schema:'LFJ226.O1.W06.IndependentSemantic.v1',
  head:process.env.GITHUB_SHA||null,
  original:{xmlSha256:hash(originalXml),jsonSha256:hash(originalJson),
    xmlNodes:xmlNodes.length,jsonRoots:source.length},
  semantics:[],routes:[],negatives:[],pass:false};
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({acceptDownloads:true});
 page.on('pageerror',err=>(record.pageErrors??=[]).push(String(err)));
 await page.goto('http://127.0.0.1:4173/tests/browser/lfj-226-o1-intake.html',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__lfj226Mounted===true);
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles(fixtures.xml);
 await page.locator('[data-phase="json-trace"]').click();
 await page.locator('[data-lfj-o1-enable]').check();
 await page.locator('[data-field="staged-json-file"]').setInputFiles(fixtures.json);
 await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')
  ?.textContent?.startsWith('LFJ source index COMMITTED'),null,{timeout:90000});
 record.sourceReceipt=await page.locator('[data-lfj-o1-status]').textContent();
 assert.ok(record.sourceReceipt.includes(record.original.jsonSha256.slice(0,12)));
 await page.locator('[data-action="build-resolver-index"]').click();
 await page.waitForFunction(()=>{
  const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
  return s.startsWith('O1 matched trace source-path verified')||
    s.startsWith('O1 domain blocked')||s.startsWith('O1 Worker FAILED');
 },null,{timeout:120000});
 record.domainReceipt=await page.locator('[data-lfj-o1-status]').textContent();
 assert.ok(record.domainReceipt.startsWith('O1 matched trace source-path verified'));
 const out={};
 for(const type of ['node','evidence']){
  const [dl]=await Promise.all([
   page.waitForEvent('download',{timeout:60000}),
   page.locator('[data-lfj-o1-action="export-'+type+'"]').click()
  ]);
  const b=await readFile(await dl.path());
  out[type]=readCsv(b);
  record[type+'Export']={bytes:b.length,sha256:hash(b),rows:out[type].length};
 }
 assert.equal(out.node.length,xmlNodes.length);
 for(let i=0;i<xmlNodes.length;i++){
  const n=xmlNodes[i],r=out.node[i];
  assert.equal(r['XML Node'],n.no,'XML number at source row '+i);
  assert.equal(r['XML Branch'],n.branch,'XML branch at source row '+i);
  assert.equal(r.Type,n.type,'XML type at source row '+i);
 }
 record.semantics.push({name:'all-216-node-number-branch-type-from-original-XML',
  rows:xmlNodes.length,pass:true});
 assert.equal(out.evidence.length,241);
 for(const r of out.evidence){
  assert.ok(r['Source Path'],'CSV evidence must retain original source path');
  assert.ok(!evidenceRows.has(r['Source Path']),
   'Original source occurrence must not be duplicated across CSV');
  evidenceRows.set(r['Source Path'],r);
  const s=atOriginalPath(r['Source Path']);
  assert.equal(r['Object Type'],s.node.type,'original JSON object type at '+r['Source Path']);
 }
 record.semantics.push({name:'all-evidence-source-path-exists-and-type-matches',
  rows:out.evidence.length,pass:true});
 for(const path of witnesses){
  const r=evidenceRows.get(path);
  assert.ok(r,'specific original JSON occurrence required '+path);
  const {node,root}=atOriginalPath(path);
  assert.equal(r.Branch,root.name,path+' original JSON branch');
  assert.equal(r.Bore,root.bore,path+' original JSON bore');
  assert.equal(r.NAME,node.attributes?.NAME||node.name,path+' source NAME');
  assert.equal(r.ComponentRefNo,node.attributes?.REF||'',path+' original REF');
  if(node.attributes?.POS)
   assert.equal(r.Position,point(node.attributes.POS),path+' original 3D position');
  record.semantics.push({path,objectType:node.type,name:r.NAME,
    branch:r.Branch,ref:r.ComponentRefNo,position:r.Position,pass:true});
 }
 const joined=out.node.find(r=>r['XML Node']==='50');
 const xmlNode50=xmlNodes.find(n=>n.no==='50');
 const src50=atOriginalPath('$[0].children[2]').node;
 assert.equal(xmlNode50.ref,src50.attributes.REF,
  'independent original XML node 50 and JSON child OLET component identity');
 assert.equal(joined.Type,'OLET');
 assert.equal(joined['XML Branch'],xmlNode50.branch);
 record.semantics.push({name:'XML-node-50-to-original-JSON-component-ref-join',
  xmlNode:50,originalRef:xmlNode50.ref,jsonPath:'$[0].children[2]',pass:true});
 // Proven previously ready source must not be available after malformed replacement.
 await page.locator('[data-field="staged-json-file"]').setInputFiles({
  name:'W06-replaced.json',mimeType:'application/json',buffer:Buffer.from('[{"bad":}')
 });
 await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')
  ?.textContent?.startsWith('LFJ Worker FAILED'),null,{timeout:30000});
 assert.equal(await page.locator('[data-lfj-o1-action^="export-"]').count(),0);
 record.negatives.push({name:'replacement-revokes-both-export-controls',pass:true});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__lfj226Mounted===true);
 assert.equal(await page.locator('[data-lfj-o1-action^="export-"]').count(),0);
 record.negatives.push({name:'fresh-reload-no-old-trace-export',pass:true});
 // Serve actual root and canonical generated docs path with runtime imports
 // rather than assuming builder hash parity implies actual browser loading.
 for(const route of ['index.html','docs/index.html']){
  const response=await page.goto('http://127.0.0.1:4173/'+route,
    {waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200,route+' must serve HTML');
  const isDocs=route.startsWith('docs/');
  const prefix=isDocs?'/docs':'';
  const imports=await page.evaluate(async prefix=>{
   const paths=[
    '/lfj/ports/source-worker-port.mjs',
    '/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-lfj-o1-intake.js',
    '/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-lfj-o1-domain-ui.js'
   ];
   return await Promise.all(paths.map(async p=>{
    const path=prefix+p;
    const res=await fetch(path,{cache:'no-store'});
    if(!res.ok)throw Error('Runtime fetch '+path+': '+res.status);
    await import(path);
    return path;
   }));
  },prefix);
  record.routes.push({path:route,httpStatus:200,liveImports:imports,pass:true});
 }
 record.pass=true;
 console.log('LFJ226_O1_W06_INDEPENDENT_SEMANTIC '+JSON.stringify(record));
}finally{
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-W06-semantic-served.json',
  JSON.stringify(record,null,2)+'\n');
 await browser.close();
 if(!record.pass)process.exitCode=1;
}
