import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  createXmlCiiAdaptedWorkflowState,
  updateWorkflowState,
  xmlCiiEnrichedConfigFromState,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';
import { hydrateDefaultPipingClassMaster } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-default-piping-autoload.js';
import { persistWeightMatchConfig } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match.js';
import { selectXmlCiiBlankWeightSuggestion } from '../converters/xml-cii2019-core/weight-blank-fill-policy.js';
import {
  createLfjSourceProgress,
  advanceLfjSourceProgress,
  lfjSourceProgressView
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-lfj-o1-progress.js';

const masterSource=fileURLToPath(new URL('../docs/Masters/Piping_class_master.json',import.meta.url));
const realRows=JSON.parse(await readFile(masterSource,'utf8'));

test('COMBINED MAIN: real master -> effective Run config -> blank-only Weight save invalidates old Run READY without damaging master/rights',async()=>{
  assert.equal(realRows.length,10699);
  const ref={current:createXmlCiiAdaptedWorkflowState()};
  ref.current={...ref.current,supportConfigJson:'{}',masterContext:null,importMastersLoading:false};
  assert.equal(await hydrateDefaultPipingClassMaster(ref,{loadRows:async()=>realRows}),true);
  assert.equal(ref.current.masterContext.pipingClassRows.length,10699);
  assert.equal(ref.current.masterContext.rowCounts.pipingClass,10699);
  const before=xmlCiiEnrichedConfigFromState(ref.current);
  assert.equal(before.pipingClass.masterRows.length,10699,'Run/Preview effective config must contain physically hydrated master');
  const key='XML229-INTEGRATED-RIGID';
  const issue={key,mapped:false,weight:null,candidates:[{selectedWeight:12.5,preferred:true}]};
  assert.equal(selectXmlCiiBlankWeightSuggestion({issue,input:{value:'',dataset:{}},config:before})?.weight,12.5);
  assert.equal(selectXmlCiiBlankWeightSuggestion({issue,input:{value:'12.5',dataset:{}},config:before}),null,'same nonblank value must be protected');
  const withReady=updateWorkflowState(ref.current,{
    outputRunReadinessReport:{ok:true,checklistRows:[]},
    outputRunReadinessStatus:'READY',
  });
  ref.current=withReady;
  const cfg=xmlCiiEnrichedConfigFromState(ref.current);
  cfg.overrides={...cfg.overrides,rigidWeight:{[key]:12.5},
    rigidWeightProposalMeta:{[key]:{acceptanceMethod:'candidate'}}};
  persistWeightMatchConfig(ref,cfg);
  assert.equal(ref.current.outputRunReadinessReport,null);
  assert.equal(ref.current.outputRunReadinessStatus,'');
  assert.equal(ref.current.masterContext.rowCounts.pipingClass,10699);
  assert.equal(ref.current.masterContext.pipingClassRows.length,10699);
  assert.equal(xmlCiiEnrichedConfigFromState(ref.current).pipingClass.masterRows.length,10699);
  const saved=JSON.parse(ref.current.supportConfigJson);
  assert.equal(saved.overrides.rigidWeight[key],12.5);
  assert.equal(saved.overrides.rigidWeightFinal?.[key],undefined,'bulk suggested is not governed Final');
  assert.equal(saved.overrides.rigidWeightMatch1?.[key],undefined,'legacy acceptance is not silently Match-1');
  assert.equal(selectXmlCiiBlankWeightSuggestion({
    issue,input:{value:'',dataset:{}},config:saved
  }),null,'same decision cannot reapply after save/reload');
  let progress=advanceLfjSourceProgress(createLfjSourceProgress(),{kind:'START',nowMs:100});
  progress=advanceLfjSourceProgress(progress,{kind:'PAGE',pagesStaged:808,nowMs:2100});
  assert.equal(lfjSourceProgressView(progress).indeterminate,true);
  assert.equal(lfjSourceProgressView(progress).complete,false);
  assert.match(lfjSourceProgressView(progress).rights,/separate authorized Build/);
});
