import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {projectXmlCiiOccurrences} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
installWeightBasisXmlDom(globalThis);


// INDEPENDENT raw-XML oracle: 19 source branches and 871 *original* nodes,
// of which 322 have repeated NodeNumber -1. These are synthetic and MUST NOT
// be reported as private PL01/PL06 source replay.
const NODES_PER_BRANCH=Array.from({length:19},(_,i)=>i<16?46:45);
assert.equal(NODES_PER_BRANCH.reduce((sum,x)=>sum+x,0),871);
function xmlPipe(start,end) {
  let negativeLeft = start===0?200:122;
  const branches=[];
  for(let b=start;b<end;b++){
    const nodes=[];
    for(let n=0;n<NODES_PER_BRANCH[b];n++){
      const number=negativeLeft-->0?-1:2000+n;
      nodes.push('<Node><NodeNumber>'+number+'</NodeNumber><ComponentType>PIPE</ComponentType>'
        +'<ComponentRefNo>REF-REPEATED</ComponentRefNo><Endpoint>1</Endpoint></Node>');
    }
    branches.push('<Branch><Branchname>/REPEATED-PER-SOURCE/B1</Branchname>'
      +nodes.join('')+'</Branch>');
  }
  return '<Pipe>'+branches.join('')+'</Pipe>';
}
const one=xmlPipe(0,10),two=xmlPipe(10,19);
const xml=(...pipes)=>'<PipeStressExport>'+pipes.join('')+'</PipeStressExport>';
const originalOne=xml(one),originalTwo=xml(two),combined=xml(one,two);
const manifest={
  schema:'xml-node-offset-combine/v1',sourceCount:2,
  sourceOrder:[{sourceId:'PL01',fileName:'PL-01.xml',pipeCount:1},
    {sourceId:'PL06',fileName:'PL-06.xml',pipeCount:1}],
};
const basis=(overrides={})=>({xmlText:combined,mode:'B',manifest,...overrides});

test('Mode B preserves 19 original Branch and 871 Node occurrences despite duplicate names/-1',()=>{
  const result=projectXmlCiiOccurrences(basis());
  assert.equal(result.branchCount,19);
  assert.equal(result.nodeCount,871);
  assert.equal(result.nodes.filter(n=>n.nodeNumber==='-1').length,322);
  assert.equal(new Set(result.branches.map(b=>b.occurrenceId)).size,19);
  assert.equal(new Set(result.nodes.map(n=>n.occurrenceId)).size,871);
  assert.deepEqual(result.sourceTotals.map(x=>[x.sourceId,x.branchCount]),[['PL01',10],['PL06',9]]);
  assert.deepEqual(result.branches.map(b=>b.branchOccurrenceIndex),Array.from({length:19},(_,i)=>i));
  assert.equal(result.nodes[0].sourceId,'PL01');
  assert.equal(result.nodes.at(-1).sourceId,'PL06');
});
test('Mode A multi-source is independent; combined names and NodeNumbers never alias',()=>{
  const a=projectXmlCiiOccurrences({xmlText:originalOne,sourceId:'PL01'});
  const b=projectXmlCiiOccurrences({xmlText:originalTwo,sourceId:'PL06'});
  assert.deepEqual([a.branchCount,b.branchCount],[10,9]);
  assert.equal(a.nodeCount+b.nodeCount,871);
  assert.notEqual(a.nodes[0].occurrenceId,b.nodes[0].occurrenceId);
  assert.deepEqual(a.branches.map(x=>x.branchOrdinal),Array.from({length:10},(_,i)=>i));
  assert.deepEqual(b.branches.map(x=>x.branchOrdinal),Array.from({length:9},(_,i)=>i));
});
test('selection is source+source-local branch ordinal, never branch name',()=>{
  const r=projectXmlCiiOccurrences(basis({selection:[
    {sourceId:'PL01',branchOrdinal:3},{sourceId:'PL06',branchOrdinal:3},
  ]}));
  assert.equal(r.branchCount,2);
  assert.equal(r.nodeCount,NODES_PER_BRANCH[3]+NODES_PER_BRANCH[13]);
  assert.equal(r.branches[0].branchName,r.branches[1].branchName);
  assert.notEqual(r.branches[0].occurrenceId,r.branches[1].occurrenceId);
  assert.deepEqual(r.branches.map(b=>b.branchOccurrenceIndex),[3,13]);
});
test('missing/incorrect Mode B manifest and cross-source selection fail closed',()=>{
  assert.throws(()=>projectXmlCiiOccurrences(basis({manifest:null})),{code:'MODE_B_MANIFEST_REQUIRED'});
  assert.throws(()=>projectXmlCiiOccurrences(basis({manifest:{...manifest,sourceOrder:[
    {...manifest.sourceOrder[0],pipeCount:2},manifest.sourceOrder[1],
  ]}})),{code:'PIPE_CUSTODY_MISMATCH'});
  assert.throws(()=>projectXmlCiiOccurrences(basis({manifest:{...manifest,sourceOrder:[
    manifest.sourceOrder[0],{...manifest.sourceOrder[1],sourceId:'PL01'},
  ]}})),{code:'DUPLICATE_SOURCE_ID'});
  assert.throws(()=>projectXmlCiiOccurrences(basis({selection:[
    {sourceId:'PL06',branchOrdinal:10},
  ]})),{code:'SELECTION_OCCURRENCE_MISSING'});
  assert.throws(()=>projectXmlCiiOccurrences(basis({selection:[
    {sourceId:'PL01',branchOrdinal:1},{sourceId:'PL01',branchOrdinal:1},
  ]})),{code:'DUPLICATE_SELECTION'});
});
test('unparseable NodeNumber and malformed XML are classified errors',()=>{
  assert.throws(()=>projectXmlCiiOccurrences(basis({xmlText:combined.replace('<NodeNumber>-1</NodeNumber>','<NodeNumber>abc</NodeNumber>')})),
    {code:'INVALID_NODE_NUMBER'});
  assert.throws(()=>projectXmlCiiOccurrences({mode:'A',sourceId:'A',xmlText:'<Wrong />'}),{code:'INVALID_XML_ROOT'});
});
test('published projection is immutable, free of DOM references and stable across replay',()=>{
  const a=projectXmlCiiOccurrences(basis()),b=projectXmlCiiOccurrences(basis());
  assert.deepEqual(a,b);
  assert.equal(JSON.stringify(a).includes('PipeStressExport'),false);
  assert.ok(Object.isFrozen(a.branches[0].provenance[0]));
  assert.throws(()=>a.nodes.push({}),TypeError);
});
test('deployed source adapter is byte identical',async()=>{
  const from='xml-cii-adapted-preview-facts-xml-source.js';
  const source=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+from,import.meta.url),'utf8');
  const docs=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+from,import.meta.url),'utf8');
  assert.equal(source,docs);
});

test('checked-in public source: independent XML census equals projected full population',async()=>{
  const xmlText=await readFile(new URL('../Benchmarks/XML-CII-2019/SYS-001_Single.xml',import.meta.url),'utf8');
  const parsed=new DOMParser().parseFromString(xmlText,'application/xml');
  const expectedBranches=parsed.getElementsByTagName('Branch').length;
  const expectedNodes=parsed.getElementsByTagName('Node').length;
  const projected=projectXmlCiiOccurrences({xmlText,mode:'A',sourceId:'SYS001-public'});
  assert.ok(expectedBranches>0);
  assert.equal(projected.branchCount,expectedBranches);
  assert.equal(projected.nodeCount,expectedNodes);
  assert.equal(new Set(projected.nodes.map(n=>n.occurrenceId)).size,expectedNodes);
});
