import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readFile} from 'node:fs';
import {xml229PreviewLineKeyCandidateRows} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer.js';
import {XmlCiiAdaptedEditablePreviewTable} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-editable-preview-table.js';
import {extractBranchFieldsWithFormats} from '../converters/xml-cii2019-core/branch-format-extraction.js';

const xml=readFileSync(new URL('../Benchmarks/EF-05-PRO.TEST.xml',import.meta.url),'utf8');
const names=[...xml.matchAll(/<Branchname>([^<]+)<\/Branchname>/g)].map(m=>m[1]);
const format=(lineKey,pipingClass)=>({tokenDelimiter:'-',lineKey:{tokenPosition:lineKey},
  pipingClass:{tokenPosition:pipingClass},rating:{tokenPosition:''},bore:{tokenPosition:3}});
const formats=[format(4,5),format('4,5',6)];
const candidateRows=(active)=>names.map(branchName=>{
  const x=extractBranchFieldsWithFormats(branchName,{formats:[formats[active]]});
  return {branchName,lineKey:x.lineKey,extractionStatus:x.status};
});

test('real EF05 keeps candidate keys for all 41 occurrences, not only first 20',()=>{
  assert.equal(names.length,41);
  const original=names.map(branchName=>({branchName,lineKey:'',
    extractionStatus:extractBranchFieldsWithFormats(branchName,{formats}).status}));
  const copies=xml229PreviewLineKeyCandidateRows(original,[
    {formatIndex:0,branchRows:candidateRows(0)},
    {formatIndex:1,branchRows:candidateRows(1)},
  ]);
  assert(copies.every(x=>x.extractionStatus==='AMBIGUOUS'));
  assert(copies.every(x=>x.lineKey===''&&x.formatLineKeyCandidates.length===2));
  assert.equal(copies[0].formatLineKeyCandidates[0].lineKey,'P8810021');
  assert.equal(copies[0].formatLineKeyCandidates[1].lineKey,'P881002131441C4');
  assert(original.every(x=>!Object.hasOwn(x,'formatLineKeyCandidates')));
  const html=new XmlCiiAdaptedEditablePreviewTable({branchRows:copies,nodesByBranch:new Map()}).renderHTML();
  assert.equal((html.match(/data-mc-linekey-authority="unresolved"/g)||[]).length,41);
  assert.equal((html.match(/data-mc-linekey-candidates/g)||[]).length,41);
  assert.match(html,/data-mc-linekey-candidate="0"/);
  assert.match(html,/data-mc-linekey-candidate="1"/);
  assert.match(html,/F1: P8810021/);
  assert.match(html,/F2: P881002131441C4/);
});

test('candidate join uses ordinal and branch name, never a same-name different occurrence',()=>{
  const rows=[{branchName:'/X/B1',lineKey:'',extractionStatus:'AMBIGUOUS'},
    {branchName:'/X/B1',lineKey:'',extractionStatus:'AMBIGUOUS'}];
  const choices=xml229PreviewLineKeyCandidateRows(rows,[
    {formatIndex:0,branchRows:[
      {branchName:'/X/B1',lineKey:'FIRST',extractionStatus:'MATCHED'},
      {branchName:'/X/B1',lineKey:'SECOND',extractionStatus:'MATCHED'}]},
    {formatIndex:1,branchRows:[
      {branchName:'/X/B1',lineKey:'ALT-FIRST',extractionStatus:'MATCHED'},
      {branchName:'/OTHER/B1',lineKey:'BAD',extractionStatus:'MATCHED'}]},
  ]);
  assert.deepEqual(choices[0].formatLineKeyCandidates.map(x=>x.lineKey),['FIRST','ALT-FIRST']);
  assert.deepEqual(choices[1].formatLineKeyCandidates.map(x=>x.lineKey),['SECOND']);
  assert.equal(rows[0].lineKey,'');
  assert.equal(rows[1].lineKey,'');
});

test('root/docs Preview mirrors byte-identical',()=>{
  for(const name of ['xml-cii-adapted-preview-renderer.js',
    'xml-cii-adapted-editable-preview-table.js']){
    const path='tabs/xml-cii-2019-standalone/ui-adapted/'+name;
    assert.equal(readFileSync(new URL('../'+path,import.meta.url),'utf8'),
      readFileSync(new URL('../docs/'+path,import.meta.url),'utf8'));
  }
});
