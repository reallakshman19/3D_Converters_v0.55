import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveBranchNominalBore,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-wall-evidence.js';
import {
  applyXmlCiiStagedGeometryAuthority,
} from '../converters/xml-cii2019-core/staged-geometry-authority.js';
import {
  applyPreviewBoreWallAuthority,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js';

let boreAuthorityModule = null;
try {
  boreAuthorityModule = await import('../converters/xml-cii2019-core/bore-authority.js');
} catch {}

const branchName = '/HBMR-1000-24"-P2810042-61440-01/B2';

test('source/XML branch bore outranks Branchname regex and regex remains fallback', () => {
  assert.equal(
    resolveBranchNominalBore(branchName, 25, {}),
    25,
    'a source/XML-derived DN25 branch bore must outrank the 24-inch Branchname token',
  );
  assert.equal(
    resolveBranchNominalBore(branchName, null, {}),
    600,
    'the 24-inch Branchname token remains available only when no source/XML bore exists',
  );
});

const reducerXml = `<Root>
  <Branch>
    <Branchname>${branchName.replaceAll('&', '&amp;')}</Branchname>
    <Node>
      <NodeNumber>110</NodeNumber>
      <ComponentType>REDU</ComponentType>
      <ComponentRefNo>=67127481/31</ComponentRefNo>
      <Endpoint>1</Endpoint>
      <OutsideDiameter>610</OutsideDiameter>
      <Position>73502.00 119970.00 103293.10</Position>
    </Node>
    <Node>
      <NodeNumber>120</NodeNumber>
      <ComponentType>REDU</ComponentType>
      <ComponentRefNo>=67127481/31</ComponentRefNo>
      <Endpoint>2</Endpoint>
      <OutsideDiameter>508</OutsideDiameter>
      <Position>73502.00 119970.00 102785.10</Position>
    </Node>
  </Branch>
</Root>`;

const staged = JSON.stringify([
  {
    type: 'BRANCH',
    name: branchName,
    children: [
      {
        type: 'REDU',
        name: 'P2810042 reducer witness',
        attributes: {
          OWNER: branchName,
          REF: '=67127481/31',
          ABORE: '600',
          LBORE: '500',
          DTXR_POS: 'SCH 80',
        },
      },
    ],
  },
]);

function nodeBlock(xmlText, nodeNumber) {
  const blocks = xmlText.match(/<Node\b[\s\S]*?<\/Node>/gi) || [];
  return blocks.find((block) => new RegExp(`<NodeNumber>\\s*${nodeNumber}\\s*<\\/NodeNumber>`, 'i').test(block)) || '';
}

function value(block, tag) {
  return (block.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*<\\/${tag}>`, 'i'))?.[1] || '').trim();
}

test('source OD canonicalizes stale enriched BoreMm even without staged JSON', () => {
  const stale = reducerXml.replace(
    '<OutsideDiameter>508</OutsideDiameter>',
    '<OutsideDiameter>508</OutsideDiameter><BoreMm>600.000</BoreMm>',
  );
  const geometry = applyXmlCiiStagedGeometryAuthority(stale, '', {
    config: {
      dropGasketNodes: false,
      dropGasketsInEnrichment: false,
      dropShortElementLengthNodes: false,
    },
  });
  const node120 = nodeBlock(geometry.xmlText, 120);
  assert.equal(
    value(node120, 'BoreMm'),
    '500.000',
    'source OD508 must correct stale branch DN600 in enriched XML even when staged JSON is absent',
  );
});

test('shared staged component ref cannot collapse REDU endpoint-specific XML OD', () => {
  const geometry = applyXmlCiiStagedGeometryAuthority(reducerXml, staged, {
    config: {
      dropGasketNodes: false,
      dropGasketsInEnrichment: false,
      dropShortElementLengthNodes: false,
    },
  });
  const node110 = nodeBlock(geometry.xmlText, 110);
  const node120 = nodeBlock(geometry.xmlText, 120);
  assert.ok(node110 && node120, 'both reducer endpoints must survive staged geometry enrichment');
  assert.equal(value(node110, 'BoreMm'), '600.000', '610 mm OD endpoint must resolve to DN600');
  assert.equal(
    value(node120, 'BoreMm'),
    '500.000',
    '508 mm OD endpoint must retain DN500 even when the shared staged component ref also carries DN600',
  );
});

test('Branchname fallback is validated against DTXR/JSON-trace bore and flagged on mismatch', () => {
  const resolver = boreAuthorityModule?.resolveXmlCiiBoreAuthority;
  assert.equal(
    typeof resolver,
    'function',
    'C02 requires one shared bore-authority resolver that can publish fallback/trace validation',
  );
  const result = resolver({
    branchName,
    validationTraceBoreMm: 50,
    config: {},
  });
  assert.equal(result.boreMm, 600);
  assert.equal(result.source, 'branch-name-fallback');
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.traceMismatch, true);
  assert.equal(result.needsReview, true);
  assert.equal(result.validationTraceBoreMm, 50);
});


function leaf(name, value) {
  return {
    nodeType: 1,
    localName: name,
    nodeName: name,
    textContent: String(value),
    childNodes: [],
  };
}

function element(name, fields = {}) {
  return {
    nodeType: 1,
    localName: name,
    nodeName: name,
    textContent: '',
    childNodes: Object.entries(fields).map(([key, value]) => leaf(key, value)),
  };
}

function fakeBranch(name, nodes) {
  return {
    nodeType: 1,
    localName: 'Branch',
    nodeName: 'Branch',
    textContent: '',
    childNodes: [leaf('Branchname', name), ...nodes],
  };
}

test('Preview publishes endpoint-specific bore and wall authority for every XML node', () => {
  const branch = fakeBranch(branchName, [
    element('Node', {
      NodeNumber: 110,
      ComponentType: 'REDU',
      ComponentRefNo: '=67127481/31',
      Endpoint: 1,
      OutsideDiameter: 610,
    }),
    element('Node', {
      NodeNumber: 120,
      ComponentType: 'REDU',
      ComponentRefNo: '=67127481/31',
      Endpoint: 2,
      OutsideDiameter: 508,
    }),
    element('Node', {
      NodeNumber: 70,
      ComponentType: 'BRAN',
      ComponentRefNo: '=67127481/65',
      Endpoint: 1,
      OutsideDiameter: 33.4,
    }),
  ]);
  const sourceDocument = {
    getElementsByTagName(name) {
      if (name === 'Branch') return [branch];
      return [];
    },
  };
  const config = {
    pipingClass: {
      masterRows: [
        { 'Piping Class': '61440', DN: 25, 'Wall Thickness': 6.35, SCH: '80' },
        { 'Piping Class': '61440', DN: 500, 'Wall Thickness': 26.1874, SCH: '80' },
        { 'Piping Class': '61440', DN: 600, 'Wall Thickness': 30.9626, SCH: '80' },
      ],
    },
  };
  const preview = applyPreviewBoreWallAuthority({
    xmlText: reducerXml,
    stagedJsonText: staged,
    config,
    sourceDocument,
    result: {
      branchRows: [{
        branchName,
        sizeMm: 600,
        pipingClass: '61440',
      }],
      nodeRows: [],
    },
  });
  assert.equal(preview.nodeBoreWallRows.length, 3, 'every source XML node needs a node-level authority row');
  const byNode = new Map(preview.nodeBoreWallRows.map((row) => [row.nodeNumber, row]));
  assert.equal(byNode.get('110')?.boreMm, 600);
  assert.equal(byNode.get('110')?.wallThickness, '30.9626');
  assert.equal(byNode.get('120')?.boreMm, 500);
  assert.equal(byNode.get('120')?.wallThickness, '26.1874');
  assert.equal(byNode.get('70')?.boreMm, 25);
  assert.equal(byNode.get('70')?.wallThickness, '6.35');
  assert.equal(byNode.get('70')?.boreSource, 'xml-outside-diameter');
});

console.log('Issue #819 P2810042 bore-authority regression checks completed.');
