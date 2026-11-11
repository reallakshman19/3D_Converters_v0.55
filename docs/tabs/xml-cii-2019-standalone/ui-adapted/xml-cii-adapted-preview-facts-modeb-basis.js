// Preview P3-B3B1: prepare an attested Mode B basis without mutating the
// combined XML, shared combiner, worker protocol, Weight review or run writer.
import {createPreviewBasis, PreviewBasisError} from './xml-cii-adapted-preview-facts-basis.js';
import {attestXmlCiiModeBSourceCustody} from './xml-cii-adapted-preview-facts-modeb-custody.js';

const requireThat=(condition,code,message)=>{
  if(!condition)throw new PreviewBasisError(code,message);
};
const rows=value=>Array.isArray(value)?value:[];
function master(datasetId,section,data,mapping={}) {
  return {datasetId:String(section?.datasetId||datasetId),
    revision:section?.revision??'source-session-v1',rowCount:data.length,
    rows:data,mapping};
}
function inputMasters(config) {
  return {
    linelist:master('linelist',config.linelist,rows(config.linelist?.masterRows),
      config.linelist?.fieldMap||{}),
    pipingClass:master('pipingClass',config.pipingClass,rows(config.pipingClass?.masterRows),
      config.pipingClass?.fieldMap||{}),
    material:master('material',config.material,rows(config.material?.mapRows),
      config.material?.fieldMap||{}),
    weight:master('weight',config.weight,rows(config.weight?.masterRows),
      config.weight?.fieldMap||{}),
  };
}
function sourceArray(originalSources,combinedSource,manifest) {
  requireThat(Array.isArray(originalSources)&&originalSources.length>=2,
    'ORIGINAL_SOURCES_REQUIRED','Mode B must retain two or more original files');
  requireThat(manifest?.schema==='xml-node-offset-combine/v1'
    &&Array.isArray(manifest?.sourceOrder)
    &&manifest.sourceOrder.length===originalSources.length,
    'MODE_B_MANIFEST_REQUIRED','Combined source manifest and original source count required');
  const ids=new Set();
  const all=[...originalSources,combinedSource];
  return all.map((s,i)=>{
    const id=s?.sourceId;
    requireThat(typeof id==='string'&&id.trim().length>0&&!ids.has(id),
      'DUPLICATE_SOURCE_ID','Mode B original and combined IDs must be unique');
    ids.add(id);
    requireThat(typeof s.xmlText==='string'&&s.xmlText.trim().length>0,
      'MISSING_XML','Full original/combined XML bytes must be available');
    if(i<originalSources.length)requireThat(
      typeof s.fileName==='string'&&s.fileName.trim().length>0
      &&manifest.sourceOrder[i]?.sourceId===id
      &&manifest.sourceOrder[i]?.fileName===s.fileName,
      'SOURCE_ORDER_DRIFT','Original source order/name differs from Mode B manifest');
    return {sourceId:id,mediaType:'application/xml',text:s.xmlText};
  });
}
function preflightPorts(ports) {
  for(const key of ['digestUtf8','digestCanonical','canonicalJson',
    'assertBasisDigest','assertContentDigest']) {
    requireThat(typeof ports?.[key]==='function','VALIDATOR_PORT_MISSING',
      'Integrator GC-PW/1.0 port required: '+key);
  }
}
/**
 * Source custody only. All original input sources and the exact combined output
 * must be present; never infer lineage from similarly named Branches or IDs.
 *
 * config.modeBManifest must already match the combiner's immutable manifest.
 * It is digested with every effective master row/mapping/override. Neither
 * engineeringReady nor acceptance is returned from this preparatory operation.
 */
export async function prepareModeBPreviewBasis({
  originalSources,combinedSource,manifest,config,stagedJsonText=null,ports,
}={}) {
  preflightPorts(ports);
  requireThat(config&&typeof config==='object'&&!Array.isArray(config),
    'CONFIG_REQUIRED','Preview configuration is required');
  requireThat(config.modeBManifest&&manifest&&
    ports.canonicalJson(config.modeBManifest)===ports.canonicalJson(manifest),
    'MANIFEST_CONFIG_DRIFT','Configured manifest must match original Mode B manifest');
  const sources=sourceArray(originalSources,combinedSource,manifest);
  requireThat(stagedJsonText===null||typeof stagedJsonText==='string',
    'INVALID_STAGED_SOURCE','Staged JSON must be text or null');
  const selection=originalSources.map(s=>({sourceId:s.sourceId,selectionRef:'ALL'}));
  const basis=await createPreviewBasis({
    domainId:'xml-cii/2019',sources,selection,
    stagedSource:stagedJsonText&&stagedJsonText.length?stagedJsonText:null,
    masters:inputMasters(config),config,overrides:config.overrides||{},
    sha256:ports.digestUtf8,
  });
  await ports.assertBasisDigest(basis);
  const custody=await attestXmlCiiModeBSourceCustody({
    basis,config,originalSources,combinedSource,manifest,ports,
  });
  requireThat(custody.engineeringAccepted===false,
    'AUTHORITY_DRIFT','Input provenance cannot certify engineering results');
  const boundManifest=JSON.parse(ports.canonicalJson(manifest));
  // Export a detached transport value rather than a mutable reference to the
  // caller's manifest. Actual worker dispatch still rechecks the live inputs.
  const freezeDeep=value=>{
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      for(const part of Object.values(value))freezeDeep(part);
      Object.freeze(value);
    }
    return value;
  };
  return Object.freeze({
    basis,custody,
    scope:freezeDeep({mode:'B',sourceId:combinedSource.sourceId,manifest:boundManifest,
      selection:null}),
    engineeringReady:false,
  });
}
/**
 * Must be called immediately before worker dispatch AND after computation.
 * Resolves a fresh digest and original->combined structural proof. Callers
 * must reject stale results instead of retrying with silently changed data.
 */
export async function assertModeBPreviewBasisFresh(snapshot,input) {
  requireThat(snapshot?.basis?.basisId&&snapshot?.custody?.manifestSha256,
    'MISSING_CUSTODY_SNAPSHOT','Attested original-source snapshot is required');
  const fresh=await prepareModeBPreviewBasis(input);
  requireThat(fresh.basis.basisId===snapshot.basis.basisId
    &&fresh.custody.manifestSha256===snapshot.custody.manifestSha256,
    'STALE_MODE_B_INPUT','Source, masters, overrides or Mode B manifest changed');
  return true;
}
