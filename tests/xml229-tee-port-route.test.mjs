import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {xml229TeeBranchPortWitnesses}
  from '../tabs/xml-cii-2019-standalone/integration/xml229-tee-port-route.mjs';

// Explicit read-only node test doubles; production DOM is exercised separately.
const node=fields=>({childNodes:Object.entries(fields).map(([localName,textContent])=>
  ({nodeType:1,localName,textContent:String(textContent)}))});
const field=(n,k)=>n.childNodes.find(c=>c.localName===k)?.textContent;
const group=()=>[node({NodeNumber:-1,Endpoint:1,Position:'0 0 0'}),
  node({NodeNumber:-1,Endpoint:3,Position:'64 0 60'}),
  node({NodeNumber:2690,Endpoint:0,Position:'64 0 0'}),
  node({NodeNumber:-1,Endpoint:2,Position:'128 0 0'})].map(n=>({
    childNodes:[...n.childNodes,...node({ComponentType:'TEE',ComponentRefNo:'=T1',Weight:0}).childNodes],
  }));
function set(n,key,value){
  const existing=n.childNodes.find(c=>c.localName===key);
  if(existing)existing.textContent=String(value);
  else n.childNodes.push(...node({[key]:value}).childNodes);
}
function sourceBranches(file='GLRD-1000-PI-01 - BM2.xml'){
  const path=fileURLToPath(new URL('../Benchmarks/XML-CII-2019/revamped/'+file,import.meta.url));
  return JSON.parse(execFileSync('python3',['-c',
    "import xml.etree.ElementTree as E,json,sys; r=E.parse(sys.argv[1]).getroot(); "+
    "print(json.dumps([[{c.tag.split('}')[-1]:(c.text or '').strip() for c in n} "+
    "for n in b if n.tag.split('}')[-1]=='Node'] for b in r.iter() "+
    "if b.tag.split('}')[-1]=='Branch']))",path],{encoding:'utf8'}));
}

test('TEE run keeps1→0→2 and original coordinates; only anonymous branch port3 leaves',()=>{
  const rows=group(),before=rows.map(n=>field(n,'Position'));
  const witnesses=xml229TeeBranchPortWitnesses(rows);
  assert.deepEqual([...witnesses],[rows[1]]);
  assert.deepEqual(rows.filter(n=>!witnesses.has(n)).map(n=>field(n,'Endpoint')),['1','0','2']);
  assert.deepEqual(rows.map(n=>field(n,'Position')),before);
  set(rows[0],'NodeNumber',2680);set(rows[3],'NodeNumber',2700);
  assert.deepEqual([...xml229TeeBranchPortWitnesses(rows)],[rows[1]],'real run ports stay');
});

test('explicit branch nodes, other types, incomplete/ref-conflicting and invalid geometry stay',()=>{
  for(const mutate of [r=>set(r[1],'NodeNumber',2685),
    r=>r.forEach(n=>set(n,'ComponentType','OLET')),
    r=>r.forEach(n=>set(n,'ComponentRefNo','')),
    r=>set(r[1],'ComponentRefNo','=OTHER'),r=>r.pop(),
    r=>r.push(node({ComponentType:'TEE',ComponentRefNo:'=T1'})),
    r=>set(r[2],'NodeNumber',-1),r=>set(r[2],'NodeNumber',1.5),
    r=>set(r[1],'Position','NaN 0 0'),r=>set(r[0],'Position','64 0 0'),
    r=>set(r[3],'Position','64 0 0'),r=>set(r[1],'Endpoint',2)]){
    const rows=group();mutate(rows);
    assert.equal(xml229TeeBranchPortWitnesses(rows).size,0);
  }
});

test('TEE witness with support, named, rigid, mass or SIF authority blocks cleanup',()=>{
  for(const [key,value] of [['Restraint',''],['NodeName','SUPPORT'],['Rigid',2],
    ['Weight',12.5],['Weight',-1],['Weight','invalid'],['SIF',2],['SIF','invalid']]){
    const rows=group();set(rows[1],key,value);
    assert.throws(()=>xml229TeeBranchPortWitnesses(rows),{code:'TEE_BRANCH_PORT_AUTHORITY_CONFLICT'});
  }
});

test('all31 original BM2 TEE branch witnesses excluded; run/source branch occurrences remain',()=>{
  const branches=sourceBranches(),selected=[];
  for(const branch of branches){
    const rows=branch.map(node),witnesses=xml229TeeBranchPortWitnesses(rows);
    for(const n of witnesses){
      const i=rows.indexOf(n);selected.push(n);
      assert.deepEqual(rows.slice(i-1,i+3).filter(r=>!witnesses.has(r))
        .map(r=>field(r,'Endpoint')),['1','0','2']);
    }
    for(const n of rows.filter(r=>field(r,'ComponentType')==='BRAN'))assert(!witnesses.has(n));
  }
  assert.equal(selected.length,31);
  assert(selected.every(n=>field(n,'NodeNumber')==='-1'&&field(n,'Endpoint')==='3'));
  const actualBranch=branches[25].filter(n=>n.NodeNumber==='3120');
  assert.equal(actualBranch.length,1);assert.equal(actualBranch[0].ComponentType,'BRAN');
});

test('independent source run vectors retain zero DY and real−0.32mm slope',()=>{
  const all=sourceBranches().flat();
  for(const [ref,expected] of [['=134234934/28025',[64,0,0]],
    ['=134234934/18024',[64,-0.32,0]]]){
    const rows=all.filter(n=>n.ComponentRefNo===ref);
    const a=rows.find(n=>n.Endpoint==='1').Position.split(/\s+/).map(Number);
    const b=rows.find(n=>n.Endpoint==='0').Position.split(/\s+/).map(Number);
    const d=[b[0]-a[0],b[2]-a[2],a[1]-b[1]];
    d.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-8));
  }
});

test('original PL-BM1 spatial tees qualify; five wholly coincident templates stay unchanged',()=>{
  const branches=sourceBranches('PL-BM1.xml'),selected=[],coincident=[];
  for(const branch of branches){
    const rows=branch.map(node),witnesses=xml229TeeBranchPortWitnesses(rows);
    selected.push(...witnesses);
    for(let i=0;i+3<rows.length;i++){
      const group=rows.slice(i,i+4);
      if(group.map(n=>field(n,'Endpoint')).join(',')!=='1,3,0,2'||
         !group.every(n=>field(n,'ComponentType')==='TEE'))continue;
      if(new Set(group.map(n=>field(n,'Position'))).size===1){
        coincident.push(group);assert(group.every(n=>!witnesses.has(n)));
      }
    }
  }
  assert.deepEqual(selected.map(n=>field(n,'ComponentRefNo')),
    ['=1006649755/1751','=1006657947/1467','=1006649755/11162']);
  assert.equal(coincident.length,5);
});

test('root/docs integration matches and records original TEE occurrence drop reason',()=>{
  for(const path of ['tabs/xml-cii-2019-standalone/integration/xml229-tee-port-route.mjs',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js']){
    assert.equal(readFileSync(new URL('../'+path,import.meta.url),'utf8'),
      readFileSync(new URL('../docs/'+path,import.meta.url),'utf8'));
  }
  const ledger=readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js',import.meta.url),'utf8');
  assert.match(ledger,/teeBranchPorts\.has\(node\)\?'TEE_BRANCH_PORT_WITNESS'/);
});
