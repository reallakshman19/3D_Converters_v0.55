/** Keep the established DOM-only enriched-XML SIF step on its real browser DOM. */
import {applyStandaloneSifFacts}
  from '../../tabs/xml-cii-2019-standalone/xml-cii-standalone-sif-apply.js';

export function restoreStandaloneEngineSifResult(result, job) {
  if (job?.sourceKind === 'inputxml' || job?.xml229NativeFinalPacket ||
      job?.options?.outputMode === 'cii-only' || !result?.enrichedText ||
      !Array.isArray(job?.sifFacts) || !job.sifFacts.length) return result;
  const sif = applyStandaloneSifFacts(result.enrichedText, 'xml', job.sifFacts);
  const diagnostics = result.diagnostics ? {...result.diagnostics,
    postprocess: result.diagnostics.postprocess?.map(row =>
      row.branch === 'psi116-enriched-xml' ? {...row, sifDiagnostics: sif.diagnostics} : row),
  } : result.diagnostics;
  return {...result, enrichedText: sif.text, diagnostics};
}
