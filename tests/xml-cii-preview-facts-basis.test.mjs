import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPreviewBasis, canonicalPreviewValue, previewOccurrenceId} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js';

const sha256 = async (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const seed = () => ({
  domainId:'xml-cii/2019',
  sources:[{sourceId:'PL01',mediaType:'application/xml',text:'<Branch>AA</Branch>'}],
  selection:[{sourceId:'PL01',selectionRef:'all'}],
  masters:{line:{datasetId:'LL',revision:1,rows:[{line:'A',class:'P100'}],mapping:{class:'class'}}},
  config:{format:1},overrides:{},sha256
});
test('identical-length different XML suffix changes immutable basis', async () => {
  const a=seed(), b=seed(); b.sources[0].text='<Branch>AB</Branch>';
  assert.equal(a.sources[0].text.length,b.sources[0].text.length);
  assert.notEqual((await createPreviewBasis(a)).basisId,(await createPreviewBasis(b)).basisId);
});
test('same master row count but different engineering value invalidates basis', async () => {
  const a=seed(), b=seed(); b.masters.line.rows[0].class='P200';
  const x=await createPreviewBasis(a),y=await createPreviewBasis(b);
  assert.equal(x.masters.line.rowCount,y.masters.line.rowCount);
  assert.notEqual(x.masters.line.sha256,y.masters.line.sha256);
  assert.notEqual(x.basisId,y.basisId);
});
test('master mapping and manual override changes are included', async () => {
  const base=await createPreviewBasis(seed());
  const mapping=seed(); mapping.masters.line.mapping={class:'alt'};
  const override=seed(); override.overrides={class:{A:'P200'}};
  assert.notEqual(base.basisId,(await createPreviewBasis(mapping)).basisId);
  assert.notEqual(base.basisId,(await createPreviewBasis(override)).basisId);
});
test('canonical object key order is stable; no data truncation', async () => {
  assert.equal(canonicalPreviewValue({b:2,a:{y:true,x:'a'}}),canonicalPreviewValue({a:{x:'a',y:true},b:2}));
  const a=seed(); a.masters.line.rows=Array.from({length:10699},(_,i)=>({row:i,value:i===10698?'A':'X'}));
  const b=seed(); b.masters.line.rows=Array.from({length:10699},(_,i)=>({row:i,value:i===10698?'B':'X'}));
  assert.notEqual((await createPreviewBasis(a)).basisId,(await createPreviewBasis(b)).basisId);
});
test('repeated branches and NodeNumber -1 do not collapse occurrence identity', () => {
  const a=previewOccurrenceId({sourceId:'A',branchOrdinal:0,nodeOrdinal:0,componentSignature:'-1'});
  const b=previewOccurrenceId({sourceId:'A',branchOrdinal:1,nodeOrdinal:0,componentSignature:'-1'});
  const c=previewOccurrenceId({sourceId:'B',branchOrdinal:0,nodeOrdinal:0,componentSignature:'-1'});
  assert.equal(new Set([a,b,c]).size,3);
});
test('reject invalid engineering number and unknown source selection', async () => {
  const a=seed();a.masters.line.rows[0].thickness=Infinity;
  await assert.rejects(createPreviewBasis(a),{code:'NONFINITE_VALUE'});
  const b=seed();b.selection[0].sourceId='UNKNOWN';
  await assert.rejects(createPreviewBasis(b),{code:'UNKNOWN_SELECTION_SOURCE'});
});
test('synthetic non-XML domain adapter uses the same portable envelope', async () => {
  const a=seed();a.domainId='synthetic/beam';a.sources=[{sourceId:'S1',mediaType:'text/plain',text:'beam=10'}];
  a.selection=[{sourceId:'S1',selectionRef:'beam#1'}];
  const b=await createPreviewBasis(a);
  assert.equal(b.domainId,'synthetic/beam');assert.equal(b.schemaVersion,'gc-pw/1.0');
  assert.equal(b.sourceRefs[0].sourceId,'S1');
});
test('source-to-docs deployment mirror exact', async () => {
  const fs=await import('node:fs/promises');
  const source=await fs.readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js',import.meta.url),'utf8');
  const docs=await fs.readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js',import.meta.url),'utf8');
  assert.equal(source,docs);
});

test('public InputBasis snapshot is deeply immutable and detached from caller writes', async () => {
  const input=seed();
  const basis=await createPreviewBasis(input);
  assert.ok(Object.isFrozen(basis));
  assert.ok(Object.isFrozen(basis.sourceRefs));
  assert.ok(Object.isFrozen(basis.sourceRefs[0]));
  assert.ok(Object.isFrozen(basis.masters));
  assert.ok(Object.isFrozen(basis.masters.line));
  assert.ok(Object.isFrozen(basis.scope[0]));
  assert.throws(() => { basis.masters.line.sha256='0'.repeat(64); }, TypeError);
  assert.throws(() => basis.sourceRefs.push({}), TypeError);
  input.masters.line.rows[0].class='CHANGED';
  assert.notEqual(basis.basisId, (await createPreviewBasis(input)).basisId);
});
test('sparse arrays and hidden engineering data are rejected instead of omitted', async () => {
  const missing=seed();
  missing.masters.line.rows.length=2; // an absent row cannot masquerade as an empty row
  await assert.rejects(createPreviewBasis(missing), {code:'SPARSE_ARRAY'});
  const decorated=seed();
  Object.defineProperty(decorated.masters.line.rows[0], 'hiddenMaterial', {value:'A106',enumerable:false});
  await assert.rejects(createPreviewBasis(decorated), {code:'UNSERIALIZABLE_VALUE'});
});
