/** Pre-acceptance XML229 geometry: source-attested IDs, witnessed edges,
 * optional instrument suggestions and one-part physical mass-owner census.
 * These operations never accept kilograms or authorize native CII Run.
 */
import {physicalOccurrenceId} from '../../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {isXmlCiiWeightReviewNode,isXmlCiiWeightReviewConnectionEligible}
  from '../../../converters/xml-cii2019-core/weight-match-model.js';
import {buildXml229PhysicalLineage}
  from './xml229-physical-component-lineage.mjs';

function assignSourceNodeNumbers({projection,branches,prepared,children,field,fail}){
  // Pre-acceptance topology normalization: a nonpositive NodeNumber is an
  // unassigned placeholder, NEVER an approved native connected-node ID.
  // Assign globally unique positive IDs while retaining source ordinals and
  // XML positions. No mass or new physical edges are introduced here.
  const positiveIds=projection.nodes.map(row=>Number(row.nodeNumber))
    .filter(n=>Number.isSafeInteger(n)&&n>0);
  let nextId=positiveIds.reduce((max,n)=>Math.max(max,n),0)+10;
  const assignedNodeNumbers=[];
  for(const [bi,branch] of branches.entries()){
    const effective=children(branch,'Node');
    const ordinals=prepared.ledger.retainedByBranch[bi];
    for(const [slot,node] of effective.entries()){
      const raw=field(node,'NodeNumber');
      const id=Number(raw);
      if(!Number.isSafeInteger(id))
        fail('FINALIZED_NODE_NUMBER_INVALID','Original node ID must be an integer');
      if(id>0)continue;
      if(!Number.isSafeInteger(nextId)||nextId<=0||nextId>2147483647)
        fail('FINALIZED_NODE_NUMBER_OVERFLOW','No available native node number');
      const fieldNode=children(node,'NodeNumber')[0];
      if(!fieldNode)
        fail('FINALIZED_NODE_NUMBER_MISSING','Unnumbered source node cannot be normalized');
      fieldNode.textContent=String(nextId);
      assignedNodeNumbers.push(Object.freeze({
        branchOccurrenceIndex:bi,
        sourceNodeOrdinal:ordinals[slot].sourceNodeOrdinal,
        sourceNodeNumber:raw,finalNodeNumber:nextId,
      }));
      nextId+=10;
    }
  }
  return assignedNodeNumbers;
}

function promoteWitnessedRigidEdges({branches,prepared,children,field}){
  // An actual 1->2 same-ref VALV/FLAN/INST element is a geometrically
  // witnessed physical segment. Classify that EXISTING span as a native
  // rigid mass-bearing edge before any kg can be accepted; never invent a
  // point, split an edge, or move kg onto an adjacent pipe.
  // Only an unset endpoint Rigid field may be given the derived rigid role.
  const rigidEdgePromotions=[];
  for(const [bi,branch] of branches.entries()){
    const effective=children(branch,'Node');
    const retained=prepared.ledger.retainedByBranch[bi];
    for(let i=0;i+1<effective.length;i++){
      const left=effective[i],right=effective[i+1];
      const type=field(left,'ComponentType').toUpperCase();
      const ref=field(left,'ComponentRefNo').trim().replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
      const otherRef=field(right,'ComponentRefNo').trim().replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
      // Owner modeling policy includes INST as a rigid component family.
      // Preserve any explicit first-end instrument classification.
      if(!['VALV','FLAN','INST'].includes(type)||!ref||
         type!==field(right,'ComponentType').toUpperCase()||ref!==otherRef||
         field(left,'Endpoint')!=='1'||field(right,'Endpoint')!=='2'||
         !isXmlCiiWeightReviewNode(left)||!isXmlCiiWeightReviewNode(right)||
         !isXmlCiiWeightReviewConnectionEligible(left)||
         !isXmlCiiWeightReviewConnectionEligible(right)||
         field(right,'Rigid')||(type==='INST'&&field(left,'Rigid')))continue;
      const a=field(left,'Position').split(/\s+/).map(Number);
      const b=field(right,'Position').split(/\s+/).map(Number);
      if(a.length!==3||b.length!==3||
         ![...a,...b].every(Number.isFinite))continue;
      const distanceMm=Math.hypot(...a.map((n,j)=>n-b[j]));
      if(!(distanceMm>6))continue;
      const ns=right.namespaceURI||null;
      const rigid=ns?prepared.document.createElementNS(ns,'Rigid'):
        prepared.document.createElement('Rigid');
      rigid.textContent='2';
      right.appendChild(rigid);
      rigidEdgePromotions.push(Object.freeze({
        branchOccurrenceIndex:bi,
        firstSourceNodeOrdinal:retained[i].sourceNodeOrdinal,
        secondSourceNodeOrdinal:retained[i+1].sourceNodeOrdinal,
        componentType:type,componentRefNo:ref,
        distanceMm,
      }));
    }
  }
  return rigidEdgePromotions;
}

