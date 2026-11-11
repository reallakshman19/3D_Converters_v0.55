/** Real EF-05 optional instrument UI and source-wide read-only audit. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function checkEf05OptionalAdviceAndSafety(page,record){
  // The actual 41-branch EF-05 Worker must expose all 14 optional instrument
  // recommendations in usable Weight Match BEFORE the first mass action.
  // This is the served Chromium UI, not a synthetic recommendation fixture.
  const instrumentAdvice=page.locator(
    '[data-p4-weight-root] [data-p4-instrument-advisory]');
  await instrumentAdvice.waitFor({state:'visible',timeout:60000});
  const instrumentAdviceText=(await instrumentAdvice.textContent()||'').trim();
  assert(instrumentAdviceText.startsWith(
    '14 instrument modeling suggestions (optional; no approval required).'),
    'real EF-05 should show all 14 optional instruments without an approval gate');
  assert(instrumentAdviceText.includes(
    'No rigid classification or kg was applied automatically.'),
    'advisory must not imply changes to source geometry or accepted mass');
  assert.equal(await instrumentAdvice.count(),1,
    'exactly one instrument advisory should appear in the current session');
  // Distinguish the two pre-existing review/draft restore inputs from
  // exactly three TopoFix pre-Final SOURCE handoff inputs. Those files convey
  // no instrument approval, no accepted kg, and no native release. Anything
  // else inside Weight remains prohibited as an approval/evidence file gate.
  const uploadPurposes=await page.locator(
    '[data-p4-weight-root] input[type="file"]').evaluateAll(inputs=>
    inputs.map(input=>{
      if(input.hasAttribute('data-p4-import-review'))return 'review-restore';
      if(input.hasAttribute('data-p4-import-drafts'))return 'draft-restore';
      const key=input.getAttribute('data-xml229-topofix-file');
      if(['original','lineage','handoff'].includes(key)&&
         input.closest('details[data-xml229-topofix-fresh]')&&
         input.closest('[data-p4-instrument-advisory]')===null)
        return 'topofix-'+key;
      return 'unrecognized';
    }).sort());
  assert.deepEqual(uploadPurposes,[
    'draft-restore','review-restore',
    'topofix-handoff','topofix-lineage','topofix-original',
  ],'Only explicit pre-Final TopoFix source receipts and review/draft restores are allowed; no instrument evidence or approval upload');
  assert.equal(await page.locator('[data-p4-scope="all"]').count(),1,
    'normal Weight Match must remain available while all instruments are pending');
  record.stages.instrumentModeling={
    realSource:'EF-05',suggestions:14,allOptional:true,
    approvalRequired:false,evidenceUploadRequired:false,
    automaticRigidChanges:false,automaticAcceptedKg:false,
    weightMatchUsable:true};
  record.passes.push('real EF-05 Chromium shows 14 optional instrument suggestions without approvals, uploads or automatic classification');

  // Full public 41-branch source / staged JSON / four-master GC-PW precheck:
  // all original physicals (including outside the focused Weight tab),
  // seven canonical facts per owner, all proposals and semantic family evidence.
  // No original XML, NodeName, occurrence IDs or master rows are exported.
  // Production panel owns its Worker: use the existing DOM's strictly
  // aggregate-only download instead of exporting private session handles.
  const [safetyDownload]=await Promise.all([
    page.waitForEvent('download',{timeout:240000}),
    page.locator('[data-p4-full-source-safety]').click(),
  ]);
  assert.equal(safetyDownload.suggestedFilename(),
    'xml229-full-source-weight-safety-precheck.json');
  record.stages.fullSourceWeight=JSON.parse(
    await readFile(await safetyDownload.path(),'utf8'));
  assert.equal(record.stages.fullSourceWeight.readOnly,true);
  assert.equal(record.stages.fullSourceWeight.population.sevenFactsPerPhysical,true);
  // EF-05 has 423 original physical node occurrences. Exactly 51 matching
  // same-type 1->2 pairs and 123 FLAN/VALV -> existing RIGID continuations
  // have a shared component identity. A canonical physical PART receives
  // one weight decision, never separate kg for the first endpoint.
  assert.equal(record.stages.fullSourceWeight.population.physicalCount,249);
  assert.equal(record.stages.fullSourceWeight.population.factCount,1743);
  const auditedReviews=record.stages.fullSourceWeight.review;
  assert.equal(auditedReviews.source+auditedReviews.acceptedMatch1+
    auditedReviews.acceptedFinal+auditedReviews.unresolved,249,
    'read-only full-source export must report current actual Worker mass population');
  assert.equal(record.stages.fullSourceWeight.review.unchanged,true);
  assert(record.stages.fullSourceWeight.proposals.valveToFlangeRejected>=0,
    'real candidate family rejection count must be observed, not assumed from obsolete 423-node owners');
  assert.equal(record.stages.fullSourceWeight.proposals.sourceFamilyConflict,0);
  assert.equal(record.stages.fullSourceWeight.proposals.valveToFlangeQualified,0);
  assert.equal(record.stages.fullSourceWeight.review.acceptedMatch1,0);
  assert(auditedReviews.acceptedFinal>=0,'accepted Final may already exist after visible source-ranked selection');
  assert.equal(record.stages.fullSourceWeight.nativeCiiReleaseAuthorized,false);
  record.passes.push('public 41-branch read-only source/facts/candidate/actual Final audit; no native release');

}
