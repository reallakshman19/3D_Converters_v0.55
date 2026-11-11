// XML→CII bore authority
// -----------------------
// One narrow resolver for node/component nominal bore. Source XML geometry
// always outranks staged/component evidence; Branchname size is a fallback
// only. When that fallback is used, callers may supply DTXR/JSON-trace bore
// evidence so a disagreement is surfaced instead of silently accepted.

const DEFAULT_NPS_TO_DN = {
  '0.25': 8,
  '0.375': 10,
  '0.5': 15,
  '0.75': 20,
  '1': 25,
  '1.25': 32,
  '1.5': 40,
  '2': 50,
  '2.5': 65,
  '3': 80,
  '4': 100,
  '5': 125,
  '6': 150,
  '8': 200,
  '10': 250,
  '12': 300,
  '14': 350,
  '16': 400,
  '18': 450,
  '20': 500,
  '24': 600,
  '28': 700,
  '30': 750,
};

const OD_TO_DN = [
  [10.3, 6], [13.7, 8], [17.1, 10], [21.3, 15], [26.7, 20],
  [33.4, 25], [42.2, 32], [48.3, 40], [60.3, 50], [73.0, 65],
  [88.9, 80], [114.3, 100], [141.3, 125], [168.3, 150],
  [219.1, 200], [273.0, 250], [273.1, 250], [323.8, 300],
  [323.9, 300], [355.6, 350], [406.4, 400], [457.0, 450],
  [457.2, 450], [508.0, 500], [609.6, 600], [610.0, 600],
  [711.0, 700], [762.0, 750],
];

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function positiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const match = text(value).replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/);
  const numeric = match ? Number(match[0]) : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function npsToDn(inches, config = {}) {
  const numeric = positiveNumber(inches);
  if (numeric === null) return null;
  const map = config?.weight?.npsToDn || DEFAULT_NPS_TO_DN;
  const mapped = Number(
    map[String(Number(numeric))]
    ?? map[numeric]
    ?? map[Number(numeric).toFixed(3)],
  );
  if (Number.isFinite(mapped) && mapped > 0) return mapped;
  const inchToMm = Number(config?.weight?.inchToMm ?? 25.4);
  return Number.isFinite(inchToMm) && inchToMm > 0 ? numeric * inchToMm : null;
}

export function xmlCiiNominalDnFromOd(odMm) {
  const numeric = positiveNumber(odMm);
  if (numeric === null) return null;
  let best = null;
  for (const [od, dn] of OD_TO_DN) {
    const err = Math.abs(numeric - od);
    if (!best || err < best.err) best = { od, dn, err };
  }
  return best && best.err <= Math.max(1.5, Math.abs(best.od) * 0.006)
    ? best.dn
    : null;
}

function configuredBranchRegex(branchName, config = {}) {
  const pattern = text(config?.weight?.boreRegex);
  if (!pattern) return null;
  try {
    const match = new RegExp(pattern, 'i').exec(text(branchName));
    if (!match) return null;
    const group = Math.max(0, Number(config?.weight?.boreGroup || 1));
    return positiveNumber(match[group]);
  } catch {
    return null;
  }
}

