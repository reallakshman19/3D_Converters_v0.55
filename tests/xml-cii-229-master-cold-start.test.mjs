import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shouldAutoHydratePipingClass,
  hydrateDefaultPipingClassMaster,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-default-piping-autoload.js';

const one=[{'Piping Class':'31441C4',Size:'4',convertedBore:100}];
const start=()=>({current:{
  sourceKind:'xml',sourceText:'',supportConfigJson:'{"pipingClass":{}}',
  masterContext:null,importMastersLoading:false,options:{outputMode:'both'},
}});
test('startup default fills truly missing physical rows and reports applied count, never manifest metadata',async()=>{
  const state=start();
  const did=await hydrateDefaultPipingClassMaster(state,{loadRows:async()=>one});
  assert.equal(did,true);
  assert.equal(state.current.masterContext.rowCounts.pipingClass,1);
  assert.equal(state.current.masterContext.pipingClassRows.length,1);
  assert.equal(state.current.masterContext.pipingClassIndex.byClass.get('31441C4').length,1);
  assert.match(state.current.importMastersWriteBackStatus,/1 usable row/);
  assert.equal(shouldAutoHydratePipingClass(state.current),false);
});
test('startup preserves manually imported row-bearing master without fetching',async()=>{
  const state=start();
  state.current.masterContext={pipingClassRows:[{'Piping Class':'USER-CUSTOM'}],rowCounts:{pipingClass:1}};
  let called=0;
  assert.equal(await hydrateDefaultPipingClassMaster(state,{loadRows:async()=>{called++;return one}}),false);
  assert.equal(called,0);
  assert.equal(state.current.masterContext.pipingClassRows[0]['Piping Class'],'USER-CUSTOM');
});
test('startup protects indexeddb custody, active import and prior failed restore',async()=>{
  for(const patch of [
    {masterContext:{datasetRefs:{pipingClass:{datasetId:'custody-1'}}}},
    {masterContext:{sourceMetadata:{pipingClass:{sourceType:'session',status:'loaded',rowCount:0}}}},
    {importMastersLoading:true},
    {masterRestoreFailures:{pipingClass:{code:'MISSING_DATASET'}}},
    {masterPersistenceFailures:{pipingClass:{message:'quota'}}},
  ]) {
    const state=start();
    Object.assign(state.current,patch);
    let invoked=0;
    const did=await hydrateDefaultPipingClassMaster(state,{loadRows:async()=>{invoked++;return one}});
    assert.equal(did,false,JSON.stringify(patch));
    assert.equal(invoked,0,'must not fetch when higher-priority custody exists');
  }
});
test('concurrent human master upload wins over an in-flight default fetch',async()=>{
  const state=start();
  let resolve;
  const pending=new Promise(ok=>{resolve=ok});
  const inFlight=hydrateDefaultPipingClassMaster(state,{loadRows:()=>pending});
  const manual={'Piping Class':'MANUAL',Size:'6'};
  state.current={...state.current,
    supportConfigJson:'{"pipingClass":{"masterRows":[{"Piping Class":"MANUAL"}]}}',
    masterContext:{pipingClassRows:[manual],rowCounts:{pipingClass:1}}};
  resolve(one);
  assert.equal(await inFlight,false);
  assert.equal(state.current.masterContext.pipingClassRows[0]['Piping Class'],'MANUAL');
});
test('source change without config change but with a concurrently applied dataset also vetoes default',async()=>{
  const state=start();
  let resolve;
  const pending=new Promise(ok=>{resolve=ok});
  const inFlight=hydrateDefaultPipingClassMaster(state,{loadRows:()=>pending});
  state.current={...state.current,masterContext:{datasetRefs:{pipingClass:{datasetId:'NEW-USER-RECORD'}}}};
  resolve(one);
  assert.equal(await inFlight,false);
  assert.equal(state.current.masterContext.datasetRefs.pipingClass.datasetId,'NEW-USER-RECORD');
});
test('corrupt row array or failed default fetch never shows an invented Loaded state',async()=>{
  for(const bad of [[],[{rowCount:10699}],null]){
    const state=start();
    assert.equal(await hydrateDefaultPipingClassMaster(state,{loadRows:async()=>bad}),false);
    assert.equal(state.current.masterContext,null);
  }
  const state=start();
  assert.equal(await hydrateDefaultPipingClassMaster(state,{loadRows:async()=>{throw Error('offline')}}),false);
  assert.equal(state.current.masterContext,null);
});
