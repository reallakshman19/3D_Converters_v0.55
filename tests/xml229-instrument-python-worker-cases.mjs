/** Actual Python-generated instrument XML -> source-attested JS Worker checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {requireXml229NativeOwnerPreflight}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-owner-preflight.mjs';
import {reconcileXml229ActualCiiAgainstFinal}
 from '../converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs';
const python=process.env.PYTHON||(process.platform==='win32'?'python':'python3');

export function registerXml229PythonWorkerRevisionTests({XML,SOURCE_ID,masters,selection,config,live,fixture,projectXmlCiiOccurrences,createPreviewBasis,digestUtf8,xmlCiiDryRunPreview,openXml229EngineeringFactModel}){
test('optional Python source revisions are accepted by actual Preview Worker without implicit kg',async()=>{
 // Two separate adjacent INST 1->2 pairs use the same source model as the
 // verified engineering producer. This runs the real companion CLI and the
 // real JS fact producer, not duplicate suggestion predicates.
 const onePair=XML.replace('<ComponentType>VALV</ComponentType>',
                           '<ComponentType>INST</ComponentType>')
  .replace('<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>2</Endpoint>',
           '<ComponentRefNo>1006649732/119369</ComponentRefNo><Endpoint>1</Endpoint>');
 assert.notEqual(onePair,XML);
 const secondPair='\n<Node><NodeNumber>330</NodeNumber><ComponentType>INST</ComponentType>'+
  '<ComponentRefNo>1006649732/119370</ComponentRefNo><Endpoint>1</Endpoint>'+
  '<Position>700 0 0</Position><Weight>0</Weight></Node>'+
  '\n<Node><NodeNumber>340</NodeNumber><ComponentType>INST</ComponentType>'+
  '<ComponentRefNo>1006649732/119370</ComponentRefNo><Endpoint>2</Endpoint>'+
  '<Position>830 0 0</Position><Weight>0</Weight></Node>\n';
 // Use pipe context and two instruments; each accepted test mass then
 // belongs to one of the instrument spans under examination.
 const original=onePair.replace('<ComponentType>GASK</ComponentType>',
  '<ComponentType>PIPE</ComponentType>')
  .replace('<ComponentType>RIGID</ComponentType>','<ComponentType>PIPE</ComponentType>')
  .replace('<Rigid>2</Rigid>','')
  .replace('</Branch>',secondPair+'</Branch>');
 assert.notEqual(original,onePair);
 const dir=await mkdtemp(join(tmpdir(),'xml229-instrument-worker-'));
 try{
  const py=fileURLToPath(new URL(
   '../converters/scripts/xml229_instrument_source_revision.py',import.meta.url));
  const input=join(dir,'original.xml');
  await writeFile(input,original);
  for(const selected of [0,1,2]){
   const manifest=join(dir,'suggestions-'+selected+'.json');
   const revisedPath=join(dir,'revised-'+selected+'.xml');
   const receiptPath=join(dir,'receipt-'+selected+'.json');
   execFileSync(python,[py,'inspect','--source',input,'--manifest',manifest],
    {encoding:'utf8',timeout:30000});
   const choices=JSON.parse(await readFile(manifest,'utf8'));
   assert.equal(choices.components.length,2);
   for(const item of choices.components.slice(0,selected))
    item.classification='RIGID';
   await writeFile(manifest,JSON.stringify(choices));
   execFileSync(python,[py,'apply','--source',input,'--manifest',manifest,
    '--revised-source',revisedPath,'--receipt',receiptPath],
    {encoding:'utf8',timeout:30000});
   const xml=await readFile(revisedPath,'utf8');
   const receipt=JSON.parse(await readFile(receiptPath,'utf8'));
   assert.equal(receipt.selectedCount,selected);
   assert.equal(receipt.remainingSuggestions,2-selected);
   assert.equal(receipt.approvalRequired,false);
   assert.equal(receipt.kilogramsAccepted,false);
   assert.equal(receipt.reusablePreviousWeightReview,selected===0);
   if(!selected)assert.equal(xml,original);
   assert.equal((xml.match(/<Rigid>2<\/Rigid>/g)||[]).length,
    (original.match(/<Rigid>2<\/Rigid>/g)||[]).length+selected);
   const basis=await createPreviewBasis({domainId:'xml-cii/2019',
    sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:xml}],
    masters,selection,config,overrides:{},sha256:digestUtf8});
   const projected=projectXmlCiiOccurrences({xmlText:xml,sourceId:SOURCE_ID});
   const preview=xmlCiiDryRunPreview(xml,config,'');
   const opened=await openXml229EngineeringFactModel({
    basis,live:{...live,sources:{[SOURCE_ID]:xml}},xmlText:xml,
    sourceId:SOURCE_ID,previewResult:{...preview,sourceOccurrences:projected,
     engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
    expectedOriginalCount:projected.branchCount+projected.nodeCount});
   const geometry=opened.finalizedGeometry;
   assert.equal(geometry.instrumentModelingSuggestions.length,0);
   assert.equal(geometry.rigidEdgePromotions.length,2-selected,
    'Worker classifies only instrument spans not already rigid in source');
   assert.equal(geometry.physicalOwnerCardinality.weightsAccepted,false);
   assert.equal(geometry.sourceXmlSha256,basis.sourceRefs[0].sha256);
   const facts=await opened.model.getFacts({basisId:basis.basisId,
    subjectType:'physical-component',limit:100});
   const mass=facts.items.filter(row=>row.fieldId==='mass.kg');
   assert.equal(mass.length,2,'two instrument mass owners');
   assert(mass.every(row=>row.value===null&&row.authority==='unresolved'),
    'source zero kg must not become accepted mass on selecting Rigid');
   if(selected===0||selected===2){
    // Synthetic Final masses test the real native writer and the separate
    // emitted-CII checker; these are not accepted Owner engineering weights.
    const packet={schema:'XML229.NativeFinalPhysicalPacket.v1',sourceId:SOURCE_ID,
     nativeCiiReleaseAuthorized:false,
     sourceGenerationId:'synthetic-inst-worker-test',
     sourceXmlSha256:await digestUtf8(xml),basisId:basis.basisId,
     finalIntentSha256:await digestUtf8('synthetic-inst-test'),
     physicalCount:opened.physicalOccurrences.length,finalizedGeometry:geometry,
     components:opened.physicalOccurrences.map((row,i)=>({
      occurrenceId:row.occurrenceId,effectiveKg:i===1?0:12.5+i})),
    };
    assert.equal(requireXml229NativeOwnerPreflight(packet).unsupportedOwners.length,0);
    const packetPath=join(dir,'packet-'+selected+'.json');
    const ciiPath=join(dir,'native-'+selected+'.cii');
    const proofPath=join(dir,'native-'+selected+'.json');
    await writeFile(packetPath,JSON.stringify(packet));
    const runner=fileURLToPath(new URL(
     '../converters/scripts/xml_to_cii2019_runtime_custody.py',import.meta.url));
    execFileSync(python,[runner,'--input',revisedPath,'--output',ciiPath,
     '--weight-scale','10','--xml229-native-final-packet',packetPath,
     '--xml229-native-mass-proof',proofPath],{encoding:'utf8',timeout:30000});
    const ciiText=await readFile(ciiPath,'utf8');
    const diagnostic=JSON.parse(await readFile(proofPath,'utf8'));
    const verified=await reconcileXml229ActualCiiAgainstFinal({
     originalXmlText:xml,packet,ciiText,writerDiagnostic:diagnostic});
    assert.equal(verified.massConsumptionVerified,true);
    assert.equal(verified.physicalCount,2);
    assert.equal(verified.strictOneToOneOwnerMatch,true);
    assert.equal(diagnostic.claimedNativeRigidCount,2);
   }
  }
 }finally{
  await rm(dir,{recursive:true,force:true});
 }
});

test('real 41-branch EF-05 Python 0/1/3/14 selections reconcile with JavaScript Worker',async()=>{
 // Actual public source, no fabricated engineering evidence or accepted kg.
 // Retest each new source revision as a NEW GC-PW basis (no old review reuse).
 const originalPath=fileURLToPath(new URL('../Benchmarks/EF-05-PRO.TEST.xml',import.meta.url));
 const originalBytes=await readFile(originalPath);
 const originalXml=originalBytes.toString('utf8');
 assert(originalXml.startsWith('\ufeff'));
 assert(originalXml.includes('<!-- Configuration information -->'));
 const cli=fileURLToPath(new URL(
  '../converters/scripts/xml229_instrument_source_revision.py',import.meta.url));
 const workspace=await mkdtemp(join(tmpdir(),'xml229-ef05-real-worker-'));
 try{
  const planPath=join(workspace,'all-pending.json');
  execFileSync(python,[cli,'inspect','--source',originalPath,'--manifest',planPath],
   {encoding:'utf8',timeout:30000});
  const pending=JSON.parse(await readFile(planPath,'utf8'));
  assert.equal(pending.components.length,14);
  const originalTokens=(originalXml.match(/<Rigid>2<\/Rigid>/g)||[]).length;
  for(const count of [0,1,3,14]){
   const manifest=join(workspace,'review-'+count+'.json');
   const revision=join(workspace,'source-'+count+'.xml');
   const receiptPath=join(workspace,'receipt-'+count+'.json');
   const choices=structuredClone(pending);
   for(const row of choices.components.slice(0,count))
    row.classification='RIGID';
   await writeFile(manifest,JSON.stringify(choices));
   execFileSync(python,[cli,'apply','--source',originalPath,
    '--manifest',manifest,'--revised-source',revision,'--receipt',receiptPath],
    {encoding:'utf8',timeout:30000});
   const revisedBytes=await readFile(revision);
   const xmlText=revisedBytes.toString('utf8');
   const receipt=JSON.parse(await readFile(receiptPath,'utf8'));
   assert.equal(receipt.selectedCount,count);
   assert.equal(receipt.remainingSuggestions,14-count);
   assert.equal(receipt.sourceChanged,count>0);
   assert.equal(receipt.reusablePreviousWeightReview,count===0);
   assert.equal(receipt.kilogramsAccepted,false);
   assert.equal(receipt.engineeringApprovalVerified,false);
   assert(revisedBytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf])));
   assert(xmlText.includes('<!-- Configuration information -->'));
   assert.equal((xmlText.match(/<Rigid>2<\/Rigid>/g)||[]).length,
    originalTokens+count);
   if(count===0)assert(revisedBytes.equals(originalBytes),
    'all 14 pending means no original XML byte changes');
   assert((await readFile(originalPath)).equals(originalBytes),
    'source must never be overwritten');
   // Fresh SHA-bound Preview / fact model on each *actual* revised source.
   const originalProjection=projectXmlCiiOccurrences({
    xmlText,sourceId:SOURCE_ID});
   const newBasis=await createPreviewBasis({domainId:'xml-cii/2019',
    sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:xmlText}],
    masters,selection,config,overrides:{},sha256:digestUtf8});
   const preview=xmlCiiDryRunPreview(xmlText,config,'');
   const opened=await openXml229EngineeringFactModel({
    basis:newBasis,live:{...live,sources:{[SOURCE_ID]:xmlText}},
    xmlText,sourceId:SOURCE_ID,previewResult:{
     ...preview,sourceOccurrences:originalProjection,
     engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
    expectedOriginalCount:
     originalProjection.branchCount+originalProjection.nodeCount});
   const g=opened.finalizedGeometry;
   assert.equal(originalProjection.branchCount,41);
   assert.equal(g.instrumentModelingSuggestions.length,0);
   assert.equal(g.rigidEdgePromotions.filter(x=>x.componentType==='INST').length,
    14-count,'all remaining INST spans are classified before Final');
   assert.equal(g.physicalOwnerCardinality.weightsAccepted,false);
   assert.equal(g.basisId,newBasis.basisId);
   assert.equal(g.sourceXmlSha256,newBasis.sourceRefs[0].sha256);
   // Remaining identities must match the original manifest, even across
   // the separately serialized, ordinal-preserving Worker Preview document.
   const expected=new Set(choices.components.slice(count).map(x=>
    JSON.stringify([x.branchOccurrenceIndex,x.endSourceNodeOrdinal,
     x.componentRefNo.replace(/^=/,'').replace(/\s+/g,'').toUpperCase()])));
   const observed=new Set(g.rigidEdgePromotions.filter(x=>x.componentType==='INST').map(x=>
    JSON.stringify([x.branchOccurrenceIndex,x.secondSourceNodeOrdinal,
     x.componentRefNo])));
   assert.deepEqual(observed,expected);
   // Instrument source Weight 0 is not an accepted mass; extracting the
   // originating physical facts is not a Final decision or CII release.
   // The fact-read contract caps each page at 200; verify the complete
   // full-source population through authenticated opaque-cursor paging.
   let cursor=null,pages=0;
   const mass=[];
   do{
    const page=await opened.model.getFacts({basisId:newBasis.basisId,
     subjectType:'physical-component',fieldId:'mass.kg',limit:200,cursor});
    assert.equal(page.complete,true);
    mass.push(...page.items);
    cursor=page.nextCursor;
    pages++;
    assert(pages<=10,'Full-source mass pages did not terminate');
   }while(cursor!==null);
   assert.equal(mass.length,g.physicalOwnerCardinality.distinctPhysicalPartCandidates);
   assert(mass.every(x=>x.authority==='source'||x.authority==='unresolved'));
  }
 }finally{
  await rm(workspace,{recursive:true,force:true});
 }
});

}
