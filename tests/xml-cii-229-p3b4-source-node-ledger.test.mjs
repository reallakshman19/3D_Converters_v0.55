import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {preparePreviewNodeOccurrenceDocument} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js';
import {applyPreviewBoreWallAuthority} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js';
import {xmlCiiDryRunPreview} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js';
import {executeXml229OriginalPreview} from '../tabs/xml-cii-2019-standalone/integration/xml229-preview-original-blob-execution.mjs';

installWeightBasisXmlDom(globalThis);
const NAME='/ASIM-1885-PL-10"-S8810105-HOT-01/B3';
const REF='=1006649755/1750';
const node=({kind='VALV',number='300',bore=300,length=100,endpoint='1'}={})=>
  '<Node><NodeNumber>'+number+'</NodeNumber><ComponentRefNo>'+REF+'</ComponentRefNo>'+
  '<Endpoint>'+endpoint+'</Endpoint><ComponentType>'+kind+'</ComponentType>'+
  '<BoreMm>'+bore+'</BoreMm><ElementLengthMm>'+length+'</ElementLengthMm></Node>';
const branch=(bore=300)=>
  '<Pipe><Branch><Branchname>'+NAME+'</Branchname>'+
  node({kind:'GASK',number:'100',bore:30})+
  node({kind:'PIPE',number:'200',bore:50,length:4})+
  node({kind:'VALV',number:'300',bore})+
  '</Branch></Pipe>';
const xml=(bores=[300])=>'<PipeStressExport>'+bores.map(branch).join('')+'</PipeStressExport>';
const cfg={};
const baselineRows=bores=>bores.map((bore,i)=>({
  branchName:NAME,pipingClass:'S8810105',rating:'900',sizeMm:bore,
}));
const reviewedRows=bores=>bores.map((bore,i)=>({
  branchName:NAME,branchOccurrenceIndex:i,nodeOrdinal:0,
  sourceNodeOrdinal:2,effectiveNodeOrdinal:0,
  nodeNumber:'300',componentRefNo:REF,endpoint:'1',
  rating:'900',boreMm:bore,lengthMm:100,
}));

test('end-to-end dry-run retains source ordinals after original node cleanup',()=>{
  // Zero-master weight fallback ensures an actual review row is emitted,
  // and an explicit rating avoids relying on heuristic branch token extraction.
  const config={overrides:{rating:{[NAME]:'900'}},weight:{masterRows:[]}};
  const single=xmlCiiDryRunPreview(xml(),config,'');
  assert.equal(single.branchRows.length,1);
  assert.equal(single.nodeRows.length,1,'must exercise real review-node + bore authority join');
  assert.equal(single.nodeRows[0].nodeOrdinal,0,'working sequence is cleaned');
  assert.equal(single.nodeRows[0].sourceNodeOrdinal,2,'original source identity survives cleanup');
  assert.equal(single.nodeRows[0].boreMm,300);
  const repeated=xmlCiiDryRunPreview(xml([300,250]),config,'');
  assert.equal(repeated.branchRows.length,2);
  assert.equal(repeated.nodeRows.length,2);
  assert.deepEqual(repeated.nodeRows.map(n=>n.sourceNodeOrdinal),[2,2]);
  assert.deepEqual(repeated.nodeRows.map(n=>n.boreMm),[300,250]);
});

test('GASK and <=6mm nodes are dropped, but original source ordinal 2 is retained',()=>{
  const {document,ledger}=preparePreviewNodeOccurrenceDocument({xmlText:xml(),config:cfg});
  assert.equal(document.getElementsByTagName('Node').length,1);
  assert.equal(ledger.schema,'XML229.PreviewNodeOccurrenceLedger.v1');
  assert.deepEqual([ledger.originalCount,ledger.retainedCount,ledger.droppedCount],[3,1,2]);
  assert.deepEqual(ledger.allByBranch[0].map(v=>v.dropReason),['GASK','SHORT_ELEMENT',null]);
  assert.equal(ledger.retainedByBranch[0][0].sourceNodeOrdinal,2);
  assert.equal(ledger.retainedByBranch[0][0].effectiveNodeOrdinal,0);
  assert.ok(Object.isFrozen(ledger));
});

