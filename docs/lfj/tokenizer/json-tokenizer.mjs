/**
 * LFJ R04/U01 incremental byte cursor and bounded JSON string tokenizer.
 * No JSON.parse, no full-document or fake AST array, no engineering rights.
 * U01 escaped strings, U02 complete Unicode, U03 complete JSON grammar,
 * U04 limited scan budgets/cancellation. No full-document DOM is constructed.
 */
export class JsonTokenError extends SyntaxError {
  constructor(code,offset,detail){
    super(code+' at original byte '+offset+': '+detail);
    this.name='JsonTokenError';this.code=code;this.byteOffset=offset;
  }
}
const fail=(code,offset,detail)=>{throw new JsonTokenError(code,offset,detail);};
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const MAX_PAGE=1024*1024;

/** Cursor fetches only one bounded original-byte page at a time. */
export function createJsonByteCursor(snapshot,{
  startByte=0,pageBytes=65536,signal=null,
}={}) {
  if(!snapshot||!safe(snapshot.byteLength)||typeof snapshot.revision!=='string'
      ||!snapshot.revision||typeof snapshot.sha256!=='string'
      ||typeof snapshot.readRange!=='function')
    fail('INVALID_BYTE_SOURCE',0,'R03 byte snapshot required');
  if(!safe(startByte)||startByte>snapshot.byteLength)
    fail('INVALID_START',0,'start byte is outside original source');
  if(!safe(pageBytes)||pageBytes===0||pageBytes>MAX_PAGE)
    fail('PAGE_LIMIT',startByte,'page budget must be 1..1MiB');
  let offset=startByte,pageStart=startByte,page=new Uint8Array(0);
  function checkAbort(){
    if(signal?.aborted)fail('SCAN_ABORTED',offset,'source scan was cancelled');
  }
  async function ensure() {
    checkAbort();
    if(offset>=snapshot.byteLength)return false;
    if(offset<pageStart||offset>=pageStart+page.length){
      const end=Math.min(snapshot.byteLength,offset+pageBytes);
      const read=await snapshot.readRange(offset,end,snapshot.revision);
      checkAbort();
      if(!(read instanceof Uint8Array)||read.length!==end-offset)
        fail('INVALID_BYTE_SOURCE',offset,'R03 returned an invalid original-byte range');
      pageStart=offset;page=read;
    }
    return true;
  }
  return Object.freeze({
    sourceSha256:snapshot.sha256,sourceRevision:snapshot.revision,
    byteLength:snapshot.byteLength,
    get position(){return offset;},
    async peek(){if(!await ensure())return null;return page[offset-pageStart];},
    async take(){
      if(!await ensure())return null;
      const value=page[offset-pageStart];offset++;return value;
    },
  });
}

// A U+FEFF *inside* quoted JSON data is a real source character, not a file BOM.
// Default TextDecoder stripping silently changes such source values.
const utf8=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const singleEscapes=Object.freeze({
  34:'"',92:'\\',47:'/',98:'\b',102:'\f',110:'\n',114:'\r',116:'\t',
});
function hexDigit(c){
  if(c>=48&&c<=57)return c-48;
  if(c>=65&&c<=70)return c-55;
  if(c>=97&&c<=102)return c-87;
  return -1;
}

/**
 * Scan exactly one quoted JSON token at the cursor's current original-byte offset.
 * All split source/read chunks preserve the same result and half-open byte span.
 */
