/** Owner-only, explicit local file download, never an API upload or GC-PW write. */
import {buildXml229OwnerEffectiveBasisCustody}
 from './xml229-owner-basis-custody-export.mjs';
import {downloadTextFile} from './xml-cii-adapted-dom.js';
const deny=code=>{const e=new Error(code);e.code=code;throw e;};
export async function downloadXml229OwnerBasisCustody({
  resolveInputs,session,getEntry,isCurrent,
}={}){
  if(typeof resolveInputs!=='function'||typeof getEntry!=='function'||
     typeof isCurrent!=='function'||isCurrent()!==true)
    deny('OWNER_CUSTODY_SESSION_NOT_CURRENT');
  const before=getEntry();
  if(!before||before.session!==session||!before.lease)
    deny('OWNER_CUSTODY_VERIFIED_LEASE_UNAVAILABLE');
  const inputs=await resolveInputs();
  if(getEntry()?.session!==session||getEntry()?.lease!==before.lease)
    deny('OWNER_CUSTODY_INPUTS_SUPERSEDED');
  const bundle=await buildXml229OwnerEffectiveBasisCustody({
    inputs,session,lease:before.lease,isCurrent,
  });
  if(isCurrent()!==true||getEntry()?.session!==session||
     getEntry()?.lease!==before.lease||inputs.isCurrent?.()!==true)
    deny('OWNER_CUSTODY_SOURCE_CHANGED_DURING_EXPORT');
  downloadTextFile('xml229-owner-effective-basis-custody_PRIVATE.json',
    JSON.stringify(bundle,null,2),'application/json;charset=utf-8');
  return {physical:bundle.population.physical,facts:bundle.population.facts,
    authority:'INPUT_CUSTODY_ONLY',nativeCiiReleaseAuthorized:false};
}
