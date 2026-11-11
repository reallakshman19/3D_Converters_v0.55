import { combineXmlWithNodeOffsets } from '../../../converters/xml-cii2019-core/xml-node-offset-combine.js?v=20261001-weight-output-2';
import { createElement } from './xml-cii-adapted-dom.js';
import { modeAExecutionRows, modeARawState } from './xml-cii-adapted-mode-a-propagation.js?v=20261001-weight-output-2';
import { xmlCiiProcessingMode, selectXmlCiiProcessingMode, loadXmlCiiSingleSource } from './xml-cii-adapted-processing-mode.js?v=20261001-single-weight-owners-1';

function download(value, filename, type) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function control(label, action) {
  const button = createElement('button', label, 'model-converters-run-btn');
  button.type = 'button'; button.dataset.modeBAction = action;
  return button;
}

export function renderModeBXmlExport(parent, stateRef, render) {
  const state = modeARawState(stateRef);
  const mode = xmlCiiProcessingMode(state);
  const panel = createElement('section', '', 'model-converters-workflow-master-card');
  panel.dataset.modeBXmlPanel = 'true';
  Object.assign(panel.style, { padding: '12px', margin: '12px 0', border: '1px solid #475569', borderRadius: '8px' });
  panel.appendChild(createElement('h3', 'Processing mode'));
  const single = control('Single', 'select-single');
  const a = control('Mode A — Separate Models (Draft)', 'select-a');
  const b = control('Mode B — Combine XML (node offsets)', 'select-b');
  panel.append(single, a, b);
  for (const [button, selected] of [[single, 'single'], [a, 'mode-a'], [b, 'mode-b']]) {
    button.setAttribute('aria-pressed', String(mode === selected));
    Object.assign(button.style, { background: mode === selected ? '#1e4ed8' : '#1e293b',
      border: `1px solid ${mode === selected ? '#60a5fa' : '#475569'}`, marginRight: '6px' });
    button.addEventListener('click', () => selectXmlCiiProcessingMode(stateRef, selected, render));
  }
  parent.appendChild(panel);
  if (mode !== 'mode-b') {
    panel.appendChild(createElement('p', mode === 'single' ? 'Load one XML and run one model.' : 'Load multiple XMLs and run each as a separate model.'));
    return;
  }
  panel.appendChild(createElement('p', 'Mode B prepares one combined XML. Use it in Single mode to preview, review weights and run conversion.'));
  panel.appendChild(createElement('p', 'Combine selected branches from enabled files into one XML. Positive node IDs receive file offsets; repeated IDs within each file remain connected. Coordinates, engineering fields and negative helper IDs are preserved. Sources keep their own routes; this action adds no cross-file joins.'));
  renderCombineControls(panel, stateRef, render);
}

function renderCombineControls(panel, stateRef, render) {
  const basis = createElement('select'); basis.dataset.modeBBasis = 'true';
  for (const [value, label] of [['source', 'Source XML'], ['enriched', 'Latest enriched XML outputs']]) {
    const option = createElement('option', label); option.value = value; basis.appendChild(option);
  }
  const offset = createElement('input'); offset.type = 'number'; offset.min = '1'; offset.step = '1'; offset.value = '100000';
  Object.assign(offset.style, { background: '#101827', color: '#e2e8f0', border: '1px solid #475569', padding: '6px', borderRadius: '5px' });
  offset.setAttribute('aria-label', 'Node offset step'); offset.dataset.modeBOffset = 'true';
  const basisLabel = createElement('label', 'XML basis '); basisLabel.appendChild(basis);
  const offsetLabel = createElement('label', ' Node offset step '); offsetLabel.appendChild(offset);
  const build = control('Combine XML', 'combine');
  const save = control('Save Combined XML', 'save-xml'); save.disabled = true;
  const manifest = control('Save Node Offset Map', 'save-map'); manifest.disabled = true;
  const use = control('Use Combined XML in Single', 'use-single'); use.disabled = true;
  const status = createElement('div', 'Choose the XML basis and combine to inspect source offsets.', 'model-converters-workflow-detail-note');
  status.dataset.modeBStatus = 'true';
  const table = createElement('pre'); table.dataset.modeBOffsets = 'true';
  panel.append(basisLabel, offsetLabel, build, save, manifest, use, status, table);
  let result = null;
  const clear = () => { result = null; save.disabled = true; manifest.disabled = true; use.disabled = true; table.textContent = ''; };
  basis.addEventListener('change', clear); offset.addEventListener('input', clear);
  bindCombineAction(build, stateRef, basis, offset, status, table, clear, (next) => {
    result = next; save.disabled = false; manifest.disabled = false; use.disabled = false;
  });
  save.addEventListener('click', () => { if (result) download(result.xmlText, 'Mode-B-combined.xml', 'application/xml'); });
  manifest.addEventListener('click', () => { if (result) download(JSON.stringify(result.manifest, null, 2), 'Mode-B-node-offset-map.json', 'application/json'); });
  use.addEventListener('click', () => {
    if (!result) return;
    const file = new File([result.xmlText], 'Mode-B-combined.xml', { type: 'application/xml' });
    loadXmlCiiSingleSource(stateRef, file, result.xmlText, render, 'xml');
  });
}

function bindCombineAction(build, stateRef, basis, offset, status, table, clear, release) {
  build.addEventListener('click', () => {
    clear();
    try {
      const sources = modeAExecutionRows(stateRef).map((entry) => {
        const xmlText = basis.value === 'enriched' ? entry.state.result?.enrichedText : entry.state.sourceText;
        if (!xmlText) throw new Error(`${entry.source.fileName}: no current enriched output; run this source first or choose Source XML.`);
        return { sourceId: entry.source.sourceId, fileName: entry.source.fileName, xmlText, basis: basis.value };
      });
      const result = combineXmlWithNodeOffsets(sources, { offsetStep: Number(offset.value) });
      status.textContent = `Combined ${result.manifest.sourceCount} XML files. Header from ${result.manifest.headerSource}. Ready to save.`;
      table.textContent = result.manifest.sourceOrder.map((row) => `${row.fileName}: offset +${row.offset} · ${row.positiveIdCount} positive IDs · ${row.basis}`).join('\n');
      release(result);
    } catch (error) { status.textContent = `Cannot combine XML: ${error.message}`; }
  });
}