export async function scanQuotedJsonString(cursor,{maxTokenBytes=65536}={}) {
  if(!cursor||typeof cursor.peek!=='function'||typeof cursor.take!=='function'
    ||!safe(cursor.position))fail('INVALID_CURSOR',0,'byte cursor required');
  if(!safe(maxTokenBytes)||maxTokenBytes===0||maxTokenBytes>MAX_PAGE)
    fail('TOKEN_LIMIT',cursor.position,'token bytes must be in 1..1MiB');
  const start=cursor.position;
  const take=async()=>{
    if(cursor.position-start>=maxTokenBytes)
      fail('TOKEN_LIMIT',cursor.position,'quoted scalar exceeded byte cap');
    return cursor.take();
  };
  if(await cursor.peek()!==34)fail('EXPECTED_QUOTE',start,'quoted token must start with double quote');
  await take();
  const out=[],raw=[];
  function flush(){
    if(raw.length===0)return;
    try {out.push(utf8.decode(Uint8Array.from(raw)));}
    catch {fail('INVALID_UTF8',cursor.position,'malformed or truncated UTF8 in scalar');}
    raw.length=0;
  }
  async function readHex(){
    let cp=0;
    for(let i=0;i<4;i++){
      const c=await take();
      const h=hexDigit(c);
      if(c===null||h<0)
        fail('INVALID_UNICODE_ESCAPE',cursor.position,'\\u requires four hexadecimal digits');
      cp=(cp<<4)|h;
    }
    return cp;
  }
  while(true){
    const byte=await cursor.peek();
    if(byte===null)fail('UNTERMINATED_STRING',cursor.position,'quoted scalar has no terminating quote');
    if(byte===34){
      flush();await take();
      return Object.freeze({
        type:'string',startByte:start,endByteExclusive:cursor.position,
        value:out.join(''),sourceSha256:cursor.sourceSha256,
        sourceRevision:cursor.sourceRevision,
      });
    }
    if(byte===92){
      flush();await take();
      const escaped=await take();
      if(escaped===null)fail('UNTERMINATED_STRING',cursor.position,'escape has no next byte');
      if(escaped===117){
        let high=await readHex();
        if(high>=0xD800&&high<=0xDBFF){
          if(await take()!==92||await take()!==117)
            fail('INVALID_SURROGATE',cursor.position,'high surrogate requires low \\u escape');
          const low=await readHex();
          if(low<0xDC00||low>0xDFFF)
            fail('INVALID_SURROGATE',cursor.position,'invalid low surrogate');
          high=0x10000+((high-0xD800)<<10)+(low-0xDC00);
        } else if(high>=0xDC00&&high<=0xDFFF){
          fail('INVALID_SURROGATE',cursor.position,'isolated low surrogate');
        }
        out.push(String.fromCodePoint(high));
      } else {
        if(!Object.hasOwn(singleEscapes,escaped))
          fail('INVALID_ESCAPE',cursor.position,'unsupported JSON string escape');
        out.push(singleEscapes[escaped]);
      }
      continue;
    }
    if(byte<32)fail('UNESCAPED_CONTROL',cursor.position,'raw JSON string control byte');
    raw.push(await take());
  }
}


/**
 * R04/U03 complete JSON grammar over the exact R03 byte port.
 * No JSON.parse, no AST of nested values, no file-wide token buffering.
 * onToken is an optional backpressured event sink; R05 owns occurrence indexing.
 * RootFacts are published ONLY after closure and exact EOF validation.
 *
 * Fixed defensive depth/token hard stops are provisional until R04/U04
 * independently qualifies configurable global resource budgets.
 */
const ROOT_FIELDS=new Set([
  'hierarchy','branches','objects','type','children',
  'schema','profile','converter','converterSchema','units',
]);
const ASCII_WS=new Set([9,10,13,32]);
const digit=b=>b!==null&&b>=48&&b<=57;
const nonzero=b=>b!==null&&b>=49&&b<=57;

