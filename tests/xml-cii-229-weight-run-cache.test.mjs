import assert from 'node:assert/strict';
import test from 'node:test';
import { persistWeightMatchConfig } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match.js';
import { createXmlCiiAdaptedWorkflowState } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';

function fresh(){
  const state=createXmlCiiAdaptedWorkflowState();
  state.supportConfigJson=JSON.stringify({overrides:{}});
  state.outputRunReadinessReport={ok:true,checklistRows:[{id:'branch-format-authority',blocking:false}]};
  state.outputRunReadinessStatus='READY';
  state.masterContext={config:{overrides:{}},rowCounts:{pipingClass:10699},pipingClassRows:[{'Piping Class':'OWNER-CUSTOM'}]};
  return {current:state};
}
test('parent Weight save discards stale READY Run cache without corrupting master state',()=>{
  const ref=fresh();const prior=ref.current;
  const value={overrides:{rigidWeight:{'BLANK':12.5},rigidWeightProposalMeta:{'BLANK':{acceptanceMethod:'candidate'}}}};
  persistWeightMatchConfig(ref,value);
  assert.notEqual(ref.current,prior);
  assert.equal(ref.current.outputRunReadinessReport,null);
  assert.equal(ref.current.outputRunReadinessStatus,'');
  assert.equal(ref.current.masterContext.pipingClassRows.length,1);
  assert.equal(ref.current.masterContext.rowCounts.pipingClass,10699);
  assert.equal(JSON.parse(ref.current.supportConfigJson).overrides.rigidWeight.BLANK,12.5);
  assert.equal(ref.current.masterContext.config.overrides.rigidWeight.BLANK,12.5);
});
test('fallback Weight save clears stale BLOCKED report and preserves independent Final state',()=>{
  const ref=fresh();
  ref.current.outputRunReadinessReport={ok:false,checklistRows:[{id:'weight-final',blocking:true}]};
  ref.current.outputRunReadinessStatus='BLOCKED';
  const nextCfg={overrides:{
    rigidWeight:{blank:17.5},
    rigidWeightFinal:{approved:34.2},
    rigidWeightMatch1Provenance:{approved:{kind:'already-reviewed'}},
  }};
  persistWeightMatchConfig(ref,nextCfg);
  assert.equal(ref.current.outputRunReadinessReport,null);
  assert.equal(ref.current.outputRunReadinessStatus,'');
  assert.equal(JSON.parse(ref.current.supportConfigJson).overrides.rigidWeightFinal.approved,34.2);
  assert.equal(ref.current.masterContext.config.overrides.rigidWeightMatch1Provenance.approved.kind,'already-reviewed');
});
test('saved candidate writes legacy bucket; helper never fabricates governed Match-1/Final acceptance',()=>{
  const ref=fresh();
  const cfg={overrides:{rigidWeight:{newBlank:12.5},rigidWeightProposalMeta:{newBlank:{acceptanceMethod:'candidate'}}}};
  persistWeightMatchConfig(ref,cfg);
  const stored=JSON.parse(ref.current.supportConfigJson).overrides;
  assert.equal(stored.rigidWeight.newBlank,12.5);
  assert.equal(stored.rigidWeightMatch1?.newBlank,undefined);
  assert.equal(stored.rigidWeightFinal?.newBlank,undefined);
  assert.equal(stored.rigidWeightProposalMeta.newBlank.acceptanceMethod,'candidate');
});
