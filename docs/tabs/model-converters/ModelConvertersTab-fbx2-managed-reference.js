import { installFbxReviewUiAddon } from './fbx-review-ui-addon.js?v=20260804-fbx-multifamily-release-1';
import { installFbxLiveRunnerAddon } from './fbx-live-runner-addon.js?v=20260804-fbx-multifamily-release-1';
import { installFbxMultiFamilyReleaseAddon } from './fbx-multifamily-release-addon.js?v=20260804-fbx-multifamily-release-1';
import { installFbxPreviewZoneSelector } from './fbx-preview-zone-selector.js?v=20260804-fbx-multifamily-release-1-tabperf1';
import { installFbxSelectedZonePreviewBridge } from './fbx-selected-zone-preview-bridge.js?v=20260804-fbx-multifamily-release-1';
import { installFbxZoneGeometryToolbar } from './converters/fbx/zone-geometry/zone-toolbar.js?v=20260804-fbx-multifamily-release-1';

const VERSION = '20260928-rvm-full-scope-core-1';

function installFbxLiveUi(container) {
  installFbxReviewUiAddon();
  installFbxLiveRunnerAddon();
  installFbxMultiFamilyReleaseAddon();
  installFbxPreviewZoneSelector(container);
  installFbxSelectedZonePreviewBridge();
  installFbxZoneGeometryToolbar(container);
  if (container?.dataset) container.dataset.fbxLiveUiVersion = VERSION;
}

async function loadBaseModelConvertersTab() {
  const module = await import('./ModelConvertersTab.js?v=20261008-txt-tree-ux-r5-1');
  if (typeof module?.renderModelConvertersTab !== 'function') {
    throw new Error('Base Model Converters renderer export is missing.');
  }
  return module.renderModelConvertersTab;
}

export function renderModelConvertersTab(container, ctx) {
  installFbxLiveUi(container);
  return loadBaseModelConvertersTab()
    .then((renderBaseModelConvertersTab) => {
      if (container?.dataset.activeTab !== 'model-converters') return null;
      return renderBaseModelConvertersTab(container, ctx);
    });
}