export async function scanJsonDocument(snapshot,{
  pageBytes=65536,maxTokenBytes=65536,onToken=null,signal=null,
  maxDepth=256,maxTokens=128*1024*1024,maxByteLength=128*1024*1024,
  maxObjectKeys=8192,maxObjectKeyBytes=1024*1024,
  maxRetainedKeyBytes=4*1024*1024,
}={}) {
  if(onToken!==null&&typeof onToken!=='function')
    fail('INVALID_TOKEN_SINK',0,'onToken must be a callable sink');
  // Policy ceilings cannot be enlarged by an untrusted caller. These are
  // protective defaults, not reference-hardware performance acceptance SLOs.
  if(!safe(maxDepth)||maxDepth===0||maxDepth>256||
     !safe(maxTokens)||maxTokens===0||maxTokens>512*1024*1024||
     !safe(maxByteLength)||maxByteLength===0||maxByteLength>512*1024*1024||
     !safe(maxTokenBytes)||maxTokenBytes===0||maxTokenBytes>MAX_PAGE||
     !safe(maxObjectKeys)||maxObjectKeys===0||maxObjectKeys>8192||
     !safe(maxObjectKeyBytes)||maxObjectKeyBytes===0||maxObjectKeyBytes>1024*1024||
     !safe(maxRetainedKeyBytes)||maxRetainedKeyBytes===0||maxRetainedKeyBytes>4*1024*1024)
    fail('INVALID_RESOURCE_LIMIT',0,'depth/tokens/original-byte caps are invalid or too large');
  if(!snapshot||!safe(snapshot.byteLength))
    fail('INVALID_BYTE_SOURCE',0,'valid R03 snapshot length is required');
  if(snapshot.byteLength>maxByteLength)
    fail('BYTE_LIMIT',0,'original input exceeds declared byte budget');
  const cursor=createJsonByteCursor(snapshot,{pageBytes,signal});
  const checkSignal=()=>{
    if(signal?.aborted)fail('SCAN_ABORTED',cursor.position,'scan was cancelled');
  };
  checkSignal();
  let tokenCount=0,activeKeyBytes=0;
  const skip=async()=>{
    while(ASCII_WS.has(await cursor.peek()))await cursor.take();
  };
  const publish=async(type,start,value)=>{
    checkSignal();
    if(++tokenCount>maxTokens)fail('TOKEN_COUNT_LIMIT',start,'maximum structural tokens exceeded');
    if(onToken!==null)await onToken(Object.freeze({
      type,startByte:start,endByteExclusive:cursor.position,
      ...(value!==undefined?{value}:{}),
      sourceSha256:cursor.sourceSha256,sourceRevision:cursor.sourceRevision,
    }));
    checkSignal(); // an asynchronous sink may have cancelled while awaiting output
  };
  const quoted=async(type)=>{
    const token=await scanQuotedJsonString(cursor,{maxTokenBytes});
    await publish(type,token.startByte,token.value);
    return token.value;
  };
  const literal=async(word,value)=>{
    const start=cursor.position;
    for(let i=0;i<word.length;i++){
      if(await cursor.take()!==word.charCodeAt(i))
        fail('INVALID_LITERAL',cursor.position,'invalid JSON literal '+word);
    }
    await publish(value===null?'null':'boolean',start,value);
    return value===null?{type:'null'}:{type:'boolean',value};
  };
  const number=async()=>{
    const start=cursor.position;
    let raw='';
    const take=async()=>{
      if(cursor.position-start>=maxTokenBytes)
        fail('TOKEN_LIMIT',cursor.position,'numeric original-byte token exceeds cap');
      const b=await cursor.take();raw+=String.fromCharCode(b);return b;
    };
    if(await cursor.peek()===45)await take();
    let p=await cursor.peek();
    if(p===48)await take();
    else if(nonzero(p)){
      do {await take();p=await cursor.peek();} while(digit(p));
    }else fail('INVALID_NUMBER',cursor.position,'number requires an integer part');
    if(await cursor.peek()===46){
      await take();
      if(!digit(await cursor.peek()))
        fail('INVALID_NUMBER',cursor.position,'fraction requires at least one digit');
      while(digit(await cursor.peek()))await take();
    }
    p=await cursor.peek();
    if(p===69||p===101){
      await take();p=await cursor.peek();
      if(p===43||p===45)await take();
      if(!digit(await cursor.peek()))
        fail('INVALID_NUMBER',cursor.position,'exponent requires a digit');
      while(digit(await cursor.peek()))await take();
    }
    await publish('number',start,raw); // exact decimal lexeme; do NOT round numeric engineering facts
    return {type:'number'};
  };
  async function parseValue(depth,capture=null) {
    checkSignal();
    if(depth>maxDepth)fail('DEPTH_LIMIT',cursor.position,'nested values exceed protected depth');
    await skip();
    const p=await cursor.peek();
    if(p===null)fail('EXPECTED_VALUE',cursor.position,'truncated JSON value');
    if(p===34)return {type:'string',value:await quoted('string')};
    if(p===123)return parseObject(depth,capture);
    if(p===91)return parseArray(depth);
    if(p===116)return literal('true',true);
    if(p===102)return literal('false',false);
    if(p===110)return literal('null',null);
    if(p===45||digit(p))return number();
    fail('EXPECTED_VALUE',cursor.position,'expected JSON value');
  }
  async function parseArray(depth){
    const start=cursor.position;await cursor.take();await publish('start-array',start);
    let count=0;
    await skip();
    if(await cursor.peek()===93){
      const pos=cursor.position;await cursor.take();await publish('end-array',pos);
      return {type:'array',count};
    }
    while(true){
      await parseValue(depth+1);
      count++;
      if(!Number.isSafeInteger(count))
        fail('COUNT_LIMIT',cursor.position,'array length exceeds safe integer');
      await skip();
      const p=await cursor.peek();
      if(p===93){const pos=cursor.position;await cursor.take();await publish('end-array',pos);break;}
      if(p!==44)fail('EXPECTED_ARRAY_SEPARATOR',cursor.position,'expected comma or closing bracket');
      const pos=cursor.position;await cursor.take();await publish('comma',pos);
    }
    return {type:'array',count};
  }
  async function parseObject(depth,capture){
    const start=cursor.position;await cursor.take();await publish('start-object',start);
    // Each active object remembers exact decoded property names for duplicate
    // detection, but both local breadth and aggregate retained key bytes are
    // bounded. Data cannot bypass limits by nesting many small objects.
    const seen=new Set(),fields=Object.create(null);
    let ownKeyBytes=0;
    await skip();
    if(await cursor.peek()===125){
      const pos=cursor.position;await cursor.take();await publish('end-object',pos);
      return {type:'object',fields};
    }
    while(true){
      if(await cursor.peek()!==34)fail('EXPECTED_KEY',cursor.position,'object key must be quoted');
      const keyStart=cursor.position;
      const key=await quoted('key');
      if(seen.has(key))fail('DUPLICATE_JSON_KEY',cursor.position,'JSON object has repeated decoded key');
      if(seen.size>=maxObjectKeys)
        fail('OBJECT_KEYS_LIMIT',keyStart,'source object has too many distinct own keys');
      const ownBytes=cursor.position-keyStart;
      if(ownKeyBytes+ownBytes>maxObjectKeyBytes)
        fail('OBJECT_KEY_BYTES_LIMIT',keyStart,'original own-key byte budget exceeded');
      if(activeKeyBytes+ownBytes>maxRetainedKeyBytes)
        fail('RETAINED_KEY_BYTES_LIMIT',keyStart,'simultaneous nested own-key bytes exceeded');
      ownKeyBytes+=ownBytes;activeKeyBytes+=ownBytes;
      seen.add(key);
      await skip();
      if(await cursor.peek()!==58)fail('EXPECTED_COLON',cursor.position,'object key missing colon');
      const colon=cursor.position;await cursor.take();await publish('colon',colon);
      const keep=capture==='root'?ROOT_FIELDS.has(key):capture==='units'&&key==='length';
      const nextCapture=keep&&key==='units'&&capture==='root'?'units':null;
      const descriptor=await parseValue(depth+1,nextCapture);
      if(keep){
        if(descriptor.type==='array')fields[key]={type:'array',count:descriptor.count};
        else if(descriptor.type==='object')fields[key]={type:'object',fields:descriptor.fields};
        else if(descriptor.type==='string')fields[key]={type:'string',value:descriptor.value};
        else fields[key]={type:descriptor.type};
      }
      await skip();
      const p=await cursor.peek();
      if(p===125){const pos=cursor.position;await cursor.take();await publish('end-object',pos);break;}
      if(p!==44)fail('EXPECTED_OBJECT_SEPARATOR',cursor.position,'expected comma or closing brace');
      const pos=cursor.position;await cursor.take();await publish('comma',pos);
      await skip();
    }
    activeKeyBytes-=ownKeyBytes;
    return {type:'object',fields:{...fields}};
  }
  await skip();
  const root=await parseValue(0,'root');
  await skip();
  checkSignal();
  if(await cursor.peek()!==null)
    fail('TRAILING_CONTENT',cursor.position,'non-whitespace bytes follow complete JSON');
  checkSignal();
  // The cursor may still hold a cached last page when another client closes
  // the R03 store. Re-attest source liveness on exact EOF before RootFacts READY.
  await snapshot.readRange(0,0,cursor.sourceRevision);
  checkSignal();
  const rootFacts={
    schemaVersion:'lfj-token-root-facts/v1',
    rootType:root.type,complete:true,duplicateRootKeys:false,
    ...(root.type==='object'?{fields:root.fields}:{}),
    ...(root.type==='array'?{rootCount:root.count}:{}),
  };
  return Object.freeze({
    schema:'lfj-json-document-scan/v1',
    complete:true,sourceSha256:cursor.sourceSha256,sourceRevision:cursor.sourceRevision,
    endByteExclusive:cursor.position,tokenCount,
    rootFacts:Object.freeze(rootFacts),
  });
}
