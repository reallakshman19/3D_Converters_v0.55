// Browser compatibility shim for the narrow Node crypto surface used by browser-loaded modules.
// This intentionally implements only createHash('sha256').update(...).digest('hex').
// It is deterministic hashing only; it does not provide signatures, identity, trust, or key custody.

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function bytesFrom(value, encoding = 'utf8') {
  if (typeof value === 'string') {
    if (encoding !== 'utf8' && encoding !== 'utf-8') {
      throw new TypeError(`browser-node-crypto only supports utf8 string input, received ${encoding}.`);
    }
    return new TextEncoder().encode(value);
  }
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  throw new TypeError('browser-node-crypto update() expects a string, ArrayBuffer, or typed-array view.');
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function sha256Hex(bytes) {
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;

  const bitLength = bytes.length * 8;
  const high = Math.floor(bitLength / 0x100000000) >>> 0;
  const low = bitLength >>> 0;
  for (let index = 0; index < 4; index += 1) {
    data[paddedLength - 8 + index] = (high >>> (24 - (index * 8))) & 0xff;
    data[paddedLength - 4 + index] = (low >>> (24 - (index * 8))) & 0xff;
  }

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + (index * 4);
      words[index] = (
        (data[cursor] << 24)
        | (data[cursor + 1] << 16)
        | (data[cursor + 2] << 8)
        | data[cursor + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = (rotateRight(words[index - 15], 7)
        ^ rotateRight(words[index - 15], 18)
        ^ (words[index - 15] >>> 3)) >>> 0;
      const s1 = (rotateRight(words[index - 2], 17)
        ^ rotateRight(words[index - 2], 19)
        ^ (words[index - 2] >>> 10)) >>> 0;
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const choice = ((e & f) ^ ((~e) & g)) >>> 0;
      const temp1 = (h + s1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const s0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('');
}

export function createHash(algorithm) {
  if (String(algorithm).toLowerCase() !== 'sha256') {
    throw new TypeError('browser-node-crypto only supports SHA-256.');
  }
  const parts = [];
  let digested = false;
  return {
    update(value, encoding = 'utf8') {
      if (digested) throw new Error('Digest already called.');
      parts.push(bytesFrom(value, encoding));
      return this;
    },
    digest(encoding = 'hex') {
      if (digested) throw new Error('Digest already called.');
      if (encoding !== 'hex') throw new TypeError('browser-node-crypto digest() only supports hex output.');
      digested = true;
      return sha256Hex(concatBytes(parts));
    },
  };
}
