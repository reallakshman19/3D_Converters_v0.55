import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PIPING_CLASS_MASTER_URLS,
  loadXmlCiiMasterRows,
  prepareXmlCiiMasterContext,
} from '../converters/xml-cii2019-core/master-context.js';

// Use the REAL shipped row-bearing source, not manifest rowCount metadata.
const masterPath = fileURLToPath(new URL('../docs/Masters/Piping_class_master.json', import.meta.url));
const masterText = await readFile(masterPath, 'utf8');
const realRows = JSON.parse(masterText);
const expected = realRows.length;
assert.equal(expected, 10699, 'Owner fixture must contain 10699 physical rows');
assert.equal(realRows.filter(row => String(row?.['Piping Class'] || '').trim()).length, expected);
const originalFetch = globalThis.fetch;

test('R02 default master URLs select the physical 10699-row JSON, not index metadata', () => {
  assert(DEFAULT_PIPING_CLASS_MASTER_URLS.length >= 1);
  assert(DEFAULT_PIPING_CLASS_MASTER_URLS.every(url => url.endsWith('/Piping_class_master.json')),
    'Manifest index.json is not an array of rows and cannot be used as a default master');
});

test('R02 blank config hydrates 10699 actually usable master rows with honest diagnostics', async () => {
  const seen = [];
  globalThis.fetch = async (value) => {
    const url = String(value);
    seen.push(url);
    if (url.endsWith('/Piping_class_master.json')) {
      return {ok:true, json:async()=>JSON.parse(masterText)};
    }
    return {ok:false,status:404};
  };
  try {
    const diagnostics=[];
    const result=await prepareXmlCiiMasterContext({rawConfig:{},diagnostics});
    assert.equal(result.pipingClassRows.length,10699);
    assert.equal(result.config.pipingClass.masterRows.length,10699);
    assert(result.pipingClassRows.every(r => String(r['Piping Class']||'').trim()));
    assert(seen.some(url=>url.endsWith('/Piping_class_master.json')));
    assert(diagnostics.some(d=>d.type==='piping-class-master-source' && d.rows===10699 &&
      String(d.source).endsWith('/Piping_class_master.json')));
    assert.equal(diagnostics.some(d=>d.type==='piping-class-master-source'&&d.rows===0),false);
  } finally {globalThis.fetch=originalFetch;}
});

test('R02 user-uploaded inline piping-class rows override the default without a fetch',async()=>{
  let invoked=0;
  globalThis.fetch=async()=>{invoked++;throw Error('default fetch forbidden after user import');};
  try{
    const custom=[{'Piping Class':'USER-DOC-123',Size:'4'}];
    const diags=[];
    const result=await prepareXmlCiiMasterContext({rawConfig:{pipingClass:{masterRows:custom}},diagnostics:diags});
    assert.equal(result.pipingClassRows.length,1);
    assert.equal(result.pipingClassRows[0]['Piping Class'],'USER-DOC-123');
    assert.equal(result.pipingClassRows.length,1);
    // Other master loaders may independently fetch; only the explicit Piping Class override must not.
    assert.equal(diags.some(d => d.type === 'piping-class-master-fetch-skip'),false);
    assert(diags.some(x=>x.type==='piping-class-master-source'&&x.source==='inline-config'&&x.rows===1));
  }finally{globalThis.fetch=originalFetch;}
});

test('R02 configured custom master URL takes precedence over shipped default',async()=>{
  const requests=[];
  globalThis.fetch=async url=>{
    requests.push(String(url));
    if(url==='local-custom.json')return {ok:true,json:async()=>[{'Piping Class':'SITE-OVERRIDE'}]};
    return {ok:false,status:404};
  };
  try{
    const section={masterUrl:'local-custom.json'};
    const diagnostics=[];
    const rows=await loadXmlCiiMasterRows(section,DEFAULT_PIPING_CLASS_MASTER_URLS,'piping-class',diagnostics);
    assert.equal(rows.length,1);
    assert.equal(rows[0]['Piping Class'],'SITE-OVERRIDE');
    assert.deepEqual(requests,['local-custom.json']);
  }finally{globalThis.fetch=originalFetch;}
});

test('R02 a failed/corrupt default never reports 10699 based on manifest metadata',async()=>{
  globalThis.fetch=async()=>({ok:true,json:async()=>({rowCount:10699,classes:{}})});
  try{
    const diagnostics=[];
    const rows=await loadXmlCiiMasterRows({},DEFAULT_PIPING_CLASS_MASTER_URLS,'piping-class',diagnostics);
    assert.equal(rows.length,0);
    assert(diagnostics.every(x=>x.type!=='piping-class-master-source' || Number(x.rows)!==10699));
    assert(diagnostics.some(x=>x.reason==='not-array'));
  }finally{globalThis.fetch=originalFetch;}
});
