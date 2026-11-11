/**
 * XML229: independent CII output-byte mass verification.
 * Own parser; never trusts the converter's "success" boolean, suggested kg,
 * source-row labels or a cache. The Python writer's physical-to-native claim
 * is only a locator to challenge against emitted CONTROL/ELEMENTS/RIGID bytes.
 *
 * Supports positive and explicitly confirmed zero kg on a strict 1:1
 * physical-to-native RIGID mapping. Splits/ambiguous owners fail closed.
 */
import {decodePhysicalOccurrenceId} from '../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {digestUtf8} from '../../contracts/gc-pw-v1/contract.mjs';

const fail=(code,msg=code)=>{const e=new Error(msg);e.code=code;throw e;};
const int=n=>Number.isSafeInteger(n)&&n>=0;
const mass=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const digest=n=>typeof n==='string'&&/^[a-f0-9]{64}$/i.test(n);
function sections(cii){
 const byName=new Map();let current=null;
 for(const line of cii.split(/\r?\n/)){
  if(line.startsWith('#$ ')){
   current=line.slice(3).trim();
   if(!current||byName.has(current))fail('CII_SECTION_DUPLICATE');
   byName.set(current,[]);
  }else if(current&&line.trim())byName.get(current).push(line);
  else if(!current&&line.trim())fail('CII_PREAMBLE');
 }
 for(const name of ['CONTROL','ELEMENTS','RIGID','UNITS'])
  if(!byName.has(name))fail('CII_REQUIRED_SECTION_MISSING');
 if(!byName.get('UNITS').some(v=>v.trim()==='N.'))
  fail('CII_FORCE_UNIT_UNVERIFIED');
 return byName;
}
function exactInteger(value){
 if(!/^\d+$/.test(String(value)))fail('CII_INTEGER_INVALID');
 const n=Number(value);
 if(!int(n))fail('CII_INTEGER_INVALID');
 return n;
}
function numericElementFields(line){
 if(line.length>80)fail('CII_ELEMENT_ROW_INVALID');
 // Native records concatenate one 15-column field and five 13-column fields.
 // A negative scientific number can fill its field without leading whitespace.
 const fields=line.length===80
  ?[line.slice(0,15).trim(),...Array.from({length:5},(_,i)=>
     line.slice(15+13*i,28+13*i).trim())]
  :line.trim().split(/\s+/);
 const number=/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[Ee][+-]?[0-9]+)?$/;
 if(fields.length!==6||fields.some(field=>!number.test(field)||
    !Number.isFinite(Number(field))))fail('CII_ELEMENT_ROW_INVALID');
 return fields;
}
function parseNativeCii(cii){
 if(typeof cii!=='string'||!cii.trim())fail('CII_BYTES_REQUIRED');
 const s=sections(cii),control=s.get('CONTROL');
 if(control.length!==4)fail('CII_CONTROL_INVALID');
 const first=control[0].trim().split(/\s+/),second=control[1].trim().split(/\s+/);
 if(first.length!==6||second.length!==6)fail('CII_CONTROL_INVALID');
 const elementCount=exactInteger(first[0]),rigidCount=exactInteger(second[1]);
 const elements=s.get('ELEMENTS'),rigid=s.get('RIGID');
 if(elements.length!==elementCount*15||rigid.length!==rigidCount)
  fail('CII_RECORD_POPULATION_DRIFT');
 const slots=new Map(),weights=[],elementOwners=[];
 for(let i=0;i<elementCount;i++){
  const row1=numericElementFields(elements[i*15]);
  const row13=numericElementFields(elements[i*15+12]);
  const p=exactInteger(row13[1]);
  elementOwners.push({from:row1[0],to:row1[1],rigidPointer:p});
  if(p>rigidCount)fail('CII_RIGID_POINTER_OUT_OF_RANGE');
  if(p){
   if(slots.has(p-1))fail('CII_RIGID_POINTER_DUPLICATE');
   slots.set(p-1,{element:i,from:row1[0],to:row1[1]});
  }
 }
 if(slots.size!==rigidCount)fail('CII_RIGID_ORPHAN');
 for(const record of rigid){
  const fields=record.trim().split(/\s+/);
  if(fields.length!==2)fail('CII_RIGID_RECORD_INVALID');
  const nums=fields.map(Number);
  if(nums.some(n=>!Number.isFinite(n)||n<0))fail('CII_RIGID_MASS_INVALID');
  weights.push(nums[0]);
 }
 return {slots,weights,elementOwners,elementCount,rigidCount};
}
function sameNativeFormattedMass(expected,actual){
 if(!mass(expected)||!Number.isFinite(actual))return false;
 // Mirror xml_to_cii2019.py::_format_auto_float exactly by magnitude:
 // .6E = seven significant digits, #.6G = six; <1e-12 emits zero.
 const magnitude=Math.abs(expected);
 const output=magnitude<1e-12?0:
   magnitude>=1e9||magnitude<0.1
     ?Number(expected.toExponential(6)):Number(expected.toPrecision(6));
 // A tiny positive approved mass must not disappear as a zero output.
 return !(expected>0&&output===0)&&actual===output;
}
/**
 * @param {Object} input
 * @param {string} input.originalXmlText exact original XML for SHA custody
 * @param {Object} input.packet current Worker-produced Final packet
 * @param {string} input.ciiText ACTUAL native converter output, not preview
 * @param {Object} input.writerDiagnostic native Python per-owner claims
 */
