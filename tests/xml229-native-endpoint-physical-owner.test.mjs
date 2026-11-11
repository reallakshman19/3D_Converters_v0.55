import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installWeightBasisXmlDom } from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {
  isXmlCiiWeightReviewNode,
  isXmlCiiWeightReviewConnectionEligible,
  isXmlCiiWeightReviewEndpoint,
} from '../converters/xml-cii2019-core/weight-match-model.js';
import { projectXmlCiiOccurrences } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {isXml229NonOwnerRigidBranchInlet} from '../converters/xml-cii2019-core/xml229-nonowner-rigid-branch-inlet.mjs';
import { preparePreviewNodeOccurrenceDocument } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js';

installWeightBasisXmlDom(globalThis);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SYNTHETIC_BRANCH_HEAD_ENDPOINT1_XML = `<?xml version="1.0" encoding="utf-8"?>
<PipeStressExport xmlns="http://aveva.com/pipeStress116.xsd">
  <Pipe>
    <Branch>
      <Branchname>/HEADER/B1</Branchname>
      <Node>
        <NodeNumber>100</NodeNumber>
        <Endpoint>1</Endpoint>
        <ComponentType>PIPE</ComponentType>
        <Position>0 0 0</Position>
      </Node>
      <Node>
        <NodeNumber>110</NodeNumber>
        <Endpoint>2</Endpoint>
        <Rigid>2</Rigid>
        <ComponentType>RIGID</ComponentType>
        <ComponentRefNo>=1001/01</ComponentRefNo>
        <Position>1000 0 0</Position>
      </Node>
    </Branch>
    <Branch>
      <Branchname>/CHILD/B1</Branchname>
      <Node>
        <NodeNumber>110</NodeNumber>
        <Endpoint>1</Endpoint>
        <Rigid>2</Rigid>
        <ComponentType>RIGID</ComponentType>
        <ComponentRefNo>=2001/01</ComponentRefNo>
        <ConnectionType>BRAN</ConnectionType>
        <Position>1000 0 0</Position>
      </Node>
      <Node>
        <NodeNumber>120</NodeNumber>
        <Endpoint>2</Endpoint>
        <Rigid>2</Rigid>
        <ComponentType>RIGID</ComponentType>
        <ComponentRefNo>=2001/02</ComponentRefNo>
        <Position>1000 500 0</Position>
      </Node>
    </Branch>
  </Pipe>
</PipeStressExport>`;

test('Endpoint 1 branch-inlet rigid node is excluded by isXmlCiiWeightReviewEndpoint', () => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(SYNTHETIC_BRANCH_HEAD_ENDPOINT1_XML, 'text/xml');
  const nodes = [...doc.getElementsByTagName('Node')];

  const headerOutlet = nodes[1];
  assert.equal(isXmlCiiWeightReviewNode(headerOutlet), true);
  assert.equal(isXmlCiiWeightReviewConnectionEligible(headerOutlet), true);
  assert.equal(isXmlCiiWeightReviewEndpoint(headerOutlet), true);

  const childInlet = nodes[2];
  assert.equal(isXmlCiiWeightReviewNode(childInlet), true);
  assert.equal(isXmlCiiWeightReviewConnectionEligible(childInlet), true);
  assert.equal(isXmlCiiWeightReviewEndpoint(childInlet), false);

  const childOutlet = nodes[3];
  assert.equal(isXmlCiiWeightReviewNode(childOutlet), true);
  assert.equal(isXmlCiiWeightReviewConnectionEligible(childOutlet), true);
  assert.equal(isXmlCiiWeightReviewEndpoint(childOutlet), true);
});

test('Matched terminal and branch-head rigid inlet have one mass owner', () => {
  const xml = SYNTHETIC_BRANCH_HEAD_ENDPOINT1_XML;
  const clean = preparePreviewNodeOccurrenceDocument({ xmlText: xml, config: {} });
  const branches = [...clean.document.getElementsByTagName('Branch')];
  assert.equal(branches.length, 2);

  const physicalNodes = [];
  for (const [branchIndex,branch] of branches.entries()) {
    const nodes = [...branch.getElementsByTagName('Node')];
    for (const [nodeOrdinal,node] of nodes.entries()) {
      if (
        isXmlCiiWeightReviewNode(node) &&
        isXmlCiiWeightReviewConnectionEligible(node) &&
        !isXml229NonOwnerRigidBranchInlet({node,branchIndex,nodeOrdinal,branches})
      ) {
        physicalNodes.push({
          nodeNumber: node.getElementsByTagName('NodeNumber')[0]?.textContent,
          endpoint: node.getElementsByTagName('Endpoint')[0]?.textContent,
          ref: node.getElementsByTagName('ComponentRefNo')[0]?.textContent,
        });
      }
    }
  }

  assert.equal(physicalNodes.length, 2);
  assert.deepEqual(physicalNodes, [
    { nodeNumber: '110', endpoint: '2', ref: '=1001/01' },
    { nodeNumber: '120', endpoint: '2', ref: '=2001/02' },
  ]);
});


