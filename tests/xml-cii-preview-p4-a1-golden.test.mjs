import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {projectXmlCiiOccurrences} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {originalSources,golden,combinedSourceText,modeBManifest} from
  './fixtures/xml-cii-preview-p4-a1/oracle.mjs';

installWeightBasisXmlDom(globalThis);
const sha256=s=>createHash('sha256').update(s,'utf8').digest('hex');
const children=(el,tag)=>[...(el?.childNodes||[])].filter(x=>x.nodeType===1&&x.localName===tag);
const field=(el,key)=>children(el,key)[0]?.textContent?.trim()||'';
function directRawCensus(sources) {
  // Independent raw-original traversal: no Preview basis, XML-CII occurrence
  // projection, run writer or worker result is consulted to form expectations.
  const branches=[], sourceOrder=[];
  for(const source of sources) {
    const document=new DOMParser().parseFromString(source.xmlText,'application/xml');
    assert.equal(document.documentElement.localName,'PipeStressExport');
    const pipes=children(document.documentElement,'Pipe');
    assert.equal(pipes.length,1,'one explicitly authored original Pipe per source');
    let ordinal=0,nodeCount=0;
    for(const pipe of pipes)for(const branch of children(pipe,'Branch')) {
      const nodes=children(branch,'Node').map((node,nodeOrdinal)=>({
        nodeOrdinal,nodeNumber:field(node,'NodeNumber'),componentType:field(node,'ComponentType'),
        componentRefNo:field(node,'ComponentRefNo'),endpoint:field(node,'Endpoint'),
      }));
      nodeCount+=nodes.length;
      branches.push({sourceId:source.sourceId,branchOrdinal:ordinal++,
        branchName:field(branch,'Branchname'),nodes});
    }
    sourceOrder.push({sourceId:source.sourceId,fileName:source.fileName,
      pipeCount:pipes.length,branchCount:ordinal,nodeCount});
  }
  return {branches,sourceOrder};
}
const flat=branches=>branches.flatMap(branch=>branch.nodes.map(n=>({
  sourceId:branch.sourceId,branchOrdinal:branch.branchOrdinal,...n,
})));
const goldenRaw=()=>golden.branches.map(({format,lineKey,pipingClass,...raw})=>raw);
function assertMatchesGoldens(sources) {
  const raw=directRawCensus(sources);
  assert.deepEqual(raw.sourceOrder,golden.sourceOrder);
  assert.deepEqual(raw.branches,goldenRaw());
  assert.equal(raw.branches.length,golden.counts.branches);
  assert.equal(flat(raw.branches).length,golden.counts.nodes);
  assert.equal(flat(raw.branches).filter(x=>x.nodeNumber==='-1').length,
    golden.counts.negativeOneNodes);
  assert.equal(flat(raw.branches).filter(x=>x.nodeNumber==='101').length,
    golden.counts.positive101Nodes);
  return raw;
}
function normalizedProjection(projection) {
  return projection.branches.map(branch=>({
    sourceId:branch.sourceId,branchOrdinal:branch.branchOrdinal,branchName:branch.branchName,
    nodes:projection.nodes.filter(node=>node.branchOccurrenceId===branch.occurrenceId)
      .map(n=>({nodeOrdinal:n.nodeOrdinal,nodeNumber:n.nodeNumber,
        componentType:n.componentType,componentRefNo:n.componentRefNo,endpoint:n.endpoint})),
  }));
}
test('A1 independent handwritten XML oracle: Format1/Format2, repeated names and negative/duplicate NodeNumbers',()=>{
  const raw=assertMatchesGoldens(originalSources);
  assert.equal(new Set(raw.branches.map(x=>x.branchName)).size,2);
  assert.deepEqual(golden.branches.map(b=>b.format),[1,2,2,1]);
  assert.deepEqual(golden.branches.map(b=>[b.lineKey,b.pipingClass]),[
    ['S8811000','91261M7'],['S8822000','91261M7'],
    ['S8822000','91261M7'],['S8811000','91261M7'],
  ]);
  assert.ok(Object.isFrozen(golden.branches[0].nodes[0]));
  assert.throws(()=>golden.branches.push({}),TypeError);
});
test('A1 Mode A authentic originals retain complete source-local branch/node identity',()=>{
  for(const source of originalSources) {
    const projection=projectXmlCiiOccurrences({xmlText:source.xmlText,mode:'A',
      sourceId:source.sourceId});
    const expected=goldenRaw().filter(x=>x.sourceId===source.sourceId);
    assert.deepEqual(normalizedProjection(projection),expected);
    assert.equal(projection.nodeCount,expected.reduce((n,b)=>n+b.nodes.length,0));
  }
});
test('A1 combined Mode B covers entire original population, not review-eligible nodeRows only',()=>{
  const projection=projectXmlCiiOccurrences({xmlText:combinedSourceText(),
    mode:'B',manifest:modeBManifest()});
  assertMatchesGoldens(originalSources);
  assert.deepEqual(normalizedProjection(projection),goldenRaw());
  assert.deepEqual([projection.branchCount,projection.nodeCount],
    [golden.counts.branches,golden.counts.nodes]);
  assert.equal(new Set(projection.nodes.map(x=>x.occurrenceId)).size,golden.counts.nodes);
  assert.deepEqual(projection.sourceTotals.map(x=>[x.sourceId,x.branchCount,x.selectedNodeCount]),
    [['P4-A',2,3],['P4-B',2,3]]);
});
test('A1 negative: equal-byte-length XML edit changes original SHA and violates immutable golden',()=>{
  const originals=originalSources.map(s=>({...s}));
  const before=originals[0].xmlText;
  originals[0].xmlText=before.replace('R-A0','R-X0');
  assert.equal(Buffer.byteLength(originals[0].xmlText),Buffer.byteLength(before));
  assert.notEqual(sha256(originals[0].xmlText),sha256(before));
  assert.throws(()=>assertMatchesGoldens(originals),assert.AssertionError);
  const changed=projectXmlCiiOccurrences({xmlText:originals[0].xmlText,
    sourceId:'P4-A',mode:'A'});
  assert.equal(changed.nodes[0].componentRefNo,'R-X0');
});
test('A1 negative: source-order swap with same pipe/row counts cannot pass handwritten source custody',()=>{
  const wrong=modeBManifest();
  wrong.sourceOrder.reverse();
  const projected=projectXmlCiiOccurrences({xmlText:combinedSourceText(),mode:'B',manifest:wrong});
  assert.notDeepEqual(normalizedProjection(projected),goldenRaw(),
    'reassigning identical-count source originals changes physical occurrence lineage');
  assert.deepEqual(wrong.sourceOrder.map(x=>x.pipeCount),[1,1]);
});
test('A1 negative: missing, extra, or duplicated original nodes must fail independent census',()=>{
  const unchanged=assertMatchesGoldens(originalSources);
  const missing=originalSources.map(x=>({...x}));
  missing[1].xmlText=missing[1].xmlText.replace(
    /\s*<Node><NodeNumber>101<\/NodeNumber>.*?<\/Node>/,'');
  assert.equal(flat(directRawCensus(missing).branches).length,golden.counts.nodes-1);
  assert.throws(()=>assertMatchesGoldens(missing),assert.AssertionError);
  assert.deepEqual(unchanged.branches,goldenRaw());
});
