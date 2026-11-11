import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { indexAttNativeHierarchy } from '../../tabs/model-converters/att-native-hierarchy-index.js';
import { createAttNativeTreeBrowser, ATT_BROWSER_MAX_RENDER_ROWS, ATT_BROWSER_ROW_HEIGHT } from '../../tabs/model-converters/att-native-tree-browser.js';
import { createAttScopeSelection, setAttScopeRule, resolveAttScopeSelection } from '../../tabs/model-converters/att-native-scope-selection.js';

const input = [];
function block(type, name, owner) {
  input.push('NEW ' + name, 'NAME:= ' + name, 'TYPE:= ' + type, 'OWNER:= ' + owner, 'END');
}
for(let site=0;site<18;site++) {
  const root='/SITE-'+site;
  block('SITE',root,'/*');
  for(let zone=0;zone<(site<12?11:10);zone++) {
    block('ZONE',root+'/ZONE-'+zone,root);
  }
}
for(let n=0;n<105000;n++) {
  block('EQUI','/SITE-0/ZONE-0/E'+n,'/SITE-0/ZONE-0');
}
// A misleading 1885 text hit under a different actual SITE/ZONE.
block('PIPE','/ASIM-1885-PL-PIPE-7','/SITE-0/ZONE-0');
block('BRAN','/ASIM-1885-PL-PIPE-7/B1','/ASIM-1885-PL-PIPE-7');
block('SPINE','/ORPHAN','/MISSING-OWNER');
const index = await indexAttNativeHierarchy(input.join('\n'));
assert.equal(index.counts.sites,18);
assert.equal(index.counts.zones,192);
assert.equal(index.counts.typed,105213);
const browser=createAttNativeTreeBrowser(index);
assert.equal(browser.indexedTotal,105213);
assert.equal(browser.visibleTotal,211,'18 sites and all 192 zones and orphan shown initially');
const first=browser.windowAt(0,200);
assert.equal(first.rows.length,120,'global virtual window is bounded, not the graph');
assert.equal(first.rows[0].id,'/SITE-0');
assert.equal(first.rows[1].id,'/SITE-0/ZONE-0');
assert.equal(first.rows[1].depth,1);
assert.ok(first.rows.some(row=>row.type==='ZONE'));
assert.equal(first.bottomPixels,(211-120)*ATT_BROWSER_ROW_HEIGHT);
assert.equal(browser.positionOf('/SITE-17/ZONE-9'),209);
assert.equal(browser.windowAt(206,120).rows.some(row=>row.id==='/SITE-17/ZONE-9'),true);
assert.equal(browser.windowAt(0,0).rows.length,120);

browser.toggle('/SITE-0/ZONE-0');
assert.equal(browser.visibleTotal,105212,'collapsed child PIPE hides its BRAN but retains it in indexed source');
browser.toggle('/ASIM-1885-PL-PIPE-7');
assert.equal(browser.visibleTotal,105213,'all 105k descendants become browseable without truncation');
assert.equal(browser.windowAt(10,1000).rows.length,ATT_BROWSER_MAX_RENDER_ROWS);
assert.equal(browser.positionOf('/SITE-0/ZONE-0/E99999')>99000,true);
const seen = new Set();
for(let offset=0;offset<browser.visibleTotal;offset+=120) {
  const page=browser.windowAt(offset);
  for(const row of page.rows) {
    assert.ok(!seen.has(row.id),'no duplicate/missing virtual windows');
    seen.add(row.id);
  }
}
assert.equal(seen.size,index.counts.typed);
assert.ok(seen.has('/SITE-17/ZONE-9'));
assert.ok(seen.has('/SITE-0/ZONE-0/E99999'));

const selected=setAttScopeRule(index,createAttScopeSelection(),'/SITE-0/ZONE-0',true);
const beforeSelection=resolveAttScopeSelection(index,selected);
assert.ok(beforeSelection.selectedNativeCount>105000);

browser.setSearch('/SITE-0/ZONE-0/E99999');
const exact=browser.windowAt(0);
assert.equal(browser.matchCount,1);
assert.deepEqual(exact.rows.map(row=>row.id),
  ['/SITE-0','/SITE-0/ZONE-0','/SITE-0/ZONE-0/E99999']);
assert.deepEqual(exact.rows.map(row=>row.depth),[0,1,2]);
assert.deepEqual(exact.rows.map(row=>row.matches),[false,false,true]);
assert.equal(resolveAttScopeSelection(index,selected).selectedNativeCount,
  beforeSelection.selectedNativeCount,'search never changes model-owned selection');
browser.setSearch('1885');
const misleading=browser.windowAt(0);
assert.equal(browser.matchCount,index.records.filter(r => r.name.toLocaleLowerCase().includes('1885') || r.type.toLocaleLowerCase().includes('1885')).length, 'all genuine TXT name matches are counted without truncation');
assert.ok(misleading.rows.some(row=>row.type==='PIPE'));
assert.ok(misleading.rows.some(row=>row.type==='BRAN'));
assert.ok(!misleading.rows.some(row=>row.type==='SITE' && row.name.includes('1885')),
 'text search may match 1885 PIPE but never invent nonexistent 1885 SITE');
browser.setSearch('/ASIM-1885-CU-PL');
assert.equal(browser.matchCount,0);
assert.equal(browser.visibleTotal,0,'absent TXT Site is reported absent, not looked up in NWD');
browser.setSearch('');
assert.equal(browser.matchCount,0);
assert.equal(browser.visibleTotal,105213,'clearing search restores prior zone expansion');
browser.toggle('/SITE-0/ZONE-0');
assert.equal(browser.visibleTotal,211,'collapsing one zone does not delete source records');
browser.toggle('/SITE-0');
assert.equal(browser.visibleTotal,200,'collapsing Site hides 11 zones only');
browser.setSearch('/SITE-0/ZONE-0/E5');
assert.ok(browser.windowAt(0).rows.some(row=>row.id==='/SITE-0/ZONE-0/E5'),
 'search auto-expands ancestor paths despite manually collapsed Site');
browser.setSearch('');
assert.equal(browser.visibleTotal,200,'prior tree expansion restored after searching');
assert.equal(browser.originalSourceRecords,105213);

const popup = await readFile(new URL('../../tabs/model-converters/att-native-scope-popup.js',import.meta.url),'utf8');
assert.match(popup,/createAttNativeTreeBrowser/);
assert.match(popup,/ATT_BROWSER_ROW_HEIGHT/);
assert.match(popup,/data-native-rows/);
assert.match(popup,/aria-expanded/);
assert.match(popup,/requestAnimationFrame/);
assert.match(popup,/No matching Site, Zone or component in this loaded TXT/);
assert.match(popup,/indexAttNativeHierarchy\(new Blob\(\[bytes\]\)\.stream\(\)/);
assert.doesNotMatch(popup,/data-reveal|data-native-prev|data-native-next|data-expected-entries|NWD.*required/);
console.log('test-att-native-tree-browser: PASS 105213 TXT identities, virtual windows, contextual search, no 1885 fabrication, stable selection');
