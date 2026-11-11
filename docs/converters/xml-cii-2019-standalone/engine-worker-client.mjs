/** Bounded, serialized Worker execution. Never run Python on the UI as fallback. */
import {restoreStandaloneEngineSifResult} from './engine-sif-result.mjs';
import {reportNativeRunPhase} from './engine-progress.mjs';

export const STANDALONE_ENGINE_TIMEOUT_MS = 300000;
const fault = code => Object.assign(new Error(code === 'STANDALONE_ENGINE_TIMEOUT'
  ? 'Conversion exceeded five minutes. Retry the conversion or use a smaller source.'
  : 'Conversion worker failed. Retry the conversion.'), {code});

function browserWorker() {
  if (typeof Worker !== 'function') throw fault('STANDALONE_ENGINE_WORKER_UNAVAILABLE');
  return new Worker(new URL('./engine-worker.mjs', import.meta.url),
    {type: 'module', name: 'xml-cii-2019-converter'});
}

export function createStandaloneEngineWorkerClient({
  workerFactory = browserWorker, timeoutMs = STANDALONE_ENGINE_TIMEOUT_MS,
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
    throw new Error('STANDALONE_ENGINE_TIMEOUT_INVALID');
  let worker = null, pending = null, nextId = 0, disposed = false;
  let queue = Promise.resolve();

  function stop(error) {
    const current = pending;
    if (current?.phase) error.phase = current.phase;
    pending = null;
    clearTimeout(current?.timer);
    worker?.terminate();
    worker = null;
    current?.reject(error);
  }

  function receive({data}) {
    if (pending && data?.kind === 'XML_CII_PROGRESS' && data.id === pending.id) {
      reportNativeRunPhase(phase => {
        if (pending.phase === phase) return;
        pending.phase = phase;
        reportNativeRunPhase(pending.onProgress, phase);
      }, data.phase);
      return;
    }
    if (!pending || data?.kind !== 'XML_CII_RESULT' || data.id !== pending.id) return;
    const current = pending;
    pending = null;
    clearTimeout(current.timer);
    if (data.error || !data.result || typeof data.result.ok !== 'boolean')
      current.reject(fault('STANDALONE_ENGINE_WORKER_FAILED'));
    else current.resolve(data.result);
  }

  function getWorker() {
    if (disposed) throw fault('STANDALONE_ENGINE_WORKER_CLOSED');
    if (!worker) {
      worker = workerFactory();
      const instance = worker;
      instance.addEventListener('message', event => { if (worker === instance) receive(event); });
      instance.addEventListener('error', () => {
        if (worker === instance) stop(fault('STANDALONE_ENGINE_WORKER_FAILED'));
      });
      instance.addEventListener('messageerror', () => {
        if (worker === instance) stop(fault('STANDALONE_ENGINE_MESSAGE_INVALID'));
      });
    }
    return worker;
  }

  function execute(job, runtime) {
    return new Promise((resolve, reject) => {
      try {
        const target = getWorker(), id = ++nextId;
        pending = {id, resolve, reject, onProgress: runtime.onProgress, timer: setTimeout(() =>
          stop(fault('STANDALONE_ENGINE_TIMEOUT')), timeoutMs)};
        target.postMessage({kind: 'XML_CII_RUN', id, job});
      } catch (error) {
        if (pending) stop(fault('STANDALONE_ENGINE_MESSAGE_INVALID'));
        else reject(error);
      }
    });
  }

  function run(job, runtime = {}) {
    reportNativeRunPhase(runtime.onProgress, 'ENGINE_QUEUED');
    const next = queue.then(() => execute(job, runtime)).then(result =>
      restoreStandaloneEngineSifResult(result, job));
    queue = next.then(() => undefined, () => undefined);
    return next;
  }

  return Object.freeze({run, dispose() {
    disposed = true;
    stop(fault('STANDALONE_ENGINE_WORKER_CLOSED'));
  }});
}

const client = createStandaloneEngineWorkerClient();
export function runStandaloneEngineWorkerJob(job, runtime) { return client.run(job, runtime); }
