function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function config() {
  const format = (lineKey, pipingClass) => ({tokenDelimiter:'-',
    lineKey:{tokenPosition:lineKey}, pipingClass:{tokenPosition:pipingClass},
    rating:{tokenPosition:''}, bore:{tokenPosition:3}});
  return {activeFormatIndex:1,ratingSequence:[['3','300']],
    formats:[format(4,5),format(5,6)]};
}

function toggle(host, checked) {
  const input=host.querySelector('[data-field="regex-format-enabled"]');
  assert(input && !input.disabled,'Format participation checkbox must be actionable');
  input.checked=checked;
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

async function exercise(sourceText, prefix) {
  const {renderStandaloneRegexTesterPanel:renderPanel}=await import(
    `../${prefix}tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-tester.js`);
  const {auditConfiguredBranchFormats:audit}=await import(
    `../${prefix}tabs/xml-cii-2019-standalone/xml-cii-branch-format-release.js`);
  const host=document.createElement('section');
  document.body.append(host);
  const ref={current:{sourceKind:'xml',sourceText,supportConfigJson:'{}',
    regexTesterConfig:config(),regexActiveTabId:'samples'}};
  const render=()=>{host.replaceChildren();renderPanel(host,ref.current,ref,render);};
  render();
  assert(ref.current.regexTesterResult.rejectedRows.length===41,'Both configured formats must conflict');
  toggle(host,false);
  const resolved=ref.current.regexTesterResult;
  assert(resolved.matchedRows.length===41,'Disabling shifted Format 2 must resolve all41');
  assert(resolved.matchedRows[0].lineKey==='P8810021','Line Key must come from Format 1');
  assert(resolved.matchedRows[0].pipingClass==='31441C4','Piping Class must come from Format 1');
  assert(resolved.matchedRows[0].rating==='300','Rating must be300');
  const committed=JSON.parse(ref.current.supportConfigJson);
  assert(committed.regexTester.formats[1].enabled===false,'Committed nested flag was lost');
  assert(committed.formats[1].enabled===false,'Committed root flag was lost');
  assert(audit(resolved.branchSamples,committed).blocked===false,'Run must use the same41 identities');
  return finish(host,ref,render,audit,prefix);
}

function finish(host,ref,render,audit,prefix) {
  const restored=JSON.parse(localStorage.getItem('xml-cii-regex-config-v1'));
  assert(restored.formats[1].enabled===false,'Local persistence lost the explicit exclusion');
  ref.current={...ref.current,regexTesterConfig:restored,regexTesterResult:null};
  render();
  assert(host.querySelector('[data-field="regex-format-enabled"]').checked===false,
    'Repaint/reload must preserve disabled Format 2');
  toggle(host,true);
  assert(ref.current.regexTesterResult.rejectedRows.length===41,'Re-enabling conflict must hold all41');
  toggle(host,false);
  const first=[...host.querySelectorAll('button')].find(b=>b.textContent==='Format 1 (Dominant)');
  first.click();
  toggle(host,false);
  const rows=ref.current.regexTesterResult;
  assert(rows.matchedRows.length===0,'Disabling both formats cannot authorize a branch');
  assert(rows.rejectedRows.every(r=>r.extractionStatus==='UNMATCHED'),'All disabled must be UNMATCHED');
  assert(audit(rows.branchSamples,JSON.parse(ref.current.supportConfigJson)).blocked,
    'Run must remain held with both formats disabled');
  assert(ref.current.dependencyRevisions.supportConfigRevision>0,
    'Format change must traverse production config dependency tracking');
  host.remove();
  return {prefix:prefix||'root/',occurrences:41,resolved:41,reEnabledConflict:41,allDisabledHeld:true,
    persisted:false===restored.formats[1].enabled};
}

export async function runExplicitFormatBrowserCases(sourceText) {
  const stored=localStorage.getItem('xml-cii-regex-config-v1');
  try {
    return [await exercise(sourceText,''),await exercise(sourceText,'docs/')];
  } finally {
    if(stored===null)localStorage.removeItem('xml-cii-regex-config-v1');
    else localStorage.setItem('xml-cii-regex-config-v1',stored);
  }
}
