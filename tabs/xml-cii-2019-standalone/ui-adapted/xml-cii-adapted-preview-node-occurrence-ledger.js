/** Source-stable identities for node cleanup in Preview.
 *
 * Node ordinal in the cleaned working document is NOT a source ordinal.
 * Keep the original PipeStressExport branch/node occurrence before removing
 * GASK and short elements. This is source custody only; not engineering approval.
 */
import {xmlCiiNumberText} from '../../../converters/xml-cii2019-core/weight-match-model.js?v=20261006-p2810042-weight-review-1';
import {xml229OletRouteHelpers} from '../integration/xml229-olet-helper-route.mjs';
import {xml229TeeBranchPortWitnesses} from '../integration/xml229-tee-port-route.mjs';

const str=x=>x==null?'':String(x).trim();
const localName=x=>str(x?.localName||x?.nodeName).replace(/^.*:/,'');
const children=(node,wanted)=>[...(node?.childNodes||[])]
  .filter(child=>child?.nodeType===1&&localName(child)===wanted);
const field=(node,wanted)=>str(children(node,wanted)[0]?.textContent);

function workingDocument(xmlText,sourceDocument){
  if(sourceDocument?.cloneNode){
    try {
      const document=sourceDocument.cloneNode(true);
      return document.getElementsByTagName('parsererror').length?null:document;
    }catch{}
  }
  if(typeof DOMParser!=='function')return null;
  try{
    const document=new DOMParser().parseFromString(String(xmlText??''),'application/xml');
    return document.getElementsByTagName('parsererror').length?null:document;
  }catch{return null;}
}

function dropReason(node,config,thresholdMm){
  const componentType=field(node,'ComponentType').toUpperCase();
  const dropGasket=config.disableGasketNodes===true||
    config.disableGasketInOutput===true||
    (config.dropGasketNodes!==false&&config.dropGasketsInEnrichment!==false);
  if(dropGasket&&componentType==='GASK')return 'GASK';
  const length=xmlCiiNumberText(field(node,'ElementLengthMm'));
  const dropShort=config.dropShortElementLengthNodes!==false&&thresholdMm>0;
  if(dropShort&&length!==null&&length<=thresholdMm)return 'SHORT_ELEMENT';
  return null;
}

/** Return a CLEAN cloned DOM and an immutable original -> effective ledger.
 * Identifiers are branch and node *occurrence ordinals*, never NodeNumber.
 * No caller may reconstruct original ordinals by renumbering cleaned nodes.
 */
export function preparePreviewNodeOccurrenceDocument({
  xmlText,config={},sourceDocument=null,
}={}){
  const document=workingDocument(xmlText,sourceDocument);
  if(!document)return {document:null,ledger:null};
  const thresholdMm=Math.max(0,Number(config.shortElementLengthDropThresholdMm??6));
  const branches=[...document.getElementsByTagName('Branch')];
  const retainedByBranch=[],allByBranch=[];
  let originalCount=0,retainedCount=0,droppedCount=0;
  const visited=new Set();
  for(const [branchOccurrenceIndex,branch] of branches.entries()){
    const retained=[],all=[];
    const branchNodes=children(branch,'Node');
    const oletHelpers=xml229OletRouteHelpers(branchNodes);
    const teeBranchPorts=xml229TeeBranchPortWitnesses(branchNodes);
    for(const [sourceNodeOrdinal,node] of branchNodes.entries()){
      visited.add(node);
      const reason=oletHelpers.has(node)?'OLET_GEOMETRY_HELPER':
        teeBranchPorts.has(node)?'TEE_BRANCH_PORT_WITNESS':
        dropReason(node,config,thresholdMm);
      const row=Object.freeze({
        branchOccurrenceIndex,sourceNodeOrdinal,
        effectiveNodeOrdinal:reason?null:retained.length,
        nodeNumber:field(node,'NodeNumber'),
        componentRefNo:field(node,'ComponentRefNo'),
        endpoint:field(node,'Endpoint'),
        status:reason?'dropped':'retained',
        dropReason:reason,
      });
      originalCount++;
      all.push(row);
      if(reason){node.parentNode?.removeChild(node);droppedCount++;}
      else{retained.push(row);retainedCount++;}
    }
    retainedByBranch.push(Object.freeze(retained));
    allByBranch.push(Object.freeze(all));
  }
  // Keep prior cleanup semantics for any unusual Node outside a Branch.
  for(const node of [...document.getElementsByTagName('Node')]){
    if(!visited.has(node)&&dropReason(node,config,thresholdMm))
      node.parentNode?.removeChild(node);
  }
  const ledger=Object.freeze({
    schema:'XML229.PreviewNodeOccurrenceLedger.v1',
    originalCount,retainedCount,droppedCount,
    retainedByBranch:Object.freeze(retainedByBranch),
    allByBranch:Object.freeze(allByBranch),
  });
  if(retainedCount+droppedCount!==originalCount)
    throw new Error('Preview node occurrence ledger coverage drift; conversion blocked.');
  return {document,ledger};
}
