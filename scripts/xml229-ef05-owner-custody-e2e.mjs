/** Private effective four-master basis custody; aggregate-only E2E receipt. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function verifyEf05OwnerBasisCustody(page,record,sha,x){
  // Real 41-branch P3: capture exact effective four-master config from
  // the SAME verified Worker lease through the explicit OWNER PRIVATE button.
  // The downloaded JSON is inspected in browser temp storage only; never
  // uploaded to CI artifacts, logged, or copied into ValidationRecords.
  const [custodyDownload]=await Promise.all([
    page.waitForEvent('download',{timeout:180000}),
    page.locator('[data-p4-export-effective-basis]').click(),
  ]);
  assert.equal(custodyDownload.suggestedFilename(),
    'xml229-owner-effective-basis-custody_PRIVATE.json');
  const privateCustody=JSON.parse(await readFile(await custodyDownload.path(),'utf8'));
  const {canonicalJson}=await import('../contracts/gc-pw-v1/contract.mjs');
  const canonicalHash=x=>sha(Buffer.from(canonicalJson(x)));
  assert.equal(privateCustody.schema,'XML229.OwnerLocalEffectiveBasisCustody.v1');
  assert.equal(privateCustody.originalJsonSha256,record.source.jsonSha256);
  assert.equal(privateCustody.sourceTextSha256,
    sha(Buffer.from(x.toString('utf8').replace(String.fromCodePoint(0xfeff),''))));
  assert.equal(privateCustody.configSha256,canonicalHash(privateCustody.contents.config));
  assert.equal(privateCustody.overridesSha256,canonicalHash(privateCustody.contents.overrides));
  assert.equal(privateCustody.historicalDecisionUpdates,0);
  assert.equal(privateCustody.finalAcceptedAutomatically,false);
  assert.equal(privateCustody.nativeCiiReleaseAuthorized,false);
  const ownerMasterCensus={};
  const defs={lineList:['linelist','masterRows'],materialMap:['material','mapRows'],
    pipingClass:['pipingClass','masterRows'],weight:['weight','masterRows']};
  for(const [kind,[section,field]] of Object.entries(defs)){
    const m=privateCustody.contents.masters[kind],d=privateCustody.masterDigests[kind];
    assert.equal(canonicalHash(m.rows),d.sha256);
    assert.equal(canonicalHash(m.mapping),d.mappingSha256);
    assert.equal(canonicalHash(privateCustody.contents.config[section][field]),d.sha256);
    assert.equal(canonicalHash(privateCustody.contents.config[section].fieldMap||{}),
      d.mappingSha256);
    assert.equal(m.rows.length,d.rowCount);
    ownerMasterCensus[kind]=d.rowCount;
  }
  record.stages.ownerBasisCustody={
    schema:privateCustody.schema,masterCounts:ownerMasterCensus,
    exactVerifiedLease:true,sourceTextHashVerified:true,
    configCanonicalDigestVerified:true,fourMasterDigestsVerified:true,
    historicalDecisionUpdates:0,nativeCiiReleaseAuthorized:false,
    privateContentsLogged:false};
  record.passes.push('Owner-local four-master effective config export hashed in-memory; private rows not logged or uploaded');

}
