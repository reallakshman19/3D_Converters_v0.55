/** Synthetic engineering fixture; never an Owner model or acceptance record. */
const node=(n,type,x,y,extra='')=>'<Node><NodeNumber>'+n+'</NodeNumber>'+
 '<ComponentType>'+type+'</ComponentType><Position>'+x+' '+y+' 0</Position>'+
 '<Weight>0</Weight><BoreMm>100</BoreMm><OutsideDiameter>114</OutsideDiameter>'+
 '<WallThickness>6</WallThickness>'+extra+'</Node>';
export const xml229TopologyJourneyXml='<PipeStressExport><Pipe><Branch>'+
 '<Branchname>/ASIM-1836-8"-P8810021-31441C4-PP/B4</Branchname>'+
 node(10,'PIPE',-100,0,'<Rigid>0</Rigid>')+
 node(20,'PIPE',0,0,'<Rigid>0</Rigid>')+
 node(30,'ELBO',0,0,'<Endpoint>0</Endpoint><ComponentRefNo>ELBO-1</ComponentRefNo><BendRadius>150</BendRadius>')+
 node(40,'PIPE',0,200,'<Rigid>0</Rigid>')+
 node(50,'RIGID',0,500,'<NodeName>WGT</NodeName><Rigid>2</Rigid><ComponentRefNo>TEST-1</ComponentRefNo><Endpoint>2</Endpoint><ElementLengthMm>300</ElementLengthMm>')+
 '</Branch></Pipe></PipeStressExport>';
export function xml229TopologyJourneyState(){
 const lineRows=[{LineNo:'P8810021',Rating:'300'}];
 const pipingClassRows=[{Class:'31441C4',Rating:'300'}];
 const materialMapRows=[{Material:'TEST',Code:1}];
 const weightMasterRows=[{Rating:'300',Bore:100,Length:300,'RF/RTJ KG':12.5,TypeDesc:'Gate Valve'}];
 const config={linelist:{masterRows:lineRows},pipingClass:{masterRows:pipingClassRows},
  material:{mapRows:materialMapRows},weight:{masterRows:weightMasterRows},
  overrides:{rating:{P8810021:'300'},processData:{P8810021:{rating:'300'}}}};
 const kinds=['lineList','pipingClass','materialMap','weight'];
 return {sourceKind:'xml',sourceText:xml229TopologyJourneyXml,xmlProcessingMode:'single',
  modeASourceId:'SYNTHETIC-TOPOLOGY-JOURNEY',activePhaseId:'run',
  supportConfigJson:JSON.stringify(config),branchSelection:{},
  options:{outputMode:'cii-only',kgToNewton:true,useRestraintTypeBasedOnJson:false,
   analyzeTopology:true,generateTopoFix:true,useTopoFixForCii:true,topologyActionIds:[]},
  masterContext:{config,lineRows,pipingClassRows,materialMapRows,weightMasterRows,
   rowCounts:Object.fromEntries(kinds.map(k=>[k,1])),
   appliedMappingRevision:Object.fromEntries(kinds.map(k=>[k,1])),
   sourceMetadata:Object.fromEntries(kinds.map(k=>[k,{source:'synthetic-'+k+'.csv',
    sourceType:'manual',status:'loaded'}]))}};
}
