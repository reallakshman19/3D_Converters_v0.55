import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {xmlCiiBranchScopeFromState,buildXmlCiiBranchOccurrences,xmlCiiSourceDigest}
 from '../tabs/xml-cii-2019-standalone/xml-cii-branch-scope.js';
import {assertXml229P4OriginalFullSelection}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js';

import {auditXml229PrivateP4Scope}
 from '../scripts/xml-cii-229-p4-private-scope-audit.mjs';
const authentic=await readFile(new URL('../Benchmarks/1885Sjson/FirstpassXML',import.meta.url),'utf8');
const sourceRows=buildXmlCiiBranchOccurrences(authentic);
const count=n=>assertXml229P4OriginalFullSelection(n);
const bound=(xml,selection,mode='occurrence')=>({
 sourceText:xml,branchSelection:{
  sourceDigest:xmlCiiSourceDigest(xml),
  selectionIdentity:mode,
  selectedBranchOccurrenceIds:selection,
 },
});
function derivedBranches(size){
 // Each source branch BODY comes from a REAL repository Firstpass XML node
 // sample, but 28/41 selection counts are generated TEST DATA, not Owner files.
 const first=authentic.match(/<Branch\b[^>]*>[\s\S]*?<\/Branch\s*>/i)?.[0];
 assert(first);
 const instances=Array.from({length:size},(_,i)=>
  first.replace(/<Branchname\b[^>]*>[\s\S]*?<\/Branchname\s*>/i,
    '<Branchname>/SYNTHETIC-1885-91261M7/B'+(i+1)+'</Branchname>'));
 return '<PipeStressExport><Pipe>'+instances.join('\n')+'</Pipe></PipeStressExport>';
}
const realScope=xmlCiiBranchScopeFromState({sourceKind:'xml',sourceText:authentic});
test('genuine repo Firstpass XML census stays complete and source-bound',()=>{
 assert.equal(sourceRows.length,5,'The public repository fixture is FIVE branches, not the private 28');
 const selected=sourceRows.map(row=>row.branchOccurrenceId);
 const scope=count(bound(authentic,selected));
 assert.equal(scope.selectedBranchOccurrences.length,5);
 assert.equal(scope.excludedBranchOccurrences.length,0);
 assert.equal(scope.mode,'all');
 assert.equal(scope.manifest.sourceDigest,xmlCiiSourceDigest(authentic));
});
test('genuine real XML 4/5 partial selected cannot silently promote to ALL',()=>{
 const subset=sourceRows.slice(0,4).map(row=>row.branchOccurrenceId);
 assert.throws(()=>count(bound(authentic,subset)),
   error=>error.code==='PARTIAL_XML_SCOPE_HELD'&&/4 of 5/.test(error.message));
});
test('Owner-shaped 28/28 original branches are full-source only when every original identity is selected',()=>{
 const xml=derivedBranches(28);
 const selected=buildXmlCiiBranchOccurrences(xml).map(row=>row.branchOccurrenceId);
 const scope=count(bound(xml,selected));
 assert.equal(scope.selectedBranchOccurrences.length,28);
 assert.equal(scope.excludedBranchOccurrences.length,0);
 assert.equal(scope.sourceBranchOccurrences.length,28);
});
test('Owner-shaped selected 28/41 cannot invoke full original O1 engineering facts',()=>{
 const xml=derivedBranches(41);
 const selected=buildXmlCiiBranchOccurrences(xml).slice(0,28)
  .map(row=>row.branchOccurrenceId);
 const old=xmlCiiBranchScopeFromState({
  sourceKind:'xml',sourceText:xml,
  branchSelection:bound(xml,selected).branchSelection,
 });
 assert.equal(old.selectedBranchOccurrences.length,28);
 assert.equal(old.sourceBranchOccurrences.length,41);
 assert.throws(()=>count(bound(xml,selected)),
  error=>error.code==='PARTIAL_XML_SCOPE_HELD'&&/28 of 41/.test(error.message));
});
test('stale 28/41 source digest no longer becomes a silent 41/41 ALL selection',()=>{
 const previous=derivedBranches(41);
 const ids=buildXmlCiiBranchOccurrences(previous).slice(0,28)
  .map(row=>row.branchOccurrenceId);
 const modified=previous.replace('SYNTHETIC-1885-91261M7',
  'SYNTHETIC-CHANGED-1885-91261M7');
 const stale={...bound(previous,ids),sourceText:modified};
 const legacy=xmlCiiBranchScopeFromState({
  sourceKind:'xml',sourceText:modified,branchSelection:stale.branchSelection,
 });
 assert.equal(legacy.selectedBranchOccurrences.length,41,
  'The legacy normalization silently resets stale explicit selections to ALL');
 assert.throws(()=>count(stale),
  error=>error.code==='STALE_OR_UNBOUND_SELECTION');
});
test('unbound explicit subset and duplicate occurrence claims are refused, not expanded',()=>{
 const xml=derivedBranches(28);
 const ids=buildXmlCiiBranchOccurrences(xml).map(row=>row.branchOccurrenceId);
 assert.throws(()=>count({sourceText:xml,
  branchSelection:{selectionIdentity:'occurrence',
   selectedBranchOccurrenceIds:ids.slice(0,27)}}),
  error=>error.code==='STALE_OR_UNBOUND_SELECTION');
 const dup=[...ids];dup[27]=ids[0];
 assert.throws(()=>count(bound(xml,dup)),
  error=>error.code==='PARTIAL_XML_SCOPE_HELD'||
    error.code==='ORIGINAL_BRANCH_OCCURRENCE_SET_DRIFT');
});
test('unbound default ALL without explicit selection does not invent prior partial ownership',()=>{
 const xml=derivedBranches(28);
 const scope=count({sourceText:xml,branchSelection:{}});
 assert.equal(scope.sourceBranchOccurrences.length,28);
 assert.equal(scope.selectedBranchOccurrences.length,28);
});

