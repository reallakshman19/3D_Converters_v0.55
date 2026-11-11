/** Match only a uniquely witnessed duplicate RIGID inlet at a later branch head.
 * Ordinary Endpoint=1 source facts remain eligible. No source deletion or CII release.
 */
const name=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const children=(n,k)=>[...(n?.childNodes||[])].filter(x=>x.nodeType===1&&name(x)===k);
const field=(n,k)=>String(children(n,k)[0]?.textContent??'').trim();
export function isXml229NonOwnerRigidBranchInlet({node,branchIndex,nodeOrdinal,branches}={}){
 if(!node||!Array.isArray(branches)||!Number.isSafeInteger(branchIndex)||
    branchIndex<1||branchIndex>=branches.length||nodeOrdinal!==0)return false;
 if(field(node,'Endpoint')!=='1'||field(node,'Rigid')!=='2'||
    field(node,'ComponentType').toUpperCase()!=='RIGID')return false;
 const number=field(node,'NodeNumber'),position=field(node,'Position');
 if(!(Number(number)>0)||!position)return false;
 let matches=0;
 for(let i=0;i<branchIndex;i++){
   const nodes=children(branches[i],'Node'),last=nodes[nodes.length-1];
   if(last&&field(last,'Endpoint')==='2'&&field(last,'Rigid')==='2'&&
      field(last,'ComponentType').toUpperCase()==='RIGID'&&
      field(last,'NodeNumber')===number&&field(last,'Position')===position)
     matches++;
   if(matches>1)return false; // no exclusion on ambiguous identity
 }
 return matches===1;
}
