/**
 * XML229 original-source engineering input ownership.
 *
 * One verified InputBasis owns a GC-PW Worker review independently of rendered
 * Preview/Regex/Weight panels. Draft automatic suggestions are NOT committed
 * engineering configuration. Only explicit edits can change committed inputs;
 * a different verified InputBasis replaces, rather than mutates, its predecessor.
 *
 * Never store original JSON, original XML, full master rows or user data here:
 * the O1 Blob stays in its independent worker and the GC-PW review retains its
 * own attested source and master custody.
 */
const entries=new WeakMap();
const keyOf=ref=>ref?.modeABaseRef||ref||null;
const requireKey=ref=>{
 const key=keyOf(ref);
 if(!key||typeof key!=='object')throw new TypeError('ENGINEERING_BASIS_STATE_REF_REQUIRED');
 return key;
};
const safelyCancel=session=>{try{session?.cancel?.();}catch{}};

/** Read-only bound session for all tabs; inspecting it never changes ownership. */
export function getXml229VerifiedEngineeringEntry(ref){
 const key=keyOf(ref);
 const entry=key&&entries.get(key);
 if(!entry?.session)return null;
 // A cancelled, replaced or crashed GC-PW Worker can outlive its registry
 // reference. Do not hand a closed Worker to a newly rendered Weight panel.
 // Bump generation to fence any late build; never re-attest or restore
 // Match-1/Final decisions without the explicit source-bound rebuild.
 if(entry.session.closed===true){
  entries.set(key,{generation:entry.generation+1,session:null,lease:null,closedReview:true,reason:'WORKER_CLOSED'});
  return null;
 }
 return entry;
}
export function hasXml229VerifiedEngineeringBasis(ref){
 return Boolean(getXml229VerifiedEngineeringEntry(ref));
}
/** Replacement invalidates old ownership immediately; in-flight builds are CAS fenced. */
export function beginXml229VerifiedEngineeringBuild(ref){
 const key=requireKey(ref),previous=entries.get(key);
 safelyCancel(previous?.session);
 const generation=(previous?.generation||0)+1;
 entries.set(key,{generation,session:null,lease:null,reason:previous?.session?'WORKER_REPLACED':'BUILD_STARTED',
  closedReview:previous?.closedReview===true||Boolean(previous?.session)});
 return Object.freeze({key,generation});
}
/** Reject late Worker completions, even when a newer build has already landed. */
export function publishXml229VerifiedEngineeringBuild(ticket,{lease,session}={}){
 if(!ticket?.key||!session||typeof lease!=='string'||!lease)
  throw new TypeError('ENGINEERING_BASIS_PUBLISH_REQUIRES_VERIFIED_INPUT_LEASE');
 const current=entries.get(ticket.key);
 if(!current||current.generation!==ticket.generation){
  safelyCancel(session);
  return false;
 }
 entries.set(ticket.key,Object.freeze({generation:ticket.generation,lease,session,reason:'WORKER_PUBLISHED'}));
 return true;
}
export function revokeXml229VerifiedEngineeringBasis(ref,{expectedSession}={}){
 const key=keyOf(ref),entry=key&&entries.get(key);
 if(!entry||expectedSession&&entry.session!==expectedSession)return false;
 safelyCancel(entry.session);
 entries.set(key,{generation:entry.generation+1,session:null,lease:null,reason:'WORKER_REVOKED'});
 return true;
}
/**
 * Route *automatic* workbench outcomes. If a verified source basis exists,
 * suggestions remain a draft; the explicit "Apply" control is the only
 * authority that can change engineering configuration after verification.
 *
 * The caller owns its state render lifecycle. This operation cannot
 * accidentally commit configuration while in draft mode.
 */
export function routeXml229AutomaticEngineeringProposal(ref,{proposal,commit,stage}={}){
 if(typeof commit!=='function'||typeof stage!=='function')
  throw new TypeError('ENGINEERING_PROPOSAL_PORTS_REQUIRED');
 const live=hasXml229VerifiedEngineeringBasis(ref);
 const key=keyOf(ref);
 // Once an attested Worker closes, keep unreviewed automatic suggestions
 // draft-only until the new Worker has re-established source/master custody.
 if(live||(key&&entries.get(key)?.closedReview===true)){
  stage(proposal);
  return 'DRAFT';
 }
 commit(proposal);
 return 'COMMITTED';
}

/** Diagnostic only: no session, lease value, identity, source or master data. */
export function inspectXml229EngineeringLease(ref){
 const key=keyOf(ref),entry=key&&entries.get(key);
 const reason=!entry?'NEVER_BUILT':
   entry.session?.closed===true?'WORKER_CLOSED':
   entry.session?'WORKER_PUBLISHED':
   entry.reason||'NO_BOUND_WORKER';
 return Object.freeze({
  schema:'XML229.EngineeringLeaseDiagnosis.v1',
  reason,sessionBound:!!entry?.session&&entry.session.closed!==true,
  generation:Number.isSafeInteger(entry?.generation)?entry.generation:0,
  leasePresent:typeof entry?.lease==='string'&&entry.lease.length>0,
  // Never releases a review or native CII; cannot restore missing authority.
  nativeCiiReleaseAuthorized:false,
 });
}
