import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {diagnoseXml229NativeConverterFailure}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs';

test('real Python owner zero vs multiple stays bounded and nonauthorizing',()=>{
 const sourceSecret='PRIVATE_ORIGINAL /home/private/model.xml Traceback';
 for(const [code,cardinality] of [
  ['CII_NATIVE_PHYSICAL_OWNER_MISSING','ZERO'],
  ['CII_NATIVE_PHYSICAL_OWNER_MULTIPLE','MULTIPLE'],
 ]){
  const d=diagnoseXml229NativeConverterFailure({
   ok:false,nativeFailurePhase:'CII_CONVERSION',
   nativePythonFailure:{code,stage:'EMITTED_MASS_VERIFY'},
   error:sourceSecret,logs:[sourceSecret]});
  assert.equal(d.code,code);
  assert.equal(d.phase,'EMITTED_MASS_VERIFY');
  assert.equal(d.ownerMatchCardinality,cardinality);
  assert.equal(d.candidatePublished,false);
  assert.equal(d.nativeCiiReleaseAuthorized,false);
  assert.doesNotMatch(JSON.stringify(d),/PRIVATE_ORIGINAL|Traceback|private\/model/);
 }
 const untrusted=diagnoseXml229NativeConverterFailure({
  ok:false,nativeFailurePhase:'CII_CONVERSION',
  nativePythonFailure:{
   stage:'EMITTED_MASS_VERIFY',
   code:'CII_NATIVE_PHYSICAL_OWNER_MISSING /home/private/model.xml'}});
 assert.equal(untrusted.code,'UNCLASSIFIED_EXCEPTION');
 assert.equal(untrusted.ownerMatchCardinality,undefined);
});
test('source and served copies match; previous strict release HOLD is retained',async()=>{
 const files=[
  'converters/scripts/xml229_native_final_mass_binding.py',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',
 ];
 for(const path of files){
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const served=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(source,served);
 }
 const py=await readFile(new URL('../converters/scripts/xml229_native_final_mass_binding.py',import.meta.url),'utf8');
 assert.match(py,/CII_NATIVE_PHYSICAL_OWNER_MISSING/);
 assert.match(py,/CII_NATIVE_PHYSICAL_OWNER_MULTIPLE/);
 assert.match(py,/str\(node\.endpoint\)/);
 assert.doesNotMatch(py,/str\(node\.endpoint or ""\)/);
 const ui=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 assert.match(ui,/ownerMatchCardinality/);
 assert.match(ui,/candidatePublished:false,nativeCiiReleaseAuthorized:false/);
});
