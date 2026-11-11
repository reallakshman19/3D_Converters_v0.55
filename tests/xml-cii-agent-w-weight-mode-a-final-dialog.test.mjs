import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWeightReviewService, WEIGHT_SCHEMA } from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import { readVerifiedModeAFinalRows } from '../converters/xml-cii2019-core/weight-facts-mode-a-final-read.js';
import { openVerifiedModeAFinalWeightReviewDialog } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-final-canonical-dialog.js';

const digest=v=>createHash('sha256').update(String(v)).digest('hex');
function fixture(n=120){
  const scope=['PL01','PL06'],hash=digest('U7/canonical-final');
  const basis={schemaVersion:WEIGHT_SCHEMA,domainId:'xml-cii/2019',basisId:hash,
    sourceRefs:scope.map(sourceId=>({sourceId,sha256:digest(sourceId),mediaType:'application/xml'})),
    scope:scope.map(sourceId=>({sourceId,selectionRef:'all'})),
    selectionSha256:digest('selection'),stagedSourceSha256:null,masters:{},
    configSha256:digest('config'),overridesSha256:digest('overrides')};
  const facts=[];
  for(let i=0;i<n;i++){
    const sourceId=i<n/2?'PL01':'PL06';
    const value=i===n-1?null:i===0?59:15;
    facts.push({schemaVersion:WEIGHT_SCHEMA,basisId:hash,domainId:basis.domainId,
      subjectType:'physical-component',sourceId,
      // Both source sets intentionally repeat XML NodeNumber=-1. Identity is
      // the source-local original ordinal, NEVER legacy negative node labels.
      occurrenceId:JSON.stringify([sourceId,0,i,'valve-REPEATED--1']),
      fieldId:'mass.kg',value,unit:'kg',
      authority:value===null?'unresolved':'source',
      provenance:[{sourceRef:sourceId,locator:'original/branch-0/node-'+i}],
      diagnostics:[]});
  }
  const review=createWeightReviewService({score:()=>[]});review.openBasis(basis,{facts});
  return {basis,review,openedFacts:facts.length,facts};
}
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.parent=null;this.listeners={};
    this.type='';this.value='';this.textContent='';this.disabled=false;this.attributes={};}
  appendChild(child){this.children.push(child);child.parent=this;return child;}
  replaceChildren(...args){this.children=[];for(const c of args)this.appendChild(c);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,cb){this.listeners[type]=cb;}
  dispatch(type){this.listeners[type]?.();}
  click(){this.dispatch('click');}
  focus(){}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  walk(){return[this,...this.children.flatMap(x=>x.walk())];}
}
function screen(){
  const body=new Element('body'),doc={body,createElement:tag=>new Element(tag)};
  return {body,doc};
}
const element=(body,tag,label)=>body.walk().find(x=>x.tag===tag&&
  (label===undefined||x.textContent===label));
const rows=body=>body.walk().filter(x=>x.tag==='div'&&
  x.className==='mc-verified-final-physical-row');
function edit(row,kg,reason){
  const input=row.children.find(x=>x.tag==='input');
  const textarea=row.children.find(x=>x.tag==='textarea');
  assert.ok(input&&textarea,'editable native controls on canonical row');
  input.value=String(kg);input.dispatch('input');
  textarea.value=reason;textarea.dispatch('input');
}

test('U7 canonical Mode A read-model covers every source and retains independent identities',()=>{
  const session=fixture(120),view=readVerifiedModeAFinalRows(session);
  assert.equal(view.physicalCount,120);
  assert.equal(view.verifiedFactCount,120);
  assert.equal(view.sources.length,2);
  assert.equal(view.unresolved,1);
  assert.equal(view.rows[0].sourceId,'PL01');
  assert.equal(view.rows[0].sourceKg,59);
  assert.equal(view.rows.at(-1).sourceId,'PL06');
  assert.equal(view.rows.at(-1).status,'Needs review');
  assert.equal(new Set(view.rows.map(x=>x.occurrenceId)).size,120);
  assert.equal(session.review.getDecisionState({basisId:session.basis.basisId,
    scopeId:'PL01',stage:'Rigidmatch2'}).decisionRevision,null);
});

