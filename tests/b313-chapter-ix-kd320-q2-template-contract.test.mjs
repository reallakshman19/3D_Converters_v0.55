import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  KD320_Q2_METHOD_SEMANTICS,
  KD320_Q2_REQUIRED_SEMANTICS,
} from '../engineering/hp-class-standardization/qualification/kd320-q2/intake.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(
  here, '..', 'engineering', 'hp-class-standardization', 'qualification',
  'kd320-q2', 'candidate.template.json',
);

function loadTemplate() {
  return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
}

test('Q2 candidate template retains all fourteen Q1 semantic placeholders', () => {
  const candidate = loadTemplate();
  assert.equal(candidate.schema, 'kd320-q2-admission-candidate/v1');
  assert.deepEqual(
    candidate.semanticItems.map((row) => row.semanticId),
    KD320_Q2_REQUIRED_SEMANTICS,
  );
});

test('Q2 candidate template never preclaims formal Q1 exit', () => {
  const candidate = loadTemplate();
  assert.equal(candidate.q1ExitAttestation, null);
  assert(candidate._instructions.some((line) => line.includes('E01-E08') && line.includes('G0-G1')));
});

test('QF023 template cites exact method semantics and both controlled receipts', () => {
  const oracle = loadTemplate().projectOracle;
  assert.deepEqual(oracle.semanticRefs, KD320_Q2_METHOD_SEMANTICS);
  assert.deepEqual(oracle.controlledSourceReceiptRefs, [
    'Q1-SRC-B313-2024',
    'Q1-SRC-VIII3-2025',
  ]);
});

test('QF022 template cites exact method semantics and controlled VIII-3 2025 receipt', () => {
  const oracle = loadTemplate().publishedOracle;
  assert.deepEqual(oracle.semanticRefs, KD320_Q2_METHOD_SEMANTICS);
  assert.deepEqual(oracle.controlledSourceReceiptRefs, ['Q1-SRC-VIII3-2025']);
});

test('template keeps qualification authority permanently false', () => {
  const authority = loadTemplate().authority;
  for (const field of [
    'nativeCoreKd3Qualified',
    'codeCompliance',
    'canUseForDesignAuthority',
    'productionKernelAllowed',
    'automaticPromotionAllowed',
  ]) assert.equal(authority[field], false, field);
});
