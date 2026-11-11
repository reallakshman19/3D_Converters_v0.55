import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {diagnoseXml229NativeConverterFailure}
  from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs';

const SCRIPT_PATHS=[
  '../converters/scripts/xml229_native_final_mass_binding.py',
  '../converters/scripts/xml229_prefinal_restraints.py',
];

test('every typed native lineage/restraint error is reportable without source disclosure',async()=>{
  const scripts=(await Promise.all(SCRIPT_PATHS.map(path=>
    readFile(new URL(path,import.meta.url),'utf8')))).join('\n');
  const emitted=[...new Set([...scripts.matchAll(/['"](NATIVE_[A-Z0-9_]+)['"]/g)]
    .map(match=>match[1]))];
  assert(emitted.length>=50,'native validation code set must be read from Python');
  const secret='secret://customer/source.xml Traceback private=xyz';
  for(const code of emitted){
    const outcome=diagnoseXml229NativeConverterFailure({
      ok:false,nativeFailurePhase:'CII_CONVERSION',
      nativePythonFailure:{stage:'ORIGINAL_LINEAGE_STAGE',code},
      error:secret,logs:[secret],
    });
    assert.equal(outcome.code,code,`unmapped Python native validation code: ${code}`);
    assert.equal(outcome.phase,'ORIGINAL_LINEAGE_STAGE');
    assert.equal(outcome.nativeCiiReleaseAuthorized,false);
    assert.equal(outcome.candidatePublished,false);
    assert.doesNotMatch(JSON.stringify(outcome),/customer|secret:|Traceback|private=xyz/);
  }
});

test('unknown or injected Python error text still fails closed and does not leak',()=>{
  for(const code of ['NATIVE_UNKNOWN_NEW_CODE',
    'NATIVE_PHYSICAL_LINEAGE_ALIAS_DRIFT: /private/source.xml',
    'NATIVE_PHYSICAL_LINEAGE_ALIAS_DRIFT\\nTraceback']){
    const outcome=diagnoseXml229NativeConverterFailure({
      ok:false,nativeFailurePhase:'CII_CONVERSION',
      nativePythonFailure:{stage:'ORIGINAL_LINEAGE_STAGE',code},
      logs:['NATIVE_PHYSICAL_LINEAGE_ALIAS_DRIFT'],
    });
    assert.equal(outcome.code,'UNCLASSIFIED_EXCEPTION');
    assert.equal(outcome.nativeCiiReleaseAuthorized,false);
    assert.equal(outcome.candidatePublished,false);
  }
});

test('served docs diagnostic remains byte-identical to the module under test',async()=>{
  const root=await readFile(new URL(
    '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs',
    import.meta.url),'utf8');
  const served=await readFile(new URL(
    '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs',
    import.meta.url),'utf8');
  assert.equal(root,served);
});


test('P0 source/master/staged typed failures survive redacted native Worker receipt',()=>{
  const codes=[
    ['XML229_VERIFIED_LINE_LIST_UNRESOLVED','VERIFIED_MASTER_COMPLETENESS'],
    ['XML229_VERIFIED_PRESSURE_MISSING','VERIFIED_MASTER_COMPLETENESS'],
    ['XML229_VERIFIED_CLASS_DN_WALL_MISSING','VERIFIED_MASTER_COMPLETENESS'],
    ['XML229_VERIFIED_MATERIAL_CODE_UNAPPROVED','VERIFIED_MASTER_COMPLETENESS'],
    ['XML229_STAGED_POSITION_PARTIAL_TRANSFER','STAGED_POSITION_TRANSFER'],
    ['XML229_SOURCE_XML_RESTRAINT_GAP_CONFLICT','SOURCE_VALUE_HYDRATION'],
    ['NATIVE_PREFINAL_RESTRAINT_CONFIG_INVALID','LINEAGE_PREFINAL_RESTRAINT_REPLAY'],
    ['NATIVE_PYTHON_IMPORT_ERROR','STAGED_POSITION_TRANSFER'],
    ['NATIVE_PYTHON_TYPE_ERROR','SOURCE_VALUE_HYDRATION'],
    ['NATIVE_PYTHON_ATTRIBUTE_ERROR','LINEAGE_GEOMETRY_VERIFY'],
  ];
  for(const [code,stage] of codes){
    const receipt=diagnoseXml229NativeConverterFailure({
      ok:false,nativeFailurePhase:'CII_CONVERSION',
      nativePythonFailure:{stage,code},
      error:'private://client/path/model.xml',logs:['Traceback customer'],
    });
    assert.equal(receipt.code,code);
    assert.equal(receipt.phase,stage);
    assert.equal(receipt.nativeCiiReleaseAuthorized,false);
    assert.doesNotMatch(JSON.stringify(receipt),/private:|client\/path|Traceback|customer/);
  }
  const unknown=diagnoseXml229NativeConverterFailure({
    ok:false,nativeFailurePhase:'CII_CONVERSION',
    nativePythonFailure:{stage:'STAGED_POSITION_TRANSFER',
      code:'XML229_VERIFIED_UNTRUSTED_NEW_CODE'},
  });
  assert.equal(unknown.code,'UNCLASSIFIED_EXCEPTION');
});
