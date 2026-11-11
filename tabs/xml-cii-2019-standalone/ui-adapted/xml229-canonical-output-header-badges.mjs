/**
 * Output/Run header badges are a projection of the exact canonical report
 * painted beside them, not a second readiness authority or a count of all
 * runtime console messages. This module only changes the presentation.
 */
export function xml229CanonicalOutputBadgeCounts(report) {
  const diagnostics=Array.isArray(report?.diagnostics)?report.diagnostics:[];
  const counts={errors:0,warnings:0};
  for(const d of diagnostics) {
    const level=String(d?.level||'').toLowerCase();
    if(level==='error')counts.errors++;
    else if(level==='warning')counts.warnings++;
  }
  return counts;
}
export function syncXml229CanonicalOutputHeaderBadges(card, report) {
  // First Output/Run paint occurs before the surrounding shell is mounted.
  // Recheck after that mount without changing state, Worker or Run authority.
  const root=card?.closest?.('.xml-cii-standalone-root');
  const bar=root?.querySelector?.('.xml-cii-header-status-row');
  if(!bar||!report)return false;
  const {errors,warnings}=xml229CanonicalOutputBadgeCounts(report);
  const badges=[...bar.querySelectorAll('.xml-cii-standalone-badge')];
  const stale=badges.find(b=>/^Diagnostics: not built$/.test(b.textContent||''));
  if(stale)stale.remove();
  const make=(suffix,value)=>{
    let badge=[...bar.querySelectorAll('.xml-cii-standalone-badge')]
      .find(b=>new RegExp('^\\d+ '+suffix+'$').test(b.textContent||''));
    if(!badge){
      badge=card.ownerDocument.createElement('span');
      badge.className='xml-cii-standalone-badge';
      bar.appendChild(badge);
    }
    badge.textContent=value+' '+suffix;
    badge.style.color=value?(suffix==='Errors'?'#fca5a5':'#fde047'):'#8be28b';
    badge.style.borderColor=value?(suffix==='Errors'?'#ef4444':'#fbbf24'):'#2f855a';
    return badge;
  };
  make('Errors',errors);make('Warnings',warnings);
  return true;
}
