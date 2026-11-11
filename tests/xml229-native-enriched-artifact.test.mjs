import {execFileSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readNativeEnrichedArtifact,nativeEnrichedFields}
 from '../converters/xml-cii-2019-standalone/native-enriched-artifact.js';
import {buildStandaloneCiiInvocation} from '../converters/xml-cii-2019-standalone/invocation-builder.js';

test('a native job requests its own export path without changing cii-only mode',()=>{
 const job={sourceKind:'xml',sourceName:'PL.xml',options:{outputMode:'cii-only'}};
 const invocation=buildStandaloneCiiInvocation(job,{inputPath:'/job/original.xml',
  xml229NativeFinalPacketPath:'/job/final.json',xml229NativeMassProofPath:'/job/proof.json',
  xml229NativeEnrichedPath:'/job/PL_enriched.xml'},'/job');
 const i=invocation.argv.indexOf('--enriched-output');
 assert(i>0);assert.equal(invocation.argv[i+1],'/job/PL_enriched.xml');
 assert.equal(job.options.outputMode,'cii-only');
});
test('artifact reader never substitutes input or reads a prior job',()=>{
 // Explicit FS control-flow fake; real exported XML is checked by native CLI tests.
 let reads=0;const fs={analyzePath:path=>({exists:path==='/job/actual.xml'}),
  readFile:()=>{reads++;return '<actual/>';}};
 assert.deepEqual(readNativeEnrichedArtifact({FS:fs},null,'out.xml'),{});
 assert.deepEqual(readNativeEnrichedArtifact({FS:fs},'/new-job/missing.xml','out.xml'),{});
 assert.equal(reads,0);
 assert.deepEqual(readNativeEnrichedArtifact({FS:fs},'/job/actual.xml','out.xml'),
  {enrichedText:'<actual/>',enrichedName:'out.xml'});
 assert.deepEqual(nativeEnrichedFields({enrichedText:'',enrichedName:'out.xml'}),{});
 assert.deepEqual(nativeEnrichedFields({enrichedText:'<actual/>',enrichedName:'out.xml',ciiText:'held'}),
  {enrichedText:'<actual/>',enrichedName:'out.xml'});
});

test('real native XML export survives a later CII writer fault and protects source bytes',()=>{
 execFileSync('python3',[new URL('./xml229-native-enriched-export.test.py',import.meta.url).pathname],{stdio:'pipe'});
});
