/**
 * XML229 explicit native output participation: no JSON receipt can authorize
 * native CII. XML-only is an owner-selected, ephemeral, source-bound opt-out
 * of JSON *participation* in a separately preflighted native XML conversion.
 * No approval is loaded from storage or inferred from a Preview/Weight result.
 */
export const XML229_XML_ONLY_SCHEMA='XML229.ExplicitXmlOnlyApproval.v1';
const signature=x=>JSON.stringify(x??null);
const sourceRow=(state,source=null)=>source||(
  state?.sourceBatch?.sources?.find(x=>x.sourceId===state?.sourceBatch?.activeSourceId)||null);
const receipt=(state,source=null)=>{
  const row=sourceRow(state,source);
  return row?.xml229StagedSourceReceipt||row?.workflow?.xml229StagedSourceReceipt||
    (!row||row.sourceId===state?.sourceBatch?.activeSourceId
      ?state?.xml229StagedSourceReceipt:null)||null;
};
function basis(state,source=null){
  const row=sourceRow(state,source);
  const resolved=row||state;
  return {
    sourceId:row?.sourceId||state.modeASourceId||'',
    sourceText:resolved.sourceText||'',
    sourceFile:resolved.sourceFile||null,
    sourceKind:row?'xml':(state.sourceKind||'auto'),
    stagedJsonFile:resolved.stagedJsonFile||null,
    stagedJsonText:resolved.stagedJsonText||'',
    originalReceipt:receipt(state,row),
    supportConfigJson:resolved.supportConfigJson||'',
    branchSelection:signature(resolved.branchSelection||{}),
    masterContext:state.masterContext||null,
    dependencyRevisions:signature(state.dependencyRevisions||{}),
    options:signature(state.options||{}),
  };
}
export function captureXml229XmlOnlyApproval(state,source=null){
  const b=basis(state,source);
  if(!b.sourceText||b.sourceKind==='inputxml')return null;
  return Object.freeze({schema:XML229_XML_ONLY_SCHEMA,...b});
}
export function isXml229XmlOnlyApproved(state,source=null){
  const row=sourceRow(state,source);
  const saved=row?row.xml229XmlOnlyApproval:state?.xml229XmlOnlyApproval;
  if(saved?.schema!==XML229_XML_ONLY_SCHEMA)return false;
  const now=basis(state,row);
  return Object.keys(now).every(key=>now[key]===saved[key]);
}
export function hasXml229GovernedNativeHold(state={}){
  const enabled=state.sourceBatch?.sources?.filter(x=>x?.enabled!==false);
  if(enabled?.length){
    if(enabled.some(row=>receipt(state,row)&&!isXml229XmlOnlyApproved(state,row)))return true;
    // An O1 receipt detached from enabled rows is never silently ignored.
    if(state.xml229StagedSourceReceipt&&!enabled.some(row=>
      row.sourceId===state.sourceBatch.activeSourceId&&
      isXml229XmlOnlyApproved(state,row)))return true;
    return false;
  }
  return !!state.xml229StagedSourceReceipt&&!isXml229XmlOnlyApproved(state);
}
/**
 * Strip every optional JSON/Worker/review authority from the *executed job*.
 * Preserve loaded independent masters and configured Regex/branch selection,
 * but never carry provenance-less overrides or previously accepted weights.
 */
export function sanitizeXml229XmlOnlyJob(job){
  if(job.sourceKind==='inputxml')throw new Error('XML229_XML_ONLY_REQUIRES_PSI116_XML');
  let config;
  try{config=JSON.parse(String(job.supportConfigJson||'{}'));}
  catch{throw new Error('XML229_XML_ONLY_INVALID_CONFIG');}
  if(!config||typeof config!=='object'||Array.isArray(config))
    throw new Error('XML229_XML_ONLY_INVALID_CONFIG');
  for(const key of [
    'overrides','previewFacts','manualFacts','sifFacts','stagedJsonFacts',
    'jsonTraceFacts','gcPwFacts','gcPwReview','originalJsonFacts',
    'resolvedJsonFacts','weightOverrides','finalizedMatches','acceptedMatches',
    'supportMapperRules','manualElementSideloadResult',
  ])delete config[key];
  if(config.weight&&typeof config.weight==='object'){
    const w=config.weight;
    // Valve Weight master is an independent source. A finalized decision is not.
    config.weight={
      masterRows:Array.isArray(w.masterRows)?w.masterRows:[],
      ...(Number.isSafeInteger(w.masterRevision)?{masterRevision:w.masterRevision}:{}),
    };
  }
  return {
    ...job,stagedJsonText:'',elementSideLoadText:null,
    previewFacts:[],manualFacts:[],sifFacts:[],weightOverrides:{},
    supportMapperRules:[],
    supportConfigJson:JSON.stringify(config),
    options:{...job.options,useRestraintTypeBasedOnJson:false},
  };
}
