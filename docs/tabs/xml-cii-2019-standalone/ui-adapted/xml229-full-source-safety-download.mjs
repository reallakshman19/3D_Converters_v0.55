/**
 * Bounded private export for an already verified original-source GC-PW Worker.
 * Download transports an aggregate only; neither review nor native Run is touched.
 */
import {collectXml229ReadOnlyWeightAcceptance}
 from '../integration/xml229-full-source-weight-safety-receipt.mjs';
import {downloadTextFile} from './xml-cii-adapted-dom.js';
const deny=code=>{const e=new Error(code);e.code=code;throw e;};
export async function downloadXml229FullSourceSafety({
 session,isCurrent=()=>false,say=()=>{},
}={}){
 if(!session||typeof isCurrent!=='function'||!isCurrent())
   deny('FULL_SOURCE_SAFETY_SESSION_STALE');
 const receipt=await collectXml229ReadOnlyWeightAcceptance(session);
 if(!isCurrent())deny('FULL_SOURCE_SAFETY_SESSION_STALE');
 downloadTextFile('xml229-full-source-weight-safety-precheck.json',
   JSON.stringify(receipt,null,2),'application/json;charset=utf-8');
 say(receipt.population.physicalCount+' original physicals / '+
   receipt.population.factCount+' facts audited read-only; '+
   receipt.review.acceptedFinal+' accepted Final, '+
   receipt.review.unresolved+' unresolved; '+
   receipt.proposals.valveToFlangeRejected+' valve-to-flange proposals held. '+
   'Native CII release remains HELD pending actual output authority.');
 return receipt;
}
