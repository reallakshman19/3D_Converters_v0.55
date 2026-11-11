import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {prepareXml229PrefinalRestraints} from '../tabs/xml-cii-2019-standalone/integration/xml229-prefinal-restraints.mjs';
import {indexXml229ComponentBodyBores} from '../tabs/xml-cii-2019-standalone/integration/xml229-component-body-bore.mjs';
import {xmlCiiDryRunPreview} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js';
import {projectXmlCiiOccurrences} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {createPreviewBasis} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {openXml229EngineeringFactModel} from '../tabs/xml-cii-2019-standalone/integration/xml229-preview-engineering-fact-producer.mjs';
installWeightBasisXmlDom(globalThis);
const field=(n,k)=>n.getElementsByTagName(k)[0]?.textContent??'';
const node=(id,type,x,extra='')=>`<Node><NodeNumber>${id}</NodeNumber><NodeName>PS${id}/DATUM</NodeName><ComponentType>${type}</ComponentType><Position>${x} 0 0</Position><OutsideDiameter>60.3</OutsideDiameter><WallThickness>3.2</WallThickness>${extra}</Node>`;
const branch='/TRANSFER-3"-CLASS';
const XML=`<PipeStressExport><Pipe><Branch><Branchname>${branch}/B1</Branchname>${node(10,'PIPE',0)}${node(20,'RIGID',100,'<Rigid>2</Rigid><Endpoint>2</Endpoint><ComponentRefNo>R1</ComponentRefNo><Weight>0</Weight><ElementLengthMm>100</ElementLengthMm>')}${[30,40,50,60].map((n,i)=>node(n,'ATTA',200+i*100)).join('')}</Branch></Pipe></PipeStressExport>`;
const staged=()=>[{type:'BRANCH',name:branch,children:[
 {type:'DTXR_POS',attributes:{POSI:'200 0 0'},children:[{type:'REST',attributes:{MDSSUPPTYPE:'PIPE-REST',DTXR:'REST',NAME:'/PS30/DATUM'}}]},
 {type:'DTXR_POS',attributes:{POSI:'300 0 0'},children:[{type:'GT500',attributes:{MDSSUPPTYPE:'GT500',NAME:'/PS40/DATUM',CMPSUPGAP:6}}]},
 {type:'DTXR_POS',attributes:{POSI:'400 0 0'},children:[{type:'ST501',attributes:{MDSSUPPTYPE:'ST501',NAME:'/PS50/DATUM',CMPSUPGAP:8}}]},
]}];
const config={defaultGap:7,defaultFriction:0,defaultStiffness:123456,
 useJsonTraceStagedSource:false,dtxrPositionOffset:{enabled:true,xOffset:0,yOffset:0,zOffset:0}};
const rows=doc=>[...doc.getElementsByTagName('Node')].map(n=>({id:field(n,'NodeNumber'),
 restraints:[...n.getElementsByTagName('Restraint')].map(r=>[field(r,'Type'),field(r,'Gap'),field(r,'Friction')])}));
const stage=(xmlText=XML,source=staged(),cfg=config)=>prepareXml229PrefinalRestraints({xmlText,
 stagedJsonText:JSON.stringify(source),config:structuredClone(cfg)});

