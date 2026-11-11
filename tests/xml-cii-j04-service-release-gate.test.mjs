import assert from 'node:assert/strict';
import test from 'node:test';

import { auditConfiguredBranchFormats } from '../tabs/xml-cii-2019-standalone/xml-cii-branch-format-release.js';
import { runXmlCii2019WorkflowService } from '../tabs/xml-cii-2019-standalone/xml-cii-workflow-service.js';

const b1 = '/ASIM-1885-3"-S8811000-91261M7-HC-01/B1';
const b2 = '/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B2';
const xml = names => '<Plant>' + names.map(name =>
  '<Branch><Branchname>' + name + '</Branchname></Branch>').join('') + '</Plant>';
const configured = {
  regexTester: { formats: [
    { lineKey: { regex: '(S8811000)' }, pipingClass: { regex: '(91261M7)' } },
    { lineKey: { regex: '(S8822000)' }, pipingClass: { regex: '(91261M7)' } },
  ] },
};
const job = (names, config = configured) => ({
  sourceKind: 'xml', sourceText: xml(names), supportConfigJson: JSON.stringify(config),
  options: { outputMode: 'both' },
});

test('conflicting formats withhold enrichment but permit base XML→CII',async()=>{
  const cfg=structuredClone(configured);
  cfg.regexTester.formats.push({
    lineKey:{regex:'(S8822000)'},pipingClass:{regex:'(S8822000)'},
  });
  const source=job([b1,b2],cfg);
  let forwarded=null;
  const result=await runXmlCii2019WorkflowService(source,{
    runParityEnricher:async()=>{throw Error('Unresolved enrichment cannot run');},
    engineRunner:async j=>{
      forwarded=j;
      return {ok:true,ciiText:'SYNTHETIC',diagnostics:{}};
    },
  });
  assert.equal(result.ok,true);
  assert.equal(forwarded.sourceText,source.sourceText);
  assert.equal(forwarded.supportConfigJson,'{}');
  assert.equal(result.diagnostics.optionalEnrichment.status,'WITHHELD');
  assert.equal(result.diagnostics.optionalEnrichment.nativeReleaseNotImplied,true);
});

test('all enrichment masters absent still starts raw conversion',async()=>{
  let forwarded;
  const result=await runXmlCii2019WorkflowService(job([b1],{}),{
    engineRunner:async j=>{
      forwarded=j;return {ok:true,ciiText:'SYNTHETIC',diagnostics:{}};
    },
    runParityEnricher:async()=>{throw Error('No master needed');},
  });
  assert.equal(result.ok,true);
  assert.equal(forwarded.supportConfigJson,'{}');
  assert.equal(result.diagnostics.optionalEnrichment.reason,'NO_IMPORTED_MASTER_ENRICHMENT');
});

test('raw conversion never drops governed Final packet',async()=>{
  let ran=false;
  const source={...job([b1],{}),xml229NativeFinalPacket:{basisId:'source-bound'}};
  const result=await runXmlCii2019WorkflowService(source,{
    engineRunner:async()=>{ran=true;return {ok:true};},
  });
  assert.equal(ran,false);
  assert.equal(result.ok,false);
  assert.match(result.error,/BASE_XML_REQUIRES_SEPARATE_GOVERNED_FINAL_REVIEW/);
});

test('manual Preview facts cannot be silently stripped by raw fallback',async()=>{
  const source={...job([b1],{}),manualFacts:[{key:'explicit',value:1}]};
  let invoked=false;
  const result=await runXmlCii2019WorkflowService(source,{
    engineRunner:async()=>{invoked=true;return {ok:true};},
  });
  assert.equal(invoked,false);
  assert.equal(result.ok,false);
  assert.match(result.error,/BASE_XML_REQUIRES_SEPARATE_GOVERNED_FINAL_REVIEW/);
});

test('raw fallback preserves non-master JSON coordinate calibration settings',async()=>{
  const config={dtxrPositionOffset:{enabled:true,zOffset:100000}};
  let called;
  await runXmlCii2019WorkflowService(job([b1],config),{
    engineRunner:async j=>{called=j;return {ok:true,ciiText:'SYNTHETIC',diagnostics:{}};},
  });
  assert.deepEqual(JSON.parse(called.supportConfigJson),config);
});

test('raw conversion keeps staged JSON subject to its own native guard',async()=>{
  const source={...job([b1],{}),stagedJsonText:'{"source":"selected"}'};
  let forwarded;
  const result=await runXmlCii2019WorkflowService(source,{
    engineRunner:async j=>{
      forwarded=j;
      return {ok:false,error:'XML229_STAGED_POSITION_AMBIGUOUS',diagnostics:{}};
    },
  });
  assert.equal(forwarded.stagedJsonText,source.stagedJsonText);
  assert.equal(result.ok,false);
});

test('Preview conflict cannot inject its enriched XML into base output',async()=>{
  let forwarded;
  const result=await runXmlCii2019WorkflowService(job([b2]),{
    runParityEnricher:async()=>({
      applied:true,error:null,evidence:{ok:true,engineInputDigest:'digest'},
      logs:[],stats:{},xmlText:'<UNVERIFIED_MUTATION/>',
      branchRows:[{branchName:b2,extractionStatus:'AMBIGUOUS',
        lineKey:'S8822000',pipingClass:'',branchIdentityConflict:'EXACT_LINE_LIST_CLASS_CONFLICT'}],
    }),
    engineRunner:async j=>{
      forwarded=j;return {ok:true,ciiText:'SYNTHETIC',diagnostics:{}};
    },
  });
  assert.equal(result.ok,true);
  assert.equal(forwarded.sourceText,xml([b2]));
  assert.equal(forwarded.supportConfigJson,'{}');
});