test('after cleanup bore/wall uses original source ordinal, not effective ordinal',()=>{
  const result=applyPreviewBoreWallAuthority({
    xmlText:xml(),stagedJsonText:'',config:cfg,requireSourceOrdinal:true,
    result:{branchRows:baselineRows([300]),nodeRows:reviewedRows([300])},
  });
  assert.equal(result.nodeRows.length,1);
  assert.equal(result.nodeRows[0].sourceNodeOrdinal,2);
  assert.equal(result.nodeRows[0].boreMm,300);
  assert.equal(result.nodeBoreWallRows.length,3,'authority retains all original nodes');
});

test('duplicated branch name/ref/node number do not alias distinct source occurrences',()=>{
  const bores=[300,250];
  const result=applyPreviewBoreWallAuthority({
    xmlText:xml(bores),stagedJsonText:'',config:cfg,requireSourceOrdinal:true,
    result:{branchRows:baselineRows(bores),nodeRows:reviewedRows(bores)},
  });
  assert.deepEqual(result.nodeRows.map(row=>row.boreMm),bores);
  assert.deepEqual(result.nodeRows.map(row=>row.branchOccurrenceIndex),[0,1]);
  assert.deepEqual(result.nodeRows.map(row=>row.sourceNodeOrdinal),[2,2]);
});

test('wrong original source ordinal remains a hard integrity failure',()=>{
  assert.throws(()=>applyPreviewBoreWallAuthority({
    xmlText:xml(),stagedJsonText:'',config:cfg,requireSourceOrdinal:true,
    result:{branchRows:baselineRows([300]),
      nodeRows:[{...reviewedRows([300])[0],sourceNodeOrdinal:0}]},
  }),/node occurrence identity drift/);
  assert.throws(()=>applyPreviewBoreWallAuthority({
    xmlText:xml(),stagedJsonText:'',config:cfg,requireSourceOrdinal:true,
    result:{branchRows:baselineRows([300]),
      nodeRows:[{...reviewedRows([300])[0],sourceNodeOrdinal:undefined}]},
  }),/original node occurrence missing/);
});

test('disabled cleanup retains all original/effective ordinals',()=>{
  const noDrop={dropGasketNodes:false,dropGasketsInEnrichment:false,
    dropShortElementLengthNodes:false};
  const {ledger}=preparePreviewNodeOccurrenceDocument({xmlText:xml(),config:noDrop});
  assert.equal(ledger.retainedCount,3);
  assert.equal(ledger.droppedCount,0);
  assert.deepEqual(ledger.retainedByBranch[0].map(r=>r.sourceNodeOrdinal),[0,1,2]);
  assert.deepEqual(ledger.retainedByBranch[0].map(r=>r.effectiveNodeOrdinal),[0,1,2]);
});

test('Worker transport surfaces engine exception stage and original message',async()=>{
  const handlers=new Map();
  const worker={
    addEventListener:(name,cb)=>handlers.set(name,cb),
    removeEventListener:(name)=>handlers.delete(name),
    terminate:()=>{},
    postMessage:(req)=>queueMicrotask(()=>handlers.get('message')?.({
      data:{protocol:'xml-cii-preview-local/1',
        requestId:req.requestId,basisId:req.basisId,
        state:'failed',error:{code:'XML229_PREVIEW_WORKER_ERROR',
          stage:'engineering-dryrun',
          message:'Combined Preview node occurrence identity drift; conversion blocked.'}},
    })),
  };
  const session={blob:new Blob(['{}']),isCurrent:()=>true,
    receipt:{phase:'INDEX_COMMITTED',engineeringReady:false,
      rightsBasis:'SOURCE_FACTS_ONLY'}};
  const result=executeXml229OriginalPreview({
    requestId:'test-ledger',basisId:'a'.repeat(64),
    xmlText:xml(),config:{},scope:{mode:'A',selection:null},
    originalSourceSession:session,createWorker:()=>worker,
  });
  await assert.rejects(result.promise,(e)=>{
    assert.equal(e.code,'XML229_PREVIEW_WORKER_ERROR');
    assert.equal(e.stage,'engineering-dryrun');
    assert.match(e.message,/node occurrence identity drift/);
    return true;
  });
});

test('served source mirrors remain exactly equal',async()=>{
  for(const path of [
    'ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js',
    'ui-adapted/xml-cii-adapted-preview-dryrun-core.js',
    'ui-adapted/xml-cii-adapted-preview-dryrun.js',
    'ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js',
    'integration/xml229-preview-original-blob-execution.mjs',
  ]){
    const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/'+path,import.meta.url),'utf8');
    const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/'+path,import.meta.url),'utf8');
    assert.equal(a,b,path);
  }
});