function discoverOptionalInstruments({branches,prepared,children,field}){
  // Advisory only: instrument pairs have a real positive-length span but
  // their stiffness cannot be inferred from the label or a zero Weight field.
  // This list is never a conversion gate and never changes Rigid or Final kg.
  const instrumentModelingSuggestions=[];
  for(const [bi,branch] of branches.entries()){
    const effective=children(branch,'Node');
    const retained=prepared.ledger.retainedByBranch[bi];
    for(let i=0;i+1<effective.length;i++){
      const left=effective[i],right=effective[i+1];
      if(field(left,'ComponentType').toUpperCase()!=='INST'||
         field(right,'ComponentType').toUpperCase()!=='INST'||
         field(left,'Endpoint')!=='1'||field(right,'Endpoint')!=='2'||
         !field(left,'ComponentRefNo')||
         field(left,'ComponentRefNo')!==field(right,'ComponentRefNo')||
         field(left,'Rigid')||field(right,'Rigid'))continue;
      const from=field(left,'Position').trim().split(/\s+/).map(Number);
      const to=field(right,'Position').trim().split(/\s+/).map(Number);
      if(from.length!==3||to.length!==3||
         ![...from,...to].every(Number.isFinite))continue;
      const spanMm=Math.hypot(...from.map((x,j)=>x-to[j]));
      if(!(spanMm>6))continue;
      instrumentModelingSuggestions.push(Object.freeze({
        branchOccurrenceIndex:bi,
        firstSourceNodeOrdinal:retained[i].sourceNodeOrdinal,
        secondSourceNodeOrdinal:retained[i+1].sourceNodeOrdinal,
        componentRefNo:field(left,'ComponentRefNo'),
        spanMm,
        suggestedClassification:'RIGID_CANDIDATE',
        status:'OPTIONAL_REVIEW',
        automaticClassificationApplied:false,
        approvalRequiredToView:false,
        sourceWeightIsAccepted:false,
      }));
    }
  }
  return instrumentModelingSuggestions;
}

