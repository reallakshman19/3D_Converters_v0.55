/**
 * Presentation-only status for independent stages when GC-PW has verified
 * original physical facts. Never change the canonical readiness report,
 * native output authority, blocked Run button, or claim unperformed stages
 * are ready.
 */
export const XML229_INDEPENDENT_STAGE_NOT_RUN=Object.freeze({
 'support-mapper':Object.freeze({
   label:'Support Type Mapper (separate stage)',
   status:'not-run',severity:'warning',
   message:'Not run: Support Type Mapper has no separate result. Original GC-PW physical weight verification does not establish support mapping; review this stage where applicable.',
 }),
 'resolver-json':Object.freeze({
   label:'Resolver / JSON Trace (separate stage)',
   status:'not-run',severity:'warning',
   message:'Not run: separate Resolver / JSON Trace has not produced its own result. Verified original Blob and 4 Preview do not authorize independent Trace/CSV exports.',
 }),
 'manual-restraints':Object.freeze({
   label:'Manual restraints (separate stage)',
   status:'not-run',severity:'warning',
   message:'Not run: separate manual restraint review has no result. Verified physical masses do not imply reviewed restraints or transfer.',
 }),
});
export function xml229UnbuiltIndependentStage(id,{status='',blocking='false'}={}){
 if(status!=='missing'||String(blocking)!=='false')return null;
 return XML229_INDEPENDENT_STAGE_NOT_RUN[id]||null;
}
