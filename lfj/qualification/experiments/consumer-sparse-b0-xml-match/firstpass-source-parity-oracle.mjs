/**
 * #1147 B0-05 authentic SOURCE-level XML/CSV parity oracle.
 * Node-only, source-only qualification (NOT Worker/IDB/real UI acceptance).
 * Imports both actual production matching+CSV functions and the actual B0
 * evidence/record-to-node adapters. Does not use generated XML or fake DTXR.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {
  buildStandaloneDtxrPositionGroups
} from '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-resolution-ledger.js';
import {
  runStandaloneResolverJsonTrace
} from '../../../../tabs/xml-cii-2019-standalone/xml-cii-resolver-json-trace.js';
import {
  decorateJsonTraceMember
} from '../../../../tabs/xml-cii-2019-standalone/xml-cii-json-trace-fields.js';
import {
  buildXmlNodeWiseTraceCsv,buildEvidenceTreeCsv
} from '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-export.js';
import {
  compactMatchingEvidence
} from '../consumer-sparse-b0-consumer/branch-sliced-projection.mjs';
import {slimNode} from './xml-csv-parity.mjs';

const ORIGINAL_SHA='6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288';
const originalPath='Benchmarks/1885Sjson/Sjson.json';
const xmlPaths={
  FIRSTPASS:'Benchmarks/1885Sjson/FirstpassXML',
  EXPECTED:'Benchmarks/1885Sjson/ExpectedXML'
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const attrsWithOwnNode=new Set([
  'JSON_NODE_NO','JSONNODENO','NODE_NO','NODENUMBER','NODE','SEQ','SEQUENCE'
]);
const factKeys=[
  'jsonNodeNo','jsonSequence','branchName','point','bore','type',
  'description','dtxrPs','labeled','name','componentRef','tags','cmpSupGap',
  'path','capturedFields','semanticFields'
];
const normalized=fact=>Object.fromEntries(factKeys.map(key=>
  [key,fact[key]??(key==='point'?null:'')]));
function countStaged(value){
  if(Array.isArray(value))
    return value.reduce((n,child)=>n+countStaged(child),0);
  if(!value||typeof value!=='object')return 0;
  return 1+(Array.isArray(value.children)?countStaged(value.children):0);
}
function originalNodeIsExplicit(raw){
  const attrs=raw?.attributes&&typeof raw.attributes==='object'
    ?raw.attributes:{};
  return Object.entries(attrs).some(([key,value])=>
    attrsWithOwnNode.has(key.toUpperCase())&&value!==null&&
    value!==undefined&&String(value).trim()!=='');
}
// Independent test-side original branch producer reconstruction. This uses
// exactly the real B0 capture/slim adapters and the real original legacy
// per-branch traversal, not a new/duplicated XML matching implementation.
function slimSourceFromOriginal(original,config={}){
  assert.ok(Array.isArray(original)&&original.length,
    'authentic source must have root staged branches');
  let offset=0,facts=0;
  const branches=[];
  for(let rootIndex=0;rootIndex<original.length;rootIndex++){
    const root=original[rootIndex];
    const branch={type:'BRANCH',name:null,children:[]};
    const entries=buildStandaloneDtxrPositionGroups([root],6,config)
      .flatMap(group=>group.entries)
      .sort((a,b)=>a.jsonSequence-b.jsonSequence);
    for(const entry of entries){
      const decorated=decorateJsonTraceMember(entry,config);
      const fact=normalized({...decorated,
        // The real producer reads source-global original occurrence paths and
        // restores the global fallback sequence when a root branch is sliced.
        path:'$['+rootIndex+']'+entry.path.slice(4),
        jsonSequence:offset+entry.jsonSequence,
        jsonNodeNo:originalNodeIsExplicit(entry.raw)?entry.jsonNodeNo:
          String(offset+entry.jsonSequence)
      });
      const node=slimNode({...fact,
        matchingEvidence:compactMatchingEvidence(entry.raw,config)});
      if(branch.name===null)branch.name=fact.branchName;
      assert.equal(branch.name,fact.branchName,'cross-branch fact leaked');
      branch.children.push(node);
      facts++;
    }
    assert.ok(branch.children.length,'empty/missing root domain branch');
    branches.push(branch);
    offset+=countStaged(root);
  }
  return {branches,facts,sourceObjects:offset};
}
function counts(records){
  return records.reduce((out,record)=>
    (out[record.status]=(out[record.status]||0)+1,out),{});
}
const originalBytes=await readFile(originalPath);
assert.equal(originalBytes.length,733806,'real source bytes drift');
assert.equal(sha(originalBytes),ORIGINAL_SHA,'original source SHA drift');
const original=JSON.parse(originalBytes.toString('utf8'));
const config={};
const slice=slimSourceFromOriginal(original,config);
assert.equal(slice.branches.length,13,'root source branch census drift');
assert.equal(slice.facts,266,'source consumer facts census drift');
const outcomes=[];
for(const [kind,xmlPath] of Object.entries(xmlPaths)){
  const xmlText=await readFile(xmlPath,'utf8');
  const input={sourceKind:'xml',sourceText:xmlText,jsonConfig:config};
  const legacy=runStandaloneResolverJsonTrace({...input,stagedJsonText:original});
  const slim=runStandaloneResolverJsonTrace({...input,stagedJsonText:slice.branches});
  const left=legacy.traceResolutionLedger.records,right=slim.traceResolutionLedger.records;
  const actual=counts(left);
  if(kind==='FIRSTPASS'){
    assert.equal(left.length,216,'authentic Firstpass XML count');
    assert.deepEqual(actual,{
      UNRESOLVED:52,RESOLVED_POS:139,RESOLVED_POS_PS:25
    },'authentic Firstpass positive oracle');
  }else{
    assert.equal(left.length,174,'authentic Expected XML count');
    assert.deepEqual(actual,{UNRESOLVED:174},
      'authentic Expected XML is an all-unresolved NEGATIVE fixture');
  }
  assert.deepEqual(right,left,'complete XML resolution ledger changed: '+kind);
  const legacyNode=buildXmlNodeWiseTraceCsv(legacy);
  const slimNodeCsv=buildXmlNodeWiseTraceCsv(slim);
  const legacyEvidence=buildEvidenceTreeCsv(legacy);
  const slimEvidence=buildEvidenceTreeCsv(slim);
  assert.equal(slimNodeCsv,legacyNode,'real Node-wise CSV bytes differ: '+kind);
  assert.equal(slimEvidence,legacyEvidence,'real Evidence Tree CSV bytes differ: '+kind);
  if(kind==='FIRSTPASS')
    assert.ok(Buffer.byteLength(legacyEvidence,'utf8')>103,
      'positive engineering match must have nonempty Evidence Tree');
  outcomes.push({kind,xmlPath,xmlNodes:left.length,
    statuses:actual,matchedXmlNodes:left.filter(r=>r.status.startsWith('RESOLVED_')).length,
    fullLedgerSha256:sha(JSON.stringify(left)),
    nodeWiseCsvSha256:sha(legacyNode),
    evidenceTreeCsvSha256:sha(legacyEvidence),
    nodeWiseCsvBytes:Buffer.byteLength(legacyNode,'utf8'),
    evidenceTreeCsvBytes:Buffer.byteLength(legacyEvidence,'utf8')});
}
console.log('LFJ_B0_AUTHENTIC_SOURCE_PARITY_PASS '+JSON.stringify({
  schema:'LFJ.B0.AuthenticSourceParity.v1',originalPath,
  originalSha256:ORIGINAL_SHA,sourceRoots:slice.branches.length,
  sourceFacts:slice.facts,sourceDomainObjects:slice.sourceObjects,
  outputs:outcomes,sourceOnly:true,engineeringReady:false,
  chromiumWorkerQualified:false,deployedBuildQualified:false
}));
