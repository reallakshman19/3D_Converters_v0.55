/** Source-wide 80%-threshold Weight Match oracle on the real Worker UI. */
import assert from 'node:assert/strict';

async function captureOriginal80Oracle(page,record,waitWeightIdle){
 await page.locator('[data-p4-scope="blank-rigid"]').click();
 await waitWeightIdle();
 await page.locator('[data-p4-scope="blank-rigid"][aria-pressed="true"]')
   .waitFor({timeout:90000});
 const proposalAudit={rank1:0,qualifiedRank1:0,eligibleAt80:0,bestRank1Percent:null};
 const applyOracle=new Map(),scorePercent=p=>
   typeof p?.score==='number'&&Number.isFinite(p.score)
     ?(p.score<=1?p.score*100:p.score):null;
 let pageCount=0;
 while(true){
   const part=await page.evaluate(()=>{
     const root=document.querySelector('[data-p4-weight-root]');
     return (root?.__p4VisibleRows||[]).map(r=>({
       id:r.occurrenceId,sourceKg:r.sourceKg,match1Kg:r.match1Kg,
       finalKg:r.finalKg,stageDecision:!!(r.match1View?.stageDecision||
         r.finalView?.stageDecision),proposals:r.proposals
     }));
   });
   for(const row of part){
     assert.equal(row.sourceKg,null);
     assert.equal(row.match1Kg,null);
     assert.equal(row.finalKg,null);
     if(row.stageDecision)continue;
     const first=row.proposals?.find(p=>p.ranking===1);
     const pct=scorePercent(first);
     if(first){
       proposalAudit.rank1++;
       if(first.qualified)proposalAudit.qualifiedRank1++;
       if(pct!==null)proposalAudit.bestRank1Percent=Math.max(
         proposalAudit.bestRank1Percent??0,pct);
     }
     if(first?.value>0&&first?.unit==='kg'&&pct!==null&&pct>=80){
       assert(!applyOracle.has(row.id),'duplicated source occurrence');
       applyOracle.set(row.id,String(first.value));
       proposalAudit.eligibleAt80++;
     }
   }
   pageCount++;
   assert(pageCount<=20,'public source pagination did not terminate');
   const next=page.locator('[data-p4-next]');
   if(await next.isDisabled())break;
   const previous=await page.locator('tr[data-p4-row]').first().getAttribute('data-p4-occurrence');
   await next.click();
   await waitWeightIdle();
   await page.waitForFunction(old=>
     document.querySelector('tr[data-p4-row]')?.dataset.p4Occurrence!==old,
     previous,{timeout:90000});
 }
 assert(pageCount>1,'Apply oracle must cover actual multiple Worker pages');
 // Zero qualifying 80% proposals is a VALID source result, not a
 // justification to lower the threshold or invent a matched mass.
 // Exercise the no-op bulk path, then continue to the REAL XML-only native
 // CII download and governed HOLD instead of stopping prematurely.
 record.stages.apply80Precheck={...proposalAudit,pages:pageCount};
 return {applyOracle,pageCount};
}

async function stageManualWeightEdit(page,applyOracle,pageCount,waitWeightIdle){
 // Introduce one user-entered kg before Apply: the Worker may score a
 // different master weight but must not discard the human edit or abort.
 await page.locator('[data-p4-scope="blank-rigid"]').click();
 await waitWeightIdle();
 let manualId=null,manualKg='91.25';
 for(let pageNo=0;pageNo<pageCount&&!manualId;pageNo++){
   const first=await page.evaluate(ids=>{
     const root=document.querySelector('[data-p4-weight-root]');
     return (root?.__p4VisibleRows||[]).find(r=>ids.includes(r.occurrenceId))?.occurrenceId||null;
   },[...applyOracle.keys()]);
   if(first){
     manualId=first;
     await page.evaluate(({id,kg})=>{
       const tr=[...document.querySelectorAll('tr[data-p4-row]')]
         .find(x=>x.dataset.p4Occurrence===id);
       const input=tr?.querySelector('[data-p4-applied-weight]');
       if(!input)throw Error('original physical draft input not found');
       input.value=kg;input.dispatchEvent(new Event('input',{bubbles:true}));
     },{id:first,kg:manualKg});
   }else{
     const previous=await page.locator('tr[data-p4-row]').first().getAttribute('data-p4-occurrence');
     await page.locator('[data-p4-next]').click();
     await waitWeightIdle();
     await page.waitForFunction(old=>
       document.querySelector('tr[data-p4-row]')?.dataset.p4Occurrence!==old,
       previous,{timeout:90000});
   }
 }
 assert(manualId,'unable to select existing-edit fixture occurrence');
 return {manualId,manualKg};
}

