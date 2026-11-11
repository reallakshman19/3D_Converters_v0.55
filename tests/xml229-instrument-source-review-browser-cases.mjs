/** Real DOM and download interaction. Controlled source; no native release claim. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function mountReview(page){
 return page.evaluate(async()=>{
  const {digestUtf8}=await import('/docs/contracts/gc-pw-v1/contract.mjs');
  const {createXml229InstrumentSourceReviewControl}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-instrument-source-review-ui.mjs');
  const node=(ref,ep,x)=>'<s:Node><s:ComponentType>INST</s:ComponentType>'+
   '<s:ComponentRefNo>'+ref+'</s:ComponentRefNo><s:Endpoint>'+ep+'</s:Endpoint>'+
   '<s:Position>'+x+' 0 0</s:Position><s:Weight>17</s:Weight></s:Node>';
  const source='\uFEFF<?xml version="1.0" encoding="UTF-8"?>\r\n'+
   '<s:PipeStressExport xmlns:s="urn:controlled"><!-- β <Node/> -->'+
   '<s:Note quoted=">"><![CDATA[</s:Node><Branch>]]></s:Note>'+ 
   '<s:Branch>'+node('A',1,0)+node('A',2,305)+node('B',1,1000)+node('B',2,1305)+
   '</s:Branch></s:PipeStressExport>';
  const owner=(ordinal,ref)=>({branchOccurrenceIndex:0,sourceNodeOrdinal:ordinal,
   componentType:'INST',componentRefNo:ref,spanMm:305,
   reason:'INSTRUMENT_RIGID_CLASSIFICATION_NOT_IN_SOURCE'});
  const report={sourceXmlSha256:await digestUtf8(source),unsupportedOwners:[owner(1,'A'),owner(3,'B')]};
  window.__instrumentSource={sourceText:source,sourceName:'controlled.xml',report,
   sourceFile:new File([source],'controlled.xml',{type:'application/xml'})};
  window.__instrumentOriginal=source;
  window.__instrumentFinals={A:17,B:17};
  const host=document.createElement('section');document.body.appendChild(host);
  host.appendChild(createXml229InstrumentSourceReviewControl({
   readCurrent:()=>({...window.__instrumentSource}),
  }));
  return {source,expected:source.replace(node('A',2,305),
   node('A',2,305).replace('</s:Node>','<s:Rigid>2</s:Rigid></s:Node>'))};
 });
}

async function verifyXmlDownload(page,expected){
 const choices=page.locator('[data-instrument-owner]');
 assert.equal(await choices.count(),2);
 assert.deepEqual(await choices.evaluateAll(ns=>ns.map(n=>n.checked)),[false,false]);
 const create=page.locator('[data-action="xml229-create-instrument-source"]');
 assert.equal(await create.isDisabled(),true);
 await choices.nth(0).check();assert.equal(await create.isDisabled(),false);
 const download=page.waitForEvent('download');await create.click();
 const file=await download;
 assert.match(file.suggestedFilename(),/^controlled\.instrument-model-[a-f0-9]{8}\.xml$/);
 assert.equal(await readFile(await file.path(),'utf8'),expected);
 const receiptDownload=page.waitForEvent('download');
 await page.locator('[data-action="xml229-instrument-revision-receipt"]').click();
 const receipt=JSON.parse(await readFile(await (await receiptDownload).path(),'utf8'));
 assert.equal(receipt.selectedCount,1);assert.equal(receipt.remainingBlockedOwners,1);
 assert.equal(receipt.kilogramsAccepted,false);assert.equal(receipt.reusablePreviousWeightReview,false);
 assert.equal(receipt.engineeringApprovalVerified,false);assert.equal(receipt.nativeCiiReleaseAuthorized,false);
 assert.deepEqual(await page.evaluate(()=>window.__instrumentFinals),{A:17,B:17});
 assert.equal(await page.evaluate(()=>window.__instrumentSource.sourceText===window.__instrumentOriginal),true);
}

async function verifyStaleSource(page){
 let downloads=0;const onDownload=()=>downloads++;page.on('download',onDownload);
 await page.evaluate(()=>{window.__instrumentSource.sourceText+=' ';});
 await page.locator('[data-action="xml229-create-instrument-source"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')]
  .some(n=>n.textContent.includes('INSTRUMENT_SOURCE_REVIEW_STALE')));
 assert.equal(downloads,0);
 await page.locator('[data-action="xml229-review-instrument-source"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')]
  .some(n=>n.textContent.includes('Source review unavailable: INSTRUMENT_SOURCE_REVIEW_STALE')));
 assert.equal(await page.locator('[data-instrument-owner]').count(),0);
 // A different real file and matching text pass the file/text conflict guard,
 // then must still fail against the old source-bound receipt hash.
 await page.evaluate(()=>{window.__instrumentSource.sourceFile=new File(
  [window.__instrumentSource.sourceText],'changed.xml',{type:'application/xml'});});
 await page.locator('[data-action="xml229-review-instrument-source"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')]
  .some(n=>n.textContent.includes('INSTRUMENT_SOURCE_SHA_MISMATCH')));
 assert.equal(await page.locator('[data-instrument-owner]').count(),0);
 page.off('download',onDownload);
}

export async function runXml229InstrumentSourceBrowserCases(page){
 const {expected}=await mountReview(page);
 await page.locator('[data-action="xml229-review-instrument-source"]').click();
 await page.locator('[data-instrument-owner]').first().waitFor();
 await verifyXmlDownload(page,expected);await verifyStaleSource(page);
 console.log(JSON.stringify({schema:'XML229.BrowserInstrumentSourceReviewProof.v1',
  uncheckedByDefault:true,explicitOneSelected:true,realXmlDownload:true,
  uploadedFileBytesVerified:true,conflictingFileTextRefused:true,
  prefixedBomCommentsCdataPreserved:true,staleSourceRefused:true,oldFinalsUntouched:true,
  sourceActivated:false,nativeCiiReleaseAuthorized:false}));
}
