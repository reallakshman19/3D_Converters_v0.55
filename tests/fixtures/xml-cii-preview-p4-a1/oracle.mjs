// P4-A1 manually authored source-custody goldens. NOT owner-private PL01/PL06.
// Values and ordinals below are handwritten expected observations, NEVER
// recomputed from the Preview implementation under test.
const sourceA = `<PipeStressExport>
<Pipe>
  <Branch><Branchname>/ASIM-1885-3"-S8811000-91261M7-HC-01/B1</Branchname>
    <Node><NodeNumber>-1</NodeNumber><ComponentType>VALV</ComponentType><ComponentRefNo>R-A0</ComponentRefNo><Endpoint>1</Endpoint></Node>
    <Node><NodeNumber>101</NodeNumber><ComponentType>PIPE</ComponentType><ComponentRefNo>R-A1</ComponentRefNo><Endpoint>2</Endpoint></Node>
  </Branch>
  <Branch><Branchname>/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B2</Branchname>
    <Node><NodeNumber>-1</NodeNumber><ComponentType>VALV</ComponentType><ComponentRefNo>R-A2</ComponentRefNo><Endpoint>1</Endpoint></Node>
  </Branch>
</Pipe>
</PipeStressExport>`;
const sourceB = `<PipeStressExport>
<Pipe>
  <Branch><Branchname>/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B2</Branchname>
    <Node><NodeNumber>-1</NodeNumber><ComponentType>VALV</ComponentType><ComponentRefNo>R-B0</ComponentRefNo><Endpoint>1</Endpoint></Node>
    <Node><NodeNumber>-1</NodeNumber><ComponentType>PIPE</ComponentType><ComponentRefNo>R-B1</ComponentRefNo><Endpoint>2</Endpoint></Node>
  </Branch>
  <Branch><Branchname>/ASIM-1885-3"-S8811000-91261M7-HC-01/B1</Branchname>
    <Node><NodeNumber>101</NodeNumber><ComponentType>PIPE</ComponentType><ComponentRefNo>R-B2</ComponentRefNo><Endpoint>1</Endpoint></Node>
  </Branch>
</Pipe>
</PipeStressExport>`;
function deepFreeze(v) {
  if(v && typeof v==='object' && !Object.isFrozen(v)) {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
}
export const originalSources=deepFreeze([
  {sourceId:'P4-A',fileName:'p4-format1-original.xml',xmlText:sourceA},
  {sourceId:'P4-B',fileName:'p4-format2-original.xml',xmlText:sourceB},
]);
export const golden=deepFreeze({
  schema:'xml-cii-preview-p4-a1-golden/v1',
  fixtureClassification:'HAND_AUTHORED_SYNTHETIC_NOT_OWNER_XML',
  counts:{pipes:2,branches:4,nodes:6,negativeOneNodes:4,positive101Nodes:2},
  sourceOrder:[
    {sourceId:'P4-A',fileName:'p4-format1-original.xml',pipeCount:1,branchCount:2,nodeCount:3},
    {sourceId:'P4-B',fileName:'p4-format2-original.xml',pipeCount:1,branchCount:2,nodeCount:3},
  ],
  // Format/line/class are hand-authored downstream A2 expected values,
  // NOT asserted as resolved/accepted engineering facts in A1.
  branches:[
    {sourceId:'P4-A',branchOrdinal:0,branchName:'/ASIM-1885-3"-S8811000-91261M7-HC-01/B1',
      format:1,lineKey:'S8811000',pipingClass:'91261M7',nodes:[
        {nodeOrdinal:0,nodeNumber:'-1',componentType:'VALV',componentRefNo:'R-A0',endpoint:'1'},
        {nodeOrdinal:1,nodeNumber:'101',componentType:'PIPE',componentRefNo:'R-A1',endpoint:'2'},
      ]},
    {sourceId:'P4-A',branchOrdinal:1,branchName:'/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B2',
      format:2,lineKey:'S8822000',pipingClass:'91261M7',nodes:[
        {nodeOrdinal:0,nodeNumber:'-1',componentType:'VALV',componentRefNo:'R-A2',endpoint:'1'},
      ]},
    {sourceId:'P4-B',branchOrdinal:0,branchName:'/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B2',
      format:2,lineKey:'S8822000',pipingClass:'91261M7',nodes:[
        {nodeOrdinal:0,nodeNumber:'-1',componentType:'VALV',componentRefNo:'R-B0',endpoint:'1'},
        {nodeOrdinal:1,nodeNumber:'-1',componentType:'PIPE',componentRefNo:'R-B1',endpoint:'2'},
      ]},
    {sourceId:'P4-B',branchOrdinal:1,branchName:'/ASIM-1885-3"-S8811000-91261M7-HC-01/B1',
      format:1,lineKey:'S8811000',pipingClass:'91261M7',nodes:[
        {nodeOrdinal:0,nodeNumber:'101',componentType:'PIPE',componentRefNo:'R-B2',endpoint:'1'},
      ]},
  ],
});
export function combinedSourceText() {
  return '<PipeStressExport>'+originalSources.map(s=>
    s.xmlText.replace(/^<PipeStressExport>/,'').replace(/<\/PipeStressExport>$/,'')).join('')
    +'</PipeStressExport>';
}
export function modeBManifest() {
  return {schema:'xml-node-offset-combine/v1',sourceCount:2,sourceOrder:
    golden.sourceOrder.map(({sourceId,fileName,pipeCount})=>({sourceId,fileName,pipeCount}))};
}
