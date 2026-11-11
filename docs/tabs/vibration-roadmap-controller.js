import { parseEnergyInstituteEit } from '../converters/vibration/eit/parse.js';
import { buildVibrationIntegrityProjectFromEit } from '../converters/vibration/project/from-eit.js';
import { buildVibrationRoadmapStateFromProject } from '../converters/vibration/project/roadmap.js';
import {
  VIBRATION_INTEGRITY_PROJECT_FILE_EXTENSION,
  parseVibrationIntegrityProject,
  serializeVibrationIntegrityProject,
} from '../converters/vibration/project/serialize.js';
import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';
import { assertVibrationProjectLifecycleHandoff } from './vibration-project-lifecycle-handoff.js';
import { attachVibrationProjectLifecycleLedgersCompat } from './vibration-project-schema-compat.js';
import { createVibrationRoadmapNavigationDiagnostic } from './vibration-roadmap-navigation-diagnostic.js';
import { renderVibrationRoadmapPanel } from './vibration-roadmap-panel.js';
import {
  VIBRATION_ROADMAP_DEFAULT_WIDTH,
  VIBRATION_ROADMAP_MAX_WIDTH,
  VIBRATION_ROADMAP_MIN_WIDTH,
  clampVibrationRoadmapWidth,
  loadVibrationRoadmapPresentationPreference,
  saveVibrationRoadmapPresentationPreference,
} from './vibration-roadmap-presentation-preference.js';
import {
  captureVibrationRoadmapViewState,
  restoreVibrationRoadmapViewState,
} from './vibration-roadmap-view-state.js';
import { resolveVibrationCaseActionWorkspace } from './vibration-roadmap-workspace-routing.js';
import { resolveVibrationRoadmapScopeSelection } from './vibration-roadmap-scope-selection.js';

export const VIBRATION_ROADMAP_STATE_EVENT = 'vibration-roadmap-state';
export const VIBRATION_PROJECT_CHANGED_EVENT = 'vibration-project-changed';
export {
  VIBRATION_ROADMAP_DEFAULT_WIDTH,
  VIBRATION_ROADMAP_MAX_WIDTH,
  VIBRATION_ROADMAP_MIN_WIDTH,
  clampVibrationRoadmapWidth,
} from './vibration-roadmap-presentation-preference.js';
const VIBRATION_FAMILY_ID = 'VIB';
const WIDTH_STEP = 16;

export function shouldShowVibrationRoadmap(definition, state = {}) {
  return state.familyLanding === VIBRATION_FAMILY_ID || definition?.family === VIBRATION_FAMILY_ID;
}

export function vibrationProjectFileName(project) {
  const base = String(project?.project?.title || project?.project?.projectId || 'vibration-project')
    .trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'vibration-project';
  return `${base}${VIBRATION_INTEGRITY_PROJECT_FILE_EXTENSION}`;
}

function cleanPanel(container) {
  container.querySelector('[data-vibration-roadmap-panel]')?.remove();
  const layout = container.querySelector('.engineering-console-layout');
  layout?.classList.remove('has-vibration-roadmap', 'vibration-roadmap-collapsed');
  layout?.style.removeProperty('--vibration-roadmap-width');
}

function normalizedDisplayState(value = {}) {
  return { eitImport: value.eitImport ?? null, mechanismStates: value.mechanismStates ?? {}, context: value.context ?? {} };
}

function mergeDisplayState(current, update = {}) {
  return {
    eitImport: update.eitImport === undefined ? current.eitImport : update.eitImport,
    mechanismStates: update.mechanismStates === undefined ? current.mechanismStates : update.mechanismStates,
    context: update.context === undefined ? current.context : { ...current.context, ...update.context },
  };
}

function defaultDownloadText(text, fileName) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function customEvent(container, name, detail) {
  const EventClass = container.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
  if (typeof EventClass === 'function') container.dispatchEvent(new EventClass(name, { detail }));
}

function workspaceTab(container, workspaceId) {
  return [...container.querySelectorAll('[data-vi-workspace-tab]')]
    .find((button) => button.dataset.viWorkspaceTab === workspaceId) ?? null;
}

function assessmentRow(container, rowKey) {
  return [...container.querySelectorAll('[data-vi-row]')]
    .find((button) => button.dataset.viRow === rowKey) ?? null;
}

function browserPresentationStorage(windowLike) {
  try {
    return windowLike?.localStorage ?? null;
  } catch {
    return null;
  }
}

function lifecyclePersistenceError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationProjectLifecyclePersistenceError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