test('original JSON REST/GUIDE/LINESTOP and numeric gaps precede fallback; zero friction survives',async()=>{
 const r=await stage();
 assert.deepEqual(rows(r.document).slice(2).map(r=>r.restraints),[
 [['+Y','7','0']],[['GUI','6','-1.010100']],[['LIM','8','-1.010100']],[['+Y','7','0']],
 ]);
 assert.equal(r.proof.originalJsonSha256,await digestUtf8(JSON.stringify(staged())));
});
test('source numeric gap zero beats profile and node gaps',async()=>{
 const source=staged();source[0].children[1].children[0].attributes.CMPSUPGAP=0;
 const xml=XML.replace('<NodeNumber>40</NodeNumber>','<NodeNumber>40</NodeNumber><CMPSUPGAP>9</CMPSUPGAP>');
 const r=await stage(xml,source);
 assert.deepEqual(rows(r.document)[3].restraints,[['GUI','0','-1.010100']]);
});
test('explicit XML type/gap is preserved; only uninformative LIM placeholder is replaced',async()=>{
 const explicit='<Restraint source="owner"><Type>GUI</Type><Gap>11</Gap><Stiffness>123</Stiffness></Restraint>';
 const xml=XML.replace('<NodeNumber>40</NodeNumber>','<NodeNumber>40</NodeNumber>'+explicit)
  .replace('<NodeNumber>50</NodeNumber>','<NodeNumber>50</NodeNumber><Restraint><Type>LIM</Type><Stiffness>0</Stiffness><Gap>0</Gap></Restraint>');
 const r=await stage(xml);
 assert.deepEqual(rows(r.document)[3].restraints,[['GUI','11','']]);
 assert.deepEqual(rows(r.document)[4].restraints,[['LIM','8','-1.010100']]);
});
test('JSON disablement leaves XML unchanged; unrelated branch cannot supply a GUIDE',async()=>{
 const disabled=await stage(XML,staged(),{...config,supportMapping:{version:2,useJsonForRestraints:false}});
 assert(rows(disabled.document).every(n=>n.restraints.length===0));
 const source=staged();source[0].name='/OTHER';
 const r=await stage(XML,source);
 assert(rows(r.document).slice(2).every(n=>n.restraints[0][0]==='+Y'));
});
test('conflicting same-kind JSON gaps fail closed before Final',async()=>{
 const source=staged(),group=source[0].children[1];
 group.children.push({...structuredClone(group.children[0]),attributes:{MDSSUPPTYPE:'GT500',CMPSUPGAP:9}});
 await assert.rejects(stage(XML,source),{code:'PREFINAL_RESTRAINT_GAP_AMBIGUOUS'});
});
test('component body bore follows source FROM OD while endpoint2 port stays intact',()=>{
 const pair=`<PipeStressExport><Pipe><Branch><Branchname>PAIR</Branchname>${node(1,'GASK',-2,'<ElementLengthMm>2</ElementLengthMm>')}${node(2,'FLAN',0,'<Endpoint>1</Endpoint><ComponentRefNo>F</ComponentRefNo>')}${node(3,'FLAN',109,'<Endpoint>2</Endpoint><ComponentRefNo>F</ComponentRefNo><Rigid>2</Rigid><ElementLengthMm>109</ElementLengthMm>').replace('<OutsideDiameter>60.3','<OutsideDiameter>26.7')}</Branch></Pipe></PipeStressExport>`;
 const result=indexXml229ComponentBodyBores({xmlText:pair});
 assert.equal(result.size,1);
 assert.deepEqual(result.get('[0,2]'),{boreMm:50,sourceNodeOrdinal:1,ownerNodeOrdinal:2,
  outsideDiameterMm:60.3,portOutsideDiameterMm:26.7,portDimensionsDiffer:true});
 const doc=new DOMParser().parseFromString(pair,'application/xml');
 assert.equal(field(doc.getElementsByTagName('Node')[2],'OutsideDiameter'),'26.7');
 assert.equal(indexXml229ComponentBodyBores({xmlText:pair.replace('<ComponentRefNo>F</ComponentRefNo>','<ComponentRefNo>OTHER</ComponentRefNo>')}).size,0);
});
test('real Preview → Worker Final geometry → actual native enriched XML/CII with independent negative challenges',async()=>{
 const sourceId='JSON-TRANSFER',masters={},overrides={},selection=[{sourceId,selectionRef:'all'}];
 const stagedSource=JSON.stringify(staged());
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',sources:[{sourceId,mediaType:'application/xml',text:XML}],
  masters,selection,stagedSource,config,overrides,sha256:digestUtf8});
 const original=projectXmlCiiOccurrences({xmlText:XML,sourceId});
 const preview=xmlCiiDryRunPreview(XML,structuredClone(config),stagedSource);
 const opened=await openXml229EngineeringFactModel({basis,
  live:{sources:{[sourceId]:XML},masters,selection,stagedSource,config,overrides},
  xmlText:XML,sourceId,previewResult:{...preview,sourceOccurrences:original,
   engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},expectedOriginalCount:7});
 const packet={schema:'XML229.NativeFinalPhysicalPacket.v1',sourceId,basisId:basis.basisId,
  sourceXmlSha256:await digestUtf8(XML),originalJsonSha256:await digestUtf8(stagedSource),
  finalIntentSha256:'b'.repeat(64),physicalCount:1,nativeCiiReleaseAuthorized:false,
  finalizedGeometry:opened.finalizedGeometry,
  components:opened.physicalOccurrences.map(o=>({occurrenceId:o.occurrenceId,effectiveKg:12.5}))};
 const folder=await mkdtemp(join(tmpdir(),'json-restraint-native-'));
 try{
  await Promise.all([['source.xml',XML],['staged.json',stagedSource],['config.json',JSON.stringify(config)],
   ['packet.json',JSON.stringify(packet)]].map(([name,data])=>writeFile(join(folder,name),data)));
  const python=process.env.PYTHON||(process.platform==='win32'?'python':'python3');
  const result=execFileSync(python,[fileURLToPath(new URL('./xml229-json-restraint-native-check.py',import.meta.url)),folder],{encoding:'utf8'});
  assert.match(result,/SOURCE_JSON_NATIVE_TRANSFER_PASS/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
