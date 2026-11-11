import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  beginXml229VerifiedEngineeringBuild,publishXml229VerifiedEngineeringBuild,
  getXml229VerifiedEngineeringEntry,hasXml229VerifiedEngineeringBasis,
  revokeXml229VerifiedEngineeringBasis,routeXml229AutomaticEngineeringProposal,
} from '../tabs/xml-cii-2019-standalone/integration/xml229-engineering-basis-authority.mjs';
import {extractBranchFieldsWithFormats}
 from '../converters/xml-cii2019-core/branch-format-extraction.js';

const fixture=()=> {
 const key={current:{supportConfigJson:'{"regexTester":{"formats":[{"lineKey":{"tokenPosition":1}}]}}'}};
 const scoped={modeABaseRef:key};
 const worker={cancelled:0,cancel(){this.cancelled++},readCompletion:async()=>({verified:true})};
 return {key,scoped,worker};
};

test('Preview and Weight Match wrappers share exactly one source-bound authority',()=>{
 const {key,scoped,worker}=fixture();
 const ticket=beginXml229VerifiedEngineeringBuild(scoped);
 assert.equal(hasXml229VerifiedEngineeringBasis(key),false);
 assert.equal(publishXml229VerifiedEngineeringBuild(ticket,{lease:'attested-sha-v1',session:worker}),true);
 assert.equal(getXml229VerifiedEngineeringEntry(scoped).session,worker);
 assert.equal(getXml229VerifiedEngineeringEntry(key).lease,'attested-sha-v1');
 assert.equal(worker.cancelled,0);
});

test('automatic regex suggestions become draft when a verified basis exists; committed config remains intact',()=>{
 const {key,scoped,worker}=fixture();
 const ticket=beginXml229VerifiedEngineeringBuild(key);
 publishXml229VerifiedEngineeringBuild(ticket,{lease:'basis-1',session:worker});
 const before=key.current.supportConfigJson;
 let committed=0,staged=0;
 const change={formats:[{lineKey:{tokenPosition:2}}]};
 const mode=routeXml229AutomaticEngineeringProposal(scoped,{
   proposal:change,
   stage:p=>{staged++;key.current.regexSmartPreview={proposed:p}},
   commit:p=>{committed++;key.current.supportConfigJson=JSON.stringify(p)},
 });
 assert.equal(mode,'DRAFT');
 assert.equal(committed,0);
 assert.equal(staged,1);
 assert.equal(key.current.supportConfigJson,before);
 assert.deepEqual(key.current.regexSmartPreview.proposed,change);
 assert.equal(getXml229VerifiedEngineeringEntry(key).session,worker);
});

test('before Build, automatic safe suggestions can retain existing authoring behavior',()=>{
 const {key,scoped}=fixture();
 let committed=0;
 const mode=routeXml229AutomaticEngineeringProposal(scoped,{
  proposal:{a:1},stage:()=>assert.fail('no verified session'),
  commit:()=>{committed++},
 });
 assert.equal(mode,'COMMITTED');
 assert.equal(committed,1);
});

test('explicit new-basis transition replaces rather than mutates prior verified Worker and decisions',()=>{
 const {key,scoped,worker}=fixture();
 const a=beginXml229VerifiedEngineeringBuild(key);
 assert.ok(publishXml229VerifiedEngineeringBuild(a,{lease:'basis-1',session:worker}));
 const b=beginXml229VerifiedEngineeringBuild(scoped);
 assert.equal(worker.cancelled,1);
 assert.equal(hasXml229VerifiedEngineeringBasis(key),false);
 const next={cancelled:0,cancel(){this.cancelled++}};
 assert.equal(publishXml229VerifiedEngineeringBuild(b,{lease:'basis-2',session:next}),true);
 assert.equal(getXml229VerifiedEngineeringEntry(key).lease,'basis-2');
 assert.equal(worker.cancelled,1);
});

test('late concurrent Worker completion cannot overwrite newer Preview authority',()=>{
 const {key,worker}=fixture();
 const stale=beginXml229VerifiedEngineeringBuild(key);
 const current=beginXml229VerifiedEngineeringBuild(key);
 const winner={cancelled:0,cancel(){this.cancelled++}};
 const ok=publishXml229VerifiedEngineeringBuild(current,{lease:'new',session:winner});
 assert.equal(ok,true);
 assert.equal(publishXml229VerifiedEngineeringBuild(stale,{lease:'old',session:worker}),false);
 assert.equal(worker.cancelled,1);
 assert.equal(getXml229VerifiedEngineeringEntry(key).session,winner);
});

