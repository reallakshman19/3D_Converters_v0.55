import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createXmlCiiAdaptedWorkflowState,
  updateWorkflowState,
  applyStandaloneOutputRunReadiness,
  applyStandaloneRegexTesterResult,
  updateRegexTesterConfig,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';
import { buildStandaloneOutputRunReadiness } from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import { runStandaloneRegexTester } from '../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';

const branch = '/ASIM-1885-3-S8811000-91261M7-HC-01/B1';
const xml = '<Plant><Branch><Branchname>' + branch + '</Branchname></Branch></Plant>';
const wrap = (regex) => JSON.stringify({regexTester:{formats:[{
  lineKey:{regex,group:1},pipingClass:{regex:'(91261M7)',group:1},
}]}});
const getAuthority = (report) => report.checklistRows.find(row=>row.id==='branch-format-authority');

function cachedBlockedState() {
  let state=createXmlCiiAdaptedWorkflowState();
  state=updateWorkflowState(state,{
    sourceKind:'xml',sourceText:xml,
    options:{...state.options,outputMode:'both'},
    supportConfigJson:wrap('(NEVER)'),
  });
  const report=buildStandaloneOutputRunReadiness(state);
  assert.equal(getAuthority(report).blocking,false,'format issues are advisory for conversion');
  assert.equal(getAuthority(report).status,'unresolved-enrichment');
  const cached=applyStandaloneOutputRunReadiness(state,report);
  assert.equal(cached.outputRunReadinessReport,report,'explicit report publication should be retained');
  return cached;
}

test('P2 browser Run cache invalidates when supportConfig resolves previous 28/28 format refusal',()=>{
  const state=cachedBlockedState();
  const updated=updateWorkflowState(state,{supportConfigJson:wrap('(S8811000)')});
  assert.equal(updated.outputRunReadinessReport,null,'old refused Run report must be invalidated when config is fixed');
  assert.equal(updated.outputRunReadinessStatus,'','stale blocked status must not survive');
  const fresh=buildStandaloneOutputRunReadiness(updated);
  assert.equal(getAuthority(fresh).blocking,false,'fresh audit must be MATCHED');
});

test('P2 changing source, selection, options or Regex result invalidates cached Run report',()=>{
  const base=cachedBlockedState();
  const changes=[
    {sourceText:xml.replace('91261M7','99999XX')},
    {branchSelection:{mode:'all'}},
    {options:{...base.options,outputMode:'cii-only'}},
    {regexTesterResult:{branchSamples:[],matchedRows:[]}},
    {sourceKind:'inputxml'},
    {masterContext:{rowCounts:{pipingClass:10699}}},
  ];
  for(const change of changes){
    const updated=updateWorkflowState(base,change);
    assert.equal(updated.outputRunReadinessReport,null,'change failed: '+Object.keys(change).join(','));
  }
});

test('P2 cached Run report survives phase-only navigation and explicit readiness refresh',()=>{
  const state=cachedBlockedState();
  const moved=updateWorkflowState(state,{activePhaseId:'output-run'});
  assert.equal(moved.outputRunReadinessReport,state.outputRunReadinessReport);
  const refreshed=buildStandaloneOutputRunReadiness(moved);
  const published=applyStandaloneOutputRunReadiness(moved,refreshed);
  assert.equal(published.outputRunReadinessReport,refreshed);
});

test('P2 real Regex click and support-config writeback drops cached stale Run blocker',()=>{
  const state=cachedBlockedState();
  const regexConfig={activeFormatIndex:0,formats:[{
    tokenDelimiter:'-',lineKey:{regex:'(NEVER)',group:1,tokenPosition:4},
    pipingClass:{regex:'',group:1,tokenPosition:5},
  }]};
  const clicked=updateRegexTesterConfig({...state,regexTesterConfig:regexConfig},
    'regex-line-key-token','4');
  const result=runStandaloneRegexTester({
    ...clicked,sourceText:xml,sourceKind:'xml',extractionConfig:clicked.regexTesterConfig,
  });
  const updated=applyStandaloneRegexTesterResult(clicked,result);
  assert.equal(updated.outputRunReadinessReport,null);
  assert.equal(getAuthority(buildStandaloneOutputRunReadiness(updated)).blocking,false);
});
