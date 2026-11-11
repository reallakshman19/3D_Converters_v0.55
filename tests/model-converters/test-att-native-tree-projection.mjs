import assert from 'node:assert/strict';
import { indexAttNativeHierarchy } from '../../tabs/model-converters/att-native-hierarchy-index.js';
import {
  ATT_TREE_ROW_LIMIT, projectAttNativeTree, attNativeAncestors,
  attNativeBreadcrumb, expandAttNativeAncestors, findAttNativeVisibleOffset,
} from '../../tabs/model-converters/att-native-tree-projection.js';

const blocks = ['NEW header', 'PROJECT:= model', 'END'];
for (let site = 0; site < 18; site++) {
  const s = '/SITE-' + site;
  blocks.push('NEW ' + s, 'NAME:= ' + s, 'TYPE:= SITE', 'OWNER:= /*');
  for (let z = 0; z < (site < 12 ? 11 : 10); z++) {
    const name = s + '/ZONE-' + z;
    blocks.push('NEW ' + name, 'NAME:= ' + name, 'TYPE:= ZONE', 'OWNER:= ' + s);
    const eq = name + '/NONPIPE-' + site + '-' + z;
    blocks.push('NEW ' + eq, 'NAME:= ' + eq, 'TYPE:= EQUI', 'OWNER:= ' + name);
  }
}
for (let i = 0; i < 105000; i++) {
  const name = '/SITE-0/ZONE-0/E' + i;
  blocks.push('NEW ' + name, 'NAME:= ' + name, 'TYPE:= SUBE',
    'OWNER:= /SITE-0/ZONE-0');
}
blocks.push('NEW /ORPHAN', 'NAME:= /ORPHAN', 'TYPE:= SPINE', 'OWNER:= /UNKNOWN', 'END');
const index = await indexAttNativeHierarchy(blocks.join('\n'));
assert.equal(index.counts.sites, 18);
assert.equal(index.counts.zones, 192);
assert.equal(index.counts.typed, 18 + 192 + 192 + 105000 + 1);
assert.equal(index.counts.unresolved, 1);
const roots = projectAttNativeTree(index);
assert.equal(roots.rows.length, 19);
assert.equal(roots.visibleTotal, 19);
assert.equal(roots.indexedTotal, index.counts.typed);
assert.equal(roots.unresolvedTotal, 1);
assert.ok(roots.rows.some(row => row.type === 'SPINE'));
const expanded = new Set(['/SITE-0', '/SITE-0/ZONE-0']);
const firstPage = projectAttNativeTree(index, { expanded });
assert.equal(firstPage.rows.length, ATT_TREE_ROW_LIMIT);
assert.equal(firstPage.canNext, true);
assert.ok(firstPage.rows.some(row => row.type === 'SUBE'));
assert.ok(firstPage.rows.some(row => row.type === 'ZONE'));
assert.ok(!firstPage.rows.some(row => row.name === '/SITE-1/ZONE-0'));
assert.equal(firstPage.visibleTotal, 19 + 11 + 1 + 105000);
const secondPage = projectAttNativeTree(index, { expanded, offset: 120 });
assert.equal(secondPage.rows.length, 120);
assert.notEqual(firstPage.rows[0].id, secondPage.rows[0].id);
const lastPage = projectAttNativeTree(index, { expanded, offset: firstPage.visibleTotal - 30 });
assert.equal(lastPage.rows.length, 30);
assert.equal(lastPage.canNext, false);
const hit = '/SITE-0/ZONE-0/E99999';
assert.deepEqual(attNativeAncestors(index, hit),
  ['/SITE-0', '/SITE-0/ZONE-0', hit]);
assert.match(attNativeBreadcrumb(index, hit), /SITE-0.*ZONE-0.*E99999/);
const reveal = expandAttNativeAncestors(index, hit);
const visibleOffset = findAttNativeVisibleOffset(index, hit, reveal);
assert.ok(visibleOffset > 99999);
const found = projectAttNativeTree(index, { expanded: reveal, offset: visibleOffset, limit: 1 });
assert.equal(found.rows[0].id, hit);
const search = projectAttNativeTree(index, { search: '/ZONE-0/E999', offset: 0 });
assert.equal(search.matchedTotal, 111);
assert.ok(search.rows.length <= 120);
const otherPage = projectAttNativeTree(index, { search: '/ZONE-0/E999', offset: 120 });
assert.equal(otherPage.rows.length, 0);
const noMatch = projectAttNativeTree(index, { search: 'DOES_NOT_EXIST' });
assert.equal(noMatch.matchedTotal, 0);
assert.equal(noMatch.rows.length, 0);
console.log('test-att-native-tree-projection: PASS native >105k, all pages, non-piping, search, reveal');
