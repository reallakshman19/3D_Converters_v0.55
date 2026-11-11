import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(repoRoot, 'docs');
const tempDir = path.join(repoRoot, '.pages-docs-build-tmp');
const sourceDocsTemp = path.join(tempDir, 'source-docs');
const manifestPath = path.join(docsDir, '.pages-mirror-manifest.json');

const RUNTIME_ROOT_DIRECTORIES = Object.freeze([
  'assets',
  'canonical',
  'config',
  'contracts',
  'converters',
  'core',
  'data',
  'debug',
  'diagnostics',
  'dist',
  'engineering',
  'interchange',
  'js',
  'lfj',
  'opt',
  'overlays',
  'parser',
  'pcf-builder',
  'pcf-legacy',
  'pcfx',
  'rvm',
  'rvm-pcf-extract',
  'rvm-pcf-master-tabs',
  'rvm-pcf-topology',
  'rvm-viewer',
  'schemas',
  'styles',
  'support',
  'tabs',
  'third_party',
  'topology-5b',
  'uxml',
  'validation',
  'validators',
  'vendor',
  'view',
  'viewer3d',
  'xml-compare',
]);

const RUNTIME_ROOT_FILES = Object.freeze([
  'index.html',
  '.nojekyll',
  'site.webmanifest',
  'main-rhbg-fitguard.js',
  'viewer-3d.js',
  'viewer-3d-config.js',
  'viewer-3d-defaults.js',
  'viewer-actions.js',
  'RvmSourceKindPolicy.js',
]);

const RUNTIME_ENTRY_SET = new Set([
  ...RUNTIME_ROOT_DIRECTORIES,
  ...RUNTIME_ROOT_FILES,
]);

async function pathExists(target) {
  try {
    await readdir(target);
    return true;
  } catch {
    try {
      await readFile(target);
      return true;
    } catch {
      return false;
    }
  }
}

async function readPreviousGeneratedNames() {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
    return new Set(parsed.generatedTopLevelEntries || []);
  } catch {
    return new Set();
  }
}

function isProductionRuntimeFile(sourcePath) {
  const baseName = path.basename(sourcePath);
  if (baseName.startsWith('.git') && baseName !== '.nojekyll') return false;
  if (baseName === '.DS_Store' || baseName === 'Thumbs.db') return false;
  if (/\.bak($|[._])/i.test(baseName)) return false;
  if (/\.before($|[._])/i.test(baseName)) return false;
  return true;
}

await rm(tempDir, { recursive: true, force: true });
await mkdir(sourceDocsTemp, { recursive: true });

const previousGenerated = await readPreviousGeneratedNames();
const docsEntries = await readdir(docsDir, { withFileTypes: true });

// Preserve hand-maintained docs, not the generated mirror or runtime entries.
const sourceDocNames = docsEntries
  .map(entry => entry.name)
  .filter(name =>
    name !== 'docs' &&
    name !== '.pages-mirror-manifest.json' &&
    !RUNTIME_ENTRY_SET.has(name) &&
    !previousGenerated.has(name)
  );

for (const name of sourceDocNames) {
  await cp(
    path.join(docsDir, name),
    path.join(sourceDocsTemp, name),
    { recursive: true, force: true, preserveTimestamps: true }
  );
}

const targetEntries = [...RUNTIME_ROOT_FILES, ...RUNTIME_ROOT_DIRECTORIES].sort();
const collisions = targetEntries.filter(name => sourceDocNames.includes(name));
if (collisions.length) {
  throw new Error(
    'Refusing to overwrite hand-maintained docs that collide with root deployment entries: ' +
    collisions.join(', ')
  );
}

// Remove previous generated entries and existing runtime entries while leaving hand-maintained docs intact.
const entriesToRemove = new Set([
  ...previousGenerated,
  ...RUNTIME_ENTRY_SET,
]);
for (const name of entriesToRemove) {
  await rm(path.join(docsDir, name), { recursive: true, force: true });
}
await rm(path.join(docsDir, 'docs'), { recursive: true, force: true });
await rm(manifestPath, { force: true });

// Copy runtime root files
const copiedRootFiles = [];
for (const name of RUNTIME_ROOT_FILES) {
  const source = path.join(repoRoot, name);
  const target = path.join(docsDir, name);
  if (!(await pathExists(source))) continue;
  await cp(source, target, {
    force: true,
    preserveTimestamps: true,
  });
  copiedRootFiles.push(name);
}

// Ensure .nojekyll is present in docsDir
const docsNoJekyll = path.join(docsDir, '.nojekyll');
if (!(await pathExists(docsNoJekyll))) {
  await writeFile(docsNoJekyll, '', 'utf8');
  if (!copiedRootFiles.includes('.nojekyll')) copiedRootFiles.push('.nojekyll');
}

// Copy runtime root directories with production filter
const copiedRootDirectories = [];
for (const name of RUNTIME_ROOT_DIRECTORIES) {
  const source = path.join(repoRoot, name);
  const target = path.join(docsDir, name);
  if (!(await pathExists(source))) continue;
  await cp(source, target, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
    filter: (src) => isProductionRuntimeFile(src),
  });
  copiedRootDirectories.push(name);
}

// Runtime code historically fetches "docs/..." URLs. Under a /docs Pages source,
// those URLs map to repository docs/docs/..., so retain a nested copy of source docs.
await mkdir(path.join(docsDir, 'docs'), { recursive: true });
for (const name of sourceDocNames) {
  await cp(
    path.join(sourceDocsTemp, name),
    path.join(docsDir, 'docs', name),
    { recursive: true, force: true, preserveTimestamps: true }
  );
}

const manifest = {
  schema: 'GithubPagesDocsRuntimeManifest.v2',
  runtimeRootFiles: copiedRootFiles.sort(),
  runtimeRootDirectories: copiedRootDirectories.sort(),
  generatedTopLevelEntries: [...copiedRootFiles, ...copiedRootDirectories].sort(),
  nestedDocsSourceEntries: sourceDocNames.sort(),
  source: 'strict production runtime manifest mirrored into docs/ for branch-based GitHub Pages',
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

await rm(tempDir, { recursive: true, force: true });
console.log(`GitHub Pages runtime mirror ready in docs/ (${copiedRootFiles.length} root files, ${copiedRootDirectories.length} root directories, ${sourceDocNames.length} source-doc entries).`);
