/** PSI116 OLET direction witnesses are not serial pipe vertices.
 * Qualify the complete source group before removing anonymous helper records
 * from the pre-Final working route. Original source bytes/ordinals stay intact.
 */
const types=new Set(['OLET','WELDOLET','SOCKOLET']);
const name=n=>String(n?.localName||n?.nodeName||'').replace(/^.*:/,'');
const children=(p,k)=>[...(p?.childNodes||[])]
  .filter(n=>n.nodeType===1&&name(n)===k);
const field=(p,k)=>String(children(p,k)[0]?.textContent??'').trim();
const kind=n=>field(n,'ComponentType').toUpperCase();
const ref=n=>field(n,'ComponentRefNo').replace(/^=/,'').replace(/\s+/g,'').toUpperCase();
const point=n=>{
  const raw=field(n,'Position').split(/\s+/);
  const xyz=raw.map(Number);
  return raw.length===3&&raw.every(Boolean)&&xyz.every(Number.isFinite)?xyz:null;
};
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));

function isHelperGroup(group){
  if(group.length!==4||!ref(group[0])||!types.has(kind(group[0]))||
     group.map(n=>field(n,'Endpoint')).join(',')!=='1,3,0,2'||
     field(group[1],'NodeNumber')!=='-1')return false;
  const junction=Number(field(group[2],'NodeNumber'));
  if(!Number.isSafeInteger(junction)||junction<=0)return false;
  const points=group.map(point);
  return points.every(Boolean)&&distance(points[0],points[2])<=1e-6&&
    distance(points[3],points[2])<=1e-6;
}

function assertNoHelperAuthority(node){
  const weight=Number(field(node,'Weight')||'0');
  const rigid=field(node,'Rigid');
  if(field(node,'NodeName')||children(node,'Restraint').length||
     !Number.isFinite(weight)||weight!==0||(rigid&&rigid!=='0')){
    throw Object.assign(new Error(
      'OLET helper carries named, restraint, rigid or mass authority; route cleanup blocked.'),
    {code:'OLET_HELPER_AUTHORITY_CONFLICT'});
  }
}

export function xml229OletRouteHelpers(branchNodes){
  const helpers=new Set();
  for(let start=0;start<branchNodes.length;){
    let end=start+1;
    while(end<branchNodes.length&&kind(branchNodes[end])===kind(branchNodes[start])&&
          ref(branchNodes[end])===ref(branchNodes[start]))end++;
    const group=branchNodes.slice(start,end);
    if(isHelperGroup(group)){
      for(const node of group){
        if(field(node,'NodeNumber')!=='-1')continue;
        assertNoHelperAuthority(node);
        helpers.add(node);
      }
    }
    start=end;
  }
  return helpers;
}
