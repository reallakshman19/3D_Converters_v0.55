import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reconcileXml229ActualCiiAgainstFinal}
 from '../converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs';

const sha=t=>createHash('sha256').update(t).digest('hex');
const xml='<PipeStressExport><Pipe><Branch><Branchname>BR-1</Branchname>'+
  '<Node><NodeNumber>20</NodeNumber><ComponentType>RIGID</ComponentType>'+
  '<NodeName>WGT</NodeName><ComponentRefNo>REF-1</ComponentRefNo>'+
  '<Endpoint>2</Endpoint><Rigid>2</Rigid><Position>5 0 0</Position>'+
  '<Weight>0</Weight></Node></Branch></Pipe></PipeStressExport>';
const oid=JSON.stringify(['SRC',0,0,JSON.stringify(['RIGID','REF-1','2','WGT'])]);
function cii({mass='125',pointer='1',units='N.'}={}){
 const rows=['10 20 0 0 0 0',...Array(11).fill('0 0 0 0 0 0'),
   '0 '+pointer+' 0 0 0 0','0 0 0 0 0 0','0 0 0'];
 return '#$ CONTROL\n1 0 0 0 0 0\n0 1 0 0 0 0\n0 0 0 0 0 0\n0\n'+
  '#$ ELEMENTS\n'+rows.join('\n')+'\n#$ RIGID\n'+mass+' 0\n#$ UNITS\n'+units+'\n';
}
function bundle(text=cii()){
 const packet={schema:'XML229.NativeFinalPhysicalPacket.v1',
  sourceId:'SRC',basisId:'a'.repeat(64),finalIntentSha256:'b'.repeat(64),
  sourceXmlSha256:sha(xml),physicalCount:1,
  components:[{occurrenceId:oid,effectiveKg:12.5}],
  nativeCiiReleaseAuthorized:false};
 const writerDiagnostic={schema:'XML229.NativeRigidConsumptionDiagnostic.v1',
  sourcePhysicalCount:1,claimedNativeRigidCount:1,
  nativeCiiReleaseAuthorized:false,massesConsumedInNativeRigid:true,
  actualCiiSha256:sha(text),
  claims:[{occurrenceId:oid,rigidRecordIndex:0,nativeElementIndex:0,
    ciiFromNode:'10',ciiToNode:'20',massKg:12.5,
    branchOccurrenceIndex:0,engineNodeOrdinal:0}]};
 return {originalXmlText:xml,packet,ciiText:text,writerDiagnostic};
}
test('independent byte parser reconciles accepted kg and authorizes strict native output',async()=>{
 const proof=await reconcileXml229ActualCiiAgainstFinal(bundle());
 assert.equal(proof.massConsumptionVerified,true);
 assert.equal(proof.strictOneToOneOwnerMatch,true);
 assert.equal(proof.nativeCiiReleaseAuthorized,true);
 assert.equal(proof.nativeRigidCount,1);
 assert.equal(proof.physicalCount,1);
 assert.equal(proof.actualCiiSha256,sha(cii()));
});
test('fixed-width signed scientific coordinates retain all six fields',async()=>{
 for(const value of ['-1.000000E-02','-1.000000E-07','-1.000000E+12']){
  for(let axis=0;axis<3;axis++){
   const values=['10','20','0','0','0','26.7'];values[2+axis]=value;
   const first=values.map((v,i)=>v.padStart(i?13:15)).join('');
   assert.equal(first.length,80);assert(first.trim().split(/\s+/).length<6);
   const b=bundle(cii().replace('10 20 0 0 0 0',first));
   assert.equal((await reconcileXml229ActualCiiAgainstFinal(b)).nativeCiiReleaseAuthorized,true);
  }
 }
});
test('malformed fixed columns cannot be rescued by whitespace tokenization',async()=>{
 const values=['10','20','-1.000000E-02','0','0','26.7'];
 const first=values.map((v,i)=>v.padStart(i?13:15)).join('');
 for(const bad of [first+'7',first.replace('-1.000000E-02','-1.000000E+100'),
  first.replace('-1.000000E-02','-1.000000E+XX'),
  first.slice(0,28)+' '.repeat(13)+first.slice(41),
  first.slice(0,28)+'1 2'.padStart(13)+first.slice(41),
  first.slice(0,28)+'NaN'.padStart(13)+first.slice(41)]){
  await assert.rejects(reconcileXml229ActualCiiAgainstFinal(
   bundle(cii().replace('10 20 0 0 0 0',bad))));
 }
});
test('tampered emitted mass, pointer, force units, or native element ancestry fail closed',async()=>{
 for(const [text,code] of [
  [cii({mass:'130'}),'NATIVE_CII_MASS_CONSUMPTION_MISMATCH'],
  [cii({pointer:'0'}),'CII_RIGID_ORPHAN'],
  [cii({units:'KG.'}),'CII_FORCE_UNIT_UNVERIFIED'],
 ]){
  await assert.rejects(reconcileXml229ActualCiiAgainstFinal(bundle(text)),{code});
 }
 const altered=bundle();
 altered.writerDiagnostic.claims[0].ciiToNode='999';
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(altered),
  {code:'NATIVE_CII_ELEMENT_RIGID_LINEAGE_MISMATCH'});
 const wrong=bundle();
 wrong.packet.components[0].effectiveKg=11;
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(wrong),
  {code:'NATIVE_OUTPUT_PHYSICAL_OWNERSHIP_DRIFT'});
 const raw=bundle();
 raw.originalXmlText=raw.originalXmlText.replace('REF-1','REF-2');
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(raw),
  {code:'NATIVE_SOURCE_XML_SHA_DRIFT'});
});
test('scientific formatter matches seven significant digits and rejects nearby wrong output',async()=>{
 const tiny=bundle(cii({mass:'1.234567E-07'}));
 tiny.packet.components[0].effectiveKg=0.00000001234567;
 tiny.writerDiagnostic.claims[0].massKg=tiny.packet.components[0].effectiveKg;
 const proof=await reconcileXml229ActualCiiAgainstFinal(tiny);
 assert.equal(proof.nativeCiiReleaseAuthorized,true);
 const altered=bundle(cii({mass:'1.234568E-07'}));
 altered.packet.components[0].effectiveKg=tiny.packet.components[0].effectiveKg;
 altered.writerDiagnostic.claims[0].massKg=tiny.packet.components[0].effectiveKg;
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(altered),
   {code:'NATIVE_CII_MASS_CONSUMPTION_MISMATCH'});
 const huge=bundle(cii({mass:'1.234568E+09'}));
 huge.packet.components[0].effectiveKg=123456780;
 huge.writerDiagnostic.claims[0].massKg=123456780;
 assert.equal((await reconcileXml229ActualCiiAgainstFinal(huge)).nativeCiiReleaseAuthorized,true);
});

