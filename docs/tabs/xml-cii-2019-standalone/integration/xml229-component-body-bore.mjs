/** Weight describes one witnessed component span, not its terminal port.
 * Native ELEMENTS OD is the FROM-node OD on this same span. Keep each node's
 * port bore/OD unchanged and expose differing ports as review evidence.
 */
import {preparePreviewNodeOccurrenceDocument}
  from '../ui-adapted/xml-cii-adapted-preview-node-occurrence-ledger.js';
import {resolveXmlCiiBoreAuthority}
  from '../../../converters/xml-cii2019-core/bore-authority.js';
import {isXmlCiiWeightReviewNode,isXmlCiiWeightReviewConnectionEligible}
  from '../../../converters/xml-cii2019-core/weight-match-model.js';
const local=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const children=(n,k)=>[...(n?.childNodes||[])].filter(x=>x.nodeType===1&&local(x)===k);
const field=(n,k)=>String(children(n,k)[0]?.textContent??'').trim();
const ref=n=>field(n,'ComponentRefNo').replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
const key=(bi,ordinal)=>JSON.stringify([bi,ordinal]);
function qualifies(a,b){
  const kind=field(a,'ComponentType').toUpperCase(),other=field(b,'ComponentType').toUpperCase();
  const same=kind===other&&['RIGID','VALV','FLAN','INST'].includes(kind);
  const rigid=['FLAN','VALV'].includes(kind)&&other==='RIGID'&&field(b,'Rigid')==='2';
  return (same||rigid)&&ref(a)&&ref(a)===ref(b)&&field(a,'Endpoint')==='1'&&
    field(b,'Endpoint')==='2'&&[a,b].every(n=>
      isXmlCiiWeightReviewNode(n)&&isXmlCiiWeightReviewConnectionEligible(n));
}
export function indexXml229ComponentBodyBores({xmlText,config={},sourceDocument=null}){
  const prepared=preparePreviewNodeOccurrenceDocument({xmlText,config,sourceDocument});
  const bodies=new Map();
  if(!prepared.document)return bodies;
  for(const [bi,branch] of [...prepared.document.getElementsByTagName('Branch')].entries()){
    const nodes=children(branch,'Node'),ordinals=prepared.ledger.retainedByBranch[bi];
    for(let i=0;i+1<nodes.length;i++){
      const a=nodes[i],b=nodes[i+1];
      if(!qualifies(a,b))continue;
      const od=Number(field(a,'OutsideDiameter'));
      if(!Number.isFinite(od)||od<=0)continue;
      const bore=resolveXmlCiiBoreAuthority({xmlOutsideDiameterMm:od,config}).boreMm;
      if(!Number.isFinite(bore)||bore<=0)continue;
      const portOd=Number(field(b,'OutsideDiameter'));
      bodies.set(key(bi,ordinals[i+1].sourceNodeOrdinal),Object.freeze({
        boreMm:bore,sourceNodeOrdinal:ordinals[i].sourceNodeOrdinal,
        ownerNodeOrdinal:ordinals[i+1].sourceNodeOrdinal,outsideDiameterMm:od,
        portOutsideDiameterMm:Number.isFinite(portOd)&&portOd>0?portOd:null,
        portDimensionsDiffer:Number.isFinite(portOd)&&portOd>0&&Math.abs(portOd-od)>1e-6,
      }));
    }
  }
  return bodies;
}
export function applyXml229ComponentBodyBores({xmlText,config,result,sourceDocument=null}){
  const bodies=indexXml229ComponentBodyBores({xmlText,config,sourceDocument});
  return {...result,nodeRows:(result.nodeRows||[]).map(row=>{
    const body=bodies.get(key(row.branchOccurrenceIndex,row.sourceNodeOrdinal));
    if(!body)return row;
    return {...row,ownerPortBoreMm:row.boreMm,boreMm:body.boreMm,
      bodyBoreSourceNodeOrdinal:body.sourceNodeOrdinal,
      bodyOutsideDiameterMm:body.outsideDiameterMm,
      bodyPortDimensionsDiffer:body.portDimensionsDiffer,
      boreSource:'source-component-body-od',
      boreNeedsReview:row.boreNeedsReview||body.portDimensionsDiffer};
  })};
}
