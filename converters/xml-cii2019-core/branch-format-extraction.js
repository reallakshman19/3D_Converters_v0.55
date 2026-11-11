/**
 * Deterministic, side-effect-free branch-format field extraction.
 * Format eligibility is independent of project master evidence and manual overrides.
 * Consumers must not treat an AMBIGUOUS or UNMATCHED result as authoritative.
 */

function text(value) { return String(value ?? '').trim(); }
function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

function legacyFormat(config) {
  const line = record(config.linelist);
  const rating = record(config.rating);
  const weight = record(config.weight);
  const hasStandaloneRules = ['lineKey', 'pipingClass', 'bore'].some((key) => key in config)
    || ['regex', 'group', 'tokenPosition'].some((key) => key in rating);
  if (hasStandaloneRules) {
    return {
      tokenDelimiter: text(config.tokenDelimiter) || '-',
      lineKeyJoiner: String(config.lineKeyJoiner ?? ''),
      lineKey: record(config.lineKey),
      pipingClass: record(config.pipingClass),
      rating: record(config.rating),
      bore: record(config.bore),
    };
  }
  if (!Object.keys(line).length && !Object.keys(rating).length && !Object.keys(weight).length) return null;
  return {
    tokenDelimiter: text(line.tokenDelimiter || rating.tokenDelimiter || weight.tokenDelimiter) || '-',
    lineKeyJoiner: String(line.lineKeyJoiner ?? ''),
    lineKey: {
      regex: line.branchNameRegex,
      group: line.lineNoGroup,
      tokenPosition: line.lineKeyTokenPositions || 4,
    },
    pipingClass: {
      regex: rating.pipingClassRegex,
      group: rating.pipingClassGroup,
      tokenPosition: rating.pipingClassTokenIndex || 5,
    },
    rating: { regex: rating.ratingRegex, group: rating.ratingGroup, tokenPosition: rating.ratingTokenIndex },
    bore: { regex: weight.boreRegex, group: weight.boreGroup, tokenPosition: weight.boreTokenIndex || 3 },
  };
}

function rulesFrom(config) {
  const root = record(config);
  const nested = record(root.regexTester);
  if (Array.isArray(nested.formats)) {
    return { formats: nested.formats, ratingSequence: nested.ratingSequence || root.rating?.ratingSequence, legacy: false, origin: 'regexTester.formats' };
  }
  if (Array.isArray(root.formats)) {
    return { formats: root.formats, ratingSequence: root.ratingSequence || root.rating?.ratingSequence, legacy: false, origin: 'formats' };
  }
  const legacy = legacyFormat(nested) || legacyFormat(root);
  return {
    formats: legacy ? [legacy] : [],
    ratingSequence: nested.ratingSequence || root.ratingSequence || root.rating?.ratingSequence,
    legacy: true,
    origin: 'legacy-single-format',
  };
}

function tokenField(source, rule, delimiter, joiner) {
  const positions = text(rule.tokenPosition).split(/[,+]/).map((part) => Number(part.trim()));
  if (!positions.length || positions.some((pos) => !Number.isSafeInteger(pos) || pos < 1)) {
    return { value: '', method: 'NONE', reason: 'NO_VALID_TOKEN_POSITION' };
  }
  const tokens = source.replace(/^\/+/, '').replace(/\/B\d+$/i, '')
    .split(delimiter || '-').map((part) => part.trim());
  const values = positions.map((pos) => tokens[pos - 1] || '');
  if (values.some((value) => !value)) return { value: '', method: 'TOKEN', reason: 'TOKEN_MISSING' };
  return { value: values.join(joiner), method: 'TOKEN', reason: '' };
}

function extractField(source, ruleInput, delimiter, joiner, legacy) {
  const rule = record(ruleInput);
  // Explicit click-to-map wins without destroying an authored regex.
  // Missing mode keeps legacy regex-first precedence.
  const mode = text(rule.extractMode).toUpperCase();
  if (mode === 'TOKEN') return tokenField(source, rule, delimiter, joiner);
  if (mode && mode !== 'REGEX') return { value: '', method: 'NONE', reason: 'INVALID_EXTRACTION_MODE' };
  const pattern = text(rule.regex);
  if (mode === 'REGEX' && !pattern) return { value: '', method: 'REGEX', reason: 'REGEX_REQUIRED' };
  if (pattern) {
    try {
      const found = new RegExp(pattern).exec(source);
      const group = Number(rule.group ?? 1);
      const value = found && Number.isSafeInteger(group) && group >= 0 ? text(found[group]) : '';
      if (value) return { value, method: 'REGEX', reason: '' };
      if (!legacy && rule.fallbackOnRegexMiss !== true) {
        return { value: '', method: 'REGEX', reason: 'REGEX_NO_MATCH_OR_CAPTURE' };
      }
    } catch {
      return { value: '', method: 'REGEX', reason: 'INVALID_REGEX' };
    }
  }
  return tokenField(source, rule, delimiter, joiner);
}

