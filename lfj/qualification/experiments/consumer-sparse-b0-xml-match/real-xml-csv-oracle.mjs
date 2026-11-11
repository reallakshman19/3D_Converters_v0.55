/**
 * Independent original XML+complete original JSON golden for true 3D Converter
 * Resolver matching, Evidence Tree CSV and Node-wise Trace CSV.
 * Whole JSON.parse is TEST-ONLY on Node; browser workers never do this.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {runStandaloneResolverJsonTrace} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-resolver-json-trace.js';
import {buildStandaloneDtxrPositionGroups} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-resolution-ledger.js';
import {decorateJsonTraceMember} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-json-trace-fields.js';
import {buildEvidenceTreeCsv,buildXmlNodeWiseTraceCsv} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-export.js';

const fixtures={
  SMALL:{json:'Benchmarks/1885Sjson/Sjson.json',
    xml:'Benchmarks/1885Sjson/ExpectedXML'},
  FIRSTPASS:{json:'Benchmarks/1885Sjson/Sjson.json',
    xml:'Benchmarks/1885Sjson/FirstpassXML'},
  LARGE:{json:'Benchmarks/1885_NC/1885_NC.json',
    xml:'Benchmarks/1885_NC/1885_NC.topology.input.xml'}
};
const size=process.env.B0_SIZE||'SMALL',files=fixtures[size];
const mode=process.env.B0_XML_MODE||'AUTHENTIC';
assert.ok(['AUTHENTIC','SOURCE_DERIVED_CONTROL'].includes(mode));
assert.ok(files,'SMALL or LARGE authentic input is required');
const original=await readFile(files.json),xml=await readFile(files.xml);
const full=JSON.parse(original.toString('utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
let sourceOccurrences=0;
const stack=[full];
while(stack.length){
  const value=stack.pop();sourceOccurrences++;
  if(value&&typeof value==='object'){
    const children=Array.isArray(value)?value:Object.values(value);
    for(let i=children.length-1;i>=0;i--)stack.push(children[i]);
  }
}
const config={};
const entries=buildStandaloneDtxrPositionGroups(full,6,config)
  .flatMap(group=>group.entries).sort((a,b)=>a.jsonSequence-b.jsonSequence);
const factKeys=['jsonNodeNo','jsonSequence','branchName','point','bore','type',
  'description','dtxrPs','labeled','name','componentRef','tags','cmpSupGap',
  'path','capturedFields','semanticFields'];
const normalized=m=>Object.fromEntries(factKeys
  .map(key=>[key,m[key]??(key==='point'?null:'')]));
const facts=entries.map(e=>normalized(decorateJsonTraceMember(e,config)));
const xmlEscape=v=>String(v??'').replaceAll('&','&amp;')
  .replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&apos;');
function buildOriginalDerivedControlXml(sourceEntries){
  const eligible=sourceEntries.filter(e=>e.point&&e.branchName);
  assert.ok(eligible.length>=1,'authentic source needs coordinate-bearing facts');
  const pos=eligible[0];
  const freq=new Map();
  for(const item of sourceEntries)
    for(const tag of new Set(item.tags||[]))
      freq.set(tag,(freq.get(tag)||0)+1);
  const withSupport=eligible.find(e=>(e.tags||[]).some(t=>freq.get(t)===1));
  assert.ok(withSupport,
    'authentic source needs unique original support tag for positive fallback control');
  const psTag=withSupport.tags.find(t=>freq.get(t)===1);
  const branch=v=>'<Branchname>'+xmlEscape(v)+'</Branchname>';
  const point=p=>'E='+p.x+' N='+p.y+' EL='+p.z;
  const node=(number,nodeName,position='')=>
    '<Node><NodeNumber>'+number+'</NodeNumber><NodeName>'+
    xmlEscape(nodeName)+'</NodeName><ComponentType>SUPPORT</ComponentType>'+
    (position?'<Position>'+xmlEscape(position)+'</Position>':'')+
    '</Node>';
  // Third XML node deliberately does not match, so the CSV must prove both
  // positive and negative status in one meaningful original-derived corpus.
  const distant={x:pos.point.x+1000000,y:pos.point.y+1000000,z:pos.point.z+1000000};
  const text='<?xml version="1.0" encoding="utf-8"?><Root>'+
    branch(pos.branchName)+node('B0-POS-1','NO-SUPPORT-TAG',
      point(pos.point))+
    branch(withSupport.branchName)+node('B0-PS-2',psTag)+
    branch(pos.branchName)+node('B0-NEG-3','NO-SUPPORT-TAG',
      point(distant))+'</Root>';
  return {text,selection:{pos:pos.path,ps:withSupport.path,
    supportTag:psTag,expectedNegative:'B0-NEG-3'}};
}
const derivedControl=mode==='SOURCE_DERIVED_CONTROL'?
  buildOriginalDerivedControlXml(entries):null;
const xmlInput=derivedControl?
  Buffer.from(derivedControl.text,'utf8'):xml;
const pageSHA=[];
for(let n=0;n<facts.length;n+=128)
  pageSHA.push(sha(JSON.stringify(facts.slice(n,n+128))));
const projectionSha256=sha(pageSHA.join('\n'));
// The test oracle intentionally invokes real application Resolver + CSV
// exporters, not the experimental adapter being qualified.
const legacy=runStandaloneResolverJsonTrace({
  sourceKind:'xml',sourceText:xmlInput.toString('utf8'),
  stagedJsonText:full,jsonConfig:config
});
const records=legacy.traceResolutionLedger.records;
const nodeCsv=buildXmlNodeWiseTraceCsv(legacy);
const evidenceCsv=buildEvidenceTreeCsv(legacy);
const oracle={
  originalBytes:original.length,originalSha256:sha(original),
  sourceOccurrences,sourceFacts:facts.length,
  projectionSha256,xmlBytes:xmlInput.length,xmlSha256:sha(xmlInput),
  xmlNodes:records.length,
  matchedXmlNodes:records.filter(x=>x.status.startsWith('RESOLVED_')).length,
  xmlRecordsSha256:sha(JSON.stringify(records)),
  nodeWiseCsvSha256:sha(nodeCsv),evidenceTreeCsvSha256:sha(evidenceCsv),
  nodeWiseCsvBytes:Buffer.byteLength(nodeCsv,'utf8'),
  evidenceTreeCsvBytes:Buffer.byteLength(evidenceCsv,'utf8'),
  statusCounts:records.reduce((acc,r)=>
    (acc[r.status]=(acc[r.status]||0)+1,acc),{})
};
assert.ok(oracle.xmlNodes>0,'source XML must have real nodes');
if(size==='FIRSTPASS'&&mode==='AUTHENTIC'){
  // Exact ORIGINAL 1885Sjson + FirstpassXML source oracle observed by
  // independently executing the unmodified baseline 3D_Converters Resolver.
  // Guard true positive engineering acceptance, not only spatial candidates
  // or two matching header-only CSV hashes. Every output byte is additionally
  // SHA-compared with the actual legacy engine below.
  assert.equal(oracle.xmlNodes,216,'authentic Firstpass XML node census drift');
  assert.equal(oracle.matchedXmlNodes,164,'authentic Firstpass engineering-positive census drift');
  assert.equal(oracle.statusCounts.RESOLVED_POS,139,'authentic positive POSITION match drift');
  assert.equal(oracle.statusCounts.RESOLVED_POS_PS,25,'authentic combined POS+PS match drift');
  assert.equal(oracle.statusCounts.UNRESOLVED,52,'authentic negative unmatched nodes drift');
  assert.ok(oracle.evidenceTreeCsvBytes>103,
    'real paired FirstpassXML must generate nonempty Evidence Tree CSV');
}
if(derivedControl){
  assert.equal(oracle.xmlNodes,3,'control must test 3 source-derived XML nodes');
  assert.equal(oracle.matchedXmlNodes,2,
    'original POS and PS controls must BOTH resolve on the real legacy engine');
  assert.equal(oracle.statusCounts.RESOLVED_POS,1,
    'original coordinate positive control must be RESOLVED_POS');
  assert.equal(oracle.statusCounts.RESOLVED_PS_FALLBACK,1,
    'original support-tag fallback must be RESOLVED_PS_FALLBACK');
  assert.ok(oracle.evidenceTreeCsvBytes>103,
    'positive control must produce a nonempty Evidence Tree CSV');
  assert.ok((oracle.statusCounts.UNRESOLVED||0)>=1,
    'control must include a genuinely unresolved node');
}
assert.ok(oracle.sourceFacts>0,'real JSON must have projected facts');
console.log('B0_REAL_XML_CSV_LEGACY_ORACLE '+JSON.stringify({size,mode,files,derivedControl,...oracle}));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror',e=>console.error('B0_BROWSER_ERROR',e.message));
  await page.goto('http://127.0.0.1:4200/lfj/qualification/experiments/consumer-sparse-b0-xml-match/xml-csv-original.html');
  await page.waitForFunction(()=>window.__b0XmlCsvReady);
  const result=await page.evaluate(input=>window.runB0RealXmlCsv(input),
    {jsonUrl:'/'+files.json,xmlUrl:'/'+files.xml,oracle,config,
      xmlTextOverride:derivedControl?.text||null,mode});
  assert.equal(result.schema,'LFJ.B0.RealXmlCsvOriginalOracle.v1');
  assert.equal(result.matching.xmlRecordsSha256,oracle.xmlRecordsSha256);
  assert.equal(result.matching.nodeWiseCsvSha256,oracle.nodeWiseCsvSha256);
  assert.equal(result.matching.evidenceTreeCsvSha256,oracle.evidenceTreeCsvSha256);
  console.log('B0_REAL_XML_CSV_CHROMIUM_PASS '+JSON.stringify({size,mode,...result}));
}finally{await browser.close();}
