import {
  FLANGE_FACE_BINDING_SOURCE_AUTHORITY,
  createFlangeFaceBindingSourceRegister,
  sealFlangeFaceBindingSourceRecord,
  validateFlangeFaceBindingSourceRegister,
} from './flange-face-binding-source-register.js';
import { semanticHashAdvancedAnalysis } from './advanced-analysis-semantic-hash.js';

export const FLANGE_FACE_BINDING_SOURCE_ADMISSION_SCHEMA = 'FlangeFaceBindingSourceAdmission.v1';
export const FLANGE_FACE_BINDING_SOURCE_ACCEPTED_REVIEW_DISPOSITION = 'ACCEPTED';
export const FLANGE_FACE_BINDING_SOURCE_PRE_REVIEW_RECORD_STATE = 'PROJECT_CONTROLLED';

const REVIEW_KEYS = Object.freeze([
  'preparer',
  'reviewer',
  'reviewerRole',
  'reviewEvidenceId',
  'disposition',
  'reviewDate',
  'reviewedSubmissionHash',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(record, expected, field, errors) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    errors.push(`${field} must be a record.`);
    return false;
  }
  const actual = Object.keys(record).sort();
  const target = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(target)) {
    errors.push(`${field} keys do not match the admission contract.`);
    return false;
  }
  return true;
}

function requiredText(value, field, errors) {
  if (!String(value ?? '').trim()) errors.push(`${field} is required.`);
}

function normalizedIdentity(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function validateIndependentReview(review = {}) {
  const errors = [];
  if (!exactKeys(review, REVIEW_KEYS, 'independentReview', errors)) return errors;
  REVIEW_KEYS.filter((key) => key !== 'disposition')
    .forEach((key) => requiredText(review[key], `independentReview.${key}`, errors));
  if (review.disposition !== FLANGE_FACE_BINDING_SOURCE_ACCEPTED_REVIEW_DISPOSITION) {
    errors.push(`independentReview.disposition must equal ${FLANGE_FACE_BINDING_SOURCE_ACCEPTED_REVIEW_DISPOSITION}.`);
  }
  if (
    normalizedIdentity(review.preparer)
    && normalizedIdentity(review.preparer) === normalizedIdentity(review.reviewer)
  ) {
    errors.push('independentReview.reviewer must differ from independentReview.preparer.');
  }
  return errors;
}

function admissionError(errors) {
  const error = new RangeError(errors.join(' '));
  error.code = 'FLANGE_FACE_BINDING_SOURCE_ADMISSION_REJECTED';
  error.errors = errors;
  return error;
}

function reviewProjection(record) {
  const { recordState: _recordState, semanticHash: _semanticHash, ...projection } = record;
  return projection;
}

function reviewedSubmissionHash(record) {
  return semanticHashAdvancedAnalysis(reviewProjection(record));
}

export function computeFlangeFaceBindingSourceSubmissionReviewHash(record = {}) {
  const validated = sealFlangeFaceBindingSourceRecord(record);
  if (validated.recordState !== FLANGE_FACE_BINDING_SOURCE_PRE_REVIEW_RECORD_STATE) {
    throw admissionError([
      `record.recordState must equal ${FLANGE_FACE_BINDING_SOURCE_PRE_REVIEW_RECORD_STATE} for pre-review fingerprinting.`,
    ]);
  }
  return reviewedSubmissionHash(validated);
}

export function admitFlangeFaceBindingSourceSubmission({ record = {}, independentReview = {} } = {}) {
  const errors = validateIndependentReview(independentReview);
  if (record.recordState !== 'INDEPENDENTLY_CHECKED') {
    errors.push('record.recordState must equal INDEPENDENTLY_CHECKED for admission.');
  }
  if (errors.length > 0) throw admissionError(errors);

  const sealedRecord = sealFlangeFaceBindingSourceRecord(record);
  const expectedReviewHash = reviewedSubmissionHash(sealedRecord);
  if (independentReview.reviewedSubmissionHash !== expectedReviewHash) {
    throw admissionError(['independentReview.reviewedSubmissionHash does not match the submitted record semantics.']);
  }

  const register = createFlangeFaceBindingSourceRegister({ records: [sealedRecord] });
  const registerValidation = validateFlangeFaceBindingSourceRegister(register);
  if (!registerValidation.ok) throw admissionError(registerValidation.errors);

  return Object.freeze({
    schema: FLANGE_FACE_BINDING_SOURCE_ADMISSION_SCHEMA,
    sourceAuthority: FLANGE_FACE_BINDING_SOURCE_AUTHORITY,
    reviewedSubmissionHash: expectedReviewHash,
    independentReview: Object.freeze(clone(independentReview)),
    record: sealedRecord,
    automaticBindingProducer: false,
    codeCompliance: false,
    designAuthority: false,
    governingEligible: false,
  });
}
