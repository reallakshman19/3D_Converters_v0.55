/** Plain-text evidence from the current Worker proposal, never a new estimate. */
const text=value=>String(value??'').trim();
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const methods=Object.freeze({
 master:'Weight master lookup',
 'length-interpolated':'Length interpolation from same-bore/rating master records',
 'length-extrapolated':'Length extrapolation from same-bore/rating master records',
 'flange-length-extrapolated':'Flange master weight scaled by element length',
 'special-factor':'Configured special-factor estimate',
});
const reasons=Object.freeze({
 'explicit-review-required':'Explicit review required',
 'exact-bore-rating-length':'Exact bore, rating and length',
 SOURCE_FAMILY_UNKNOWN:'Source component family is unknown',
 SOURCE_FAMILY_CONFLICT:'Source component family conflicts with the candidate',
 COMPONENT_PORT_DIMENSIONS_DIFFER_REVIEW_REQUIRED:'Component body and end-port dimensions differ',
});
function dimensions(value){
 return [finite(value.bore)?'DN'+value.bore:'',
   text(value.rating)?'Rating '+text(value.rating):'',
   finite(value.length)?'Length '+value.length+' mm':'',
   finite(value.kg)?'Weight '+value.kg+' kg':''].filter(Boolean).join(' · ');
}
function masterDescription(basis){
 const id=text(basis.masterRowId);
 const ordinal=Number.isSafeInteger(basis.masterRowOrdinal)&&basis.masterRowOrdinal>=0
   ?'record '+(basis.masterRowOrdinal+1):'';
 const identity=[id?'ID '+id:'',ordinal].filter(Boolean).join(' · ');
 const kind=[text(basis.type),text(basis.typeDesc)].filter(Boolean).join(' · ');
 const dims=dimensions({bore:basis.rowBore,rating:basis.rowRating,
   length:basis.rowLength,kg:basis.masterWeight});
 return [identity,kind,dims].filter(Boolean).join(' | ');
}
function scorePercent(score){
 if(!finite(score)||score<0)return null;
 const percent=score<=1?score*100:score;
 return percent<=100?Number(percent.toFixed(4)):null;
}
/** Method and warning remain the scorer's explanation; no invented formula. */
export function xml229WeightSuggestionTooltip(physical={},proposal={},maximum=null){
 const basis=proposal.candidateBasis||{};
 const method=text(basis.weightMethod||proposal.matchType||proposal.method);
 const source=dimensions({bore:physical.boreMm,rating:physical.rating,length:physical.lengthMm});
 const master=masterDescription(basis),score=scorePercent(proposal.score);
 const label=proposal.qualified?'Source-qualified suggestion':'Estimated suggestion — review required';
 const lines=[label+': '+text(proposal.value)+' kg'+
   (proposal.value===maximum?' (largest suggestion)':''),
   'Basis: '+(methods[method]||method||'Not supplied by the Worker')];
 if(source)lines.push('Current component: '+source);
 lines.push('Weight master: '+(master||'Record details not supplied'));
 if(score!==null)lines.push('Match score: '+score+'%');
 if(finite(basis.lengthDelta))lines.push('Length difference: '+basis.lengthDelta+' mm'+
   (finite(basis.lengthToleranceMm)?' · tolerance '+basis.lengthToleranceMm+' mm':''));
 if(finite(basis.extrapolationRatio))lines.push('Reported length ratio: '+basis.extrapolationRatio);
 if(text(basis.specialFactorCode))lines.push('Factor rule: '+text(basis.specialFactorCode));
 if(text(basis.semanticReason))lines.push('Match reason: '+text(basis.semanticReason));
 if(text(basis.semanticSource))lines.push('Match evidence: '+text(basis.semanticSource));
 if(text(basis.warning))lines.push('Estimate note: '+text(basis.warning));
 const review=[...new Set((proposal.eligibilityReasons||[]).map(text).filter(Boolean))];
 if(review.length)lines.push('Qualification: '+review.map(v=>reasons[v]||v.replace(/_/g,' ').toLowerCase()).join('; '));
 if(text(physical.componentType).toUpperCase()==='INST')lines.push(
   'Instrument: selecting kg does not establish RIGID classification. Governed CII also checks the source model.');
 lines.push('Selecting this suggestion fills the input only. Confirm Final separately.');
 return lines.join('\n');
}
