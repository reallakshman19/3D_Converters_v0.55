// Exact semantic-hash algorithm used by reallaksh19/Advanced_Analysis at
// eabb93cd44c59ce182d73284cb707653917e07c8, reduced to the primitives needed
// by the P8 source adapter. FNV-1a 64-bit over strict canonical JSON.
const FNV_PRIME_LOW = 0x000001b3;
const FNV_PRIME_HIGH = 0x00000100;

export function canonicalStringifyAdvancedAnalysis(value) {
  return JSON.stringify(canonicalize(value, new Set(), '$'));
}

export function semanticHashAdvancedAnalysis(value) {
  return hashUtf8AdvancedAnalysis(canonicalStringifyAdvancedAnalysis(value));
}

export function hashUtf8AdvancedAnalysis(value) {
  const bytes = new TextEncoder().encode(String(value));
  let hi = 0xcbf29ce4 >>> 0;
  let lo = 0x84222325 >>> 0;
  for (let index = 0; index < bytes.length; index += 1) {
    lo = (lo ^ bytes[index]) >>> 0;
    const low16 = lo & 0xffff;
    const high16 = lo >>> 16;
    const partialLow = low16 * FNV_PRIME_LOW;
    const partialHigh = high16 * FNV_PRIME_LOW + (partialLow >>> 16);
    const nextLo = (((partialHigh & 0xffff) << 16) | (partialLow & 0xffff)) >>> 0;
    const carry = Math.floor(partialHigh / 0x10000);
    hi = (Math.imul(hi, FNV_PRIME_LOW) + Math.imul(lo, FNV_PRIME_HIGH) + carry) >>> 0;
    lo = nextLo;
  }
  return `fnv1a64:${hi.toString(16).padStart(8, '0')}${lo.toString(16).padStart(8, '0')}`;
}

function canonicalize(value, active, path) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Canonical JSON requires a finite number at ${path}.`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    assertNotActive(value, active, path);
    active.add(value);
    const result = value.map((child, index) => canonicalize(child, active, `${path}[${index}]`));
    active.delete(value);
    return result;
  }
  if (isPlainRecord(value)) {
    assertNotActive(value, active, path);
    active.add(value);
    const result = {};
    Object.keys(value).sort().forEach((key) => {
      if (value[key] !== undefined) result[key] = canonicalize(value[key], active, `${path}.${key}`);
    });
    active.delete(value);
    return result;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value} at ${path}.`);
}

function assertNotActive(value, active, path) {
  if (active.has(value)) throw new TypeError(`Canonical JSON cannot serialize a cycle at ${path}.`);
}

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
