function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function positive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function methodFromButton(button) {
  const source = text(button?.dataset?.wmOriginalLabel || button?.textContent);
  const parts = source.split('·').map((part) => text(part)).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' · ') : '';
}

export function weightMatchAuthorityPresentation({ accepted = false, statusText = '', candidateWeight = null, candidateMethod = '' } = {}) {
  const sourceStatus = text(statusText);
  const match1Accepted = accepted && /match[- ]?1/i.test(sourceStatus);
  const candidate = positive(candidateWeight);

  if (match1Accepted) {
    return {
      state: 'MATCH1_ACCEPTED',
      statusLabel: 'Accepted Match-1 ✓',
      detailLabel: 'Engineering authority: Match-1',
      actionPrefix: '',
    };
  }

  if (accepted) {
    return {
      state: 'RESOLVED_AUTHORITY',
      statusLabel: sourceStatus || 'Accepted / resolved weight',
      detailLabel: 'Engineering authority: resolved source',
      actionPrefix: '',
    };
  }

  if (candidate) {
    return {
      state: 'CANDIDATE_NOT_ACCEPTED',
      statusLabel: 'Candidate matched ✓',
      detailLabel: 'Engineering status: NOT ACCEPTED',
      actionPrefix: 'Accept as Match-1',
      suggestedWeightLabel: `Suggested weight: ${candidate} kg`,
      candidateMethod: text(candidateMethod),
    };
  }

  return {
    state: 'UNRESOLVED',
    statusLabel: 'Unresolved',
    detailLabel: 'Engineering status: NOT ACCEPTED',
    actionPrefix: '',
  };
}

function statusMarkup(presentation) {
  const accepted = presentation.state === 'MATCH1_ACCEPTED' || presentation.state === 'RESOLVED_AUTHORITY';
  const mainColor = accepted ? '#86efac' : (presentation.state === 'CANDIDATE_NOT_ACCEPTED' ? '#fde68a' : '#fca5a5');
  const detailColor = accepted ? '#bbf7d0' : '#fca5a5';
  const suggested = presentation.suggestedWeightLabel
    ? `<div data-wm-suggested-weight style="margin-top:2px;color:#fde68a;font-size:10px;">${presentation.suggestedWeightLabel}</div>`
    : '';
  return `<div data-wm-authority-state="${presentation.state}" style="font-weight:700;color:${mainColor};white-space:nowrap;">${presentation.statusLabel}</div>${suggested}<div data-wm-engineering-status style="margin-top:2px;color:${detailColor};font-size:10px;font-weight:700;white-space:nowrap;">${presentation.detailLabel}</div>`;
}

const renderedStatusMarkup = new WeakMap();

function decorateCandidateButton(button, presentation) {
  if (!button) return;
  if (!button.dataset.wmOriginalLabel) button.dataset.wmOriginalLabel = text(button.textContent);
  if (!('wmOriginalTitle' in button.dataset)) button.dataset.wmOriginalTitle = button.title || '';
  const original = button.dataset.wmOriginalLabel;
  const next = presentation.actionPrefix ? `${presentation.actionPrefix} · ${original}` : original;
  if (text(button.textContent) !== next) button.textContent = next;
  const nextTitle = presentation.actionPrefix
    ? `${presentation.actionPrefix}. ${text(button.dataset.wmOriginalTitle)}`.trim()
    : button.dataset.wmOriginalTitle;
  if (button.title !== nextTitle) button.title = nextTitle;
  if (presentation.actionPrefix) {
    button.dataset.wmAuthorityAction = 'accept-match1';
  } else {
    delete button.dataset.wmAuthorityAction;
  }
}

function decorateRow(row) {
  const statusCell = row?.querySelector?.('[data-wm-status-cell]');
  const input = row?.querySelector?.('.mc-rigid-review-input');
  if (!statusCell || !input) return;
  const buttons = [...(row.querySelectorAll?.('[data-wm-candidate]') || [])];
  const primary = buttons[0] || null;
  const decorated = statusCell.querySelector('[data-wm-authority-state]');
  const rawStatus = text(decorated ? (statusCell.dataset.wmSourceStatus || statusCell.textContent) : statusCell.textContent);
  if (!decorated || statusCell.dataset.wmSourceStatus !== rawStatus) {
    statusCell.dataset.wmSourceStatus = rawStatus;
  }
  const accepted = input.dataset.wmAccepted === 'true' || /^accepted\b/i.test(rawStatus);
  const candidateWeight = primary?.dataset?.wmWeight || (!accepted ? input.value : null);
  const presentation = weightMatchAuthorityPresentation({
    accepted,
    statusText: rawStatus,
    candidateWeight,
    candidateMethod: methodFromButton(primary),
  });
  const markup = statusMarkup(presentation);
  if (!decorated || renderedStatusMarkup.get(statusCell) !== markup) {
    statusCell.innerHTML = markup;
    renderedStatusMarkup.set(statusCell, markup);
  }
  input.title = accepted
    ? (presentation.state === 'MATCH1_ACCEPTED' ? 'Accepted Match-1 engineering authority.' : 'Accepted/resolved engineering weight authority.')
    : (positive(candidateWeight)
      ? 'Suggested value only. It is NOT ACCEPTED until you explicitly accept a candidate or edit/confirm this weight.'
      : 'Enter a positive weight to save manual Final authority.');
  for (const button of buttons) decorateCandidateButton(button, presentation);
}

function ensureLegend(root) {
  const content = root?.querySelector?.('#mc-wm-content');
  if (!content || content.querySelector('[data-wm-authority-legend]')) return;
  const table = content.querySelector('.mc-rigid-review-table-wrap');
  if (!table) return;
  const legend = document.createElement('div');
  legend.dataset.wmAuthorityLegend = 'true';
  legend.className = 'model-converters-workflow-detail-note';
  legend.style.marginBottom = '8px';
  legend.style.borderColor = '#7c5a18';
  legend.style.background = '#2a210b';
  legend.style.color = '#ffe7a3';
  legend.innerHTML = '<strong>Authority legend:</strong> Candidate matched / Suggested is algorithmic evidence only and remains <strong>NOT ACCEPTED</strong>. Use <strong>Accept as Match-1</strong> for a candidate. Typing a positive weight saves <strong>manual Final authority</strong>.';
  table.before(legend);
}

export function decorateWeightMatchAuthorityPresentation(root) {
  if (!root?.querySelectorAll) return;
  ensureLegend(root);
  root.querySelectorAll('[data-wm-status-cell]').forEach((cell) => decorateRow(cell.closest('tr')));
}

export function installWeightMatchAuthorityPresentation(root) {
  if (!root?.querySelectorAll) return () => {};
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      decorateWeightMatchAuthorityPresentation(root);
    });
  };
  decorateWeightMatchAuthorityPresentation(root);
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(schedule)
    : null;
  observer?.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-wm-accepted', 'value'] });
  root.addEventListener?.('change', schedule);
  root.addEventListener?.('click', schedule);
  return () => {
    observer?.disconnect();
    root.removeEventListener?.('change', schedule);
    root.removeEventListener?.('click', schedule);
  };
}
