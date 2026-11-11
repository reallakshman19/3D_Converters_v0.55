import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createPreviewButtonBasis} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-button-session.js';
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
const config=()=>({
  linelist:{masterRows:[{line:'A',class:'PC01'}],fieldMap:{class:'class'}},
  pipingClass:{masterRows:[{class:'PC01',wall:6}],fieldMap:{}},
  material:{mapRows:[{material:'A106-B',code:'001'}]},
  weight:{masterRows:[{component:'VALV',weight:22}]},
  overrides:{pipingClass:{A:'PC01'}},
});
const input=(cfg=config())=>({xmlText:'<PipeStressExport>AA</PipeStressExport>',
  config:cfg,stagedJsonText:'{"DTXR":"A"}',sourceId:'SYS-001.xml'});
test('full source byte difference with identical length invalidates button basis',async()=>{
  const a=input(),b=input();b.xmlText='<PipeStressExport>AB</PipeStressExport>';
  assert.equal(a.xmlText.length,b.xmlText.length);
  assert.notEqual((await createPreviewButtonBasis(a)).basisId,(await createPreviewButtonBasis(b)).basisId);
});
test('equal master row counts with changed material class or map invalidates basis',async()=>{
  const a=input(),b=input(),c=input();
  b.config.pipingClass.masterRows[0].wall=8;
  c.config.material.mapRows[0].code='002';
  const base=await createPreviewButtonBasis(a);
  assert.notEqual(base.basisId,(await createPreviewButtonBasis(b)).basisId);
  assert.notEqual(base.basisId,(await createPreviewButtonBasis(c)).basisId);
});
test('staged JSON and manual override changes invalidate basis',async()=>{
  const original=input(),staged=input(),override=input();
  staged.stagedJsonText='{"DTXR":"B"}';override.config.overrides.pipingClass.A='PC02';
  const basis=await createPreviewButtonBasis(original);
  assert.notEqual(basis.basisId,(await createPreviewButtonBasis(staged)).basisId);
  assert.notEqual(basis.basisId,(await createPreviewButtonBasis(override)).basisId);
});
test('empty original source label cannot become invented provenance',async()=>{
  await assert.rejects(createPreviewButtonBasis({...input(),sourceId:''}),
    {code:'SOURCE_ID_REQUIRED'});
});
test('portable basis seals after creation and exactly four master sections are content-hashed',async()=>{
  const b=await createPreviewButtonBasis(input());
  assert.ok(Object.isFrozen(b)&&Object.isFrozen(b.masters.linelist));
  assert.deepEqual(Object.keys(b.masters).sort(),['linelist','material','pipingClass','weight']);
  assert.match(b.basisId,/^[a-f0-9]{64}$/);
});
test('P3-A source/docs mirrors byte identical',async()=>{
  for(const file of ['xml-cii-adapted-preview-facts-button-session.js',
    'xml-cii-adapted-preview-renderer.js']){
    const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+file,import.meta.url),'utf8');
    const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+file,import.meta.url),'utf8');
    assert.equal(a,b,file);
  }
});
