/**
 * XML229 R2-C1: independent original physical -> enriched XML engine-input
 * correspondence. An evidence-only strict subset, NOT CII output acceptance.
 *
 * Transfer requires a unique SAME source-branch occurrence, complete original
 * component signature, NodeNumber, Position and positive accepted mass.
 * Any cleanup/renumbering/splitting that breaks exact identity is held
 * until the producer emits an independently audited lineage manifest.
 *
 * Never infer from equal NodeNumber, branch label or candidate score alone.
 */
import {decodePhysicalOccurrenceId} from '../../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {canonicalJson} from '../../../contracts/gc-pw-v1/contract.mjs';
import {readVerifiedModeAFinalRows}
 from '../../../converters/xml-cii2019-core/weight-facts-mode-a-final-read.js';
import {commitXml229NativeFinalIntent}
 from '../../../converters/xml-cii2019-core/weight-facts-native-consumption-intent.js';
import {isXmlCiiWeightReviewNode,isXmlCiiWeightReviewConnectionEligible}
 from '../../../converters/xml-cii2019-core/weight-match-model.js';
import {isXml229NonOwnerRigidBranchInlet}
 from '../../../converters/xml-cii2019-core/xml229-nonowner-rigid-branch-inlet.mjs';

export const XML229_TRANSFER_SCHEMA='XML229.R2.OriginalPhysicalEngineInputTransfer.v1';
const fail=(code,message)=>{const e=new Error(message);e.code=code;e.retryable=false;throw e;};
const tag=x=>String(x?.localName||x?.nodeName||'').replace(/^.*:/,'');
const children=(n,wanted)=>[...(n?.childNodes||[])]
  .filter(x=>x?.nodeType===1&&tag(x)===wanted);
const field=(n,key)=>String(children(n,key)[0]?.textContent??'').trim();
const sha=async v=>{
 if(!globalThis.crypto?.subtle?.digest)fail('CRYPTO_REQUIRED','Browser/Worker SHA-256 unavailable');
 const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));
 return [...new Uint8Array(buf)].map(v=>v.toString(16).padStart(2,'0')).join('');
};
function parse(xml,side){
 if(typeof xml!=='string'||!xml.trim()||typeof DOMParser!=='function')
  fail('XML_PARSER_REQUIRED',side+' original XML and native engine input must be parseable');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc?.getElementsByTagName('parsererror')?.length||
    tag(doc?.documentElement)!=='PipeStressExport')
  fail('INVALID_XML',side+' is not a valid PipeStressExport');
 const branches=[...doc.getElementsByTagName('Branch')];
 if(!branches.length)fail('EMPTY_BRANCH_CENSUS',side+' has no original branches');
 return branches;
}
const occurrenceSignature=n=>canonicalJson([
 field(n,'ComponentType'),field(n,'ComponentRefNo'),
 field(n,'Endpoint'),field(n,'NodeName'),
]);
const positionalSignature=n=>canonicalJson([
 occurrenceSignature(n),field(n,'NodeNumber'),field(n,'Position'),
]);
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
/** Pure, no mutations, no synthetic decisions.
 * Inputs come from the actual original owner and the actual enriched XML
 * immediately before the native CII engine boundary.
 */
