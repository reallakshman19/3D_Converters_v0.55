import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractBranchFieldsWithFormats} from '../converters/xml-cii2019-core/branch-format-extraction.js';
import {deriveLineKeyFromBranchName} from '../converters/xml-cii2019-core/regex-line-key.js';
import {auditConfiguredBranchFormats} from '../tabs/xml-cii-2019-standalone/xml-cii-branch-format-release.js';
import {runStandaloneRegexTester} from '../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';

const xml = readFileSync(new URL('../Benchmarks/EF-05-PRO.TEST.xml', import.meta.url), 'utf8');
const branches = [...xml.matchAll(/<Branchname>([^<]+)<\/Branchname>/g)]
  .map(([_, branchName]) => ({branchName}));
function positional(lineKey, pipingClass) {
  return {tokenDelimiter:'-', lineKey:{tokenPosition:lineKey},
    pipingClass:{tokenPosition:pipingClass}, rating:{tokenPosition:''}, bore:{tokenPosition:3}};
}
function configuration() {
  return {ratingSequence:[['3','300']], formats:[positional(4,5), positional(5,6)]};
}
function saved(config) {
  // InputXML mode exercises the same real normalizer/writeback without a DOM test double.
  return JSON.parse(runStandaloneRegexTester({sourceKind:'inputxml',
    extractionConfig:config, supportConfigJson:'{}'}).supportConfigJson);
}

test('41 branches: both enabled disagree; explicitly excluding shifted Format 2 survives Save Config', () => {
  const config = configuration();
  assert.equal(branches.length,41);
  assert.equal(auditConfiguredBranchFormats(branches,config).failures.length,41);
  assert.equal(extractBranchFieldsWithFormats(branches[0].branchName,config).status,'AMBIGUOUS');
  config.formats[1].enabled = false;
  const result = saved(config);
  assert.equal(result.regexTester.formats[1].enabled,false);
  assert.equal(result.formats[1].enabled,false);
  assert.equal(auditConfiguredBranchFormats(branches,result).blocked,false);
  const first=extractBranchFieldsWithFormats(branches[0].branchName,result);
  assert.deepEqual([first.status,first.lineKey,first.pipingClass,first.rating,first.bore,first.matchedFormatIndex],
    ['MATCHED','P8810021','31441C4','300','8',0]);
  assert.equal(deriveLineKeyFromBranchName(branches[0].branchName,result),'P8810021');
  config.formats[1].enabled = true;
  assert.equal(auditConfiguredBranchFormats(branches,saved(config)).failures.length,41);
});

test('disabled first format is excluded and legacy projections follow the enabled alternative', () => {
  const config = configuration();
  config.formats = [{...positional(5,6),enabled:false}, {...positional(4,5),enabled:true}];
  const result = saved(config);
  assert.equal(auditConfiguredBranchFormats(branches,result).blocked,false);
  assert.equal(extractBranchFieldsWithFormats(branches[0].branchName,result).matchedFormatIndex,1);
  assert.equal(result.linelist.lineKeyTokenPositions,'4');
  assert.equal(result.rating.pipingClassTokenIndex,5);
});

test('all disabled fail closed; explicit conflicts and empty arrays remain unresolved', () => {
  const config = configuration();
  config.formats.forEach(f => {f.enabled=false;});
  assert.equal(extractBranchFieldsWithFormats(branches[0].branchName,saved(config)).status,'UNMATCHED');
  assert.equal(auditConfiguredBranchFormats(branches,saved(config)).blocked,true);
  assert.equal(extractBranchFieldsWithFormats(branches[0].branchName,{formats:[]}).status,'UNMATCHED');
  const conflict=configuration();
  conflict.formats[0].enabled=true;
  conflict.formats[1].enabled=true;
  assert.equal(extractBranchFieldsWithFormats(branches[0].branchName,saved(conflict)).status,'AMBIGUOUS');
});

test('legacy missing enable flags preserve configured multi-format behavior and authored rules', () => {
  const config=configuration(), before=structuredClone(config);
  const result=saved(config);
  assert.equal(extractBranchFieldsWithFormats(branches[0].branchName,result).status,'AMBIGUOUS');
  assert.deepEqual(config,before);
  assert.equal(Object.hasOwn(result.formats[0],'enabled'),false);
  const distinctive={formats:[
    {lineKey:{regex:'(P8810021)'},pipingClass:{regex:'(31441C4)'}},
    {lineKey:{regex:'(S12345)'},pipingClass:{regex:'(91261M7)'}},
  ]};
  const alternative=extractBranchFieldsWithFormats('/PL-S12345-91261M7/B1',saved(distinctive));
  assert.equal(alternative.status,'MATCHED');
  assert.equal(alternative.matchedFormatIndex,1);
  assert.equal(alternative.lineKey,'S12345');
});
