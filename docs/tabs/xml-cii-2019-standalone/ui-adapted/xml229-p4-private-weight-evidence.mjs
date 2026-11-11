/** Read-only, private, source-bound Weight evidence exports. No ledger writes. */
import {downloadTextFile} from './xml-cii-adapted-dom.js';
import {prepareXml229G3G4LocalAggregateExport} from './xml229-g3g4-local-aggregate-export.mjs';
import {getXml229FlowTrace,recordXml229FlowTrace} from './xml229-flow-trace-registry.mjs';
import {formatXml229DecisionAuditSummary}
 from './xml229-p4-weight-review-presentation.mjs';
const fail=(code)=>{const error=new Error(code);error.code=code;throw error;};
export async function exportXml229WeightEvidence({
 kind,session,stateRef,isCurrent=()=>false,
}={}){
 if(!session||!isCurrent())fail('WEIGHT_EVIDENCE_SESSION_STALE');
 if(kind==='trace'){
  const trace=getXml229FlowTrace(stateRef);
  if(!trace)fail('FLOW_TRACE_SESSION_STALE');
  const proof=await session.readCompletion();
  if(!isCurrent())fail('FLOW_TRACE_SESSION_STALE');
  recordXml229FlowTrace(stateRef,{kind:'WEIGHT_UI_RENDERED',actor:'weight-ui',
    counts:{physical:proof.verifiedPhysicalCount,facts:proof.verifiedFactCount,
      sourceMass:proof.counts?.source,match1:proof.counts?.match1,
      final:proof.counts?.final,unresolved:proof.counts?.unresolved}});
  const json=JSON.stringify(trace.snapshot(),null,2);
  if(json.length>131072)fail('FLOW_TRACE_EXPORT_TOO_LARGE');
  downloadTextFile('xml229-cross-worker-flow-trace.json',json,'application/json;charset=utf-8');
  return 'Private Worker/UI trace exported; native CII remains HELD.';
 }
 if(kind==='coverage'){
  const pair=await session.readCandidateReadinessPair();
  if(!isCurrent())fail('G3_G4_AGGREGATE_EXPORT_HELD');
  const receipt=prepareXml229G3G4LocalAggregateExport({pair,receipt:session.receipt});
  downloadTextFile(receipt.filename,receipt.text,'application/json;charset=utf-8');
  return 'Private G3/G4 aggregate exported: '+pair.coverage.physicalCount+
    ' original physicals, '+pair.coverage.counts.occurrencesWithQualifiedCandidates+
    ' with qualified proposals; native CII remains HELD.';
 }
 if(kind==='audit'){
  const report=await session.readDecisionProvenance();
  if(!isCurrent()||report?.basisId!==session.receipt?.basisId)
    fail('PROVENANCE_SESSION_STALE');
  downloadTextFile('xml229-weight-decision-provenance.json',
    JSON.stringify({...report,exportedAt:new Date().toISOString()},null,2),
    'application/json;charset=utf-8');
  return formatXml229DecisionAuditSummary(report);
 }
 fail('UNKNOWN_WEIGHT_EVIDENCE_EXPORT');
}
