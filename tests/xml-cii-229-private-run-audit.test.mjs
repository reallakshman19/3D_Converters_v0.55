import assert from 'node:assert/strict';
import test from 'node:test';
import {buildRedactedOwner229Report} from '../scripts/xml-cii-229-private-run-audit.mjs';
import {buildXmlCiiBranchOccurrences,xmlCiiSourceDigest} from '../tabs/xml-cii-2019-standalone/xml-cii-branch-scope.js';

const name='/ASIM-1885-3-S8811000-91261M7-HC-01';
const source=(n=28)=>'<Plant>'+Array.from({length:n},(_,i)=>'<Branch><Branchname>'+name+'/B'+(i+1)+'</Branchname></Branch>').join('')+'</Plant>';
const match={lineKey:{regex:'(S8811000)',group:1},pipingClass:{regex:'(91261M7)',group:1}};
const cfg=(formats)=>({regexTester:{formats}});

test('redacted local Run report has correct 28 exact occurrences but never exposes original names or configured regex',()=>{
  const xml=source();
  const report=buildRedactedOwner229Report({xml,config:cfg([{...match,lineKey:{regex:'(NEVER)',group:1}}]),expectedCount:28});
  assert.equal(report.checkedOriginalOccurrences,28);
  assert.equal(report.unmatched,28);
  assert.equal(report.blocked,true);
  assert.equal(report.first20.length,20);
  assert.equal(report.first20[0].formats[0].reasons.lineKey,'REGEX_NO_MATCH_OR_CAPTURE');
  assert.equal(report.selectionProof,'ALL_SOURCE_UNVERIFIED');
  const output=JSON.stringify(report);
  for(const secret of [name,'S8811000','91261M7','(NEVER)','branchName','branchOccurrenceId']){
    assert.equal(output.includes(secret),false,'Leaked private value: '+secret);
  }
});

test('valid local exact 28 makes only configured-format gate clear, never release acceptance',()=>{
  const xml=source();
  const report=buildRedactedOwner229Report({xml,config:cfg([match]),expectedCount:28});
  assert.equal(report.blocked,false);
  assert.equal(report.checkedOriginalOccurrences,28);
  assert.equal(report.authority,'RUN_FORMAT_ONLY_NOT_PREVIEW_OR_FINAL_CII');
  assert.equal(report.first20.length,0);
});

test('optional Rating differences never block exact Line Key and Piping Class identity',()=>{
  const xml=source();
  const config=cfg([
    {...match,rating:{regex:'(S8811000)',group:1}},
    {...match,rating:{regex:'(91261M7)',group:1}},
  ]);
  const report=buildRedactedOwner229Report({xml,config,expectedCount:28});
  assert.equal(report.blocked,false);
  assert.equal(report.ambiguous,0);
  assert.equal(report.first20.length,0);
  assert(!JSON.stringify(report).includes(name));
});

test('source-bound saved selected occurrence IDs preserve duplicates and fail closed on stale source',()=>{
  const xml=source(4).replace('/B2','/B1');
  const occurrences=buildXmlCiiBranchOccurrences(xml);
  assert.equal(occurrences.length,4);
  const selection={sourceDigest:xmlCiiSourceDigest(xml),selectionIdentity:'occurrence',selectedBranchOccurrenceIds:occurrences.slice(0,2).map(r=>r.branchOccurrenceId)};
  const report=buildRedactedOwner229Report({xml,config:cfg([match]),selection,expectedCount:2});
  assert.equal(report.selectionBoundToSource,true);
  assert.equal(report.checkedOriginalOccurrences,2);
  assert.equal(report.duplicateNameOccurrences,2);
  assert.throws(()=>buildRedactedOwner229Report({xml,config:cfg([match]),selection:{...selection,sourceDigest:'fnv1a-0000-0'}}),/SELECTION_SOURCE_MISMATCH/);
  assert.throws(()=>buildRedactedOwner229Report({xml,config:cfg([match]),selection,expectedCount:28}),/EXPECTED_OCCURRENCE_COUNT_MISMATCH/);
});

test('stored editor/config discrepancy is reported only as boolean, never serialized',()=>{
  const xml=source(1),config=cfg([match]);
  const report=buildRedactedOwner229Report({xml,config,regexStorage:{formats:[]},expectedCount:1});
  assert.equal(report.persistedRegexDiffersFromEffectiveRun,true);
  assert.equal(report.sensitiveDataIncluded,false);
  assert.throws(()=>buildRedactedOwner229Report({xml,config:{},expectedCount:1}),/RUN_EFFECTIVE_FORMATS_REQUIRED/);
});
