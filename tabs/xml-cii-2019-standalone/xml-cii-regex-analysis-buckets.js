import { buildRegexSampleBuckets } from './xml-cii-regex-sample-buckets.js';

function text(value) {
  return String(value ?? '').trim();
}

function sampleName(sample) {
  return text(sample?.branchName || sample?.lineReference);
}

function uniqueSamples(samples = []) {
  const seen = new Set();
  const out = [];
  for (const sample of Array.isArray(samples) ? samples : []) {
    const name = sampleName(sample);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(sample);
  }
  return out;
}

export function selectRegexAnalysisBuckets(samples = [], delimiter = '-', maximumBuckets = 2) {
  const unique = uniqueSamples(samples);
  const firstSeen = new Map(unique.map((sample, index) => [sampleName(sample), index]));
  const ranked = buildRegexSampleBuckets(unique, delimiter)
    .map((bucket) => ({
      ...bucket,
      firstSeen: firstSeen.get(bucket.representative) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => right.count - left.count || left.firstSeen - right.firstSeen);

  const boundedMaximum = Math.max(1, Math.min(2, Number(maximumBuckets) || 2));
  const selected = ranked.slice(0, ranked.length <= 1 ? 1 : boundedMaximum);
  const selectedNames = new Set(selected.flatMap((bucket) => bucket.members));
  const analysisSamples = unique.filter((sample) => selectedNames.has(sampleName(sample)));

  return Object.freeze({
    sourceSampleCount: unique.length,
    structuralBucketCount: ranked.length,
    selectedBucketCount: selected.length,
    selectedSampleCount: analysisSamples.length,
    selectedSignatures: Object.freeze(selected.map((bucket) => bucket.signature)),
    selectedBuckets: Object.freeze(selected.map((bucket) => Object.freeze({
      signature: bucket.signature,
      count: bucket.count,
      representative: bucket.representative,
      firstSeen: bucket.firstSeen,
      members: bucket.members,
    }))),
    samples: Object.freeze([...analysisSamples]),
  });
}