test('only explicit revoke invalidates verified review; stale panel cannot revoke successor',()=>{
 const {key,worker}=fixture();
 const a=beginXml229VerifiedEngineeringBuild(key);
 publishXml229VerifiedEngineeringBuild(a,{lease:'same',session:worker});
 const b=beginXml229VerifiedEngineeringBuild(key);
 const newer={cancelled:0,cancel(){this.cancelled++}};
 publishXml229VerifiedEngineeringBuild(b,{lease:'changed',session:newer});
 assert.equal(revokeXml229VerifiedEngineeringBasis(key,{expectedSession:worker}),false);
 assert.equal(hasXml229VerifiedEngineeringBasis(key),true);
 assert.equal(revokeXml229VerifiedEngineeringBasis(key,{expectedSession:newer}),true);
 assert.equal(newer.cancelled,1);
 assert.equal(hasXml229VerifiedEngineeringBasis(key),false);
});

test('a terminated Worker cannot be returned or treated as verified authority',()=>{
 const {key}=fixture();
 let closed=false;
 const worker={get closed(){return closed;},cancel(){closed=true}};
 const first=beginXml229VerifiedEngineeringBuild(key);
 assert.equal(publishXml229VerifiedEngineeringBuild(first,{lease:'same-xml-json-masters',session:worker}),true);
 assert.equal(hasXml229VerifiedEngineeringBasis(key),true);
 closed=true; // Worker terminated independently of the UI panel
 assert.equal(getXml229VerifiedEngineeringEntry(key),null,
   'dead Worker must be evicted, not returned for new Weight Match reads');
 assert.equal(hasXml229VerifiedEngineeringBasis(key),false);
 let committed=0,staged=0;
 const closedMode=routeXml229AutomaticEngineeringProposal(key,{
   proposal:{rigidWeightKg:123},
   commit:()=>committed++,
   stage:()=>staged++,
 });
 assert.equal(closedMode,'DRAFT',
   'cancelled original review must never promote automatic weight/regex suggestions');
 assert.equal(committed,0);
 assert.equal(staged,1);
 const second=beginXml229VerifiedEngineeringBuild(key);
 const rebuildingMode=routeXml229AutomaticEngineeringProposal(key,{
   proposal:{rigidWeightKg:456},commit:()=>committed++,stage:()=>staged++,
 });
 assert.equal(rebuildingMode,'DRAFT','replacement Worker must attest before automatic proposals may commit');
 assert.equal(committed,0);
 const replacement={closed:false,cancel(){}};
 assert.equal(publishXml229VerifiedEngineeringBuild(first,{lease:'old',session:worker}),false,
   'terminated predecessor cannot publish after source generation advances');
 assert.equal(publishXml229VerifiedEngineeringBuild(second,{
   lease:'same-xml-json-masters',session:replacement,
 }),true);
 assert.equal(getXml229VerifiedEngineeringEntry(key).session,replacement);
});

test('approved Regex formats are engineering inputs, not disposable UI metadata',()=>{
 const source='/L100-PC10-150-6';
 const format={
   tokenDelimiter:'-',
   lineKey:{tokenPosition:1},
   pipingClass:{tokenPosition:2},
   rating:{tokenPosition:3},
   bore:{tokenPosition:4},
 };
 const same={regexTester:{formats:[format]}};
 const changed={regexTester:{formats:[{...format,lineKey:{tokenPosition:2}}]}};
 const a=extractBranchFieldsWithFormats(source,same);
 const b=extractBranchFieldsWithFormats(source,changed);
 assert.equal(a.status,'MATCHED');
 assert.equal(b.status,'MATCHED');
 assert.notEqual(a.lineKey,b.lineKey,'approved change to extraction must change engineering output');
});

test('production served copies and no-stripping contract stay identical',async()=>{
 for(const path of [
   'tabs/xml-cii-2019-standalone/integration/xml229-engineering-basis-authority.mjs',
   'tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-client.mjs',
   'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',
   'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-preview-bridge.js',
   'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js',
 ]){
   const a=await readFile(new URL('../'+path,import.meta.url),'utf8');
   const b=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
   assert.equal(a,b,'deployed mirror mismatched '+path);
 }
 const p4=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 assert.doesNotMatch(p4,/canonicalPhysicalConfig/);
 assert.match(p4,/xmlCiiEnrichedConfigFromState\(view\)/);
});