export function xmlCiiBranchNameBoreMm(branchName, config = {}) {
  const configured = configuredBranchRegex(branchName, config);
  if (configured !== null) return npsToDn(configured, config);

  const quoted = text(branchName).match(/-(\d+(?:\.\d+)?)\s*"(?=-)/i);
  if (quoted) return npsToDn(quoted[1], config);

  const explicitNps = text(branchName).match(/(?:^|[-_\s])NPS\s*(\d+(?:\.\d+)?)(?=$|[-_\s])/i);
  if (explicitNps) return npsToDn(explicitNps[1], config);

  return null;
}

export function xmlCiiDtxrValidationBoreMm(value, config = {}) {
  const raw = text(value);
  if (!raw) return null;

  const dn = raw.match(/\bDN\s*[:=\-]?\s*(\d+(?:\.\d+)?)\b/i);
  if (dn) return positiveNumber(dn[1]);

  const nps = raw.match(/\bNPS\s*[:=\-]?\s*(\d+(?:\.\d+)?)\b/i);
  if (nps) return npsToDn(nps[1], config);

  const inch = raw.match(/\b(\d+(?:\.\d+)?)\s*(?:"|IN(?:CH(?:ES)?)?)\b/i);
  if (inch) return npsToDn(inch[1], config);

  return null;
}

function sameNominalBore(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return true;
  return Math.abs(left - right) <= Math.max(1, Math.max(Math.abs(left), Math.abs(right)) * 0.01);
}

export function resolveXmlCiiBoreAuthority({
  xmlOutsideDiameterMm = null,
  xmlBoreMm = null,
  stagedBoreMm = null,
  branchName = '',
  fallbackBoreMm = null,
  validationTraceBoreMm = null,
  validationTraceText = '',
  validationTraceStatus = '',
  validationTraceSource = '',
  config = {},
} = {}) {
  const sourceOdBore = xmlCiiNominalDnFromOd(xmlOutsideDiameterMm);
  const sourceBore = positiveNumber(xmlBoreMm);
  const stagedBore = positiveNumber(stagedBoreMm);
  const branchFallback = xmlCiiBranchNameBoreMm(branchName, config);
  const genericFallback = positiveNumber(fallbackBoreMm);

  let boreMm = null;
  let source = 'unresolved';
  let fallbackUsed = false;

  if (sourceOdBore !== null) {
    boreMm = sourceOdBore;
    source = 'xml-outside-diameter';
  } else if (sourceBore !== null) {
    boreMm = sourceBore;
    source = 'xml-bore';
  } else if (stagedBore !== null) {
    boreMm = stagedBore;
    source = 'staged-component';
  } else if (branchFallback !== null) {
    boreMm = branchFallback;
    source = 'branch-name-fallback';
    fallbackUsed = true;
  } else if (genericFallback !== null) {
    boreMm = genericFallback;
    source = 'fallback-bore';
    fallbackUsed = true;
  }

  const directValidation = positiveNumber(validationTraceBoreMm);
  const rawTraceStatus = text(validationTraceStatus).toUpperCase();
  const explicitTraceStatus = Boolean(rawTraceStatus);
  const traceStatusResolved = rawTraceStatus.startsWith('RESOLVED_');
  const traceStatusAmbiguous = rawTraceStatus.includes('AMBIGUOUS');
  const traceStatusUnresolved = rawTraceStatus === 'UNRESOLVED';
  const parsedValidation = (
    directValidation === null
    && (!explicitTraceStatus || traceStatusResolved)
  )
    ? xmlCiiDtxrValidationBoreMm(validationTraceText, config)
    : null;
  const traceBoreMm = directValidation ?? parsedValidation;
  const traceStatus = rawTraceStatus || (traceBoreMm !== null ? 'RESOLVED_LEGACY' : '');
  const traceMismatch = Boolean(
    fallbackUsed
    && !traceStatusAmbiguous
    && !traceStatusUnresolved
    && boreMm !== null
    && traceBoreMm !== null
    && !sameNominalBore(Number(boreMm), Number(traceBoreMm)),
  );
  const traceMissingBore = Boolean(
    fallbackUsed
    && traceStatusResolved
    && traceBoreMm === null,
  );
  const traceNeedsReview = Boolean(
    fallbackUsed
    && (traceMismatch || traceStatusAmbiguous || traceStatusUnresolved || traceMissingBore),
  );

  let diagnostic = null;
  if (fallbackUsed && traceStatusAmbiguous) {
    diagnostic = {
      type: 'bore-fallback-trace-ambiguous',
      branchName: text(branchName),
      fallbackBoreMm: boreMm,
      traceStatus,
      traceSource: text(validationTraceSource),
      message: `Branchname/fallback bore DN${boreMm} could not be validated because Resolver JSON Trace is ambiguous; fallback is review-required.`,
    };
  } else if (fallbackUsed && (traceStatusUnresolved || traceMissingBore)) {
    diagnostic = {
      type: 'bore-fallback-trace-unresolved',
      branchName: text(branchName),
      fallbackBoreMm: boreMm,
      traceStatus,
      traceSource: text(validationTraceSource),
      reason: traceMissingBore ? 'resolved-trace-has-no-bore' : 'trace-unresolved',
      message: `Branchname/fallback bore DN${boreMm} could not be validated by Resolver JSON Trace; fallback is review-required.`,
    };
  } else if (traceMismatch) {
    diagnostic = {
      type: 'bore-fallback-trace-mismatch',
      branchName: text(branchName),
      fallbackBoreMm: boreMm,
      traceBoreMm,
      traceStatus,
      traceSource: text(validationTraceSource),
      message: `Branchname/fallback bore DN${boreMm} conflicts with DTXR/JSON-trace bore DN${traceBoreMm}; fallback is review-required.`,
    };
  }

  return {
    boreMm,
    source,
    fallbackUsed,
    branchFallbackBoreMm: branchFallback,
    validationTraceBoreMm: traceBoreMm,
    validationTraceStatus: traceStatus,
    validationTraceSource: text(validationTraceSource),
    traceMismatch,
    needsReview: traceNeedsReview,
    diagnostic,
  };
}
