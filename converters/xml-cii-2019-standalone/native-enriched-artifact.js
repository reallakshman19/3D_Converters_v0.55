/** Read only this invocation's actual post-binding XML, including held CII. */
export function readNativeEnrichedArtifact(pyodide, path, enrichedName) {
 if(!path||!pyodide.FS.analyzePath(path).exists)return {};
 const enrichedText=pyodide.FS.readFile(path,{encoding:'utf8'});
 if(!enrichedText.trim())throw new Error('NATIVE_ENRICHED_OUTPUT_EMPTY');
 return {enrichedText,enrichedName};
}

/** No CII authority or unrelated engine fields travel with an XML artifact. */
export function nativeEnrichedFields(value) {
 return typeof value?.enrichedText==='string'&&value.enrichedText.trim()
  &&typeof value.enrichedName==='string'&&value.enrichedName.trim()
  ?{enrichedText:value.enrichedText,enrichedName:value.enrichedName}:{};
}
