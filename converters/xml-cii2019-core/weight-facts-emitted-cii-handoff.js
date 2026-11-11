// GC-PW Weight-owned post-writer verification boundary.
// Consumes actual emitted XML through an independently implemented physical-child
// extractor. No source-to-child inference, XML writer, DOM or run orchestration.
import { digestUtf8 } from '../../contracts/gc-pw-v1/contract.mjs';
import { decodePhysicalOccurrenceId } from '../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import { readVerifiedModeAFinalRows } from './weight-facts-mode-a-final-read.js';

const sha=x=>typeof x==='string'&&/^[a-f\d]{64}$/i.test(x);
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const fail=(code,message)=>{const error=new Error(message);error.code=code;error.retryable=false;throw error;};
const key=(sourceId,occurrenceId)=>JSON.stringify([sourceId,occurrenceId]);

function requiredSnapshots(review,basisId,rows,refs){
  if(!Array.isArray(refs)||refs.some(x=>typeof x!=='string'||!x))
    fail('FROZEN_SNAPSHOT_REFS_REQUIRED','Explicit frozen review snapshot refs required');
  if(new Set(refs).size!==refs.length)
    fail('DUPLICATE_REVIEW_SNAPSHOT','A frozen snapshot ref cannot be supplied twice');
  const pending=new Set(refs),matched=[];
  for(const sourceId of rows.sources){
    for(const stage of ['RigidMatch1','Rigidmatch2']){
      const revision=rows.revisionBySource[sourceId][stage==='RigidMatch1'?'match1':'final'];
      if(revision===null)continue; // Original positive source mass may need no review decisions.
      const frozen=review.getSnapshot({basisId,scopeId:sourceId,stage,revision});
      const matching=frozen.filter(x=>x.revision===revision && x.stage===stage &&
        x.scopeId===sourceId && x.basisId===basisId && pending.has(x.snapshotRef));
      if(matching.length!==1)
        fail('MISSING_CURRENT_REVIEW_SNAPSHOT','Current source and stage must have one provided frozen snapshot');
      matched.push(matching[0].snapshotRef);
      pending.delete(matching[0].snapshotRef);
    }
  }
  if(pending.size)fail('UNEXPECTED_REVIEW_SNAPSHOT','Snapshot is stale, duplicated, or out of selected scope');
  return matched;
}
function inspectEmittedComponents(output,basisId,sha256,writerRunId,rows){
  if(!output||output.basisId!==basisId||output.artifactSha256!==sha256||
     output.writerRunId!==writerRunId||!Array.isArray(output.components))
    fail('OUTPUT_ARTIFACT_CUSTODY_MISMATCH','Extractor must identify the exact emitted bytes, basis and writer run');
  const originals=new Map(rows.rows.map(r=>[key(r.sourceId,r.occurrenceId),r]));
  const seen=new Set();let physicalKg=0,childKg=0,ciiValue=0,childCount=0;
  for(const component of output.components){
    if(!component||typeof component.sourceId!=='string'||typeof component.occurrenceId!=='string')
      fail('NONCANONICAL_OUTPUT_OCCURRENCE','Physical CII output needs an original source identity');
    let id;try{id=decodePhysicalOccurrenceId(component.occurrenceId);}
    catch{fail('NONCANONICAL_OUTPUT_OCCURRENCE','Output references an untrusted row or non-original ordinal');}
    if(id.sourceId!==component.sourceId)
      fail('OUTPUT_SOURCE_ALIAS','Original physical identity claims another source');
    const k=key(component.sourceId,component.occurrenceId);
    const original=originals.get(k);
    if(!original||seen.has(k))
      fail('OUTPUT_PHYSICAL_CENSUS_MISMATCH','Output added, omitted or duplicated an original source physical occurrence');
    seen.add(k);
    if(!positive(original.effectiveKg))
      fail('UNRESOLVED_WEIGHT','No accepted mass exists for one original physical component');
    if(!Array.isArray(component.children)||!component.children.length||
       !component.output||component.output.scale!==10||
       component.output.unit!=='cii-force'||!Number.isFinite(component.output.value))
      fail('INVALID_EMITTED_MASS_EVIDENCE','Actual split child kg and one CII x10 transform required');
    const ids=new Set();let total=0;
    for(const child of component.children){
      if(!child||typeof child.childId!=='string'||!child.childId||ids.has(child.childId)||
         typeof child.kg!=='number'||!Number.isFinite(child.kg)||child.kg<0)
        fail('INVALID_EMITTED_CHILD','Each generated child requires independent unique identity and finite nonnegative kg');
      ids.add(child.childId);total+=child.kg;childCount++;
    }
    const tol=Math.max(1e-6,original.effectiveKg*1e-9);
    if(Math.abs(total-original.effectiveKg)>tol)
      fail('MASS_NOT_CONSERVED','Emitted physical children do not sum to accepted source weight');
    if(Math.abs(component.output.value-10*total)>Math.max(1e-6,Math.abs(component.output.value)*1e-9))
      fail('DOUBLE_CONVERSION','Emitted CII mass is not exactly one x10 transform of child kg');
    physicalKg+=original.effectiveKg;childKg+=total;ciiValue+=component.output.value;
  }
  if(seen.size!==originals.size)
    fail('OUTPUT_PHYSICAL_CENSUS_MISMATCH','Emitted output omitted one or more source physical components');
  return {physicalCount:seen.size,childCount,acceptedKg:physicalKg,emittedChildKg:childKg,ciiForce:ciiValue};
}

