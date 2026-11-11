/**
 * LFJ/R02 — source-local Site/Zone ownership projection.
 * Consumes already-discovered original occurrences; NEVER inspects descendant
 * JSON substrings, guesses names as occurrence IDs, or creates an export right.
 *
 * R01 classifies root structure; R04/R05 must independently attest source bytes,
 * occurrence paths and raw local attributes before passing facts to this adapter.
 */
export class SourceOwnerError extends TypeError {
  constructor(code,detail){
    super(code+': '+detail);
    this.name='SourceOwnerError';this.code=code;
  }
}
const fail=(code,detail)=>{throw new SourceOwnerError(code,detail);};
const valid=s=>typeof s==='string'&&s.trim().length>0;
const own=(obj,key)=>Object.hasOwn(obj,key);
const clean=x=>typeof x==='string'?x.trim():'';
function record(input,index) {
  if(!input||typeof input!=='object'||Array.isArray(input))
    fail('INVALID_OCCURRENCE','record '+index+' is not a plain occurrence');
  const {sourceId,occurrenceId,parentOccurrenceId}=input;
  if(!valid(sourceId)||!valid(occurrenceId)||
    !(parentOccurrenceId===null||valid(parentOccurrenceId)))
    fail('INVALID_OCCURRENCE','source/occurrence/parent identity missing at '+index);
  if(typeof input.type!=='string'||!input.type.trim())
    fail('INVALID_OCCURRENCE','typed original source node required: '+occurrenceId);
  if(typeof input.name!=='string')
    fail('INVALID_OCCURRENCE','original source node name must be a string');
  const attrs=input.attributes??{};
  if(!attrs||typeof attrs!=='object'||Array.isArray(attrs))
    fail('INVALID_OWN_ATTRIBUTES','own attribute record required: '+occurrenceId);
  for(const key of ['OWNER_SITE','OWNER_ZONE','OWNER','SITE','ZONE_ID']){
    if(own(attrs,key)&&typeof attrs[key]!=='string')
      fail('INVALID_OWNER_VALUE',occurrenceId+' '+key+' must be a string');
  }
  return {sourceId,occurrenceId,parentOccurrenceId,
    type:input.type.trim().toUpperCase(),name:input.name,attrs};
}
function local(owner,key){
  if(!own(owner.attrs,key))return null;
  const s=clean(owner.attrs[key]);
  if(!s)fail('INVALID_OWNER_VALUE',owner.occurrenceId+' '+key+' cannot be blank');
  return s;
}
function declared(owner,primary,alias){
  const a=local(owner,primary),b=local(owner,alias);
  if(a!==null&&b!==null&&a!==b)
    fail('OWNER_CONFLICT',owner.occurrenceId+' '+primary+' disagrees with '+alias);
  return a??b;
}

/**
 * Resolve exact original occurrence IDs, never names or NodeNumber aliases.
 * Output remains one-to-one with the original input record count and order.
 *
 * Site/Zone rights:
 *  - Own OWNER_SITE/OWNER_ZONE takes precedence for THIS node and descendants.
 *  - A typed SITE/ZONE container declares its own name when no own owner field.
 *  - Otherwise the nearest explicit ancestor value inherits unchanged.
 *  - Descendants are never scanned while classifying an ancestor.
 *  - BRANCH OWNER is distinct from Site/Zone; it carries branch provenance.
 * U03 will separately qualify conflicting alias declarations, U04 breadth.
 */
export function resolveSourceOwners(originalOccurrences) {
  if(!Array.isArray(originalOccurrences))
    fail('OCCURRENCES_REQUIRED','an explicit ordered occurrence list is required');
  const rows=originalOccurrences.map(record),byId=new Map();
  const identity=(sourceId,occurrenceId)=>JSON.stringify([sourceId,occurrenceId]);
  for(const node of rows){
    const id=identity(node.sourceId,node.occurrenceId);
    if(byId.has(id))
      fail('DUPLICATE_OCCURRENCE','duplicate original source occurrence '+id);
    byId.set(id,node);
  }
  const cached=new Map(),visiting=new Set();
  function compute(node) {
    const id=identity(node.sourceId,node.occurrenceId);
    if(cached.has(id))return cached.get(id);
    if(visiting.has(id))
      fail('CYCLIC_PARENT','source parent graph contains a cycle at '+id);
    visiting.add(id);
    let parent=null;
    if(node.parentOccurrenceId!==null) {
      const sourceParent=byId.get(identity(node.sourceId,node.parentOccurrenceId));
      if(!sourceParent){
        if(rows.some(other=>other.occurrenceId===node.parentOccurrenceId))
          fail('CROSS_SOURCE_PARENT','parent reference resolves only in another original source');
        fail('MISSING_PARENT','unknown source parent '+node.parentOccurrenceId);
      }
      parent=compute(sourceParent);
    }
    const site=declared(node,'OWNER_SITE','SITE');
    const zone=declared(node,'OWNER_ZONE','ZONE_ID');
    const typedSite=node.type==='SITE'?clean(node.name)||null:null;
    const typedZone=node.type==='ZONE'?clean(node.name)||null:null;
    if(site!==null&&typedSite!==null&&site!==typedSite)
      fail('OWNER_CONFLICT',node.occurrenceId+' typed SITE name conflicts with owner attributes');
    if(zone!==null&&typedZone!==null&&zone!==typedZone)
      fail('OWNER_CONFLICT',node.occurrenceId+' typed ZONE name conflicts with owner attributes');
    const mySite=site??typedSite;
    const myZone=zone??typedZone;
    const branch=local(node,'OWNER');
    const result=Object.freeze({
      sourceId:node.sourceId,occurrenceId:node.occurrenceId,
      parentOccurrenceId:node.parentOccurrenceId,name:node.name,type:node.type,
      ownerSite:mySite??parent?.ownerSite??null,
      ownerSiteSource:mySite!==null?node.occurrenceId:parent?.ownerSiteSource??null,
      ownerZone:myZone??parent?.ownerZone??null,
      ownerZoneSource:myZone!==null?node.occurrenceId:parent?.ownerZoneSource??null,
      branchOwner:branch??parent?.branchOwner??null,
      branchOwnerSource:branch!==null?node.occurrenceId:parent?.branchOwnerSource??null,
      rightsBasis:'ORIGINAL_OWN_ATTRIBUTE_OR_EXPLICIT_ANCESTOR_ONLY',
      engineeringReady:false,
    });
    visiting.delete(id);
    cached.set(id,result);
    return result;
  }
  return Object.freeze(rows.map(node=>compute(node)));
}
