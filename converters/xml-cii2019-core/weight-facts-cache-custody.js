// SHA-256 custody for the legacy Weight Match display cache; no DOM, storage or XML parser.
const SHA256 = /^[a-f0-9]{64}$/i;
async function sha256Text(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof text !== 'string') return null;
  const bytes = new TextEncoder().encode(text);
  const buffer = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function weightMatchContentFingerprint({
  xmlText, stagedJsonText, masterRows = null, masterRef = null,
  config, ratingMode, snapshot,
} = {}) {
  // A missing full worker dataset+mapping digest is NOT a cache hit.
  // Legacy master row arrays are hashed after mapping, using the actual scoring corpus.
  try {
    if (typeof xmlText !== 'string' || typeof stagedJsonText !== 'string') return null;
    let masterSha;
    let mappingSha;
    if (Array.isArray(masterRows)) {
      masterSha = await sha256Text(JSON.stringify(masterRows));
      mappingSha = 'mapped-master-row-values/v1';
    } else {
      masterSha = masterRef?.sha256;
      mappingSha = masterRef?.mappingSha256;
      if (!SHA256.test(mappingSha || '')) return null;
    }
    if (!SHA256.test(masterSha || '')) return null;
    const xmlSha = await sha256Text(xmlText);
    const stagedSha = await sha256Text(stagedJsonText);
    const configSha = await sha256Text(JSON.stringify({ config, ratingMode, snapshot,
      masterDatasetId: masterRef?.datasetId || null, masterRevision: masterRef?.revision ?? null }));
    if (![xmlSha, stagedSha, configSha].every(s => SHA256.test(s || ''))) return null;
    return 'gc-pw-wm-sha256/1:' + await sha256Text(JSON.stringify({
      xmlSha, stagedSha, configSha, masterSha, mappingSha,
    }));
  } catch {
    // Failure to establish cryptographic custody disables cache, never computation.
    return null;
  }
}
