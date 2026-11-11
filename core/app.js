// Standalone app shell runtime delegate.
import { installAppTabClickStateBridge } from './app-tab-click-state-bridge.js?v=standalone-3';
import { installEngineeringTabs } from './engineering-tabs-extension.js?v=20260819-sbc-connection-authoring-1-tabperf1';
import * as runtime from './app-standalone-runtime.js?v=20261001-single-weight-owners-1';

const MODEL_CONVERTERS_MODULE = '../tabs/model-converters-tab.js?v=20261001-single-weight-owners-1';
const XML_CII_STANDALONE_MODULE = '../tabs/xml-cii-2019-standalone-tab.js?v=20261001-single-weight-owners-1';
let destroyEngineeringTabs = null;

function loadLiveModelConverters() {
  return import(MODEL_CONVERTERS_MODULE).then((module) => {
    if (typeof module?.renderModelConvertersTab !== 'function') {
      throw new Error('Live Model Converters renderer export is missing.');
    }
    return module.renderModelConvertersTab;
  });
}

function loadLiveXmlCiiStandalone() {
  return import(XML_CII_STANDALONE_MODULE).then((module) => {
    if (typeof module?.renderXmlCii2019StandaloneTab !== 'function') {
      throw new Error('Live XML→CII Standalone renderer export is missing.');
    }
    return module.renderXmlCii2019StandaloneTab;
  });
}

function installLiveTabLoaders() {
  const modelConverters = runtime.STANDALONE_TABS?.find((tab) => tab.id === 'model-converters');
  const xmlCii = runtime.STANDALONE_TABS?.find((tab) => tab.id === 'xml-cii-2019-standalone');
  if (!modelConverters) throw new Error('Standalone model-converters tab is unavailable.');
  if (!xmlCii) throw new Error('Standalone XML→CII tab is unavailable.');
  modelConverters.load = loadLiveModelConverters;
  xmlCii.load = loadLiveXmlCiiStandalone;
}

installAppTabClickStateBridge();
installLiveTabLoaders();

export async function init(root) {
  await runtime.init(root);
  destroyEngineeringTabs?.();
  destroyEngineeringTabs = installEngineeringTabs(root);
}

export function destroy() {
  destroyEngineeringTabs?.();
  destroyEngineeringTabs = null;
  runtime.destroy();
}

export const __FBX_LIVE_UI_CACHE_KEY__ = '20260804-fbx-multifamily-release-1';
export const __MODEL_CONVERTERS_CACHE_KEY__ = '20260928-rvm-full-scope-core-1';
export const __XML_CII_ISSUE_776_CACHE_KEY__ = '20260928-issue776-authority-2';
export const __XML_CII_ISSUE_781_SCREENSHOT_REPAIR_KEY__ = '20261001-weight-rating-1';