function ratingFromClass(pipingClass, sequence) {
  const value = text(pipingClass).toUpperCase();
  for (const pair of Array.isArray(sequence) ? sequence : []) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const prefix = text(pair[0]).toUpperCase();
    if (prefix && value.startsWith(prefix)) return text(pair[1]);
  }
  return '';
}


function unusedAlternativeTemplate(format, index) {
  if (index === 0 || format.enabled === true) return false;
  if (format.enabled === false) return true;
  // Historical workbench state persists an untouched alternative editor slot
  // with all four initial positional hints. This is not an engineered Format 2.
  const positions = { lineKey: 3, pipingClass: 4, rating: 4, bore: 2 };
  return Object.keys(positions).every((key) => {
    const rule = record(format[key]);
    return !text(rule.regex) && !text(rule.extractMode) && Number(rule.group ?? 1) === 1
      && Number(rule.tokenPosition) === positions[key]
      && rule.fallbackOnRegexMiss !== true;
  }) && (text(format.tokenDelimiter) || '-') === '-'
    && !text(format.lineKeyJoiner);
}

/** Explicit participation wins; legacy configured formats retain their behavior. */
export function isBranchFormatEnabled(formatInput, index = 0) {
  const format = record(formatInput);
  return format.enabled !== false && !unusedAlternativeTemplate(format, index);
}

function evaluate(source, formatInput, index, sequence, legacy) {
  if (!isBranchFormatEnabled(formatInput, index)) {
    return { formatIndex: index, status: 'REJECTED', lineKey: '', pipingClass: '',
      rating: '', bore: '', fieldMethods: {}, reasons: { format:
        record(formatInput).enabled === false ? 'FORMAT_DISABLED' : 'UNCONFIGURED_ALTERNATIVE' } };
  }
  const format = record(formatInput);
  const delimiter = text(format.tokenDelimiter) || '-';
  const line = extractField(source, format.lineKey, delimiter, String(format.lineKeyJoiner ?? ''), legacy);
  const piping = extractField(source, format.pipingClass, delimiter, '', legacy);
  const rating = extractField(source, format.rating, delimiter, '', legacy);
  const bore = extractField(source, format.bore, delimiter, '', legacy);
  const isComplete = !!line.value && !!piping.value;
  return {
    formatIndex: index,
    status: isComplete ? 'MATCHED' : 'REJECTED',
    lineKey: line.value,
    pipingClass: piping.value,
    rating: ratingFromClass(piping.value, sequence) || (rating.value.match(/\d+/)?.[0] || ''),
    bore: bore.value.replace(/[^0-9.]/g, ''),
    fieldMethods: { lineKey: line.method, pipingClass: piping.method, rating: rating.method, bore: bore.method },
    reasons: Object.fromEntries(
      [['lineKey', line], ['pipingClass', piping]]
        .filter(([, field]) => field.reason)
        .map(([key, field]) => [key, field.reason]),
    ),
  };
}

// Only source identity can create a two-format conflict. Rating and bore
// are optional enrichment outputs and must never reject a valid identity.
const FIELDS = ['lineKey', 'pipingClass'];
function unresolved(status, candidates, origin) {
  return {
    status,
    lineKey: '',
    pipingClass: '',
    rating: '',
    bore: '',
    matchedFormatIndex: null,
    agreeingFormatIndices: [],
    candidates,
    origin,
  };
}

/**
 * @returns MATCHED with resolved fields, or UNMATCHED/AMBIGUOUS with no authoritative fields.
 * An explicit formats array is authoritative even if empty. No implicit second format is created.
 */
export function extractBranchFieldsWithFormats(branchName, config = {}) {
  const source = text(branchName);
  const { formats, ratingSequence, legacy, origin } = rulesFrom(config);
  const candidates = source
    ? formats.map((format, index) => evaluate(source, format, index, ratingSequence, legacy))
    : [];
  const matched = candidates.filter((candidate) => candidate.status === 'MATCHED');
  if (!matched.length) return unresolved('UNMATCHED', candidates, origin);

  const chosen = matched[0];
  const agree = matched.every((candidate) => FIELDS.every((field) => candidate[field] === chosen[field]));
  if (!agree) return unresolved('AMBIGUOUS', candidates, origin);
  return {
    status: 'MATCHED',
    lineKey: chosen.lineKey,
    pipingClass: chosen.pipingClass,
    // Optional enrichment disagreement is not an identity conflict; leave
    // that field unset rather than choosing arbitrary Format 1/2 authority.
    rating: matched.every(candidate => candidate.rating === chosen.rating) ? chosen.rating : '',
    bore: matched.every(candidate => candidate.bore === chosen.bore) ? chosen.bore : '',
    matchedFormatIndex: chosen.formatIndex,
    agreeingFormatIndices: matched.map((candidate) => candidate.formatIndex),
    candidates,
    origin,
  };
}
