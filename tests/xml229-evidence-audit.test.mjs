import test from 'node:test';
import assert from 'node:assert/strict';
import { auditXml229Evidence, AUDIT_SCHEMA } from '../contracts/xml229-evidence-v1/audit.mjs';

const sha = c => c.repeat(64);
const fixture = () => {
  const sourceReceipt = {schema:'XML229.OriginalStagedSourceReceipt.v1',sha256:sha('a'),generationId:'G1'};
  const sessionReceipt = {basisId:sha('b'),sourceId:'S1',originalJsonSha256:sha('a'),sourceGenerationId:'G1',physicalCount:3};
  const completion = {schema:'XML229.P4.RunAdvisory.v1',basisId:sha('b'),sourceId:'S1',
    originalJsonSha256:sha('a'),sourceGenerationId:'G1',
    engineeringFactsVerified:true,previewStatus:'FULL_SOURCE_FACTS_VERIFIED',
    verifiedPhysicalCount:3,verifiedFactCount:21,
    counts:{source:1,match1:0,final:2,unresolved:0},ciiReleaseAuthorized:false};
  const finalIntent = {schema:'XML229.NativeFinalPhysicalIntent.v1',basisId:sha('b'),
    originalJsonSha256:sha('a'),sourceGenerationId:'G1',intentSha256:sha('c'),
    physicalCount:3,verifiedFactCount:21,sourceAcceptedCount:1,
    match1OnlyCount:0,acceptedFinalCount:2,unresolvedCount:0,eligibleForEngineBinding:true,
    physicalEngineConsumptionVerified:false,nativeCiiReleaseAuthorized:false};
  const physicalTransfer = {schema:'XML229.R2.OriginalPhysicalEngineInputTransfer.v1',
    basisId:sha('b'),finalIntentSha256:sha('c'),engineInputSha256:sha('d'),
    originalPhysicalCount:3,verifiedEnginePhysicalCount:3,complete:true,
    matches:[1,2,3].map(n=>({originalOccurrenceId:'id'+n})),nativeCiiReleaseAuthorized:false};
  const nativeBoundary = {schema:'XML229.NativeCiiEngineBoundary.v1',
    engineInputSha256:sha('d'),ciiOutputSha256:sha('e'),engineBoundaryVerified:true,
    physicalMatch2ConsumptionVerified:false,nativeCiiReleaseAuthorized:false};
  const checklistRows=[{id:'preview-audit',status:'ready',blocking:false},
    {id:'weight-match',status:'ready',blocking:false},
    {id:'xml229-original-json-engineering-authority',status:'held',blocking:true}];
  const readiness = {summary:{blockingCount:1,warningCount:0},checklistRows,
    raw:{xml229VerifiedEngineering:true,xml229XmlOnlyOutput:false}};
  return {sourceReceipt,sessionReceipt,completion,finalIntent,physicalTransfer,nativeBoundary,readiness};
};
const issue = (doc, code) => assert(auditXml229Evidence(doc).issues.includes(code), code);

test('consistent synthetic evidence can NEVER grant native release authority',()=>{
  const result=auditXml229Evidence(fixture());
  assert.equal(result.schema,AUDIT_SCHEMA);
  assert.equal(result.status,'CONSISTENT');
  assert.equal(result.authoritative,false);
  assert.equal(result.nativeCiiReleaseAuthorized,false);
  assert.equal(result.physicalCount,3);
  assert.equal(result.factRecordCount,21);
});
test('incomplete evidence remains incomplete, not green or authorized',()=>{
  const {sourceReceipt,completion}=fixture();
  const r=auditXml229Evidence({sourceReceipt,completion});
  assert.equal(r.status,'INCOMPLETE');
  assert.equal(r.nativeCiiReleaseAuthorized,false);
  assert(r.missingEvidence.includes('nativeBoundary'));
});
test('refuses independently incompatible basis, source, generation and physical counts',()=>{
  const mutants=[
    d=>d.completion.basisId=sha('f'),
    d=>d.completion.sourceGenerationId='G2',
    d=>d.completion.verifiedPhysicalCount=2,
    d=>d.completion.verifiedFactCount=20,
    d=>d.finalIntent.originalJsonSha256=sha('f'),
    d=>d.finalIntent.acceptedFinalCount=1,
    d=>d.finalIntent.intentSha256=sha('f'),
    d=>d.physicalTransfer.engineInputSha256=sha('f'),
  ];
  for(const mutate of mutants){const d=fixture();mutate(d);
    assert.equal(auditXml229Evidence(d).status,'INCONSISTENT');}
});
test('catches duplicate native engine-input owner, missing owner and release flag injection',()=>{
  const d=fixture();d.physicalTransfer.matches[1].originalOccurrenceId='id1';
  issue(d,'ENGINE_INPUT_DUPLICATE_OR_MISSING_OWNER');
  const e=fixture();e.nativeBoundary.nativeCiiReleaseAuthorized=true;
  issue(e,'UNSUPPORTED_RELEASE_CLAIM');
  const f=fixture();f.nativeBoundary.physicalMatch2ConsumptionVerified=true;
  issue(f,'UNSUPPORTED_NATIVE_PHYSICAL_CONSUMPTION_CLAIM');
});
test('detects legacy DOM-only report mismatch without endorsing a ready Preview',()=>{
  const d=fixture();d.readiness.summary.warningCount=4;
  issue(d,'READINESS_SUMMARY_ROW_DRIFT');
  const e=fixture();e.readiness.raw.xml229VerifiedEngineering=false;
  issue(e,'UNATTESTED_GOVERNED_READINESS');
  const f=fixture();f.readiness.checklistRows[2].status='ready';
  issue(f,'GOVERNED_NATIVE_HOLD_MISSING');
});
test('source count null is distinct from fact record population verification',()=>{
  const d=fixture();d.completion.counts={source:0,match1:0,final:0,unresolved:3};
  delete d.finalIntent;delete d.physicalTransfer;delete d.nativeBoundary;delete d.readiness;
  const a=auditXml229Evidence(d);
  assert.equal(a.status,'INCOMPLETE');
  assert(!a.issues.includes('INCONSISTENT_PHYSICAL_FACT_OR_MASS_CENSUS'));
  assert.equal(a.massCounts.unresolved,3);
});
test('invalid and attacker-shaped documents have deterministic safe issue codes',()=>{
  const d=auditXml229Evidence(null);
  assert.deepEqual(d.issues,['INVALID_AUDIT_ENVELOPE']);
  const e=fixture();e.sourceReceipt.sha256='malformed';
  issue(e,'INVALID_SOURCE_RECEIPT');
});

test('audit output never echoes unrelated caller-supplied mass-count data',()=>{
  const d=fixture();d.completion.counts.privateXml='PRIVATE_OWNER_XML';
  const r=auditXml229Evidence(d);
  assert.equal(r.status,'CONSISTENT');
  assert.equal(JSON.stringify(r).includes('PRIVATE_OWNER_XML'),false);
  assert.deepEqual(Object.keys(r.massCounts).sort(),['final','match1','source','unresolved']);
});
