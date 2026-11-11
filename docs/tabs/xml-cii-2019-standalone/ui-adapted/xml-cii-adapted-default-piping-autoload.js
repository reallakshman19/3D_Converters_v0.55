import {
  DEFAULT_PIPING_CLASS_MASTER_URLS,
  loadXmlCiiMasterRows,
} from '../../../converters/xml-cii2019-core/master-context.js';
import { buildPipingClassIndex } from '../../../converters/xml-cii2019-core/piping-class-resolver.js';
import { updateWorkflowState } from './xml-cii-adapted-state.js?v=20261001-weight-output-2';

function obj(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function rowCount(value) { return Array.isArray(value) ? value.length : 0; }
function supportConfig(state) {
  try { return obj(JSON.parse(String(state?.supportConfigJson || '{}'))); }
  catch { return null; }
}
function isAppliedMaster(state) {
  const context=obj(state?.masterContext);
  const config=supportConfig(state);
  if (!config) return true; // Bad config is NOT an invitation to override it.
  const p=obj(config.pipingClass);
  const m=obj(context.sourceMetadata?.pipingClass);
  // Do not hide failures of a stored dataset by silently replacing its authority.
  if (state?.masterRestoreFailures?.pipingClass || state?.masterPersistenceFailures?.pipingClass) return true;
  if (context.datasetRefs?.pipingClass?.datasetId) return true;
  if (rowCount(context.pipingClassRows)>0 || rowCount(p.masterRows)>0) return true;
  if (Number(context.rowCounts?.pipingClass)>0) return true;
  if (m.sourceType && !['empty','not-loaded','autoload-unavailable'].includes(m.sourceType)) return true;
  return false;
}

export function shouldAutoHydratePipingClass(state) {
  return !state?.importMastersLoading && !isAppliedMaster(state);
}

/**
 * Cold-start only. Works after IndexedDB restoration; never replaces a
 * manual/uploaded or authenticated persisted dataset. No storage writes.
 * Returns whether the active state was truly given physical rows.
 */
export async function hydrateDefaultPipingClassMaster(stateRef, options = {}) {
  if (!stateRef?.current || !shouldAutoHydratePipingClass(stateRef.current)) return false;
  const startingConfig=stateRef.current.supportConfigJson;
  const startingState=stateRef.current;
  const config=supportConfig(startingState);
  if (!config) return false;
  const section={...obj(config.pipingClass)};
  const diagnostics=[];
  const loadRows=options.loadRows || (()=>loadXmlCiiMasterRows(
    section,DEFAULT_PIPING_CLASS_MASTER_URLS,'piping-class',diagnostics,
  ));
  let rows;
  try {
    rows=await loadRows();
  } catch(error) {
    if (stateRef.current===startingState && options.throwOnError) throw error;
    return false;
  }
  // An import/configuration change during the fetch has priority over autoload.
  if (stateRef.current.supportConfigJson!==startingConfig ||
      !shouldAutoHydratePipingClass(stateRef.current)) return false;
  if (!Array.isArray(rows) || rows.length===0 ||
      rows.some(r=>!r || typeof r!=='object' || !String(r['Piping Class']??r.pipingClass??'').trim())) return false;
  const latest=stateRef.current;
  const old=obj(latest.masterContext);
  const previousConfig=obj(old.config);
  const source=String(diagnostics.find(d=>d.type==='piping-class-master-source')?.source ||
    section.masterUrl || DEFAULT_PIPING_CLASS_MASTER_URLS[0]);
  const filename=source.split('/').pop() || 'Piping Class';
  const context={
    ...old,
    config:{...previousConfig,pipingClass:{...obj(previousConfig.pipingClass),...section}},
    pipingClassRows:rows,
    pipingClassIndex:buildPipingClassIndex(rows,obj(section.fieldMap)),
    rowCounts:{...obj(old.rowCounts),pipingClass:rows.length},
    previewRows:{...obj(old.previewRows),pipingClass:rows.slice(0,150)},
    rawRows:{...obj(old.rawRows),pipingClass:rows},
    sourceMetadata:{...obj(old.sourceMetadata),pipingClass:{
      key:'pipingClass',source,sourceType:'autoload',status:'loaded',rowCount:rows.length,
    }},
    diagnostics:[...(Array.isArray(old.diagnostics)?old.diagnostics:[]),...diagnostics],
    diagnosticsByMaster:{...obj(old.diagnosticsByMaster),pipingClass:diagnostics},
  };
  const exactDefault=rows.length===10699 && filename==='Piping_class_master.json';
  const status=exactDefault
    ? '✅ Loaded: Piping_class_master.json (10699 usable rows)'
    : `Loaded: ${filename} (${rows.length} usable rows) — automatic master`;
  stateRef.current=updateWorkflowState(latest,{
    masterContext:context,
    importMastersWriteBackStatus:status,
  });
  return true;
}