test('accepted zero consumes real pointed CII RIGID; absent and mismatched masses reject',async()=>{
 const zero=bundle(cii({mass:'0'}));
 zero.packet.components[0].effectiveKg=0;
 zero.writerDiagnostic.claims[0].massKg=0;
 const proof=await reconcileXml229ActualCiiAgainstFinal(zero);
 assert.equal(proof.nativeCiiReleaseAuthorized,true);
 const changed=bundle(cii({mass:'1'}));
 changed.packet.components[0].effectiveKg=0;
 changed.writerDiagnostic.claims[0].massKg=0;
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(changed),
  {code:'NATIVE_CII_MASS_CONSUMPTION_MISMATCH'});
 const missing=bundle();
 missing.packet.components[0].effectiveKg=null;
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(missing),
  {code:'NATIVE_FINAL_COMPONENT_INVALID'});
 const forged=bundle();
 forged.writerDiagnostic.nativeCiiReleaseAuthorized=true;
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(forged),
  {code:'NATIVE_WRITER_PROOF_CUSTODY_INVALID'});
 const original=bundle();
 original.writerDiagnostic.actualCiiSha256='a'.repeat(64);
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(original),
  {code:'NATIVE_WRITER_PROOF_CUSTODY_INVALID'});
});

test('explicit zero INST uses one non-rigid CII element without making it RIGID',async()=>{
 const source='<PipeStressExport><Pipe><Branch><Branchname>INST</Branchname>'+
  '<Node><ComponentType>INST</ComponentType><ComponentRefNo>=X</ComponentRefNo>'+
  '<Endpoint>1</Endpoint><Position>0 0 0</Position></Node>'+
  '<Node><ComponentType>INST</ComponentType><ComponentRefNo>=X</ComponentRefNo>'+
  '<Endpoint>2</Endpoint><Position>305 0 0</Position><Weight>0</Weight></Node>'+
  '</Branch></Pipe></PipeStressExport>';
 const id=JSON.stringify(['SRC',0,1,JSON.stringify(['INST','=X','2',''])]);
 const element=['10 20 0 0 0 0',...Array(11).fill('0 0 0 0 0 0'),
   '0 0 0 0 0 0','0 0 0 0 0 0','0 0 0'];
 const unweighted='#$ CONTROL\n1 0 0 0 0 0\n0 0 0 0 0 0\n0 0 0 0 0 0\n0\n'+
  '#$ ELEMENTS\n'+element.join('\n')+'\n#$ RIGID\n#$ UNITS\nN.\n';
 const pkg={
  originalXmlText:source,ciiText:unweighted,
  packet:{
   schema:'XML229.NativeFinalPhysicalPacket.v1',
   sourceId:'SRC',basisId:'a'.repeat(64),finalIntentSha256:'b'.repeat(64),
   sourceXmlSha256:sha(source),physicalCount:1,
   components:[{occurrenceId:id,effectiveKg:0}],
   nativeCiiReleaseAuthorized:false,
  },
  writerDiagnostic:{
   schema:'XML229.NativeRigidConsumptionDiagnostic.v1',
   sourcePhysicalCount:1,claimedNativeRigidCount:0,
   claimedZeroNonRigidInstrumentCount:1,
   nativeCiiReleaseAuthorized:false,massesConsumedInNativeRigid:true,
   actualCiiSha256:sha(unweighted),
   claims:[{occurrenceId:id,rigidRecordIndex:null,nativeElementIndex:0,
    ciiFromNode:'10',ciiToNode:'20',massKg:0,emittedForceN:0,
    zeroNonRigidInstrument:true,branchOccurrenceIndex:0,engineNodeOrdinal:1}],
  },
 };
 const ok=await reconcileXml229ActualCiiAgainstFinal(pkg);
 assert.equal(ok.zeroNonRigidInstrumentCount,1);
 assert.equal(ok.nativeCiiReleaseAuthorized,true);
 pkg.packet.components[0].effectiveKg=5;
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(pkg),
  {code:'NATIVE_OUTPUT_PHYSICAL_OWNERSHIP_DRIFT'});
 pkg.packet.components[0].effectiveKg=0;
 pkg.writerDiagnostic.claims[0].ciiToNode='999';
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(pkg),
  {code:'NATIVE_ZERO_INSTRUMENT_OUTPUT_NOT_VERIFIED'});
 pkg.writerDiagnostic.claims[0].ciiToNode='20';
 pkg.writerDiagnostic.claimedZeroNonRigidInstrumentCount=0;
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(pkg),
  {code:'NATIVE_WRITER_PROOF_CUSTODY_INVALID'});
});

