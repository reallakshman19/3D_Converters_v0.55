/** Normalize the PSI116 L2 Python _canonical(Node) representation.
 * Independent digest checking is evidence, not Weight/Final authority.
 */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
const local=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const elements=n=>[...(n?.childNodes||[])].filter(x=>x.nodeType===1);
export function psi116TopoFixCanonicalNode(node){
 const attrs=node?.attributes instanceof Map
   ?[...node.attributes.entries()]
   :[...(node?.attributes||[])].map(a=>[a.name,a.value]);
 attrs.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 const value=typeof node?._textContent==='string'
   ?node._textContent
   :[...(node?.childNodes||[])].find(x=>x.nodeType===3||x.nodeType===4)?.nodeValue||'';
 return [local(node),attrs,String(value).trim(),
   elements(node).map(psi116TopoFixCanonicalNode)];
}
export async function psi116TopoFixNodeSha256(node){
 return digestUtf8(JSON.stringify(psi116TopoFixCanonicalNode(node)));
}
export function psi116TopoFixBranchNodes(xmlText){
 if(typeof DOMParser!=='function')throw new Error('TOPOFIX_HANDOFF_XML_DOM_REQUIRED');
 const doc=new DOMParser().parseFromString(xmlText,'application/xml');
 const root=doc?.documentElement;
 if(local(root)!=='PipeStressExport')throw new Error('TOPOFIX_HANDOFF_XML_SOURCE_INVALID');
 return [...doc.getElementsByTagName('Branch')].map(br=>
   elements(br).filter(n=>local(n)==='Node'));
}
