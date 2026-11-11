/** Resolve source-bound JSON supports before Final, then fill genuine gaps.
 * Never borrow UI XML or change source geometry/physical identity here.
 */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {closeGovernedMdsPositionRestraintsXml}
  from '../xml-cii-mds-restraint-closure.js';
import {closeGovernedAttaDefaultRestraints}
  from '../../../converters/xml-cii2019-core/atta-default-restraint-closure.js';

const local=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const elements=n=>[...(n?.childNodes||[])].filter(x=>x.nodeType===1);
function sourceShape(node){
  const children=elements(node).filter(n=>local(n)!=='Restraint');
  const attrs=[...(node?.attributes||[])].map(a=>[a.name??a[0],a.value??a[1]])
    .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  return [local(node),attrs,children.length?children.map(sourceShape):String(node?.textContent??'')];
}
function parse(text){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)
    throw Object.assign(new Error('Invalid original support XML'),{code:'PREFINAL_RESTRAINT_XML_INVALID'});
  return doc;
}
export async function prepareXml229PrefinalRestraints({xmlText,stagedJsonText='',config={}}){
  const original=parse(xmlText);
  const originalShape=JSON.stringify(sourceShape(original));
  const resolved=closeGovernedMdsPositionRestraintsXml(
    xmlText,stagedJsonText,config,{requireUnambiguous:true});
  const document=resolved.changed?parse(resolved.xmlText):original;
  const fallback=closeGovernedAttaDefaultRestraints(document,config);
  if(originalShape!==JSON.stringify(sourceShape(document)))
    throw Object.assign(new Error('Support staging changed unrelated source fields'),
      {code:'PREFINAL_RESTRAINT_SOURCE_DRIFT'});
  return {document,proof:Object.freeze({schema:'XML229.PrefinalRestraints.v1',
    originalJsonSha256:await digestUtf8(stagedJsonText)}),
    stats:{...resolved.stats,...fallback.stats}};
}
