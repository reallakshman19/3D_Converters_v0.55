/** L1 source-to-physical evidence. No topology mutation, kg acceptance or CII release. */
import {physicalOccurrenceId} from '../../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {isXml229NonOwnerRigidBranchInlet}
 from '../../../converters/xml-cii2019-core/xml229-nonowner-rigid-branch-inlet.mjs';
export const LINEAGE_SCHEMA='XML229.SourcePhysicalLineage.v1';
export function buildXml229PhysicalLineage({
 basis,projection,branches,prepared,physical,endpointPairs,
 componentSuppressionPairs,nonOwnerEndpointStarts,sourceNodeByOrdinal,sourceId,
},{children,field,canonicalJson,fail}){
 const key=(bi,ordinal)=>JSON.stringify([bi,ordinal]);
 // Geometric pairs are evidence-only. Suppression pairs specifically record
 // which first source endpoint was excluded from the mass-owner census.
 const suppressed=componentSuppressionPairs||[];
 const pairedStarts=new Set(suppressed.map(p=>
   key(p.branchOccurrenceIndex,p.firstSourceNodeOrdinal)));
 if(pairedStarts.size!==suppressed.length||
    [...pairedStarts].some(k=>!nonOwnerEndpointStarts.has(k)))
   fail('PHYSICAL_LINEAGE_PAIR_DRIFT','Suppressed source pairs lack unique nonowner identities');
 const oid=(bi,ord,n)=>{
   const source=sourceNodeByOrdinal.get(key(bi,ord));
   if(!source)fail('PHYSICAL_LINEAGE_SOURCE_MISSING','Missing original source witness');
   return physicalOccurrenceId({sourceId,branchOccurrenceIndex:bi,nodeOrdinal:ord,
     componentSignature:canonicalJson([source.componentType,source.componentRefNo,
       source.endpoint,field(n,'NodeName')])});
 };
 const owners=physical.map(p=>p.occurrenceId),ownerSet=new Set(owners);
 if(ownerSet.size!==owners.length)fail('PHYSICAL_LINEAGE_OWNER_DUPLICATED','Duplicate owner ID');
 const aliases=[];
 for(const [bi,br] of branches.entries()){
   const ns=children(br,'Node'),inlet=ns[0];
   const orig=prepared.ledger.retainedByBranch[bi]?.[0]?.sourceNodeOrdinal;
   if(orig===undefined||!nonOwnerEndpointStarts.has(key(bi,orig))||
      pairedStarts.has(key(bi,orig)))continue;
   if(!isXml229NonOwnerRigidBranchInlet({node:inlet,branchIndex:bi,nodeOrdinal:0,branches}))
     fail('PHYSICAL_LINEAGE_UNPROVEN_ALIAS','Unproven branch connection suppression');
   const matches=[];
   for(let prior=0;prior<bi;prior++){
     const priorNodes=children(branches[prior],'Node');
     const terminal=priorNodes[priorNodes.length-1];
     if(terminal&&field(terminal,'Endpoint')==='2'&&
        field(terminal,'Rigid')==='2'&&
        field(terminal,'ComponentType').toUpperCase()==='RIGID'&&
        field(terminal,'NodeNumber')===field(inlet,'NodeNumber')&&
        field(terminal,'Position')===field(inlet,'Position')){
       const old=prepared.ledger.retainedByBranch[prior]?.[priorNodes.length-1]?.sourceNodeOrdinal;
       if(old===undefined)fail('PHYSICAL_LINEAGE_SOURCE_MISSING','Missing terminal ordinal');
       matches.push({prior,old,terminal});
     }
   }
   if(matches.length!==1)fail('PHYSICAL_LINEAGE_ALIAS_AMBIGUOUS','Connection has ambiguous witness');
   const m=matches[0],aliasOccurrenceId=oid(bi,orig,inlet),
     terminalOccurrenceId=oid(m.prior,m.old,m.terminal);
   if(ownerSet.has(aliasOccurrenceId)||!ownerSet.has(terminalOccurrenceId))
     fail('PHYSICAL_LINEAGE_OWNER_ALIAS_DRIFT','Alias has invalid owner relation');
   aliases.push(Object.freeze({
     aliasBranchOccurrenceIndex:bi,aliasSourceNodeOrdinal:orig,aliasOccurrenceId,
     terminalBranchOccurrenceIndex:m.prior,terminalSourceNodeOrdinal:m.old,
     terminalOccurrenceId,
   }));
 }
 const excluded=new Set([...pairedStarts,...aliases.map(a=>
   key(a.aliasBranchOccurrenceIndex,a.aliasSourceNodeOrdinal))]);
 if(excluded.size!==nonOwnerEndpointStarts.size||
    [...excluded].some(k=>!nonOwnerEndpointStarts.has(k)))
   fail('PHYSICAL_LINEAGE_NONOWNER_UNACCOUNTED','Nonowners must be explicitly typed');
 return Object.freeze({
   schema:LINEAGE_SCHEMA,basisId:basis.basisId,sourceId,
   sourceXmlSha256:basis.sourceRefs[0].sha256,
   sourceOriginalNodeOccurrences:projection.nodeCount,
   retainedNodeOccurrences:branches.reduce((n,b)=>n+children(b,'Node').length,0),
   physicalOwnerOccurrenceIds:Object.freeze(owners),
   componentEndpointPairs:Object.freeze(endpointPairs),
   suppressedComponentEndpointPairs:Object.freeze(suppressed),
   branchConnectionAliases:Object.freeze(aliases),
   counts:Object.freeze({
     physicalOwners:owners.length,componentEndpointWitnesses:endpointPairs.length,
     suppressedEndpointWitnesses:suppressed.length,
     branchConnectionAliases:aliases.length,
     sourcePhysicalCandidateOccurrences:owners.length+suppressed.length+aliases.length,
   }),
   weightsAccepted:false,nativeCiiReleaseAuthorized:false,
 });
}
