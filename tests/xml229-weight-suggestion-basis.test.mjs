import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {xml229WeightSuggestionTooltip} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-weight-suggestion-basis.mjs';
import {projectXml229WeightCandidateBasis} from '../tabs/xml-cii-2019-standalone/integration/xml229-verified-weight-row-adapter.mjs';
import {createXmlCiiFactWeightScorer,legacyXmlCiiWeightFacts} from '../converters/xml-cii2019-core/weight-facts-xml-cii-adapter.js';
const physical={componentType:'VALV',boreMm:100,rating:'300',lengthMm:305};
const candidate={type:'GATE',typeDesc:'Gate valve',masterRowOrdinal:0,masterRowId:'G-1',
 rowBore:100,rowRating:'300',rowLength:305,masterWeight:77,lengthDelta:0,
 lengthToleranceMm:1,weightMethod:'master',semanticReason:'Direct match',score:1,
 rowData:{privateRow:'must not cross'},unrelated:'not displayed'};
const proposal={value:77,unit:'kg',method:'master',qualified:true,score:1,
 eligibilityReasons:['exact-bore-rating-length'],candidateBasis:projectXml229WeightCandidateBasis({extensions:{candidate}})};
test('exact suggestion displays its actual master and source dimensions, score and zero length difference',()=>{
 const p=structuredClone(proposal),row=structuredClone(physical);
 const tip=xml229WeightSuggestionTooltip(row,p,77);
 for(const expected of ['Source-qualified suggestion: 77 kg (largest suggestion)',
  'Weight master lookup','Current component: DN100 · Rating 300 · Length 305 mm',
  'ID G-1','record 1','Gate valve','Weight 77 kg','Match score: 100%',
  'Length difference: 0 mm · tolerance 1 mm','Confirm Final separately'])assert(tip.includes(expected),expected);
 assert.deepEqual(p,proposal);assert.deepEqual(row,physical);
 assert(!tip.includes('privateRow'));assert(!tip.includes('unrelated'));
});
test('derived flange suggestion retains actual reference weight, length ratio and scorer warning',()=>{
 const tip=xml229WeightSuggestionTooltip({...physical,componentType:'RIGID',lengthMm:109},{
  ...proposal,value:13.08,score:.45,qualified:false,method:'flange-length-extrapolated',
  eligibilityReasons:['explicit-review-required','SOURCE_FAMILY_UNKNOWN'],candidateBasis:{
   ...proposal.candidateBasis,rowLength:100,masterWeight:12,extrapolationRatio:1.09,
   weightMethod:'flange-length-extrapolated',warning:'12 kg at 100 mm scaled to 109 mm.',
  }},13.08);
 for(const expected of ['Estimated suggestion','Flange master weight scaled',
  'Weight 12 kg','Length 100 mm','Reported length ratio: 1.09','Match score: 45%',
  '12 kg at 100 mm scaled to 109 mm.','Source component family is unknown'])assert(tip.includes(expected),expected);
});
test('interpolation is described without inventing reference endpoints or a formula',()=>{
 const tip=xml229WeightSuggestionTooltip(physical,{...proposal,qualified:false,
  candidateBasis:{weightMethod:'length-interpolated',warning:'Interpolated from 292-330 mm master records.'}});
 assert.match(tip,/Length interpolation/);assert.match(tip,/292-330 mm/);
 assert.doesNotMatch(tip,/Reported length ratio|\b77\s*[*×]/);
});
test('instrument tooltip distinguishes proposed kg from source RIGID classification',()=>{
 const tip=xml229WeightSuggestionTooltip({...physical,componentType:'INST'},proposal);
 assert.match(tip,/selecting kg does not establish RIGID classification/);
 assert.match(tip,/checks the source model/);
 assert.doesNotMatch(tip,/classified automatically|engineering approval verified/i);
});
test('missing or malformed evidence is not presented as DN0, zero weight or a fabricated record',()=>{
 const tip=xml229WeightSuggestionTooltip({}, {value:13,unit:'kg',qualified:false,score:null});
 assert.match(tip,/Basis: Not supplied/);assert.match(tip,/Record details not supplied/);
 assert.doesNotMatch(tip,/DN0|Match score|Weight 0 kg|record 1|Length difference/);
 const invalid=projectXml229WeightCandidateBasis({extensions:{candidate:{
  masterRowOrdinal:{bad:true},masterWeight:NaN,warning:{html:'<bad>'},rowData:{private:true}}}});
 assert.equal(invalid.masterWeight,null);assert.equal(invalid.warning,null);
 assert.equal(invalid.masterRowOrdinal,null);assert(!('rowData' in invalid));
 assert(Object.isFrozen(invalid));
});
test('basis comes from the actual scorer and preserves proposal IDs, kilograms and qualification',()=>{
 const config={weight:{masterRows:[{Bore:100,Rating:'300',Length:305,Weight:77,Type:'GATE',TypeDesc:'Gate Valve'}]}};
 const basis={basisId:'b'.repeat(64),domainId:'xml-cii/2019',scope:[{sourceId:'SOURCE'}]};
 const facts=legacyXmlCiiWeightFacts([{branchOccurrenceIndex:0,nodeOrdinal:1,
  componentType:'VALV',componentRefNo:'V1',nodeName:'GATE VALVE',
  dtxr:'GATE VALVE',boreMm:100,lengthMm:305,rating:'300'}],basis,'SOURCE');
 const [p]=createXmlCiiFactWeightScorer(config)(facts,basis);
 assert(p);const before=JSON.stringify(p);
 const carried={...p,score:p.extensions.candidate.score,candidateBasis:projectXml229WeightCandidateBasis(p)};
 const tip=xml229WeightSuggestionTooltip(physical,carried);
 assert.equal(carried.value,p.value);assert.equal(carried.proposalId,p.proposalId);
 assert.equal(carried.qualified,p.qualified);assert.equal(JSON.stringify(p),before);
 assert.equal(carried.candidateBasis.rowBore,100);
 assert.equal(carried.candidateBasis.rowLength,305);
 assert.equal(carried.candidateBasis.masterWeight,77);
 assert.match(tip,/Weight 77 kg/);assert.match(tip,/DN100/);
});
test('both actual Worker projection and popup carry the same bounded tooltip evidence in docs',async()=>{
 const dir='tabs/xml-cii-2019-standalone/';
 for(const path of ['integration/xml229-verified-weight-row-adapter.mjs',
   'ui-adapted/xml229-run-unresolved-mass-popup.mjs','ui-adapted/xml229-weight-suggestion-basis.mjs']){
  assert.equal(await readFile(new URL('../'+dir+path,import.meta.url),'utf8'),
   await readFile(new URL('../docs/'+dir+path,import.meta.url),'utf8'));
 }
 const popup=await readFile(new URL('../'+dir+'ui-adapted/xml229-run-unresolved-mass-popup.mjs',import.meta.url),'utf8');
 assert.match(popup,/chip.title=xml229WeightSuggestionTooltip\(physical,p,maximum\)/);
 assert.match(popup,/setAttribute\('aria-description',chip.title\)/);
});
