function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function localName(name) {
  return text(name).replace(/^.*:/, '');
}

function decodeEntities(value) {
  return text(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
    .replace(/&gt;/gi, '>').replace(/&lt;/gi, '<').replace(/&amp;/gi, '&');
}

function escapeText(value) {
  return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, '&quot;');
}

class WeightBasisElement {
  constructor(name, namespaceURI = null) {
    this.nodeType = 1;
    this.nodeName = name;
    this.localName = localName(name);
    this.namespaceURI = namespaceURI;
    this.attributes = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this._textContent = '';
  }

  get children() { return this.childNodes.filter((node) => node?.nodeType === 1); }
  get nextSibling() {
    const siblings = this.parentNode?.childNodes || [];
    const index = siblings.indexOf(this);
    return index >= 0 ? siblings[index + 1] || null : null;
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, text(value)); }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }

  appendChild(child) {
    if (!child) return child;
    child.parentNode?.removeChild?.(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child, reference) {
    if (!reference) return this.appendChild(child);
    const index = this.childNodes.indexOf(reference);
    if (index < 0) return this.appendChild(child);
    child.parentNode?.removeChild?.(child);
    child.parentNode = this;
    this.childNodes.splice(index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index < 0) return child;
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  remove() { this.parentNode?.removeChild?.(this); }

  get textContent() {
    return this.childNodes.length
      ? this.childNodes.map((child) => child.textContent).join('')
      : this._textContent;
  }

  set textContent(value) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this._textContent = text(value);
  }

  getElementsByTagName(name) {
    const wanted = localName(name).toUpperCase();
    const out = [];
    const visit = (node) => {
      for (const child of node?.childNodes || []) {
        if (localName(child.localName || child.nodeName).toUpperCase() === wanted) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }

  querySelector(selector) {
    if (!/^[\w:.-]+$/.test(text(selector))) return null;
    return this.getElementsByTagName(selector)[0] || null;
  }

  cloneNode(deep = false) {
    const copy = new WeightBasisElement(this.nodeName, this.namespaceURI);
    for (const [name, value] of this.attributes) copy.attributes.set(name, value);
    copy._textContent = this._textContent;
    if (deep) for (const child of this.childNodes) copy.appendChild(child.cloneNode(true));
    return copy;
  }
}

class WeightBasisDocument {
  constructor(root = null) {
    this.nodeType = 9;
    this.documentElement = root;
    this.childNodes = root ? [root] : [];
    this.children = [...this.childNodes];
    if (root) root.parentNode = this;
  }

  createElement(name) { return new WeightBasisElement(name); }
  createElementNS(namespaceURI, name) { return new WeightBasisElement(name, namespaceURI); }

  removeChild(child) {
    if (this.documentElement !== child) return child;
    this.documentElement = null;
    this.childNodes = [];
    this.children = [];
    child.parentNode = null;
    return child;
  }

  getElementsByTagName(name) {
    if (!this.documentElement) return [];
    const wanted = localName(name).toUpperCase();
    const rootMatches = localName(this.documentElement.localName || this.documentElement.nodeName).toUpperCase() === wanted
      ? [this.documentElement] : [];
    return [...rootMatches, ...this.documentElement.getElementsByTagName(name)];
  }

  querySelector(selector) {
    return this.getElementsByTagName(selector)[0] || null;
  }

  cloneNode(deep = false) {
    return new WeightBasisDocument(this.documentElement?.cloneNode(deep) || null);
  }
}

function parseAttributes(source, element) {
  const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(source))) {
    element.setAttribute(match[1], decodeEntities(match[2] ?? match[3] ?? ''));
  }
}

function parserError(message) {
  const root = new WeightBasisElement('parsererror');
  root.textContent = message;
  return new WeightBasisDocument(root);
}

export function parseWeightBasisXml(xmlText) {
  const source = text(xmlText).replace(/^\uFEFF/, '');
  const tokens = source.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<[^>]+>|[^<]+/gi) || [];
  const stack = [];
  let root = null;
  try {
    for (const token of tokens) {
      if (!token || token.startsWith('<?') || token.startsWith('<!--') || /^<!DOCTYPE/i.test(token)) continue;
      if (token.startsWith('<![CDATA[')) {
        if (stack.length) stack[stack.length - 1]._textContent += token.slice(9, -3);
        continue;
      }
      if (token.startsWith('</')) {
        const closing = localName(token.slice(2, -1).trim()).toUpperCase();
        const current = stack.pop();
        if (!current || localName(current.nodeName).toUpperCase() !== closing) return parserError('Mismatched XML closing tag.');
        continue;
      }
      if (token.startsWith('<')) {
        const selfClosing = /\/>\s*$/.test(token);
        const body = token.slice(1, selfClosing ? -2 : -1).trim();
        const name = body.match(/^([^\s/>]+)/)?.[1];
        if (!name) continue;
        const element = new WeightBasisElement(name);
        parseAttributes(body.slice(name.length), element);
        if (!root) root = element;
        else if (!stack.length) return parserError('Multiple XML root elements.');
        if (stack.length) stack[stack.length - 1].appendChild(element);
        if (!selfClosing) stack.push(element);
        continue;
      }
      if (stack.length) stack[stack.length - 1]._textContent += decodeEntities(token);
    }
  } catch (error) {
    return parserError(error?.message || String(error));
  }
  if (!root || stack.length) return parserError('Incomplete XML document.');
  return new WeightBasisDocument(root);
}

function serializeElement(node) {
  const attrs = [...(node?.attributes || new Map()).entries()]
    .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join('');
  const body = `${node?._textContent ? escapeText(node._textContent) : ''}${(node?.childNodes || []).map(serializeElement).join('')}`;
  return body ? `<${node.nodeName}${attrs}>${body}</${node.nodeName}>` : `<${node.nodeName}${attrs}/>`;
}

export function serializeWeightBasisXml(node) {
  const root = node?.nodeType === 9 ? node.documentElement : node;
  return root ? serializeElement(root) : '';
}

export function installWeightBasisXmlDom(target = globalThis) {
  target.DOMParser = class {
    parseFromString(value) { return parseWeightBasisXml(value); }
  };
  target.XMLSerializer = class {
    serializeToString(node) { return serializeWeightBasisXml(node); }
  };
  return target;
}