function attestPhysicalEndpointPairs({physical,branches,prepared,sourceNodeByOrdinal,sourceId,children,field,canonicalJson}){
  // A physical *part* can have Endpoint=1 and Endpoint=2 XML witnesses.
  // These are not automatically two mass owners. Preserve both source facts,
  // but record their unique one-part lineage BEFORE the Weight review opens.
  // This is evidence only; it never combines or accepts kilograms.
  const byOrdinal=new Map(physical.map(p=>[
    JSON.stringify([p.branchOccurrenceIndex,p.nodeOrdinal]),p]));
  const endpointPairs=[];
  for(const [bi,branch] of branches.entries()){
    const ns=children(branch,'Node');
    const ordinals=prepared.ledger.retainedByBranch[bi];
    for(let i=0;i+1<ns.length;i++){
      const a=ns[i],b=ns[i+1];
      const kind=field(a,'ComponentType').toUpperCase();
      const ref=field(a,'ComponentRefNo').trim().replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
      const otherRef=field(b,'ComponentRefNo').trim().replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
      const nextType=field(b,'ComponentType').toUpperCase();
      const sameFamily=kind===nextType&&['RIGID','VALV','FLAN','INST'].includes(kind);
      const rigidContinuation=['FLAN','VALV'].includes(kind)&&
        nextType==='RIGID'&&field(b,'Rigid')==='2';
      if(!ref||!(sameFamily||rigidContinuation)||ref!==otherRef||
         field(a,'Endpoint')!=='1'||field(b,'Endpoint')!=='2')continue;
      const firstOrdinal=ordinals[i].sourceNodeOrdinal;
      const secondOrdinal=ordinals[i+1].sourceNodeOrdinal;
      const firstSource=sourceNodeByOrdinal.get(JSON.stringify([bi,firstOrdinal]));
      const right=byOrdinal.get(JSON.stringify([bi,secondOrdinal]));
      if(firstSource&&right){
        const signature=canonicalJson([firstSource.componentType,
          firstSource.componentRefNo,firstSource.endpoint,field(a,'NodeName')]);
        const firstOccurrenceId=physicalOccurrenceId({
          sourceId,branchOccurrenceIndex:bi,
          nodeOrdinal:firstOrdinal,componentSignature:signature});
        endpointPairs.push(Object.freeze({
          componentType:kind,componentRefNo:ref,branchOccurrenceIndex:bi,
          firstOccurrenceId,secondOccurrenceId:right.occurrenceId,
          firstIsWeightOwner:false,secondIsWeightOwner:true,
        }));
      }
    }
  }
  return endpointPairs;
}

export async function finalizeXml229WeightGeometry({
  basis,projection,branches,prepared,physical,sourceNodeByOrdinal,
  nonOwnerEndpointStarts,componentSuppressionPairs=[],sourceId,prefinalRestraints,
},{children,field,fail,canonicalJson}){
  const assignedNodeNumbers=assignSourceNodeNumbers({
    projection,branches,prepared,children,field,fail,
  });
  const rigidEdgePromotions=promoteWitnessedRigidEdges({
    branches,prepared,children,field,
  });
  const instrumentModelingSuggestions=discoverOptionalInstruments({
    branches,prepared,children,field,
  });
  const finalXmlText=new XMLSerializer().serializeToString(prepared.document);
  const endpointPairs=attestPhysicalEndpointPairs({
    physical,branches,prepared,sourceNodeByOrdinal,sourceId,children,field,canonicalJson,
  });
  const physicalLineage=buildXml229PhysicalLineage({
    basis,projection,branches,prepared,physical,endpointPairs,
    componentSuppressionPairs,
    nonOwnerEndpointStarts,sourceNodeByOrdinal,sourceId,
  },{children,field,fail,canonicalJson});
  // Legacy physical witness count excludes a cross-branch connection alias.
  const physicalOwnerCardinality=Object.freeze({
    schema:'XML229.PreAcceptancePhysicalPartCardinality.v2',
    sourcePhysicalNodeOccurrences:physical.length+endpointPairs.length,
    reviewedPhysicalNodeOccurrences:physical.length,
    pairedEndpointPhysicalParts:endpointPairs.length,
    distinctPhysicalPartCandidates:physical.length,
    endpointPairs:Object.freeze(endpointPairs),
    weightsAccepted:false,
  });
  const finalizedGeometry=Object.freeze({
    schema:'XML229.FinalizedWeightGeometry.v1',
    ...(prefinalRestraints?{prefinalRestraints}:{}),
    physicalOwnerCardinality,
    physicalLineage,
    basisId:basis.basisId,sourceXmlSha256:basis.sourceRefs[0].sha256,
    xmlText:finalXmlText,sha256:await digestUtf8(finalXmlText),
    originalNodeCount:prepared.ledger.originalCount,
    assignedNodeNumbers:Object.freeze(assignedNodeNumbers),
    rigidEdgePromotions:Object.freeze(rigidEdgePromotions),
    instrumentModelingSuggestions:Object.freeze(instrumentModelingSuggestions),
    retainedSourceOrdinalsByBranch:prepared.ledger.retainedByBranch.map(
      rows=>rows.map(row=>row.sourceNodeOrdinal)),
  });
  return finalizedGeometry;
}
