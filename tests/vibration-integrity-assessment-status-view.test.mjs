import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const viewUrl = new URL('../tabs/vibration-integrity-view.js', import.meta.url);
const statusViewUrl = new URL('../tabs/vibration-integrity-assessment-status-view.js', import.meta.url);

async function sources() {
  const [view, statusView] = await Promise.all([
    readFile(viewUrl, 'utf8'),
    readFile(statusViewUrl, 'utf8'),
  ]);
  return { view, statusView };
}

test('screening register builds line-case status from the existing mechanism matrix result', async () => {
  const { view } = await sources();
  assert.match(view, /buildVibrationLineCaseAssessmentStatus\(\{ row, matrix \}\)/);
  assert.match(view, /assessmentStatus:/);
  assert.match(view, /renderVibrationLineCaseAssessmentStatusCell\(assessmentStatus\)/);
});

test('workflow status is presented before EI completeness without replacing it', async () => {
  const { view } = await sources();
  const workflow = view.indexOf('<th>Line/case workflow status</th>');
  const completeness = view.indexOf('<th>EI assessment status</th>');
  assert(workflow >= 0, 'workflow status column must be present');
  assert(completeness > workflow, 'EI assessment status must remain immediately downstream of workflow status');
  assert.match(view, /EI assessment completeness remains the primary engineering assessment result/);
});

test('status rendering is read-only and carries an explicit authority warning', async () => {
  const { view, statusView } = await sources();
  assert.match(view, /workflow status is a projection only and cannot determine applicability or completeness/);
  assert.doesNotMatch(statusView, /data-vi-/);
  assert.doesNotMatch(statusView, /<button/i);
  assert.doesNotMatch(statusView, /<input/i);
  assert.doesNotMatch(statusView, /<select/i);
});
