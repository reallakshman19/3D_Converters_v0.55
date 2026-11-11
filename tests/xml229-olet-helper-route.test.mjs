import test from 'node:test';
import './xml229-tee-port-route.test.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {xml229OletRouteHelpers}
  from '../tabs/xml-cii-2019-standalone/integration/xml229-olet-helper-route.mjs';

// Explicit read-only node test doubles, not a replacement XML parser/DOM.
const node=fields=>({childNodes:Object.entries(fields).map(([localName,textContent])=>
  ({nodeType:1,localName,textContent:String(textContent)}))});
const field=(n,k)=>n.childNodes.find(c=>c.localName===k)?.textContent;
const group=()=>[node({NodeNumber:-1,Endpoint:1,Position:'0 0 0'}),
  node({NodeNumber:-1,Endpoint:3,Position:'0 0 122.25'}),
  node({NodeNumber:300,Endpoint:0,Position:'0 0 0'}),
  node({NodeNumber:-1,Endpoint:2,Position:'0 0 0'})].map(n=>({
    childNodes:[...n.childNodes,...node({ComponentType:'OLET',ComponentRefNo:'=F1',Weight:0}).childNodes],
  }));
function set(n,key,value){
  const existing=n.childNodes.find(c=>c.localName===key);
  if(existing)existing.textContent=String(value);
  else n.childNodes.push(...node({[key]:value}).childNodes);
}

test('only anonymous witnessed OLET helpers leave the route; positive junction stays',()=>{
  const rows=group(),helpers=xml229OletRouteHelpers(rows);
  assert.deepEqual([...helpers],[rows[0],rows[1],rows[3]]);
  assert(!helpers.has(rows[2]));
  set(rows[0],'NodeNumber',290);
  assert.deepEqual([...xml229OletRouteHelpers(rows)],[rows[1],rows[3]],
    'positive endpoint identities are retained');
});

test('real positive ports, distinct run coordinates, missing refs and malformed groups survive',()=>{
  for(const mutate of [r=>set(r[1],'NodeNumber',310),
    r=>set(r[0],'Position','10 0 0'),r=>set(r[3],'Position','0 20 0'),
    r=>set(r[2],'NodeNumber',-1),r=>set(r[1],'Position','NaN 0 0'),
    r=>r.forEach(n=>set(n,'ComponentRefNo','')),
    r=>set(r[1],'ComponentRefNo','=OTHER'),r=>r.pop(),
    r=>r.forEach(n=>set(n,'ComponentType','TEE'))]){
    const rows=group();mutate(rows);
    assert.equal(xml229OletRouteHelpers(rows).size,0);
  }
});

test('restraint, named, rigid and mass authority cannot be silently removed',()=>{
  for(const [key,value] of [['Restraint',''],['NodeName','SUPPORT'],
    ['Rigid',2],['Weight',12.5],['Weight',-1],['Weight','invalid']]){
    const rows=group();set(rows[1],key,value);
    assert.throws(()=>xml229OletRouteHelpers(rows),{code:'OLET_HELPER_AUTHORITY_CONFLICT'});
  }
});

test('source BM2 independently parsed:147 helper records,49 retained junctions',()=>{
  const path=fileURLToPath(new URL('../Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml',import.meta.url));
  // ElementTree parses original XML; expected source identities are the oracle.
  const parsed=JSON.parse(execFileSync('python3',['-c',
    "import xml.etree.ElementTree as E,json,sys; r=E.parse(sys.argv[1]).getroot(); "+
    "print(json.dumps([[{c.tag.split('}')[-1]:(c.text or '').strip() for c in n} "+
    "for n in b if n.tag.split('}')[-1]=='Node'] for b in r.iter() "+
    "if b.tag.split('}')[-1]=='Branch']))",path],{encoding:'utf8'}));
  const selected=parsed.flatMap(branch=>{
    const rows=branch.map(node);return [...xml229OletRouteHelpers(rows)];
  });
  assert.equal(selected.length,147);
  for(const ref of ['=134234934/29482','=134234934/29481','=134234934/28795']){
    assert.deepEqual(selected.filter(n=>field(n,'ComponentRefNo')===ref)
      .map(n=>field(n,'Endpoint')),['1','3','2']);
  }
  assert(selected.every(n=>field(n,'NodeNumber')==='-1'));
  assert.equal(parsed.flat().filter(n=>n.ComponentType==='OLET'&&n.Endpoint==='0'&&
    Number(n.NodeNumber)>0).length,49);
});

test('shared Preview/Worker cleanup excludes helpers before positive ID allocation; mirrors match',()=>{
  const path='tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js';
  const root=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(root,/xml229OletRouteHelpers\(branchNodes\)/);
  assert.match(root,/oletHelpers\.has\(node\)\?'OLET_GEOMETRY_HELPER'/);
  for(const file of [path,'tabs/xml-cii-2019-standalone/integration/xml229-olet-helper-route.mjs']){
    assert.equal(readFileSync(new URL('../'+file,import.meta.url),'utf8'),
      readFileSync(new URL('../docs/'+file,import.meta.url),'utf8'));
  }
});
