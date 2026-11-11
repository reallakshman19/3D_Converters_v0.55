/**
 * Read-only full-source Match-1/Final decision audit from the SAME GC-PW
 * review service that owns the decisions. No scorer, writer or native CII gate.
 * The command ledger proves the action; a contemporaneous Worker-private bulk
 * confirmation journal distinguishes proven bulk confirmation from a command
 * whose past UI confirmation cannot be independently reconstructed.
 */
const fail=(code)=>{const e=new Error(code);e.code=code;throw e;};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nonneg=v=>Number.isSafeInteger(v)&&v>=0;
const revision=(r,stage)=>{
 if(typeof r!=='string'||!new RegExp('^'+(stage==='RigidMatch1'?'m':'f')+'[1-9][0-9]*$').test(r))return -1;
 return Number(r.slice(1));
};
const bulkId=(cmd,basisId,sourceId)=>{
 try{
  const id=JSON.parse(cmd.commandId);
  return Array.isArray(id)&&id.length===5&&id[0]==='bulk-direct-exact'&&
   id[1]===basisId&&id[2]===sourceId&&id[3]===cmd.occurrenceId&&
   id[4]===cmd.proposalId;
 }catch{return false;}
};
const validEvent=(event,key,basisId,sourceId,stage)=>{
 if(!plain(event)||typeof event.payload!=='string'||!plain(event.result)||
    event.result.commandId!==key||event.result.basisId!==basisId||
    event.result.scopeId!==sourceId&&event.result.scopeId!==undefined)return null;
 let cmd;
 try{cmd=JSON.parse(event.payload)}catch{return null}
 if(!plain(cmd)||cmd.commandId!==key||cmd.basisId!==basisId||
    cmd.scopeId!==sourceId||typeof cmd.occurrenceId!=='string'||
    !cmd.occurrenceId||revision(event.result.decisionRevision,stage)<1)return null;
 return {cmd,result:event.result,revision:revision(event.result.decisionRevision,stage)};
};
/** No source XML/master/file bytes or full command payloads leave this module. */
export function projectXml229WeightDecisionProvenance({
 reviewState,basisId,sourceId,completion,confirmedBulkCommandIds=[],
}={}){
 if(!plain(reviewState)||reviewState.schemaVersion!=='gc-pw/1.0'||
    reviewState.basisId!==basisId||
    !/^[a-f0-9]{64}$/i.test(reviewState.contentSha256||'')||
    !Array.isArray(reviewState.reviewStates)||
    !plain(completion)||completion.basisId!==basisId||
    completion.sourceId!==sourceId||completion.engineeringFactsVerified!==true||
    completion.ciiReleaseAuthorized!==false||
    !nonneg(completion.verifiedPhysicalCount)||
    completion.verifiedFactCount!==completion.verifiedPhysicalCount*7||
    !plain(completion.counts)||
    !['source','match1','final','unresolved'].every(k=>nonneg(completion.counts[k]))||
    Object.values(completion.counts).reduce((a,b)=>a+b,0)!==completion.verifiedPhysicalCount)
   fail('PROVENANCE_SOURCE_PROOF_REQUIRED');
 const issues=[], entries=new Map();
 for(const item of reviewState.reviewStates){
  if(!plain(item)||item.scopeId!==sourceId||
     !['RigidMatch1','Rigidmatch2'].includes(item.stage)||
     entries.has(item.stage)||!plain(item.decisions)||!plain(item.commands))
   fail('PROVENANCE_STAGE_SCOPE_DRIFT');
  entries.set(item.stage,item);
 }
 const approved=new Set(Array.isArray(confirmedBulkCommandIds)?confirmedBulkCommandIds:[]);
 const out=[],totals={manual:0,individualProposal:0,bulkConfirmed:0,
  bulkConfirmationUnknown:0,finalOverride:0,confirmedZero:0,unverified:0,
  effectiveMatch1Only:0,acceptedMatch1All:0,acceptedFinal:0};
 const finalSet=new Set();
 for(const stage of ['RigidMatch1','Rigidmatch2']){
  const entry=entries.get(stage)||{decisions:{},commands:{},revision:null};
  const byOccurrence=new Map();
  for(const [key,value] of Object.entries(entry.commands)){
   const found=validEvent(value,key,basisId,sourceId,stage);
   if(!found){issues.push('COMMAND_LEDGER_MALFORMED');continue}
   const id=found.cmd.occurrenceId;
   if(!byOccurrence.has(id))byOccurrence.set(id,[]);
   byOccurrence.get(id).push(found);
  }
  for(const [occurrenceId,decision] of Object.entries(entry.decisions)){
   if(!plain(decision)||decision.state!=='accepted')continue;
   if(out.length>=10000)fail('PROVENANCE_REPORT_BOUNDED');
   const events=(byOccurrence.get(occurrenceId)||[])
     .sort((a,b)=>b.revision-a.revision);
   const recent=events[0];
   const cmd=recent?.cmd;
   const matching=recent?.result.state==='accepted'&&
      cmd?.action===decision.action&&
      (cmd.action==='accept-proposal'?
        cmd.proposalId===decision.proposalId:
        cmd.value===decision.value)&&
      recent.revision>0&&recent.revision<=revision(entry.revision,stage);
   let kind='unverified',bulkConfirmation='not-applicable';
   if(matching){
    if(stage==='Rigidmatch2'&&cmd.action==='final-override')kind='final-override';
    else if(stage==='Rigidmatch2'&&cmd.action==='set-zero-mass'&&cmd.value===0&&
      cmd.unit==='kg'&&cmd.zeroMassConfirmed===true&&
      typeof cmd.reason==='string'&&cmd.reason.startsWith('Owner-confirmed explicit zero kg:'))kind='confirmed-zero';
    else if(cmd.action==='enter-manual')kind='manual';
    else if(cmd.action==='accept-proposal'){
     if(bulkId(cmd,basisId,sourceId)){
      kind=approved.has(cmd.commandId)?'bulk-confirmed':'bulk-confirmation-unknown';
      bulkConfirmation=approved.has(cmd.commandId)?'worker-rpc-confirmed':'not-provable-from-ledger';
     }else kind='individual-proposal';
    }
   }
   if(kind==='unverified')issues.push('DECISION_COMMAND_PROVENANCE_MISSING');
   if(kind==='bulk-confirmation-unknown')issues.push('BULK_CONFIRMATION_NOT_PROVEN');
   const field=kind==='bulk-confirmed'?'bulkConfirmed':
    kind==='bulk-confirmation-unknown'?'bulkConfirmationUnknown':
    kind==='individual-proposal'?'individualProposal':
    kind==='final-override'?'finalOverride':
    kind==='confirmed-zero'?'confirmedZero':kind==='manual'?'manual':'unverified';
   totals[field]++;
   if(stage==='Rigidmatch2'){totals.acceptedFinal++;finalSet.add(occurrenceId)}
   else totals.acceptedMatch1All++;
   out.push({occurrenceId,stage,kg:decision.value,
    action:decision.action,proposalId:decision.proposalId||null,
    provenanceKind:kind,bulkConfirmation,
    decisionRevision:recent?.result.decisionRevision||null,
    hasEngineeringReason:typeof decision.reason==='string'&&!!decision.reason.trim(),
    hasEvidenceRefs:Array.isArray(decision.evidenceRefs)&&decision.evidenceRefs.length>0});
  }
 }
 const match1Set=new Set(out.filter(r=>r.stage==='RigidMatch1').map(r=>r.occurrenceId));
 totals.effectiveMatch1Only=[...match1Set].filter(id=>!finalSet.has(id)).length;
 if(totals.effectiveMatch1Only!==completion.counts.match1||
    totals.acceptedFinal!==completion.counts.final)
   issues.push('COMPLETION_DECISION_CENSUS_MISMATCH');
 const uniqIssues=[...new Set(issues)].sort();
 return {
  schema:'XML229.WeightDecisionProvenanceAudit.v1',
  basisId,sourceId,originalJsonSha256:completion.originalJsonSha256,
  sourceGenerationId:completion.sourceGenerationId,
  population:{physicalCount:completion.verifiedPhysicalCount,
   factCount:completion.verifiedFactCount,counts:{...completion.counts}},
  stageRevisions:completion.stageRevisions||null,
  summary:{...totals,auditedAcceptedDecisions:out.length,
   issues:uniqIssues,provenanceComplete:uniqIssues.length===0,
   nativeCiiReleaseAuthorized:false},
  rows:out.sort((a,b)=>a.occurrenceId.localeCompare(b.occurrenceId)||
    a.stage.localeCompare(b.stage)),
  caveat:'A ledger bulk-command ID alone cannot prove prior user confirmation. Only a successful same-Worker bulk-commit RPC provides that evidence. No source XML/master bytes are included; occurrence IDs may be private.',
 };
}
