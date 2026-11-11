import { detectBranchLinePattern } from './xml-cii-adapted-branch-line-pattern-detect.js';

const text = (value) => value === undefined || value === null ? '' : String(value).trim();
const esc = (value) => text(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const unique = (values) => [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
const compact = (value) => text(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
const regexEscape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function markPending(tr, label = '✏ Modified') {
  tr.dataset.status = 'mapped';
  tr.dataset.mappingSource = 'pending';
  const input = tr.querySelector('.bulk-line-input');
  if (input) {
    input.style.borderColor = '#3b82f6';
    input.style.backgroundColor = 'rgba(59,130,246,0.1)';
  }
  const status = tr.querySelector('.bulk-row-status');
  if (status) {
    status.textContent = label;
    status.style.color = '#60a5fa';
  }
}

function exactMatchScore(branchName, lineKey) {
  const branch = text(branchName).toUpperCase();
  const key = text(lineKey).toUpperCase();
  if (!branch || !key) return 0;
  const parts = key.split(/[^A-Z0-9]+/).filter(Boolean);
  const keyCompact = parts.join('');
  if (!keyCompact) return 0;
  if (compact(branch) === keyCompact) return 300000 + keyCompact.length;
  const flexible = parts.map(regexEscape).join('[^A-Z0-9]*');
  return new RegExp(`(^|[^A-Z0-9])${flexible}(?=$|[^A-Z0-9])`).test(branch)
    ? 200000 + keyCompact.length
    : 0;
}

function familyTokens(branchName) {
  return unique(text(branchName).toUpperCase().match(/[A-Z][A-Z0-9]{4,}/g) || []);
}

function progressiveFamilyResolution(branchName, lineListKeys) {
  const loaded = unique(lineListKeys)
    .map((key) => ({ key, compact: compact(key) }))
    .filter((row) => row.compact);
  const tokens = familyTokens(branchName);

  for (let wildcardCount = 1; wildcardCount <= 4; wildcardCount += 1) {
    const candidates = new Map();
    const evidence = [];
    for (const token of tokens) {
      if (token.length <= wildcardCount + 2) continue;
      const prefix = token.slice(0, -wildcardCount);
      const matched = loaded.filter((row) => row.compact.length === token.length && row.compact.startsWith(prefix));
      if (!matched.length) continue;
      const mask = `${prefix}${'X'.repeat(wildcardCount)}`;
      evidence.push({ token, mask, matchedKeys: matched.map((row) => row.key) });
      for (const row of matched) candidates.set(row.key, row);
    }
    if (!evidence.length) continue;

    const keys = [...candidates.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const primary = evidence[0];
    if (keys.length === 1) {
      return {
        status: 'match',
        key: keys[0],
        candidates: keys,
        method: 'progressive-family-mask',
        mask: primary.mask,
        wildcardCount,
        token: primary.token,
        evidence,
      };
    }
    return {
      status: 'ambiguous',
      key: '',
      candidates: keys,
      method: 'progressive-family-mask',
      mask: primary.mask,
      wildcardCount,
      token: primary.token,
      evidence,
    };
  }
  return { status: 'none', key: '', candidates: [] };
}

export function resolveBranchLineKeySuggestion(branchName, lineListKeys = []) {
  const exact = unique(lineListKeys)
    .map((key) => ({ key, score: exactMatchScore(branchName, key) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.key.length - a.key.length || a.key.localeCompare(b.key, undefined, { numeric: true }));

  if (exact.length) {
    const topScore = exact[0].score;
    const top = exact.filter((row) => row.score === topScore).map((row) => row.key);
    return top.length === 1
      ? { status: 'match', key: top[0], candidates: top }
      : { status: 'ambiguous', key: '', candidates: top };
  }

  return progressiveFamilyResolution(branchName, lineListKeys);
}

function unmappedBranches(container) {
  return [...container.querySelectorAll('.bulk-map-tr[data-mapping-source="unmapped"]')]
    .filter((tr) => !tr.querySelector('.bulk-line-input')?.value?.trim())
    .map((tr) => text(tr.getAttribute('data-branch')))
    .filter(Boolean);
}

function confidenceColor(confidence) {
  if (confidence === 'HIGH') return '#34d399';
  if (confidence === 'MEDIUM') return '#fbbf24';
  if (confidence === 'LOW') return '#fb923c';
  return '#f87171';
}

function confidenceBasis(confidence) {
  if (confidence === 'HIGH') return 'HIGH = ≥95% exact coverage, ≥2 exact matches, ≥2 distinct loaded keys';
  if (confidence === 'MEDIUM') return 'MEDIUM = ≥70% exact coverage and ≥2 exact matches';
  return 'LOW = some exact evidence, but below the MEDIUM thresholds';
}

function showPatternResult(container, html) {
  const result = container.querySelector('.bulk-pattern-detect-result');
  if (!result) return;
  result.style.display = 'block';
  result.innerHTML = html;
}

function familyEvidenceHtml(branches, lineListKeys) {
  const rows = branches.map((branch) => ({ branch, result: resolveBranchLineKeySuggestion(branch, lineListKeys) }));
  const family = rows.filter((row) => row.result.method === 'progressive-family-mask');
  if (!family.length) return '';
  return family.slice(0, 6).map(({ branch, result }) => {
    const outcome = result.status === 'match' ? `→ ${result.key}` : `ambiguous: ${result.candidates.join(' / ')}`;
    return `<div style="margin-top:3px;"><code>${esc(branch)}</code> · mask <code>${esc(result.mask)}</code> · ${esc(outcome)}</div>`;
  }).join('');
}

function bindAutoDetectPattern(container, lineListKeys) {
  container.querySelector('.bulk-auto-detect-pattern-btn')?.addEventListener('click', () => {
    const branches = unmappedBranches(container);
    if (!branches.length) {
      showPatternResult(container, '<span style="color:#94a3b8;">No genuinely unmapped branch is available for pattern detection.</span>');
      return;
    }
    if (!lineListKeys?.length) {
      showPatternResult(container, '<span style="color:#fbbf24;">No loaded Line List keys are available.</span>');
      return;
    }

    const result = detectBranchLinePattern(branches, lineListKeys, { exampleLimit: 4 });
    if (result.status === 'ambiguous') {
      const alternatives = (result.candidates || []).map((candidate) => {
        const pct = Math.round(candidate.evaluation.coverage * 100);
        return `<div style="margin-top:4px;"><code>${esc(candidate.expression)}</code> → <code>${esc(candidate.replacement)}</code> · exact ${candidate.evaluation.exactMatchCount}/${candidate.evaluation.testedCount} (${pct}%)</div>`;
      }).join('');
      showPatternResult(container, `<strong style="color:#fbbf24;">⚠ Ambiguous exact-pattern evidence — nothing applied.</strong>${alternatives}`);
      return;
    }

    if (result.status !== 'detected' || !result.best) {
      const family = familyEvidenceHtml(branches, lineListKeys);
      showPatternResult(
        container,
        '<strong style="color:#94a3b8;">No safe exact-key regex detected.</strong>'
        + '<div>Progressive family evidence is shown below. Auto-Suggest assigns a family result only when the most-specific mask leaves exactly one loaded Line List key.</div>'
        + family,
      );
      return;
    }

    const best = result.best;
    const regex = container.querySelector('.bulk-pattern-regex');
    const replacement = container.querySelector('.bulk-pattern-replace');
    if (regex) regex.value = best.expression;
    if (replacement) replacement.value = best.replacement;
    const evaluation = best.evaluation;
    const coveragePct = Math.round(evaluation.coverage * 100);
    const examples = (best.examples || []).map((row) => `<div><code>${esc(row.branchName)}</code> → <code>${esc(row.key)}</code></div>`).join('');
    showPatternResult(
      container,
      `<strong style="color:${confidenceColor(best.confidence)};">Detected · ${esc(best.confidence)} confidence</strong>`
      + ` · Exact coverage <strong>${coveragePct}%</strong> (${evaluation.exactMatchCount}/${evaluation.testedCount})`
      + ` · Distinct loaded keys ${evaluation.distinctKeyCount} · Rejected ${evaluation.rejectedCount}`
      + `<div style="margin-top:4px;color:#94a3b8;">${esc(confidenceBasis(best.confidence))}. Confidence is a threshold label; exact coverage is shown separately.</div>`
      + '<div style="margin-top:4px;">Proposal only. In Replace, <code>$1</code>, <code>$2</code>… mean the corresponding captured regex groups. Apply Pattern still accepts only exact loaded Line List keys.</div>'
      + examples,
    );
  });
}

function bindPatternApply(container, lineListKeys) {
  const allowed = new Set(unique(lineListKeys));
  container.querySelector('.bulk-apply-pattern-btn')?.addEventListener('click', () => {
    const pattern = container.querySelector('.bulk-pattern-regex')?.value?.trim();
    const replacement = container.querySelector('.bulk-pattern-replace')?.value || '';
    if (!pattern) return alert('Enter a regex, or use Auto Detect Pattern. In Replace, $1, $2… refer to captured groups from the regex.');
    let regex;
    try { regex = new RegExp(pattern); } catch (error) { return alert(`Invalid regex syntax: ${error.message}`); }
    let applied = 0;
    let rejected = 0;
    container.querySelectorAll('.bulk-map-tr[data-mapping-source="unmapped"]').forEach((tr) => {
      const input = tr.querySelector('.bulk-line-input');
      if (!input || input.value.trim()) return;
      const branch = tr.getAttribute('data-branch') || '';
      regex.lastIndex = 0;
      if (!regex.test(branch)) return;
      regex.lastIndex = 0;
      const candidate = branch.replace(regex, replacement).trim();
      if (!allowed.has(candidate)) {
        rejected += 1;
        const status = tr.querySelector('.bulk-row-status');
        if (status) {
          status.textContent = `⚠ Not in Line List: ${candidate || 'blank'}`;
          status.style.color = '#fbbf24';
        }
        return;
      }
      input.value = candidate;
      markPending(tr);
      applied += 1;
    });
    const detail = [
      `${applied} exact loaded key${applied === 1 ? '' : 's'} applied.`,
      rejected ? `${rejected} non-authoritative result${rejected === 1 ? '' : 's'} rejected.` : '',
    ].filter(Boolean).join(' ');
    alert(detail);
  });
}

function bindAutoSuggest(container, lineListKeys) {
  container.querySelector('.bulk-autosuggest-btn')?.addEventListener('click', () => {
    if (!lineListKeys?.length) return alert('No master Line List keys loaded.');
    let suggested = 0;
    let ambiguous = 0;
    container.querySelectorAll('.bulk-map-tr[data-mapping-source="unmapped"]').forEach((tr) => {
      const input = tr.querySelector('.bulk-line-input');
      if (!input || input.value.trim()) return;
      const result = resolveBranchLineKeySuggestion(tr.getAttribute('data-branch') || '', lineListKeys);
      if (result.status === 'match') {
        input.value = result.key;
        markPending(tr, result.method === 'progressive-family-mask' ? `✨ Family ${result.mask}` : '✨ Suggested');
        suggested += 1;
        return;
      }
      if (result.status === 'ambiguous') {
        ambiguous += 1;
        const status = tr.querySelector('.bulk-row-status');
        if (status) {
          status.textContent = result.method === 'progressive-family-mask'
            ? `⚠ Ambiguous ${result.mask}: ${result.candidates.join(' / ')}`
            : `⚠ Ambiguous: ${result.candidates.join(' / ')}`;
          status.style.color = '#fbbf24';
          status.title = 'No mapping assigned because the most-specific authoritative match resolves to multiple loaded Line List keys.';
        }
      }
    });
    alert(`${suggested} unambiguous mapping${suggested === 1 ? '' : 's'} suggested.${ambiguous ? ` ${ambiguous} ambiguous result${ambiguous === 1 ? '' : 's'} left for review.` : ''}`);
  });
}

export function bindBranchLineMapActions(container, lineListKeys) {
  bindAutoDetectPattern(container, lineListKeys);
  bindPatternApply(container, lineListKeys);
  bindAutoSuggest(container, lineListKeys);
}
