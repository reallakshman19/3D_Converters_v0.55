/**
 * Read-only native-owner preflight for a completed XML229 Final packet.
 *
 * Suggestions are advisory during Preview and Weight Match. Once a governed
 * Final packet requests release of ALL its accepted masses, an unclassified
 * accepted instrument owner cannot be represented by the current RIGID-only
 * native mass binder. This is an early diagnosis, NEVER CII verification.
 *
 * The native Python binder and independent actual-CII reconciler remain the
 * final authorities for every owner, including non-instrument cases.
 */
const key = (branch, ordinal) => JSON.stringify([branch, ordinal]);

function acceptedOwnerOrdinals(packet) {
  const accepted = new Set();
  for (const component of packet.components) {
    let id;
    try { id = JSON.parse(component?.occurrenceId); }
    catch { continue; }
    if (!Array.isArray(id) || id.length !== 4 ||
        id[0] !== packet.sourceId ||
        !Number.isInteger(id[1]) || id[1] < 0 ||
        !Number.isInteger(id[2]) || id[2] < 0) continue;
    accepted.add(key(id[1], id[2]));
  }
  return accepted;
}

export function inspectXml229NativeOwnerPreflight(packet) {
  const suggestions = packet?.finalizedGeometry?.instrumentModelingSuggestions;
  const ready = packet?.schema === 'XML229.NativeFinalPhysicalPacket.v1' &&
    Array.isArray(packet?.components) && Array.isArray(suggestions) &&
    packet?.finalizedGeometry?.basisId === packet?.basisId &&
    packet?.finalizedGeometry?.sourceXmlSha256 === packet?.sourceXmlSha256;
  if (!ready) return Object.freeze({
    schema: 'XML229.NativeOwnerPreflight.v1',
    status: 'UNAVAILABLE', unsupportedOwners: Object.freeze([]),
  });
  const accepted = acceptedOwnerOrdinals(packet);
  const confirmedZeroInstrumentOwners = [];
  const unsupportedOwners = [];
  const zeroOwners = new Set();
  for (const component of packet.components) {
    if (component?.effectiveKg !== 0) continue;
    let id;
    try { id = JSON.parse(component.occurrenceId); } catch { continue; }
    if (Array.isArray(id) && id[0] === packet.sourceId &&
        Number.isInteger(id[1]) && Number.isInteger(id[2]))
      zeroOwners.add(key(id[1], id[2]));
  }
  for (const row of suggestions) {
    const bi = row?.branchOccurrenceIndex;
    const ordinal = row?.secondSourceNodeOrdinal;
    if (!Number.isInteger(bi) || bi < 0 ||
        !Number.isInteger(ordinal) || ordinal < 0 ||
        !accepted.has(key(bi, ordinal))) continue;
    // The GC-PW source-bound Final service records explicit 0 kg as
    // accepted only after an Owner confirmation. A zero-mass instrument
    // needs no fabricated rigid mass element, but Python must independently
    // prove its actual non-rigid CII element and zero mass.
    if (zeroOwners.has(key(bi, ordinal))) {
      confirmedZeroInstrumentOwners.push(Object.freeze({
        branchOccurrenceIndex: bi, sourceNodeOrdinal: ordinal,
        componentRefNo: String(row.componentRefNo || ''),
        spanMm: row.spanMm, effectiveKg: 0,
      }));
      continue;
    }
    unsupportedOwners.push(Object.freeze({
      branchOccurrenceIndex: bi,
      sourceNodeOrdinal: ordinal,
      componentType: 'INST',
      componentRefNo: String(row.componentRefNo || ''),
      spanMm: row.spanMm,
      reason: 'INSTRUMENT_RIGID_CLASSIFICATION_NOT_IN_SOURCE',
    }));
  }
  return Object.freeze({
    schema: 'XML229.NativeOwnerPreflight.v1',
    status: unsupportedOwners.length ? 'UNSUPPORTED_OWNERS' :
      confirmedZeroInstrumentOwners.length ? 'CONFIRMED_ZERO_INSTRUMENTS' :
      'NO_SUGGESTED_INSTRUMENT_BLOCKERS',
    sourceXmlSha256: packet.sourceXmlSha256,
    basisId: packet.basisId,
    finalIntentSha256: packet.finalIntentSha256,
    physicalCount: packet.physicalCount,
    unsupportedOwners: Object.freeze(unsupportedOwners),
    confirmedZeroInstrumentOwners: Object.freeze(confirmedZeroInstrumentOwners),
  });
}

export function requireXml229NativeOwnerPreflight(packet) {
  const report = inspectXml229NativeOwnerPreflight(packet);
  if (report.unsupportedOwners.length) {
    const error = new Error('NATIVE_RIGID_OWNER_UNSUPPORTED');
    error.code = 'NATIVE_RIGID_OWNER_UNSUPPORTED';
    error.xml229NativeOwnerPreflight = report;
    throw error;
  }
  // An empty advisory is not a verified native result. Continue through the
  // unchanged native binder and independent emitted-CII reconciliation.
  return report;
}
