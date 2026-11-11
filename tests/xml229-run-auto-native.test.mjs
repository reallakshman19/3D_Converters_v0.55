import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {xml229CanAutoRunVerifiedFinal}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-auto-native.mjs';
import {diagnoseXml229NativeConverterFailure}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs';

const session={closed:false,readNativeFinalPacket:async()=>({})};
const state=()=>({activePhaseId:'run',running:false,result:null,
  xml229XmlOnlyApproval:null});
const report=()=>({raw:{xml229VerifiedEngineering:true},checklistRows:[
  {id:'weight-match',status:'ready',blocking:false},
  {id:'xml229-original-json-engineering-authority',status:'held',blocking:true},
  {id:'run-result',status:'pending',blocking:false},
]});
const can=(s=state(),r=report(),worker=session)=>
 xml229CanAutoRunVerifiedFinal({state:s,report:r,session:worker});

test('verified 249 Final masses schedule native Run despite passive post-run authority HOLD',()=>{
 assert.equal(can(),true);
 assert.equal(can({...state(),activePhaseId:'preview'}),false);
 assert.equal(can({...state(),activePhaseId:'weight-match'}),false);
 assert.equal(can({...state(),running:true}),false);
 assert.equal(can({...state(),result:{ok:false,error:'NATIVE_CANDIDATE_CONVERTER_FAILED'}}),false);
 assert.equal(can({...state(),result:{ok:true,ciiText:'EXISTING'}}),false);
});
test('no unverified Final, XML-only, other blockers, or stale Worker can auto-run',()=>{
 assert.equal(can({...state(),xml229XmlOnlyApproval:{source:'xml-only'}}),false);
 assert.equal(can(state(),{...report(),raw:{xml229VerifiedEngineering:false}}),false);
 assert.equal(can(state(),{...report(),checklistRows:[
  {id:'weight-match',status:'pending',blocking:true}]}),false);
 assert.equal(can(state(),{...report(),checklistRows:[
  ...report().checklistRows,{id:'source-kind',blocking:true}]}),false);
 assert.equal(can(state(),report(),{...session,closed:true}),false);
 assert.equal(can(state(),report(),{}),false);
});
test('actual Download .cii remains coupled to emitted artifact, not checklist readiness',async()=>{
 const canvas=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-cii-preview-canvas.js',import.meta.url),'utf8');
 assert.match(canvas,/const available = !!ciiText\.trim\(\) && ciiRow\?\.available !== false/);
 assert.match(canvas,/download\.disabled = !available/);
 const run=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 assert.match(run,/runXml229NativeCiiMassCandidate/);
 const action=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-run-action.mjs',import.meta.url),'utf8');
 assert.match(run,/executeXml229NativeRun/);
 assert.match(action,/verified\?\.nativeCiiReleaseAuthorized!==true/);
 assert.match(run,/offerXml229AutomaticNativeRun/);
 assert.match(run,/download:downloadTextFile/);
 assert.match(action,/download\(result\.ciiName,result\.ciiText/);
 const helper=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-auto-native.mjs',import.meta.url),'utf8');
 const mirror=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-auto-native.mjs',import.meta.url),'utf8');
 assert.equal(helper,mirror);
});

test('shared Pyodide interpreter resets native parser hooks and serializes automatic/manual jobs',async()=>{
 const engine=await readFile(new URL('../converters/xml-cii-2019-standalone/engine.js',import.meta.url),'utf8');
 const docs=await readFile(new URL('../docs/converters/xml-cii-2019-standalone/engine.js',import.meta.url),'utf8');
 assert.equal(engine,docs,'live-served native JS engine must match tested source');
 assert.match(engine,/const RESET_NATIVE_BASE_SNIPPET/);
 assert.match(engine,/importlib\.reload\(sys\.modules\["xml_to_cii2019"\]\)/);
 assert.match(engine,/await pyodide\.runPythonAsync\(RESET_NATIVE_BASE_SNIPPET\)/);
 assert.match(engine,/engineQueue=next\.then\(\(\)=>undefined,\(\)=>undefined\)/);
 assert.match(engine,/engineQueue\.then\(\(\)=>runSerializedXmlCii2019Engine\(job, runtime\)\)/);
 assert.match(engine,/runPythonScript\(pyodide, invocation\.scriptPath, invocation\.argv/);
});

test('converter failure returns allowlisted categories without leaking stderr or paths',()=>{
 const secret='SECRET_PRIVATE_XML /home/owner/site/model.xml Traceback';
 const engine=diagnoseXml229NativeConverterFailure({
   ok:false,nativeFailurePhase:'CII_CONVERSION',error:secret,logs:[secret]});
 assert.equal(engine.code,'NATIVE_CANDIDATE_CONVERTER_FAILED');
 assert.equal(engine.category,'ENGINE_FAILED');
 assert.equal(engine.phase,'CII_CONVERSION');
 assert.equal(engine.candidatePublished,false);
 assert.equal(engine.nativeCiiReleaseAuthorized,false);
 assert.doesNotMatch(JSON.stringify(engine),/SECRET_PRIVATE_XML|Traceback|private/);
 const known=diagnoseXml229NativeConverterFailure({ok:false,
   nativeFailurePhase:'MASS_PROOF_VERIFY',
   logs:['NATIVE_PREACCEPTANCE_RIGID_EDGE_DRIFT: '+secret]});
 assert.equal(known.code,'NATIVE_PREACCEPTANCE_RIGID_EDGE_DRIFT');
 assert.equal(known.phase,'MASS_PROOF_VERIFY');
 const tampered=diagnoseXml229NativeConverterFailure({
   ok:false,nativeFailurePhase:'/secret/path',error:secret});
 assert.equal(tampered.phase,'UNKNOWN');
 assert.doesNotMatch(JSON.stringify(tampered),/secret|Traceback/i);
});
test('engine failure, missing CII and missing mass proof remain distinct and non-authorizing',()=>{
 for(const [native,category,phase] of [
   [{ok:false,error:'secret traceback'},'ENGINE_FAILED','UNKNOWN'],
   [{ok:true,ciiText:null},'CII_OUTPUT_MISSING','CII_CONVERSION'],
   [{ok:true,ciiText:'CII output'},'NATIVE_MASS_PROOF_MISSING','MASS_PROOF_READ'],
 ]){
   const r=diagnoseXml229NativeConverterFailure(native);
   assert.equal(r.category,category);
   assert.equal(r.phase,phase);
   assert.equal(r.nativeCiiReleaseAuthorized,false);
 }
});
test('UI and engine expose bounded failure phase without weakening publication',async()=>{
 const ui=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 const action=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-run-action.mjs',import.meta.url),'utf8');
 assert.match(action,/xml229NativeFailure:error\.xml229NativeFailure/);
 assert.match(ui,/Download safe native failure diagnostic JSON/);
 assert.match(action,/verified\?\.nativeCiiReleaseAuthorized!==true/);
 const engine=await readFile(new URL('../converters/xml-cii-2019-standalone/engine.js',import.meta.url),'utf8');
 for(const phase of ['CII_CONVERSION','MASS_PROOF_READ','MASS_PROOF_VERIFY'])
   assert.ok(engine.includes("phase('"+phase+"')"));
 assert.match(engine,/partial, nativeFailurePhase\)/);
 const mirror=await readFile(new URL('../docs/converters/xml-cii-2019-standalone/engine.js',import.meta.url),'utf8');
 assert.equal(engine,mirror);
 const root=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs',import.meta.url),'utf8');
 const docs=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs',import.meta.url),'utf8');
 assert.equal(root,docs);
});

test('typed native Python failure reveals vetted substage/code, never raw traceback',()=>{
 const privateData='PRIVATE_ENGINEERING_XML /some/private/path.xml Traceback SRC-1';
 const valid=diagnoseXml229NativeConverterFailure({
   ok:false,nativeFailurePhase:'CII_CONVERSION',
   nativePythonFailure:{stage:'FINAL_MASS_BINDING',
     code:'NATIVE_FINAL_MASS_REQUIRED'},
   error:privateData,logs:['NATIVE_GEOMETRY_CHANGED_AFTER_WEIGHT_ACCEPTANCE '+privateData]});
 assert.equal(valid.category,'ENGINE_FAILED');
 assert.equal(valid.phase,'FINAL_MASS_BINDING');
 assert.equal(valid.code,'NATIVE_FINAL_MASS_REQUIRED');
 assert.equal(valid.nativeCiiReleaseAuthorized,false);
 assert.doesNotMatch(JSON.stringify(valid),/PRIVATE_ENGINEERING_XML|Traceback|path.xml/);
 const cii=diagnoseXml229NativeConverterFailure({
   ok:false,nativeFailurePhase:'CII_CONVERSION',
   nativePythonFailure:{stage:'EMITTED_MASS_VERIFY',code:'CII_NATIVE_MODEL_MASS_MISMATCH'}});
 assert.equal(cii.code,'CII_NATIVE_MODEL_MASS_MISMATCH');
 assert.equal(cii.phase,'EMITTED_MASS_VERIFY');
});
test('untrusted typed codes and phases cannot spoof accepted engineering failure',()=>{
 for(const receipt of [
   {stage:'/home/secret/file',code:'CII_NATIVE_MODEL_MASS_MISMATCH'},
   {stage:'CII_SERIALIZE',code:'UNVERIFIED_PRIVATE_SOURCE_ID'},
   {stage:'CII_SERIALIZE',code:'NATIVE_FINAL_MASS_REQUIRED /home/secret'},
   {stage:'CII_SERIALIZE',code:'../../private.xml'},
 ]){
   const outcome=diagnoseXml229NativeConverterFailure({
     ok:false,nativeFailurePhase:'CII_CONVERSION',
     nativePythonFailure:receipt,
     error:'NATIVE_PREACCEPTANCE_RIGID_EDGE_DRIFT'});
   if(receipt.stage==='/home/secret/file')assert.equal(outcome.phase,'UNKNOWN');
   else assert.equal(outcome.code,'UNCLASSIFIED_EXCEPTION');
   assert.equal(outcome.nativeCiiReleaseAuthorized,false);
   assert.doesNotMatch(JSON.stringify(outcome),/secret|private\.xml/i);
 }
 // Unknown Python exception must not inherit a known code in raw stderr.
 const failure=diagnoseXml229NativeConverterFailure({ok:false,
   nativeFailurePhase:'CII_CONVERSION',
   nativePythonFailure:{stage:'MODEL_BUILD',code:'UNCLASSIFIED_EXCEPTION'},
   logs:['NATIVE_PREACCEPTANCE_RIGID_EDGE_DRIFT']});
 assert.equal(failure.code,'UNCLASSIFIED_EXCEPTION');
 assert.equal(failure.phase,'MODEL_BUILD');
});
test('native Python runner resets typed receipts per attempt and root/docs remain identical',async()=>{
 const engine=await readFile(new URL('../converters/xml-cii-2019-standalone/engine.js',import.meta.url),'utf8');
 const py=await readFile(new URL('../converters/scripts/xml_to_cii2019_runtime_custody.py',import.meta.url),'utf8');
 assert.match(engine,/sys\._xml229_native_failure_stage = 'UNKNOWN'/);
 assert.match(engine,/job_native_failure_code = 'UNCLASSIFIED_EXCEPTION'/);
 assert.match(engine,/pyodide\.globals\.set\('job_governed_native', governedNative\)/);
 assert.match(engine,/nativePythonFailure:error\.xml229NativePythonFailure/);
 for(const stage of ['ORIGINAL_LINEAGE_STAGE','FINAL_MASS_BINDING','MODEL_PARSE',
   'CII_SERIALIZE','EMITTED_MASS_VERIFY'])
  assert.ok(py.includes("_mark_native_failure_stage('"+stage+"')"));
 assert.equal(engine,await readFile(new URL('../docs/converters/xml-cii-2019-standalone/engine.js',import.meta.url),'utf8'));
 assert.equal(py,await readFile(new URL('../docs/converters/scripts/xml_to_cii2019_runtime_custody.py',import.meta.url),'utf8'));
});