test('private audit emits only source SHA/count and HOLD, no raw branch names or CII authority',()=>{
 const xml=derivedBranches(41);
 const selection=bound(xml,buildXmlCiiBranchOccurrences(xml).slice(0,28)
   .map(row=>row.branchOccurrenceId)).branchSelection;
 const report=auditXml229PrivateP4Scope({
   xml,branchSelection:selection,expectedSelectedCount:28,
 });
 assert.equal(report.sourceBranchOccurrenceCount,41);
 assert.equal(report.status,'HOLD');
 assert.equal(report.blocker,'PARTIAL_XML_SCOPE_HELD');
 assert.equal(report.nativeCiiReleaseAuthorized,false);
 assert.equal(report.originalPhysicalFactCensusVerified,false);
 assert.match(report.sourceSha256,/^[a-f0-9]{64}$/);
 const json=JSON.stringify(report);
 assert(!json.includes('SYNTHETIC-1885'));
 assert(!json.includes('<PipeStressExport>'));
});
test('private audit full genuine repository fixture emits source-only eligibility, never Run authority',()=>{
 const ids=sourceRows.map(row=>row.branchOccurrenceId);
 const report=auditXml229PrivateP4Scope({
   xml:authentic,branchSelection:bound(authentic,ids).branchSelection,
   expectedSelectedCount:5,
 });
 assert.equal(report.status,'FULL_ORIGINAL_XML_SCOPE_ELIGIBLE_ONLY');
 assert.equal(report.verifiedFullSourceSelectedCount,5);
 assert.equal(report.weightFinalEngineeringAccepted,false);
 assert.equal(report.nativeCiiReleaseAuthorized,false);
});
test('private audit redacts stale source selections rather than reporting fictitious selected cardinality',()=>{
 const prior=derivedBranches(41);
 const changed=prior.replace('SYNTHETIC-1885','MODIFIED-SYNTHETIC-1885');
 const report=auditXml229PrivateP4Scope({
   xml:changed,
   branchSelection:bound(prior,buildXmlCiiBranchOccurrences(prior).slice(0,28)
    .map(x=>x.branchOccurrenceId)).branchSelection,
   expectedSelectedCount:28,
 });
 assert.equal(report.status,'HOLD');
 assert.equal(report.blocker,'STALE_OR_UNBOUND_SELECTION');
 assert.equal(report.verifiedFullSourceSelectedCount,null);
 assert.equal(report.selectionBoundToCurrentXml,false);
});
