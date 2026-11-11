function text(value) {
  return String(value ?? '').trim();
}

function sampleName(sample) {
  return text(sample?.branchName || sample?.lineReference);
}

function cleanBranch(value) {
  return text(value).replace(/^\/+/, '').replace(/\/B\d+.*$/i, '');
}

function tokenClass(token) {
  const value = text(token);
  if (/^\d+(?:\.\d+)?\s*(?:"|IN|NPS)$/i.test(value)) return 'NPS';
  if (/^DN\s*\d+(?:\.\d+)?$/i.test(value)) return 'DN';
  if (/^\d+(?:\.\d+)?$/.test(value)) return 'DIGITS';
  if (/^[A-Z]+$/i.test(value)) return 'ALPHA';
  if (/^[A-Z]*\d+[A-Z0-9]*$/i.test(value)) return 'ALNUM';
  return 'MIXED';
}

export function regexSampleSignature(value, delimiter = '-') {
  const tokens = cleanBranch(value).split(delimiter || '-').map(text).filter(Boolean);
  return `${tokens.length}:${tokens.map(tokenClass).join('|')}`;
}

export function buildRegexSampleBuckets(samples = [], delimiter = '-') {
  const seen = new Set();
  const groups = new Map();
  for (const sample of Array.isArray(samples) ? samples : []) {
    const name = sampleName(sample);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const signature = regexSampleSignature(name, delimiter);
    const group = groups.get(signature) || { signature, count: 0, representative: name, members: [] };
    group.count += 1;
    group.members.push(name);
    groups.set(signature, group);
  }
  return [...groups.values()]
    .sort((left, right) => right.count - left.count || left.signature.localeCompare(right.signature))
    .map((group) => Object.freeze({
      signature: group.signature,
      count: group.count,
      representative: group.representative,
      members: Object.freeze([...group.members]),
    }));
}