test('population counts include duplicate occurrences and cannot reuse one preview result', () => {
  const occurrences = [
    { branchName: b2, branchOccurrenceId: 'br-1' },
    { branchName: b2, branchOccurrenceId: 'br-2' },
  ];
  const audit = auditConfiguredBranchFormats(occurrences, configured, [
    { branchName: b2, extractionStatus: 'MATCHED', lineKey: 'S8822000', pipingClass: '91261M7' },
  ]);
  assert.equal(audit.checkedCount, 2);
  assert.equal(audit.blocked, true);
  assert.ok(audit.failures.some(row => row.reason === 'OCCURRENCE_MISMATCH'));
  assert.ok(audit.failures.some(row => row.reason === 'POPULATION_COUNT_MISMATCH'));
});

test('matching selected occurrences and matching Preview identities qualify release custody', () => {
  const occurrences = [{ branchName: b1 }, { branchName: b2 }];
  const previewRows = [b1, b2].map((branchName, index) => ({
    branchName, extractionStatus: 'MATCHED', lineKey: index ? 'S8822000' : 'S8811000',
    pipingClass: '91261M7', matchedFormatIndex: index,
  }));
  const audit = auditConfiguredBranchFormats(occurrences, configured, previewRows);
  assert.equal(audit.blocked, false);
  assert.equal(audit.checkedCount, 2);
  assert.deepEqual(audit.failures, []);
});


test('15 dominant + 13 alternative occurrences meet an independent engineering identity oracle', () => {
  const dominantNames = Array.from({ length: 15 }, (_, i) =>
    '/ASIM-1885-3"-S8811000-91261M7-HC-01/B' + (i + 1));
  const alternativeNames = Array.from({ length: 13 }, (_, i) =>
    '/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B' + (i + 1));
  const names = [...dominantNames, ...alternativeNames];
  // Expected values are declared independently, not copied from the resolver or Preview.
  const expectedRows = names.map((branchName, index) => ({
    branchName, extractionStatus: 'MATCHED', matchedFormatIndex: index < 15 ? 0 : 1,
    lineKey: index < 15 ? 'S8811000' : 'S8822000', pipingClass: '91261M7',
  }));
  const occurrences = names.map((branchName, index) => ({
    branchName, branchOccurrenceId: 'ORACLE-' + (index + 1),
  }));
  const pass = auditConfiguredBranchFormats(occurrences, configured, expectedRows);
  assert.equal(pass.checkedCount, 28);
  assert.equal(pass.blocked, false, JSON.stringify(pass.failures));
  const altered = expectedRows.map(row => ({ ...row }));
  altered[16].pipingClass = 'S8822000';
  const negative = auditConfiguredBranchFormats(occurrences, configured, altered);
  assert.equal(negative.blocked, true);
  assert.deepEqual([negative.failures[0].occurrenceIndex, negative.failures[0].reason],
    [16, 'ENGINEERING_IDENTITY_MISMATCH']);
});

test('U5: 28 selected branch occurrences require full per-occurrence Preview identity', () => {
  const occurrences = Array.from({ length: 28 }, (_, i) => ({
    branchName: i < 15 ? b1 : b2, branchOccurrenceId: `branch-${i}`,
  }));
  const reviewed = occurrences.map((branch, i) => ({
    branchName: branch.branchName,
    lineKey: i < 15 ? 'S8811000' : 'S8822000',
    pipingClass: '91261M7', extractionStatus: 'MATCHED',
    matchedFormatIndex: i < 15 ? 0 : 1,
  }));
  const good = auditConfiguredBranchFormats(occurrences, configured, reviewed);
  assert.equal(good.checkedCount, 28);
  assert.equal(good.blocked, false, JSON.stringify(good.failures));
  const wrongClass = reviewed.map(row => ({ ...row }));
  wrongClass[26].pipingClass = 'S8822000';
  const bad = auditConfiguredBranchFormats(occurrences, configured, wrongClass);
  assert.equal(bad.blocked, true);
  assert.ok(bad.failures.some(f => f.occurrenceIndex === 26 && f.status === 'PREVIEW_DIVERGENCE'));
  const dropped = auditConfiguredBranchFormats(occurrences, configured, reviewed.slice(0, 27));
  assert.equal(dropped.blocked, true);
  assert.ok(dropped.failures.some(f => f.reason === 'POPULATION_COUNT_MISMATCH'));
});

test('issue 376 EF05 real Python 7-case optional enrichment conversion matrix',async()=>{
  const {proveNativeOptionalMatrix}=await import('./xml229-issue376-source-native-matrix.mjs');
  const proof=await proveNativeOptionalMatrix();
  assert.equal(proof.scenarios,7);
});
test('issue 376 two Preview passes do not select Rating or conflict authority',async()=>{
  const {proveDualFormatPreview}=await import('./xml229-issue376-source-native-matrix.mjs');
  assert.equal(proveDualFormatPreview(),true);
});
