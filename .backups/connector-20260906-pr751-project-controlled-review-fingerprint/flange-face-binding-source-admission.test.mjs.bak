import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  FLANGE_FACE_BINDING_SOURCE_ADMISSION_SCHEMA,
  admitFlangeFaceBindingSourceSubmission,
  computeFlangeFaceBindingSourceSubmissionReviewHash,
} from '../converters/engineering-calculations/flange/flange-face-binding-source-admission.js';
import {
  FLANGE_FACE_BINDING_SOURCE_AUTHORITY,
  FLANGE_FACE_BINDING_SOURCE_RECORD_SCHEMA,
  sealFlangeFaceBindingSourceRecord,
} from '../converters/engineering-calculations/flange/flange-face-binding-source-register.js';
import {
  ADVANCED_ANALYSIS_SOURCE_COMMIT,
  ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
} from '../converters/engineering-calculations/flange/advanced-analysis-interface-adapter.js';
import { admitFlangeFaceBindingSourceFile } from '../scripts/admit-flange-face-binding-source.mjs';
import { computeFlangeFaceBindingSourceReviewHashFile } from '../scripts/compute-flange-face-binding-source-review-hash.mjs';

function record(overrides = {}) {
  const value = {
    schema: FLANGE_FACE_BINDING_SOURCE_RECORD_SCHEMA,
    recordId: 'FFBS-750-001',
    recordRevisionId: 'REV-1',
    recordState: 'INDEPENDENTLY_CHECKED',
    projectId: 'PROJECT-750',
    model: {
      modelId: 'MODEL-750',
      modelRevisionId: 'MODEL-REV-1',
      globalFrameId: 'GLOBAL-1',
      lengthUnit: 'm',
      sourceSchema: 'rvm-converter-stage/v1',
      sourceKind: 'CONTROLLED_PROJECT_MODEL',
      sourceFile: 'project-model.rvm',
      sourceRef: 'MODEL-REGISTER-750',
      sourcePath: '/EQUIPMENT/E-750/NOZZLE/N1/FLANGE',
      nativeKind: 'WeldNeckFlange',
      componentRole: 'PHYSICAL_FLANGE',
    },
    joint: {
      jointId: 'J-750-N1',
      componentId: 'FLANGE-750-N1',
      selectedFaceId: 'FACE-750-N1',
      selectedPortId: 'PORT-750-N1',
      matingSideId: 'PIPE-SIDE-750-N1',
    },
    geometry: {
      referencePointGlobalM: { x: 1, y: 2, z: 3 },
      openingDirection: 'POSITIVE_LOCAL_X',
    },
    analysisInterface: {
      sourceRepository: ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
      sourceCommit: ADVANCED_ANALYSIS_SOURCE_COMMIT,
      interfaceSetSemanticHash: 'fnv1a64:1111111111111111',
      interfaceId: 'IF-750-N1',
      interfaceSemanticHash: 'fnv1a64:2222222222222222',
      frameSemanticHash: 'fnv1a64:3333333333333333',
      reportingSignConvention: 'FORCE_ON_INTERFACE_FROM_PIPE',
    },
    sourceControl: {
      bindingSourceId: 'BINDING-SOURCE-750',
      modelEntitySourceId: 'MODEL-ENTITY-SOURCE-750',
      calculationFaceSourceId: 'FACE-SOURCE-750',
      openingDirectionSourceId: 'OPENING-SOURCE-750',
      matingSideSourceId: 'MATING-SOURCE-750',
      globalFrameSourceId: 'FRAME-SOURCE-750',
      analysisInterfaceSourceId: 'ANALYSIS-SOURCE-750',
    },
    ambiguityPolicy: {
      identityPolicy: 'EXACT_IDENTIFIERS_ONLY',
      ambiguityDisposition: 'UNAMBIGUOUS_REQUIRED',
      candidateCount: 1,
      positionToleranceM: 0.0001,
      orientationToleranceRad: 0.001,
      toleranceSourceId: 'TOLERANCE-SOURCE-750',
    },
    semanticHash: '',
  };
  return { ...value, ...overrides };
}

function review(candidate, overrides = {}) {
  return {
    reviewer: 'Independent Reviewer',
    reviewerRole: 'Mechanical Engineer',
    reviewEvidenceId: 'REVIEW-EVIDENCE-750',
    disposition: 'ACCEPTED',
    reviewDate: '2026-09-06',
    reviewedSubmissionHash: computeFlangeFaceBindingSourceSubmissionReviewHash(candidate),
    ...overrides,
  };
}

function submission(recordOverrides = {}, reviewOverrides = {}) {
  const candidate = record(recordOverrides);
  return { record: candidate, independentReview: review(candidate, reviewOverrides) };
}

