/**
 * W05: independent trusted native ingress test; not a mock of authored UI.
 * Blob.size override intentionally tests the BEFORE-ANY-BYTE-CONSUMPTION
 * gate without allocating or transferring 100MiB in a unit regression.
 * W04's actual Chromium File verifies real inclusive/exclusive bytes.
 */
import assert from 'node:assert/strict';
import {scanSourceInsideWorker,SOURCE_WORKER_SCHEMA,O1_SOURCE_MAX_BYTES} from '../lfj/ports/source-worker-port.mjs';

assert.equal(O1_SOURCE_MAX_BYTES,104857600,'Owner D-AIM-2 Option A exact byte ceiling');
const tinySource=new Blob(['{}'],{type:'application/json'});
Object.defineProperty(tinySource,'size',{value:104857601,configurable:true});
let provisionalPages=0;
await assert.rejects(
  scanSourceInsideWorker({
    schema:SOURCE_WORKER_SCHEMA,kind:'SCAN',
    jobId:'W05-oversize',sourceRefId:'owner-policy-probe',
    revision:'test-source-revision',blob:tinySource,pageEvents:1024
  },{publishPage:async()=>{provisionalPages++;}}),
  e=>e?.code==='O1_SOURCE_BYTE_LIMIT'&&e?.message==='O1_SOURCE_BYTE_LIMIT',
  'trusted native Worker must reject 104857601 byte Blob before any pages'
);
assert.equal(provisionalPages,0,'oversized sources must never stage provisional page data');
console.log('LFJ226_W05_NATIVE_BYTE_LIMIT PASS: 104857601 typed denial, zero pages; exact 104857600 owner limit');
