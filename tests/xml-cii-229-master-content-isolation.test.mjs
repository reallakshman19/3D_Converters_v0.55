import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createPreviewBasis,canonicalPreviewValue} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import {attestLiveBasis} from '../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {digestUtf8,digestCanonical,canonicalJson} from '../contracts/gc-pw-v1/contract.mjs';
import {isolatedOriginalPreviewWorkConfig} from '../tabs/xml-cii-2019-standalone/integration/xml229-original-preview-work-config.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

test('Preview and GC-PW canonicalization agree for numeric XLSX headers, unlike lexical-key string concatenation',async()=>{
 const row=JSON.parse('{"2":"second","10":"tenth","01":"leading zero","1":"first","Line Number":"A"}');
 const original={root:[row,{nested:row}],bare:row};
 assert.equal(canonicalPreviewValue(original),canonicalJson(original));
 assert.equal(canonicalPreviewValue([row]),canonicalJson([row]));
 assert.equal(await digestUtf8(canonicalPreviewValue([row])),await digestCanonical([row]));
 assert.match(canonicalPreviewValue(row),/\{"1":"first","2":"second","10":"tenth","01":"leading zero"/);
});

test('actual 10699 Class and 1595 Valve rows plus Owner-shaped 385 Line List and 383 Material rows yield one GC-PW attested master basis',async()=>{
 const weightRows=JSON.parse(await readFile(new URL('../docs/Masters/wtValveweights.json',import.meta.url),'utf8'));
 const classRows=JSON.parse(await readFile(new URL('../docs/Masters/Piping_class_master.json',import.meta.url),'utf8'));
 assert.equal(weightRows.length,1595);
 assert.equal(classRows.length,10699);
 const lineRows=Array.from({length:385},(_,i)=>({
   '10':'CODE'+i,'2':'LINE'+i,'01':'X'+i,
   'Line Number':String(i+1),'From':'F'+i,'To':'T'+i,'Piping Class':'31441C4',
   'Design Pressure':String(15+i/10),
 }));
 const materialRows=Array.from({length:383},(_,i)=>({'Code':'M'+i,'Material':'A106-B'}));
 const specs={lineList:lineRows,pipingClass:classRows,materialMap:materialRows,weight:weightRows};
 const masters=Object.fromEntries(Object.entries(specs).map(([k,rows])=>[
   k,{datasetId:k+'-Owner-lease',revision:2,rows,mapping:{checked:true}},
 ]));
 const config={linelist:{masterRows:lineRows},pipingClass:{masterRows:classRows},
   material:{mapRows:materialRows},weight:{masterRows:weightRows},overrides:{}};
 const sources=[{sourceId:'OwnerXML',mediaType:'application/xml',text:'<PipeStressExport><Branch><Node><NodeNumber>-1</NodeNumber></Node></Branch></PipeStressExport>'}];
 const selection=[{sourceId:'OwnerXML',selectionRef:'all'}],overrides={};
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',sources,
   selection,masters,config,overrides,sha256:digestUtf8});
 const live=()=>({basis,sources:{OwnerXML:sources[0].text},masters,selection,stagedSource:null,config,overrides});
 await attestLiveBasis(live());
 // Legacy enrichers may normalize mapped XLSX source rows and nested config;
 // their own working copies may change, but the InputBasis must not.
 const dryRun=isolatedOriginalPreviewWorkConfig(config);
 const cleanup=isolatedOriginalPreviewWorkConfig(config);
 dryRun.linelist.masterRows[0]['2']='COMPUTATION_ONLY';
 dryRun.linelist.masterRows.reverse();
 cleanup.linelist.masterRows[1]['10']='SOURCE_CLEANUP_ONLY';
 cleanup.weight.masterRows[0].weight=9999;
 await attestLiveBasis(live());
 assert.equal(config.linelist.masterRows[0]['2'],'LINE0');
 assert.equal(config.weight.masterRows[0].weight,weightRows[0].weight);
 assert.equal(basis.masters.lineList.rowCount,385);
 for(const [kind,ref] of Object.entries(basis.masters))
   assert.equal(ref.sha256,await digestCanonical(masters[kind].rows),kind+' producer-consumer SHA mismatch');
 // A true real-input mutation must STILL be caught, even without rowcount change.
 lineRows[0]['2']='NEW_LINE';
 await assert.rejects(()=>attestLiveBasis(live()),
   error=>(assert.equal(error.code,'MASTER_CONTENT_DRIFT'),true));
});

test('strict Preview source input rules remain; docs modules match actual source',async()=>{
 assert.throws(()=>canonicalPreviewValue([,1]),e=>e.code==='SPARSE_ARRAY');
 assert.throws(()=>canonicalPreviewValue({key:undefined}),e=>e.code==='UNSERIALIZABLE_VALUE');
 const cyclic={};cyclic.self=cyclic;
 assert.throws(()=>canonicalPreviewValue(cyclic),e=>e.code==='CYCLIC_VALUE');
 for(const file of [
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js',
  'tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',
  'tabs/xml-cii-2019-standalone/integration/xml229-original-preview-work-config.mjs',
  'tabs/xml-cii-2019-standalone/integration/xml229-preview-engineering-fact-producer.mjs',
 ]){
   const r=await readFile(new URL('../'+file,import.meta.url),'utf8');
   const d=await readFile(new URL('../docs/'+file,import.meta.url),'utf8');
   assert.equal(r,d,'docs mirror drift '+file);
 }
});
