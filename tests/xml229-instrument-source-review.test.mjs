import test from 'node:test';
import './xml229-instrument-fresh-review.test.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {inspectXml229InstrumentSourceReview,createXml229InstrumentSourceRevision}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-instrument-source-review.mjs';
import {xml229InstrumentNodeClosings}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-instrument-source-offsets.mjs';
installWeightBasisXmlDom(globalThis);
const node=(ref,ep,x)=>'<Node><ComponentType>INST</ComponentType><ComponentRefNo>'+ref+
 '</ComponentRefNo><Endpoint>'+ep+'</Endpoint><Position>'+x+' 0 0</Position>'+
 '<Weight>8</Weight><OutsideDiameter>60.3</OutsideDiameter></Node>';
const source='\uFEFF<?xml version="1.0" encoding="UTF-8"?>\r\n'+
 '<PipeStressExport xmlns="urn:source"><!-- β preserved -->\r\n<Branch>'+node('A',1,0)+
 node('A',2,305)+node('B',1,1000)+node('B',2,1305)+'</Branch></PipeStressExport>';
const owner=(n,ref)=>({branchOccurrenceIndex:0,sourceNodeOrdinal:n,componentType:'INST',
 componentRefNo:ref,spanMm:305,reason:'INSTRUMENT_RIGID_CLASSIFICATION_NOT_IN_SOURCE'});
const reportFor=async(xml=source,owners=[owner(1,'A'),owner(3,'B')])=>({
 schema:'XML229.NativeOwnerPreflight.v1',sourceXmlSha256:await digestUtf8(xml),
 unsupportedOwners:owners});
const request=async(extra={})=>({sourceText:source,report:await reportFor(),...extra});

test('instrument inspection and no choice preserve exact bytes and never accept kg',async()=>{
 const input=await request(),before=JSON.stringify(input);
 const review=await inspectXml229InstrumentSourceReview(input);
 assert.equal(review.rows.length,2);assert(Object.isFrozen(review.rows));
 const output=await createXml229InstrumentSourceRevision(input);
 assert.equal(output.revisedXml,source);assert.equal(output.receipt.selectedCount,0);
 assert.equal(output.receipt.sourceChanged,false);assert.equal(output.receipt.kilogramsAccepted,false);
 assert.equal(output.receipt.nativeCiiReleaseAuthorized,false);assert.equal(JSON.stringify(input),before);
});

test('one explicit model changes only its second endpoint and preserves BOM, comments and CRLF',async()=>{
 const output=await createXml229InstrumentSourceRevision(await request({selectedOwners:['[0,1]']}));
 const expected=source.replace(node('A',2,305),node('A',2,305).replace('</Node>','<Rigid>2</Rigid></Node>'));
 assert.equal(output.revisedXml,expected);assert.equal(output.receipt.selectedCount,1);
 assert.equal(output.receipt.remainingBlockedOwners,1);
 assert.equal(output.receipt.newSourceXmlSha256,await digestUtf8(expected));
 assert.notEqual(output.receipt.newSourceXmlSha256,output.receipt.oldSourceXmlSha256);
 assert.equal(output.receipt.reusablePreviousWeightReview,false);
 assert.equal(output.receipt.engineeringApprovalVerified,false);
});

