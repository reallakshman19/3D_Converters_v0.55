import assert from 'node:assert/strict';
import test from 'node:test';
import { buildXmlCiiPreviewRatingSnapshot, resolveXmlCiiWeightMatchRating } from '../converters/xml-cii2019-core/preview-rating-snapshot.js';
import { saveXmlCiiWeightRating } from '../converters/xml-cii2019-core/weight-rating-input.js';
import { prepareXmlCiiWeightBasis } from '../tabs/xml-cii-2019-standalone/workers/weight-basis-service.js';
import { rankXmlCiiWeightIssue } from '../converters/xml-cii2019-core/weight-match-ranking-service.js';
import { buildXmlCiiRigidWeightMatch1Provenance, withXmlCiiRigidWeightMatch1 } from '../converters/xml-cii2019-core/rigid-weight-authority.js';

const row = { branchName: 'ASIM-1836-8"-P8810021-31441C4-PP/B1', lineKey: 'P8810021', requestedPipingClass: '31441C4', dtxr: 'GATE VALVE 900#' };
const config = { rating: { ratingSequence: [['31', '600'], ['3', '300']], pipingClassTokenIndex: 5, tokenDelimiter: '-' }, overrides: {} };
const empty = buildXmlCiiPreviewRatingSnapshot([]);

test('configured prefix supplies missing Rating and preserves mapping order; DTXR remains explicit', () => {
  const result = resolveXmlCiiWeightMatchRating(row, { snapshot: empty, config });
  assert.equal(result.rating, '600');
  assert.equal(result.source, 'piping-class-prefix');
  assert.equal(result.dtxrRating, '900');
  assert.equal(resolveXmlCiiWeightMatchRating(row, { snapshot: empty, config, mode: 'dtxr' }).rating, '900');
});

test('Preview wins over prefix; conflicting Preview cannot be silently filled', () => {
  const preview = buildXmlCiiPreviewRatingSnapshot([{ ...row, rating: '150' }]);
  assert.equal(resolveXmlCiiWeightMatchRating(row, { snapshot: preview, config }).rating, '150');
  const conflict = buildXmlCiiPreviewRatingSnapshot([{ ...row, rating: '150' }, { ...row, rating: '900' }]);
  assert.equal(resolveXmlCiiWeightMatchRating(row, { snapshot: conflict, config }).rating, '');
  const lineConflict = buildXmlCiiPreviewRatingSnapshot([
    { ...row, branchName: 'other1', rating: '150' }, { ...row, branchName: 'other2', rating: '900' },
  ]);
  assert.equal(resolveXmlCiiWeightMatchRating(row, { snapshot: lineConflict, config }).rating, '');
  const blankPreview = buildXmlCiiPreviewRatingSnapshot([{ ...row, pipingClass: '93842', rating: '' }]);
  const changedClass = { ...config, rating: { ratingSequence: [['3', '300'], ['9', '900']] } };
  assert.equal(resolveXmlCiiWeightMatchRating(row, { snapshot: blankPreview, config: changedClass }).rating, '900', 'Current Preview class governs prefix fallback');
});

test('manual input persists existing overrides, wins over stale Preview, and clearing restores prefix', () => {
  const base = { ...config, overrides: { processData: { [row.lineKey]: { t1: 82 } } } };
  const saved = saveXmlCiiWeightRating(base, [row], row, 'CLASS 900');
  assert.equal(saved.config.overrides.rating[row.lineKey], '900');
  assert.equal(saved.config.overrides.processData[row.branchName].rating, '900');
  assert.equal(saved.config.overrides.processData[row.lineKey].t1, 82);
  const preview = buildXmlCiiPreviewRatingSnapshot([{ ...row, rating: '150' }]);
  assert.equal(resolveXmlCiiWeightMatchRating(row, { snapshot: preview, config: saved.config }).rating, '900');
  const cleared = saveXmlCiiWeightRating(saved.config, [row], row, '');
  assert.equal(resolveXmlCiiWeightMatchRating(row, { snapshot: empty, config: cleared.config }).rating, '600');
  assert.deepEqual(base.overrides.processData[row.lineKey], { t1: 82 }, 'input config stays immutable');
  for (const value of ['0', '-300', 'abc300', '300/600']) assert.throws(() => saveXmlCiiWeightRating(base, [row], row, value));
});

