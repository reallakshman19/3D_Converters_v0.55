export const P2810042_C06_CLASS_ROWS = Object.freeze([
  { 'Piping Class': '61440', DN: 25, convertedBore: 25, 'Wall Thickness': 6.35, SCH: '160', Rating: '600' },
  { 'Piping Class': '61440', DN: 50, convertedBore: 50, 'Wall Thickness': 8.7376, SCH: '160', Rating: '600' },
  { 'Piping Class': '61440', DN: 450, convertedBore: 450, 'Wall Thickness': 23.8252, SCH: '80', Rating: '600' },
  { 'Piping Class': '61440', DN: 500, convertedBore: 500, 'Wall Thickness': 26.1874, SCH: '80', Rating: '600' },
  { 'Piping Class': '61440', DN: 600, convertedBore: 600, 'Wall Thickness': 30.9626, SCH: '80', Rating: '600' },
]);
export const P2810042_C06_TARGET_WEIGHTS = Object.freeze([
  { id: 'reported-149-150', branch: 'B3', node: '150', ref: '=67127481/44', kg: 42.25 },
  { id: 'reported-480-10', branch: 'EXE/B2', node: '10', ref: '=67127432/19', kg: 51.5 },
]);

// Source-derived rows: [node,name,endpoint,rigid,type,ref,connection,OD,position,alpha].
const B = Object.freeze([
  ['B2','/HBMR-1000-24"-P2810042-61440-01/B2',[
    [10,'',1,1,'BRAN','=67127481/56','BRAN',610,'72298.40 115930.00 100000.00'],
    [20,'',2,2,'RIGID','=67127481/48','',610,'72588.00 115930.00 100000.00'],
    [100,'',0,null,'TEE','=67127481/107','',610,'73502.00 119970.00 103725.10'],
    [110,'',1,null,'REDU','=67127481/31','',610,'73502.00 119970.00 103293.10'],
    [120,'',2,1,'REDU','=67127481/31','',508,'73502.00 119970.00 102785.10',9.5],
    [130,'',2,2,'RIGID','=67127481/56','BRAN',508,'73502.00 119970.00 102518.20'],
  ]],
  ['B3','/HBMR-1000-24"-P2810042-61440-01/B3',[
    [100,'',1,null,'BRAN','=67127481/44','TEE',610,'73502.00 119970.00 103725.10'],
    [140,'',1,1,'FLAN','=67127481/19','',610,'74434.00 119970.00 103725.10'],
    [150,'=67127481/21',2,2,'RIGID','=67127481/44','BRAN',610,'76156.00 119970.00 103725.10'],
  ]],
  ['B8','/HBMR-1000-24"-P2810042-61440-01/B8',[
    [150,'',1,null,'BRAN','=67127481/167','BRAN',457,'76156.00 119970.00 103725.10'],
    [160,'PS00109.1',0,null,'ANCI','=67127422/40','',457,'76556.00 119970.00 103725.10'],
    [170,'',0,null,'ATTA','=67127481/168','',457,'76756.00 119970.00 103725.10'],
    [180,'',2,null,'BRAN','=67127481/167','ATT',457,'76756.00 119970.00 103725.10'],
  ]],
  ['B5','/HBMR-1000-24"-P2810042-61440-01/B5',[
    [70,'',1,1,'BRAN','=67127481/65','OLET',33.4,'73502.00 119970.00 104457.10'],
    [200,'',2,2,'RIGID','=67127481/186','',33.4,'74029.78 120497.78 104457.10'],
  ]],
  ['B4','/HBMR-1000-24"-P2810042-61440-01/B4',[
    [80,'',1,1,'BRAN','=67127481/57','OLET',60.3,'73502.00 119970.00 104357.10'],
    [410,'',1,1,'FLAN','=67127481/59','',60.3,'73502.00 119626.90 104357.10'],
    [420,'=67127481/61',2,2,'RIGID','=67127481/57','CLOS',610,'73502.00 119216.10 104357.10'],
  ]],
  ['B7','/HBMR-1000-24"-P2810042-61440-01/B7',[
    [50,'',1,1,'BRAN','=67127481/101','OLET',60.3,'73502.00 117844.00 105471.10'],
    [430,'',1,1,'FLAN','=67127481/102','',60.3,'73502.00 117844.00 105814.20'],
    [440,'=67127481/104',2,2,'RIGID','=67127481/101','CLOS',60.3,'73502.00 117844.00 106225.00'],
  ]],
  ['EXE/B2','/HBMR-1000-24-"P2810042-61440-01-EXE/B2',[
    [-1,'',1,1,'BRAN','=67127432/19','BRAN',610,'72088.40 115930.00 100000.00'],
    [480,'',1,null,'FLAN','=67127432/20','',610,'72088.40 115930.00 100000.00'],
    [-1,'',2,null,'FLAN','=67127432/20','',610,'72298.40 115930.00 100000.00'],
    [10,'',2,2,'RIGID','=67127432/19','BRAN',610,'72298.40 115930.00 100000.00'],
  ]],
]);

function esc(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function nodeXml(row) {
  const [number,name,endpoint,rigid,type,ref,connection,od,position,alpha] = row;
  return `<Node><NodeNumber>${number}</NodeNumber><NodeName>${esc(name)}</NodeName><Endpoint>${endpoint}</Endpoint>${rigid == null ? '' : `<Rigid>${rigid}</Rigid>`}<ComponentType>${type}</ComponentType><Weight>0</Weight><ComponentRefNo>${esc(ref)}</ComponentRefNo><ConnectionType>${connection}</ConnectionType><OutsideDiameter>${od}</OutsideDiameter><WallThickness>0</WallThickness><CorrosionAllowance>0</CorrosionAllowance>${alpha == null ? '' : `<AlphaAngle>${alpha}</AlphaAngle>`}<InsulationThickness>0</InsulationThickness><Position>${position}</Position><BendRadius>0</BendRadius><SIF>0</SIF></Node>`;
}
function branchXml([,name,nodes]) {
  const temperature = Array.from({length:9},(_,i)=>`<Temperature${i+1}>-100000</Temperature${i+1}>`).join('');
  const pressure = Array.from({length:9},(_,i)=>`<Pressure${i+1}>0</Pressure${i+1}>`).join('');
  return `<Branch><Branchname>${esc(name)}</Branchname><Temperature>${temperature}</Temperature><Pressure>${pressure}</Pressure><MaterialNumber>0</MaterialNumber><InsulationDensity>0</InsulationDensity><FluidDensity>0</FluidDensity>${nodes.map(nodeXml).join('')}</Branch>`;
}
export function buildP2810042C06FixtureXml() {
  const units = '<Units><DistanceUnits>mm</DistanceUnits><BoreUnits>mm</BoreUnits><PressureUnits>pascal</PressureUnits><TemperatureUnits>degC</TemperatureUnits><WeightUnits>kg</WeightUnits><ForceUnits>newton</ForceUnits><WallThicknessUnits>mm</WallThicknessUnits><FluidDensityUnits>kg/m3</FluidDensityUnits></Units>';
  return `<?xml version="1.0" encoding="utf-8"?><PipeStressExport xmlns="http://aveva.com/pipeStress116.xsd">${units}<RestrainOpenEnds>Yes</RestrainOpenEnds><AmbientTemperature>21</AmbientTemperature><Pipe><FullName>/SYS-24-P2810042</FullName><Ref>=67127427/69</Ref>${B.map(branchXml).join('')}</Pipe></PipeStressExport>`;
}
