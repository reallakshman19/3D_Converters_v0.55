import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRmssStructuralMembers } from '../../converters/rmss-attribute-parser.js';
import { indexAttNativeHierarchy } from '../../tabs/model-converters/att-native-hierarchy-index.js';
import {
  createAttScopeSelection, setAttScopeRule, attScopePartiallyExcludedBranches,
} from '../../tabs/model-converters/att-native-scope-selection.js';

const records = [
  ['SITE','/S','/*',null,null],
  ['ZONE','/S/ZA','/S',null,null],
  ['SUBE','/S/ZA/M','/S/ZA','0 0 0','100 0 0'],
  ['ZONE','/S/ZB','/S',null,null],
  ['SUBE','/S/ZB/M','/S/ZB','0 0 0','200 0 0'],
  ['BRAN','/S/ZA/B','/S/ZA',null,null],
  ['VALV','/S/ZA/B/V','/S/ZA/B','0 0 0','10 0 0'],
];
const source = records.flatMap(([type,name,owner,apos,lpos])=>[
  'NEW '+name,'NAME:= '+name,'TYPE:= '+type,'OWNER:= '+owner,
  ...(apos?['APOS:= '+apos,'LPOS:= '+lpos]:[]),'END',
]).join('\n');
const allMembers = parseRmssStructuralMembers(source);
assert.equal(allMembers.length, 2);
assert.deepEqual(allMembers.map(m=>m.sourceName),['/S/ZA/M','/S/ZB/M']);
const oneZone = parseRmssStructuralMembers(source, {
  nativeRules:[['/S',true],['/S/ZB',false]],
});
assert.deepEqual(oneZone.map(m=>m.sourceName),['/S/ZA/M']);
assert.ok(oneZone[0].sourceOwner === '/S/ZA');
assert.deepEqual(parseRmssStructuralMembers(source,{nativeRules:[['/S/ZB',true]]})
  .map(m=>m.sourceName),['/S/ZB/M']);
assert.deepEqual(parseRmssStructuralMembers(source,{nativeRules:[['/S',false]]}),[]);
assert.throws(()=>parseRmssStructuralMembers(source,{nativeRules:[]}),/explicit/);
const index = await indexAttNativeHierarchy(source);
let selection = setAttScopeRule(index,createAttScopeSelection(),'/S/ZA',true);
assert.deepEqual(attScopePartiallyExcludedBranches(index,selection),[]);
selection = setAttScopeRule(index,selection,'/S/ZA/B/V',false);
assert.deepEqual(attScopePartiallyExcludedBranches(index,selection),['/S/ZA/B']);
selection = setAttScopeRule(index,selection,'/S/ZA/B',false);
assert.deepEqual(attScopePartiallyExcludedBranches(index,selection),[]);
const converter = await readFile(new URL('../../tabs/model-converters/converters/rvmattr-to-xml.js',import.meta.url),'utf8');
const popup = await readFile(new URL('../../tabs/model-converters/att-native-scope-popup.js',import.meta.url),'utf8');
assert.match(converter,/nativeFiltered\s*\?/);
assert.match(converter,/Selected native ATT zones cannot yet be applied to binary RVM/);
assert.match(popup,/attScopePartiallyExcludedBranches/);
console.log('test-att-native-conversion-scope: PASS exact structural selection and partial branch guard');
