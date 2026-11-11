/** Defers the source-wide Apply or read-only safety export during a live Worker render/write. */
export function createXml229BulkApplyQueue(root,live,say){
 let pending=null;
 const selectors=['[data-p4-bulk-plan]','[data-p4-full-source-safety]'];
 return Object.freeze({
  defer(event,session,busy){
   if(!busy)return false;
   const which=selectors.find(selector=>event.target.closest?.(selector));
   if(session&&which){
    pending={session,which};
    say(which===selectors[0]
      ?'Apply all suggestions queued for current Weight page.'
      :'Full-source safety audit queued until current Worker decisions settle.');
   }
   return true;
  },
  drain(session){
   if(!pending)return;
   const {session:owner,which}=pending;
   const current=owner===session&&live()===session&&root.isConnected;
   pending=null;
   if(current)root.querySelector(which)?.click();
  },
 });
}
