/**
 * XML229 source-first presentation adapter. GC-PW keeps the seven-field
 * canonical fact model unchanged; this adds only a VERIFIED read projection
 * for the mature 13-column Weight UI, never a second scoring/writer path.
 */
import {resolveNodeNameValveHint} from '../../../converters/xml-cii2019-core/weight-valve-hints.js';
const key=(b,n)=>JSON.stringify([b,n]);
const fail=(code,detail)=>{const e=new Error(detail);e.code=code;throw e;};
const text=x=>String(x??'').trim();
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const positive=x=>finite(x)&&x>0;
const CANDIDATE_BASIS_FIELDS=Object.freeze([
 'type','typeDesc','masterRowId','masterRowOrdinal','rowBore','rowRating',
 'rowLength','masterWeight','lengthDelta','lengthToleranceMm','extrapolationRatio',
 'weightMethod','semanticReason','semanticSource','warning','specialFactorCode',
]);
/** Display evidence only: no raw master row or scoring/acceptance changes. */
export function projectXml229WeightCandidateBasis(proposal){
 const candidate=proposal?.extensions?.candidate||{};
 return Object.freeze(Object.fromEntries(CANDIDATE_BASIS_FIELDS.map(key=>{
   const value=candidate[key];
   return [key,typeof value==='string'||finite(value)?value:null];
 })));
}
function allFacts(review,basisId,sourceId){
  const rows=[];let cursor=null,total=null;const seen=new Set();
  do{
    const page=review.getFacts({basisId,sourceId,subjectType:'physical-component',cursor,limit:500});
    if(!page?.complete||!Array.isArray(page.items)||!Number.isSafeInteger(page.totalCount)||
       total!==null&&total!==page.totalCount)
      fail('PRESENTATION_FACT_PAGE_INCOMPLETE','Verified physical fact population is incomplete');
    total=page.totalCount;rows.push(...page.items);
    const next=page.nextCursor;
    if(next!==null&&(typeof next!=='string'||seen.has(next)))
      fail('PRESENTATION_FACT_CURSOR_DRIFT','Repeated or invalid physical source cursor');
    if(next!==null)seen.add(next);
    cursor=next;
  }while(cursor!==null);
  if(rows.length!==total)fail('PRESENTATION_FACT_COUNT_DRIFT','Physical facts truncated');
  return rows;
}
function allProposals(review,basisId,ids){
 const rows=[];let cursor=null,total=null;const seen=new Set();
 do{
  const p=review.getProposals({basisId,occurrenceIds:ids,cursor,limit:500});
  if(!p?.complete||!Array.isArray(p.items)||!Number.isSafeInteger(p.totalCount)||
    total!==null&&total!==p.totalCount)
    fail('PRESENTATION_PROPOSAL_PAGE_INCOMPLETE','Source-bound candidate list truncated');
  total=p.totalCount;rows.push(...p.items);
  if(p.nextCursor!==null&&(typeof p.nextCursor!=='string'||seen.has(p.nextCursor)))
    fail('PRESENTATION_PROPOSAL_CURSOR_DRIFT','Source-bound candidate cursor invalid');
  if(p.nextCursor!==null)seen.add(p.nextCursor);
  cursor=p.nextCursor;
 }while(cursor!==null);
 if(rows.length!==total)fail('PRESENTATION_PROPOSAL_COUNT_DRIFT','Candidate list is not complete');
 return rows;
}
/** Cross-reference by PRE-CLEAN original branch/node ordinals only. */
export function buildXml229VerifiedWeightRowProjection({
 session,sourceId,physicalOccurrences,originalOccurrences,previewResult,config={}, 
}={}){
 const basisId=session?.basis?.basisId,review=session?.review;
 if(!basisId||!review||!Array.isArray(physicalOccurrences)||
    !originalOccurrences||!previewResult)
  fail('PRESENTATION_VERIFIED_BASIS_REQUIRED','Completed original GC-PW basis is required');
 const branches=new Map(),nodes=new Map(),computedNodes=new Map();
 for(const branch of originalOccurrences.branches||[]){
  if(branch.sourceId!==sourceId||branches.has(branch.branchOccurrenceIndex))
    fail('PRESENTATION_BRANCH_ID_DRIFT','Original branch identity is not unique');
  branches.set(branch.branchOccurrenceIndex,branch);
 }
 for(const node of originalOccurrences.nodes||[]){
  const id=key(node.branchOccurrenceIndex,node.nodeOrdinal);
  if(node.sourceId!==sourceId||nodes.has(id))
    fail('PRESENTATION_NODE_ID_DRIFT','Original node occurrence is not unique');
  nodes.set(id,node);
 }
 for(const node of previewResult.nodeRows||[]){
  if(!Number.isSafeInteger(node.branchOccurrenceIndex)||
      !Number.isSafeInteger(node.sourceNodeOrdinal))
    fail('PRESENTATION_PREVIEW_NODE_NOT_ORIGINAL','Preview node lacks an original-source ordinal');
  const id=key(node.branchOccurrenceIndex,node.sourceNodeOrdinal);
  if(computedNodes.has(id))fail('PRESENTATION_PREVIEW_NODE_DUPLICATE','Duplicate Preview physical node');
  const original=nodes.get(id);
  if(!original||original.nodeNumber!==node.nodeNumber||
    original.componentType!==node.componentType||
    original.componentRefNo!==node.componentRefNo||
    original.endpoint!==node.endpoint)
    fail('PRESENTATION_PREVIEW_SOURCE_DRIFT','Preview node differs from original XML occurrence');
  computedNodes.set(id,node);
 }
 const factRows=allFacts(review,basisId,sourceId);
 const byOccurrence=new Map();
 for(const fact of factRows){
  if(fact.basisId!==basisId||fact.sourceId!==sourceId)
    fail('PRESENTATION_FACT_BASIS_DRIFT','Fact belongs to another InputBasis');
  if(!byOccurrence.has(fact.occurrenceId))byOccurrence.set(fact.occurrenceId,new Map());
  const fields=byOccurrence.get(fact.occurrenceId);
  if(fields.has(fact.fieldId))
    fail('PRESENTATION_DUPLICATE_FIELD','Duplicate verified fact field');
  fields.set(fact.fieldId,fact);
 }
 const rows=new Map();
 for(const id of physicalOccurrences){
  const orig=nodes.get(key(id.branchOccurrenceIndex,id.nodeOrdinal));
  const branch=branches.get(id.branchOccurrenceIndex);
  const occ=id.occurrenceId||JSON.stringify([
    id.sourceId,id.branchOccurrenceIndex,id.nodeOrdinal,id.componentSignature]);
  const fields=byOccurrence.get(occ);
  if(!orig||!branch||!fields||fields.size!==7||rows.has(occ)||
    orig.componentType!==fields.get('component.type')?.value||
    orig.componentRefNo!==fields.get('component.ref')?.value)
    fail('PRESENTATION_PHYSICAL_JOIN_DRIFT','Verified physical row cannot join original facts');
  const calc=computedNodes.get(key(id.branchOccurrenceIndex,id.nodeOrdinal))||null;
  const process=previewResult.branchRows?.[id.branchOccurrenceIndex];
  if(!process||process.branchName!==branch.branchName)
    fail('PRESENTATION_BRANCH_PROCESS_DRIFT','Verified Line Key branch is inconsistent');
  const get=f=>fields.get(f)?.value??null;
  const length=get('length.mm'),bore=get('bore.mm'),rating=get('rating');
  // The seven independently verified FactRecords are authoritative.
  // Optional legacy Preview display fields are not a second engineering
  // authority: a mismatch with FactRecords WITHHOLDS optional DTXR/Hint but
  // cannot invalidate the Worker-held original Preview and approved facts.
  const mismatch=calc&&(
    positive(length)&&positive(calc.lengthMm)&&Math.abs(length-calc.lengthMm)>0.000001||
    positive(bore)&&positive(calc.boreMm)&&Math.abs(bore-calc.boreMm)>0.000001||
    text(rating)&&text(calc.rating)&&text(rating)!==text(calc.rating));
  const display=calc&&!mismatch?calc:null;
  // The original pre-clean physical signature includes exact source NodeName.
  // Never infer it from a display NodeNumber or mutable UI/legacy row.
  let signature;
  try{signature=JSON.parse(id.componentSignature);}catch{
    fail('PRESENTATION_COMPONENT_NAME_UNVERIFIED','Invalid source component signature');
  }
  if(!Array.isArray(signature)||signature.length!==4||
     signature[0]!==orig.componentType||
     signature[1]!==orig.componentRefNo||
     signature[2]!==orig.endpoint||
     typeof signature[3]!=='string')
    fail('PRESENTATION_COMPONENT_NAME_UNVERIFIED','Original NodeName signature does not match source');
  const nodeName=text(signature[3]);
  const inferred=resolveNodeNameValveHint(nodeName,config);
  const inferredValveName=inferred?inferred.code+' → '+inferred.label:'';
  const shortName=inferred?.label||nodeName||text(display?.dtxr).slice(0,56)||orig.componentType;
  const ref=text(orig.componentRefNo).replace(/^=/,'');
  const endpoint=text(orig.endpoint);
  rows.set(occ,Object.freeze({
    basisId,sourceId,occurrenceId:occ,
    branchOccurrenceIndex:id.branchOccurrenceIndex,nodeOrdinal:id.nodeOrdinal,
    branchName:branch.branchName,lineKey:text(process.lineKey),
    componentType:orig.componentType,nodeName,shortName,inferredValveName,nodeNumber:orig.nodeNumber,
    componentRefNoEndpoint:ref&&endpoint?ref+'_'+endpoint:ref,
    boreMm:bore,rating,lengthMm:length,
    dtxr:display?.dtxr||'',dtxrSource:display?.dtxrSource||'',
    dtxrMatchedKey:display?.dtxrMatchedKey||'',
    valveHint:display?.valveHint||'',
    displayMetadataStatus:mismatch?'PREVIEW_METADATA_FACT_CONFLICT':
      display?'VERIFIED_PREVIEW_METADATA':'OPTIONAL_METADATA_UNAVAILABLE',
    sourceKg:get('mass.kg'),
    factAuthority:Object.fromEntries([...fields].map(([field,v])=>[field,{
      authority:v.authority,unit:v.unit,provenance:v.provenance,
    }])),
  }));
 }
 if(rows.size!==physicalOccurrences.length||
   rows.size*7!==factRows.length||byOccurrence.size!==rows.size)
   fail('PRESENTATION_FULL_POPULATION_DRIFT','Unrepresented physical owner/fact detected');
 return Object.freeze({
  count:rows.size,
  get:occurrenceId=>{
   const v=rows.get(occurrenceId);
   if(!v)fail('PRESENTATION_UNSELECTED_OCCURRENCE','Unknown original physical owner');
   return v;
  },
  proposals:ids=>{
   const proposals=allProposals(review,basisId,ids);
   const indexed=new Map(ids.map(x=>[x,[]]));
   for(const p of proposals){
    if(p.basisId!==basisId||!indexed.has(p.occurrenceId))
     fail('PRESENTATION_CROSS_BASIS_PROPOSAL','Candidate belongs to another physical owner');
    indexed.get(p.occurrenceId).push(Object.freeze({
     proposalId:p.proposalId,ranking:p.ranking,value:p.value,unit:p.unit,
     method:p.method,qualified:p.qualified,
     score:p.extensions?.candidate?.score??null,
     matchType:p.extensions?.candidate?.weightMethod||p.method,
     lengthDelta:p.extensions?.candidate?.lengthDelta??null,
     eligibilityReasons:p.eligibilityReasons||[],
     evidenceRefs:p.evidenceRefs||[],
     familyEligibility:p.extensions?.familyEligibility||null,
     masterRowOrdinal:p.extensions?.candidate?.masterRowOrdinal??null,
     candidateBasis:projectXml229WeightCandidateBasis(p),
    }));
   }
   for(const entries of indexed.values())entries.sort((a,b)=>a.ranking-b.ranking);
   return indexed;
  },
 });
}
