/** Physical bore is bound to an original occurrence, never a branch summary. */
export function indexXml229PhysicalBores(rows, originals, fail) {
 const index=new Map();
 for(const row of rows||[]) {
  const key=JSON.stringify([row.branchOccurrenceIndex,row.nodeOrdinal]);
  const original=originals.get(key);
  if(index.has(key)||!original||['nodeNumber','componentType','componentRefNo','endpoint']
    .some(k=>String(row[k]??'')!==String(original[k]??'')))
   fail('PHYSICAL_BORE_SOURCE_DRIFT','Bore authority must identify one original node');
  index.set(key,row);
 }
 return index;
}
export function xml229PhysicalBore(authority, matched, fail, body=null) {
 const positive=v=>v!==null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
 const bore=positive(body?.boreMm)??positive(authority?.boreMm);
 if(matched?.bodyBoreSourceNodeOrdinal!==undefined&&
    (!body||matched.bodyBoreSourceNodeOrdinal!==body.sourceNodeOrdinal||
     positive(matched.bodyOutsideDiameterMm)!==body.outsideDiameterMm||
     positive(matched.ownerPortBoreMm)!==positive(authority?.boreMm)))
  fail('PHYSICAL_BODY_BORE_SOURCE_DRIFT','Body bore must identify the original component span');
 if(matched&&positive(matched.boreMm)!==bore)
  fail('PHYSICAL_BORE_DRIFT','Physical Preview bore differs from original-node authority');
 return bore;
}
