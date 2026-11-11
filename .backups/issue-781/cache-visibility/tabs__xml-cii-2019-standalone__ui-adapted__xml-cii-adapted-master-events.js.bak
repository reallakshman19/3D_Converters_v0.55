import { bindMasterWorkerImportEvents } from './xml-cii-adapted-master-worker-events.js?v=20260929-pr780-bounded-ui-1';
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