test('class fill replaces visible same-class line/branch overrides and preserves another class', () => {
  const second = { ...row, branchName: 'B2', lineKey: 'L2', requestedPipingClass: ' 31441c4 ' };
  const other = { ...row, branchName: 'B3', lineKey: 'L3', requestedPipingClass: '61440' };
  const base = saveXmlCiiWeightRating(config, [row, second, other], other, '150').config;
  const saved = saveXmlCiiWeightRating(base, [row, second, other], row, '300', { fillClass: true });
  assert.equal(saved.branches, 2);
  assert.equal(saved.config.overrides.rating.L2, '300');
  assert.equal(saved.config.overrides.rating.L3, '150');
  assert.equal(saved.config.overrides.rating['PC:31441C4'], undefined, 'fill does not create a global class override');
  assert.throws(() => saveXmlCiiWeightRating(base, [row, { ...other, lineKey: row.lineKey }], row, '300', { fillClass: true }), /shared by another piping class/, 'Line-scoped persistence must not change a different class');
});

test('worker validates changed manual Rating before ranking or releasing accepted Match1', async () => {
  const xmlText = `<Model><Branch><Branchname>${row.branchName.replaceAll('"', '&quot;')}</Branchname><Node><NodeNumber>10</NodeNumber><ComponentType>VALV</ComponentType><ComponentRefNo>V1</ComponentRefNo><NodeName>GATE VALVE</NodeName><Bore>80</Bore><ElementLengthMm>100</ElementLengthMm><Weight>0</Weight></Node></Branch></Model>`;
  const basis = await prepareXmlCiiWeightBasis({ xmlText, config, previewRatingSnapshot: empty });
  assert.equal(basis.issues.length, 1);
  const issue = basis.issues[0];
  assert.equal(issue.rating, '600');
  const provenance = buildXmlCiiRigidWeightMatch1Provenance(issue, config, null, { weightKg: 9, acceptanceMethod: 'manual' });
  const accepted = withXmlCiiRigidWeightMatch1(config, { [issue.key]: 9 }, { [issue.key]: provenance });
  const edited = saveXmlCiiWeightRating(accepted, basis.issues, issue, '300').config;
  const changed = await prepareXmlCiiWeightBasis({ xmlText, config: edited, previewRatingSnapshot: empty });
  assert.equal(changed.issues[0].rating, '300');
  assert.equal(changed.match1Validation.stale[issue.key].reason, 'basis-changed');
  assert.equal(changed.effectiveRigidWeight[issue.key], undefined);
  const ranked = rankXmlCiiWeightIssue({ ...issue, rating: '600' }, edited, { snapshot: empty });
  assert.equal(ranked.rating, '300', 'ranking shares the saved manual authority');
});

test('candidate weights follow the configured/manual Rating instead of the incoming row Rating', () => {
  const masterRows = [
    { convertedBore: 80, ratingClass: '300', lengthMm: 100, valveWeight: 10, type: 'VALVE', typeDesc: 'GATE VALVE' },
    { convertedBore: 80, ratingClass: '600', lengthMm: 100, valveWeight: 20, type: 'VALVE', typeDesc: 'GATE VALVE' },
  ];
  const candidateRow = { ...row, boreMm: 80, lengthMm: 100, componentType: 'VALVE', nodeName: 'GATE VALVE', rating: '150' };
  const base = { ...config, weight: { masterRows } };
  const prefixed = rankXmlCiiWeightIssue(candidateRow, base, { snapshot: empty });
  assert.equal(prefixed.candidates[0].selectedWeight, 20);
  const manual = saveXmlCiiWeightRating(base, [candidateRow], candidateRow, '300').config;
  assert.equal(rankXmlCiiWeightIssue(candidateRow, manual, { snapshot: empty }).candidates[0].selectedWeight, 10);
});