test('U7 Mode A native clicks preserve off-page explicit edits and all-source final freeze',async()=>{
  const session=fixture(120),{body,doc}=screen(),base=session.basis.basisId;
  const pending=openVerifiedModeAFinalWeightReviewDialog({session,documentRef:doc,pageSize:50});
  assert.equal(rows(body).length,50);  // first visible page only
  assert.equal(session.review.getDecisionState({basisId:base,scopeId:'PL01',stage:'Rigidmatch2'}).decisionRevision,null);
  const first=rows(body)[0],firstId=session.facts[0].occurrenceId;
  assert.equal(first.children[0].textContent.includes(firstId),true);
  edit(first,44,'Independent Final inspection overrides original XML 59 kg.');
  element(body,'button','Next').click();
  assert.equal(rows(body).length,50);
  element(body,'button','Next').click();
  assert.equal(rows(body).length,20);
  const last=rows(body).at(-1),lastId=session.facts.at(-1).occurrenceId;
  assert.ok(last.children[0].textContent.includes(lastId));
  edit(last,22,'Engineer measured missing source PL06 original valve.');
  element(body,'button','Previous').click();
  element(body,'button','Previous').click();
  assert.equal(rows(body)[0].children.find(x=>x.tag==='input').value,'44',
    'first page explicit edit survives two page navigations');
  assert.equal(session.review.getDecisionState({basisId:base,scopeId:'PL01',stage:'Rigidmatch2'}).decisionRevision,null,
    'typing or paging never accepts mass');
  element(body,'button','Apply verified Final reviews').click();
  const result=await pending;
  assert.equal(result.cancelled,false);
  assert.equal(result.physicalCount,120);
  assert.equal(result.acceptedOverrides,2);
  assert.equal(result.retained,118);
  assert.equal(result.finalSnapshots.length,2);
  assert.equal(result.finalSnapshots[0].stage,'Rigidmatch2');
  assert.equal(session.review.getDecisionState({basisId:base,scopeId:'PL01',stage:'Rigidmatch2'}).decisions[firstId].value,44);
  assert.equal(session.review.getDecisionState({basisId:base,scopeId:'PL06',stage:'Rigidmatch2'}).decisions[lastId].value,22);
  assert.equal(session.review.getDecisionState({basisId:base,scopeId:'PL06',stage:'RigidMatch1'}).decisionRevision,null);
  assert.equal(body.children.length,0,'dialog removed after explicit accepted commit');
});

test('U7 Missing unresolved mass blocks Final; cancellation never freezes or runs',async()=>{
  const session=fixture(120),{body,doc}=screen(),base=session.basis.basisId;
  const pending=openVerifiedModeAFinalWeightReviewDialog({session,documentRef:doc,pageSize:60});
  element(body,'button','Apply verified Final reviews').click();
  assert.match(element(body,'p').parent?body.walk().filter(x=>x.tag==='p').map(x=>x.textContent).join(' '):'',/Final review was NOT accepted/);
  assert.equal(session.review.getDecisionState({basisId:base,scopeId:'PL01',stage:'Rigidmatch2'}).decisionRevision,null);
  element(body,'button','Cancel without applying').click();
  assert.equal((await pending).cancelled,true);
  assert.equal(session.review.getSnapshot({basisId:base,stage:'Rigidmatch2'}).length,0);
  assert.equal(body.children.length,0);
});

test('U7 stale later-source Match-1 revision blocks earlier Final source commit',async()=>{
  const session=fixture(2),{body,doc}=screen(),base=session.basis.basisId;
  const pending=openVerifiedModeAFinalWeightReviewDialog({session,documentRef:doc,pageSize:2});
  edit(rows(body)[0],44,'Reviewed original source value against manufacturer.');
  edit(rows(body)[1],22,'Reviewed missing source physical component.');
  session.review.applyDecisions({basisId:base,scopeId:'PL06',stage:'RigidMatch1',
    commands:[{commandId:'later-source-m1',basisId:base,scopeId:'PL06',
      occurrenceId:session.facts[1].occurrenceId,expectedDecisionRevision:null,
      action:'enter-manual',value:20,unit:'kg'}]});
  element(body,'button','Apply verified Final reviews').click();
  assert.equal(session.review.getDecisionState({basisId:base,scopeId:'PL01',stage:'Rigidmatch2'}).decisionRevision,null);
  assert.match(body.walk().map(x=>x.textContent).join(' '),/STALE_MODE_A_FINAL_REVIEW/);
  element(body,'button','Cancel without applying').click();
  assert.equal((await pending).cancelled,true);
});

test('U7 missing trusted census, cross-source alias and original legacy ID are fail-closed',()=>{
  const session=fixture(2);
  assert.throws(()=>readVerifiedModeAFinalRows({...session,openedFacts:1}),e=>e.code==='INCOMPLETE_FINAL_FACTS');
  const other=fixture(2);
  other.facts[0].occurrenceId='PL01/branch:0/physical:0';
  const review=createWeightReviewService({score:()=>[]});review.openBasis(other.basis,{facts:other.facts});
  assert.throws(()=>readVerifiedModeAFinalRows({...other,review}),e=>e.code==='NONCANONICAL_WEIGHT_OCCURRENCE');
  const s=fixture(2);
  assert.throws(()=>openVerifiedModeAFinalWeightReviewDialog({session:s,documentRef:screen().doc,pageSize:101}),
    /pageSize/);
});
