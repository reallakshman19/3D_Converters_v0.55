/** Explicit source modeling only. Never changes a live source, kg or Final. */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {xml229InstrumentNodeClosings} from './xml229-instrument-source-offsets.mjs';
const require=(ok,code)=>{if(!ok)throw new Error(code);};
const local=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const elements=n=>Array.from(n?.childNodes||[]).filter(n=>n.nodeType===1);
const key=row=>JSON.stringify([row.branchOccurrenceIndex,row.sourceNodeOrdinal]);

function field(node,name){
 const matches=elements(node).filter(n=>local(n)===name);
 require(matches.length<=1,'INSTRUMENT_SOURCE_FIELD_AMBIGUOUS');
 require(!matches.length||matches[0].namespaceURI===node.namespaceURI,
  'INSTRUMENT_SOURCE_FIELD_NAMESPACE_MISMATCH');
 return String(matches[0]?.textContent||'').trim();
}

function position(node){
 const value=field(node,'Position');
 const points=value.split(/\s+/).map(Number);
 require(value&&points.length===3&&points.every(Number.isFinite),
  'INSTRUMENT_SOURCE_POSITION_INVALID');
 return points;
}

function documentNodes(sourceText){
 require(typeof DOMParser==='function','INSTRUMENT_SOURCE_XML_DOM_REQUIRED');
 const doc=new DOMParser().parseFromString(sourceText,'application/xml');
 const all=[];
 const visit=node=>{all.push(node);for(const c of elements(node))visit(c);};
 visit(doc.documentElement);
 require(local(doc.documentElement)==='PipeStressExport'&&
  !all.some(n=>local(n)==='parsererror'),'INSTRUMENT_SOURCE_XML_INVALID');
 return all.filter(n=>local(n)==='Branch').map(b=>elements(b).filter(n=>local(n)==='Node'));
}

function verifyOwner(owner,branches,locations){
 const bi=owner?.branchOccurrenceIndex,ni=owner?.sourceNodeOrdinal;
 require(Number.isSafeInteger(bi)&&bi>=0&&Number.isSafeInteger(ni)&&ni>0&&
  owner.componentType==='INST'&&owner.reason==='INSTRUMENT_RIGID_CLASSIFICATION_NOT_IN_SOURCE',
  'INSTRUMENT_SOURCE_OWNER_INVALID');
 const [a,b]=[branches[bi]?.[ni-1],branches[bi]?.[ni]];
 require(a&&b&&field(a,'ComponentType')==='INST'&&field(b,'ComponentType')==='INST'&&
  field(a,'Endpoint')==='1'&&field(b,'Endpoint')==='2'&&
  field(a,'ComponentRefNo')===owner.componentRefNo&&owner.componentRefNo&&
  field(b,'ComponentRefNo')===owner.componentRefNo&&
  !elements(a).some(n=>local(n)==='Rigid')&&!elements(b).some(n=>local(n)==='Rigid'),
  'INSTRUMENT_SOURCE_PAIR_MISMATCH');
 const from=position(a),to=position(b);
 const span=Math.hypot(...to.map((x,i)=>x-from[i]));
 require(span>6&&Number.isFinite(owner.spanMm)&&Math.abs(span-owner.spanMm)<=1e-6,
  'INSTRUMENT_SOURCE_SPAN_MISMATCH');
 const location=locations.get(key(owner));
 require(location&&Number.isSafeInteger(location.offset)&&location.qname===b.nodeName,
  'INSTRUMENT_SOURCE_RANGE_MISMATCH');
 return Object.freeze({branchOccurrenceIndex:bi,sourceNodeOrdinal:ni,
  componentRefNo:owner.componentRefNo,spanMm:span,
  fromPosition:field(a,'Position'),toPosition:field(b,'Position')});
}

export async function inspectXml229InstrumentSourceReview({sourceText,report}){
 require(typeof sourceText==='string'&&/^[a-f0-9]{64}$/.test(report?.sourceXmlSha256||'')&&
  await digestUtf8(sourceText)===report.sourceXmlSha256,'INSTRUMENT_SOURCE_SHA_MISMATCH');
 require(Array.isArray(report.unsupportedOwners)&&report.unsupportedOwners.length>0,
  'INSTRUMENT_SOURCE_OWNERS_REQUIRED');
 const locations=xml229InstrumentNodeClosings(sourceText),branches=documentNodes(sourceText);
 const rows=report.unsupportedOwners.map(row=>verifyOwner(row,branches,locations));
 require(new Set(rows.map(key)).size===rows.length,'INSTRUMENT_SOURCE_OWNER_DUPLICATE');
 return Object.freeze({sourceXmlSha256:report.sourceXmlSha256,rows:Object.freeze(rows)});
}

export async function createXml229InstrumentSourceRevision({sourceText,report,selectedOwners=[]}){
 const review=await inspectXml229InstrumentSourceReview({sourceText,report});
 require(Array.isArray(selectedOwners),'INSTRUMENT_SOURCE_SELECTION_INVALID');
 const selected=new Set(selectedOwners);
 require(selected.size===selectedOwners.length&&[...selected].every(k=>review.rows.some(r=>key(r)===k)),
  'INSTRUMENT_SOURCE_SELECTION_INVALID');
 const chosen=review.rows.filter(r=>selected.has(key(r)));
 const locations=xml229InstrumentNodeClosings(sourceText);
 let revisedXml=sourceText;
 for(const row of [...chosen].sort((a,b)=>locations.get(key(b)).offset-locations.get(key(a)).offset)){
  const {offset,qname}=locations.get(key(row));
  const prefix=qname.includes(':')?qname.slice(0,qname.lastIndexOf(':')+1):'';
  const insertion='<'+prefix+'Rigid>2</'+prefix+'Rigid>';
  revisedXml=revisedXml.slice(0,offset)+insertion+revisedXml.slice(offset);
 }
 // Parse the new document too; a receipt is source revision evidence, not release.
 documentNodes(revisedXml);
 return Object.freeze({revisedXml,receipt:Object.freeze({
  schema:'XML229.BrowserInstrumentSourceRevision.v1',stage:'OPTIONAL_SOURCE_MODELING',
  oldSourceXmlSha256:review.sourceXmlSha256,newSourceXmlSha256:await digestUtf8(revisedXml),
  selectedCount:chosen.length,remainingBlockedOwners:review.rows.length-chosen.length,
  classificationSelections:chosen.map(r=>({...r,classification:'RIGID'})),
  sourceChanged:chosen.length>0,engineeringApprovalVerified:false,kilogramsAccepted:false,
  reusablePreviousWeightReview:chosen.length===0,nativeCiiReleaseAuthorized:false,
 })});
}
