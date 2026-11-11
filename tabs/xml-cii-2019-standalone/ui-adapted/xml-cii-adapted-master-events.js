import { bindMasterWorkerImportEvents } from './xml-cii-adapted-master-worker-events.js?v=20261006-c05-5-5-persistence-retry-1';
import { bindMasterMappingEvents } from './xml-cii-adapted-master-mapping-events.js?v=20261001-weight-output-2';

export {
  autoMapStandaloneMasterFields,
  clearMasterContextFromUi,
  importMasterRows,
  loadImportMastersFromUi,
  mapRowsWithFieldMap,
  updateMasterFieldMap,
} from './xml-cii-adapted-master-mapping-events.js?v=20261001-weight-output-2';

export function bindImportMastersEvents(container, stateRef, render) {
  bindMasterWorkerImportEvents(container, stateRef, render);
  bindMasterMappingEvents(container, stateRef, render);
}
