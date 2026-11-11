/**
 * XML229 R2-D — OFFLINE, READ-ONLY external physical-to-CII diagnostic log.
 *
 * Consume independently captured receipts, never call the CII converter.
 * A log documents evidence gaps; it CANNOT authorize CII release or mutate
 * GC-PW Match-1 / Final. Any missing lineage or native output slot is HOLD.
 *
 * Security: no XML/JSON source bodies, names of private files, or staged Blob
 * contents are copied into the generated log. Original source identity is
 * represented solely by IDs and SHA-256 receipts provided by the caller.
 */
import {decodePhysicalOccurrenceId} from '../../../contracts/gc-pw-v1/occurrence-bridge.mjs';

export const XML229_EXTERNAL_LOG_SCHEMA='XML229.R2.ExternalDiagnosticLog.v1';
const hashes=/^[a-f0-9]{64}$/i;
const validMass=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
function die(code,message){const e=new Error(message);e.code=code;e.retryable=false;throw e;}
function digestRequired(sha,kind){if(!hashes.test(sha||''))die('INVALID_'+kind+'_SHA256',kind+' SHA-256 is required');}
function exactReceipt(record,schema,kind){
 if(record&&record.schema!==schema)die('INVALID_'+kind+'_SCHEMA','Unexpected '+kind+' receipt schema');
 if(record?.nativeCiiReleaseAuthorized===true)die('FALSE_NATIVE_RELEASE_CLAIM','Read-only evidence cannot authorize CII release');
}
function match(value,expected,kind){if(value!==expected)die('CROSS_BASIS_'+kind,'Evidence does not match current original physical source '+kind);}
function csvCell(v){
 const value=v===undefined||v===null?'':String(v);
 return /[,\n\r"]/.test(value)?'"'+value.replace(/"/g,'""')+'"':value;
}
const COLUMNS=[
 'sourceId','physicalOccurrenceId','branchOccurrenceIndex','originalNodeOrdinal',
 'componentSignature','sourceKg','match1Kg','finalKg','approvedEffectiveKg',
 'engineNodeOrdinal','engineWeightKg','nativeSlot','ciiValue',
 'status','reason','basisId','originalJsonSha256','finalIntentSha256',
 'engineInputSha256','ciiOutputSha256',
];
const field=(row,key)=>row[key]??null;
function toCsv(rows){
 return [COLUMNS.join(','),...rows.map(row=>COLUMNS.map(c=>csvCell(field(row,c))).join(','))].join('\n')+'\n';
}

/** Values are supplied by the independent source census / completed GC-PW
 * reader, not reconstructed from an output CII node number. Even when
 * receipts agree, this reporter can establish *observability*, not the
 * integrity of the producer feeding it; read-only logs are never release.
 */
export async function buildXml229ExternalDiagnosticLog({
 runId,basisId,sourceId,originalJsonSha256,sourceGenerationId,
 originalPhysicalRows,finalIntent=null,engineWitness=null,
 transferManifest=null,nativeSlotReceipt=null,
}={}){
 if(typeof runId!=='string'||!runId.trim()||runId.length>128||
    typeof sourceId!=='string'||!sourceId.trim()||sourceId.length>256||
    typeof sourceGenerationId!=='string'||!sourceGenerationId.trim()||
    !Array.isArray(originalPhysicalRows)||!originalPhysicalRows.length)
   die('ORIGINAL_CENSUS_REQUIRED','Run ID, selected source ID, revision and original physical population required');
 digestRequired(basisId,'BASIS');
 digestRequired(originalJsonSha256,'ORIGINAL_JSON');
 exactReceipt(finalIntent,'XML229.NativeFinalPhysicalIntent.v1','FINAL');
 exactReceipt(engineWitness,'XML229.NativeCiiEngineBoundary.v1','ENGINE');
 exactReceipt(transferManifest,'XML229.R2.OriginalPhysicalEngineInputTransfer.v1','TRANSFER');
 exactReceipt(nativeSlotReceipt,'XML229.R2.NativeRigidSlotAudit.v1','NATIVE_SLOT');

 if(finalIntent){
   match(finalIntent.basisId,basisId,'FINAL_BASIS');
   match(finalIntent.originalJsonSha256,originalJsonSha256,'ORIGINAL_JSON');
   match(finalIntent.sourceGenerationId,sourceGenerationId,'GENERATION');
   if(finalIntent.physicalCount!==originalPhysicalRows.length)
     die('FINAL_CENSUS_MISMATCH','Final physical count differs from the independent original census');
   digestRequired(finalIntent.intentSha256,'FINAL_INTENT');
 }
 if(transferManifest){
   if(!finalIntent)die('TRANSFER_WITHOUT_FINAL_INTENT','An enriched XML transfer requires the complete Final intent');
   match(transferManifest.basisId,basisId,'TRANSFER_BASIS');
   match(transferManifest.originalJsonSha256,originalJsonSha256,'TRANSFER_SOURCE');
   match(transferManifest.sourceGenerationId,sourceGenerationId,'TRANSFER_GENERATION');
   match(transferManifest.finalIntentSha256,finalIntent.intentSha256,'TRANSFER_FINAL');
   if(transferManifest.complete!==true||
     transferManifest.originalPhysicalCount!==originalPhysicalRows.length||
     transferManifest.verifiedEnginePhysicalCount!==originalPhysicalRows.length||
     !Array.isArray(transferManifest.matches)||
     transferManifest.matches.length!==originalPhysicalRows.length)
     die('INCOMPLETE_TRANSFER','Expected all original physical owners in transfer manifest');
   digestRequired(transferManifest.engineInputSha256,'ENGINE_INPUT');
 }
 if(engineWitness){
   if(engineWitness.engineBoundaryVerified===true){
     digestRequired(engineWitness.engineInputSha256,'ENGINE_INPUT');
     digestRequired(engineWitness.ciiOutputSha256,'CII_OUTPUT');
   }
   if(transferManifest&&engineWitness.engineBoundaryVerified===true)
     match(transferManifest.engineInputSha256,engineWitness.engineInputSha256,'ENGINE_INPUT');
 }
 if(nativeSlotReceipt){
   if(!transferManifest||!engineWitness?.engineBoundaryVerified)
     die('UNBOUND_NATIVE_SLOT','Native CII slot observations require transfer and exact engine output witness');
   if(nativeSlotReceipt.rigidOnlyVerified!==true||
      nativeSlotReceipt.allPhysicalKindsVerified!==false||
      !Array.isArray(nativeSlotReceipt.rigidSlots))
     die('UNSUPPORTED_NATIVE_SLOT_COVERAGE','Only explicitly read-only RIGID slot evidence is supported');
   match(nativeSlotReceipt.basisId,basisId,'NATIVE_BASIS');
   match(nativeSlotReceipt.finalIntentSha256,finalIntent.intentSha256,'NATIVE_FINAL');
   match(nativeSlotReceipt.engineInputSha256,engineWitness.engineInputSha256,'NATIVE_INPUT');
   match(nativeSlotReceipt.ciiOutputSha256,engineWitness.ciiOutputSha256,'NATIVE_CII');
 }
 const expected=new Map();
 for(const row of originalPhysicalRows){
   let identity;
   try{identity=decodePhysicalOccurrenceId(row?.occurrenceId);}
   catch{die('NONCANONICAL_ORIGINAL_ID','Each original row needs an independently enumerated physical occurrence ID');}
   if(identity.sourceId!==sourceId||row?.sourceId!==sourceId||
      identity.branchOccurrenceIndex!==row.branchOccurrenceIndex||
      identity.nodeOrdinal!==row.nodeOrdinal||
      identity.componentSignature!==row.componentSignature)
     die('ORIGINAL_SCOPE_OR_IDENTITY_DRIFT','A supplied physical row disagrees with original source/branch/node/component identity');
   if(expected.has(row.occurrenceId))
     die('DUPLICATE_ORIGINAL_ID','Original physical identity repeated');
   for(const key of ['sourceKg','match1Kg','finalKg','effectiveKg']){
     if(row[key]!==null&&row[key]!==undefined&&!validMass(row[key]))
       die('INVALID_PHYSICAL_MASS','Non-positive physical mass cannot be logged as accepted');
   }
   expected.set(row.occurrenceId,row);
 }
 const mapped=new Map();
 for(const m of transferManifest?.matches||[]){
   if(!expected.has(m.originalOccurrenceId)||mapped.has(m.originalOccurrenceId))
     die('DUPLICATE_OR_UNSELECTED_ENGINE_OWNER','Enriched XML maps a duplicate or non-original component');
   if(!Number.isSafeInteger(m.engineNodeOrdinal)||m.engineNodeOrdinal<0||
      !validMass(m.engineWeightKg))
     die('INVALID_ENGINE_OWNER','Mapped engine XML physical mass or ordinal is invalid');
   const row=expected.get(m.originalOccurrenceId);
   if(!validMass(row.effectiveKg)||
      Math.abs(m.engineWeightKg-row.effectiveKg)>1e-9)
     die('ENGINE_MASS_MISMATCH','Enriched engine mass differs from the supplied original physical review');
   mapped.set(m.originalOccurrenceId,m);
 }
 const native=new Map(),slots=new Set();
 for(const item of nativeSlotReceipt?.rigidSlots||[]){
   if(native.has(item.originalOccurrenceId)||!expected.has(item.originalOccurrenceId)||
      !Number.isSafeInteger(item.rigidSlotOrdinal)||item.rigidSlotOrdinal<0||
      slots.has(item.rigidSlotOrdinal))
     die('AMBIGUOUS_CII_SLOT','Duplicate or non-original native CII slot');
   if(!validMass(item.approvedKg)||
      typeof item.ciiSlotMass!=='number'||!Number.isFinite(item.ciiSlotMass))
     die('INVALID_CII_SLOT','Native CII slot mass is invalid');
   const reviewed=expected.get(item.originalOccurrenceId);
   if(!validMass(reviewed.effectiveKg)||
      Math.abs(item.approvedKg-reviewed.effectiveKg)>1e-9||
      !mapped.has(item.originalOccurrenceId))
     die('NATIVE_SLOT_MASS_DRIFT','Native slot differs from original reviewed physical mass and mapped engine owner');
   slots.add(item.rigidSlotOrdinal);native.set(item.originalOccurrenceId,item);
 }
 const sorted=[...expected.values()].sort((a,b)=>
   a.branchOccurrenceIndex-b.branchOccurrenceIndex||
   a.nodeOrdinal-b.nodeOrdinal||
   a.componentSignature.localeCompare(b.componentSignature));
 const rows=sorted.map(item=>{
   const m=mapped.get(item.occurrenceId),slot=native.get(item.occurrenceId);
   let status,reason;
   if(!finalIntent) {
     status='HOLD_FINAL_INTENT_MISSING';reason='Complete accepted source/master/Match-1/Final ledger is not independently committed';
   }else if(!validMass(item.effectiveKg)||
       (item.match1Kg!==null&&item.match1Kg!==undefined&&
        item.finalKg===null&&item.sourceKg===null)) {
     status='HOLD_WEIGHT_UNRESOLVED';reason='Original physical weight is unresolved or Match-1-only';
   }else if(!m){
     status='HOLD_SOURCE_TO_ENGINE_UNVERIFIED';reason='No exact original physical owner in enriched engine input';
   }else if(!engineWitness?.engineBoundaryVerified) {
     status='HOLD_ENGINE_OUTPUT_UNVERIFIED';reason='Enriched owner observed, native input/output bytes not witnessed';
   }else if(!slot){
     status='HOLD_NATIVE_CII_SLOT_UNVERIFIABLE';reason='No matching independently observed native CII weight slot; VALV/INST/etc are not inferred';
   }else{
     status='OBSERVED_RIGID_SLOT_ONLY';reason='Read-only RIGID slot seen; not proof of complete all-kind CII release';
   }
   return Object.freeze({
     sourceId,physicalOccurrenceId:item.occurrenceId,
     branchOccurrenceIndex:item.branchOccurrenceIndex,
     originalNodeOrdinal:item.nodeOrdinal,
     componentSignature:item.componentSignature,
     sourceKg:item.sourceKg??null,
     match1Kg:item.match1Kg??null,
     finalKg:item.finalKg??null,
     approvedEffectiveKg:item.effectiveKg??null,
     engineNodeOrdinal:m?.engineNodeOrdinal??null,
     engineWeightKg:m?.engineWeightKg??null,
     nativeSlot:slot?.rigidSlotOrdinal??null,
     ciiValue:slot?.ciiSlotMass??null,
     status,reason,basisId,originalJsonSha256,
     finalIntentSha256:finalIntent?.intentSha256??null,
     engineInputSha256:engineWitness?.engineInputSha256??transferManifest?.engineInputSha256??null,
     ciiOutputSha256:engineWitness?.ciiOutputSha256??null,
   });
 });
 const statuses={};for(const row of rows)statuses[row.status]=(statuses[row.status]||0)+1;
 const log=Object.freeze({
   schema:XML229_EXTERNAL_LOG_SCHEMA,runId,sourceId,basisId,
   originalJsonSha256,sourceGenerationId,
   finalIntentSha256:finalIntent?.intentSha256??null,
   engineInputSha256:engineWitness?.engineInputSha256??transferManifest?.engineInputSha256??null,
   ciiOutputSha256:engineWitness?.ciiOutputSha256??null,
   expectedOriginalPhysicalCount:expected.size,
   observedEnrichedCount:mapped.size,
   observedNativeSlotCount:native.size,
   heldCount:rows.filter(x=>x.status.startsWith('HOLD_')).length,
   statuses,
   sourceCensusIndependentlyVerifiedByThisLog:false,
   physicalEngineConsumptionVerified:false,
   nativeCiiReleaseAuthorized:false,
   releaseStatus:'HOLD',
   limitations:'This is an external diagnostic log, not an engineer signature or a native CII release receipt.',
   rows:Object.freeze(rows),
 });
 return Object.freeze({log,json:JSON.stringify(log,null,2)+'\n',csv:toCsv(rows)});
}
