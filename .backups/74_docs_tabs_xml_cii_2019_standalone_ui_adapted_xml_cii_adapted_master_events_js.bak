import { bindMasterWorkerImportEvents } from './xml-cii-adapted-master-worker-events.js';
import { bindMasterMappingEvents } from './xml-cii-adapted-master-mapping-events.js';

export {
  autoMapStandaloneMasterFields,
  clearMasterContextFromUi,
  importMasterRows,
  loadImportMastersFromUi,
  mapRowsWithFieldMap,
  updateMasterFieldMap,
} from './xml-cii-adapted-master-mapping-events.js';

export function bindImportMastersEvents(container, stateRef, render) {
  bindMasterWorkerImportEvents(container, stateRef, render);
  bindMasterMappingEvents(container, stateRef, render);
}
