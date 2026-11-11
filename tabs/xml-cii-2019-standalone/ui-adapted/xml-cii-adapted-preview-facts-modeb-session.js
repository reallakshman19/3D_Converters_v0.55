// P3-B3B2A: replaceable, DOM-free orchestration of an attested Mode B local
// worker session. Source census is delegated to a separate XML-domain adapter.
// This is not a UI button binder and never declares engineering acceptance.
import {prepareModeBPreviewBasis,assertModeBPreviewBasisFresh}
  from './xml-cii-adapted-preview-facts-modeb-basis.js';
import {createXmlCiiPreviewJobController}
  from './xml-cii-adapted-preview-facts-job-controller.js';
import {openAttestedModeBOriginalFactPages}
  from './xml-cii-adapted-preview-facts-modeb-source-pages.js';

const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const verify=(ok,code,message)=>{if(!ok)fail(code,message);};

/**
 * The caller must provide actual original-source bytes, combined XML,
 * a Mode B manifest attested from the combiner, and a config binding the
 * manifest. A synthetic pipe-count-only basis will be rejected before Worker.
 */
export async function startAttestedModeBPreviewWorkerSession({
  originalSources,combinedSource,manifest,config,stagedJsonText=null,ports,
  requestId,createController=createXmlCiiPreviewJobController,onProgress=()=>{},
}={}) {
  verify(typeof requestId==='string'&&requestId.trim(),
    'INVALID_REQUEST_ID','Mode B worker requestId required');
  verify(typeof createController==='function'&&typeof onProgress==='function',
    'INVALID_EXECUTOR_PORT','A replaceable controller and progress observer are required');
  const input={originalSources,combinedSource,manifest,config,stagedJsonText,ports};
  const prepared=await prepareModeBPreviewBasis(input);
  const {basis,custody,scope}=prepared;
  const controller=createController({
    verifyBasis:async(candidate,spec)=>{
      if(candidate?.basisId!==basis.basisId
        ||spec?.input?.scope?.mode!=='B'
        ||spec?.input?.scope?.sourceId!==combinedSource.sourceId)
        return false;
      await assertModeBPreviewBasisFresh(prepared,input);
      return true;
    },
  });
  verify(typeof controller?.start==='function'
    &&typeof controller?.subscribe==='function'
    &&typeof controller?.cancel==='function'
    &&typeof controller?.dispose==='function',
    'INVALID_EXECUTOR_PORT','Mode B controller must support start/subscribe/cancel/dispose');
  const unsubscribe=controller.subscribe(event=>{
    if(event?.basisId===basis.basisId
      &&['queued','running','failed','cancelled','completed'].includes(event.state))
      onProgress(event);
  });
  let handle;
  try {
    // Reattest immediately before dispatch, not merely when preparing input.
    await assertModeBPreviewBasisFresh(prepared,input);
    handle=controller.start({requestId,basis,input:{
      xmlText:combinedSource.xmlText,config,stagedJsonText:stagedJsonText??'',
      scope,
    }});
    verify(typeof handle?.promise?.then==='function',
      'INVALID_WORKER_HANDLE','Worker handle lacks a Promise');
  } catch(error) {
    unsubscribe?.();controller.dispose();throw error;
  }
  const promise=Promise.resolve(handle.promise).then(async result=>{
    verify(result?.engineeringAcceptance==='NOT_ASSESSED'
      &&result?.fullFactPopulationAccepted===false,
      'WORKER_AUTHORITY_DRIFT','Worker is not permitted to assert engineering acceptance');
    await assertModeBPreviewBasisFresh(prepared,input);
    const sourcePages=await openAttestedModeBOriginalFactPages({
      basis,custody,originalSources,sourceOccurrences:result.sourceOccurrences,
    });
    // A changed original/master during the asynchronous fact-store open also
    // invalidates this result. Do not render a stale completed worker output.
    await assertModeBPreviewBasisFresh(prepared,input);
    return Object.freeze({basis,custody,sourcePages,result,
      engineeringReady:false,requestId});
  }).finally(()=>{unsubscribe?.();controller.dispose();});
  return Object.freeze({
    basis,requestId,promise,
    cancel:()=>controller.cancel('Mode B Preview cancelled'),
    getSnapshot:()=>controller.getSnapshot?.()||null,
  });
}
