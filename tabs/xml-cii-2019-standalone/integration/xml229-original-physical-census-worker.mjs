/**
 * P4-C: separate, source-only independent original-XML population census.
 * Never reads dryrun nodeRows or the Weight scorer's candidates.
 * Its original branch/node/physical identities challenge the later
 * engineering Worker before any GC-PW review can open.
 */
import {installWeightBasisXmlDom} from '../workers/weight-basis-xml-dom.js';
import {projectXmlCiiOccurrences}
 from '../ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {preparePreviewNodeOccurrenceDocument}
 from '../ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js';
import {isXmlCiiWeightReviewNode,isXmlCiiWeightReviewConnectionEligible}
 from '../../../converters/xml-cii2019-core/weight-match-model.js';
import {isXml229NonOwnerRigidBranchInlet}
 from '../../../converters/xml-cii2019-core/xml229-nonowner-rigid-branch-inlet.mjs';
import {canonicalJson} from '../../../contracts/gc-pw-v1/contract.mjs';
installWeightBasisXmlDom(globalThis);
const PROTOCOL='XML229.P4.OriginalWeightCensus.v1';
const name=v=>String(v?.localName||v?.nodeName||'').replace(/^.*:/,'');
const children=(node,what)=>[...(node?.childNodes||[])]
 .filter(x=>x.nodeType===1&&name(x)===what);
const field=(node,what)=>String(children(node,what)[0]?.textContent??'').trim();
const fail=(code,message)=>{const x=new Error(message);x.code=code;throw x;};
let used=false;
self.addEventListener('message',({data:req})=>{
 if(req?.protocol!==PROTOCOL||req?.kind!=='start'||!req.requestId)return;
 if(used){postMessage({protocol:PROTOCOL,requestId:req.requestId,state:'failed',
  error:{code:'ONE_SHOT_CENSUS'}});return;}
 used=true;
 try{
   if(typeof req.xmlText!=='string'||!req.xmlText.trim()||
      typeof req.sourceId!=='string'||!req.sourceId.trim()||
      !req.config||typeof req.config!=='object')
     fail('MISSING_ORIGINAL_CENSUS_INPUT','Original XML, selected sourceId, current config required');
   const projection=projectXmlCiiOccurrences({
      xmlText:req.xmlText,sourceId:req.sourceId,mode:'A',
   });
   const original=[...projection.branches,...projection.nodes];
   if(original.length>250000)
     fail('ORIGINAL_CENSUS_SIZE_REFUSED',
       'Over 250k original XML occurrences: no synchronous fallback or partial promotion');
   const clean=preparePreviewNodeOccurrenceDocument({
     xmlText:req.xmlText,config:req.config,
   });
   if(!clean.document||clean.ledger.originalCount!==projection.nodeCount)
     fail('CENSUS_CLEANUP_DRIFT','Original source/pre-cleanup ledger differs');
   const nodes=new Map(projection.nodes.map(node=>[
     JSON.stringify([node.branchOccurrenceIndex,node.nodeOrdinal]),node]));
   const eligible=[];
   const branches=[...clean.document.getElementsByTagName('Branch')];
   for(const [branchIndex,branch] of branches.entries()){
     const cleaned=children(branch,'Node');
     const retained=clean.ledger.retainedByBranch[branchIndex];
     if(!retained||retained.length!==cleaned.length)
       fail('RETAINED_CENSUS_DRIFT','Unexpected cleaned physical count');
     // Independent source-only check of the same physical part cardinality:
     // the first end of an adjacent 1->2 matching reference is geometry
     // evidence, not a second weight owner. The second endpoint remains.
     for(const [ordinal,node] of cleaned.entries()){
       const right=cleaned[ordinal+1];
       const type=field(node,'ComponentType').toUpperCase();
       const ref=field(node,'ComponentRefNo').trim().replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
       const rightRef=field(right,'ComponentRefNo').trim().replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
       const rightType=field(right,'ComponentType').toUpperCase();
       const sameFamily=type===rightType&&
         ['RIGID','FLAN','VALV','INST'].includes(type);
       const rigidContinuation=['FLAN','VALV'].includes(type)&&
         rightType==='RIGID'&&field(right,'Rigid')==='2';
       const paired=right&&ref&&(sameFamily||rigidContinuation)&&
         ref===rightRef&&field(node,'Endpoint')==='1'&&
         field(right,'Endpoint')==='2'&&
         isXmlCiiWeightReviewNode(node)&&isXmlCiiWeightReviewNode(right)&&
         isXmlCiiWeightReviewConnectionEligible(node)&&
         isXmlCiiWeightReviewConnectionEligible(right);
       if(paired||isXml229NonOwnerRigidBranchInlet({
         node,branchIndex,nodeOrdinal:ordinal,branches,
       }))continue;
       if(!isXmlCiiWeightReviewNode(node)||
          !isXmlCiiWeightReviewConnectionEligible(node))continue;
       const physical=nodes.get(JSON.stringify([branchIndex,retained[ordinal].sourceNodeOrdinal]));
       if(!physical||physical.componentType!==field(node,'ComponentType')||
         physical.componentRefNo!==field(node,'ComponentRefNo')||
         physical.endpoint!==field(node,'Endpoint'))
         fail('PHYSICAL_SOURCE_ID_DRIFT','Original node differs from independent source census');
       const componentSignature=canonicalJson([
         physical.componentType,physical.componentRefNo,
         physical.endpoint,field(node,'NodeName'),
       ]);
       eligible.push({
         sourceId:req.sourceId,branchOccurrenceIndex:branchIndex,
         nodeOrdinal:physical.nodeOrdinal,componentSignature,
       });
       if(eligible.length>10000)
         fail('PHYSICAL_CENSUS_SIZE_REFUSED',
           'More than 10k physical weight owners; no UI freeze or partial acceptance');
     }
   }
   if(!eligible.length)
     fail('NO_PHYSICAL_WEIGHT_OWNERS','No selected original physical Weight owner');
   postMessage({protocol:PROTOCOL,requestId:req.requestId,state:'completed',
     independentSourceOccurrences:original,
     independentOriginalNodeOccurrences:projection.nodes.map(n=>({
       sourceId:n.sourceId,branchOccurrenceIndex:n.branchOccurrenceIndex,nodeOrdinal:n.nodeOrdinal,
     })),
     independentPhysicalOccurrences:eligible,
     counts:{original:original.length,originalNodes:projection.nodeCount,
       physical:eligible.length,dropped:clean.ledger.droppedCount}});
 }catch(error){
  postMessage({protocol:PROTOCOL,requestId:req.requestId,state:'failed',
   error:{code:error?.code||'INDEPENDENT_CENSUS_FAILED',
     message:String(error?.message||error)}});
 }
 self.close();
});
