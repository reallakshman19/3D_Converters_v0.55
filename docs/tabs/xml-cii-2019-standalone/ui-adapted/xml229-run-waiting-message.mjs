/** Presentation only: the real checklist, never a release override. */
export function xml229NativeRunWaitingMessage(report){
 const blocker=report?.checklistRows?.find(row=>row.blocking&&
  row.id!=='xml229-original-json-engineering-authority');
 if(blocker)return 'Native Run is waiting: '+blocker.label+'. '+blocker.message;
 return 'Verified Final masses ready. Native Run starts automatically in the active Run tab; Download unlocks after output reconciliation.';
}
