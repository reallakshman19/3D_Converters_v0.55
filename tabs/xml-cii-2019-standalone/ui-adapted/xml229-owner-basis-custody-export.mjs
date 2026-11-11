/**
 * XML229 owner-local ONLY custody export of the current Source & Master basis.
 * Explicit user download; no review writes, import, restoration, Final or CII Run.
 * Contains PRIVATE normalized master rows and effective config: never log, upload
 * to GitHub or include in public audit evidence.
 */
import {digestCanonical,digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
export const OWNER_BASIS_CUSTODY_SCHEMA='XML229.OwnerLocalEffectiveBasisCustody.v1';
const DENY=code=>{const e=new Error(code);e.code=code;throw e;};
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
const obj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const defs=Object.freeze({lineList:['linelist','masterRows'],
  pipingClass:['pipingClass','masterRows'],materialMap:['material','mapRows'],
  weight:['weight','masterRows']});
export async function buildXml229OwnerEffectiveBasisCustody({
 inputs,session,lease,isCurrent=()=>false,
}={}){
 if(typeof isCurrent!=='function'||isCurrent()!==true||
    inputs?.isCurrent?.()!==true||!sha(inputs?.inputLease)||
    inputs.inputLease!==lease||!session?.receipt||
    typeof session.readCompletion!=='function')DENY('OWNER_CUSTODY_VERIFIED_LIVE_LEASE_REQUIRED');
 const r=session.receipt;
 if(!sha(r.basisId)||!sha(r.originalJsonSha256)||
    !sha(inputs.originalStagedSourceReceipt?.sha256)||
    r.originalJsonSha256!==inputs.originalStagedSourceReceipt.sha256||
    r.sourceId!==inputs.sourceId||!Array.isArray(inputs.selection)||
    inputs.selection.length!==1||inputs.selection[0]?.sourceId!==r.sourceId||
    inputs.selection[0]?.selectionRef!=='all'||
    typeof inputs.xmlText!=='string'||!inputs.xmlText.trim()||
    !obj(inputs.config)||!obj(inputs.overrides)||!obj(inputs.masters)||
    Object.keys(inputs.masters).length!==4)
   DENY('OWNER_CUSTODY_SOURCE_BASIS_DRIFT');
 const completion=await session.readCompletion();
 if(completion?.basisId!==r.basisId||
    completion?.originalJsonSha256!==r.originalJsonSha256||
    !completion.engineeringFactsVerified||completion.ciiReleaseAuthorized!==false||
    completion.verifiedPhysicalCount!==r.physicalCount||
    completion.verifiedFactCount!==r.physicalFactCount||
    completion.verifiedFactCount!==7*completion.verifiedPhysicalCount)
   DENY('OWNER_CUSTODY_WORKER_POPULATION_DRIFT');
 const masters={},masterDigests={};
 for(const [key,[section,rowsKey]] of Object.entries(defs)){
   const m=inputs.masters[key],sec=inputs.config[section];
   if(!obj(m)||!Array.isArray(m.rows)||!m.rows.length||m.rows.length>250000||
      typeof m.datasetId!=='string'||!m.datasetId||
      !Number.isSafeInteger(m.revision)||m.revision<1||
      !obj(m.mapping)||!obj(sec)||!Array.isArray(sec[rowsKey])||
      !obj(sec.fieldMap??{}))DENY('OWNER_CUSTODY_MASTER_UNAVAILABLE');
   const [rowsHash,configHash,mapHash]=await Promise.all([
     digestCanonical(m.rows),digestCanonical(sec[rowsKey]),
     digestCanonical(m.mapping),
   ]);
   if(rowsHash!==configHash||mapHash!==await digestCanonical(sec.fieldMap??{}))
     DENY('OWNER_CUSTODY_MASTER_CONFIG_DRIFT');
   masters[key]={datasetId:m.datasetId,revision:m.revision,
     rows:m.rows,mapping:m.mapping};
   masterDigests[key]={datasetId:m.datasetId,revision:m.revision,
     rowCount:m.rows.length,sha256:rowsHash,mappingSha256:mapHash};
 }
 const [sourceTextSha256,configSha256,overridesSha256]=await Promise.all([
   digestUtf8(inputs.xmlText),digestCanonical(inputs.config),
   digestCanonical(inputs.overrides),
 ]);
 if(inputs.config.overrides!==undefined&&
    await digestCanonical(inputs.config.overrides)!==overridesSha256)
   DENY('OWNER_CUSTODY_OVERRIDES_CONFIG_DRIFT');
 if(isCurrent()!==true||inputs.isCurrent()!==true||
    session.closed===true||inputs.inputLease!==lease)
   DENY('OWNER_CUSTODY_SOURCE_CHANGED_DURING_EXPORT');
 return {
   schema:OWNER_BASIS_CUSTODY_SCHEMA,
   privateOwnerLocalOnly:true,
   authority:'INPUT_CUSTODY_ONLY_NO_ENGINEERING_MASS_APPROVAL',
   basisId:r.basisId,sourceId:r.sourceId,originalJsonSha256:r.originalJsonSha256,
   sourceTextSha256,configSha256,overridesSha256,masterDigests,
   population:{physical:r.physicalCount,facts:r.physicalFactCount},
   contents:{config:inputs.config,overrides:inputs.overrides,masters},
   historicalDecisionUpdates:0,finalAcceptedAutomatically:false,
   nativeCiiReleaseAuthorized:false,
 };
}
