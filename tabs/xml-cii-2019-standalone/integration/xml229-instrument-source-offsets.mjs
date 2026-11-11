/** Locate direct Branch/Node closing tags without reserializing XML.
 * DOM validation and source identities are checked separately by the caller.
 */
const fail=()=>{throw new Error('INSTRUMENT_SOURCE_XML_STRUCTURE_INVALID');};
const local=qname=>qname.replace(/^.*:/,'');

function tagEnd(xml,start){
 let quote='';
 for(let i=start+1;i<xml.length;i++){
  const c=xml[i];
  if(quote){if(c===quote)quote='';}
  else if(c==='"'||c==="'")quote=c;
  else if(c==='>')return i+1;
 }
 fail();
}

function skippedEnd(xml,start){
 for(const [open,close] of [['<!--','-->'],['<![CDATA[',']]>'],['<?','?>']]){
  if(!xml.startsWith(open,start))continue;
  const end=xml.indexOf(close,start+open.length);
  if(end<0)fail();
  return end+close.length;
 }
 // No DTD/entity expansion or declaration other than a PI is admitted.
 if(xml.startsWith('<!',start))fail();
 return null;
}

function closeFrame(stack,qname,offset,locations){
 const frame=stack.pop();
 if(!frame||frame.qname!==qname)fail();
 if(frame.identity){
  if(locations.has(frame.identity))fail();
  locations.set(frame.identity,{offset,qname});
 }
}

export function xml229InstrumentNodeClosings(xml){
 const stack=[],locations=new Map();
 let cursor=0,branch=-1;
 while(cursor<xml.length){
  const start=xml.indexOf('<',cursor);
  if(start<0)break;
  const skipped=skippedEnd(xml,start);
  if(skipped!==null){cursor=skipped;continue;}
  const end=tagEnd(xml,start),tag=xml.slice(start,end);
  const closing=/^<\/([^\s/>]+)\s*>$/.exec(tag);
  if(closing){closeFrame(stack,closing[1],start,locations);cursor=end;continue;}
  const qname=/^<([^\s/>]+)/.exec(tag)?.[1];
  if(!qname)fail();
  const parent=stack.at(-1),frame={qname,local:local(qname)};
  if(frame.local==='Branch'){frame.branch=++branch;frame.nextNode=0;}
  if(frame.local==='Node'&&parent?.local==='Branch')
   frame.identity=JSON.stringify([parent.branch,parent.nextNode++]);
  stack.push(frame);
  if(/\/\s*>$/.test(tag))closeFrame(stack,qname,null,locations);
  cursor=end;
 }
 if(stack.length)fail();
 return locations;
}
