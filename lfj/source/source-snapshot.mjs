/** LFJ/1.0 R03: DOM-free, immutable byte custody. No JSON parser, worker or exporter. */
export class SourceSnapshotError extends TypeError {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'SourceSnapshotError';
    this.code = code;
  }
}
const fail = (code, message) => { throw new SourceSnapshotError(code, message); };
const isCount = (n) => Number.isSafeInteger(n) && n >= 0;
// In-memory custody is explicitly small-source only. Use openBlobSourceSnapshot for larger inputs.
const MAX_RESIDENT_BYTES = 16*1024*1024;
const MAX_RESIDENT_SEGMENTS = 4096;
const K = Object.freeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotr = (x,n) => (x >>> n) | (x << (32 - n));

/** Streaming, constant-scratch SHA-256; validate via independent Node/WebCrypto oracle. */
class Sha256 {
  constructor() {
    this.h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    this.block = new Uint8Array(64);
    this.used = 0;
    this.total = 0n;
  }
  compress() {
    const w = new Uint32Array(64);
    for (let i=0; i<16; i++) {
      const j=i*4;
      w[i] = ((this.block[j]<<24)|(this.block[j+1]<<16)|(this.block[j+2]<<8)|this.block[j+3])>>>0;
    }
    for (let i=16; i<64; i++) {
      const x=w[i-15], y=w[i-2];
      const s0=rotr(x,7)^rotr(x,18)^(x>>>3);
      const s1=rotr(y,17)^rotr(y,19)^(y>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h]=this.h;
    for (let i=0; i<64; i++) {
      const s1=rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(h+s1+ch+K[i]+w[i])>>>0;
      const s0=rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj=(a&b)^(a&c)^(b&c);
      const t2=(s0+maj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    const q=[a,b,c,d,e,f,g,h];
    for (let i=0;i<8;i++) this.h[i]=(this.h[i]+q[i])>>>0;
  }
  update(input) {
    this.total += BigInt(input.length);
    let offset=0;
    while (offset<input.length) {
      const len=Math.min(64-this.used,input.length-offset);
      this.block.set(input.subarray(offset,offset+len),this.used);
      this.used+=len;offset+=len;
      if (this.used===64) { this.compress();this.used=0; }
    }
  }
  hex() {
    const lengthBits=this.total*8n;
    if (lengthBits >= (1n<<64n)) fail('RESOURCE_LIMIT','SHA-256 length exceeds 64-bit limit');
    this.block[this.used++]=0x80;
    if (this.used>56) {
      this.block.fill(0,this.used,64);
      this.compress();this.used=0;
    }
    this.block.fill(0,this.used,56);
    for (let i=0;i<8;i++) this.block[56+i]=Number((lengthBits>>BigInt((7-i)*8))&255n);
    this.compress();
    return this.h.map((x)=>x.toString(16).padStart(8,'0')).join('');
  }
}

/** The caller's generation is only one part of revision identity; bytes are authoritative. */
export function createSourceSnapshotBuilder({ byteLength, expectedSha256, revision, maxChunkBytes=1024*1024 }={}) {
  if (!isCount(byteLength)) fail('INVALID_DECLARATION','byteLength must be a safe nonnegative integer');
  if (byteLength>MAX_RESIDENT_BYTES) fail('SOURCE_RESIDENCY_LIMIT','large inputs need a Blob-backed source port');
  if (!isCount(maxChunkBytes)||maxChunkBytes===0||maxChunkBytes>1024*1024) fail('CHUNK_LIMIT','maxChunkBytes must be in 1..1MiB');
  if (typeof revision!=='string'||!revision.length) fail('INVALID_DECLARATION','revision is required');
  if (expectedSha256!==undefined && !/^[a-f0-9]{64}$/.test(expectedSha256)) fail('INVALID_DECLARATION','expected SHA-256 must be lowercase 64-hex');
  let state='OPEN', received=0, retained=[];
  const hasher=new Sha256();
  return Object.freeze({
    abort() {
      if (state==='ABORTED') return;
      if (state!=='OPEN') fail('SNAPSHOT_FINALIZED','completed sources must be closed via snapshot.close()');
      state='ABORTED';retained=[];
    },
    append(input,offset) {
      if (state==='ABORTED') fail('SOURCE_ABORTED','source intake has been aborted');
      if (state!=='OPEN') fail('SNAPSHOT_FINALIZED','source no longer accepts bytes');
      if (!(input instanceof Uint8Array)) fail('INVALID_CHUNK','chunk must be Uint8Array');
      if (!isCount(offset)||offset!==received) fail('CHUNK_SEQUENCE','chunk offset must equal next expected byte');
      if (!input.length || input.length>maxChunkBytes) fail('CHUNK_LIMIT','chunk size must be nonzero and bounded');
      if (received+input.length>byteLength) fail('SOURCE_OVERFLOW','chunk exceeds declared source length');
      if (retained.length>=MAX_RESIDENT_SEGMENTS) fail('SEGMENT_LIMIT','too many retained chunks; use bounded coalesced or Blob input');
      const immutableCopy=Uint8Array.from(input);
      retained.push({start:received,bytes:immutableCopy});
      hasher.update(immutableCopy);
      received+=input.length;
      return received;
    },
    finalize() {
      if (state==='ABORTED') fail('SOURCE_ABORTED','source intake has been aborted');
      if (state!=='OPEN') fail('SNAPSHOT_FINALIZED','snapshot finalized or invalid');
      if (received!==byteLength) fail('INCOMPLETE_SOURCE','cannot publish partial snapshot');
      const sha256=hasher.hex();
      if (expectedSha256!==undefined && expectedSha256!==sha256) {
        state='INVALID'; retained=[];
        fail('SOURCE_HASH_MISMATCH','computed SHA256 differs from declared source');
      }
      state='READY';
      const snapshotRevision=`${revision}:sha256:${sha256}`;
      const check=(expected)=>{
        if (state==='CLOSED') fail('SOURCE_CLOSED','source handle is closed');
        if (expected!==snapshotRevision) fail('STALE_REVISION','source revision does not match');
      };
      const read=(start,end,expected,limit)=>{
        check(expected);
        if (!isCount(start)||!isCount(end)||end<start||end>byteLength) fail('RANGE_INVALID','source byte range invalid');
        if (end-start>limit) fail('RANGE_LIMIT','read exceeds bounded span limit');
        const out=new Uint8Array(end-start);
        // Find first overlapping retained segment in O(log N), then visit only the matching span.
        let lo=0,hi=retained.length;
        while(lo<hi) {
          const mid=(lo+hi)>>>1, part=retained[mid];
          if(part.start+part.bytes.length<=start)lo=mid+1;
          else hi=mid;
        }
        for(let i=lo;i<retained.length;i++) {
          const chunk=retained[i];
          if(chunk.start>=end)break;
          const from=Math.max(chunk.start,start), to=Math.min(chunk.start+chunk.bytes.length,end);
          if(from<to)out.set(chunk.bytes.subarray(from-chunk.start,to-chunk.start),from-start);
        }
        return out;
      };
      return Object.freeze({
        schema:'LFJ.SourceSnapshot.v1', byteLength, sha256, revision:snapshotRevision,
        sourceId:`sha256:${sha256}`, encoding:'UTF-8',
        readRange(start,end,expectedRevision,maxSpanBytes=1024*1024) {
          if (!isCount(maxSpanBytes)||!maxSpanBytes||maxSpanBytes>1024*1024) fail('RANGE_LIMIT','maxSpanBytes must be in 1..1MiB');
          return read(start,end,expectedRevision,maxSpanBytes);
        },
        *readChunks(expectedRevision,chunkSize=1024*1024) {
          check(expectedRevision);
          if (!isCount(chunkSize)||!chunkSize||chunkSize>1024*1024) fail('CHUNK_LIMIT','read chunk must be 1..1MiB');
          for (let offset=0;offset<byteLength;offset+=chunkSize) yield read(offset,Math.min(offset+chunkSize,byteLength),expectedRevision,chunkSize);
        },
        close() { state='CLOSED';retained=[]; },
      });
    },
  });
}


/**
 * R03 large-source Blob/File custody port. The *immutable backing* lives with
 * Blob rather than duplicating the complete byte stream into retained JS chunks.
 * Its SHA is computed from exact original bytes in capped slices before READY.
 *
 * This port is intentionally I/O-only: R06 must run large scans away from the
 * browser foreground and supply worker cancellation/backpressure. The fact that
 * a Blob read is async does not by itself establish UI responsiveness.
 */
export async function openBlobSourceSnapshot(blob,{
  revision,expectedSha256,chunkBytes=1024*1024,signal=null,
}={}) {
  if (typeof Blob==='undefined'||!(blob instanceof Blob))
    fail('BLOB_REQUIRED','A real immutable Blob or File is required');
  if (!isCount(blob.size)) fail('INVALID_DECLARATION','Blob byte size must be a safe integer');
  if (typeof revision!=='string'||!revision.length)
    fail('INVALID_DECLARATION','source revision is required');
  if (!isCount(chunkBytes)||!chunkBytes||chunkBytes>1024*1024)
    fail('CHUNK_LIMIT','Blob scan slice must be in 1..1MiB');
  if (expectedSha256!==undefined&&!/^[a-f0-9]{64}$/.test(expectedSha256))
    fail('INVALID_DECLARATION','expected SHA-256 must be lowercase 64-hex');

  let state='OPEN';
  const live=()=> {
    if (signal?.aborted) { state='ABORTED';fail('SOURCE_ABORTED','source scan cancelled'); }
    if (state==='ABORTED') fail('SOURCE_ABORTED','source scan cancelled');
    if (state==='CLOSED') fail('SOURCE_CLOSED','source handle closed');
  };
  const sha=new Sha256();
  for (let offset=0;offset<blob.size;offset+=chunkBytes) {
    live();
    const end=Math.min(blob.size,offset+chunkBytes);
    const bytes=new Uint8Array(await blob.slice(offset,end).arrayBuffer());
    live();
    if (bytes.byteLength!==end-offset)fail('SOURCE_SIZE_DRIFT','Blob slice did not return exact byte range');
    sha.update(bytes);
  }
  live();
  const actual=sha.hex();
  if (expectedSha256!==undefined&&actual!==expectedSha256) {
    state='CLOSED';
    fail('SOURCE_HASH_MISMATCH','Blob bytes differ from attested source');
  }
  state='READY';
  const revisionId=`${revision}:sha256:${actual}`;
  function check(expectedRevision) {
    live();
    if (expectedRevision!==revisionId)fail('STALE_REVISION','source revision mismatch');
  }
  async function read(start,end,expectedRevision,limit) {
    check(expectedRevision);
    if (!isCount(start)||!isCount(end)||end<start||end>blob.size)
      fail('RANGE_INVALID','invalid source byte span');
    if (end-start>limit)fail('RANGE_LIMIT','large byte reads require bounded pages');
    const bytes=new Uint8Array(await blob.slice(start,end).arrayBuffer());
    check(expectedRevision);
    if (bytes.byteLength!==end-start)fail('SOURCE_SIZE_DRIFT','source backing read changed size');
    return bytes;
  }
  return Object.freeze({
    schema:'LFJ.SourceSnapshot.v1',
    backing:'immutable-blob',
    byteLength:blob.size,sha256:actual,sourceId:`sha256:${actual}`,
    revision:revisionId,encoding:'UTF-8',
    async readRange(start,end,expectedRevision,maxSpanBytes=1024*1024){
      if (!isCount(maxSpanBytes)||!maxSpanBytes||maxSpanBytes>1024*1024)
        fail('RANGE_LIMIT','maxSpanBytes must be in 1..1MiB');
      return read(start,end,expectedRevision,maxSpanBytes);
    },
    async *readChunks(expectedRevision,maxSpanBytes=1024*1024) {
      check(expectedRevision);
      if (!isCount(maxSpanBytes)||!maxSpanBytes||maxSpanBytes>1024*1024)
        fail('CHUNK_LIMIT','read chunk must be in 1..1MiB');
      for(let offset=0;offset<blob.size;offset+=maxSpanBytes)
        yield await read(offset,Math.min(offset+maxSpanBytes,blob.size),
          expectedRevision,maxSpanBytes);
    },
    close(){state='CLOSED';},
  });
}