export async function reconcileXml229ActualCiiAgainstFinal({
 originalXmlText,packet,ciiText,writerDiagnostic,
}={}){
 if(packet?.schema!=='XML229.NativeFinalPhysicalPacket.v1'||
    !digest(packet?.basisId)||!digest(packet?.finalIntentSha256)||
    !digest(packet?.sourceXmlSha256)||packet?.nativeCiiReleaseAuthorized!==false||
    !Array.isArray(packet?.components)||!int(packet.physicalCount)||
    packet.physicalCount!==packet.components.length||packet.physicalCount<1)
  fail('NATIVE_FINAL_PACKET_INVALID');
 if(typeof originalXmlText!=='string'||typeof ciiText!=='string')
  fail('NATIVE_ARTIFACT_BYTES_REQUIRED');
 // Independently attest the Worker-committed cleaned XML bytes before
 // trusting any converter-owned mass proof or output.
 const final=packet.finalizedGeometry;
 if(packet.sourceGenerationId){
  if(final?.schema!=='XML229.FinalizedWeightGeometry.v1'||
     final?.basisId!==packet.basisId||
     final?.sourceXmlSha256!==packet.sourceXmlSha256||
     !digest(final?.sha256)||typeof final?.xmlText!=='string'||
     await digestUtf8(final.xmlText)!==final.sha256)
   fail('NATIVE_FINALIZED_GEOMETRY_SHA_DRIFT');
 }
 if(await digestUtf8(originalXmlText)!==packet.sourceXmlSha256)
  fail('NATIVE_SOURCE_XML_SHA_DRIFT');
 const ciiSha=await digestUtf8(ciiText);
 if(writerDiagnostic?.schema!=='XML229.NativeRigidConsumptionDiagnostic.v1'||
    writerDiagnostic?.nativeCiiReleaseAuthorized!==false||
    writerDiagnostic?.actualCiiSha256!==ciiSha||
    (final?.sha256&&writerDiagnostic?.finalizedGeometrySha256!==final.sha256)||
    writerDiagnostic?.massesConsumedInNativeRigid!==true||
    writerDiagnostic?.sourcePhysicalCount!==packet.physicalCount||
    !int(writerDiagnostic?.claimedNativeRigidCount)||
    (writerDiagnostic?.claimedZeroNonRigidInstrumentCount === undefined
      ? writerDiagnostic?.claimedNativeRigidCount !== packet.physicalCount
      : !int(writerDiagnostic.claimedZeroNonRigidInstrumentCount) ||
        writerDiagnostic.claimedNativeRigidCount +
        writerDiagnostic.claimedZeroNonRigidInstrumentCount !== packet.physicalCount)||
    !Array.isArray(writerDiagnostic.claims)||
    writerDiagnostic.claims.length!==packet.physicalCount)
  fail('NATIVE_WRITER_PROOF_CUSTODY_INVALID');
 const parsed=parseNativeCii(ciiText),claims=new Map();
 const claimedRigid=new Set(),claimedElements=new Set();
 let verifiedZeroInstrumentCount=0;
 for(const claim of writerDiagnostic.claims){
  if(!claim||typeof claim.occurrenceId!=='string'||claims.has(claim.occurrenceId)||
     !(claim.zeroNonRigidInstrument===true && claim.rigidRecordIndex===null ||
       claim.zeroNonRigidInstrument!==true && int(claim.rigidRecordIndex))||
     !int(claim.nativeElementIndex)||
     !int(claim.branchOccurrenceIndex)||!int(claim.engineNodeOrdinal)||
     !mass(claim.massKg)||typeof claim.ciiFromNode!=='string'||
     typeof claim.ciiToNode!=='string')
   fail('NATIVE_CII_LINEAGE_CLAIM_INVALID');
  claims.set(claim.occurrenceId,claim);
 }
 const seen=new Set();
 for(const original of packet.components){
  if(!original||typeof original.occurrenceId!=='string'||!mass(original.effectiveKg)||
     seen.has(original.occurrenceId))
   fail('NATIVE_FINAL_COMPONENT_INVALID');
  seen.add(original.occurrenceId);
  let oid;
  try{oid=decodePhysicalOccurrenceId(original.occurrenceId);}
  catch{fail('NATIVE_FINAL_ORIGINAL_ID_INVALID');}
  if(oid.sourceId!==packet.sourceId)fail('NATIVE_FINAL_SOURCE_ALIAS');
  const claim=claims.get(original.occurrenceId);
  if(!claim||claim.massKg!==original.effectiveKg||
     claim.branchOccurrenceIndex!==oid.branchOccurrenceIndex||
     claimedElements.has(claim.nativeElementIndex))
   fail('NATIVE_OUTPUT_PHYSICAL_OWNERSHIP_DRIFT');
  claimedElements.add(claim.nativeElementIndex);
  if(claim.zeroNonRigidInstrument===true){
    let signature;
    try{signature=JSON.parse(oid.componentSignature);}catch{
      fail('NATIVE_ZERO_INSTRUMENT_SOURCE_ID_INVALID');
    }
    if(original.effectiveKg!==0||!Array.isArray(signature)||
       signature[0]!=='INST'||signature[2]!=='2'||
       claim.rigidRecordIndex!==null||claim.emittedForceN!==0)
      fail('NATIVE_ZERO_INSTRUMENT_NOT_CONFIRMED');
    const actual=parsed.elementOwners[claim.nativeElementIndex];
    if(!actual||actual.from!==claim.ciiFromNode||
       actual.to!==claim.ciiToNode||actual.rigidPointer!==0)
      fail('NATIVE_ZERO_INSTRUMENT_OUTPUT_NOT_VERIFIED');
    verifiedZeroInstrumentCount++;
    continue;
  }
  if(claimedRigid.has(claim.rigidRecordIndex))
    fail('NATIVE_OUTPUT_PHYSICAL_OWNERSHIP_DRIFT');
  claimedRigid.add(claim.rigidRecordIndex);
  const actual=parsed.slots.get(claim.rigidRecordIndex);
  if(!actual||actual.element!==claim.nativeElementIndex||
     actual.from!==claim.ciiFromNode||actual.to!==claim.ciiToNode)
   fail('NATIVE_CII_ELEMENT_RIGID_LINEAGE_MISMATCH');
  if(!sameNativeFormattedMass(original.effectiveKg*10,
     parsed.weights[claim.rigidRecordIndex]))
   fail('NATIVE_CII_MASS_CONSUMPTION_MISMATCH');
 }
 if(seen.size!==packet.physicalCount||claims.size!==packet.physicalCount||
    claimedRigid.size!==writerDiagnostic.claimedNativeRigidCount||
    verifiedZeroInstrumentCount!==(writerDiagnostic.claimedZeroNonRigidInstrumentCount||0))
  fail('NATIVE_OUTPUT_MASS_POPULATION_DRIFT');
 for(let i=0;i<parsed.rigidCount;i++)
  if(!claimedRigid.has(i)&&parsed.weights[i]!==0)
   fail('NATIVE_CII_UNCLAIMED_WEIGHT');
 return Object.freeze({
  schema:'XML229.IndependentActualCiiMassCheck.v1',
  basisId:packet.basisId,finalIntentSha256:packet.finalIntentSha256,
  originalXmlSha256:packet.sourceXmlSha256,actualCiiSha256:ciiSha,
  physicalCount:packet.physicalCount,
  nativeElementCount:parsed.elementCount,nativeRigidCount:parsed.rigidCount,
  zeroNonRigidInstrumentCount:verifiedZeroInstrumentCount,
  massConsumptionVerified:true,
  strictOneToOneOwnerMatch:true,
  splitGeometryIndependentlyVerified:false,
  // Every nonzero mass has one verified RIGID pointer. Explicit Final-zero
  // INST pairs have one source-linked unweighted ELEMENTS row with pointer=0.
  // Neither a missing kg nor an unclassified positive instrument is waived.
  nativeCiiReleaseAuthorized:true,
  status:'STRICT_ONE_TO_ONE_NATIVE_CII_RECONCILED',
 });
}

