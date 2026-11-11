/** Read-only Excel-style column filtering for the verified GC-PW Weight page.
 * Entire original physical population is evaluated inside its owning Worker.
 * No display draft, proposal or filtering action may accept a Final weight.
 */
export const XML229_WEIGHT_COLUMNS=Object.freeze([
 ['status','Status'],['shortName','Short name / Valve Hint'],['dtxr','DTXR'],
 ['branchName','Branch'],['lineKey','Line Key'],['componentType','ComponentType'],
 ['boreMm','Bore'],['rating','Rating'],['nodeNumber','Node'],
 ['componentRefNoEndpoint','ComponentRefNo_Endpoint'],['lengthMm','Length'],
 ['nearestSuggestions','Nearest Suggestions'],['appliedWeight','Applied Weight'],
].map(([key,label])=>Object.freeze({key,label,
 numeric:['boreMm','rating','nodeNumber','lengthMm','appliedWeight'].includes(key)})));
const COLUMNS=new Map(XML229_WEIGHT_COLUMNS.map(x=>[x.key,x]));
const BLANK='(Blanks)';
export const XML229_SHORT_ELEMENT_HIDE_LIMIT_MM=6;
/** Verified seven-field length.mm. Display-only: never alter the census or
 * interpret missing/malformed lengths as short or a zero-length element. */
export function isXml229VerifiedShortPhysical(meta,limitMm=XML229_SHORT_ELEMENT_HIDE_LIMIT_MM){
 const length=meta?.lengthMm;
 return typeof length==='number'&&Number.isFinite(length)&&length>=0&&length<=limitMm;
}
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const value=x=>x===null||x===undefined||String(x).trim()===''?BLANK:String(x).trim();
const mass=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export const xml229ExcelCell=(meta,{match1=null,final=null,hasSuggestions=null}={},column)=>{
 if(!COLUMNS.has(column))fail('WEIGHT_EXCEL_COLUMN_UNKNOWN');
 const acceptedFinal=final?.state==='accepted'&&mass(final.value);
 const acceptedMatch1=match1?.state==='accepted'&&positive(match1.value);
 const effective=acceptedFinal?final.value:
   acceptedMatch1?match1.value:positive(meta.sourceKg)?meta.sourceKg:null;
 switch(column){
  case 'status':return acceptedFinal?(final.value===0?'Final 0 kg (confirmed)':'Final reviewed'):
   acceptedMatch1?'Match-1 reviewed':positive(meta.sourceKg)?'Original XML mass':'No recorded mass';
  case 'shortName':return value(meta.shortName||meta.nodeName||meta.valveHint);
  case 'nearestSuggestions':return hasSuggestions===null?BLANK:
   hasSuggestions?'Has suggestions':'No suggestions';
  case 'appliedWeight':return value(effective);
  default:return value(meta[column]);
 }
};
/** Validate untrusted UI filter/sort payload without changing engineering scope. */
export function parseXml229ExcelRequest({columnFilters={},sort=null}={}){
 if(!columnFilters||typeof columnFilters!=='object'||Array.isArray(columnFilters))
  fail('WEIGHT_EXCEL_FILTER_INVALID');
 const entries=Object.entries(columnFilters);
 if(entries.length>XML229_WEIGHT_COLUMNS.length)
  fail('WEIGHT_EXCEL_FILTER_LIMIT');
 const filters=Object.create(null);
 for(const [key,criterion] of entries){
  if(!COLUMNS.has(key)||!criterion||typeof criterion!=='object'||
     Array.isArray(criterion)||Object.keys(criterion).some(k=>!['values','contains'].includes(k)))
   fail('WEIGHT_EXCEL_FILTER_INVALID');
  const current={};
  if(Object.hasOwn(criterion,'values')){
   if(!Array.isArray(criterion.values)||criterion.values.length>250||
      criterion.values.some(v=>typeof v!=='string'||v.length>200)||
      new Set(criterion.values).size!==criterion.values.length)
    fail('WEIGHT_EXCEL_VALUES_INVALID');
   current.values=criterion.values;
  }
  if(Object.hasOwn(criterion,'contains')){
   if(typeof criterion.contains!=='string'||criterion.contains.length>120)
    fail('WEIGHT_EXCEL_SEARCH_INVALID');
   if(criterion.contains.trim())current.contains=criterion.contains.trim().toLowerCase();
  }
  if(Object.keys(current).length)filters[key]=current;
 }
 let order=null;
 if(sort!==null&&sort!==undefined){
  if(!sort||typeof sort!=='object'||Array.isArray(sort)||
     !COLUMNS.has(sort.column)||!['asc','desc'].includes(sort.direction)||
     Object.keys(sort).some(k=>!['column','direction'].includes(k)))
   fail('WEIGHT_EXCEL_SORT_INVALID');
  order={column:sort.column,direction:sort.direction};
 }
 return {columnFilters:filters,sort:order};
}
export function matchesXml229ExcelColumns(cells,filters,omitColumn=null){
 for(const [column,filter] of Object.entries(filters)){
  if(column===omitColumn)continue;
  const cell=cells[column];
  if(cell===undefined)fail('WEIGHT_EXCEL_CELL_MISSING');
  if(filter.values&&!filter.values.includes(cell))return false;
  if(filter.contains&&!cell.toLowerCase().includes(filter.contains))return false;
 }
 return true;
}
export function sortXml229ExcelRows(rows,sort){
 if(!sort)return rows;
 const numeric=COLUMNS.get(sort.column).numeric,direction=sort.direction==='desc'?-1:1;
 return rows.sort((a,b)=>{
  const x=a.cells[sort.column],y=b.cells[sort.column];
  if(x===BLANK||y===BLANK)return x===y?a.index-b.index:x===BLANK?1:-1;
  const nx=Number(x),ny=Number(y);
  const cmp=numeric&&Number.isFinite(nx)&&Number.isFinite(ny)?
   nx-ny:x.localeCompare(y,undefined,{numeric:true,sensitivity:'base'});
  return cmp?Math.sign(cmp)*direction:a.index-b.index;
 });
}
export function xml229ExcelColumnOptions(rows,{column,columnFilters,search='',limit=250}={}){
 if(!COLUMNS.has(column)||typeof search!=='string'||search.length>120||
    !Number.isSafeInteger(limit)||limit<1||limit>250)
  fail('WEIGHT_EXCEL_OPTIONS_INVALID');
 const term=search.trim().toLowerCase(),counts=new Map();
 for(const row of rows){
  if(!matchesXml229ExcelColumns(row.cells,columnFilters,column))continue;
  const v=row.cells[column];
  if(v===undefined)fail('WEIGHT_EXCEL_CELL_MISSING');
  if(term&&!v.toLowerCase().includes(term))continue;
  counts.set(v,(counts.get(v)||0)+1);
 }
 const sorted=[...counts].sort(([a],[b])=>{
  if(a===BLANK)return -1;
  if(b===BLANK)return 1;
  return a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});
 });
 return {schema:'XML229.WeightExcelColumnOptions.v1',column,
  totalDistinct:sorted.length,truncated:sorted.length>limit,
  options:sorted.slice(0,limit).map(([value,count])=>({value,count}))};
}