// A second real pointer-referenced RIGID without a source Final owner.
function ciiWithUnclaimedRigid(force){
 const standard=cii();
 const element=standard.split('#$ ELEMENTS\n')[1].split('#$ RIGID\n')[0];
 const second=element.replace(/^10 20 /,'30 40 ')
   .replace(/^0 1 0 0 0 0$/m,'0 2 0 0 0 0');
 return standard.replace('#$ CONTROL\n1 0','#$ CONTROL\n2 0')
   .replace('\n0 1 0 0 0 0\n','\n0 2 0 0 0 0\n')
   .replace('#$ RIGID\n',second+'#$ RIGID\n')
   .replace('#$ RIGID\n125 0\n','#$ RIGID\n125 0\n'+force+' 0\n');
}
test('independent CII forbids any unclaimed nonzero pointer-referenced RIGID mass',async()=>{
 for(const force of ['5.000000E-07','5.000000E-03','1']){
  const b=bundle(ciiWithUnclaimedRigid(force));
  await assert.rejects(reconcileXml229ActualCiiAgainstFinal(b),
   {code:'NATIVE_CII_UNCLAIMED_WEIGHT'});
 }
 const zero=bundle(ciiWithUnclaimedRigid('0'));
 assert.equal((await reconcileXml229ActualCiiAgainstFinal(zero)).nativeCiiReleaseAuthorized,true);
 const negative=bundle(ciiWithUnclaimedRigid('-5.000000E-07'));
 await assert.rejects(reconcileXml229ActualCiiAgainstFinal(negative),
   {code:'CII_RIGID_MASS_INVALID'});
});

