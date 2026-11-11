import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {
 createPreviewButtonBasis,runPreviewButtonSession,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-button-session.js';
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;

function fakeHost(){
 const callbacks={};
 const retry={addEventListener:(name,cb)=>{callbacks[name]=cb;},click:()=>callbacks.click?.()};
 const host={
  dataset:{mcPreviewSourceId:'FirstpassXML'},innerHTML:'',
  querySelector(selector){
   if(selector==='[data-mc-preview-job-retry]'&&this.innerHTML.includes('data-mc-preview-job-retry'))return retry;
   return null;
  },
 };
 const rootEl={querySelector:x=>x==='#mc-preview-table-host'?host:null};
 return {host,rootEl,retry};
}
const config=()=>({
 linelist:{masterRows:[{line:'L1'}],fieldMap:{}},
 pipingClass:{masterRows:[{class:'PC01'}],fieldMap:{}},
 material:{mapRows:[{code:'001'}],fieldMap:{}},
 weight:{masterRows:[{item:'V1'}],fieldMap:{}},
 overrides:{},sourceMode:'A',
});
async function rejection(options,expected){
 const {host,rootEl,retry}=fakeHost();
 let reads=0,rendered=0;
 const original={
  sourceId:'FirstpassXML',...options,
  resolveStagedJsonText:async()=>{reads++;throw Error('DO_NOT_READ_ORIGINAL_IN_UNSUPPORTED_SELECTION');},
 };
 const result=await runPreviewButtonSession({
  host,rootEl,xmlText:'<PipeStressExport/>',config:config(),options:original,
  renderResult:async()=>{rendered++;return true;},
 });
 assert.equal(result,null);
 assert.equal(reads,0,'Unsupported selection must fail before reading staged source');
 assert.equal(rendered,0,'Unsupported selection must never render an ALL result');
 assert.ok(host.innerHTML.includes('data-mc-preview-job-retry'),'Real job UI must permit retry');
 assert.ok(host.innerHTML.includes(expected),host.innerHTML);
 return {host,retry};
}

test('P3B.3 / R16 explicit A/ZONE-1 refuses actual Mode A Worker dispatch before staged source read',async()=>{
 await rejection({selectedScopeId:'A/ZONE-1'},'PREVIEW_SELECTED_SCOPE_NOT_INTEGRATED');
});
test('P3B.3 / R16 distinct B/ZONE-2 refuses without silently selecting another owner',async()=>{
 await rejection({requestedOwnerZoneScopeId:'B/ZONE-2'},'PREVIEW_SELECTED_SCOPE_NOT_INTEGRATED');
});
test('P3B.3 / R16 existing resolver selector option also refuses if forwarded to Preview',async()=>{
 await rejection({jsonTraceScopeId:'A/ZONE-1'},'PREVIEW_SELECTED_SCOPE_NOT_INTEGRATED');
});
test('P3B.3 / R16 conflicting Owner/zone selection claims fail distinctly',async()=>{
 await rejection({selectedScopeId:'A/ZONE-1',jsonTraceScopeId:'B/ZONE-2'},
  'PREVIEW_SCOPE_CONFLICT');
});
test('P3B.3 / R16 malformed explicitly requested Owner/zone fails instead of defaulting ALL',async()=>{
 await rejection({selectedScopeId:' '},'PREVIEW_SCOPE_INVALID');
});
test('P3B.3 / R16 never trusts an unescaped Owner label in Preview error HTML',async()=>{
 const {host}=await rejection({selectedScopeId:'<svg/onload=evil()>'},
  'PREVIEW_SELECTED_SCOPE_NOT_INTEGRATED');
 assert.ok(host.innerHTML.includes('&lt;svg/onload=evil()&gt;'));
 assert.ok(!host.innerHTML.includes('<svg/onload=evil()>'));
});
test('P3B.3 / R16 legacy explicit ALL stays content-identity compatible with absent selection',async()=>{
 const params={xmlText:'<PipeStressExport>ONE</PipeStressExport>',
   config:config(),stagedJsonText:'[{"type":"BRANCH"}]',sourceId:'FirstpassXML'};
 const a=await createPreviewButtonBasis(params),b=await createPreviewButtonBasis({...params});
 assert.equal(a.basisId,b.basisId);
 assert.deepEqual(a.scope,[{sourceId:'FirstpassXML',selectionRef:'ALL'}]);
});
test('P3B.3 / R16 source/docs B1 source remains byte-exact',async()=>{
 const path='xml-cii-adapted-preview-facts-button-session.js';
 const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+path,import.meta.url),'utf8');
 const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+path,import.meta.url),'utf8');
 assert.equal(a,b);
});

test('P3B.3 O1 default __ALL__ sentinel is not mistaken for a selected Owner',async()=>{
 const {host,rootEl}=fakeHost();
 let stagedReads=0,rendered=0;
 const result=await runPreviewButtonSession({
   host,rootEl,xmlText:'<PipeStressExport/>',config:config(),
   options:{
     sourceId:'FirstpassXML',jsonTraceScopeId:'__ALL__',
     resolveStagedJsonText:async()=>{stagedReads++;throw Error('STOP_BEFORE_COMPUTE');},
   },
   renderResult:async()=>{rendered++;return true;},
 });
 assert.equal(result,null);
 assert.equal(stagedReads,1,'O1 default ALL must pass scope validation');
 assert.equal(rendered,0);
 assert.match(host.innerHTML,/STAGED_SOURCE_FAILED/);
});
test('P3B.3 explicit ALL and O1 __ALL__ claims agree',async()=>{
 const {host,rootEl}=fakeHost();
 let readCount=0;
 await runPreviewButtonSession({host,rootEl,xmlText:'<PipeStressExport/>',
  config:config(),options:{
    sourceId:'FirstpassXML',selectedScopeId:'ALL',jsonTraceScopeId:'__ALL__',
    resolveStagedJsonText:async()=>{readCount++;throw Error('STOP_BEFORE_COMPUTE');},
  },renderResult:async()=>true});
 assert.equal(readCount,1);
 assert.match(host.innerHTML,/STAGED_SOURCE_FAILED/);
});
