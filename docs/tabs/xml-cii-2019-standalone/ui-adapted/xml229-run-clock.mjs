/** Diagnostic clock for the existing raw XML route; no conversion/release authority. */
const clocks=new WeakMap();
export function readXml229RunClock(ref,now=Date.now()){
 const key=ref?.modeABaseRef||ref,state=key?.current||{},prior=clocks.get(key);
 if(state.running){
   const clock=prior?.running?prior:{running:true,start:now};clocks.set(key,clock);
   return {status:'RAW_RUNNING',elapsedMs:Math.max(0,now-clock.start),phase:'XML conversion'};
 }
 if(prior?.running)clocks.set(key,{...prior,running:false,end:now});
 const saved=clocks.get(key);
 if(saved&&state.result)return {status:state.result.ok===false?'RAW_FAILED':'RAW_FINISHED',
   elapsedMs:Math.max(0,saved.end-saved.start)};
 return {status:'IDLE',elapsedMs:0};
}