export async function attestXml229OriginalPhysicalEngineInput({
 session,sourceId,originalXmlText,engineInputXmlText,
 originalJsonSha256,sourceGenerationId,
 independentlyEnumeratedOriginalPhysical,
}={}){
 if(!session?.basis?.basisId||typeof sourceId!=='string'||!sourceId||
    !Array.isArray(independentlyEnumeratedOriginalPhysical)||
    independentlyEnumeratedOriginalPhysical.length<1)
  fail('ORIGINAL_PHYSICAL_CENSUS_REQUIRED','One source and its independent complete physical census required');
 const sourceRows=readVerifiedModeAFinalRows(session);
 const intent=await commitXml229NativeFinalIntent(session,{
   originalJsonSha256,sourceGenerationId,
 });
 if(sourceRows.basisId!==intent.basisId||
    sourceRows.physicalCount!==independentlyEnumeratedOriginalPhysical.length||
    sourceRows.sources.length!==1||sourceRows.sources[0]!==sourceId||
    !intent.eligibleForEngineBinding)
  fail('FINAL_POPULATION_UNREVIEWED','Every source physical mass must be resolved and Final-reviewed before engine input transfer');
 // No source/mass revision can change during this async verification.
 const initial=canonicalJson([sourceRows.revisionBySource,sourceRows.rows.map(row=>
  [row.occurrenceId,row.effectiveKg,row.finalKg,row.sourceKg])]);
 const original=parse(originalXmlText,'original'),engine=parse(engineInputXmlText,'engine');
 if(original.length!==engine.length)
  fail('BRANCH_OCCURRENCE_DRIFT','Engine input changed original branch occurrence count');
 const byId=new Map(sourceRows.rows.map(row=>[row.occurrenceId,row]));
 const idSet=new Set(),engineUsed=new Set(),matches=[];
 // A branch name is corroboration only: the authority is original branch
 // ordinal PLUS immutable component signature and source node coordinates.
 for(const expected of independentlyEnumeratedOriginalPhysical){
   const parsed=decodePhysicalOccurrenceId(expected.occurrenceId||
     JSON.stringify([expected.sourceId,expected.branchOccurrenceIndex,
       expected.nodeOrdinal,expected.componentSignature]));
   if(parsed.sourceId!==sourceId||
      parsed.branchOccurrenceIndex!==expected.branchOccurrenceIndex||
      parsed.nodeOrdinal!==expected.nodeOrdinal||
      parsed.componentSignature!==expected.componentSignature||
      idSet.has(parsed.occurrenceId))
    fail('INVALID_ORIGINAL_PHYSICAL_ID','Independent original source physical occurrence was altered or duplicated');
   idSet.add(parsed.occurrenceId);
   const accepted=byId.get(parsed.occurrenceId);
   if(!accepted||!positive(accepted.effectiveKg))
    fail('ORIGINAL_PHYSICAL_MISSING','Original physical occurrence has no reviewed mass');
   const b=original[parsed.branchOccurrenceIndex],e=engine[parsed.branchOccurrenceIndex];
   if(!b||!e||field(b,'Branchname')!==field(e,'Branchname'))
    fail('BRANCH_OCCURRENCE_DRIFT','Original/enriched branch occurrence changed');
   const oldNode=children(b,'Node')[parsed.nodeOrdinal];
   if(!oldNode||occurrenceSignature(oldNode)!==parsed.componentSignature)
    fail('ORIGINAL_COMPONENT_SIGNATURE_DRIFT','Original node ordinal/component signature differs from GC-PW');
   const signature=positionalSignature(oldNode);
   const candidates=children(e,'Node').map((node,nodeOrdinal)=>({node,nodeOrdinal}))
     .filter(item=>positionalSignature(item.node)===signature);
   if(candidates.length!==1)
    fail('ENRICHED_COMPONENT_LINEAGE_AMBIGUOUS',
      'Cannot prove one-to-one original physical identity after cleanup, renumbering or splitting; explicit trusted lineage required');
   const {node,nodeOrdinal}=candidates[0];
   const slot=canonicalJson([sourceId,parsed.branchOccurrenceIndex,nodeOrdinal]);
   if(engineUsed.has(slot))
    fail('ENRICHED_PHYSICAL_OWNER_DUPLICATE','Two originals mapped to one enriched owner');
   engineUsed.add(slot);
   const written=Number(field(node,'Weight'));
   if(!positive(written)||Math.abs(written-accepted.effectiveKg)>1e-9)
    fail('FINAL_WEIGHT_NOT_IN_ENGINE_INPUT',
      'Engine input physical mass is absent or differs from source-bound Final/Source approved kg');
   matches.push({
     originalOccurrenceId:parsed.occurrenceId,sourceId,
     branchOccurrenceIndex:parsed.branchOccurrenceIndex,
     originalNodeOrdinal:parsed.nodeOrdinal,engineNodeOrdinal:nodeOrdinal,
     originalNodeNumber:field(oldNode,'NodeNumber'),
     engineNodeNumber:field(node,'NodeNumber'),
     enginePosition:field(node,'Position'),
     branchName:field(e,'Branchname'),
     componentType:field(node,'ComponentType'),
     componentRefNo:field(node,'ComponentRefNo'),
     endpoint:field(node,'Endpoint'),nodeName:field(node,'NodeName'),
     rigid:field(node,'Rigid'),
     componentSignature:parsed.componentSignature,
     engineWeightKg:written,
     status:'EXACT_ORIGINAL_COMPONENT_AND_MASS_IN_ENGINE_XML',
   });
 }
 // The enriched engine input must not introduce another eligible physical
 // component outside the complete original source census, even if all
 // expected originals were mapped. No invisible extra mass owners.
 for(const [branchIndex,branch] of engine.entries()){
   for(const [nodeOrdinal,node] of children(branch,'Node').entries()){
     if(isXml229NonOwnerRigidBranchInlet({
       node,branchIndex,nodeOrdinal,branches:engine,
     }))continue;
     if(!isXmlCiiWeightReviewNode(node)||
        !isXmlCiiWeightReviewConnectionEligible(node))continue;
     const slot=canonicalJson([sourceId,branchIndex,nodeOrdinal]);
     if(!engineUsed.has(slot))
       fail('EXTRA_ENRICHED_PHYSICAL_OWNER',
         'An eligible enriched physical weight owner has no verified original physical occurrence');
   }
 }
 if(matches.length!==sourceRows.physicalCount||
    byId.size!==matches.length)
  fail('PHYSICAL_TRANSFER_CARDINALITY_DRIFT','Not every GC-PW physical owner is represented in enriched engine input');
 const after=readVerifiedModeAFinalRows(session);
 if(canonicalJson([after.revisionBySource,after.rows.map(row=>
    [row.occurrenceId,row.effectiveKg,row.finalKg,row.sourceKg])])!==initial)
  fail('SOURCE_FINAL_CHANGED_DURING_TRANSFER','Final decisions changed while verifying engine input');
 const inputSha256=await sha(engineInputXmlText);
 const second=await commitXml229NativeFinalIntent(session,{
   originalJsonSha256,sourceGenerationId,
 });
 if(second.intentSha256!==intent.intentSha256)
  fail('FINAL_SHA_CHANGED_DURING_TRANSFER','Final source/master/review commitment changed');
 return Object.freeze({
   schema:XML229_TRANSFER_SCHEMA,
   basisId:intent.basisId,originalJsonSha256,sourceGenerationId,
   finalIntentSha256:intent.intentSha256,engineInputSha256:inputSha256,
   originalPhysicalCount:sourceRows.physicalCount,
   verifiedEnginePhysicalCount:matches.length,
   mappingKind:'STRICT_EXACT_PRE_SPLIT',
   complete:true,transferObserved:true,
   nativeCiiPhysicalSlotVerified:false,nativeCiiReleaseAuthorized:false,
   matches:Object.freeze(matches),
   status:'ENGINE_INPUT_MASS_TRANSFER_VERIFIED_ONLY',
   reason:'Matching enriched XML is NOT proof of native Python model/CIIRIGID slot consumption; independent native owner and CII output custody remains mandatory.',
 });
}
