# Work Report: GitHub Pages Strict Production Runtime Manifest

IDENTITY: `WIP-PAGES-STRICT-MANIFEST-20260928`
BRANCH: `wip-pages-strict-manifest`
BASE_COMMIT: `e167bfddbeb5067c0b43bf5861c9767b54b34e97`
AUTHORITY: `DEPLOYMENT_PACKAGING_PRESENTATION_ONLY`
CRITICALITY: `STANDARD`

## 1. Mission & Scope
Refine `scripts/build-github-pages-docs.mjs` to transition from an unconstrained root mirror to an explicit, strict production runtime whitelist for the `docs/` deployment directory.
Ensure that internal developer assets, agent reports/prompts (`agents/`, `.agents/`), backup archives (`system_logs_backup.zip`, `.backups/`), benchmark datasets (`Benchmarks/`), test suites (`tests/`), tools, and intermediate files (`*.bak*`, `*.before*`) are excluded from the public `/docs` GitHub Pages surface, while strictly preserving all necessary runtime modules, assets, configs, schemas, vendor libraries (Pyodide, Three.js), and hand-maintained master documentation (`docs/Masters/...`).

## 2. Invariants & Authority Boundaries
- No changes to engineering calculation kernels, master data, formulas, or conversion algorithms.
- Purely deployment packaging and distribution hygiene.
- Hand-maintained documentation and master files (`Masters/`, etc.) originally in `docs/` must remain preserved at both `docs/Masters/` and nested `docs/docs/Masters/` for runtime URL compatibility.
- GitHub Pages Jekyll bypass (`.nojekyll`) must be guaranteed.

## 3. Implementation Details
Modified `scripts/build-github-pages-docs.mjs`:
- Defined `RUNTIME_ROOT_DIRECTORIES` whitelist (37 directories including `converters`, `core`, `engineering`, `tabs`, `vendor`, `styles`, `assets`, etc.).
- Defined `RUNTIME_ROOT_FILES` whitelist (`index.html`, `.nojekyll`, `site.webmanifest`, `main-rhbg-fitguard.js`, `viewer-3d.js`, `viewer-3d-config.js`, `viewer-3d-defaults.js`, `viewer-actions.js`, `RvmSourceKindPolicy.js`).
- Implemented file copy filter `isProductionRuntimeFile` to exclude `.bak*`, `.before*`, `.DS_Store`, and `Thumbs.db` files.
- Automated cleanup of obsolete/unlisted mirrored entries on rebuild.
- Maintained idempotent manifest generation at `docs/.pages-mirror-manifest.json` under schema `GithubPagesDocsRuntimeManifest.v2`.

## 4. Validation
- `node scripts/build-github-pages-docs.mjs`: PASS (exited with code 0).
- Idempotency rerun: PASS (exited with code 0).
- Size reduction: `docs/` reduced from ~248 MB to ~83.6 MB (a reduction of ~164 MB, eliminating 2,885 unneeded files including two ~105 MB backup zip archives).
- Sensitive/Internal directories pruned from `/docs`: `.agents/`, `.backups/`, `.claude/`, `agents/`, `Benchmarks/`, `tests/`, `tools/`, `utils/`, `ValidationRecords/`.
- Runtime entry points verified present in `docs/`: `index.html`, `.nojekyll`, `main-rhbg-fitguard.js`, `site.webmanifest`, `docs/docs/Masters/`.

## 5. Changed Files Ledger
- `scripts/build-github-pages-docs.mjs` (modified: strict manifest whitelist and production filtering)
- `docs/.pages-mirror-manifest.json` (modified: updated to `GithubPagesDocsRuntimeManifest.v2`)
- `docs/` (2,885 non-production files removed)
- `agents/WIP-PAGES-STRICT-MANIFEST-20260928_workreport.md` (created: this work report)

## 6. Risks & Mitigations
- **Risk**: Missing runtime file breaks an obscure converter tab.
  - **Mitigation**: All 37 application directories (`converters/`, `engineering/`, `tabs/`, `vendor/`, `schemas/`, `core/`, `diagnostics/`, `debug/`, etc.) and all referenced root JS files are explicitly included in the whitelist. Only developer-only directories (`tests/`, `tools/`, `utils/`, `Benchmarks/`, `agents/`, `.agents/`, `.backups/`, `ValidationRecords/`) were excluded.

## 7. Delivery & Push Confirmation
- Feature branch `wip-pages-strict-manifest` pushed to remote.
- `main` branch fast-forwarded to `a72ef84a` and pushed to `origin/main`.
- Live GitHub Pages site at `https://reallaksh19.github.io/3D_Converters/` active and verified.
- Status: `COMPLETED`.

