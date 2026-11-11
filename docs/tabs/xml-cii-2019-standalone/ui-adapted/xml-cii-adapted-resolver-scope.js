import { createElement } from './xml-cii-adapted-dom.js';
import {
  ALL_SCOPE_ID,
  buildJsonHierarchyScopeIndex,
  jsonHierarchyScopeOptions,
} from '../xml-cii-json-hierarchy-scope.js';

function text(value) {
  return String(value ?? '');
}

function sourceKey(value) {
  const source = text(value);
  const length = source.length;
  const middle = Math.floor(length / 2);
  return [
    length,
    source.slice(0, 96),
    source.slice(Math.max(0, middle - 48), middle + 48),
    source.slice(Math.max(0, length - 96)),
  ].join('|');
}

function validScopeId(index, requested) {
  if (requested === ALL_SCOPE_ID) return requested;
  if ((index?.scopes || []).some((scope) => scope.id === requested)) return requested;
  return index?.indexable ? index.defaultScopeId : ALL_SCOPE_ID;
}

export function ensureResolverHierarchyScope(state = {}, stateRef = null) {
  const source = text(state.stagedJsonText);
  if (!source) {
    const model=state.resolverJsonTraceO1ScopeReadModel;
    const index=model?.schema==='LFJ.O1.HierarchyScopes.v1'
      ? {indexable:model.indexable===true,itemCount:model.itemCount||0,
         scopes:model.scopes||[],byteLength:model.byteLength||0,
         defaultScopeId:ALL_SCOPE_ID,reason:model.reason||'',strategy:model.strategy||'worker'}
      : null;
    return {index,selectedScopeId:index?.indexable
      ?validScopeId(index,text(state.jsonTraceScopeId)||ALL_SCOPE_ID):ALL_SCOPE_ID};
  }
  const key = sourceKey(source);
  const cached = state.resolverJsonTraceUiScopeCache;
  const index = cached?.key === key
    ? cached.index
    : buildJsonHierarchyScopeIndex(source);
  const selectedScopeId = validScopeId(
    index,
    text(state.jsonTraceScopeId) || index.defaultScopeId,
  );
  if (stateRef?.current) {
    stateRef.current = {
      ...stateRef.current,
      jsonTraceScopeId: selectedScopeId,
      resolverJsonTraceUiScopeCache: { key, index },
    };
  }
  return { index, selectedScopeId };
}

function scopeNote(scopeState) {
  const index = scopeState?.index;
  if (!index) return 'Load staged JSON to discover hierarchy scopes.';
  if (!index.indexable) {
    return index.reason ? 'All scopes only: '+index.reason :
      'This JSON shape cannot be bounded by the current hierarchy index. Resolver will use explicit All scopes.';
  }
  const selected = (index.scopes || []).find((scope) => scope.id === scopeState.selectedScopeId);
  if (scopeState.selectedScopeId === ALL_SCOPE_ID) {
    return 'All scopes selected — full semantic resolution is intentionally enabled and may be expensive on large JSON.';
  }
  return 'Bounded scope: ' + (selected?.itemCount || 0)
    + ' top-level item(s) from ' + index.itemCount + ' indexed item(s).';
}

function selectControl(scopeState) {
  const select = createElement('select');
  select.dataset.field = 'resolver-hierarchy-scope';
  const options = scopeState?.index
    ? jsonHierarchyScopeOptions(scopeState.index)
    : [{ id: ALL_SCOPE_ID, label: 'All scopes', itemCount: 0 }];
  for (const item of options) {
    const option = createElement('option', item.label + ' (' + item.itemCount + ')');
    option.value = item.id;
    option.selected = item.id === scopeState.selectedScopeId;
    select.appendChild(option);
  }
  select.disabled = scopeState?.index?.indexable !== true;
  return select;
}

export function renderResolverHierarchyScopeControl(parent, stateRef, render, scopeState) {
  const bar = createElement('div', '', 'xml-cii-resolver-scope-control');
  if (bar.style) {
    Object.assign(bar.style, {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      flexWrap: 'wrap',
      margin: '8px 0 12px',
      padding: '8px 10px',
      border: '1px solid rgba(56,189,248,0.22)',
      borderRadius: '6px',
      background: 'rgba(14,116,144,0.08)',
    });
  }
  bar.appendChild(createElement('strong', 'Hierarchy / Zone scope:'));
  const select = selectControl(scopeState);
  select.addEventListener('change', (event) => {
    if (!stateRef?.current) return;
    stateRef.current = {
      ...stateRef.current,
      jsonTraceScopeId: event.target.value,
      resolverJsonTraceResult: null,
      resolverJsonTraceJsonResult: null,
      resolverJsonTraceExportStatus: '',
    };
    render?.();
  });
  bar.appendChild(select);
  const note = createElement('span', scopeNote(scopeState), 'xml-cii-phase-help');
  if (note.style) note.style.fontSize = '11px';
  bar.appendChild(note);
  parent.appendChild(bar);
}

export function refreshResolverHierarchyScopeControl(container,stateRef){
 if(!container||!stateRef?.current)return;
 const data=ensureResolverHierarchyScope(stateRef.current,stateRef);
 for(const select of container.querySelectorAll('[data-field="resolver-hierarchy-scope"]')){
  const fresh=selectControl(data);
  select.replaceChildren(...fresh.childNodes);
  select.disabled=fresh.disabled;
  select.value=data.selectedScopeId;
  const note=select.closest('.xml-cii-resolver-scope-control')
    ?.querySelector('.xml-cii-phase-help');
  if(note)note.textContent=scopeNote(data);
 }
}
export { ALL_SCOPE_ID };
