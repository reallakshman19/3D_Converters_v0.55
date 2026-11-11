import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureXml229P4LiveSourceSnapshot,compareXml229P4LiveSourceSnapshot}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js';

const input=()=>({
 sourceText:'<PipeStressExport><Branch><Node><NodeNumber>-1</NodeNumber></Node></Branch></PipeStressExport>',
 sourceFile:{name:'original.xml',size:92},
 supportConfigJson:'{"linelist":{"column":"P1"},"weight":{"boreToleranceMm":2}}',
 branchSelection:{},
 jsonTraceScopeId:'__ALL__',
 selectedScopeId:null,requestedOwnerZoneScopeId:null,
 masterContext:{datasetRefs:{lineList:{datasetId:'ll-v3',datasetRevision:3}},
  appliedMappingRevision:{lineList:3,weight:1},
  rowCounts:{lineList:385,pipingClass:10699,materialMap:383,weight:1595}},
 dependencyRevisions:{sourceModelRevision:5,masterAppliedRevision:7},
 activePhaseId:'preview',
});
const valid=(basis,current,verifyFullSelection=()=>false)=>
 compareXml229P4LiveSourceSnapshot(basis,current,{verifyFullSelection});

test('ordinary Weight Match navigation and background bookkeeping do NOT revoke a source-attested Worker',()=>{
 const original=input(),basis=captureXml229P4LiveSourceSnapshot(original,'XML-1');
 const after={...original,
  activePhaseId:'weight-match',
  sourceFile:{name:'original.xml',size:92}, // DOM rebuilt a File wrapper
  dependencyRevisions:{sourceModelRevision:6,masterAppliedRevision:10},
  previewStatus:'Complete',outputRunReadinessReport:{runHeld:true},
  jsonTraceScopeId:'ALL',
 };
 assert.equal(valid(basis,after),true,'UI-only state changes discarded same original GC-PW InputBasis');
 const formatted={...after,supportConfigJson:'{\n  "weight": {"boreToleranceMm": 2},\n  "linelist": {"column":"P1"}\n}'};
 assert.equal(valid(basis,formatted),true,'format-only JSON reserialization must not revoke a reviewed source');
});

test('original XML edits, Owner scope selection, master mapping or true configuration changes must revoke Worker',()=>{
 const source=input(),basis=captureXml229P4LiveSourceSnapshot(source,'XML-1');
 const rejects=[
  {...source,sourceText:source.sourceText+' '},
  {...source,jsonTraceScopeId:'owner-zone-42'},
  {...source,selectedScopeId:'selected-zone-2'},
  {...source,requestedOwnerZoneScopeId:'siteA:zoneB'},
  {...source,supportConfigJson:'{"linelist":{"column":"P2"},"weight":{"boreToleranceMm":2}}'},
  {...source,masterContext:{...source.masterContext,
    datasetRefs:{lineList:{datasetId:'ll-v4',datasetRevision:4}}}},
  {...source,masterContext:{...source.masterContext,
    appliedMappingRevision:{lineList:4,weight:1}}},
  {...source,masterContext:{...source.masterContext,
    rowCounts:{...source.masterContext.rowCounts,lineList:386}}},
 ];
 for(let i=0;i<rejects.length;i++)
  assert.equal(valid(basis,rejects[i]),false,'source input mutation '+i+' unexpectedly reused Worker');
});

test('selection normalization admits only separately validated full physical source, never partial or stale identity',()=>{
 const source=input(),basis=captureXml229P4LiveSourceSnapshot(source,'XML-1');
 const normalized={...source,branchSelection:{
   selectedBranchOccurrenceIds:['branch:0'],sourceDigest:'valid-full-source-digest'}};
 assert.equal(valid(basis,normalized,()=>true),true);
 assert.equal(valid(basis,normalized,()=>false),false);
 assert.equal(valid(basis,normalized,()=>{throw Error('stale selection');}),false);
});

test('real source and docs mirror guard remain exact',async()=>{
 const path='tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js';
 const root=await readFile(new URL('../'+path,import.meta.url),'utf8');
 const mirror=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
 assert.equal(root,mirror);
 assert.match(root,/source\.isCurrent\(\)/);
 assert.match(root,/assertXml229P4OriginalFullSelection/);
});