/**
 * The extractor is supplied by the independent CII writer/output oracle, not
 * derived from GC-PW fact rows. It reads artifactXml and returns exact emitted
 * physical child identities + kg, original physical source identities and x10
 * CII values. A self-reported proof without real extraction is not product evidence.
 */
export async function verifyEmittedCiiWeightHandoff(session,{
  artifactXml,artifactSha256,writerRunId,reviewedSnapshotRefs,extractPhysicalChildren,
}={}){
  const before=readVerifiedModeAFinalRows(session);
  if(typeof artifactXml!=='string'||!artifactXml.trim()||!sha(artifactSha256)||
     typeof writerRunId!=='string'||!writerRunId.trim()||
     typeof extractPhysicalChildren!=='function')
    fail('EMITTED_ARTIFACT_REQUIRED','Real emitted XML, SHA256, writer run and independent extractor required');
  const matched=requiredSnapshots(session.review,before.basisId,before,reviewedSnapshotRefs);
  // An immutable copy of the string is used through all async calls; the digest
  // belongs to the actual artifact bytes, not to the input XML or displayed rows.
  const digest=await digestUtf8(artifactXml);
  if(digest!==artifactSha256.toLowerCase())
    fail('EMITTED_ARTIFACT_DIGEST_MISMATCH','Emitted CII XML bytes do not match writer output digest');
  const extracted=await extractPhysicalChildren(artifactXml,{
    basisId:before.basisId,artifactSha256:digest,writerRunId,
  });
  const after=readVerifiedModeAFinalRows(session);
  if(JSON.stringify(before)!==JSON.stringify(after))
    fail('STALE_EMITTED_REVIEW','Original source facts or either accepted review stage changed during output validation');
  const stable=requiredSnapshots(session.review,before.basisId,after,reviewedSnapshotRefs);
  if(JSON.stringify(matched)!==JSON.stringify(stable))
    fail('STALE_EMITTED_REVIEW','Frozen snapshot changed during output extraction');
  const totals=inspectEmittedComponents(extracted,before.basisId,digest,writerRunId,after);
  // Reuse the Weight ledger's independent stage snapshot and per-child guard,
  // *after* output custody, canonical census and source-stage CAS have passed.
  const verified=session.review.verifyRun({
    basisId:before.basisId,reviewedSnapshotIds:matched,
    outputBasis:{components:extracted.components},
  });
  if(verified.verified!==true||verified.componentCount!==totals.physicalCount)
    fail('RUN_WEIGHT_VERIFICATION_FAILED','Ledger did not confirm every emitted physical component');
  return {verified:true,basisId:before.basisId,writerRunId,
    artifactSha256:digest,reviewedSnapshotRefs:matched,stage:'Rigidmatch2',...totals};
}
