// R03 source-custody compatibility oracle, drawn from GC-PW/1.0's exact existing consumer API.
// LFJ is only the source byte reader; this does NOT adopt/replace Preview or Weight engineering authority.
// All synthetic fixtures below are explicitly *not* owner-real 30/90MB or actual CII output goldens.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {
  digestUtf8,digestCanonical,makeBasisRef,assertBasisDigest,assertContentDigest,
} from '../../contracts/gc-pw-v1/contract.mjs';
import {createSourceSnapshotBuilder} from './source-snapshot.mjs';
if (!globalThis.crypto) globalThis.crypto=webcrypto;
const utf8=s=>new TextEncoder().encode(s);
const nodeDigest=b=>createHash('sha256').update(b).digest('hex');
function snapshot(bytes,revision='read-1') {
  const b=createSourceSnapshotBuilder({byteLength:bytes.length,
    expectedSha256:nodeDigest(bytes),revision,maxChunkBytes:9});
  for(let i=0;i<bytes.length;i+=9)b.append(bytes.subarray(i,i+9),i);
  return b.finalize();
}
async function basis({sourceId='PL01',xml='<PipeStressExport id="PL01"/>',
  staged='{"hierarchy":[{"name":"/A","attributes":{"OWNER_SITE":"Z1"}}]}',
  pipingClass='CS150'}={}) {
  const selection=[{sourceId,selectionRef:'ALL'}];
  const config={pipingClass:{masterRows:[{code:pipingClass}]},overrides:{}};
  const masterRows=[{code:pipingClass}];
  const ref=await makeBasisRef({
    domainId:'xml-cii/2019',
    sourceRefs:[{sourceId,mediaType:'application/xml',sha256:await digestUtf8(xml)}],
    scope:selection,selectionSha256:await digestCanonical(selection),
    stagedSourceSha256:await digestUtf8(staged),
    masters:{pipingClass:{datasetId:'pipingClass',revision:'v1',
      rowCount:1,sha256:await digestCanonical(masterRows),
      mappingSha256:await digestCanonical({})}},
    configSha256:await digestCanonical(config),
    overridesSha256:await digestCanonical(config.overrides),
  });
  await assertBasisDigest(ref);
  return ref;
}

test('R03→GC-PW byte bridge: same actual UTF8 staged bytes yield exact independent SHA, while sourceId and basisId remain distinct',async()=>{
  const staged='{"hierarchy":[{"name":"/β💡","attributes":{"OWNER_ZONE":"Z1"}}]}';
  const bytes=utf8(staged),s=snapshot(bytes);
  const b=await basis({staged});
  assert.equal(s.sha256,nodeDigest(bytes),'Node crypto independently computes same original-byte SHA');
  assert.equal(s.sha256,await digestUtf8(staged),'GC-PW stages hash full UTF8 string content');
  assert.equal(s.sha256,b.stagedSourceSha256);
  assert.notEqual(s.sourceId,b.sourceRefs[0].sourceId,
    'LFJ content-addressed ID must never stand in for engineering source ID');
  assert.notEqual(s.sha256,b.basisId,'GC-PW basis also binds source, masters, mapping, scope and overrides');
  await assertContentDigest(staged,s.sha256);
  assert.deepEqual(s.readRange(0,bytes.length,s.revision),bytes);
  s.close();
});

test('two distinct engineering sources may share bytes without sharing GC-PW source scope or identity',async()=>{
  const staged='{"objects":[{"name":"/SAME"}]}';
  const a=snapshot(utf8(staged),'a'),b=snapshot(utf8(staged),'b');
  const basisA=await basis({sourceId:'PL01',staged});
  const basisB=await basis({sourceId:'PL06',staged});
  assert.equal(a.sha256,b.sha256);
  assert.equal(a.sourceId,b.sourceId,'content-addressed facts can be equal for identical bytes');
  assert.notEqual(basisA.sourceRefs[0].sourceId,basisB.sourceRefs[0].sourceId);
  assert.notEqual(basisA.basisId,basisB.basisId,'source-scoped decisions do not alias');
  a.close();b.close();
});

test('same-length staged interior change invalidates LFJ and GC-PW; same staged SHA does not excuse changed master',async()=>{
  const original='{"hierarchy":[{"name":"/X","attributes":{"OWNER_ZONE":"Z1"}}]}';
  const updated=original.replace('"Z1"','"Z2"');
  assert.equal(original.length,updated.length);
  const a=snapshot(utf8(original)),b=snapshot(utf8(updated));
  const basisA=await basis({staged:original}),basisB=await basis({staged:updated});
  assert.notEqual(a.sha256,b.sha256);
  assert.notEqual(a.revision,b.revision);
  assert.equal(basisA.stagedSourceSha256,a.sha256);
  assert.equal(basisB.stagedSourceSha256,b.sha256);
  assert.notEqual(basisA.basisId,basisB.basisId);
  assert.throws(()=>b.readRange(0,1,a.revision),e=>e?.code==='STALE_REVISION');
  const otherMaster=await basis({staged:original,pipingClass:'CS151'});
  assert.equal(otherMaster.stagedSourceSha256,basisA.stagedSourceSha256);
  assert.notEqual(otherMaster.basisId,basisA.basisId);
  a.close();b.close();
});

test('raw original bytes are not silently equated to consumer-normalized text',async()=>{
  const text='{"branches":[{"name":"/A"}]}';
  const normalized=utf8(text),raw=new Uint8Array(3+normalized.length);
  raw.set([0xef,0xbb,0xbf],0);raw.set(normalized,3);
  const s=snapshot(raw,'raw-bom');
  assert.notEqual(s.sha256,await digestUtf8(text),
    'raw UTF8 BOM bytes are not GC-PW normalized TextEncoder text bytes');
  assert.equal(s.sha256,nodeDigest(raw));
  s.close();
});
