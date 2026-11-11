// P3-B3B2A: an independent original-file Mode B source-fact census.
// Browser/domain adapter only; GC-PW FactReadModel stays DOM-independent.
import {independentOriginalXmlCensus} from './xml-cii-adapted-preview-facts-browser-read.js';
import {buildXmlCiiSourceFactRecords,openPreviewFactReadModel}
  from './xml-cii-adapted-preview-facts-read-model.js';
import {assertBasisDigest,assertContentDigest,canonicalJson,digestCanonical,validateFactRecord,validatePage}
  from '../../../contracts/gc-pw-v1/contract.mjs';

const ports=Object.freeze({assertBasisDigest,canonicalJson,digestCanonical,validateFactRecord,validatePage});
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const check=(ok,code,message)=>{if(!ok)fail(code,message);};
const name=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const kids=(n,tag)=>[...(n?.childNodes||[])].filter(x=>x.nodeType===1&&name(x)===tag);
const content=n=>String(n?.textContent??'').trim();
function originalValueMap(xmlText,sourceId) {
  const doc=new DOMParser().parseFromString(xmlText,'application/xml');
  check(doc?.documentElement&&doc.getElementsByTagName('parsererror').length===0,
    'SOURCE_XML_INVALID','Original XML invalid: '+sourceId);
  const facts=new Map();
  let branchOrdinal=0;
  for(const pipe of kids(doc.documentElement,'Pipe'))for(const branch of kids(pipe,'Branch')){
    const branchId=JSON.stringify([sourceId,branchOrdinal,null,'']);
    facts.set(branchId,{subjectType:'branch',branchName:content(kids(branch,'Branchname')[0])});
    for(const [ni,node] of kids(branch,'Node').entries()){
      const nodeId=JSON.stringify([sourceId,branchOrdinal,ni,'']);
      const get=tag=>content(kids(node,tag)[0]);
      facts.set(nodeId,{subjectType:'node',nodeNumber:get('NodeNumber'),
        componentType:get('ComponentType'),componentRefNo:get('ComponentRefNo'),
        endpoint:get('Endpoint')});
    }
    branchOrdinal++;
  }
  return facts;
}
/**
 * Requires an independently attested B3-A receipt and all original source XML,
 * not just a combined XML file with an unverified sourceOrder/pipeCount.
 */
export async function openAttestedModeBOriginalFactPages({
  basis,custody,originalSources,sourceOccurrences,
}={}) {
  await assertBasisDigest(basis);
  check(custody?.basisId===basis.basisId&&custody?.engineeringAccepted===false
    &&Array.isArray(custody?.occurrenceIds)&&Array.isArray(custody?.originalSources),
    'SOURCE_CUSTODY_REQUIRED','Mode B requires independently attested original sources');
  check(Array.isArray(originalSources)&&originalSources.length===custody.originalSources.length,
    'SOURCE_POPULATION_DRIFT','Original sources not present');
  const expected=[],originalValues=new Map();
  for(const [i,source] of originalSources.entries()){
    check(source?.sourceId===custody.originalSources[i].sourceId,
      'SOURCE_ORDER_DRIFT','Original source order changed');
    const ref=basis.sourceRefs.find(r=>r.sourceId===source.sourceId);
    check(ref?.sha256===custody.originalSources[i].sha256,
      'SOURCE_BASIS_DRIFT','Original source SHA not bound to receipt');
    await assertContentDigest(source.xmlText,ref.sha256);
    const list=independentOriginalXmlCensus({xmlText:source.xmlText,sourceId:source.sourceId,mode:'A'});
    expected.push(...list);
    for(const [id,value] of originalValueMap(source.xmlText,source.sourceId)) {
      check(!originalValues.has(id),'OCCURRENCE_ALIAS','Duplicate original source occurrence');
      originalValues.set(id,value);
    }
  }
  check(expected.length===custody.occurrenceIds.length
    &&expected.every((item,i)=>item.occurrenceId===custody.occurrenceIds[i]),
    'ATTESTED_OCCURRENCE_DRIFT','Source ordinal census differs from attested receipt');
  check(sourceOccurrences?.schemaVersion==='gc-pw/1.0'
    &&sourceOccurrences?.domainId===basis.domainId
    &&Array.isArray(sourceOccurrences?.branches)&&Array.isArray(sourceOccurrences?.nodes),
    'WORKER_SOURCE_MISSING','Worker did not provide serializable Mode B source facts');
  check(sourceOccurrences.branchCount===sourceOccurrences.branches.length
    &&sourceOccurrences.nodeCount===sourceOccurrences.nodes.length,
    'WORKER_SOURCE_COUNT_DRIFT','Worker source population incomplete');
  for(const record of [...sourceOccurrences.branches,...sourceOccurrences.nodes]){
    const original=originalValues.get(record.occurrenceId);
    check(original&&original.subjectType===record.subjectType
      &&originalSources.some(s=>s.sourceId===record.sourceId),
      'WORKER_OCCURRENCE_UNTRUSTED','Worker source occurrence outside original inputs');
    const fields=record.subjectType==='branch'?['branchName']
      :['componentType','componentRefNo','endpoint'];
    for(const field of fields)check(String(original[field]??'')===String(record[field]??''),
      'WORKER_SOURCE_VALUE_DRIFT','Worker field drift: '+record.occurrenceId+'/'+field);
    if(record.subjectType==='node') {
      // B3-A verified positive offsets and preservation of nonpositive IDs.
      // Compare actual Worker output to the original number + attested offset.
      const offset=custody.sourceTotals.find(x=>x.sourceId===record.sourceId)?.offset;
      check(Number.isSafeInteger(offset),'MISSING_SOURCE_OFFSET','Original source offset absent');
      const sourceNumber=Number(original.nodeNumber);
      check(/^-?\d+$/.test(original.nodeNumber)&&Number.isSafeInteger(sourceNumber),
        'INVALID_NODE_NUMBER','Original NodeNumber is not an integer');
      const expectedNumber=sourceNumber>0?sourceNumber+offset:sourceNumber;
      check(Number.isSafeInteger(expectedNumber)
        &&String(record.nodeNumber)===String(expectedNumber),
        'WORKER_NODE_NUMBER_DRIFT','Worker original/offset NodeNumber mismatch');
    }
  }
  // Facts with source authority must carry the ORIGINAL source NodeNumber,
  // not the Mode B offset that exists solely in the combined computational XML.
  // The exact Worker offset was independently checked above.
  const sourceProjection={
    ...sourceOccurrences,
    nodes:sourceOccurrences.nodes.map(node=>({
      ...node,nodeNumber:originalValues.get(node.occurrenceId).nodeNumber,
    })),
  };
  const facts=buildXmlCiiSourceFactRecords({basisId:basis.basisId,projection:sourceProjection});
  const model=await openPreviewFactReadModel({basis,expectedOccurrences:expected,records:facts,ports});
  check(model.info.engineeringReady===false,
    'ENGINEERING_AUTHORITY_DRIFT','Source-only Mode B facts cannot be accepted engineering facts');
  return Object.freeze({model,branchCount:sourceOccurrences.branchCount,
    nodeCount:sourceOccurrences.nodeCount,sourceCount:originalSources.length,
    engineeringReady:false});
}