test('Rigid branch inlet classification requires exact unique source ownership',()=>{
 const doc=new DOMParser().parseFromString(SYNTHETIC_BRANCH_HEAD_ENDPOINT1_XML,'text/xml');
 const branches=[...doc.getElementsByTagName('Branch')];
 const node=[...branches[1].getElementsByTagName('Node')][0];
 const input={node,branchIndex:1,nodeOrdinal:0,branches};
 assert.equal(isXml229NonOwnerRigidBranchInlet(input),true);
 assert.equal(isXml229NonOwnerRigidBranchInlet({...input,nodeOrdinal:1}),false);
 node.getElementsByTagName('Position')[0].textContent='1000 0 1';
 assert.equal(isXml229NonOwnerRigidBranchInlet(input),false);
});

test('Public Firstpass retains ordinary Endpoint 1 physical candidates',()=>{
 const xml=readFileSync(resolve(ROOT,'Benchmarks/1885Sjson/FirstpassXML'),'utf8');
 const clean=preparePreviewNodeOccurrenceDocument({xmlText:xml,config:{}});
 const branches=[...clean.document.getElementsByTagName('Branch')];
 let count=0,first=0;
 for(const [branchIndex,branch] of branches.entries()){
   const nodes=[...branch.getElementsByTagName('Node')];
   for(const [nodeOrdinal,node] of nodes.entries()){
     if(!isXmlCiiWeightReviewNode(node)||!isXmlCiiWeightReviewConnectionEligible(node)||
        isXml229NonOwnerRigidBranchInlet({node,branchIndex,nodeOrdinal,branches}))continue;
     count++;
     if(node.getElementsByTagName('Endpoint')[0]?.textContent==='1')first++;
   }
 }
 assert(count>0,'Firstpass physical candidates cannot disappear');
 assert(first>0,'Endpoint 1 cannot be excluded globally');
});

const privatePath=process.env.XML229_PL01_FIXTURE_PATH;
const privateSha=process.env.XML229_PL01_FIXTURE_SHA256;
test('Private PL-01 owner identity checks (explicit opt-in)',{
 skip:(!privatePath||!privateSha)?'NOT_RUN: owner XML path and SHA-256 required':false,
},()=>{
 const bytes=readFileSync(privatePath);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),privateSha);
 const clean=preparePreviewNodeOccurrenceDocument({xmlText:bytes.toString('utf8'),config:{}});
 const branches=[...clean.document.getElementsByTagName('Branch')];
 assert.equal(branches.length,9);
 const node=[...branches[6].getElementsByTagName('Node')][0];
 assert.equal(node.getElementsByTagName('NodeNumber')[0]?.textContent,'2810');
 assert.equal(isXml229NonOwnerRigidBranchInlet({node,branchIndex:6,nodeOrdinal:0,branches}),true);
 let excluded=0;
 for(const [branchIndex,branch] of branches.entries()){
   const nodes=[...branch.getElementsByTagName('Node')];
   for(const [nodeOrdinal,node] of nodes.entries())
     if(isXml229NonOwnerRigidBranchInlet({node,branchIndex,nodeOrdinal,branches}))excluded++;
 }
 assert.equal(excluded,1);
});

test('Fact producer, census worker, and transfer manifest remain identical to docs mirrors', () => {
  const files = [
    'tabs/xml-cii-2019-standalone/integration/xml229-preview-engineering-fact-producer.mjs',
    'tabs/xml-cii-2019-standalone/integration/xml229-original-physical-census-worker.mjs',
    'tabs/xml-cii-2019-standalone/integration/xml229-r2-physical-transfer-manifest.mjs',
  ];
  for (const file of files) {
    const rootPath = resolve(ROOT, file);
    const docsPath = resolve(ROOT, 'docs', file);
    const rootContent = readFileSync(rootPath, 'utf8');
    const docsContent = readFileSync(docsPath, 'utf8');
    assert.equal(
      rootContent.replace(/\r\n/g, '\n'),
      docsContent.replace(/\r\n/g, '\n'),
      `Mirror mismatch for ${file}`
    );
  }
});
