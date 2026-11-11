import { normalizeXmlCiiRating } from './dtxr-rating-resolver.js';

function text(value) { return value == null ? '' : String(value).trim(); }

export function xmlCiiWeightRatingClass(row = {}) {
  return text(row.requestedPipingClass || row.pipingClassDerived || row.pipingClass
    || row.resolvedPipingClass).toUpperCase().replace(/\s+/g, '');
}

function rowKeys(row) {
  return [...new Set([text(row.lineKey), text(row.branchName)].filter(Boolean))];
}

export function readXmlCiiWeightManualRating(row, config = {}) {
  const pipingClass = xmlCiiWeightRatingClass(row);
  const keys = [...rowKeys(row), pipingClass, pipingClass && `PC:${pipingClass}`].filter(Boolean);
  for (const key of keys) {
    const rating = normalizeXmlCiiRating(config.overrides?.rating?.[key]);
    if (rating) return rating;
  }
  for (const key of keys) {
    const rating = normalizeXmlCiiRating(config.overrides?.processData?.[key]?.rating);
    if (rating) return rating;
  }
  return '';
}

export function saveXmlCiiWeightRating(config, rows, sourceRow, rawValue, { fillClass = false } = {}) {
  const value = text(rawValue);
  if (value && (!/^(?:(?:CL|CLASS|RATING|PN)\s*[-:]?\s*)?\d+\s*#?$/i.test(value)
    || Number(normalizeXmlCiiRating(value)) <= 0)) throw new Error('Enter a positive numeric Rating, such as 300.');
  const rating = normalizeXmlCiiRating(value);
  const pipingClass = xmlCiiWeightRatingClass(sourceRow);
  if (fillClass && (!pipingClass || !rating)) throw new Error('Class fill needs a piping class and a Rating.');
  const selected = fillClass ? rows.filter((row) => xmlCiiWeightRatingClass(row) === pipingClass) : [sourceRow];
  const selectedLines = new Set(selected.map((row) => text(row.lineKey)).filter(Boolean));
  const conflictingLine = fillClass && rows.find((row) => selectedLines.has(text(row.lineKey))
    && xmlCiiWeightRatingClass(row) !== pipingClass);
  if (conflictingLine) throw new Error(`Class fill cannot change Line Key ${text(conflictingLine.lineKey)} shared by another piping class. Review the Line Keys in Preview first.`);
  const keys = [...new Set(selected.flatMap(rowKeys))];
  if (!keys.length) throw new Error('This row has no branch or line identity for a saved Rating.');
  const overrides = { ...config.overrides, rating: { ...config.overrides?.rating }, processData: { ...config.overrides?.processData } };
  for (const key of keys) {
    const process = { ...overrides.processData[key] };
    if (rating) { overrides.rating[key] = rating; process.rating = rating; }
    else { delete overrides.rating[key]; delete process.rating; }
    if (Object.keys(process).length) overrides.processData[key] = process;
    else delete overrides.processData[key];
  }
  return { config: { ...config, overrides }, rating, branches: new Set(selected.map((row) => row.branchName)).size };
}