export function createVibrationRoadmapController(container, { initialState = {}, downloadText = defaultDownloadText } = {}) {
  const resizeWindow = container.ownerDocument?.defaultView ?? null;
  const presentationStorage = browserPresentationStorage(resizeWindow);
  const storedPresentationPreference = loadVibrationRoadmapPresentationPreference(presentationStorage);
  const hasInitialCollapsed = Object.prototype.hasOwnProperty.call(initialState, 'collapsed');
  const hasInitialWidth = initialState.roadmapWidth !== undefined || initialState.width !== undefined;
  let displayState = normalizedDisplayState(initialState);
  let explicitMechanismStates = initialState.mechanismStates ?? {};
  let currentProject = initialState.project ?? null;
  let selectedLineId = initialState.context?.lineId ?? null;
  let collapsed = hasInitialCollapsed ? initialState.collapsed === true : storedPresentationPreference?.collapsed ?? false;
  let roadmapWidth = clampVibrationRoadmapWidth(
    hasInitialWidth ? (initialState.roadmapWidth ?? initialState.width) : storedPresentationPreference?.roadmapWidth,
  );
  let resizeState = null;
  let lastRender = null;
  let projectMessage = null;
  let projectMessageKind = 'info';
  let navigationDiagnostic = null;

  function syncProjectState(contextOverlay = displayState.context) {
    if (!currentProject) return;
    const projectState = buildVibrationRoadmapStateFromProject(currentProject, {
      lineId: selectedLineId,
      mechanismStates: explicitMechanismStates,
    });
    displayState = {
      ...projectState,
      context: Object.freeze({ ...(contextOverlay ?? {}), ...projectState.context }),
    };
    selectedLineId = displayState.context.lineId;
  }

  function projectionContext(definition) {
    return {
      ...displayState.context,
      familyId: VIBRATION_FAMILY_ID,
      calculationId: definition?.family === VIBRATION_FAMILY_ID ? definition.id : null,
      projectMessage,
      projectMessageKind,
      navigationDiagnostic,
    };
  }

  function applyWidth() {
    const layout = container.querySelector('.engineering-console-layout');
    layout?.style.setProperty('--vibration-roadmap-width', `${roadmapWidth}px`);
    const panel = container.querySelector('[data-vibration-roadmap-panel]');
    panel?.setAttribute('data-roadmap-width', String(roadmapWidth));
    const handle = container.querySelector('[data-roadmap-resize]');
    handle?.setAttribute('aria-valuenow', String(roadmapWidth));
    handle?.setAttribute('aria-valuetext', `${roadmapWidth} pixels`);
  }

  function persistPresentationPreference() {
    saveVibrationRoadmapPresentationPreference(presentationStorage, { roadmapWidth, collapsed });
  }

  function setWidth(value) {
    roadmapWidth = clampVibrationRoadmapWidth(value);
    applyWidth();
  }

  function render({ definition, state }) {
    lastRender = { definition, state };
    const previousPanel = container.querySelector('[data-vibration-roadmap-panel]');
    const viewState = captureVibrationRoadmapViewState(previousPanel, container.ownerDocument);
    cleanPanel(container);
    if (!shouldShowVibrationRoadmap(definition, state)) return;
    const layout = container.querySelector('.engineering-console-layout');
    if (!layout) return;
    const projection = buildVibrationRoadmapProjection({
      eitImport: displayState.eitImport,
      mechanismStates: displayState.mechanismStates,
      context: projectionContext(definition),
    });
    layout.classList.add('has-vibration-roadmap');
    if (collapsed) layout.classList.add('vibration-roadmap-collapsed');
    layout.style.setProperty('--vibration-roadmap-width', `${roadmapWidth}px`);
    layout.insertAdjacentHTML('beforeend', renderVibrationRoadmapPanel(projection, { collapsed, width: roadmapWidth }));
    restoreVibrationRoadmapViewState(
      container.querySelector('[data-vibration-roadmap-panel]'),
      viewState,
      container.ownerDocument,
    );
  }

  function commitProject(candidate, message) {
    currentProject = candidate;
    selectedLineId = candidate.subjects.lines[0]?.lineId ?? null;
    projectMessage = message;
    projectMessageKind = 'info';
    navigationDiagnostic = null;
    syncProjectState();
    customEvent(container, VIBRATION_PROJECT_CHANGED_EVENT, { project: currentProject, lineId: selectedLineId });
    if (lastRender) render(lastRender);
  }

  function failProject(error) {
    projectMessage = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`;
    projectMessageKind = 'error';
    if (lastRender) render(lastRender);
  }

  function applyLifecycleHandoff(handoffInput) {
    try {
      if (!currentProject) {
        throw lifecyclePersistenceError(
          'VIBRATION_PROJECT_LIFECYCLE_PROJECT_REQUIRED',
          'A vibration project must be open before lifecycle custody can be persisted.',
        );
      }
      const handoff = assertVibrationProjectLifecycleHandoff(handoffInput);
      const projectId = String(currentProject.project?.projectId ?? '').trim();
      if (handoff.projectId !== projectId) {
        throw lifecyclePersistenceError(
          'VIBRATION_PROJECT_LIFECYCLE_PROJECT_MISMATCH',
          'Lifecycle custody belongs to a different vibration project.',
          { projectId, handoffProjectId: handoff.projectId },
        );
      }
      currentProject = attachVibrationProjectLifecycleLedgersCompat(currentProject, handoff);
      projectMessage = 'Lifecycle custody stored in the project container; engineering calculation authority is unchanged.';
      projectMessageKind = 'info';
      navigationDiagnostic = null;
      syncProjectState();
      customEvent(container, VIBRATION_PROJECT_CHANGED_EVENT, { project: currentProject, lineId: selectedLineId });
      if (lastRender) render(lastRender);
      return currentProject;
    } catch (error) {
      failProject(error);
      return null;
    }
  }

  function clearNavigationDiagnostic() {
    navigationDiagnostic = null;
    container.querySelector('[data-roadmap-navigation-message]')?.remove();
  }

  function failNavigation(code, message, details = {}) {
    navigationDiagnostic = createVibrationRoadmapNavigationDiagnostic({ code, message, details });
    if (lastRender) render(lastRender);
  }

  async function importEitFile(file) {
    try {
      const imported = parseEnergyInstituteEit(await file.text(), { sourceName: file.name });
      const candidate = buildVibrationIntegrityProjectFromEit(imported);
      commitProject(candidate, `Imported ${file.name}; historical results require registered rerun.`);
    } catch (error) { failProject(error); }
  }

  async function openProjectFile(file) {
    try {
      const candidate = parseVibrationIntegrityProject(await file.text());
      commitProject(candidate, `Opened ${file.name}; current-result authority is not restored by project load.`);
    } catch (error) { failProject(error); }
  }

  function saveProject() {
    if (!currentProject) return;
    downloadText(serializeVibrationIntegrityProject(currentProject), vibrationProjectFileName(currentProject));
    projectMessage = 'Project exported. Engineering authority remains with registered calculation evidence.';
    projectMessageKind = 'info';
    if (lastRender) render(lastRender);
  }

  function onRoadmapState(event) {
    if (!event.detail || typeof event.detail !== 'object') return;
    if (event.detail.mechanismStates !== undefined) explicitMechanismStates = event.detail.mechanismStates ?? {};
    if (currentProject) {
      const contextOverlay = event.detail.context === undefined
        ? displayState.context
        : { ...displayState.context, ...event.detail.context };
      syncProjectState(contextOverlay);
    } else {
      displayState = mergeDisplayState(displayState, { ...event.detail, mechanismStates: explicitMechanismStates });
    }
    if (lastRender) render(lastRender);
  }

  function onClick(event) {
    if (event.target.closest('[data-roadmap-collapse]')) {
      collapsed = !collapsed;
      resizeState = null;
      persistPresentationPreference();
      if (lastRender) render(lastRender);
      return;
    }
    const workspaceTarget = event.target.closest('[data-vibration-workspace-id]');
    if (workspaceTarget) {
      const requestedWorkspaceId = workspaceTarget.dataset.vibrationWorkspaceId;
      const actionCode = workspaceTarget.dataset.vibrationWorkflowAction;
      const route = resolveVibrationCaseActionWorkspace(actionCode);
      if (!route) {
        failNavigation(
          'VIBRATION_ROADMAP_WORKSPACE_ROUTE_UNRESOLVED',
          'Case task is not available in the current workspace view.',
          { actionCode: actionCode ?? null, requestedWorkspaceId: requestedWorkspaceId ?? null },
        );
        return;
      }
      if (route.workspaceId !== requestedWorkspaceId) {
        failNavigation(
          'VIBRATION_ROADMAP_WORKSPACE_ROUTE_MISMATCH',
          'Case task routing no longer matches the rendered workspace target.',
          { actionCode: actionCode ?? null, requestedWorkspaceId, resolvedWorkspaceId: route.workspaceId },
        );
        return;
      }
      const target = workspaceTab(container, route.workspaceId);
      if (!target) {
        failNavigation(
          'VIBRATION_ROADMAP_WORKSPACE_TARGET_NOT_FOUND',
          'Case task is not available in the current workspace view.',
          { actionCode: route.actionCode, workspaceId: route.workspaceId },
        );
        return;
      }
      clearNavigationDiagnostic();
      target.click();
      return;
    }
    const action = event.target.closest('[data-roadmap-action]')?.dataset.roadmapAction;
    if (action === 'import-eit') container.querySelector('[data-roadmap-eit-file]')?.click();
    else if (action === 'open-project') container.querySelector('[data-roadmap-project-file]')?.click();
    else if (action === 'save-project') saveProject();
  }

  function onChange(event) {
    if (event.target.matches('[data-roadmap-assessment-select]')) {
      const choices = displayState.context?.selectedAssessment?.scopeChoices;
      const selected = resolveVibrationRoadmapScopeSelection(choices, event.target.value);
      if (!selected) {
        failNavigation(
          'VIBRATION_ROADMAP_ASSESSMENT_SCOPE_UNRESOLVED',
          'Assessment scope could not be resolved from the current governed scope choices.',
          { requestedRowKey: event.target.value ?? null },
        );
        return;
      }
      const target = assessmentRow(container, selected.rowKey);
      if (!target) {
        failNavigation(
          'VIBRATION_ROADMAP_ASSESSMENT_TARGET_NOT_FOUND',
          'Assessment scope is not available in the current workspace view.',
          { rowKey: selected.rowKey },
        );
        return;
      }
      clearNavigationDiagnostic();
      target.click();
      return;
    }
    if (event.target.matches('[data-roadmap-line-select]')) {
      selectedLineId = event.target.value;
      navigationDiagnostic = null;
      syncProjectState();
      customEvent(container, VIBRATION_PROJECT_CHANGED_EVENT, { project: currentProject, lineId: selectedLineId });
      if (lastRender) render(lastRender);
      return;
    }
    if (event.target.matches('[data-roadmap-eit-file]') && event.target.files?.[0]) importEitFile(event.target.files[0]);
    if (event.target.matches('[data-roadmap-project-file]') && event.target.files?.[0]) openProjectFile(event.target.files[0]);
  }

  function onPointerDown(event) {
    const handle = event.target.closest?.('[data-roadmap-resize]');
    if (!handle || collapsed || (event.button != null && event.button !== 0)) return;
    resizeState = { startX: event.clientX, startWidth: roadmapWidth, pointerId: event.pointerId };
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault?.();
  }

  function onPointerMove(event) {
    if (!resizeState) return;
    setWidth(resizeState.startWidth + resizeState.startX - event.clientX);
    event.preventDefault?.();
  }

  function onPointerUp(event) {
    if (!resizeState) return;
    if (resizeState.pointerId != null && event.pointerId != null && resizeState.pointerId !== event.pointerId) return;
    resizeState = null;
    persistPresentationPreference();
  }

  function onKeyDown(event) {
    if (!event.target.matches?.('[data-roadmap-resize]')) return;
    let next = null;
    if (event.key === 'ArrowLeft') next = roadmapWidth + WIDTH_STEP;
    else if (event.key === 'ArrowRight') next = roadmapWidth - WIDTH_STEP;
    else if (event.key === 'Home') next = VIBRATION_ROADMAP_MIN_WIDTH;
    else if (event.key === 'End') next = VIBRATION_ROADMAP_MAX_WIDTH;
    if (next == null) return;
    setWidth(next);
    persistPresentationPreference();
    event.preventDefault?.();
  }

  if (currentProject) syncProjectState();
  container.addEventListener(VIBRATION_ROADMAP_STATE_EVENT, onRoadmapState);
  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('keydown', onKeyDown);
  resizeWindow?.addEventListener('pointermove', onPointerMove);
  resizeWindow?.addEventListener('pointerup', onPointerUp);
  resizeWindow?.addEventListener('pointercancel', onPointerUp);

  return Object.freeze({
    render,
    applyLifecycleHandoff,
    destroy() {
      resizeState = null;
      cleanPanel(container);
      container.removeEventListener(VIBRATION_ROADMAP_STATE_EVENT, onRoadmapState);
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('keydown', onKeyDown);
      resizeWindow?.removeEventListener('pointermove', onPointerMove);
      resizeWindow?.removeEventListener('pointerup', onPointerUp);
      resizeWindow?.removeEventListener('pointercancel', onPointerUp);
    },
  });
}