test('review hash is stable across source-control review state transition', () => {
  const projectControlled = record({ recordState: 'PROJECT_CONTROLLED' });
  const independentlyChecked = record({ recordState: 'INDEPENDENTLY_CHECKED' });
  assert.equal(
    computeFlangeFaceBindingSourceSubmissionReviewHash(projectControlled),
    computeFlangeFaceBindingSourceSubmissionReviewHash(independentlyChecked),
  );
});

test('admits only independently checked source custody and preserves non-authorizing flags', () => {
  const admitted = admitFlangeFaceBindingSourceSubmission(submission());
  assert.equal(admitted.schema, FLANGE_FACE_BINDING_SOURCE_ADMISSION_SCHEMA);
  assert.equal(admitted.sourceAuthority, FLANGE_FACE_BINDING_SOURCE_AUTHORITY);
  assert.equal(admitted.reviewedSubmissionHash, admitted.independentReview.reviewedSubmissionHash);
  assert.match(admitted.record.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
  assert.equal(admitted.automaticBindingProducer, false);
  assert.equal(admitted.codeCompliance, false);
  assert.equal(admitted.designAuthority, false);
  assert.equal(admitted.governingEligible, false);
  assert.equal('binding' in admitted, false);
  assert.equal('jointModelContext' in admitted, false);
});

for (const recordState of ['DRAFT', 'PROJECT_CONTROLLED', 'RETIRED']) {
  test(`rejects ${recordState} records even with an ACCEPTED review`, () => {
    assert.throws(
      () => admitFlangeFaceBindingSourceSubmission(submission({ recordState })),
      /recordState must equal INDEPENDENTLY_CHECKED/u,
    );
  });
}

for (const disposition of ['REJECTED', 'NOT_RUN']) {
  test(`rejects independent review disposition ${disposition}`, () => {
    assert.throws(
      () => admitFlangeFaceBindingSourceSubmission(submission({}, { disposition })),
      /disposition must equal ACCEPTED/u,
    );
  });
}

test('rejects incomplete independent-review provenance', () => {
  assert.throws(
    () => admitFlangeFaceBindingSourceSubmission(submission({}, { reviewEvidenceId: '' })),
    /reviewEvidenceId is required/u,
  );
});

test('rejects replay of an accepted review against changed source semantics', () => {
  const original = record();
  const independentReview = review(original);
  const changed = record({
    joint: { ...original.joint, selectedFaceId: 'FACE-750-N1-CHANGED' },
  });
  assert.throws(
    () => admitFlangeFaceBindingSourceSubmission({ record: changed, independentReview }),
    /reviewedSubmissionHash does not match/u,
  );
});

test('retains the existing stale-semantic-hash rejection', () => {
  const clean = record();
  const stale = { ...clean, semanticHash: 'fnv1a64:0000000000000000' };
  assert.throws(
    () => admitFlangeFaceBindingSourceSubmission({ record: stale, independentReview: review(clean) }),
    /semanticHash is stale/u,
  );
});

test('accepts a previously sealed independently checked record without changing its hash', () => {
  const candidate = record();
  const sealed = sealFlangeFaceBindingSourceRecord(candidate);
  const admitted = admitFlangeFaceBindingSourceSubmission({ record: sealed, independentReview: review(candidate) });
  assert.equal(admitted.record.semanticHash, sealed.semanticHash);
});

test('pre-review CLI fingerprints the exact project-controlled candidate', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ffbs-review-hash-'));
  const file = join(directory, 'record.json');
  const candidate = record({ recordState: 'PROJECT_CONTROLLED' });
  try {
    writeFileSync(file, JSON.stringify(candidate), 'utf8');
    const fingerprint = computeFlangeFaceBindingSourceReviewHashFile(file);
    assert.equal(fingerprint.recordId, candidate.recordId);
    assert.equal(fingerprint.recordRevisionId, candidate.recordRevisionId);
    assert.equal(
      fingerprint.reviewedSubmissionHash,
      computeFlangeFaceBindingSourceSubmissionReviewHash(candidate),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CLI file consumer applies the same admission boundary', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ffbs-admission-'));
  const file = join(directory, 'submission.json');
  try {
    writeFileSync(file, JSON.stringify(submission()), 'utf8');
    const admitted = admitFlangeFaceBindingSourceFile(file);
    assert.equal(admitted.record.recordId, 'FFBS-750-001');
    assert.equal(admitted.independentReview.disposition, 'ACCEPTED');
    assert.equal(admitted.reviewedSubmissionHash, admitted.independentReview.reviewedSubmissionHash);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
