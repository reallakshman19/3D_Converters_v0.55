/** Controlled PS-4131 example, not a source witness for Owner's private JSON. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {runStandaloneSupportTypeMapper,createDefaultSupportTypeMapperConfig}
  from '../tabs/xml-cii-2019-standalone/xml-cii-support-type-mapper.js';
import {resolveXmlCiiSupportDescriptor}
  from '../converters/xml-cii2019-core/support-mapping.js';
import {prepareXml229PrefinalRestraints}
  from '../tabs/xml-cii-2019-standalone/integration/xml229-prefinal-restraints.mjs';
import {buildStandaloneDtxrResolutionLedger}
  from '../tabs/xml-cii-2019-standalone/xml-cii-trace-resolution-ledger.js';
import {decorateJsonTraceLedger}
  from '../tabs/xml-cii-2019-standalone/xml-cii-json-trace-fields.js';
import {DEFAULT_RESTRAINT_TYPE_MUTATION_ROWS}
  from '../converters/xml-cii2019-core/restraint-type-mutation.js';

installWeightBasisXmlDom(globalThis);
const branch='/GLRD-1000-4"-B4110003-11502-01/B1';
const members=[
  {tag:'PS-4131.1',kind:'REST',desc:'PIPE REST',node:41311,z:0,sourceType:'17',gap:null,expected:14},
  {tag:'PS-4131.2',kind:'GUIDE',desc:'GUIDE',node:41312,z:100,sourceType:'10',gap:'4.5',expected:8},
  {tag:'PS-4131.3',kind:'LINESTOP',desc:'LINE STOP',node:41313,z:200,sourceType:'7',gap:'7.25',expected:9},
];
const xmlNode=(id,name,type,z)=>'<Node><NodeNumber>'+id+'</NodeNumber>'
  +'<NodeName>'+name+'</NodeName><ComponentType>'+type+'</ComponentType>'
  +'<Position>100 200 '+(100000+z)+'</Position><OutsideDiameter>88.9</OutsideDiameter>'
  +'<WallThickness>3.2</WallThickness></Node>';
const xml='<PipeStressExport><Pipe><Branch><Branchname>'+branch+'</Branchname>'
  +xmlNode(41310,'PIPE-START','PIPE',-100)
  +members.map((m,i)=>xmlNode(m.node,m.tag,'ANCI',m.z)
    +xmlNode(41315+i*10,'PIPE-SPACER-'+i,'PIPE',m.z+50)).join('')
  +'</Branch></Pipe></PipeStressExport>';
const original=()=>JSON.stringify([{type:'BRANCH',name:branch,children:members.map(m=>({
  type:'SUPPORT',name:'SUPPORT '+m.tag,attributes:{
    NAME:'/'.concat(m.tag),POSI:'100 200 '+m.z,DTXR:m.desc,
    NODETYPE:m.sourceType,...(m.gap===null?{}:{CMPSUPGAP:m.gap}),
  },
}))}]);
const setup=()=>{
  const initial={
    dtxrPositionOffset:{enabled:true,xOffset:0,yOffset:0,zOffset:100000},
    jsonTrace:{coordinateTolerance:6},resolverJsonTrace:{coordinateTolerance:6},
    inputXmlRestraintTypeMutation:{
      enabled:true,rows:DEFAULT_RESTRAINT_TYPE_MUTATION_ROWS.map(v=>({...v}))},
    defaultGap:0,defaultStiffness:1751270000000,
  };
  const mapper=runStandaloneSupportTypeMapper({
    supportConfigJson:JSON.stringify(initial),
    testInput:members.map(m=>m.desc).join('\n'),
  });
  return {mapper,config:JSON.parse(mapper.supportConfigJson)};
};
const nodeRows=doc=>[...doc.getElementsByTagName('Node')]
  .filter(n=>n.getElementsByTagName('NodeName')[0]?.textContent.startsWith('PS-4131.'))
  .map(n=>{
  const get=(el,k)=>el.getElementsByTagName(k)[0]?.textContent||'';
  return {name:get(n,'NodeName'),
    rows:[...n.getElementsByTagName('Restraint')].map(r=>({
      type:get(r,'Type'),gap:Number(get(r,'Gap')),
      hasSourceGap:r.getElementsByTagName('CMPSUPGAP').length>0,
    }))};
});
const PYPATH=fileURLToPath(new URL('../converters/scripts/xml_to_cii2019.py',import.meta.url));
test('7 Support Mapper assigns all three controlled PS-4131 descriptions',()=>{
  const {mapper,config}=setup();
  assert.deepEqual(mapper.previewRows.map(x=>x.supportKind),members.map(x=>x.kind));
  assert.ok(config.supportMapping.rules.some(x=>x.kind==='GUIDE'));
  for(const m of members){
    const descriptor=resolveXmlCiiSupportDescriptor({DTXR:m.desc},config);
    assert.equal(descriptor.primaryKind,m.kind,m.tag);
  }
});
test('7 mapper -> Datum/6mm -> 8 mutation -> Final XML -> native CII (controlled)',async()=>{
  const {config}=setup();
  const prepared=await prepareXml229PrefinalRestraints({
    xmlText:xml,stagedJsonText:original(),config,
  });
  const final=nodeRows(prepared.document);
  assert.deepEqual(final.map(n=>n.name),members.map(m=>m.tag));
  for(let i=0;i<members.length;i++){
    const m=members[i], actual=final[i].rows;
    assert.equal(actual.length,1,'one restraint '+m.tag);
    assert.equal(actual[0].type,m.kind==='REST'?'+Y':m.kind==='GUIDE'?'GUI':'LIM',
      'correct final XML restraint '+m.tag);
    assert.equal(actual[0].gap,Number(m.gap||0),'correct gap '+m.tag);
    assert.equal(actual[0].hasSourceGap,m.gap!==null,'proven source gap flag '+m.tag);
  }
  const dir=await mkdtemp(join(tmpdir(),'xml229-ps4131-e2e-'));
  try{
    const x=join(dir,'final.xml'),out=join(dir,'native.cii');
    await writeFile(x,new XMLSerializer().serializeToString(prepared.document));
    const py=process.env.PYTHON||(process.platform==='win32'?'python':'python3');
    execFileSync(py,[PYPATH,'--input',x,'--output',out]);
    const cii=await readFile(out,'utf8');
    const section=cii.split('#$ RESTRANT\n')[1]?.split('#$')[0]||'';
    assert.ok(section,'native CII RESTRANT must exist');
    const lines=section.trim().split('\n');
    const records=new Map();
    for(let i=0;i<lines.length;i+=4){
      const fields=lines[i].trim().split(/\s+/).map(Number);
      if(fields[0])records.set(fields[0],fields);
    }
    for(const m of members){
      const row=records.get(m.node);
      assert.ok(row,'native CII missing '+m.tag);
      assert.equal(row[1],m.expected,'native restraint type '+m.tag);
      assert.equal(row[3],Number(m.gap||0),'native source/default gap '+m.tag);
    }
    console.log('PS4131_CONTROLLED_NATIVE_RECEIPT '+JSON.stringify({
      source:'SYNTHETIC_NOT_OWNER_JSON',branch,
      items:members.map(m=>({tag:m.tag,classification:m.kind,
        sourceNodeType:m.sourceType,expectedCiiType:m.expected,
        sourceGap:m.gap===null?'NOT_PRESENT':m.gap,
        actualFinalXml:final.find(n=>n.name===m.tag)?.rows,
        actualCiiType:records.get(m.node)?.[1],
        actualCiiGap:records.get(m.node)?.[3]}))
    }));
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('edited Step 7 semantic alias changes governed Step 8/native output, not only preview',async()=>{
  const rows=createDefaultSupportTypeMapperConfig();
  rows.find(r=>r.kind==='LINESTOP').aliases.push('AXIAL LOCK');
  const base=setup().config;
  const audit=runStandaloneSupportTypeMapper({
    supportConfigJson:JSON.stringify(base),mapperRows:rows,testInput:'AXIAL LOCK',
  });
  assert.equal(audit.previewRows[0]?.supportKind,'LINESTOP');
  const source=JSON.parse(original());
  source[0].children[2].attributes.DTXR='AXIAL LOCK';
  const prepared=await prepareXml229PrefinalRestraints({
    xmlText:xml,stagedJsonText:JSON.stringify(source),
    config:JSON.parse(audit.supportConfigJson),
  });
  assert.deepEqual(nodeRows(prepared.document)[2].rows.map(r=>r.type),['LIM'],
    'custom mapper label must govern Final instead of being display only');
});

test('legacy saved reversed GUI/LIM mutation must not silently reach Final',async()=>{
  const {config}=setup();
  config.inputXmlRestraintTypeMutation.rows = [
    {label:'+Y',from:'17',to:'14'},
    {label:'LIM',from:'7',to:'8'},
    {label:'GUI',from:'10',to:'9'},
  ];
  await assert.rejects(
    prepareXml229PrefinalRestraints({xmlText:xml,stagedJsonText:original(),config}),
    {code:'PREFINAL_RESTRAINT_TYPE_KIND_CONFLICT'},
  );
});

test('co-located PS-4131 .1/.2/.3 become three slots at one native node',async()=>{
  const {config}=setup();
  const source=JSON.parse(original());
  for(const item of source[0].children)item.attributes.POSI='100 200 0';
  const xmlSingle='<PipeStressExport><Pipe><Branch><Branchname>'+branch+'</Branchname>'
    +xmlNode(4130,'BEFORE','PIPE',-100)
    +xmlNode(4131,'PS-4131','ANCI',0)
    +xmlNode(4140,'AFTER','PIPE',100)
    +'</Branch></Pipe></PipeStressExport>';
  const prepared=await prepareXml229PrefinalRestraints({
    xmlText:xmlSingle,stagedJsonText:JSON.stringify(source),config,
  });
  const n=[...prepared.document.getElementsByTagName('Node')].find(n=>
    n.getElementsByTagName('NodeNumber')[0]?.textContent==='4131');
  const rs=[...n.getElementsByTagName('Restraint')].map(r=>({
    type:r.getElementsByTagName('Type')[0]?.textContent,
    gap:Number(r.getElementsByTagName('Gap')[0]?.textContent),
  }));
  assert.deepEqual(rs,[{type:'+Y',gap:0},{type:'GUI',gap:4.5},{type:'LIM',gap:7.25}]);
  const dir=await mkdtemp(join(tmpdir(),'xml229-ps4131-colocated-'));
  try{
    const x=join(dir,'colocated.xml'),out=join(dir,'native.cii');
    await writeFile(x,new XMLSerializer().serializeToString(prepared.document));
    const py=process.env.PYTHON||(process.platform==='win32'?'python':'python3');
    execFileSync(py,[PYPATH,'--input',x,'--output',out]);
    const cii=await readFile(out,'utf8');
    const section=cii.split('#$ RESTRANT\n')[1]?.split('#$')[0]||'';
    const slotLines=section.trim().split('\n');
    const matched=[];
    for(let i=0;i<slotLines.length;i+=4){
      const values=slotLines[i].trim().split(/\s+/).map(Number);
      if(values[0]===4131&&values[1]>0)matched.push([values[1],values[3]]);
    }
    assert.deepEqual(matched,[[14,0],[8,4.5],[9,7.25]]);
    console.log('PS4131_COLOCATED_NATIVE_RECEIPT '+JSON.stringify({
      source:'SYNTHETIC_NOT_OWNER_JSON',node:4131,slots:matched}));
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('read-only authentic Firstpass co-position NODETYPE conflict census',async()=>{
  const source=await readFile(fileURLToPath(new URL('../Benchmarks/1885Sjson/FirstpassXML',import.meta.url)),'utf8');
  const stage=await readFile(fileURLToPath(new URL('../Benchmarks/1885Sjson/Sjson.json',import.meta.url)),'utf8');
  const ledger=decorateJsonTraceLedger(
    buildStandaloneDtxrResolutionLedger(source,stage,{}),
    {captureFields:['NODETYPE','SUPPORT_KIND','SUPPORT_TYPE','MDSSUPPTYPE']});
  const duplicates=[];
  for(const rec of ledger.records||[]){
    const grouped=new Map();
    for(const m of rec.positionMembers||[]){
      const a=m.raw?.attributes||m.attributes||{};
      const kind=String(a.SUPPORT_KIND||a.SUPPORT_MAPPER_KIND||a.SUPPORT_TYPE||'');
      if(!kind||!a.NODETYPE)continue;
      if(!grouped.has(kind))grouped.set(kind,[]);
      grouped.get(kind).push({nodeType:String(a.NODETYPE),mds:String(a.MDSSUPPTYPE||''),
        type:String(m.raw?.type||m.type||''),name:String(a.NAME||''),desc:String(a.DTXR||m.description||'')});
    }
    for(const [kind,values] of grouped){
      if(new Set(values.map(v=>v.nodeType)).size>1)
        duplicates.push({branch:rec.xmlBranch,node:rec.xmlNodeNumber,kind,values:values.slice(0,8)});
    }
  }
  console.log('FIRSTPASS_RAW_NODETYPE_COLLISION_AUDIT '+JSON.stringify({
    records:ledger.records?.length,conflicts:duplicates.length,examples:duplicates.slice(0,6)}));
  assert.ok(Array.isArray(ledger.records));
});

test('authentic-style REST primary type14 dominates co-located AT01/AT05 hardware type4',async()=>{
  const {config}=setup();
  const source=[{type:'BRANCH',name:branch,children:[
    {type:'SUPPORT',attributes:{NAME:'/PS-12244/DATUM',POSI:'100 200 0',
      DTXR:'Pipe Rest XRT01',SUPPORT_KIND:'REST',NODETYPE:'14',NODEGAP:'0'}},
    {type:'SUPPORT',attributes:{NAME:'/PS-12244.1',POSI:'100 200 0',
      DTXR:'PIPE SHOE FOR HORIZ LINES',MDSSUPPTYPE:'AT01',
      SUPPORT_KIND:'REST',NODETYPE:'4',NODEGAP:'0'}},
    {type:'SUPPORT',attributes:{NAME:'/PS-12244.2',POSI:'100 200 0',
      DTXR:'WEAR PLATE TYPE-421 PAD',MDSSUPPTYPE:'AT05',
      SUPPORT_KIND:'REST',NODETYPE:'4',NODEGAP:'0'}},
  ]}];
  const fixture='<PipeStressExport><Pipe><Branch><Branchname>'+branch+'</Branchname>'
    +xmlNode(4130,'BEFORE','PIPE',-100)+xmlNode(4131,'PS-12244','ANCI',0)
    +xmlNode(4140,'AFTER','PIPE',100)+'</Branch></Pipe></PipeStressExport>';
  const doc=(await prepareXml229PrefinalRestraints({
    xmlText:fixture,stagedJsonText:JSON.stringify(source),config})).document;
  const n=[...doc.getElementsByTagName('Node')].find(x=>
    x.getElementsByTagName('NodeNumber')[0]?.textContent==='4131');
  const types=[...n.getElementsByTagName('Restraint')].map(x=>
    x.getElementsByTagName('Type')[0]?.textContent);
  assert.deepEqual(types,['+Y'],'source hardware is not a competing restraint');
});

test('directional anchor on shoe is LINESTOP, not REST/LINESTOP ambiguity',async()=>{
  const {mapper,config}=setup();
  const text='Directional Anchor On Shoe for Hot Insulated Pipe';
  const audit=runStandaloneSupportTypeMapper({supportConfigJson:JSON.stringify(config),testInput:text});
  assert.equal(audit.previewRows[0].supportKind,'LINESTOP');
  const att={DTXR:text,MDSSUPPTYPE:'ST06',SUPPORT_KIND:'LINESTOP',NODETYPE:'9',NODEGAP:'0'};
  assert.equal(resolveXmlCiiSupportDescriptor(att,config).primaryKind,'LINESTOP');
});
