function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function normalizeLineKey(value) {
  return text(value).toUpperCase().replace(/\s+/g, '');
}

export function lineKeyAliases(value) {
  const compact = normalizeLineKey(value);
  if (!compact) return [];
  const withoutServicePrefix = compact.replace(/^[A-Z](?=\d{5,}$)/, '');
  return [...new Set([compact, withoutServicePrefix].filter(Boolean))];
}

export function digitRuns(value, minLen = 4) {
  return text(value).match(new RegExp(`\\d{${minLen},}`, 'g')) || [];
}

export function bigrams(value) {
  const source = normalizeLineKey(value);
  const grams = [];
  for (let index = 0; index < source.length - 1; index += 1) {
    grams.push(source.slice(index, index + 2));
  }
  return grams;
}

export function diceFromBigrams(left = [], right = []) {
  if (!left.length || !right.length) return 0;
  const counts = new Map();
  for (const gram of left) counts.set(gram, (counts.get(gram) || 0) + 1);
  let hits = 0;
  for (const gram of right) {
    const count = counts.get(gram) || 0;
    if (count > 0) {
      hits += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * hits) / (left.length + right.length);
}

export function lineSequenceScore(branchDigits = [], rowDigits = []) {
  let best = 0;
  for (const branchDigit of branchDigits) {
    for (const rowDigit of rowDigits) {
      if (branchDigit === rowDigit) best = Math.max(best, 1);
      else if (branchDigit.includes(rowDigit) || rowDigit.includes(branchDigit)) best = Math.max(best, 0.85);
      else if (branchDigit.length >= 6 && rowDigit.length >= 6
        && branchDigit.slice(-6) === rowDigit.slice(-6)) best = Math.max(best, 0.7);
    }
  }
  return best;
}

function uniqueSorted(values = []) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function buildLookupMaps(entries) {
  const exact = new Map();
  const aliases = new Map();
  for (const entry of entries) {
    if (entry.cleanKey && !exact.has(entry.cleanKey)) exact.set(entry.cleanKey, entry.index);
    for (const alias of entry.aliases || []) {
      const bucket = aliases.get(alias) || [];
      bucket.push(entry.index);
      aliases.set(alias, bucket);
    }
  }
  return { exact, aliases };
}

function exactAndAliasDecision(lookupMaps, lineKey) {
  const lookupKey = normalizeLineKey(lineKey);
  if (!lookupKey) return { exactIndex: null, aliasIndexes: [] };
  if (lookupMaps.exact.has(lookupKey)) {
    return { exactIndex: lookupMaps.exact.get(lookupKey), aliasIndexes: [] };
  }
  const aliasIndexes = [];
  for (const alias of lineKeyAliases(lineKey)) {
    aliasIndexes.push(...(lookupMaps.aliases.get(alias) || []));
  }
  return { exactIndex: null, aliasIndexes: uniqueSorted(aliasIndexes) };
}

function fuzzyDecision(entries, branchName, lineKey, isolatedKey) {
  const branchDigits = digitRuns(branchName);
  const lookupKeys = [...new Set([lineKey, isolatedKey].map(text).filter(Boolean))];
  const preparedLookups = lookupKeys.map((value) => bigrams(value));
  let best = null;
  for (const entry of entries) {
    const seqScore = lineSequenceScore(branchDigits, entry.rowDigits || []);
    let keyScore = 0;
    for (const lookup of preparedLookups) {
      keyScore = Math.max(
        keyScore,
        diceFromBigrams(lookup, entry.rowKeyBigrams || []),
        diceFromBigrams(lookup, entry.rowSeqBigrams || []),
      );
    }
    const confidence = Math.max(seqScore, keyScore * 0.95);
    if (confidence <= (best?.confidence || 0.55)) continue;
    best = {
      index: entry.index,
      confidence,
      method: seqScore >= keyScore * 0.95 ? 'similar-lineseq' : 'similar-linekey',
    };
  }
  return best;
}

export function selectPreviewLineLookupCandidates(entries = [], branches = []) {
  const selected = new Set();
  const decisions = [];
  const lookupMaps = buildLookupMaps(entries);
  for (const branch of branches) {
    const exactAlias = exactAndAliasDecision(lookupMaps, branch.lineKey);
    if (exactAlias.exactIndex !== null) {
      selected.add(exactAlias.exactIndex);
      decisions.push({ ...branch, finalMatchIndex: exactAlias.exactIndex, method: 'exact' });
      continue;
    }
    for (const index of exactAlias.aliasIndexes) selected.add(index);
    if (exactAlias.aliasIndexes.length === 1) {
      decisions.push({ ...branch, finalMatchIndex: exactAlias.aliasIndexes[0], method: 'alias' });
      continue;
    }
    const fuzzy = fuzzyDecision(entries, branch.branchName, branch.lineKey, branch.isolatedKey);
    if (fuzzy) selected.add(fuzzy.index);
    decisions.push({
      ...branch,
      finalMatchIndex: fuzzy?.index ?? null,
      method: fuzzy?.method || 'none',
      fuzzyConfidence: fuzzy?.confidence || 0,
      ambiguousAliasIndexes: exactAlias.aliasIndexes,
    });
  }
  return { selectedIndices: uniqueSorted([...selected]), decisions };
}

export function sparseRowsByOriginalIndex(rows = [], selectedIndices = []) {
  const lookupRows = new Array(rows.length);
  for (const index of selectedIndices) {
    if (Number.isInteger(index) && index >= 0 && index < rows.length) lookupRows[index] = rows[index];
  }
  return lookupRows;
}
