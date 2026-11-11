import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {observeXml229NativeEngineBoundary}
 from '../tabs/xml-cii-2019-standalone/xml-cii-native-output-consumption-evidence.js';
import {digestXmlCiiParityText}
 from '../tabs/xml-cii-2019-standalone/xml-cii-run-parity-evidence.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const original='<PipeStressExport><Branch/></PipeStressExport>';
const enriched='<PipeStressExport><Branch><Weight>35</Weight></Branch></PipeStressExport>';
const output='SYNTHETIC CII output (not Owner)';
const sha=v=>createHash('sha256').update(v).digest('hex');
const input=(changes={})=>({
 originalSourceText:original,parityXmlText:enriched,
 parityEvidence:{ok:true,engineInputDigest:digestXmlCiiParityText(enriched)},
 engineJob:{sourceText:enriched},
 engineResult:{ok:true,ciiText:output,ciiName:'synthetic.cii'},
 ...changes,
});
test('read-only engine witness records exact input/output bytes but never CII release',async()=>{
 const w=await observeXml229NativeEngineBoundary(input());
 assert.equal(w.engineBoundaryVerified,true);
 assert.equal(w.originalSourceSha256,sha(original));
 assert.equal(w.engineInputSha256,sha(enriched));
 assert.equal(w.ciiOutputSha256,sha(output));
 assert.equal(w.nativeCiiReleaseAuthorized,false);
 assert.equal(w.physicalMatch2ConsumptionVerified,false);
});
test('tampered parity/input and failed or empty output stay unverified',async()=>{
 for(const bad of [
  {engineJob:{sourceText:enriched+' '}},
  {parityEvidence:{ok:true,engineInputDigest:'fnv1a32:deadbeef:999'}},
  {engineResult:{ok:false,ciiText:output,ciiName:'bad.cii'}},
  {engineResult:{ok:true,ciiText:'',ciiName:'bad.cii'}},
 ]){
  const w=await observeXml229NativeEngineBoundary(input(bad));
  assert.equal(w.engineBoundaryVerified,false);
  assert.equal(w.nativeCiiReleaseAuthorized,false);
 }
});
