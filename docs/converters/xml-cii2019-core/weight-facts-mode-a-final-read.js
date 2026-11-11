// Complete-source, canonical Mode A Final Match-2 read-model.
// This module renders no UI and never turns legacy review rows into identities.
import { decodePhysicalOccurrenceId } from '../../contracts/gc-pw-v1/occurrence-bridge.mjs';
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const assigned=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
function fail(code,message){const e=new Error(message);e.code=code;e.retryable=false;throw e;}
export function readVerifiedModeAFinalRows(session) {
  const basis=session?.basis,review=session?.review;
  if(!basis || !/^[0-9a-f]{64}$/i.test(basis.basisId) ||
      !Array.isArray(basis.scope)||!Array.isArray(basis.sourceRefs)||
      !Number.isSafeInteger(session.openedFacts)||session.openedFacts<1||
      !review||!['getFacts','getDecisionState','applyDecisions','freezeSnapshot'].every(x=>typeof review[x]==='function'))
    fail('VERIFIED_SESSION_REQUIRED','A completed, independently verified GC-PW source session is required');
  const authorized=new Set(basis.sourceRefs.map(x=>x.sourceId));
  const sources=[...new Set(basis.scope.map(x=>x.sourceId))].sort();
  if(!sources.length||sources.some(id=>typeof id!=='string'||!authorized.has(id)))
    fail('INVALID_SELECTION_SCOPE','A selected original source is not authorized');
  const rows=[],revisionBySource={},idSet=new Set();let factCount=0;
  for(const sourceId of sources){
    const m=review.getDecisionState({basisId:basis.basisId,scopeId:sourceId,stage:'RigidMatch1'});
    const f=review.getDecisionState({basisId:basis.basisId,scopeId:sourceId,stage:'Rigidmatch2'});
    revisionBySource[sourceId]={match1:m.decisionRevision,final:f.decisionRevision};
    let cursor=null,total=null,seen=0;const used=new Set(),items=[];
    do{
      const page=review.getFacts({basisId:basis.basisId,sourceId,
        subjectType:'physical-component',cursor,limit:500});
      if(!page||page.complete!==true||!Array.isArray(page.items)||
         !Number.isSafeInteger(page.totalCount)||page.totalCount<0||
         (total!==null&&page.totalCount!==total)||
         page.items.some(x=>x.basisId!==basis.basisId||x.sourceId!==sourceId||
           x.subjectType!=='physical-component'))
        fail('INCOMPLETE_FINAL_FACTS','Verified physical source fact page is incomplete or cross-source');
      total=page.totalCount;items.push(...page.items);seen+=page.items.length;
      cursor=page.nextCursor;
      if(cursor!==null&&(typeof cursor!=='string'||used.has(cursor)))
        fail('STALE_FINAL_CURSOR','Repeated or malformed final source cursor');
      if(cursor!==null)used.add(cursor);
    }while(cursor!==null);
    if(seen!==total)fail('INCOMPLETE_FINAL_FACTS','Final source fact population truncated');
    factCount+=seen;
    const components=new Map();
    for(const item of items){
      let parsed;try{parsed=decodePhysicalOccurrenceId(item.occurrenceId);}
      catch{fail('NONCANONICAL_WEIGHT_OCCURRENCE','Legacy row key is not an original physical occurrence');}
      if(parsed.sourceId!==sourceId)
        fail('SOURCE_SCOPE_CONFLICT','Canonical occurrence identity cannot alias a different XML source');
      if(!components.has(item.occurrenceId))components.set(item.occurrenceId,[]);
      components.get(item.occurrenceId).push(item);
    }
    for(const [occurrenceId,facts] of components){
      const key=JSON.stringify([sourceId,occurrenceId]);
      if(idSet.has(key))fail('DUPLICATE_PHYSICAL_OCCURRENCE','Final cannot show a duplicated original physical identity');
      idSet.add(key);
      const mass=facts.filter(item=>item.fieldId==='mass.kg');
      if(mass.length!==1)fail('MISSING_PHYSICAL_MASS_FIELD','One mass.kg field is required per original physical component');
      const sourceKg=mass[0].authority==='source'&&positive(mass[0].value)?mass[0].value:null;
      const match1=m.decisions[occurrenceId];
      const final=f.decisions[occurrenceId];
      const match1Kg=match1?.state==='accepted'?match1.value:null;
      const finalKg=final?.state==='accepted'?final.value:null;
      const effectiveKg=assigned(finalKg)?finalKg:positive(match1Kg)?match1Kg:sourceKg;
      const original=decodePhysicalOccurrenceId(occurrenceId);
      rows.push({sourceId,occurrenceId,
        branchOccurrenceIndex:original.branchOccurrenceIndex,nodeOrdinal:original.nodeOrdinal,
        componentSignature:original.componentSignature,
        sourceKg,match1Kg,finalKg,effectiveKg,
        status:assigned(finalKg)?'Final':positive(match1Kg)?'Match-1':positive(sourceKg)?'Source':'Needs review'});
    }
  }
  if(factCount!==session.openedFacts||!rows.length)
    fail('INCOMPLETE_FINAL_FACTS','Full verified physical field count must match the reviewed facts custody');
  rows.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)||
    a.branchOccurrenceIndex-b.branchOccurrenceIndex||a.nodeOrdinal-b.nodeOrdinal||
    a.componentSignature.localeCompare(b.componentSignature));
  return {basisId:basis.basisId,stage:'Rigidmatch2',sources,revisionBySource,
    physicalCount:rows.length,verifiedFactCount:factCount,
    unresolved:rows.filter(x=>!assigned(x.effectiveKg)).length,rows};
}
