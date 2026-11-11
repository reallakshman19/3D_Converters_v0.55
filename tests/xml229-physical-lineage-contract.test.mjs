/** L1 source occurrence != topological port != independently reviewed mass owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {projectXmlCiiOccurrences} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {preparePreviewNodeOccurrenceDocument} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js';
import {physicalOccurrenceId} from '../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {canonicalJson} from '../contracts/gc-pw-v1/contract.mjs';
import {buildXml229PhysicalLineage} from '../tabs/xml-cii-2019-standalone/integration/xml229-physical-component-lineage.mjs';
installWeightBasisXmlDom(globalThis);
const XML=`<PipeStressExport><Pipe><Branch><Branchname>HEADER</Branchname>
<Node><NodeNumber>100</NodeNumber><ComponentType>PIPE</ComponentType><Position>0 0 0</Position></Node>
<Node><NodeNumber>110</NodeNumber><ComponentType>RIGID</ComponentType><ComponentRefNo>A</ComponentRefNo><Endpoint>2</Endpoint><Rigid>2</Rigid><Position>1000 0 0</Position></Node>
</Branch><Branch><Branchname>CHILD</Branchname>
<Node><NodeNumber>110</NodeNumber><ComponentType>RIGID</ComponentType><ComponentRefNo>B</ComponentRefNo><Endpoint>1</Endpoint><Rigid>2</Rigid><Position>1000 0 0</Position></Node>
<Node><NodeNumber>120</NodeNumber><ComponentType>RIGID</ComponentType><ComponentRefNo>C</ComponentRefNo><Endpoint>2</Endpoint><Rigid>2</Rigid><Position>1000 500 0</Position></Node>
</Branch></Pipe></PipeStressExport>`;
const children=(n,k)=>[...(n?.childNodes||[])].filter(c=>c.nodeType===1&&
 String(c?.localName||c?.nodeName||'').replace(/^.*:/,'')===k);
const field=(n,k)=>String(children(n,k)[0]?.textContent??'').trim();
const fail=(code)=>{const e=new Error(code);e.code=code;throw e;};
function fixture(){
 const sourceId='SOURCE',projection=projectXmlCiiOccurrences({xmlText:XML,sourceId,mode:'A'});
 const prepared=preparePreviewNodeOccurrenceDocument({xmlText:XML,config:{}});
 const branches=[...prepared.document.getElementsByTagName('Branch')];
 const sourceNodeByOrdinal=new Map(projection.nodes.map(n=>[
   JSON.stringify([n.branchOccurrenceIndex,n.nodeOrdinal]),n]));
 const physical=[[0,1],[1,1]].map(([bi,ord])=>{
   const source=sourceNodeByOrdinal.get(JSON.stringify([bi,ord]));
   const node=children(branches[bi],'Node')[ord];
   const componentSignature=canonicalJson([source.componentType,source.componentRefNo,
     source.endpoint,field(node,'NodeName')]);
   return {sourceId,branchOccurrenceIndex:bi,nodeOrdinal:ord,componentSignature,
     occurrenceId:physicalOccurrenceId({sourceId,branchOccurrenceIndex:bi,
       nodeOrdinal:ord,componentSignature})};
 });
 return {input:{basis:{basisId:'a'.repeat(64),sourceRefs:[{sha256:'b'.repeat(64)}]},
   projection,prepared,branches,physical,sourceId,endpointPairs:[],componentSuppressionPairs:[],
   nonOwnerEndpointStarts:new Set(['[1,0]']),sourceNodeByOrdinal},
   ports:{children,field,canonicalJson,fail},physical};
}
test('L1 distinguishes one cross-branch connection witness from two mass owners',()=>{
 const {input,ports,physical}=fixture();
 const record=buildXml229PhysicalLineage(input,ports);
 assert.equal(record.schema,'XML229.SourcePhysicalLineage.v1');
 assert.deepEqual(record.counts,{physicalOwners:2,componentEndpointWitnesses:0,
   suppressedEndpointWitnesses:0,branchConnectionAliases:1,sourcePhysicalCandidateOccurrences:3});
 assert.equal(record.branchConnectionAliases.length,1);
 assert.equal(record.branchConnectionAliases[0].terminalOccurrenceId,physical[0].occurrenceId);
 assert(!record.physicalOwnerOccurrenceIds.includes(record.branchConnectionAliases[0].aliasOccurrenceId));
 assert.equal(record.sourceOriginalNodeOccurrences,4);
 assert.equal(record.nativeCiiReleaseAuthorized,false);
});
test('L1 refuses unknown nonowners and removed terminal ownership',()=>{
 const {input,ports,physical}=fixture();
 assert.throws(()=>buildXml229PhysicalLineage({...input,
   nonOwnerEndpointStarts:new Set(['[1,0]','[0,0]'])},ports),
   {code:'PHYSICAL_LINEAGE_UNPROVEN_ALIAS'});
 assert.throws(()=>buildXml229PhysicalLineage({...input,physical:[physical[1]]},ports),
   {code:'PHYSICAL_LINEAGE_OWNER_ALIAS_DRIFT'});
});
