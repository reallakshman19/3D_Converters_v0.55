/**
 * XML229 P4-A — independent original-XML / actual Preview computation
 * -> canonical GC-PW engineering FactRecords. This is NOT a source-only index.
 *
 * Single Mode A original XML, full original branch selection only. The
 * upstream legacy Worker may report NOT_ASSESSED; only this independent
 * source/mapping/coverage verification may produce a VERIFIED model.
 * Final/Match-1 engineering DECISIONS remain separate and NEVER automatic.
 *
 * Caller must execute this in an isolated Worker for large source data.
 */
import {
  attestLiveBasis,physicalOccurrenceId,
} from '../../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {assertBasisDigest,canonicalJson,digestCanonical,digestUtf8,validateFactRecord,validatePage}
  from '../../../contracts/gc-pw-v1/contract.mjs';
import {isolatedOriginalPreviewWorkConfig} from './xml229-original-preview-work-config.mjs';
import {finalizeXml229WeightGeometry} from './xml229-finalized-weight-geometry.mjs';
import {prepareXml229PrefinalRestraints} from './xml229-prefinal-restraints.mjs';
import {indexXml229ComponentBodyBores} from './xml229-component-body-bore.mjs';
import {projectXmlCiiOccurrences}
  from '../ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {preparePreviewNodeOccurrenceDocument}
  from '../ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js';
import {openPreviewFactReadModel}
  from '../ui-adapted/xml-cii-adapted-preview-facts-read-model.js';
import {isXmlCiiWeightReviewNode,isXmlCiiWeightReviewConnectionEligible}
  from '../../../converters/xml-cii2019-core/weight-match-model.js';
import {isXml229NonOwnerRigidBranchInlet}
 from '../../../converters/xml-cii2019-core/xml229-nonowner-rigid-branch-inlet.mjs';

import {indexXml229PhysicalBores,xml229PhysicalBore} from './xml229-physical-bore-authority.mjs';

const good=v=>typeof v==='string'&&v.trim().length>0;
const num=v=>v===null||v===undefined||String(v).trim()===''?null:
  Number.isFinite(Number(v))?Number(v):null;
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:null;
const name=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const children=(p,n)=>[...(p?.childNodes||[])].filter(x=>x.nodeType===1&&name(x)===n);
const field=(p,n)=>String(children(p,n)[0]?.textContent??'').trim();
const fail=(code,message)=>{const e=new Error(message);e.code=code;e.retryable=false;throw e;};
const recordsFor=(basis,occurrence,fieldId,value,authority,unit=null,detail='')=>{
  const unresolved=value===null||value===undefined||value==='';
  return {schemaVersion:'gc-pw/1.0',domainId:basis.domainId,basisId:basis.basisId,
    subjectType:occurrence.subjectType,sourceId:occurrence.sourceId,
    occurrenceId:occurrence.occurrenceId,fieldId,
    value:unresolved?null:value,unit,
    authority:unresolved?'unresolved':authority,
    provenance:[{sourceRef:occurrence.sourceId,
      locator:occurrence.provenance?.[0]?.locator||'original/ordinal'}],
    diagnostics:unresolved?['ENGINEERING_FIELD_UNRESOLVED:'+fieldId]:[],
    extensions:{producer:'XML229.P4.SourceAttestedEngineeringFacts.v1',
      detail:detail||'original source and Preview computation'},
  };
};
export const XML229_ENGINEERING_FIELDS=Object.freeze([
 'source.occurrence','bore.mm','length.mm','rating','mass.kg',
 'component.type','component.ref',
]);

/**
 * source inputs are from the actual original-XML importer and master buffers,
 * not from an indexed JSON receipt, a Preview cache, or a visible node table.
 * Original Preview worker result MUST be the real source computation; it is
 * checked independently against source ordinals including dropped nodes.
 */
