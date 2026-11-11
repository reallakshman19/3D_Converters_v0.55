/**
 * XML229: one fail-closed blank-only fill decision for BOTH Weight Match UIs.
 * This does not alter ranking, source custody or final/Match-2 release authority.
 */
const STORED_BUCKETS = Object.freeze([
  'rigidWeightFinal',
  'rigidWeightMatch1',
  'rigidWeight',
  'rigidWeightProposalMeta',
  'rigidWeightMatch1Provenance',
]);
const text = value => value == null ? '' : String(value).trim();
const present = value => value != null && text(value) !== '';
const positive = value => {
  if (!present(value)) return null;
  const v = Number(value);
  return Number.isFinite(v) && v > 0 ? v : null;
};
const plain = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
function recorded(issue, config) {
  const key = text(issue?.key);
  if (!key) return true;
  const overrides = plain(config?.overrides);
  // Presence, rather than equality to the ranked suggestion, is the protection:
  // existing decisions (including an outdated/stale Match-1) need human review.
  return STORED_BUCKETS.some(bucket => {
    const entries = plain(overrides[bucket]);
    return Object.hasOwn(entries, key) && entries[key] != null && text(entries[key]) !== '';
  });
}

/**
 * Accept only a genuinely blank input row with no source/stored authority.
 * A DOM "proposed" value is NOT an accepted weight; the renderer must make
 * unapproved suggestions visible as chips, never as pre-filled Weight(kg).
 */
export function selectXmlCiiBlankWeightSuggestion({ input, issue, config } = {}) {
  if (!input || !issue || !text(issue.key)) return null;
  if (text(input.value)) return null; // EVEN if it equals the suggestion!
  if (input.dataset?.wmAccepted === 'true') return null;
  if (issue.mapped || issue.staleMatch1 || positive(issue.weight) != null) return null;
  if (recorded(issue, config)) return null;
  const candidates = Array.isArray(issue.candidates) ? issue.candidates : [];
  for (const candidate of candidates) {
    if (!candidate || candidate.zeroFallback || candidate.rejectedReason || candidate.oddEntry) continue;
    const weight = positive(candidate.selectedWeight ?? candidate.suggestedWeight ?? candidate.weight);
    if (weight != null) return { candidate, weight };
  }
  return null;
}
