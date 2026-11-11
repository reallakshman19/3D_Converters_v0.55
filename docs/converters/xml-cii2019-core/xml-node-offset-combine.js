const name = (node) => String(node?.localName || node?.nodeName || '').replace(/^.*:/, '');
const text = (node) => String(node?.textContent || '').trim();
const children = (node) => [...(node?.childNodes || [])].filter((child) => child.nodeType === 1);

function engineeringHeader(root) {
  const keys = new Set(['Units', 'RestrainOpenEnds', 'AmbientTemperature']);
  return children(root).filter((child) => keys.has(name(child))).map((child) => [name(child),
    children(child).length ? children(child).map((field) => [name(field), text(field)]).sort() : text(child),
  ]).sort();
}

function parseSource(source) {
  const document = new DOMParser().parseFromString(String(source.xmlText || ''), 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error(`${source.fileName}: invalid XML.`);
  const root = document.documentElement;
  if (name(root) !== 'PipeStressExport') throw new Error(`${source.fileName}: Mode B requires PSI116 PipeStressExport XML.`);
  const pipes = children(root).filter((child) => name(child) === 'Pipe');
  if (!pipes.length) throw new Error(`${source.fileName}: no Pipe content to combine.`);
  const numbers = [...root.getElementsByTagName('*')].filter((node) => name(node) === 'NodeNumber');
  const positive = new Set();
  for (const node of numbers) {
    if (!/^-?\d+$/.test(text(node)) || !Number.isSafeInteger(Number(text(node)))) throw new Error(`${source.fileName}: invalid NodeNumber ${text(node)}.`);
    if (Number(text(node)) > 0) positive.add(Number(text(node)));
  }
  for (const node of [...root.getElementsByTagName('*')]) {
    if (name(node) !== 'NodeNumber' && /(?:node.*(?:number|id)|(?:from|to)node)$/i.test(name(node)) && text(node)) {
      throw new Error(`${source.fileName}: unsupported node reference field ${name(node)}; offset cannot be applied safely.`);
    }
  }
  return { source, document, root, pipes, positive, header: engineeringHeader(root) };
}

function planOffset(parsed, step, previousMaximum, index) {
  const offset = index === 0 ? 0 : Math.ceil(previousMaximum / step) * step;
  const values = [...parsed.positive];
  const maximum = values.reduce((max, number) => Math.max(max, number), 0);
  if (!Number.isSafeInteger(offset + maximum)) throw new Error('Node offsets exceed safe integer range.');
  return { offset, outputMaximum: offset + maximum };
}

// File order is explicit input authority. Repeated positive IDs inside one
// source remain shared; separate sources receive disjoint ID namespaces.
export function combineXmlWithNodeOffsets(sources, { offsetStep = 100000 } = {}) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') throw new Error('Native XML DOM is required.');
  if (!Array.isArray(sources) || sources.length < 2) throw new Error('Mode B needs at least two enabled XML sources.');
  const step = Number(offsetStep);
  if (!Number.isSafeInteger(step) || step <= 0) throw new Error('Node offset step must be a positive integer.');
  const parsed = sources.map(parseSource);
  requireCompatibleHeaders(parsed);
  const output = new DOMParser().parseFromString(String(sources[0].xmlText), 'application/xml');
  const root = output.documentElement;
  for (const pipe of children(root).filter((child) => name(child) === 'Pipe')) root.removeChild(pipe);
  let previousMaximum = 0;
  const records = [];
  for (const [index, entry] of parsed.entries()) {
    const plan = planOffset(entry, step, previousMaximum, index);
    const numberMap = [...entry.positive].sort((a, b) => a - b).map((sourceNumber) => ({ sourceNumber, outputNumber: sourceNumber + plan.offset }));
    for (const pipe of entry.pipes) {
      const clone = output.importNode(pipe, true);
      for (const node of [...clone.getElementsByTagName('*')].filter((node) => name(node) === 'NodeNumber')) {
        if (Number(text(node)) > 0) node.textContent = String(Number(text(node)) + plan.offset);
      }
      root.appendChild(clone);
    }
    previousMaximum = Math.max(previousMaximum, plan.outputMaximum);
    records.push({ sourceId: entry.source.sourceId || '', fileName: entry.source.fileName,
      basis: entry.source.basis || 'source', offset: plan.offset, positiveIdCount: entry.positive.size,
      pipeCount: entry.pipes.length, numberMap });
  }
  return { xmlText: new XMLSerializer().serializeToString(output),
    manifest: { schema: 'xml-node-offset-combine/v1', offsetStep: step, headerSource: sources[0].fileName,
      sourceCount: records.length, sourceOrder: records, automaticCrossSourceJoins: 0 } };
}

function requireCompatibleHeaders(parsed) {
  const header = JSON.stringify(parsed[0].header);
  for (const entry of parsed) {
    if (entry.root.namespaceURI !== parsed[0].root.namespaceURI || JSON.stringify(entry.header) !== header) {
      throw new Error(`${entry.source.fileName}: XML namespace, units or root engineering settings differ from the first source.`);
    }
  }
}
