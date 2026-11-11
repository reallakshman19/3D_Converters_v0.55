/** PSI116 TEE port3 describes the branch, not the serial main-run route.
 * Keep run ports1/2 and junction0 at their original positions. Classify before
 * Final acceptance; this never edits source bytes or an accepted native graph.
 */
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

function isTeePortGroup(group){
  if(group.length!==4||kind(group[0])!=='TEE'||!ref(group[0])||
     group.map(n=>field(n,'Endpoint')).join(',')!=='1,3,0,2'||
     field(group[1],'NodeNumber')!=='-1')return false;
  const junction=Number(field(group[2],'NodeNumber'));
  if(!Number.isSafeInteger(junction)||junction<=0)return false;
  const points=group.map(point);
  return points.every(Boolean)&&[0,1,3].every(i=>
    Math.hypot(...points[i].map((v,j)=>v-points[2][j]))>1e-6);
}

function assertNoBranchPortAuthority(node){
  const weight=Number(field(node,'Weight')||'0');
  const sif=Number(field(node,'SIF')||'0');
  const rigid=field(node,'Rigid');
  if(field(node,'NodeName')||children(node,'Restraint').length||
     !Number.isFinite(weight)||weight!==0||!Number.isFinite(sif)||sif!==0||
     (rigid&&rigid!=='0')){
    throw Object.assign(new Error(
      'TEE branch-port witness carries named, restraint, rigid, mass or SIF authority; route cleanup blocked.'),
    {code:'TEE_BRANCH_PORT_AUTHORITY_CONFLICT'});
  }
}

export function xml229TeeBranchPortWitnesses(branchNodes){
  const witnesses=new Set();
  for(let start=0;start<branchNodes.length;){
    let end=start+1;
    while(end<branchNodes.length&&kind(branchNodes[end])===kind(branchNodes[start])&&
          ref(branchNodes[end])===ref(branchNodes[start]))end++;
    const group=branchNodes.slice(start,end);
    if(isTeePortGroup(group)){
      assertNoBranchPortAuthority(group[1]);
      witnesses.add(group[1]);
    }
    start=end;
  }
  return witnesses;
}
