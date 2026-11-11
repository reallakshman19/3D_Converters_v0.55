/** Resolve optional input custody without fabricating a JSON receipt or widening Mode B. */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {hasXml229PreviewJsonSource} from './xml229-preview-json-source.mjs';
import {resolveXml229CurrentPreviewBlob} from './xml-cii-adapted-lfj-o1-intake.js';
const deny=(code,message)=>{throw Object.assign(new Error(message),{code});};
export async function resolveXml229OptionalReviewCustody(raw,view,baseRef){
  if(raw?.xmlProcessingMode==='mode-b')deny('ORIGINAL_MODE_B_SCOPE_NOT_SUPPORTED',
    'Combined Mode B requires its separate authenticated multi-source review');
  const xmlOnly=!hasXml229PreviewJsonSource(raw)&&!hasXml229PreviewJsonSource(view);
  const source=xmlOnly?null:resolveXml229CurrentPreviewBlob(baseRef,raw.xml229StagedSourceReceipt);
  if(!xmlOnly&&!source)deny('ORIGINAL_O1_BLOB_REQUIRED','Selected JSON needs its current verified index');
  return {xmlOnly,source,sourceXmlSha256:await digestUtf8(raw.sourceText)};
}