export async function openXml229EngineeringFactModel({
  basis,live,xmlText,sourceId,previewResult,
  expectedOriginalCount,maxPhysical=10000,
}={}){
  if(!good(sourceId)||typeof xmlText!=='string'||!xmlText.trim()||
    !basis||!live||!previewResult||typeof previewResult!=='object')
    fail('ORIGINAL_INPUT_REQUIRED','Original XML, basis, live master bytes and real Preview result required');
  if(!Number.isSafeInteger(maxPhysical)||maxPhysical<1||maxPhysical>100000)
    fail('INVALID_BOUNDED_POPULATION','Physical Worker window cap must be 1..100000');
  await attestLiveBasis({...live,basis});
  if(live.sources?.[sourceId]!==xmlText||basis.sourceRefs?.length!==1||
    basis.sourceRefs[0]?.sourceId!==sourceId||basis.scope?.length!==1||
    basis.scope[0]?.sourceId!==sourceId||
    !['all','ALL','*'].includes(basis.scope[0]?.selectionRef))
    fail('UNSUPPORTED_SOURCE_SCOPE','P4 only admits one complete original XML source, no partial/Mode B scope');
  if(previewResult.engineeringAcceptance!=='NOT_ASSESSED'||
    previewResult.fullFactPopulationAccepted!==false)
    fail('PREVIEW_INPUT_AUTHORITY_DRIFT','P4 must verify source-only Preview computation itself');
  const projection=projectXmlCiiOccurrences({xmlText,mode:'A',sourceId});
  const sourceOriginals=[...projection.branches,...projection.nodes];
  if(expectedOriginalCount!==sourceOriginals.length)
    fail('INDEPENDENT_CENSUS_MISMATCH','Original XML branch/node count is not independently attested');
  if(!Array.isArray(previewResult?.sourceOccurrences?.branches)||
    !Array.isArray(previewResult?.sourceOccurrences?.nodes)||
    !Array.isArray(previewResult.branchRows)||!Array.isArray(previewResult.nodeRows)||
    previewResult.branchRows.length!==projection.branchCount)
    fail('PREVIEW_COMPUTATION_INCOMPLETE','Real Preview branch+node records missing');
  const matching=(source,actual)=>source.length===actual.length&&
    source.every((x,i)=>x.sourceId===actual[i].sourceId&&
      x.occurrenceId===actual[i].occurrenceId);
  if(!matching(projection.branches,previewResult.sourceOccurrences.branches)||
     !matching(projection.nodes,previewResult.sourceOccurrences.nodes))
    fail('ORIGINAL_OCCURRENCE_ID_DRIFT','Preview source identity is different from original XML');
  // Independent source-cleanup calculation cannot mutate the original
 // master/config buffers whose full content is attested by GC-PW.
 const workConfig=isolatedOriginalPreviewWorkConfig(live.config||{});
 const restraintStage=await prepareXml229PrefinalRestraints({
   xmlText,stagedJsonText:live.stagedSource||'',config:workConfig,
 });
 const prepared=preparePreviewNodeOccurrenceDocument({
   xmlText,sourceDocument:restraintStage.document,config:workConfig,
 });
  if(!prepared.document||prepared.ledger.originalCount!==projection.nodeCount)
    fail('SOURCE_CLEANUP_DRIFT','Original source cleanup census incomplete');
  const branches=[...prepared.document.getElementsByTagName('Branch')];
  const sourceNodeByOrdinal=new Map(projection.nodes.map(row=>[
    JSON.stringify([row.branchOccurrenceIndex,row.nodeOrdinal]),row]));
  const boreRows=indexXml229PhysicalBores(previewResult.nodeBoreWallRows,sourceNodeByOrdinal,fail);
  const bodyBores=indexXml229ComponentBodyBores({
    xmlText,config:workConfig,sourceDocument:restraintStage.document,
  });
  const weightRows=new Map();
  for(const row of previewResult.nodeRows){
    if(!Number.isSafeInteger(row.branchOccurrenceIndex)||
      !Number.isSafeInteger(row.sourceNodeOrdinal)||
      row.branchOccurrenceIndex<0||row.branchOccurrenceIndex>=projection.branchCount)
      fail('NONCANONICAL_PREVIEW_NODE','Preview weight row lacks pre-clean original source ordinal');
    const key=JSON.stringify([row.branchOccurrenceIndex,row.sourceNodeOrdinal]);
    if(weightRows.has(key))fail('DUPLICATE_PREVIEW_NODE','Duplicate physical original occurrence');
    const original=sourceNodeByOrdinal.get(key);
    if(!original||original.nodeNumber!==row.nodeNumber||
      original.componentType!==row.componentType||
      original.componentRefNo!==row.componentRefNo||
      original.endpoint!==row.endpoint)
      fail('PREVIEW_SOURCE_JOIN_DRIFT','Computed weight row does not match original physical component');
    weightRows.set(key,row);
  }
  // This physical component selection is part of the final geometry basis,
  // not a post-Final mass transformation. An adjacent same-ref 1 -> 2 pair
  // has ONE mass owner at its second endpoint; its first source occurrence
  // remains fully represented among original facts and final XML geometry.
  const nonOwnerEndpointStarts=new Set();
  const canonicalEndpointPairs=[];
  for(const [bi,branch] of branches.entries()){
    const effective=children(branch,'Node');
    const retained=prepared.ledger.retainedByBranch[bi];
    for(let i=0;i+1<effective.length;i++){
      const a=effective[i],b=effective[i+1];
      const kind=field(a,'ComponentType').toUpperCase();
      const ref=field(a,'ComponentRefNo').trim().replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
      const otherRef=field(b,'ComponentRefNo').trim().replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
      const nextType=field(b,'ComponentType').toUpperCase();
      const sameFamily=kind===nextType&&['RIGID','VALV','FLAN','INST'].includes(kind);
      // Existing FLAN/VALV -> RIGID, same-reference, 1->2 is one
      // source component with a native mass-bearing end, NOT two masses.
      const rigidContinuation=['FLAN','VALV'].includes(kind)&&
        nextType==='RIGID'&&field(b,'Rigid')==='2';
      if(!ref||!(sameFamily||rigidContinuation)||ref!==otherRef||
         field(a,'Endpoint')!=='1'||field(b,'Endpoint')!=='2'||
         !isXmlCiiWeightReviewNode(a)||!isXmlCiiWeightReviewNode(b)||
         !isXmlCiiWeightReviewConnectionEligible(a)||
         !isXmlCiiWeightReviewConnectionEligible(b))continue;
      const left=retained[i].sourceNodeOrdinal,right=retained[i+1].sourceNodeOrdinal;
      const key=JSON.stringify([bi,left]);
      if(nonOwnerEndpointStarts.has(key))
        fail('PHYSICAL_OWNER_ENDPOINT_OVERLAP','Conflicting physical source endpoint groups');
      nonOwnerEndpointStarts.add(key);
      canonicalEndpointPairs.push({branchOccurrenceIndex:bi,
        componentType:kind,componentRefNo:ref,
        firstSourceNodeOrdinal:left,secondSourceNodeOrdinal:right});
    }
  }
  // Cross-branch duplicate inlets remain in original facts and geometry.
  for(const [bi,branch] of branches.entries()){
    const node=children(branch,'Node')[0];
    if(isXml229NonOwnerRigidBranchInlet({node,branchIndex:bi,nodeOrdinal:0,branches})){
      const original=prepared.ledger.retainedByBranch[bi]?.[0];
      if(!original)fail('BRANCH_INLET_ORIGINAL_MISSING','Missing source ordinal');
      nonOwnerEndpointStarts.add(JSON.stringify([bi,original.sourceNodeOrdinal]));
    }
  }
  const originalCensus=[],physical=[],expected=[];
  const records=[];
  const add=(occ,fieldId,val,authority,unit,detail)=>{
    const record=recordsFor(basis,occ,fieldId,val,authority,unit,detail);
    records.push(record);return record;
  };
  // Original branch/node population is ALWAYS complete and independently
  // counted, even where no weight candidate exists.
  for(const branch of projection.branches){
    const index=branch.branchOccurrenceIndex;
    const computed=previewResult.branchRows[index];
    if(computed?.branchName!==branch.branchName)
      fail('BRANCH_COMPUTATION_DRIFT','Preview branch calculation is misordered or wrong-source');
    expected.push(branch);
    add(branch,'source.occurrence',true,'source');
    add(branch,'branch.engineering',true,'derived',null,'verified branch process computation');
  }
  for(const node of projection.nodes){
    expected.push(node);
    add(node,'source.occurrence',true,'source');
    add(node,'node.engineering',true,'derived',null,'verified original-node assessment');
  }
  for(const [branchIndex,branch] of branches.entries()){
    const sourceBranch=projection.branches[branchIndex];
    const computed=previewResult.branchRows[branchIndex];
    const effectiveNodes=children(branch,'Node');
    const ledger=prepared.ledger.retainedByBranch[branchIndex];
    if(effectiveNodes.length!==ledger.length)
      fail('RETAINED_NODE_CENSUS_DRIFT','Effective cleaned source/ledger mismatch');
    for(const [effectiveIndex,node] of effectiveNodes.entries()){
      const origin=ledger[effectiveIndex];
      if(nonOwnerEndpointStarts.has(
        JSON.stringify([branchIndex,origin.sourceNodeOrdinal])))continue;
      if(!isXmlCiiWeightReviewNode(node)||
        !isXmlCiiWeightReviewConnectionEligible(node))continue;
      if(physical.length>=maxPhysical)
        fail('PHYSICAL_POPULATION_LIMIT','Too many selected physical facts for bounded P4 Worker; no main-thread fallback');
      const src=sourceNodeByOrdinal.get(
        JSON.stringify([branchIndex,origin.sourceNodeOrdinal]));
      if(!src||src.componentType!==field(node,'ComponentType')||
         src.componentRefNo!==field(node,'ComponentRefNo')||
         src.endpoint!==field(node,'Endpoint'))
        fail('ORIGINAL_PHYSICAL_IDENTITY_DRIFT','Cleaned physical component cannot be tied to original XML');
      const componentSignature=canonicalJson([
        src.componentType,src.componentRefNo,src.endpoint,field(node,'NodeName')]);
      const identity={sourceId,branchOccurrenceIndex:branchIndex,
        nodeOrdinal:origin.sourceNodeOrdinal,componentSignature};
      const occurrenceId=physicalOccurrenceId(identity);
      const owner={subjectType:'physical-component',sourceId,occurrenceId,
        provenance:src.provenance};
      physical.push({...identity,occurrenceId});
      expected.push(owner);
      const matched=weightRows.get(JSON.stringify([branchIndex,origin.sourceNodeOrdinal]))||null;
      const xmlWeight=positive(num(field(node,'Weight')));
      const boreKey=JSON.stringify([branchIndex,origin.sourceNodeOrdinal]);
      const body=bodyBores.get(boreKey)||null;
      const bore=xml229PhysicalBore(boreRows.get(boreKey),matched,fail,body);
      const rating=String(computed.rating??'').trim();
      // Only use length that was actually computed for the SAME original
      // component or explicitly present in its source. Never guess length.
      const explicitLength=positive(num(field(node,'ElementLengthMm')));
      const derivedLength=matched?positive(num(matched.lengthMm)):null;
      if(derivedLength!==null&&explicitLength!==null&&
        Math.abs(derivedLength-explicitLength)>0.000001)
        fail('PHYSICAL_LENGTH_DRIFT','Preview and original source ElementLengthMm disagree');
      const length=derivedLength??explicitLength;
      add(owner,'source.occurrence',true,'source');
      const boreFact=add(owner,'bore.mm',bore,'derived','mm',body?
        'Source-qualified native component-body OD; owner port dimension retained':
        'Preview resolved original component node bore');
      if(body)boreFact.extensions.componentBody=body;
      add(owner,'length.mm',length,derivedLength===null?'source':'derived','mm',
        derivedLength===null?'Original explicit ElementLengthMm':'Preview computed original source geometry');
      add(owner,'rating',rating||null,'derived',null,'Preview resolved branch rating');
      add(owner,'mass.kg',xmlWeight,'source','kg','Original XML Weight; zero is unresolved, never accepted');
      add(owner,'component.type',src.componentType||null,'source');
      add(owner,'component.ref',src.componentRefNo||null,'source');
    }
  }
  const physicalSet=new Set(physical.map(row=>
    JSON.stringify([row.branchOccurrenceIndex,row.nodeOrdinal])));
  for(const key of weightRows.keys()){
    // Preview still computes source-bound engineering facts for the first
    // endpoint witness of a two-ended part. It is deliberately NOT a
    // second accepted mass owner after the geometry is finalized.
    // Reject every other unselected candidate (e.g. removed GASK).
    if(!physicalSet.has(key)&&!nonOwnerEndpointStarts.has(key))
      fail('UNSELECTED_WEIGHT_COMPUTATION','Preview computed a candidate for a dropped or ineligible physical component');
  }
  // Input may contain components with no ranked suggestions: still emit a
  // complete unresolved FactRecord for them; omission is never a success.
  if(!physical.length)fail('NO_PHYSICAL_WEIGHT_OWNERS','Selected original XML has no physical Weight owner');
  if(records.length!==2*sourceOriginals.length+
    XML229_ENGINEERING_FIELDS.length*physical.length)
    fail('FIELD_POPULATION_DRIFT','Original source physical fields are incomplete');
  const requiredEngineeringFields={
    branch:['branch.engineering'],node:['node.engineering'],
    'physical-component':['bore.mm','length.mm','rating','mass.kg','component.type','component.ref'],
  };
  const ports={assertBasisDigest,canonicalJson,digestCanonical,validateFactRecord,validatePage};
  const model=await openPreviewFactReadModel({
    basis,expectedOccurrences:expected,records,ports,requiredEngineeringFields,
    verifyEngineeringComplete:({records:verified,expectedOccurrences:originals})=>
      verified.length===records.length&&
      originals.length===sourceOriginals.length+physical.length&&
      projection.branchCount===previewResult.branchRows.length,
  });
  if(!model.info.engineeringReady||model.info.computationStage!=='engineering-verified')
    fail('ENGINEERING_NOT_VERIFIED','Independent original/physical population verification did not succeed');
  // The exact cleaned XML inspected by verified Weight Match is the immutable
  // geometry artifact for native Run. Original source ordinals stay in the
  // retained-by-branch ledger; the Worker binds it to the GC-PW source basis.
  if(typeof XMLSerializer!=='function')
    fail('FINALIZED_GEOMETRY_SERIALIZER_REQUIRED','XML serializer unavailable');
  const finalizedGeometry=await finalizeXml229WeightGeometry({
    basis,projection,branches,prepared,physical,sourceNodeByOrdinal,
    nonOwnerEndpointStarts,componentSuppressionPairs:canonicalEndpointPairs,sourceId,
    prefinalRestraints:restraintStage.proof,
  },{children,field,fail,canonicalJson});
  const workerResult=Object.freeze({
    ...previewResult,
    coverage:{
      sourceBranchCount:projection.branchCount,
      originalNodeCount:projection.nodeCount,
      engineeringBranchCount:previewResult.branchRows.length,
      legacyReviewNodeCount:previewResult.nodeRows.length,
      verifiedOriginalOccurrenceCount:sourceOriginals.length,
      verifiedPhysicalOwnerCount:physical.length,
      verifiedPhysicalFactCount:physical.length*XML229_ENGINEERING_FIELDS.length,
    },
    engineeringAcceptance:'VERIFIED',
    fullFactPopulationAccepted:true,
    engineeringFactSnapshotId:model.info.snapshotId,
    engineeringFactCount:records.length,
  });
  return Object.freeze({model,workerResult,finalizedGeometry,
    sourceOccurrenceCensus:sourceOriginals,
    workerOriginalCount:sourceOriginals.length,
    originalOccurrences:projection.nodes.map(({sourceId,branchOccurrenceIndex,nodeOrdinal})=>({
      sourceId,branchOccurrenceIndex,nodeOrdinal,
    })),
    physicalOccurrences:physical,
    expectedOriginalCount:projection.nodeCount,
    expectedModelOccurrenceCount:expected.length,
    expectedPhysicalFactCount:physical.length*XML229_ENGINEERING_FIELDS.length,
    requiredFieldIds:XML229_ENGINEERING_FIELDS,
  });
}
