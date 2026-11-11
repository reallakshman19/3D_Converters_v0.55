import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const ui = fs.readFileSync(path.join(repo, 'tabs/hp-kd320-evidence-intake-tab.js'), 'utf8');
const workspace = fs.readFileSync(path.join(repo, 'tabs/engineering-workspace-tab.js'), 'utf8');
const facade = fs.readFileSync(path.join(repo, 'engineering/hp-class-standardization/qualification/kd320-q2/csv-four-record-intake.js'), 'utf8');
const semantic = fs.readFileSync(path.join(repo, 'engineering/hp-class-standardization/qualification/kd320-q1/semantic-csv-intake.js'), 'utf8');
const packagePreview = fs.readFileSync(path.join(repo, 'engineering/hp-class-standardization/qualification/kd320-q1/package-preview.js'), 'utf8');
const parser = fs.readFileSync(path.join(repo, 'engineering/hp-class-standardization/qualification/kd320-q2/csv-intake.js'), 'utf8');

test('Engineering workspace registers the combined Q1 package preview cache identity', () => {
  assert.match(workspace, /id: 'hp-kd320-evidence-intake'/);
  assert.match(workspace, /label: 'KD320 Evidence Intake'/);
  assert.match(workspace, /hp-kd320-evidence-intake-tab\.js\?v=20260819-kd320-q1-package-preview-1/);
  assert.match(workspace, /renderHpKd320EvidenceIntakeTab/);
});

test('intake UI preserves all four first-class record classes', () => {
  assert.match(ui, /Upload CSV/);
  assert.match(ui, /Download exact template/);
  assert.match(ui, /KD320_CSV_MODES\.CONTROLLED_SOURCE/);
  assert.match(ui, /KD320_CSV_MODES\.EDITION_SEMANTIC/);
  assert.match(ui, /KD320_CSV_MODES\.QF022_ORACLE/);
  assert.match(ui, /KD320_CSV_MODES\.QF023_PROJECT_CALC/);
  assert.match(ui, /Qualification gate/);
  assert.match(ui, /Gate blockers/);
  assert.match(ui, /No automatic oracle admission/);
  assert.doesNotMatch(ui, /KD320_CSV_MODES\.Q1_EXIT/);
  assert.doesNotMatch(ui, /KD320_CSV_MODES\.Q1_SEMANTIC/);
});

test('CONTROLLED_SOURCE exposes semantic and formal-exit sub-packages', () => {
  assert.match(ui, /CONTROLLED_SOURCE sub-package — Q1 semantic contract/);
  assert.match(ui, /Download Q1 semantic template/);
  assert.match(ui, /Upload Q1 semantic CSV/);
  assert.match(ui, /CONTROLLED_SOURCE sub-package — formal Q1 exit/);
  assert.match(ui, /Download formal-exit template/);
  assert.match(ui, /Upload formal-exit JSON/);
  assert.match(ui, /previewKd320Q1ExitAttestationJson/);
  assert.match(ui, /getKd320Q1ExitAttestationJsonTemplate/);
});

test('UI exposes one joined Q1 package result instead of disconnected completion claims', () => {
  assert.match(ui, /Combined Q1 package preview/);
  assert.match(ui, /previewKd320Q1Package/);
  assert.match(ui, /controlledSourceResult/);
  assert.match(ui, /semanticResult/);
  assert.match(ui, /attestationResult/);
  assert.match(ui, /Formal Q1 remains blocked until all three CONTROLLED_SOURCE sub-packages agree exactly/);
  assert.match(ui, /Formal Q1 is complete\. QF022\/QF023 remain separate Q2 evidence/);
});

test('formal exit intake remains redacted, preview-only and non-authoritative', () => {
  assert.match(ui, /browser memory only/i);
  assert.match(ui, /NATIVE KD320 · FALSE/);
  assert.match(ui, /DESIGN AUTHORITY · FALSE/);
  assert.match(ui, /receipt hashes, all 14 semantic locators\/opaque refs, E01–E08, G0\/G1/);
  for (const forbidden of [/Math\.exp\(/, /Math\.log\(/, /calculateAutomaticSeq/, /interpolateFatigueLife/, /permissibleCycles\s*=/]) {
    assert.doesNotMatch(ui, forbidden);
  }
  assert.doesNotMatch(ui, /canUseForDesignAuthority\s*:\s*true/);
  assert.doesNotMatch(ui, /nativeCoreKd3Qualified\s*:\s*true/);
});

test('combined package adapter delegates authority to the Q2 evaluator', () => {
  assert.match(packagePreview, /evaluateKd320Q2AdmissionCandidate/);
  assert.match(packagePreview, /q1ExitAttestation/);
  assert.match(packagePreview, /Q1_PACKAGE_FORMAL_EXIT_MISSING/);
  assert.match(packagePreview, /productionKernelAllowed:\s*false/);
  assert.match(packagePreview, /automaticPromotionAllowed:\s*false/);
  assert.doesNotMatch(packagePreview, /productionKernelAllowed:\s*true/);
  assert.doesNotMatch(packagePreview, /automaticPromotionAllowed:\s*true/);
});

test('Q1 semantic adapter still delegates readiness and cannot promote authority', () => {
  assert.match(semantic, /evaluateKd320Q2AdmissionCandidate/);
  assert.match(semantic, /PENDING_CONTROLLED_SOURCE_RECEIPT/);
  assert.match(semantic, /productionKernelAllowed:\s*false/);
  assert.doesNotMatch(semantic, /engineeringDefinition/);
});

test('four-record facade continues to delegate existing QF022/QF023 and qualification gates', () => {
  assert.match(facade, /previewLegacyCsv/);
  assert.match(facade, /evaluateKd320Q2AdmissionCandidate/);
  assert.match(facade, /evaluateKd320EditionReconciliation/);
  assert.match(facade, /productionKernelAllowed:\s*false/);
  assert.doesNotMatch(facade, /productionKernelAllowed:\s*true/);
  assert.match(parser, /evaluateKd320Q2AdmissionCandidate/);
  assert.match(parser, /evaluateKd320EditionReconciliation/);
});
