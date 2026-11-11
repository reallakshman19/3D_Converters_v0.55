/** Same native converter and serialized Pyodide state, isolated from the UI. */
import {runXmlCii2019StandaloneEngine} from './engine.js?v=20261001-single-weight-owners-1';
import {reportNativeRunPhase} from './engine-progress.mjs';

self.addEventListener('message', async ({data}) => {
  if (data?.kind !== 'XML_CII_RUN' || !Number.isSafeInteger(data.id)) return;
  try {
    const onProgress = phase => reportNativeRunPhase(value => self.postMessage({
      kind: 'XML_CII_PROGRESS', id: data.id, phase: value,
    }), phase);
    onProgress('WORKER_STARTED');
    // SIF text postprocessing needs the browser XML DOM. The client applies
    // it to this invocation's actual enriched artifact after computation.
    const result = await runXmlCii2019StandaloneEngine({...data.job, sifFacts: []}, {onProgress});
    self.postMessage({kind: 'XML_CII_RESULT', id: data.id, result});
  } catch {
    self.postMessage({kind: 'XML_CII_RESULT', id: data.id,
      error: 'STANDALONE_ENGINE_WORKER_FAILED'});
  }
});
