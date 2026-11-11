import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnergyInstituteEit } from '../converters/vibration/eit/parse.js';
import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';

function usage() {
  return 'Usage: node scripts/inspect-vibration-eit-roadmap.mjs <project.eit> [rid]';
}

function compactProjection(projection) {
  return {
    schema: projection.schema,
    context: projection.context,
    authority: projection.authority,
    phases: projection.phases.map((phase) => ({
      id: phase.id,
      nodes: phase.nodes.map((node) => ({
        id: node.id,
        mechanismId: node.mechanismId ?? null,
        scope: node.scope,
        specialty: node.specialty,
        status: node.status,
        detail: node.detail,
        target: node.target,
      })),
    })),
  };
}

async function main(argv) {
  const fileName = argv[2];
  if (!fileName) throw new Error(usage());
  const rid = argv[3] ?? null;
  const text = await fs.readFile(fileName, 'utf8');
  const imported = parseEnergyInstituteEit(text, { sourceName: path.basename(fileName) });
  const projection = buildVibrationRoadmapProjection({
    eitImport: imported,
    context: rid == null ? {} : { eitRid: rid },
  });
  process.stdout.write(`${JSON.stringify({
    import: {
      schema: imported.schema,
      sourceName: imported.sourceName,
      lineCount: imported.lines.length,
      moduleSummary: imported.moduleSummary,
      authority: imported.authority,
    },
    roadmap: compactProjection(projection),
  }, null, 2)}\n`);
}

main(process.argv).catch((error) => {
  process.stderr.write(`${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}\n`);
  process.exitCode = 1;
});