test('browser revision bytes agree with independent Python expat source revision',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'instrument-ui-'));
 try{
  const original=join(dir,'source.xml'),manifest=join(dir,'choices.json'),revised=join(dir,'new.xml');
  await writeFile(original,source);
  const script=new URL('../converters/scripts/xml229_instrument_source_revision.py',import.meta.url).pathname;
  execFileSync('python3',[script,'inspect','--source',original,'--manifest',manifest]);
  const choices=JSON.parse(await readFile(manifest,'utf8'));choices.components[0].classification='RIGID';
  await writeFile(manifest,JSON.stringify(choices));
  execFileSync('python3',[script,'apply','--source',original,'--manifest',manifest,
   '--revised-source',revised,'--receipt',join(dir,'receipt.json')]);
  const output=await createXml229InstrumentSourceRevision(await request({selectedOwners:['[0,1]']}));
  assert.deepEqual(Buffer.from(output.revisedXml),await readFile(revised));
  assert.deepEqual(await readFile(original),Buffer.from(source));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('source hash, duplicate owners and stale ref/ordinal/span fail closed',async()=>{
 const input=await request();
 await assert.rejects(()=>inspectXml229InstrumentSourceReview({...input,sourceText:source+' '}),/SHA_MISMATCH/);
 for(const patch of [{componentRefNo:'other'},{sourceNodeOrdinal:2},{spanMm:304},
  {branchOccurrenceIndex:1},{componentType:'VALV'},{reason:'other'}]){
  await assert.rejects(()=>inspectXml229InstrumentSourceReview({...input,report:{...input.report,
   unsupportedOwners:[{...owner(1,'A'),...patch}]}}));
 }
 await assert.rejects(()=>inspectXml229InstrumentSourceReview({...input,report:{...input.report,
  unsupportedOwners:[owner(1,'A'),owner(1,'A')]}}),/DUPLICATE/);
 for(const selectedOwners of [['[0,2]'],['[0,1]','[0,1]'],[{}]])
  await assert.rejects(()=>createXml229InstrumentSourceRevision({...input,selectedOwners}),/SELECTION_INVALID/);
});

test('existing or ambiguous source classifications and wrong endpoints are not overwritten',async()=>{
 for(const change of [s=>s.replace('<Endpoint>2</Endpoint>','<Endpoint>1</Endpoint>'),
  s=>s.replace('</Position>','</Position><Rigid/>'),
  s=>s.replace('</Position>','</Position><Position>1 2 3</Position>')]){
  const sourceText=change(source);
  await assert.rejects(async()=>inspectXml229InstrumentSourceReview({sourceText,report:await reportFor(sourceText)}));
 }
});

test('source offset scanner skips comments, CDATA, PI and quoted delimiters',()=>{
 const xml='<PipeStressExport><!-- <Branch><Node></Node></Branch> -->'+
  '<Branch><Node quoted=">"/><x:Node><Note><![CDATA[</Node><Branch>]]></Note>'+ 
  '<?hint value="</Node>"?></x:Node></Branch></PipeStressExport>';
 const positions=xml229InstrumentNodeClosings(xml);
 assert.equal(positions.size,2);assert.equal(positions.get('[0,0]').offset,null);
 assert.equal(positions.get('[0,1]').offset,xml.indexOf('</x:Node>'));
 assert.throws(()=>xml229InstrumentNodeClosings('<!DOCTYPE x><PipeStressExport/>'),/STRUCTURE_INVALID/);
 assert.throws(()=>xml229InstrumentNodeClosings('<a><b></a>'),/STRUCTURE_INVALID/);
});

test('new source cannot borrow the old report and remaining model is still held',async()=>{
 const out=await createXml229InstrumentSourceRevision(await request({selectedOwners:['[0,1]']}));
 await assert.rejects(async()=>inspectXml229InstrumentSourceReview(await request({sourceText:out.revisedXml})),/SHA_MISMATCH/);
 const next=await inspectXml229InstrumentSourceReview({sourceText:out.revisedXml,
  report:await reportFor(out.revisedXml,[owner(3,'B')])});
 assert.equal(next.rows.length,1);assert.equal(next.rows[0].componentRefNo,'B');
});

test('root and published modules are byte identical and Run exposes deliberate review',async()=>{
 for(const rel of ['integration/xml229-instrument-source-offsets.mjs','integration/xml229-instrument-source-review.mjs',
  'ui-adapted/xml229-instrument-source-review-ui.mjs','ui-adapted/xml-cii-adapted-output-run.js']){
  const path='tabs/xml-cii-2019-standalone/'+rel;
  assert.deepEqual(await readFile(new URL('../'+path,import.meta.url)),
   await readFile(new URL('../docs/'+path,import.meta.url)));
 }
 const run=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 assert.match(run,/audit\.appendChild\(createXml229InstrumentSourceReviewControl/);
});
