function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function vibrationRoadmapFocusKey(element) {
  const dataset = element?.dataset ?? {};
  if (dataset.roadmapCollapse !== undefined) return 'collapse';
  if (dataset.roadmapResize !== undefined) return 'resize';
  if (dataset.roadmapAssessmentSelect !== undefined) return 'assessment-select';
  if (dataset.roadmapLineSelect !== undefined) return 'line-select';
  if (dataset.roadmapAction) return `action:${dataset.roadmapAction}`;
  if (dataset.vibrationWorkspaceId) {
    return `workspace:${dataset.vibrationWorkspaceId}:${dataset.vibrationWorkflowAction ?? ''}`;
  }
  if (dataset.calcId) return `calculation:${dataset.calcId}`;
  if (dataset.roadmapNodeId) return `node:${dataset.roadmapNodeId}`;
  return null;
}

export function captureVibrationRoadmapViewState(panel, documentRef = panel?.ownerDocument ?? null) {
  if (!panel) return null;
  const scroll = panel.querySelector?.('.vibration-roadmap-scroll') ?? null;
  const activeElement = documentRef?.activeElement ?? null;
  return Object.freeze({
    scrollTop: numeric(scroll?.scrollTop),
    scrollLeft: numeric(scroll?.scrollLeft),
    focusKey: activeElement && panel.contains?.(activeElement)
      ? vibrationRoadmapFocusKey(activeElement)
      : null,
  });
}

function findFocusTarget(panel, focusKey) {
  if (!focusKey) return null;
  const candidates = panel.querySelectorAll?.('button, select, input, [tabindex]') ?? [];
  return [...candidates].find((candidate) => vibrationRoadmapFocusKey(candidate) === focusKey) ?? null;
}

function mayRestoreFocus(documentRef) {
  const active = documentRef?.activeElement ?? null;
  if (!active) return true;
  if (active === documentRef.body || active === documentRef.documentElement) return true;
  return active.isConnected === false;
}

function focusWithoutScroll(target) {
  if (!target || target.disabled || typeof target.focus !== 'function') return false;
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
  return true;
}

export function restoreVibrationRoadmapViewState(panel, state, documentRef = panel?.ownerDocument ?? null) {
  if (!panel || !state) return false;
  const scroll = panel.querySelector?.('.vibration-roadmap-scroll') ?? null;
  if (scroll) {
    scroll.scrollTop = numeric(state.scrollTop);
    scroll.scrollLeft = numeric(state.scrollLeft);
  }
  if (!state.focusKey || !mayRestoreFocus(documentRef)) return false;
  const target = findFocusTarget(panel, state.focusKey);
  const restored = focusWithoutScroll(target);
  if (restored && scroll) {
    scroll.scrollTop = numeric(state.scrollTop);
    scroll.scrollLeft = numeric(state.scrollLeft);
  }
  return restored;
}
