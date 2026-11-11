/**
 * Narrow display/action eligibility only; original physical census and
 * FactRecords remain complete, unchanged and source-bound.
 * A ComponentType=RIGID is NOT proof that a component needs master weight
 * matching: ordinary pipe/fittings are also represented as RIGID.
 */
const word=x=>String(x??'').trim();
const fit=/^(?:TEE|ELBOW|BEND|PIPE|TUBE|REDUCER)(?:\b|[-_\/])/i;
const tokenFit=/(?:^|[-_\/\s])(?:TEE|ELBOW|BEND|PIPE|TUBE|REDUCER)(?=$|[-_\/\s\d])/i;
export function xml229IsExcludedWeightFitting({nodeName='',dtxr=''}={}){
 // A positive source component name or an exact leading DTXR fitting class
 // is evidence of a fitting; never classify "PIPE CLASS" anywhere in text.
 return tokenFit.test(word(nodeName))||fit.test(word(dtxr));
}
export function xml229WeightReviewEligible(row={}){
 return /^(?:RIGID|VALV|INST|FLAN|GASK)/i.test(word(row.componentType))&&
   !xml229IsExcludedWeightFitting(row);
}
export function xml229ProposalScorePercent(proposal){
 const raw=proposal?.score;
 if(typeof raw!=='number'||!Number.isFinite(raw)||raw<0)return null;
 const percent=raw<=1?raw*100:raw;
 return percent<=100?percent:null;
}
export function xml229WeightThreshold(value){
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||n>100)throw new RangeError('Match score threshold must be 0–100%');
 return n;
}