async function executeVisible80Apply(page,record){
 const applyStartMs=Date.now();
 await page.locator('[data-p4-bulk-plan]').click();
 try{
   await page.waitForFunction(()=>{
     const message=document.querySelector('[data-p4-weight-status]')?.textContent||'';
     return /Apply all suggestions ≥80%: complete\.|Weight action unavailable:|Worker ended|rebuild/i.test(message);
   },null,{timeout:90000});
 }catch(error){
   const state=await page.evaluate(()=>{
     const root=document.querySelector('[data-p4-weight-root]');
     const message=root?.querySelector('[data-p4-weight-status]')?.textContent||'';
     const table=root?.querySelector('.mc-rigid-review-table-wrap');
     return {message:message.slice(0,700),rows:root?.__p4VisibleRows?.length,
       renderedInputs:table?.querySelectorAll('[data-p4-applied-weight]')?.length,
       filledInputs:[...table?.querySelectorAll('[data-p4-applied-weight]')||[]]
         .filter(input=>input.value!=='').length};
   });
   throw new Error('Apply UI did not reach success/error in 90s: '+
     JSON.stringify(state)+'; '+String(error?.message||error));
 }
 const actualApplyStatus=await page.locator('[data-p4-weight-status]').textContent();
 assert.match(actualApplyStatus,/Apply all suggestions ≥80%: complete\./,
   'Real 80% Apply failed: '+actualApplyStatus);
 record.stages.applyStatus=actualApplyStatus.slice(0,600);
 const applyElapsedMs=Date.now()-applyStartMs;
 const firstVisibility=await page.evaluate(()=>{
   const scroller=document.querySelector('.mc-rigid-review-table-wrap');
   const input=scroller?.querySelector('tr[data-p4-stage="final"] input[data-p4-applied-weight]')||
     scroller?.querySelector('tr[data-p4-draft-filled="true"] input[data-p4-applied-weight]');
   const a=input?.getBoundingClientRect(),b=scroller?.getBoundingClientRect();
   return {firstFilled:!!input,valuePresent:!!input?.value,
     inHorizontalViewport:!!(a&&b&&a.left>=b.left-1&&a.right<=b.right+1),
     scrollLeft:scroller?.scrollLeft??null};
 });
 assert(firstVisibility.valuePresent);
 assert(firstVisibility.inHorizontalViewport,
   'production Applied Weight populated but still hidden horizontally');

 return {applyElapsedMs,firstVisibility};
}

async function verifyAllAppliedPages(page,applyOracle,manualId,manualKg,waitWeightIdle){
 await page.locator('[data-p4-scope="all"]').click();
 await waitWeightIdle();
 const seen=new Set(),mismatches=[];
 for(let pageNo=0;pageNo<40;pageNo++){
   const actual=await page.evaluate(()=>[...document.querySelectorAll('tr[data-p4-row]')].map(tr=>({
     id:tr.dataset.p4Occurrence,kg:tr.querySelector('[data-p4-applied-weight]')?.value
   })));
   for(const {id,kg} of actual){
     if(!applyOracle.has(id))continue;
     seen.add(id);
     const expected=id===manualId?manualKg:applyOracle.get(id);
     if(kg!==expected)mismatches.push({id,expected,kg});
   }
   if(await page.locator('[data-p4-next]').isDisabled())break;
   const previous=await page.locator('tr[data-p4-row]').first().getAttribute('data-p4-occurrence');
   await page.locator('[data-p4-next]').click();
   await waitWeightIdle();
   await page.waitForFunction(old=>
     document.querySelector('tr[data-p4-row]')?.dataset.p4Occurrence!==old,
     previous,{timeout:90000});
 }
 assert.equal(seen.size,applyOracle.size);
 assert.deepEqual(mismatches,[],
   'one-click production source-wide 80% Apply differed from independent Worker oracle');
 return {seen,mismatches};
}

export async function verifyEf05Apply80(page,record){
 // Source-independent of Apply: read every current verified Worker presentation
 // page and derive the 80% kg oracle BEFORE requesting draft population.
 const waitWeightIdle=()=>page.waitForFunction(()=>
   document.querySelector('[data-p4-weight-root]')?.dataset.p4Busy==='false',
   null,{timeout:90000});
 const {applyOracle,pageCount}=await captureOriginal80Oracle(page,record,waitWeightIdle);
 if(applyOracle.size>0){
   const {manualId,manualKg}=await stageManualWeightEdit(
     page,applyOracle,pageCount,waitWeightIdle);
   const {applyElapsedMs,firstVisibility}=await executeVisible80Apply(page,record);
   const {seen,mismatches}=await verifyAllAppliedPages(
     page,applyOracle,manualId,manualKg,waitWeightIdle);
 record.stages.apply80={
   sourceBoundFixture:true,workerBacked:true,threshold:80,
   pageCount,eligibleRank1:applyOracle.size,applyElapsedMs,
   observed:seen.size,editPreserved:true,
   mismatches:mismatches.length,firstVisibility,
   acceptedMatch1Automatically:false,acceptedFinalAutomatically:true,
   nativeCiiReleaseAuthorized:false,
 };
 record.passes.push('actual GC-PW Worker: one-step Final values and edited kg matched across all physical pages; no native release');
 }else{
   // Verified source has no rank-1 eligible proposal at the chosen threshold.
   // The genuine UI must not fabricate a Final mass to satisfy this test.
   await page.locator('[data-p4-bulk-plan]').click();
   await page.waitForFunction(()=>
     /Apply all suggestions ≥80%: complete\./.test(
       document.querySelector('[data-p4-weight-status]')?.textContent||''),
     null,{timeout:90000});
   const status=await page.locator('[data-p4-weight-status]').textContent();
   assert.match(status,/complete\. 0 additional positive kg masses/);
   record.stages.apply80={
     sourceBoundFixture:true,workerBacked:true,threshold:80,
     pageCount,eligibleRank1:0,acceptedAutomatically:0,
     noSuggestionsCorrectlyPreserved:true,nativeCiiReleaseAuthorized:false,
   };
   record.passes.push('real source has no rank-1 ≥80% suggestion; no mass invented and no Final accepted automatically');
 }

}
