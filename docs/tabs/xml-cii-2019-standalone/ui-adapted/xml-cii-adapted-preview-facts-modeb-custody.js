// Agent P B3-A. Independent Mode B raw-source custody verifier, not a combiner.
// No engineering resolution, Weight Match, DOM UI or shared contract mutation.
import {previewOccurrenceId} from './xml-cii-adapted-preview-facts-basis.js';

export class ModeBSourceCustodyError extends Error {
  constructor(code, detail) {
    super(code + ': ' + detail); this.name='ModeBSourceCustodyError';this.code=code;
  }
}
const demand=(ok,code,detail)=>{if(!ok)throw new ModeBSourceCustodyError(code,detail);};
const name=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const kids=(n,tag=null)=>[...(n?.childNodes||[])].filter(x=>x.nodeType===1 && (tag===null||name(x)===tag));
const content=n=>String(n?.textContent??'').trim();
const attr=n=>n?.attributes instanceof Map
  ? [...n.attributes.entries()].sort(([a],[b])=>a.localeCompare(b))
  : [...(n?.attributes||[])].map(x=>[x.name,x.value]).sort(([a],[b])=>a.localeCompare(b));
function parse(xmlText,label) {
  demand(typeof xmlText==='string'&&xmlText.trim(),'MISSING_XML',label);
  demand(typeof DOMParser==='function','MISSING_PARSER',label);
  const doc=new DOMParser().parseFromString(xmlText,'application/xml');
  demand(doc?.documentElement&&doc.getElementsByTagName('parsererror').length===0
    &&name(doc.documentElement)==='PipeStressExport','INVALID_XML',label);
  const pipes=kids(doc.documentElement,'Pipe');
  demand(pipes.length>0,'EMPTY_PIPES',label);
  return {root:doc.documentElement,pipes};
}
function childSignature(a,b,offset,locator) {
  demand(name(a)===name(b)&&a.namespaceURI===b.namespaceURI,
    'MODE_B_ELEMENT_DRIFT',locator);
  demand(JSON.stringify(attr(a))===JSON.stringify(attr(b)),'MODE_B_ATTRIBUTE_DRIFT',locator);
  const ca=kids(a),cb=kids(b);
  demand(ca.length===cb.length,'MODE_B_NODE_POPULATION_DRIFT',locator);
  if(!ca.length){
    let expected=content(a);
    if(name(a)==='NodeNumber') {
      demand(/^-?\d+$/.test(expected)&&Number.isSafeInteger(Number(expected)),
        'INVALID_NODE_NUMBER',locator);
      if(Number(expected)>0) {
        demand(Number.isSafeInteger(Number(expected)+offset),'OFFSET_OVERFLOW',locator);
        expected=String(Number(expected)+offset);
      }
    }
    demand(expected===content(b),'MODE_B_VALUE_DRIFT',locator);
  } else {
    demand(![...(a.childNodes||[])].some(x=>x.nodeType===3&&content(x))
      && ![...(b.childNodes||[])].some(x=>x.nodeType===3&&content(x)),
      'MIXED_XML_CONTENT',locator);
    ca.forEach((aChild,i)=>childSignature(aChild,cb[i],offset,locator+'/'+name(aChild)+'['+i+']'));
  }
}
function header(root) {
  const fields=new Set(['Units','RestrainOpenEnds','AmbientTemperature']);
  return kids(root).filter(x=>fields.has(name(x))).map(x=>[
    name(x),kids(x).length
      ? kids(x).map(y=>[name(y),content(y)]).sort(([a],[b])=>a.localeCompare(b))
      : content(x),
  ]).sort(([a],[b])=>a.localeCompare(b));
}
function nodeIds(pipe,sourceId,state) {
  const ids=[];
  for(const b of kids(pipe,'Branch')) {
    const branchOrdinal=state.nextBranch++;
    ids.push(previewOccurrenceId({sourceId,branchOrdinal}));
    for(const [nodeOrdinal] of kids(b,'Node').entries()) {
      ids.push(previewOccurrenceId({sourceId,branchOrdinal,nodeOrdinal}));
      state.nodes++;
    }
    state.branches++;
  }
  return ids;
}
const digestHex=/^[a-f0-9]{64}$/;
export async function attestXmlCiiModeBSourceCustody({
  basis, config, originalSources, combinedSource, manifest, ports,
}={}) {
  for(const key of ['assertBasisDigest','assertContentDigest','digestCanonical','canonicalJson']){
    demand(typeof ports?.[key]==='function','VALIDATOR_PORT_MISSING',key);
  }
  await ports.assertBasisDigest(basis);
  demand(Array.isArray(originalSources)&&originalSources.length>=2,'ORIGINAL_SOURCES_REQUIRED','Mode B needs >=2 originals');
  demand(typeof config==='object'&&config!==null&&config.modeBManifest,
    'MODE_B_CONFIG_REQUIRED','Frozen InputBasis config must contain exact manifest');
  demand(ports.canonicalJson(config.modeBManifest)===ports.canonicalJson(manifest),
    'MANIFEST_CONFIG_DRIFT','Configured source order differs from supplied manifest');
  demand(await ports.digestCanonical(config)===basis.configSha256,
    'CONFIG_BASIS_DRIFT','Mode B manifest not bound to immutable InputBasis config');
  demand(manifest?.schema==='xml-node-offset-combine/v1'&&Array.isArray(manifest.sourceOrder)
    &&manifest.sourceOrder.length===originalSources.length
    &&manifest.sourceCount===originalSources.length
    &&Number.isSafeInteger(manifest.offsetStep)&&manifest.offsetStep>0
    &&manifest.automaticCrossSourceJoins===0,
    'INVALID_MANIFEST','Source-order manifest invalid or cross-source joins untrusted');
  const set=new Set(), refs=new Map(basis.sourceRefs.map(x=>[x.sourceId,x]));
  demand(refs.size===basis.sourceRefs.length,'DUPLICATE_BASIS_SOURCE','Basis references must be unique');
  demand(refs.size===originalSources.length+1,'BASIS_SOURCE_SCOPE_MISMATCH',
    'InputBasis must bind each original AND combined source');
  // This unit attests an ALL-original-sources basis. Partial branch selections
  // need a separately scoped occurrence challenge; never infer ALL from bytes.
  demand(Array.isArray(basis.scope)&&basis.scope.length===originalSources.length
    &&originalSources.every((entry,i)=>basis.scope[i]?.sourceId===entry.sourceId
      &&basis.scope[i]?.selectionRef==='ALL'),
    'SOURCE_SCOPE_MISMATCH','Basis selection must explicitly bind all original sources in order');
  demand(basis.sourceRefs.every((entry,i)=>entry.sourceId===
    (i<originalSources.length?originalSources[i].sourceId:combinedSource?.sourceId)),
    'BASIS_SOURCE_ORDER_DRIFT','Basis source order must match original+combined order');
  const combinedId=combinedSource?.sourceId;
  demand(typeof combinedId==='string'&&combinedId.trim()&&!set.has(combinedId)
    &&refs.has(combinedId),'COMBINED_SOURCE_NOT_BOUND','Combined source must be in InputBasis');
  set.add(combinedId);
  const combinedRef=refs.get(combinedId);
  demand(digestHex.test(combinedRef.sha256),'INVALID_SOURCE_DIGEST',combinedId);
  await ports.assertContentDigest(combinedSource.xmlText,combinedRef.sha256);
  const combined=parse(combinedSource.xmlText,'combined');
  const baseline=[];
  const expectedIDs=[],sourceTotals=[];
  let previousMaximum=0,combinedPipe=0;
  for(const [i,entry] of originalSources.entries()){
    const meta=manifest.sourceOrder[i];
    const id=entry?.sourceId;
    demand(typeof id==='string'&&id.trim()&&!set.has(id),'DUPLICATE_SOURCE_ID',String(id));
    set.add(id);
    demand(meta?.sourceId===id&&meta.fileName===entry.fileName,
      'SOURCE_ORDER_DRIFT','Manifest identity/order/filename differs at '+i);
    demand(refs.has(id),'ORIGINAL_SOURCE_NOT_BOUND',id);
    const ref=refs.get(id);
    demand(digestHex.test(ref.sha256),'INVALID_SOURCE_DIGEST',id);
    await ports.assertContentDigest(entry.xmlText,ref.sha256);
    const original=parse(entry.xmlText,id);
    demand(meta.pipeCount===original.pipes.length,'PIPE_COUNT_DRIFT',id);
    if(!baseline.length)baseline.push(original.root);
    demand(original.root.namespaceURI===baseline[0].namespaceURI
      &&ports.canonicalJson(header(original.root))===ports.canonicalJson(header(baseline[0])),
      'ENGINEERING_HEADER_DRIFT',id);
    const positive=new Set();
    for(const pipe of original.pipes) for(const node of pipe.getElementsByTagName('NodeNumber')) {
      const n=content(node);
      demand(/^-?\d+$/.test(n)&&Number.isSafeInteger(Number(n)),'INVALID_NODE_NUMBER',id);
      if(Number(n)>0)positive.add(Number(n));
    }
    const offset=i===0?0:Math.ceil(previousMaximum/manifest.offsetStep)*manifest.offsetStep;
    let max=0;
    for(const value of positive)if(value>max)max=value;
    demand(Number.isSafeInteger(offset+max),'OFFSET_OVERFLOW',id);
    const numberMap=[...positive].sort((a,b)=>a-b).map(n=>({sourceNumber:n,outputNumber:n+offset}));
    demand(meta.offset===offset&&meta.positiveIdCount===positive.size
      &&ports.canonicalJson(meta.numberMap)===ports.canonicalJson(numberMap),
      'OFFSET_MANIFEST_DRIFT',id);
    const count={sourceId:id,pipeCount:original.pipes.length,branches:0,nodes:0,nextBranch:0};
    for(const [j,pipe] of original.pipes.entries()){
      const target=combined.pipes[combinedPipe++];
      demand(Boolean(target),'COMBINED_PIPE_MISSING',id+'/Pipe['+j+']');
      childSignature(pipe,target,offset,id+'/Pipe['+j+']');
      for(const occurrenceId of nodeIds(pipe,id,count))expectedIDs.push(occurrenceId);
    }
    sourceTotals.push({sourceId:id,pipeCount:count.pipeCount,
      branchCount:count.branches,nodeCount:count.nodes,offset});
    previousMaximum=Math.max(previousMaximum,offset+max);
  }
  demand(combinedPipe===combined.pipes.length,'COMBINED_PIPE_EXTRA','Combined has extra pipes');
  demand(manifest.headerSource===originalSources[0].fileName,
    'HEADER_SOURCE_DRIFT','Manifest header source is not first original');
  // Combined envelope outside the Pipe population must equal first raw source,
  // including namespace/units/configuration and other preserved export metadata.
  demand(combined.root.namespaceURI===baseline[0].namespaceURI
    &&ports.canonicalJson(attr(combined.root))===ports.canonicalJson(attr(baseline[0])),
    'COMBINED_ROOT_DRIFT','Combined root metadata differs from first source');
  const a=kids(baseline[0]).filter(x=>name(x)!=='Pipe');
  const b=kids(combined.root).filter(x=>name(x)!=='Pipe');
  demand(a.length===b.length,'COMBINED_HEADER_DRIFT','Non-Pipe metadata count drift');
  a.forEach((n,i)=>childSignature(n,b[i],0,'combined-header/'+name(n)+'['+i+']'));
  demand(new Set(expectedIDs).size===expectedIDs.length,
    'ORIGINAL_OCCURRENCE_ALIAS','Source-local ordinal identities collided');
  const receipt={
    schema:'xml-cii-preview-modeb-custody/v1',basisId:basis.basisId,
    combinedSourceId:combinedId,combinedSha256:combinedRef.sha256,
    manifestSha256:await ports.digestCanonical(manifest),
    originalSources:originalSources.map(s=>({sourceId:s.sourceId,sha256:refs.get(s.sourceId).sha256})),
    sourceTotals,branchCount:sourceTotals.reduce((s,x)=>s+x.branchCount,0),
    nodeCount:sourceTotals.reduce((s,x)=>s+x.nodeCount,0),
    occurrenceIds:expectedIDs,
    engineeringAccepted:false,
  };
  return Object.freeze({...receipt,originalSources:Object.freeze(receipt.originalSources.map(x=>Object.freeze(x))),
    sourceTotals:Object.freeze(sourceTotals.map(x=>Object.freeze(x))),
    occurrenceIds:Object.freeze(expectedIDs)});
}
